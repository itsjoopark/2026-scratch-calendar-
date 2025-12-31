import * as THREE from 'three';
import { 
  curlVertexShader, 
  curlFragmentShader,
  fallingVertexShader,
  fallingFragmentShader 
} from './shaders/curl-shader';

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

// Spring physics helper
class SpringPhysics {
  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  target = { x: 0, y: 0 };
  
  stiffness = 180;
  damping = 12;
  mass = 1;
  
  update(dt: number): void {
    const dx = this.position.x - this.target.x;
    const dy = this.position.y - this.target.y;
    
    const forceX = -this.stiffness * dx - this.damping * this.velocity.x;
    const forceY = -this.stiffness * dy - this.damping * this.velocity.y;
    
    const ax = forceX / this.mass;
    const ay = forceY / this.mass;
    
    this.velocity.x += ax * dt;
    this.velocity.y += ay * dt;
    
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }
  
  setTarget(x: number, y: number): void {
    this.target.x = x;
    this.target.y = y;
  }
  
  reset(): void {
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
  }
}

export class PaperTear {
  private mesh: THREE.Mesh;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  private texture: THREE.CanvasTexture;
  private paperTextureImage: HTMLImageElement | null = null;
  
  // Detached paper (draggable across screen)
  private detachedMesh: THREE.Mesh | null = null;
  private detachedMaterial: THREE.MeshBasicMaterial | null = null;
  
  // Falling paper
  private fallingMesh: THREE.Mesh | null = null;
  private fallingMaterial: THREE.ShaderMaterial | null = null;
  
  // Interaction state
  private isDragging = false;
  private isDetached = false; // Paper is torn off but still being held
  private isFalling = false;
  private dragStart = { x: 0, y: 0 };
  private dragCurrent = { x: 0, y: 0 };
  private grabPointUV = { x: 0.5, y: 0.5 };
  
  // Spring physics
  private spring = new SpringPhysics();
  private detachedSpring = new SpringPhysics();
  
  // Physics values
  private curlAmount = 0;
  private targetCurl = 0;
  private dragDirection = { x: 0, y: 1 };
  
  // Velocity tracking
  private velocityHistory: { x: number; y: number; t: number }[] = [];
  private releaseVelocity = { x: 0, y: 0 };
  
  // State flags
  private isTearing = false;
  private fallTime = 0;
  private isLocked = false;
  private tearCompleted = false;
  
  private options: PaperTearOptions;
  private date: CalendarDate;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  
  private clock = new THREE.Clock();
  private lastTime = 0;
  
