import * as THREE from 'three';

export interface CalendarDate {
  year: number;
  month: string;
  day: number;
  isNewYear: boolean;
}

export interface PaperTearOptions {
  width: number;
  height: number;
  segments: number;
  onTearComplete: () => void;
}

/**
 * PaperTear - Simulates paper peel/tear interaction
 * Based on Figma flow: paper pivots from top edge, rotates and translates with drag
 * Supports full-screen dragging after detachment
 */
export class PaperTear {
  private mesh: THREE.Mesh;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;
  private paperTextureImage: HTMLImageElement | null = null;
  
  // Detached paper (full-screen draggable)
  private detachedCanvas: HTMLCanvasElement | null = null;
  private isDetached = false;
  private detachedPosition = { x: 0, y: 0 };
  private detachedRotation = 0;
  
  // Interaction state
  private isDragging = false;
  private isFalling = false;
  private dragStart = { x: 0, y: 0 };
  private dragCurrent = { x: 0, y: 0 };
  
  // Transform state (for smooth animation)
  private currentRotation = { x: 0, y: 0, z: 0 };
  private currentPosition = { x: 0, y: 0 };
  private targetRotation = { x: 0, y: 0, z: 0 };
  private targetPosition = { x: 0, y: 0 };
  
  // Velocity tracking for release physics
  private velocityHistory: { x: number; y: number; t: number }[] = [];
  private releaseVelocity = { x: 0, y: 0 };
  
  // Fall animation
  private fallTime = 0;
  private fallVelocity = { x: 0, y: 0, rot: 0 };
  
  // State flags
  private isLocked = false;
  private tearCompleted = false;
  
  // Pivot point (top center of paper, near binding)
  private pivotOffset: number;
  
  // Canvas rect for coordinate conversion
  private canvasRect: DOMRect | null = null;
  
