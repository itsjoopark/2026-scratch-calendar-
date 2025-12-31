/**
 * PaperController - Simplified physics-based paper tearing
 * 
 * Combines force-based concepts with reliable Three.js rendering
 */

import * as THREE from 'three';

export interface CalendarDate {
  year: number;
  month: string;
  day: number;
  isNewYear: boolean;
}

export class PaperController {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  
  private mesh: THREE.Mesh;
  private geometry: THREE.PlaneGeometry;
  private material: THREE.ShaderMaterial;
  
  private contentTexture: THREE.CanvasTexture;
  
  private date: CalendarDate;
  private onTearComplete: () => void;
  
  // Interaction state
  private isDragging = false;
  private isLocked = false;
  private tearInProgress = false;
  
  private dragStart = { x: 0, y: 0 };
  private dragCurrent = { x: 0, y: 0 };
  private dragDirection = { x: 0, y: 1 };
  
  // Physics state
  private curlAmount = 0;
  private targetCurl = 0;
  private grabStrength = 0;
  
  // Dimensions
  private width = 3;
  private height = 4;
  
  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    date: CalendarDate,
    onTearComplete: () => void
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.date = date;
    this.onTearComplete = onTearComplete;
    
    // Create geometry with subdivisions for deformation
    this.geometry = new THREE.PlaneGeometry(this.width, this.height, 64, 64);
    
    // Create content texture
    this.contentTexture = this.createContentTexture(date);
    
    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader(),
      uniforms: {
        uTexture: { value: this.contentTexture },
        uCurlAmount: { value: 0.0 },
        uCurlRadius: { value: this.height * 0.12 },
        uDragDirection: { value: new THREE.Vector2(0, 1) },
        uGrabStrength: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.z = 0;
    scene.add(this.mesh);
    
    // Debug: small animation on load to verify shader works
    console.log('PaperController initialized - mesh added to scene');
  }
  
