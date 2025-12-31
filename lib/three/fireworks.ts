/**
 * Fireworks Celebration System
 * Shadertoy-style fireworks using full-screen fragment shader
 * Based on https://www.shadertoy.com/view/ssySz1
 */

import * as THREE from 'three';
import {
  fireworkVertexShader,
  fireworkFragmentShader,
} from './shaders/firework-shader';

export class Fireworks {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  
  private isActive = false;
  private startTime = 0;
  private totalDuration = 10000; // 10 seconds
  private animationId: number | null = null;
  
  constructor() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'fireworks-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.5s ease-in;
    `;
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false, // Not needed for full-screen quad
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Orthographic camera for full-screen quad
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Listen for resize
    window.addEventListener('resize', this.handleResize);
  }
  
  private handleResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update shader resolution uniform
    if (this.material) {
      this.material.uniforms.uResolution.value.set(
        window.innerWidth,
        window.innerHeight
      );
    }
  };
  
  private createFullScreenQuad(): void {
    // Full-screen quad geometry
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    // Shader material with Shadertoy-style fireworks
    this.material = new THREE.ShaderMaterial({
      vertexShader: fireworkVertexShader,
      fragmentShader: fireworkFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uIntensity: { value: 1.5 },
        uStartTime: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }
  
  launch(): void {
    if (this.isActive) return;
    
    console.log('🎆 Launching Shadertoy-style fireworks!');
    this.isActive = true;
    this.startTime = performance.now() / 1000;
    
    // Create the full-screen quad if not exists
    if (!this.mesh) {
      this.createFullScreenQuad();
    }
    
    // Set start time in shader
    if (this.material) {
      this.material.uniforms.uStartTime.value = this.startTime;
    }
    
    // Add canvas to DOM
    document.body.appendChild(this.canvas);
    
    // Fade in to 75% opacity (overlay effect - calendar still visible)
    requestAnimationFrame(() => {
      this.canvas.style.opacity = '0.75';
    });
    
    // Start animation loop
    this.animate();
    
    // Auto cleanup after duration
    setTimeout(() => {
      this.cleanup();
    }, this.totalDuration + 1000);
  }
  
  private animate = (): void => {
    if (!this.isActive) return;
    
    this.animationId = requestAnimationFrame(this.animate);
    
    // Update time uniform
    if (this.material) {
      this.material.uniforms.uTime.value = performance.now() / 1000;
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  };
  
  update(): void {
    // Animation handled internally via requestAnimationFrame
  }
  
  cleanup(): void {
    // Smooth, gradual fade out over 2.5 seconds with ease-out curve
    this.canvas.style.transition = 'opacity 2.5s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Small delay to ensure transition property is applied
    requestAnimationFrame(() => {
      this.canvas.style.opacity = '0';
    });
    
    // Wait for the fade transition to complete before removing
    setTimeout(() => {
      // Stop animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      // Remove from DOM
      if (this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      
      this.isActive = false;
    }, 2700); // Slightly longer than transition duration
  }
  
  isPlaying(): boolean {
    return this.isActive;
  }
  
  dispose(): void {
    this.cleanup();
    
    window.removeEventListener('resize', this.handleResize);
    
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    
    this.renderer.dispose();
  }
}
