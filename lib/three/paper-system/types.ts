// Core types for paper tearing system
// Based on "Interactive Paper Tearing" (Schreck et al., Eurographics 2017)

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Vertex in the paper mesh
export interface PaperVertex {
  id: number;
  position: Vec3;      // 3D world position
  uv: Vec2;            // 2D pattern space (rest configuration)
  velocity: Vec3;
  mass: number;
  pinned: boolean;     // Fixed vertices (e.g., at binding)
  isBoundary: boolean; // On the edge of paper or tear
  isTearTip: boolean;  // Active tear propagation point
}

// Triangle in the mesh
export interface PaperTriangle {
  id: number;
  vertices: [number, number, number]; // Vertex IDs
  restArea: number;    // Area in UV space
  neighbors: number[]; // Adjacent triangle IDs
}

// Edge in the mesh (for tear tracking)
export interface PaperEdge {
  id: number;
  vertices: [number, number];
  triangles: [number, number] | [number]; // 1 = boundary, 2 = internal
  isBoundary: boolean;
  isTorn: boolean;
  tearProgress: number; // 0-1 for partial tears
}

// Force acting on the paper
export interface Force {
  vertex: number;      // Vertex ID
  direction: Vec2;     // Force direction in UV space
  magnitude: number;
}

// Tear tip - active point where tear is propagating
export interface TearTip {
  vertexId: number;
  uvPosition: Vec2;
  tearDirection: Vec2; // Current propagation direction
  energy: number;      // Accumulated strain energy
}

// Clustered forces for tear direction computation
export interface ForceCluster {
  direction: Vec2;     // Average direction
  magnitude: number;   // Total magnitude
  forces: Force[];     // Contributing forces
}

// Tear event for mask generation
export interface TearEvent {
  startUV: Vec2;
  endUV: Vec2;
  width: number;
  timestamp: number;
}

// Configuration
export interface PaperConfig {
  // Mesh
  width: number;
  height: number;
  subdivisions: number;     // Coarse mesh (8-16 typical)
  
  // Physical properties
  stiffness: number;        // In-plane stiffness (near-inextensible)
  bendingStiffness: number; // Out-of-plane bending
  damping: number;
  density: number;          // Mass per area
  
  // Fracture properties
  fractureThreshold: number;   // Energy needed to initiate tear
  tearResistance: number;      // Resistance to tear propagation
  fiberDirection: Vec2;        // Preferred tear direction (paper grain)
  fiberAnisotropy: number;     // 0 = isotropic, 1 = fully anisotropic
  
  // Interaction
  grabRadius: number;
  grabStiffness: number;
}

// Vector math utilities
export const vec2 = {
  create: (x = 0, y = 0): Vec2 => ({ x, y }),
  
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  
  scale: (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s }),
  
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y,
  
  length: (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  
  normalize: (v: Vec2): Vec2 => {
    const len = vec2.length(v);
    return len > 0.0001 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
  },
  
  rotate: (v: Vec2, angle: number): Vec2 => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
  },
  
  angle: (v: Vec2): number => Math.atan2(v.y, v.x),
  
  angleBetween: (a: Vec2, b: Vec2): number => {
    const dot = vec2.dot(vec2.normalize(a), vec2.normalize(b));
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  },
  
  bisector: (a: Vec2, b: Vec2): Vec2 => {
    const na = vec2.normalize(a);
    const nb = vec2.normalize(b);
    return vec2.normalize(vec2.add(na, nb));
  },
  
  perpendicular: (v: Vec2): Vec2 => ({ x: -v.y, y: v.x }),
};

export const vec3 = {
  create: (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z }),
  
  add: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  
  sub: (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  
  scale: (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
  
  dot: (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  
  cross: (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  
  length: (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  
  normalize: (v: Vec3): Vec3 => {
    const len = vec3.length(v);
    return len > 0.0001 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 0 };
  },
};

