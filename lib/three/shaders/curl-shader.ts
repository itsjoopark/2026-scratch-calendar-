// Realistic Paper Tear Shader
// Features: grab deformation, wrinkles, dynamic curl, rough edges

export const curlVertexShader = `
  uniform float uCurlAmount;
  uniform float uCurlRadius;
  uniform float uTime;
  uniform vec2 uDragDirection;
  uniform vec2 uDragOffset;
  uniform vec2 uGrabPoint;        // Where the paper is grabbed (UV coords)
  uniform float uGrabStrength;    // How hard it's being pulled
  uniform float uWrinkleIntensity;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vCurlFactor;
  
  const float PI = 3.14159265359;
  
  void main() {
    vUv = uv;
    
    vec2 centered = uv - 0.5;
    vec3 pos = position;
    
    // Pull toward cursor (in drag direction)
    vec2 dragDir = length(uDragDirection) > 0.01 ? normalize(uDragDirection) : vec2(0.0, 1.0);
    
    // --- CURL DEFORMATION ---
    float distAlongDrag = dot(centered, dragDir) + 0.5;
    float curlStart = 1.0 - uCurlAmount;
    float curlProgress = smoothstep(curlStart - 0.15, curlStart + 0.25, distAlongDrag);
    
    float maxAngle = uCurlAmount * PI * 2.0;
    float angle = curlProgress * maxAngle;
    float radius = mix(uCurlRadius, uCurlRadius * 0.2, uCurlAmount);
    
    if (uCurlAmount > 0.01 && curlProgress > 0.0) {
      float curlDisplaceAlongDrag = radius * (1.0 - cos(angle));
      float curlHeight = radius * sin(angle);
      
      // Tighter curl near the torn edge
      float edgeTightening = smoothstep(0.0, 0.3, curlProgress);
      
      pos.x += dragDir.x * curlDisplaceAlongDrag * curlProgress;
      pos.y += dragDir.y * curlDisplaceAlongDrag * curlProgress;
      pos.z += curlHeight * curlProgress * (1.0 + edgeTightening * 0.5);
      
      // Add perpendicular wave for natural paper curl
      vec2 perpDir = vec2(-dragDir.y, dragDir.x);
      float perpDist = dot(centered, perpDir);
      float wave = sin(perpDist * PI * 6.0 + angle * 2.0) * 0.012 * uCurlAmount * curlProgress;
      pos.z += wave;
    }
    
    // --- CALCULATE NORMAL ---
    vec3 transformedNormal = normal;
    if (curlProgress > 0.01 && uCurlAmount > 0.01) {
      float normalAngle = angle * 0.7;
      transformedNormal.z = cos(normalAngle);
      transformedNormal.x = sin(normalAngle) * dragDir.x;
      transformedNormal.y = sin(normalAngle) * dragDir.y;
    }
    vNormal = normalize(normalMatrix * transformedNormal);
    vCurlFactor = curlProgress;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const curlFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uCurlAmount;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vCurlFactor;
  
  void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    vec3 color = texColor.rgb;
    
    // Lighting for depth (only when curling)
    if (uCurlAmount > 0.01) {
      vec3 lightDir = normalize(vec3(0.2, 0.3, 1.0));
      float diffuse = max(dot(vNormal, lightDir), 0.0);
      
      float shadow = 1.0 - vCurlFactor * 0.08 * uCurlAmount;
      
      color = color * (0.95 + diffuse * 0.05) * shadow;
    }
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Falling paper with physics-based animation
export const fallingVertexShader = `
  uniform float uTime;
  uniform float uFallProgress;
  uniform vec3 uVelocity;
  uniform vec3 uAngularVelocity;
  uniform float uGravity;
  uniform float uAirResistance;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  
  const float PI = 3.14159265359;
  
  // Simple noise for flutter
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    
    float t = uFallProgress;
    
    // Apply rotation (tumbling)
    vec3 rot = uAngularVelocity * t;
    
    // Rotate around X
    float cx = cos(rot.x), sx = sin(rot.x);
    float y1 = pos.y * cx - pos.z * sx;
    float z1 = pos.y * sx + pos.z * cx;
    pos.y = y1; pos.z = z1;
    
    // Rotate around Y
    float cy = cos(rot.y), sy = sin(rot.y);
    float x2 = pos.x * cy + pos.z * sy;
    float z2 = -pos.x * sy + pos.z * cy;
    pos.x = x2; pos.z = z2;
    
    // Rotate around Z
    float cz = cos(rot.z), sz = sin(rot.z);
    float x3 = pos.x * cz - pos.y * sz;
    float y3 = pos.x * sz + pos.y * cz;
    pos.x = x3; pos.y = y3;
    
    // Apply velocity with air resistance decay
    float airDecay = exp(-uAirResistance * t);
    pos += uVelocity * t * airDecay;
    
    // Apply gravity (accelerating downward)
    pos.y -= 0.5 * uGravity * t * t;
    pos.z -= 0.3 * uGravity * t * t;
    
    // Flutter effect - paper wobbles as it falls
    float flutter = sin(t * 8.0 + noise(uv) * 6.28) * 0.02 * (1.0 - airDecay);
    pos.x += flutter;
    pos.z += flutter * 0.5;
    
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const fallingFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  
  void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    vec3 color = texColor.rgb;
    
    vec3 lightDir = normalize(vec3(0.3, 0.5, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    color = color * (0.9 + diffuse * 0.1);
    
    gl_FragColor = vec4(color, uOpacity);
  }
`;