  // Store canvas rect for coordinate conversion
  private canvasRect: DOMRect | null = null;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, date: CalendarDate, options: PaperTearOptions) {
    this.scene = scene;
    this.camera = camera;
    this.date = date;
    this.options = options;
    
    this.detachedSpring.stiffness = 250;
    this.detachedSpring.damping = 18;
    
    this.geometry = new THREE.PlaneGeometry(
      options.width,
      options.height,
      options.segments,
      options.segments
    );
    
    this.loadPaperTexture();
    this.texture = this.createPaperTexture(date);
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: curlVertexShader,
      fragmentShader: curlFragmentShader,
      uniforms: {
        uCurlAmount: { value: 0.0 },
        uCurlRadius: { value: options.height * 0.12 },
        uTime: { value: 0.0 },
        uDragDirection: { value: new THREE.Vector2(0, 1) },
        uDragOffset: { value: new THREE.Vector2(0, 0) },
        uTexture: { value: this.texture },
      },
      side: THREE.DoubleSide,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = 0.0;
    scene.add(this.mesh);
    
    console.log('PaperTear initialized');
  }
  
  private loadPaperTexture(): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.paperTextureImage = img;
      this.texture = this.createPaperTexture(this.date);
      this.material.uniforms.uTexture.value = this.texture;
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
  
  updateDate(date: CalendarDate): void {
    this.date = date;
    this.texture.dispose();
    this.texture = this.createPaperTexture(date);
    this.material.uniforms.uTexture.value = this.texture;
    
    // Reset all state
    this.curlAmount = 0;
    this.targetCurl = 0;
    this.dragDirection = { x: 0, y: 1 };
    this.isTearing = false;
    this.isDetached = false;
    this.isFalling = false;
    this.fallTime = 0;
    this.tearCompleted = false;
    this.spring.reset();
    this.detachedSpring.reset();
    this.velocityHistory = [];
    
    // Reset uniforms
    this.material.uniforms.uCurlAmount.value = 0;
    this.material.uniforms.uDragDirection.value.set(0, 1);
    this.material.uniforms.uDragOffset.value.set(0, 0);
    this.mesh.visible = true;
    
    // Clean up detached mesh
    if (this.detachedMesh) {
      this.scene.remove(this.detachedMesh);
      this.detachedMesh.geometry.dispose();
      this.detachedMaterial?.dispose();
      this.detachedMesh = null;
      this.detachedMaterial = null;
    }
    
    if (this.fallingMesh) {
      this.scene.remove(this.fallingMesh);
      this.fallingMesh.geometry.dispose();
      this.fallingMaterial?.dispose();
      this.fallingMesh = null;
      this.fallingMaterial = null;
    }
  }
  
  private screenToUV(screenX: number, screenY: number, rect: DOMRect): { x: number; y: number } {
    const x = (screenX - rect.left) / rect.width;
    const y = 1 - (screenY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  
  // Convert screen coordinates to world coordinates
  private screenToWorld(screenX: number, screenY: number): THREE.Vector3 {
    if (!this.canvasRect) return new THREE.Vector3(0, 0, 0);
    
    const ndcX = ((screenX - this.canvasRect.left) / this.canvasRect.width) * 2 - 1;
    const ndcY = -((screenY - this.canvasRect.top) / this.canvasRect.height) * 2 + 1;
    
    const vector = new THREE.Vector3(ndcX, ndcY, 0);
    vector.unproject(this.camera);
    
    return vector;
  }
  
  startDrag(screenX: number, screenY: number, canvasRect: DOMRect): void {
    if (this.isFalling || this.isLocked) {
      return;
    }
    
    this.canvasRect = canvasRect;
    
    // If detached, start dragging the detached paper
    if (this.isDetached && this.detachedMesh) {
      this.isDragging = true;
      this.dragStart = { x: screenX, y: screenY };
      this.dragCurrent = { x: screenX, y: screenY };
      this.velocityHistory = [];
      this.lastTime = performance.now();
      console.log('Dragging detached paper');
      return;
    }
    
    if (this.isTearing) return;
    
    this.isDragging = true;
    this.dragStart = { x: screenX, y: screenY };
    this.dragCurrent = { x: screenX, y: screenY };
    
    this.grabPointUV = this.screenToUV(screenX, screenY, canvasRect);
    
    this.spring.reset();
    this.velocityHistory = [];
    this.lastTime = performance.now();
    
    console.log('Drag started at UV:', this.grabPointUV.x.toFixed(2), this.grabPointUV.y.toFixed(2));
  }
  
  updateDrag(screenX: number, screenY: number): void {
    if (!this.isDragging) return;
    
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    // Track velocity
    this.velocityHistory.push({
      x: screenX - this.dragCurrent.x,
      y: screenY - this.dragCurrent.y,
      t: now
    });
    if (this.velocityHistory.length > 5) {
      this.velocityHistory.shift();
    }
    
    this.dragCurrent = { x: screenX, y: screenY };
    
    // If detached, move the detached paper to follow cursor
    if (this.isDetached && this.detachedMesh) {
      const worldPos = this.screenToWorld(screenX, screenY);
      this.detachedSpring.setTarget(worldPos.x, worldPos.y);
      return;
    }
    
    if (this.isTearing) return;
    
    // Normal drag - curl the paper
    const dragX = screenX - this.dragStart.x;
    const dragY = this.dragStart.y - screenY;
    const dragDistance = Math.sqrt(dragX * dragX + dragY * dragY);
    
    this.spring.setTarget(dragX, dragY);
    
    if (dragDistance > 3) {
      this.dragDirection = {
        x: dragX / dragDistance,
        y: dragY / dragDistance
      };
    }
    
    this.targetCurl = Math.min(1, dragDistance / 120);
    
    this.material.uniforms.uDragDirection.value.set(this.dragDirection.x, this.dragDirection.y);
    this.material.uniforms.uDragOffset.value.set(this.spring.position.x, this.spring.position.y);
    
    // Detach paper at threshold (but don't drop it yet!)
    if (this.targetCurl > 0.85 && !this.isTearing && !this.isDetached) {
      this.detachPaper();
    }
  }
  
  endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    this.calculateReleaseVelocity();
    
    // If detached and released, start falling
    if (this.isDetached) {
      this.startFalling();
      return;
    }
    
    if (this.targetCurl > 0.55 && !this.isTearing && !this.isDetached) {
      this.detachPaper();
      // Immediately start falling since user released
      setTimeout(() => {
        if (this.isDetached && !this.isFalling) {
          this.startFalling();
        }
      }, 100);
    } else if (!this.isTearing) {
      this.targetCurl = 0;
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
      x: sumX / this.velocityHistory.length * 0.025,
      y: -sumY / this.velocityHistory.length * 0.025
    };
  }
  
  /**
   * Detach the paper - it's torn but user is still holding it
   */
  private detachPaper(): void {
    this.isTearing = true;
    this.targetCurl = 1.0;
    
    // Create a simple mesh for the detached paper that can be dragged freely
    setTimeout(() => {
      this.createDetachedMesh();
      this.isDetached = true;
      this.mesh.visible = false;
      
      // Trigger the completion callback (date updates)
      if (!this.tearCompleted) {
        this.tearCompleted = true;
        this.options.onTearComplete();
      }
      
      console.log('Paper detached - drag it around!');
    }, 250);
  }
  
  /**
   * Create the detached paper mesh
   */
  private createDetachedMesh(): void {
    const detachedGeometry = new THREE.PlaneGeometry(
      this.options.width,
      this.options.height
    );
    
    this.detachedMaterial = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    
    this.detachedMesh = new THREE.Mesh(detachedGeometry, this.detachedMaterial);
    
    // Position at current cursor location
    const worldPos = this.screenToWorld(this.dragCurrent.x, this.dragCurrent.y);
    this.detachedMesh.position.set(worldPos.x, worldPos.y, 0.5);
    
    // Initial rotation based on drag direction
    const angle = Math.atan2(this.dragDirection.x, this.dragDirection.y);
    this.detachedMesh.rotation.z = angle * 0.3;
    this.detachedMesh.rotation.x = -0.2; // Slight tilt
    
    // Initialize spring at this position
    this.detachedSpring.position = { x: worldPos.x, y: worldPos.y };
    this.detachedSpring.target = { x: worldPos.x, y: worldPos.y };
    this.detachedSpring.velocity = { x: 0, y: 0 };
    
    this.scene.add(this.detachedMesh);
  }
  
  /**
   * Start the falling animation
   */
  private startFalling(): void {
    if (this.isFalling) return;
    
    this.isFalling = true;
    this.isDetached = false;
    this.fallTime = 0;
    
    console.log('Paper released - falling!');
    
    const fallingGeometry = this.geometry.clone();
    
    // Use release velocity for initial momentum
    const velocity = new THREE.Vector3(
      this.releaseVelocity.x * 2 + (Math.random() - 0.5) * 0.5,
      this.releaseVelocity.y * 2 + (Math.random() - 0.5) * 0.5,
      0.3 + Math.random() * 0.2
    );
    
    const angularVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 3
    );
    
    this.fallingMaterial = new THREE.ShaderMaterial({
      vertexShader: fallingVertexShader,
      fragmentShader: fallingFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFallProgress: { value: 0 },
        uVelocity: { value: velocity },
        uAngularVelocity: { value: angularVelocity },
        uGravity: { value: 4.0 },
        uAirResistance: { value: 0.6 },
        uTexture: { value: this.texture },
        uOpacity: { value: 1.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
    
    this.fallingMesh = new THREE.Mesh(fallingGeometry, this.fallingMaterial);
    
    // Start from detached position
    if (this.detachedMesh) {
      this.fallingMesh.position.copy(this.detachedMesh.position);
      this.fallingMesh.rotation.copy(this.detachedMesh.rotation);
      
      // Remove detached mesh
      this.scene.remove(this.detachedMesh);
      this.detachedMesh.geometry.dispose();
      this.detachedMaterial?.dispose();
      this.detachedMesh = null;
      this.detachedMaterial = null;
    } else {
      this.fallingMesh.position.copy(this.mesh.position);
    }
    
    this.scene.add(this.fallingMesh);
  }
  
  update(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();
    
    this.material.uniforms.uTime.value = elapsed;
    
    // Update spring physics for attached paper
    if (this.isDragging && !this.isDetached) {
      this.spring.update(dt);
      this.material.uniforms.uDragOffset.value.set(this.spring.position.x, this.spring.position.y);
    }
    
    // Smooth curl animation
    const curlSpeed = this.isTearing ? 8 : (this.isDragging ? 10 : 8);
    this.curlAmount += (this.targetCurl - this.curlAmount) * Math.min(dt * curlSpeed, 0.3);
    this.material.uniforms.uCurlAmount.value = this.curlAmount;
    
    // Update detached paper following cursor
    if (this.isDetached && this.detachedMesh) {
      this.detachedSpring.update(dt);
      this.detachedMesh.position.x = this.detachedSpring.position.x;
      this.detachedMesh.position.y = this.detachedSpring.position.y;
      
      // Subtle rotation based on movement
      const velX = this.detachedSpring.velocity.x;
      const velY = this.detachedSpring.velocity.y;
      this.detachedMesh.rotation.z = velX * 0.05;
      this.detachedMesh.rotation.x = -0.15 + velY * 0.03;
    }
    
    // Update falling paper
    if (this.isFalling && this.fallingMesh && this.fallingMaterial) {
      this.fallTime += dt;
      this.fallingMaterial.uniforms.uFallProgress.value = this.fallTime;
      this.fallingMaterial.uniforms.uTime.value = elapsed;
      
      // Fade out
      const opacity = Math.max(0, 1 - this.fallTime * 0.4);
      this.fallingMaterial.uniforms.uOpacity.value = opacity;
      
      // Remove when done
      if (this.fallTime > 2.5) {
        this.scene.remove(this.fallingMesh);
        this.fallingMesh.geometry.dispose();
        this.fallingMaterial.dispose();
        this.fallingMesh = null;
        this.fallingMaterial = null;
        this.isFalling = false;
        this.isTearing = false;
        this.fallTime = 0;
      }
    }
  }
  
  intersects(raycaster: THREE.Raycaster): boolean {
    // Check both attached and detached meshes
    if (this.detachedMesh) {
      return raycaster.intersectObject(this.detachedMesh).length > 0;
    }
    return raycaster.intersectObject(this.mesh).length > 0;
  }
  
  getMesh(): THREE.Mesh {
    return this.mesh;
  }
  
  isInteractive(): boolean {
    return !this.isFalling && !this.isLocked;
  }
  
  isDraggingDetached(): boolean {
    return this.isDetached && this.isDragging;
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
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.scene.remove(this.mesh);
    
    if (this.detachedMesh) {
      this.scene.remove(this.detachedMesh);
      this.detachedMesh.geometry.dispose();
      this.detachedMaterial?.dispose();
    }
    
    if (this.fallingMesh) {
      this.scene.remove(this.fallingMesh);
      this.fallingMesh.geometry.dispose();
      this.fallingMaterial?.dispose();
    }
  }
}
