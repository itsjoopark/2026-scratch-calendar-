/**
 * Fireworks Celebration System
 * Apple iMessage-style fireworks with sharp elongated streaks and glitter
 */

import * as THREE from 'three';
import {
  fireworkVertexShader,
  fireworkFragmentShader,
} from './shaders/firework-shader';

// Color palettes - Apple iMessage style with rich, vibrant colors
const COLOR_PALETTES = [
  // Gold burst (like first reference image)
  [
    new THREE.Color('#ffd700'),
    new THREE.Color('#ffaa00'),
    new THREE.Color('#ff8c00'),
    new THREE.Color('#ffffff'),
  ],
  // Green glitter (like second reference image)
  [
    new THREE.Color('#2ecc71'),
    new THREE.Color('#27ae60'),
    new THREE.Color('#1abc9c'),
    new THREE.Color('#a8e6cf'),
  ],
  // Bright white/silver
  [
    new THREE.Color('#ffffff'),
    new THREE.Color('#f0f0f0'),
    new THREE.Color('#e8e8e8'),
    new THREE.Color('#fffacd'),
  ],
  // Hot pink/magenta
  [
    new THREE.Color('#ff1493'),
    new THREE.Color('#ff69b4'),
    new THREE.Color('#ff85c1'),
    new THREE.Color('#ffffff'),
  ],
  // Electric blue
  [
    new THREE.Color('#00bfff'),
    new THREE.Color('#1e90ff'),
    new THREE.Color('#87ceeb'),
    new THREE.Color('#ffffff'),
  ],
  // Red/orange celebration
  [
    new THREE.Color('#ff4500'),
    new THREE.Color('#ff6347'),
    new THREE.Color('#ffa500'),
    new THREE.Color('#ffcc00'),
  ],
  // Purple magic
  [
    new THREE.Color('#9b59b6'),
    new THREE.Color('#8e44ad'),
    new THREE.Color('#a569bd'),
    new THREE.Color('#d7bde2'),
  ],
  // Teal/cyan
  [
    new THREE.Color('#00ced1'),
    new THREE.Color('#20b2aa'),
    new THREE.Color('#48d1cc'),
    new THREE.Color('#afeeee'),
  ],
];

interface FireworkBurst {
  particles: THREE.Points;
  startTime: number;
  duration: number;
}

export class Fireworks {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  
  private bursts: FireworkBurst[] = [];
  private isActive = false;
  private startTime = 0;
  private totalDuration = 10000;
  private animationId: number | null = null;
  
