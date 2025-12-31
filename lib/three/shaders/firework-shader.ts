/**
 * Firework Shaders - Shadertoy-style
 * Based on https://www.shadertoy.com/view/ssySz1
 * Full-screen fragment shader approach with sharp sparks
 */

export const fireworkVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fireworkFragmentShader = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform float uStartTime;
  
  varying vec2 vUv;
  
  #define NUM_EXPLOSIONS 12.0
  #define NUM_PARTICLES 100.0
  #define TOTAL_DURATION 17.76
  
  // Hash function for pseudo-random values
  vec2 Hash12(float t) {
    float x = fract(sin(t * 674.3) * 453.2);
    float y = fract(sin((t + x) * 714.3) * 263.2);
    return vec2(x, y);
  }
  
  // Polar hash for radial particle distribution
  vec2 Hash12_Polar(float t) {
    float angle = fract(sin(t * 674.3) * 453.2) * 6.2832;
    float dist = fract(sin((t + angle) * 714.3) * 263.2);
    return vec2(sin(angle), cos(angle)) * dist;
  }
  
  // Single explosion with many particles
  float Explosion(vec2 uv, float t, float seed) {
    float sparks = 0.0;
    
    for (float i = 0.0; i < NUM_PARTICLES; i++) {
      // Direction from center - radial burst
      vec2 dir = Hash12_Polar(i + 1.0 + seed * 100.0) * 0.5;
      
      // Add some variation to particle speed
      float speedMod = 0.8 + Hash12(i + seed * 50.0).x * 0.4;
      vec2 particlePos = dir * t * speedMod;
      
      // Apply gravity (particles fall over time)
      particlePos.y -= t * t * 0.15;
      
      // Distance from this particle
      float dist = length(uv - particlePos);
      
      // Brightness - inverse square falloff for sharp points
      float brightness = 0.0008;
      
      // Sparkle/twinkle effect
      brightness *= sin(t * 20.0 + i) * 0.5 + 0.5;
      
      // Fade out over time - extended for longer explosions
      brightness *= smoothstep(3.5, 1.5, t);
      
      // Add spark
      sparks += brightness / dist;
    }
    
    return sparks;
  }
  
  void main() {
    // Normalized coordinates centered at origin
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    
    float elapsed = uTime - uStartTime;
    
    // Fade in and out - matches sound duration (~17.76s)
    float globalFade = smoothstep(0.0, 0.3, elapsed) * smoothstep(TOTAL_DURATION, TOTAL_DURATION - 2.5, elapsed);
    
    vec3 col = vec3(0.0);
    
    for (float i = 0.0; i < NUM_EXPLOSIONS; i++) {
      // Stagger explosion timing - spread across full duration
      float explosionDelay = i * 1.2 + Hash12(i + 0.5).x * 0.5;
      float t = elapsed - explosionDelay;
      
      // Only render if explosion has started - longer lifetime
      if (t > 0.0 && t < 3.5) {
        // Unique seed for this explosion
        float seed = floor(elapsed / 4.0) + i;
        
        // Random color based on seed
        vec3 color = sin(4.0 * vec3(0.34, 0.54, 0.73) * (seed + i)) * 0.35 + 0.65;
        
        // Make colors more vibrant
        color = mix(color, vec3(1.0), 0.2);
        
        // Random position for this explosion
        vec2 offset = Hash12(i + 1.0 + seed) - 0.5;
        offset *= vec2(1.5, 0.9); // Wider spread horizontally
        offset.y += 0.1; // Slightly higher on average
        
        // Add explosion contribution
        col += Explosion(uv - offset, t, seed + i) * color;
      }
    }
    
    // Boost intensity
    col *= uIntensity * 2.0 * globalFade;
    
    // Subtle glow/bloom
    col += col * col * 0.3;
    
    // Tone mapping to prevent over-saturation
    col = col / (1.0 + col * 0.5);
    
    gl_FragColor = vec4(col, length(col) > 0.01 ? 1.0 : 0.0);
  }
`;

// Alternative version with more dramatic trails
export const fireworkFragmentShaderTrails = `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform float uStartTime;
  
  varying vec2 vUv;
  
  #define NUM_EXPLOSIONS 10.0
  #define NUM_PARTICLES 80.0
  #define TRAIL_LENGTH 8.0
  
  vec2 Hash12(float t) {
    float x = fract(sin(t * 674.3) * 453.2);
    float y = fract(sin((t + x) * 714.3) * 263.2);
    return vec2(x, y);
  }
  
  vec2 Hash12_Polar(float t) {
    float angle = fract(sin(t * 674.3) * 453.2) * 6.2832;
    float dist = fract(sin((t + angle) * 714.3) * 263.2);
    return vec2(sin(angle), cos(angle)) * dist;
  }
  
  float ExplosionWithTrails(vec2 uv, float t, float seed) {
    float sparks = 0.0;
    
    for (float i = 0.0; i < NUM_PARTICLES; i++) {
      vec2 dir = Hash12_Polar(i + 1.0 + seed * 100.0) * 0.5;
      float speedMod = 0.7 + Hash12(i + seed * 50.0).x * 0.5;
      
      // Main particle with trails
      for (float j = 0.0; j < TRAIL_LENGTH; j++) {
        float trailT = t - j * 0.015;
        if (trailT < 0.0) continue;
        
        vec2 particlePos = dir * trailT * speedMod;
        particlePos.y -= trailT * trailT * 0.18;
        
        float dist = length(uv - particlePos);
        
        // Brightness decreases along trail
        float trailFade = 1.0 - j / TRAIL_LENGTH;
        float brightness = 0.0006 * trailFade * trailFade;
        
        brightness *= sin(t * 25.0 + i) * 0.4 + 0.6;
        brightness *= smoothstep(1.2, 0.4, t);
        
        sparks += brightness / dist;
      }
    }
    
    return sparks;
  }
  
  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    
    float elapsed = uTime - uStartTime;
    float globalFade = smoothstep(0.0, 0.5, elapsed) * smoothstep(10.0, 7.5, elapsed);
    
    vec3 col = vec3(0.0);
    
    for (float i = 0.0; i < NUM_EXPLOSIONS; i++) {
      float explosionDelay = i * 0.35 + Hash12(i + 0.7).x * 0.4;
      float t = elapsed - explosionDelay;
      
      if (t > 0.0 && t < 2.8) {
        float seed = floor(elapsed / 3.5) + i;
        
        // Vibrant colors
        vec3 color = sin(5.0 * vec3(0.24, 0.64, 0.43) * (seed + i * 0.7)) * 0.4 + 0.6;
        color = pow(color, vec3(0.8)); // Boost saturation
        
        vec2 offset = Hash12(i + 1.0 + seed) - 0.5;
        offset *= vec2(1.6, 1.0);
        
        col += ExplosionWithTrails(uv - offset, t, seed + i) * color;
      }
    }
    
    col *= uIntensity * 2.5 * globalFade;
    col += col * col * 0.4;
    col = col / (1.0 + col * 0.4);
    
    gl_FragColor = vec4(col, length(col) > 0.01 ? 1.0 : 0.0);
  }
`;