  private options: PaperTearOptions;
  private date: CalendarDate;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  
  private clock = new THREE.Clock();
  private animationId: number | null = null;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, date: CalendarDate, options: PaperTearOptions) {
    this.scene = scene;
    this.camera = camera;
    this.date = date;
    this.options = options;
    
    // Pivot offset - paper pivots from top edge
    this.pivotOffset = options.height / 2;
    
    // Simple plane geometry (no subdivisions needed for rotation)
    this.geometry = new THREE.PlaneGeometry(options.width, options.height);
    
    // Shift geometry so pivot is at top edge
    this.geometry.translate(0, -options.height / 2, 0);
    
    this.loadPaperTexture();
    this.texture = this.createPaperTexture(date);
    
    // Simple material (no shader needed for rotation-based animation)
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Position mesh so pivot point is at the binding location
    this.mesh.position.y = this.pivotOffset;
    this.mesh.position.z = 0.05;
    scene.add(this.mesh);
    
    console.log('PaperTear initialized - rotation-based interaction');
  }
  
  private loadPaperTexture(): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.paperTextureImage = img;
      this.texture = this.createPaperTexture(this.date);
      this.material.map = this.texture;
      this.material.needsUpdate = true;
    };
    img.src = '/assets/a966dcba007d27de14f5f742b855f50182a1a6fd.png';
  }
  
  private createPaperTexture(date: CalendarDate): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    const width = 900;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    if (this.paperTextureImage) {
      ctx.drawImage(this.paperTextureImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, width, height);
      
      // Paper texture lines
      ctx.strokeStyle = 'rgba(210, 205, 195, 0.12)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 400; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const length = 30 + Math.random() * 70;
        const angle = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
        ctx.stroke();
      }
    }
    
    // Typography
    const contentTop = height * 0.268;
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = '400 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(date.year), width / 2, contentTop - 100);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 400px "Instrument Serif", Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(date.day), width / 2, height * 0.47);
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = '600 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(date.month, width / 2, height * 0.63);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  
  /**
   * Create a detached paper element that can be dragged across the entire screen
   * Size matches the actual Three.js paper as it appears on screen
   */
  private createDetachedPaper(): void {
    // Calculate paper size based on canvas rect (matches Three.js render size)
    // The paper takes up about 60% of the canvas width
    let paperWidth = 280;
    let paperHeight = 373;
    
    if (this.canvasRect) {
      // Paper is about 75% of canvas width, with 3:4 aspect ratio
      paperWidth = this.canvasRect.width * 0.75;
      paperHeight = paperWidth * (4 / 3);
    }
    
    // Create a canvas element for the detached paper
    const canvas = document.createElement('canvas');
    // Use higher resolution for crisp rendering
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = paperWidth * dpr;
    canvas.height = paperHeight * dpr;
    canvas.style.cssText = `
      position: fixed;
      width: ${paperWidth}px;
      height: ${paperHeight}px;
      pointer-events: none;
      z-index: 9998;
      transform-origin: center top;
      filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));
    `;
    
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    
    // Draw paper background
    if (this.paperTextureImage) {
      ctx.drawImage(this.paperTextureImage, 0, 0, paperWidth, paperHeight);
    } else {
      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, paperWidth, paperHeight);
    }
    
    // Draw text - scale based on paper size
    const scale = paperWidth / 900;
    const contentTop = paperHeight * 0.268;
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = `400 ${Math.round(50 / scale * 0.28)}px "Instrument Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(this.date.year), paperWidth / 2, contentTop - paperHeight * 0.08);
    
    ctx.fillStyle = '#000000';
    ctx.font = `italic ${Math.round(400 / scale * 0.28)}px "Instrument Serif", Georgia, serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.date.day), paperWidth / 2, paperHeight * 0.47);
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = `600 ${Math.round(50 / scale * 0.28)}px "Instrument Sans", system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(this.date.month, paperWidth / 2, paperHeight * 0.63);
    
    document.body.appendChild(canvas);
    this.detachedCanvas = canvas;
    
    // Position at current drag location - center paper on cursor
    this.detachedPosition = { 
      x: this.dragCurrent.x - paperWidth / 2,
      y: this.dragCurrent.y - paperHeight * 0.3 // Offset so cursor is near middle-top
    };
    this.detachedRotation = this.currentRotation.z;
    
    this.updateDetachedPaperTransform();
  }
  
  private updateDetachedPaperTransform(): void {
    if (!this.detachedCanvas) return;
    
    const rotDeg = (this.detachedRotation * 180 / Math.PI);
    this.detachedCanvas.style.left = `${this.detachedPosition.x}px`;
    this.detachedCanvas.style.top = `${this.detachedPosition.y}px`;
    this.detachedCanvas.style.transform = `rotate(${rotDeg}deg)`;
    this.detachedCanvas.style.opacity = this.material.opacity.toString();
  }
  
  private removeDetachedPaper(): void {
    if (this.detachedCanvas && this.detachedCanvas.parentNode) {
      this.detachedCanvas.parentNode.removeChild(this.detachedCanvas);
    }
    this.detachedCanvas = null;
    this.isDetached = false;
  }
  
  updateDate(date: CalendarDate): void {
    this.date = date;
    this.texture.dispose();
    this.texture = this.createPaperTexture(date);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    
    // Make the mesh visible again with the new date
    // This shows the NEXT date underneath the detached paper that's falling
    this.mesh.visible = true;
    this.mesh.position.set(0, this.pivotOffset, 0.05);
    this.mesh.rotation.set(0, 0, 0);
  }
  
  /**
   * Prepare for next tear after animation completes
   */
  private prepareForNextTear(): void {
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.velocityHistory = [];
    this.material.opacity = 1;
    
    // Reset mesh transform
    this.mesh.position.set(0, this.pivotOffset, 0.05);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
    
    // Reset interaction flags for next tear
    this.isDragging = false;
    this.isDetached = false;
    this.isFalling = false;
    this.fallTime = 0;
    this.tearCompleted = false;
  }
  
  private resetState(): void {
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.isFalling = false;
    this.isDetached = false;
    this.isDragging = false;
    this.fallTime = 0;
    this.tearCompleted = false;
    this.velocityHistory = [];
    this.material.opacity = 1;
    
    // Remove detached paper if exists
    this.removeDetachedPaper();
    
    // Reset mesh transform
    this.mesh.position.set(0, this.pivotOffset, 0.05);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
  }
  
  startDrag(screenX: number, screenY: number, canvasRect: DOMRect): void {
    if (this.isFalling || this.isLocked) return;
    
    // If detached, continue dragging the detached paper
    if (this.isDetached) {
      this.isDragging = true;
      this.dragCurrent = { x: screenX, y: screenY };
      this.velocityHistory = [];
      return;
    }
    
    this.canvasRect = canvasRect;
    this.isDragging = true;
    this.dragStart = { x: screenX, y: screenY };
    this.dragCurrent = { x: screenX, y: screenY };
    this.velocityHistory = [];
    
    console.log('Drag started');
  }
  
  updateDrag(screenX: number, screenY: number): void {
    if (!this.isDragging || this.isFalling) return;
    
    const now = performance.now();
    
    // Track velocity
    this.velocityHistory.push({
      x: screenX - this.dragCurrent.x,
      y: screenY - this.dragCurrent.y,
      t: now
    });
    if (this.velocityHistory.length > 5) {
      this.velocityHistory.shift();
    }
    
    const prevX = this.dragCurrent.x;
    const prevY = this.dragCurrent.y;
    this.dragCurrent = { x: screenX, y: screenY };
    
    // If detached, move the detached paper freely across the screen
    if (this.isDetached && this.detachedCanvas) {
      const dx = screenX - prevX;
      const dy = screenY - prevY;
      this.detachedPosition.x += dx;
      this.detachedPosition.y += dy;
      
      // Subtle rotation based on horizontal movement
      this.detachedRotation += dx * 0.002;
      this.detachedRotation = Math.max(-0.5, Math.min(0.5, this.detachedRotation));
      
      this.updateDetachedPaperTransform();
      return;
    }
    
    // Calculate drag delta for attached paper
    const dragX = screenX - this.dragStart.x;
    const dragY = screenY - this.dragStart.y;
    const dragDistance = Math.sqrt(dragX * dragX + dragY * dragY);
    
    // Normalize drag to a 0-1 range (full peel at ~200px drag)
    const dragProgress = Math.min(1, dragDistance / 200);
    
    // X rotation: paper tilts forward as you drag down/away
    this.targetRotation.x = dragProgress * Math.PI * 0.35;
    
    // Z rotation: paper rotates based on horizontal drag direction
    this.targetRotation.z = (dragX / 300) * Math.PI * 0.25;
    
    // Y rotation: slight twist
    this.targetRotation.y = (dragX / 400) * Math.PI * 0.1;
    
    // Position offset: paper moves with the drag
    const scaleFactor = 0.008;
    this.targetPosition.x = dragX * scaleFactor;
    this.targetPosition.y = -dragY * scaleFactor * 0.3;
    
    // Detach paper at threshold (but don't drop - user is still holding)
    if (dragProgress > 0.6 && !this.isDetached) {
      this.detachPaper();
    }
  }
  
  private detachPaper(): void {
    console.log('Paper detached - now draggable across entire screen');
    
    // Hide the Three.js mesh
    this.mesh.visible = false;
    
    // Create the full-screen draggable paper
    this.createDetachedPaper();
    this.isDetached = true;
    
    // Trigger completion callback
    if (!this.tearCompleted) {
      this.tearCompleted = true;
      this.options.onTearComplete();
    }
  }
  
  endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    this.calculateReleaseVelocity();
    
    // If detached, start falling
    if (this.isDetached) {
      this.startFalling();
      return;
    }
    
    // Calculate how much the paper was pulled
    const dragX = this.dragCurrent.x - this.dragStart.x;
    const dragY = this.dragCurrent.y - this.dragStart.y;
    const dragDistance = Math.sqrt(dragX * dragX + dragY * dragY);
    const dragProgress = Math.min(1, dragDistance / 200);
    
    // If dragged enough (>40%), tear off and fall
    if (dragProgress > 0.4) {
      this.detachPaper();
      // Start falling after a tiny delay
      setTimeout(() => this.startFalling(), 50);
    } else {
      // Snap back to original position
      this.targetRotation = { x: 0, y: 0, z: 0 };
      this.targetPosition = { x: 0, y: 0 };
    }
  }
  
  private calculateReleaseVelocity(): void {
    if (this.velocityHistory.length < 2) {
      this.releaseVelocity = { x: 0, y: 0 };
      return;
    }
    
    let sumX = 0, sumY = 0;
    for (const v of this.velocityHistory) {
      sumX += v.x;
      sumY += v.y;
    }
    
    this.releaseVelocity = {
      x: sumX / this.velocityHistory.length,
      y: sumY / this.velocityHistory.length
    };
  }
  
  private startFalling(): void {
    if (this.isFalling) return;
    
    console.log('Paper released - falling!');
    this.isFalling = true;
    this.fallTime = 0;
    
    // Set initial fall velocity based on release momentum
    this.fallVelocity = {
      x: this.releaseVelocity.x * 0.8 + (Math.random() - 0.5) * 2,
      y: this.releaseVelocity.y * 0.5 + 2, // Initial downward velocity
      rot: (Math.random() - 0.5) * 0.1 // Random rotation speed
    };
    
    // Start fall animation for detached paper
    if (this.isDetached) {
      this.animateFallingDetached();
    }
  }
  
  private animateFallingDetached(): void {
    if (!this.isFalling || !this.detachedCanvas) {
      this.removeDetachedPaper();
      this.isFalling = false;
      return;
    }
    
    const gravity = 0.5;
    const airResistance = 0.99;
    
    // Update velocity with gravity
    this.fallVelocity.y += gravity;
    
    // Apply air resistance
    this.fallVelocity.x *= airResistance;
    
    // Update position
    this.detachedPosition.x += this.fallVelocity.x;
    this.detachedPosition.y += this.fallVelocity.y;
    
    // Update rotation (tumbling)
    this.detachedRotation += this.fallVelocity.rot;
    
    // Fade out after a bit
    this.fallTime += 0.016;
    const fadeStart = 0.5;
    const fadeDuration = 1.0;
    if (this.fallTime > fadeStart) {
      this.material.opacity = Math.max(0, 1 - (this.fallTime - fadeStart) / fadeDuration);
    }
    
    this.updateDetachedPaperTransform();
    
    // Remove when off screen or faded
    if (this.detachedPosition.y > window.innerHeight + 200 || this.fallTime > 2.0) {
      this.removeDetachedPaper();
      this.prepareForNextTear();
      console.log('Fall animation complete - ready for next tear');
      return;
    }
    
    this.animationId = requestAnimationFrame(() => this.animateFallingDetached());
  }
  
  update(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    
    // Only update Three.js mesh when not detached
    if (!this.isDetached && !this.isFalling) {
      this.updateDragging(dt);
    }
  }
  
  private updateDragging(dt: number): void {
    // Smooth interpolation toward target (spring-like feel)
    const lerpSpeed = this.isDragging ? 12 : 8;
    const t = Math.min(dt * lerpSpeed, 0.4);
    
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * t;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * t;
    this.currentRotation.z += (this.targetRotation.z - this.currentRotation.z) * t;
    this.currentPosition.x += (this.targetPosition.x - this.currentPosition.x) * t;
    this.currentPosition.y += (this.targetPosition.y - this.currentPosition.y) * t;
    
    // Apply to mesh
    this.mesh.rotation.x = this.currentRotation.x;
    this.mesh.rotation.y = this.currentRotation.y;
    this.mesh.rotation.z = this.currentRotation.z;
    this.mesh.position.x = this.currentPosition.x;
    this.mesh.position.y = this.pivotOffset + this.currentPosition.y;
  }
  
  intersects(raycaster: THREE.Raycaster): boolean {
    return raycaster.intersectObject(this.mesh).length > 0;
  }
  
  getMesh(): THREE.Mesh {
    return this.mesh;
  }
  
  isInteractive(): boolean {
    // Not interactive while falling, detached (still animating), or locked
    return !this.isFalling && !this.isDetached && !this.isLocked && !this.tearCompleted;
  }
  
  isDraggingDetached(): boolean {
    return this.isDetached && this.isDragging;
  }
  
  isPaperDetached(): boolean {
    return this.isDetached;
  }
  
  lock(): void {
    this.isLocked = true;
  }
  
  unlock(): void {
    this.isLocked = false;
  }
  
  isLockedState(): boolean {
    return this.isLocked;
  }
  
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.removeDetachedPaper();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.scene.remove(this.mesh);
  }
}