  private getVertexShader(): string {
    return `
      uniform float uCurlAmount;
      uniform float uCurlRadius;
      uniform vec2 uDragDirection;
      uniform float uGrabStrength;
      uniform float uTime;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vCurl;
      
      const float PI = 3.14159265359;
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Calculate curl based on drag direction
        vec2 dragDir = length(uDragDirection) > 0.01 ? normalize(uDragDirection) : vec2(0.0, 1.0);
        
        // Distance along drag direction (0 at back, 1 at front)
        vec2 centered = uv - 0.5;
        float distAlongDrag = dot(centered, dragDir) + 0.5;
        
        // Curl progression
        float curlStart = 1.0 - uCurlAmount;
        float curlProgress = smoothstep(curlStart - 0.1, curlStart + 0.2, distAlongDrag);
        
        if (uCurlAmount > 0.01 && curlProgress > 0.0) {
          // Curl angle and radius
          float angle = curlProgress * uCurlAmount * PI * 1.8;
          float radius = mix(uCurlRadius, uCurlRadius * 0.25, uCurlAmount);
          
          // Cylindrical curl displacement
          float curlDisplace = radius * (1.0 - cos(angle));
          float curlHeight = radius * sin(angle);
          
          // Apply in drag direction
          pos.x += dragDir.x * curlDisplace * curlProgress * 0.5;
          pos.y += dragDir.y * curlDisplace * curlProgress * 0.5;
          pos.z += curlHeight * curlProgress;
          
          // Add wave for natural paper feel
          vec2 perpDir = vec2(-dragDir.y, dragDir.x);
          float perpDist = dot(centered, perpDir);
          float wave = sin(perpDist * PI * 5.0 + angle * 2.0) * 0.02 * uCurlAmount * curlProgress;
          pos.z += wave;
        }
        
        // Grab deformation (local bulge)
        if (uGrabStrength > 0.01) {
          float grabDist = length(centered);
          float grabInfluence = exp(-grabDist * grabDist * 8.0) * uGrabStrength;
          pos.z += grabInfluence * 0.15;
        }
        
        vCurl = curlProgress;
        vNormal = normalize(normalMatrix * normal);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
  }
  
  private getFragmentShader(): string {
    return `
      uniform sampler2D uTexture;
      uniform float uCurlAmount;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying float vCurl;
      
      void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        vec3 color = texColor.rgb;
        
        // Lighting
        vec3 lightDir = normalize(vec3(0.2, 0.3, 1.0));
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        
        // Subtle shadow on curled areas
        float shadow = 1.0 - vCurl * 0.1 * uCurlAmount;
        
        color = color * (0.9 + diffuse * 0.1) * shadow;
        
        gl_FragColor = vec4(color, texColor.a);
      }
    `;
  }
  
  private createContentTexture(date: CalendarDate): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    const width = 900;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Load and draw paper texture
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      this.drawDateContent(ctx, date, width, height);
      this.contentTexture.needsUpdate = true;
    };
    img.onerror = () => {
      // Fallback if image doesn't load
      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, width, height);
      this.drawDateContent(ctx, date, width, height);
      this.contentTexture.needsUpdate = true;
    };
    img.src = '/assets/a966dcba007d27de14f5f742b855f50182a1a6fd.png';
    
    // Draw initial content
    ctx.fillStyle = '#fafaf8';
    ctx.fillRect(0, 0, width, height);
    this.drawDateContent(ctx, date, width, height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  private drawDateContent(ctx: CanvasRenderingContext2D, date: CalendarDate, width: number, height: number): void {
    const contentTop = height * 0.168;
    
    // Year
    ctx.fillStyle = '#2b79ff';
    ctx.font = '400 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(date.year), width / 2, contentTop);
    
    // Day
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 400px "Instrument Serif", Georgia, serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(date.day), width / 2, height * 0.47);
    
    // Month
    ctx.fillStyle = '#2b79ff';
    ctx.font = '600 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(date.month, width / 2, height * 0.63);
  }
  
  updateDate(date: CalendarDate): void {
    this.date = date;
    this.contentTexture.dispose();
    this.contentTexture = this.createContentTexture(date);
    this.material.uniforms.uTexture.value = this.contentTexture;
    
    // Reset state
    this.curlAmount = 0;
    this.targetCurl = 0;
    this.grabStrength = 0;
    this.tearInProgress = false;
    this.isDragging = false;
    
    this.material.uniforms.uCurlAmount.value = 0;
    this.material.uniforms.uGrabStrength.value = 0;
    this.mesh.visible = true;
  }
  
  lock(): void {
    this.isLocked = true;
  }
  
  isLockedState(): boolean {
    return this.isLocked;
  }
  
  isInteractive(): boolean {
    return !this.isLocked && !this.tearInProgress;
  }
  
  startDrag(screenX: number, screenY: number, canvasRect: DOMRect): void {
    if (!this.isInteractive()) return;
    
    this.isDragging = true;
    this.dragStart = { x: screenX, y: screenY };
    this.dragCurrent = { x: screenX, y: screenY };
    
    console.log('Drag started at:', screenX, screenY);
  }
  
  updateDrag(screenX: number, screenY: number, canvasRect: DOMRect): void {
    if (!this.isDragging || this.tearInProgress) return;
    
    this.dragCurrent = { x: screenX, y: screenY };
    
    // Calculate drag vector
    const dragX = screenX - this.dragStart.x;
    const dragY = this.dragStart.y - screenY; // Invert Y
    const dragDistance = Math.sqrt(dragX * dragX + dragY * dragY);
    
    // Update direction
    if (dragDistance > 5) {
      this.dragDirection = {
        x: dragX / dragDistance,
        y: dragY / dragDistance
      };
    }
    
    // Calculate curl and grab amounts
    this.targetCurl = Math.min(1, dragDistance / 120);
    this.grabStrength = Math.min(1, dragDistance / 80);
    
    // Update uniforms
    this.material.uniforms.uDragDirection.value.set(this.dragDirection.x, this.dragDirection.y);
    this.material.uniforms.uGrabStrength.value = this.grabStrength;
    
    console.log('Dragging - curl:', this.targetCurl.toFixed(2), 'direction:', this.dragDirection);
    
    // Auto-tear at threshold
    if (this.targetCurl > 0.85 && !this.tearInProgress) {
      this.triggerTear();
    }
  }
  
  endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    console.log('Drag ended - curl:', this.targetCurl.toFixed(2));
    
    if (this.targetCurl > 0.6 && !this.tearInProgress) {
      this.triggerTear();
    } else if (!this.tearInProgress) {
      // Snap back
      this.targetCurl = 0;
      this.grabStrength = 0;
    }
  }
  
  private triggerTear(): void {
    if (this.tearInProgress) return;
    
    console.log('Tear triggered!');
    this.tearInProgress = true;
    this.targetCurl = 1.0;
    
    // Complete tear after animation
    setTimeout(() => {
      this.mesh.visible = false;
      this.onTearComplete();
    }, 500);
  }
  
  update(dt: number): void {
    // Update time
    this.material.uniforms.uTime.value += dt;
    
    // Smooth curl animation
    const curlSpeed = this.tearInProgress ? 6 : 10;
    this.curlAmount += (this.targetCurl - this.curlAmount) * Math.min(dt * curlSpeed, 0.3);
    this.material.uniforms.uCurlAmount.value = this.curlAmount;
    
    // Decay grab strength when not dragging
    if (!this.isDragging && !this.tearInProgress) {
      this.grabStrength *= Math.pow(0.1, dt);
      this.material.uniforms.uGrabStrength.value = this.grabStrength;
    }
  }
  
  intersects(raycaster: THREE.Raycaster): boolean {
    const intersects = raycaster.intersectObject(this.mesh);
    return intersects.length > 0;
  }
  
  getMesh(): THREE.Mesh {
    return this.mesh;
  }
  
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.contentTexture.dispose();
    this.scene.remove(this.mesh);
  }
}