  // Configuration - more particles for denser effect
  private numBursts = 14;
  private particlesPerBurst = 250;
  private gravity = 1.8;
  private drag = 0.5;
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'fireworks-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      transition: opacity 0.3s ease-in;
    `;
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.z = 10;
    
    window.addEventListener('resize', this.handleResize);
  }
  
  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
  
  launch(): void {
    if (this.isActive) return;
    
    console.log('🎆 Launching Apple-style fireworks!');
    this.isActive = true;
    this.startTime = performance.now();
    
    document.body.appendChild(this.canvas);
    
    requestAnimationFrame(() => {
      this.canvas.style.opacity = '1';
    });
    
    // Staggered burst timing for dramatic effect
    const burstDelays = [
      0, 100, 250, 400, 600, 850,
      1150, 1500, 1900, 2400, 3000, 3700, 4500, 5500
    ];
    
    for (let i = 0; i < this.numBursts; i++) {
      const delay = burstDelays[i] || i * 400;
      
      setTimeout(() => {
        if (this.isActive) {
          this.createBurst(i);
        }
      }, delay);
    }
    
    this.animate();
    
    setTimeout(() => {
      this.cleanup();
    }, this.totalDuration + 2000);
  }
  
  private createBurst(index: number): void {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    
    // Position bursts across the screen
    const x = (Math.random() - 0.5) * width * 0.85;
    const y = (Math.random() - 0.25) * height * 0.75;
    const z = -1 + Math.random() * 2;
    
    const origin = new THREE.Vector3(x, y, z);
    
    // Select color palette
    const palette = COLOR_PALETTES[index % COLOR_PALETTES.length];
    
    const particleCount = this.particlesPerBurst + Math.floor(Math.random() * 100);
    
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);
    const birthTimes = new Float32Array(particleCount);
    const sparkles = new Float32Array(particleCount);
    const streakLengths = new Float32Array(particleCount);
    
    const currentTime = (performance.now() - this.startTime) / 1000;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      positions[i3] = origin.x;
      positions[i3 + 1] = origin.y;
      positions[i3 + 2] = origin.z;
      
      // Spherical explosion with variation
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 2.5 + Math.random() * 4;
      
      // Add some clustering for ray-like effect
      const cluster = Math.floor(Math.random() * 32);
      const clusterAngle = (cluster / 32) * Math.PI * 2;
      const clusterSpread = 0.15;
      const finalTheta = theta * (1 - clusterSpread) + clusterAngle * clusterSpread;
      
      velocities[i3] = Math.sin(phi) * Math.cos(finalTheta) * speed;
      velocities[i3 + 1] = Math.sin(phi) * Math.sin(finalTheta) * speed + 1.5;
      velocities[i3 + 2] = Math.cos(phi) * speed * 0.4;
      
      // Color
      const colorIndex = Math.floor(Math.random() * palette.length);
      const color = palette[colorIndex];
      const brightness = 0.9 + Math.random() * 0.2;
      colors[i3] = color.r * brightness;
      colors[i3 + 1] = color.g * brightness;
      colors[i3 + 2] = color.b * brightness;
      
      // Larger particles for visibility
      sizes[i] = 5 + Math.random() * 8;
      
      // Lifetime
      lifetimes[i] = 2.0 + Math.random() * 2.0;
      
      // Stagger births slightly
      birthTimes[i] = currentTime + Math.random() * 0.08;
      
      // More particles sparkle
      sparkles[i] = Math.random() > 0.4 ? 1.0 : 0.0;
      
      // Streak length varies
      streakLengths[i] = 0.5 + Math.random() * 1.5;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aLifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('aBirthTime', new THREE.BufferAttribute(birthTimes, 1));
    geometry.setAttribute('aSparkle', new THREE.BufferAttribute(sparkles, 1));
    geometry.setAttribute('aStreakLength', new THREE.BufferAttribute(streakLengths, 1));
    
    const material = new THREE.ShaderMaterial({
      vertexShader: fireworkVertexShader,
      fragmentShader: fireworkFragmentShader,
      uniforms: {
        uTime: { value: currentTime },
        uGravity: { value: this.gravity },
        uDrag: { value: this.drag },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    
    const particles = new THREE.Points(geometry, material);
    
    this.scene.add(particles);
    
    const burst: FireworkBurst = {
      particles,
      startTime: performance.now(),
      duration: 5500,
    };
    
    this.bursts.push(burst);
  }
  
  private animate = (): void => {
    if (!this.isActive) return;
    
    this.animationId = requestAnimationFrame(this.animate);
    
    const currentTime = (performance.now() - this.startTime) / 1000;
    
    for (const burst of this.bursts) {
      const material = burst.particles.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = currentTime;
    }
    
    const now = performance.now();
    this.bursts = this.bursts.filter(burst => {
      const elapsed = now - burst.startTime;
      if (elapsed > burst.duration) {
        this.scene.remove(burst.particles);
        burst.particles.geometry.dispose();
        (burst.particles.material as THREE.ShaderMaterial).dispose();
        return false;
      }
      return true;
    });
    
    this.renderer.render(this.scene, this.camera);
  };
  
  update(): void {
    // Animation handled internally
  }
  
  cleanup(): void {
    this.canvas.style.opacity = '0';
    
    setTimeout(() => {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      for (const burst of this.bursts) {
        this.scene.remove(burst.particles);
        burst.particles.geometry.dispose();
        (burst.particles.material as THREE.ShaderMaterial).dispose();
      }
      this.bursts = [];
      
      if (this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      
      this.isActive = false;
    }, 500);
  }
  
  isPlaying(): boolean {
    return this.isActive;
  }
  
  dispose(): void {
    this.cleanup();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
