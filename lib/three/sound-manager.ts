/**
 * SoundManager - Handles paper tear sound effects
 * Cycles through 7 tear sounds sequentially
 */

export class SoundManager {
  private sounds: HTMLAudioElement[] = [];
  private currentIndex = 0;
  private isLoaded = false;
  private loadPromise: Promise<void>;
  
  // Volume control (0.0 to 1.0)
  private volume = 0.5;
  
  constructor() {
    this.loadPromise = this.loadSounds();
  }
  
  private async loadSounds(): Promise<void> {
    const soundCount = 7;
    const loadPromises: Promise<void>[] = [];
    
    for (let i = 1; i <= soundCount; i++) {
      const audio = new Audio();
      audio.src = `/assets/sound-files/tear-sound-${i}.mp3`;
      audio.preload = 'auto';
      audio.volume = this.volume;
      
      const loadPromise = new Promise<void>((resolve) => {
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', (e) => {
          console.warn(`Failed to load tear-sound-${i}.mp3:`, e);
          resolve(); // Don't reject, just skip this sound
        });
      });
      
      loadPromises.push(loadPromise);
      this.sounds.push(audio);
    }
    
    await Promise.all(loadPromises);
    this.isLoaded = true;
    console.log(`SoundManager: ${this.sounds.length} tear sounds loaded`);
  }
  
  /**
   * Play the next tear sound in sequence
   * Cycles through sounds 1-7 sequentially
   */
  async playTearSound(): Promise<void> {
    // Wait for sounds to load if not ready
    if (!this.isLoaded) {
      await this.loadPromise;
    }
    
    if (this.sounds.length === 0) {
      console.warn('No sounds available to play');
      return;
    }
    
    const sound = this.sounds[this.currentIndex];
    
    // Reset to start if sound was partially played
    sound.currentTime = 0;
    
    try {
      await sound.play();
      console.log(`Playing tear-sound-${this.currentIndex + 1}.mp3`);
    } catch (error) {
      // Autoplay might be blocked by browser
      console.warn('Sound playback failed (may require user interaction):', error);
    }
    
    // Advance to next sound (cycle back to 0 after 7)
    this.currentIndex = (this.currentIndex + 1) % this.sounds.length;
  }
  
  /**
   * Set volume for all sounds
   * @param volume - Volume level from 0.0 to 1.0
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    for (const sound of this.sounds) {
      sound.volume = this.volume;
    }
  }
  
  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }
  
  /**
   * Reset to first sound in sequence
   */
  reset(): void {
    this.currentIndex = 0;
  }
  
  /**
   * Dispose of all audio resources
   */
  dispose(): void {
    for (const sound of this.sounds) {
      sound.pause();
      sound.src = '';
    }
    this.sounds = [];
    this.currentIndex = 0;
    this.isLoaded = false;
  }
}

