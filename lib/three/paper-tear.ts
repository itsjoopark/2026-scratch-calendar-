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
  onFallComplete?: () => void; // Called when falling animation finishes
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
  private detachedDisplaySize = { width: 280, height: 373 };
  
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
    this.mesh.position.z = 0.1; // Above background page
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
    
    // Add "Happy New Year" text for January 1st
    if (date.isNewYear) {
      ctx.fillStyle = '#000000';
      ctx.font = '400 56px "Imperial Script", "Great Vibes", "Dancing Script", cursive';
      ctx.textBaseline = 'top';
      ctx.fillText('Happy New Year', width / 2, height * 0.72);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
  
  /**
   * Create a detached paper element that can be dragged across the entire screen
   * Uses EXACT same rendering as createPaperTexture for pixel-perfect consistency
   */
  private createDetachedPaper(): void {
    // Calculate display size based on canvas rect
    let displayWidth = 280;
    let displayHeight = 373;
    
    if (this.canvasRect) {
      // Paper is about 75% of canvas width, with 3:4 aspect ratio
      displayWidth = this.canvasRect.width * 0.75;
      displayHeight = displayWidth * (4 / 3);
    }
    
    // Create canvas at SAME resolution as the main paper texture (900x1200)
    // This ensures text rendering is IDENTICAL
    const canvas = document.createElement('canvas');
    const textureWidth = 900;
    const textureHeight = 1200;
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    canvas.style.cssText = `
      position: fixed;
      width: ${displayWidth}px;
      height: ${displayHeight}px;
      pointer-events: none;
      z-index: 9998;
      transform-origin: center top;
      filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));
      will-change: transform, opacity;
      transition: none;
    `;
    
    const ctx = canvas.getContext('2d')!;
    
    // Draw paper background - SAME as createPaperTexture
    if (this.paperTextureImage) {
      ctx.drawImage(this.paperTextureImage, 0, 0, textureWidth, textureHeight);
    } else {
      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, textureWidth, textureHeight);
      
      // Paper texture lines
      ctx.strokeStyle = 'rgba(210, 205, 195, 0.12)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 400; i++) {
        const x1 = Math.random() * textureWidth;
        const y1 = Math.random() * textureHeight;
        const length = 30 + Math.random() * 70;
        const angle = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
        ctx.stroke();
      }
    }
    
    // Typography - EXACT SAME as createPaperTexture
    const contentTop = textureHeight * 0.268;
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = '400 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(this.date.year), textureWidth / 2, contentTop - 100);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 400px "Instrument Serif", Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.date.day), textureWidth / 2, textureHeight * 0.47);
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = '600 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.date.month, textureWidth / 2, textureHeight * 0.63);
    
    // Add "Happy New Year" text for January 1st
    if (this.date.isNewYear) {
      ctx.fillStyle = '#000000';
      ctx.font = '400 56px "Imperial Script", "Great Vibes", "Dancing Script", cursive';
      ctx.textBaseline = 'top';
      ctx.fillText('Happy New Year', textureWidth / 2, textureHeight * 0.72);
    }
    
    document.body.appendChild(canvas);
    this.detachedCanvas = canvas;
    
    // Store display size for positioning
    this.detachedDisplaySize = { width: displayWidth, height: displayHeight };
    
    // Calculate position to match the Three.js mesh position exactly
    // The mesh is positioned relative to the canvas center
    if (this.canvasRect) {
      const canvasCenterX = this.canvasRect.left + this.canvasRect.width / 2;
      const canvasCenterY = this.canvasRect.top + this.canvasRect.height / 2;
      
      // Convert mesh position to screen coordinates
      // Account for the pivot offset and current rotation
      const offsetX = this.currentPosition.x * (this.canvasRect.width / 5); // Scale factor
      const offsetY = -this.currentPosition.y * (this.canvasRect.height / 5);
      
      this.detachedPosition = { 
        x: canvasCenterX - displayWidth / 2 + offsetX,
        y: canvasCenterY - displayHeight / 2 + offsetY - displayHeight * 0.1
      };
    } else {
      this.detachedPosition = { 
        x: this.dragCurrent.x - displayWidth / 2,
        y: this.dragCurrent.y - displayHeight * 0.3
      };
    }
    
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
    this.mesh.position.set(0, this.pivotOffset, 0.1);
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
    
    // Reset mesh transform - z=0.1 to sit slightly above background
    this.mesh.position.set(0, this.pivotOffset, 0.1);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
    
    // Reset interaction flags for next tear
    this.isDragging = false;
    this.isDetached = false;
    this.isFalling = false;
    this.fallTime = 0;
    this.tearCompleted = false;
    
    // Notify that fall animation is complete (safe to update background now)
    if (this.options.onFallComplete) {
      this.options.onFallComplete();
    }
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
    
    // Reset mesh transform - z=0.1 to sit above background
    this.mesh.position.set(0, this.pivotOffset, 0.1);
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
    
    // Immediately bring paper to front layer when drag starts
    this.mesh.position.z = 0.5;
    
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
    
    // If detached, move the detached paper freely across the screen with smooth follow
    if (this.isDetached && this.detachedCanvas) {
      const dx = screenX - prevX;
      const dy = screenY - prevY;
      
      // Smooth position following (slight lag for natural feel)
      this.detachedPosition.x += dx * 0.9;
      this.detachedPosition.y += dy * 0.9;
      
      // Subtle rotation based on horizontal movement with smoothing
      const targetRot = dx * 0.003;
      this.detachedRotation += (targetRot - this.detachedRotation * 0.1);
      this.detachedRotation = Math.max(-0.4, Math.min(0.4, this.detachedRotation));
      
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
    
    // Smoother physics with gradual acceleration
    const gravity = 0.35; // Gentler gravity
    const airResistance = 0.985; // More air resistance for floatier feel
    
    // Update velocity with gravity (ease-in feel)
    this.fallVelocity.y += gravity * (1 + this.fallTime * 0.5); // Accelerate over time
    
    // Apply air resistance
    this.fallVelocity.x *= airResistance;
    this.fallVelocity.y *= 0.995; // Slight y resistance too
    
    // Update position smoothly
    this.detachedPosition.x += this.fallVelocity.x;
    this.detachedPosition.y += this.fallVelocity.y;
    
    // Gentle rotation (tumbling)
    this.detachedRotation += this.fallVelocity.rot * 0.8;
    // Dampen rotation over time
    this.fallVelocity.rot *= 0.98;
    
    // Smooth fade out with ease
    this.fallTime += 0.016;
    const fadeStart = 0.6;
    const fadeDuration = 1.2;
    if (this.fallTime > fadeStart) {
      const fadeProgress = (this.fallTime - fadeStart) / fadeDuration;
      // Ease-out fade
      this.material.opacity = Math.max(0, 1 - fadeProgress * fadeProgress);
    }
    
    this.updateDetachedPaperTransform();
    
    // Remove when off screen or faded
    if (this.detachedPosition.y > window.innerHeight + 200 || this.fallTime > 2.5) {
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
    // Smoother interpolation with ease-out curve
    const baseSpeed = this.isDragging ? 8 : 5;
    const t = 1 - Math.pow(1 - Math.min(dt * baseSpeed, 0.25), 2); // Quadratic ease-out
    
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
    
    // Dynamic z-position: push forward as paper tilts to prevent clipping
    // More rotation = further forward to stay above background
    const rotationMagnitude = Math.abs(this.currentRotation.x) + Math.abs(this.currentRotation.z) * 0.5;
    const targetZ = this.isDragging ? 0.5 + rotationMagnitude * 0.5 : 0.05;
    this.mesh.position.z += (targetZ - this.mesh.position.z) * t;
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
