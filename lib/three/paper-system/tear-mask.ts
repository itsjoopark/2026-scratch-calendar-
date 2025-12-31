/**
 * TearMask - Procedural texture for torn edge detail
 * 
 * Generates high-frequency torn-edge detail without geometric complexity.
 * Uses noise-based fiber patterns and incremental updates.
 */

import * as THREE from 'three';
import { TearEvent, Vec2, vec2 } from './types';

export class TearMask {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  
  private resolution: number;
  private tearEvents: TearEvent[] = [];
  
  // Noise seed for consistent fiber patterns
  private noiseSeed: number;
  
  constructor(resolution = 512) {
    this.resolution = resolution;
    this.noiseSeed = Math.random() * 1000;
    
    // Create canvas for tear mask
    this.canvas = document.createElement('canvas');
    this.canvas.width = resolution;
    this.canvas.height = resolution;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Initialize with solid white (no tear)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, resolution, resolution);
    
    // Create Three.js texture
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }
  
  /**
   * Get the Three.js texture
   */
  getTexture(): THREE.CanvasTexture {
    return this.texture;
  }
  
  /**
   * Add a new tear event and update the mask
   */
  addTearEvent(event: TearEvent): void {
    this.tearEvents.push(event);
    this.renderTearSegment(event);
    this.texture.needsUpdate = true;
  }
  
  /**
   * Render a single tear segment with fibrous edges
   */
  private renderTearSegment(event: TearEvent): void {
    const { startUV, endUV, width } = event;
    
    // Convert UV to canvas coordinates
    const x0 = startUV.x * this.resolution;
    const y0 = (1 - startUV.y) * this.resolution; // Flip Y
    const x1 = endUV.x * this.resolution;
    const y1 = (1 - endUV.y) * this.resolution;
    
    // Tear direction and perpendicular
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    
    const dirX = dx / len;
    const dirY = dy / len;
    const perpX = -dirY;
    const perpY = dirX;
    
    // Draw the tear as transparent region with fibrous edges
    const tearWidth = width * this.resolution;
    const fiberLength = tearWidth * 2;
    const numFibers = Math.ceil(len / 2);
    
    this.ctx.save();
    
    // Main tear line (transparent)
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.moveTo(x0 + perpX * tearWidth, y0 + perpY * tearWidth);
    this.ctx.lineTo(x1 + perpX * tearWidth, y1 + perpY * tearWidth);
    this.ctx.lineTo(x1 - perpX * tearWidth, y1 - perpY * tearWidth);
    this.ctx.lineTo(x0 - perpX * tearWidth, y0 - perpY * tearWidth);
    this.ctx.closePath();
    this.ctx.fill();
    
    // Draw fiber detail on both sides
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.lineWidth = 0.5;
    
    for (let i = 0; i < numFibers; i++) {
      const t = i / numFibers;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      
      // Generate fiber positions using noise
      const noise1 = this.noise(px * 0.1 + this.noiseSeed, py * 0.1);
      const noise2 = this.noise(px * 0.1 + this.noiseSeed + 100, py * 0.1);
      
      // Left side fibers
      const leftLen = fiberLength * (0.3 + 0.7 * noise1);
      const leftAngle = Math.PI * 0.5 + (noise1 - 0.5) * Math.PI * 0.3;
      
      this.ctx.beginPath();
      this.ctx.moveTo(
        px + perpX * tearWidth,
        py + perpY * tearWidth
      );
      this.ctx.lineTo(
        px + perpX * tearWidth + Math.cos(leftAngle + Math.atan2(perpY, perpX)) * leftLen,
        py + perpY * tearWidth + Math.sin(leftAngle + Math.atan2(perpY, perpX)) * leftLen
      );
      this.ctx.stroke();
      
      // Right side fibers
      const rightLen = fiberLength * (0.3 + 0.7 * noise2);
      const rightAngle = -Math.PI * 0.5 + (noise2 - 0.5) * Math.PI * 0.3;
      
      this.ctx.beginPath();
      this.ctx.moveTo(
        px - perpX * tearWidth,
        py - perpY * tearWidth
      );
      this.ctx.lineTo(
        px - perpX * tearWidth + Math.cos(rightAngle + Math.atan2(-perpY, -perpX)) * rightLen,
        py - perpY * tearWidth + Math.sin(rightAngle + Math.atan2(-perpY, -perpX)) * rightLen
      );
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }
  
  /**
   * Simple noise function for fiber variation
   */
  private noise(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
  
  /**
   * Generate fiber texture for entire paper
   * Called once at initialization
   */
  generateFiberTexture(): THREE.CanvasTexture {
    const fiberCanvas = document.createElement('canvas');
    fiberCanvas.width = this.resolution;
    fiberCanvas.height = this.resolution;
    const ctx = fiberCanvas.getContext('2d')!;
    
    // Base paper color
    ctx.fillStyle = '#fafaf8';
    ctx.fillRect(0, 0, this.resolution, this.resolution);
    
    // Draw fibers (simulate hanji/washi paper)
    ctx.strokeStyle = 'rgba(200, 190, 170, 0.08)';
    ctx.lineWidth = 0.5;
    
    const numFibers = 2000;
    for (let i = 0; i < numFibers; i++) {
      const x = Math.random() * this.resolution;
      const y = Math.random() * this.resolution;
      const angle = Math.random() * Math.PI * 2;
      const length = 20 + Math.random() * 60;
      
      // Slight curve to fiber
      const curve = (Math.random() - 0.5) * 0.3;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      const steps = 5;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const fx = x + Math.cos(angle + curve * t) * length * t;
        const fy = y + Math.sin(angle + curve * t) * length * t;
        ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }
    
    // Add grain
    const imageData = ctx.getImageData(0, 0, this.resolution, this.resolution);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(fiberCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  
  /**
   * Clear the tear mask (reset)
   */
  clear(): void {
    this.tearEvents = [];
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.resolution, this.resolution);
    this.texture.needsUpdate = true;
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.texture.dispose();
  }
}

/**
 * Shader code for paper rendering with tear mask
 */
export const paperShaders = {
  vertexShader: `
    attribute float boundaryMask;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vBoundary;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vBoundary = boundaryMask;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D paperTexture;
    uniform sampler2D tearMask;
    uniform sampler2D contentTexture;
    uniform float tearProgress;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vBoundary;
    
    // Noise for torn edge detail
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }
    
    void main() {
      // Sample textures
      vec4 paperColor = texture2D(paperTexture, vUv);
      vec4 content = texture2D(contentTexture, vUv);
      float mask = texture2D(tearMask, vUv).r;
      
      // Blend paper and content
      vec3 color = mix(paperColor.rgb, content.rgb, content.a);
      
      // Add torn edge darkening (fiber shadows)
      if (vBoundary > 0.5) {
        float edgeNoise = fbm(vUv * 50.0);
        float edgeDarkening = 0.85 + 0.15 * edgeNoise;
        color *= edgeDarkening;
        
        // Slight color shift at edges (exposed fiber)
        color = mix(color, vec3(0.9, 0.88, 0.82), 0.1 * edgeNoise);
      }
      
      // Lighting
      vec3 lightDir = normalize(vec3(0.3, 0.5, 1.0));
      float diffuse = max(dot(vNormal, lightDir), 0.0);
      color *= (0.85 + 0.15 * diffuse);
      
      // Apply tear mask (discard torn pixels)
      float alpha = mask * paperColor.a;
      
      // Soften edges with noise
      if (mask < 0.99 && mask > 0.01) {
        float edgeNoise = fbm(vUv * 100.0);
        alpha *= smoothstep(0.0, 0.5, mask + edgeNoise * 0.3 - 0.15);
      }
      
      gl_FragColor = vec4(color, alpha);
    }
  `,
};

