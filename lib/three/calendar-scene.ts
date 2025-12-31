/**
 * Calendar Scene - Three.js scene for tear-off calendar
 * Uses the proven PaperTear class for physics-based interaction
 */

import * as THREE from 'three';
import { PaperTear, CalendarDate } from './paper-tear';
import { Fireworks } from './fireworks';
import { SoundManager } from './sound-manager';

// Month names for date generation
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate dates from Dec 25, 2025 to Jan 1, 2026
function generateDates(): CalendarDate[] {
  const dates: CalendarDate[] = [];
  const startDate = new Date(2025, 11, 25); // Dec 25, 2025
  const endDate = new Date(2026, 0, 1); // Jan 1, 2026
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push({
      year: currentDate.getFullYear(),
      month: MONTH_NAMES[currentDate.getMonth()],
      day: currentDate.getDate(),
      isNewYear: currentDate.getMonth() === 0 && currentDate.getDate() === 1,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

export class CalendarScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private paperTear: PaperTear;
  private backgroundPage: THREE.Mesh;
  private paperTextureImage: HTMLImageElement | null = null;
  private fireworks: Fireworks;
  private soundManager: SoundManager;
  
  private dates: CalendarDate[];
  private currentIndex = 0;
  
  private container: HTMLElement;
  private animationId: number | null = null;
  
  // Callbacks
  public onDateChange: ((date: CalendarDate) => void) | null = null;
  
  // Dimensions
  private paperWidth = 3;
  private paperHeight = 4;
  private bindingWidth = 3.033;
  private bindingHeight = 0.2;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.dates = generateDates();
    
    // Log all dates for debugging
    console.log('Calendar dates:', this.dates.map(d => `${d.month} ${d.day}, ${d.year}`));
    
    // Get container dimensions
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 533;
    
    console.log('CalendarScene: container size', width, 'x', height);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Create orthographic camera
    const aspect = width / height;
    const frustumSize = 5;
    this.camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    this.camera.position.z = 5;
    
    // Raycaster for interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Load paper texture for background
    this.loadPaperTexture();
    
    // Create binding strip
    this.createBinding();
    
    // Create background page (next date)
    this.backgroundPage = this.createBackgroundPage(this.dates[1] || this.dates[0]);
    this.scene.add(this.backgroundPage);
    
    // Create paper tear controller
    this.paperTear = new PaperTear(
      this.scene,
      this.camera,
      this.dates[0],
      {
        width: this.paperWidth,
        height: this.paperHeight,
        segments: 64,
        onTearComplete: () => this.handleTearComplete(),
        onFallComplete: () => this.handleFallComplete(),
      }
    );
    
    // Add lights
    this.addLights();
    
    // Create fireworks system (full-screen, separate canvas)
    this.fireworks = new Fireworks();
    
    // Create sound manager for tear sound effects
    this.soundManager = new SoundManager();
    
    // Setup event listeners
    this.setupEvents();
    
    // Start animation loop
    this.animate();
    
    // Initial date callback
    if (this.onDateChange) {
      this.onDateChange(this.dates[0]);
    }
  }
  
  private loadPaperTexture(): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.paperTextureImage = img;
      if (this.dates[this.currentIndex + 1]) {
        this.updateBackgroundPage(this.dates[this.currentIndex + 1]);
      }
    };
    img.src = '/assets/a966dcba007d27de14f5f742b855f50182a1a6fd.png';
  }
  
  private createBinding(): void {
    // Binding strip
    const bindingGeometry = new THREE.PlaneGeometry(this.bindingWidth, this.bindingHeight);
    const bindingMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xd9d6d6,
    });
    const binding = new THREE.Mesh(bindingGeometry, bindingMaterial);
    binding.position.y = this.paperHeight / 2 + this.bindingHeight / 2;
    binding.position.z = 0.1;
    this.scene.add(binding);
    
    // Subtle gradient shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 32;
    const shadowCtx = shadowCanvas.getContext('2d')!;
    
    const gradient = shadowCtx.createLinearGradient(0, 0, 0, shadowCanvas.height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.06)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    shadowCtx.fillStyle = gradient;
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeometry = new THREE.PlaneGeometry(this.bindingWidth, 0.15);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.position.y = this.paperHeight / 2 - 0.075;
    shadow.position.z = 0.02;
    this.scene.add(shadow);
  }
  
  private createBackgroundPage(date: CalendarDate): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(this.paperWidth, this.paperHeight);
    
    const canvas = document.createElement('canvas');
    const width = 900;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Draw hanji paper texture if loaded
    if (this.paperTextureImage) {
      ctx.drawImage(this.paperTextureImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#fafaf8';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = 'rgba(210, 205, 195, 0.12)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 300; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const length = 30 + Math.random() * 60;
        const angle = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
        ctx.stroke();
      }
    }
    
    // Typography
    const contentTop = height * 0.168;
    
    ctx.fillStyle = '#2b79ff';
    ctx.font = '400 50px "Instrument Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(date.year), width / 2, contentTop);
    
    // Always black - red was causing glitches
    ctx.fillStyle = '#000000';
    ctx.font = 'italic 400px "Instrument Serif", Georgia, serif';
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
    
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      side: THREE.FrontSide,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.5; // Well behind main paper to prevent clipping during rotation
    
    return mesh;
  }
  
  private updateBackgroundPage(date: CalendarDate): void {
    const oldMaterial = this.backgroundPage.material as THREE.MeshBasicMaterial;
    oldMaterial.map?.dispose();
    oldMaterial.dispose();
    this.scene.remove(this.backgroundPage);
    
    this.backgroundPage = this.createBackgroundPage(date);
    this.scene.add(this.backgroundPage);
  }
  
  private addLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(2, 3, 5);
    this.scene.add(directionalLight);
  }
  
  private setupEvents(): void {
    const canvas = this.renderer.domElement;
    
    // Make canvas focusable and ensure it receives events
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    
    // Use arrow functions to ensure correct 'this' binding
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handleMouseDown(e);
    });
    
    // Listen on window for mouse events to support full-screen dragging
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
    
    // Touch events
    canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    window.addEventListener('touchend', () => this.handleTouchEnd());
    window.addEventListener('touchcancel', () => this.handleTouchEnd());
    
    window.addEventListener('resize', () => this.handleResize());
    
    canvas.style.cursor = 'grab';
    
    console.log('Event listeners attached - supports full-screen dragging');
  }
  
  private updateMousePosition(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  private handleMouseDown(event: MouseEvent): void {
    console.log('Mouse down');
    
    if (!this.paperTear.isInteractive()) {
      console.log('Paper not interactive');
      return;
    }
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.paperTear.startDrag(event.clientX, event.clientY, rect);
    this.renderer.domElement.style.cursor = 'grabbing';
  }
  
  private handleMouseMove(event: MouseEvent): void {
    this.paperTear.updateDrag(event.clientX, event.clientY);
    
    // Update cursor when dragging detached paper (full-screen)
    if (this.paperTear.isDraggingDetached() || this.paperTear.isPaperDetached()) {
      document.body.style.cursor = 'grabbing';
    }
  }
  
  private handleMouseUp(): void {
    this.paperTear.endDrag();
    this.renderer.domElement.style.cursor = this.paperTear.isLockedState() ? 'default' : 'grab';
    document.body.style.cursor = '';
  }
  
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    
    if (!this.paperTear.isInteractive()) return;
    
    const touch = event.touches[0];
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.paperTear.startDrag(touch.clientX, touch.clientY, rect);
  }
  
  private handleTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    
    // Only prevent default if paper is being dragged (to allow normal scrolling otherwise)
    if (this.paperTear.isPaperDetached() || this.paperTear.isDraggingDetached()) {
      event.preventDefault();
    }
    
    const touch = event.touches[0];
    this.paperTear.updateDrag(touch.clientX, touch.clientY);
  }
  
  private handleTouchEnd(): void {
    this.paperTear.endDrag();
  }
  
  private handleResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    const aspect = width / height;
    const frustumSize = 5;
    
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  private handleTearComplete(): void {
    console.log('Tear complete!');
    
    // Play paper tear sound effect (cycles through 7 sounds)
    this.soundManager.playTearSound();
    
    // Check if at last page (Jan 1, 2026)
    if (this.currentIndex >= this.dates.length - 1) {
      console.log('Already at final date: January 1, 2026!');
      this.paperTear.lock();
      this.renderer.domElement.style.cursor = 'default';
      return;
    }
    
    // Advance to next date
    this.currentIndex++;
    const currentDate = this.dates[this.currentIndex];
    
    // 🎆 Launch fireworks when January 1, 2026 is revealed!
    if (currentDate.isNewYear) {
      console.log('🎆 Happy New Year 2026! Launching fireworks!');
      // Small delay to let the paper animation complete
      setTimeout(() => {
        this.fireworks.launch();
      }, 300);
    }
    
    // Update paper to show the new current date (revealed underneath)
    // DON'T update background yet - wait for fall animation to complete
    // This prevents the "two layers deep" flicker
    this.paperTear.updateDate(currentDate);
    
    // Lock if final page
    if (this.currentIndex >= this.dates.length - 1) {
      this.paperTear.lock();
      this.renderer.domElement.style.cursor = 'default';
      console.log('Final page reached - interaction disabled');
    }
    
    // Callback
    if (this.onDateChange) {
      this.onDateChange(currentDate);
    }
    
    console.log('Date changed to:', currentDate.month, currentDate.day, currentDate.year);
  }
  
  private handleFallComplete(): void {
    // Now safe to update background for the NEXT date
    // This happens after the falling paper animation is done
    if (this.currentIndex + 1 < this.dates.length) {
      this.updateBackgroundPage(this.dates[this.currentIndex + 1]);
      console.log('Background updated to:', this.dates[this.currentIndex + 1].month, this.dates[this.currentIndex + 1].day);
    }
  }
  
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    
    // Update paper physics
    this.paperTear.update();
    
    // Update fireworks
    this.fireworks.update();
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  getCurrentDate(): CalendarDate {
    return this.dates[this.currentIndex];
  }
  
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.paperTear.dispose();
    this.fireworks.dispose();
    this.soundManager.dispose();
    
    const bgMaterial = this.backgroundPage.material as THREE.MeshBasicMaterial;
    bgMaterial.map?.dispose();
    bgMaterial.dispose();
    this.backgroundPage.geometry.dispose();
    
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
