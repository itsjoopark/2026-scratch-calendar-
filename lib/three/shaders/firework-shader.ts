/**
 * Firework Particle Shaders
 * Apple iMessage-style fireworks with sharp elongated streaks and glitter
 */

export const fireworkVertexShader = `
  attribute float aSize;
  attribute vec3 aVelocity;
  attribute vec3 aColor;
  attribute float aLifetime;
  attribute float aBirthTime;
  attribute float aSparkle;
  attribute float aStreakLength;
  
  uniform float uTime;
  uniform float uGravity;
  uniform float uDrag;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkle;
  varying float vAge;
  varying vec2 vStreakDir;
  varying float vStreakLength;
  
  void main() {
    float age = uTime - aBirthTime;
    float normalizedAge = age / aLifetime;
    
    // Skip dead particles
    if (age < 0.0 || normalizedAge > 1.0) {
      gl_Position = vec4(9999.0, 9999.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    
    vec3 pos = position;
    vec3 vel = aVelocity;
    
    // Apply drag
    float dragFactor = exp(-uDrag * age);
    vel *= dragFactor;
    
    // Physics
    pos += vel * age;
    pos.y -= 0.5 * uGravity * age * age;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Calculate streak direction in screen space for fragment shader
    vec3 velNorm = normalize(vel);
    vec4 velScreen = projectionMatrix * modelViewMatrix * vec4(velNorm, 0.0);
    vStreakDir = normalize(velScreen.xy);
    
    // Size with initial burst and decay
    float sizePop = normalizedAge < 0.05 ? normalizedAge / 0.05 : 1.0;
    float sizeDecay = 1.0 - pow(normalizedAge, 0.7);
    float baseSize = aSize * sizePop * sizeDecay;
    
    // Streak length varies with speed
    vStreakLength = aStreakLength * (0.5 + dragFactor * 0.5);
    
    gl_PointSize = baseSize * (400.0 / -mvPosition.z);
    gl_PointSize = max(gl_PointSize, 2.0);
    
    // Alpha fade
    float alphaFade = 1.0 - pow(normalizedAge, 1.5);
    vAlpha = alphaFade;
    vAge = normalizedAge;
    
    vColor = aColor;
    vSparkle = aSparkle;
  }
`;

export const fireworkFragmentShader = `
  uniform float uTime;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkle;
  varying float vAge;
  varying vec2 vStreakDir;
  varying float vStreakLength;
  
  // Hash function for glitter
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    
    // Rotate to align with streak direction
    float angle = atan(vStreakDir.y, vStreakDir.x);
    float ca = cos(-angle);
    float sa = sin(-angle);
    vec2 rotated = vec2(
      center.x * ca - center.y * sa,
      center.x * sa + center.y * ca
    );
    
    // Elongated streak shape (stretched ellipse)
    float streakAspect = 2.5 + vStreakLength * 3.0;
    vec2 stretched = vec2(rotated.x * streakAspect, rotated.y);
    float dist = length(stretched);
    
    // Sharp falloff for streak
    float streak = 1.0 - smoothstep(0.0, 0.5, dist);
    streak = pow(streak, 1.5);
    
    // Add pointed tip
    float tip = 1.0 - smoothstep(-0.3, 0.2, rotated.x);
    streak *= mix(1.0, tip, 0.5);
    
    // Glitter/sparkle noise
    vec2 glitterCoord = gl_FragCoord.xy * 0.1 + uTime * 20.0;
    float glitter = hash(floor(glitterCoord));
    glitter = step(0.7, glitter) * step(0.5, vSparkle);
    
    // Sparkle twinkle
    float twinkle = sin(uTime * 40.0 + gl_FragCoord.x * 0.5 + gl_FragCoord.y * 0.3) * 0.5 + 0.5;
    glitter *= twinkle;
    
    // Core glow (brighter center)
    float core = exp(-dist * dist * 8.0);
    
    // Combine streak and core
    float strength = streak + core * 0.5 + glitter * 0.8;
    strength = clamp(strength, 0.0, 1.0);
    
    // Color with brightness boost
    vec3 color = vColor * (1.2 + core * 0.5 + glitter);
    
    float finalAlpha = strength * vAlpha;
    
    if (finalAlpha < 0.02) discard;
    
    gl_FragColor = vec4(color, finalAlpha);
  }
`;

// Streak/trail geometry shader - for line-based trails
export const streakVertexShader = `
  attribute vec3 aColor;
  attribute float aAlpha;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;
  
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vUv = uv;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const streakFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;
  
  void main() {
    // Fade along the streak length
    float fade = 1.0 - vUv.x;
    fade = pow(fade, 0.5);
    
    // Soft edges perpendicular to streak
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    edge = pow(edge, 2.0);
    
    float alpha = fade * edge * vAlpha;
    
    gl_FragColor = vec4(vColor * 1.3, alpha);
  }
`;
