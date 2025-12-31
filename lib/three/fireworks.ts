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
  private totalDuration = 17763; // ~17.76 seconds - matches fireworks sound effect duration
  private animationId: number | null = null;
  
  // Fireworks sound effect
  private sound: HTMLAudioElement | null = null;
  private soundLoaded = false;
  
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
    
    // Load fireworks sound effect
    this.loadSound();
  }
  
  private loadSound(): void {
    this.sound = new Audio('/assets/sound-files/fireworks-sound-effect.mp3');
    this.sound.preload = 'auto';
    this.sound.volume = 0.6; // 60% volume
    this.sound.loop = false;
    
    this.sound.addEventListener('canplaythrough', () => {
      this.soundLoaded = true;
      console.log('Fireworks sound loaded');
    }, { once: true });
    
    this.sound.addEventListener('error', (e) => {
      console.warn('Failed to load fireworks sound:', e);
    });
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
    
    // Play fireworks sound effect
    this.playSound();
    
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
  
  private playSound(): void {
    if (!this.sound || !this.soundLoaded) {
      console.log('Fireworks sound not ready');
      return;
    }
    
    try {
      this.sound.currentTime = 0;
      this.sound.volume = 0.6;
      this.sound.play().then(() => {
        console.log('🔊 Playing fireworks sound');
      }).catch((error) => {
        console.warn('Fireworks sound playback failed:', error);
      });
    } catch (error) {
      console.warn('Error playing fireworks sound:', error);
    }
  }
  
  private fadeOutSound(): void {
    if (!this.sound) return;
    
    // Gradually fade out the sound over 2 seconds
    const fadeInterval = setInterval(() => {
      if (this.sound && this.sound.volume > 0.05) {
        this.sound.volume = Math.max(0, this.sound.volume - 0.05);
      } else {
        clearInterval(fadeInterval);
        if (this.sound) {
          this.sound.pause();
          this.sound.currentTime = 0;
          this.sound.volume = 0.6; // Reset for next time
        }
      }
    }, 100); // Fade over ~1.2 seconds (12 steps * 100ms)
  }
  
  update(): void {
    // Animation handled internally via requestAnimationFrame
  }
  
  cleanup(): void {
    // Fade out the sound effect
    this.fadeOutSound();
    
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
    
    // Clean up sound
    if (this.sound) {
      this.sound.pause();
      this.sound.src = '';
      this.sound = null;
    }
    
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
