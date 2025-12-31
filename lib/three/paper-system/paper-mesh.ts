/**
 * PaperMesh - Coarse triangular mesh for paper simulation
 * 
 * Maintains topology and handles mesh updates during tearing.
 * Uses a half-edge-like structure for efficient neighbor queries.
 */

import {
  PaperVertex,
  PaperTriangle,
  PaperEdge,
  PaperConfig,
  Vec2,
  Vec3,
  vec2,
  vec3,
} from './types';

export class PaperMesh {
  vertices: Map<number, PaperVertex> = new Map();
  triangles: Map<number, PaperTriangle> = new Map();
  edges: Map<string, PaperEdge> = new Map();
  
  private nextVertexId = 0;
  private nextTriangleId = 0;
  private nextEdgeId = 0;
  
  private config: PaperConfig;
  
  constructor(config: PaperConfig) {
    this.config = config;
    this.buildInitialMesh();
  }
  
  /**
   * Build initial coarse triangular mesh
   * Uses a simple grid with diagonal splits
   */
  private buildInitialMesh(): void {
    const { width, height, subdivisions } = this.config;
    const cols = subdivisions;
    const rows = Math.ceil(subdivisions * (height / width));
    
    const cellWidth = width / cols;
    const cellHeight = height / rows;
    
    // Create vertices
    const vertexGrid: number[][] = [];
    
    for (let j = 0; j <= rows; j++) {
      vertexGrid[j] = [];
      for (let i = 0; i <= cols; i++) {
        const id = this.nextVertexId++;
        
        // UV coordinates (0-1 range)
        const u = i / cols;
        const v = j / rows;
        
        // 3D position (centered at origin)
        const x = (u - 0.5) * width;
        const y = (v - 0.5) * height;
        const z = 0;
        
        const vertex: PaperVertex = {
          id,
          position: { x, y, z },
          uv: { x: u, y: v },
          velocity: { x: 0, y: 0, z: 0 },
          mass: this.config.density * cellWidth * cellHeight / 4,
          pinned: v > 0.95, // Pin top edge (near binding)
          isBoundary: i === 0 || i === cols || j === 0 || j === rows,
          isTearTip: false,
        };
        
        this.vertices.set(id, vertex);
        vertexGrid[j][i] = id;
      }
    }
    
    // Create triangles (2 per grid cell)
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v00 = vertexGrid[j][i];
        const v10 = vertexGrid[j][i + 1];
        const v01 = vertexGrid[j + 1][i];
        const v11 = vertexGrid[j + 1][i + 1];
        
        // Lower-left triangle
        this.addTriangle(v00, v10, v01);
        
        // Upper-right triangle
        this.addTriangle(v10, v11, v01);
      }
    }
    
    // Build edge connectivity
    this.rebuildEdges();
  }
  
  /**
   * Add a triangle and compute its rest area
   */
  private addTriangle(v0: number, v1: number, v2: number): number {
    const id = this.nextTriangleId++;
    
    const p0 = this.vertices.get(v0)!.uv;
    const p1 = this.vertices.get(v1)!.uv;
    const p2 = this.vertices.get(v2)!.uv;
    
    // Compute rest area in UV space (signed area)
    const restArea = 0.5 * Math.abs(
      (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y)
    );
    
    const triangle: PaperTriangle = {
      id,
      vertices: [v0, v1, v2],
      restArea,
      neighbors: [],
    };
    
    this.triangles.set(id, triangle);
    return id;
  }
  
  /**
   * Rebuild edge map and neighbor connectivity
   */
  rebuildEdges(): void {
    this.edges.clear();
    
    // Reset triangle neighbors
    for (const tri of this.triangles.values()) {
      tri.neighbors = [];
    }
    
    // Build edges from triangles
    for (const tri of this.triangles.values()) {
      const [v0, v1, v2] = tri.vertices;
      
      this.addEdge(v0, v1, tri.id);
      this.addEdge(v1, v2, tri.id);
      this.addEdge(v2, v0, tri.id);
    }
    
    // Update boundary flags
    for (const edge of this.edges.values()) {
      edge.isBoundary = edge.triangles.length === 1;
      
      // Mark boundary vertices
      if (edge.isBoundary) {
        const v0 = this.vertices.get(edge.vertices[0])!;
        const v1 = this.vertices.get(edge.vertices[1])!;
        v0.isBoundary = true;
        v1.isBoundary = true;
      }
    }
    
    // Build triangle neighbor lists
    for (const edge of this.edges.values()) {
      if (edge.triangles.length === 2) {
        const [t0, t1] = edge.triangles;
        const tri0 = this.triangles.get(t0)!;
        const tri1 = this.triangles.get(t1)!;
        
        if (!tri0.neighbors.includes(t1)) tri0.neighbors.push(t1);
        if (!tri1.neighbors.includes(t0)) tri1.neighbors.push(t0);
      }
    }
  }
  
  /**
   * Add or update an edge
   */
  private addEdge(v0: number, v1: number, triangleId: number): void {
    const key = this.edgeKey(v0, v1);
    
    if (this.edges.has(key)) {
      const edge = this.edges.get(key)!;
      if (!edge.triangles.includes(triangleId)) {
        (edge.triangles as number[]).push(triangleId);
      }
    } else {
      const edge: PaperEdge = {
        id: this.nextEdgeId++,
        vertices: [Math.min(v0, v1), Math.max(v0, v1)],
        triangles: [triangleId],
        isBoundary: true,
        isTorn: false,
        tearProgress: 0,
      };
      this.edges.set(key, edge);
    }
  }
  
  /**
   * Canonical edge key
   */
  private edgeKey(v0: number, v1: number): string {
    return `${Math.min(v0, v1)}_${Math.max(v0, v1)}`;
  }
  
  /**
   * Get edge between two vertices
   */
  getEdge(v0: number, v1: number): PaperEdge | undefined {
    return this.edges.get(this.edgeKey(v0, v1));
  }
  
  /**
   * Get all edges connected to a vertex
   */
  getVertexEdges(vertexId: number): PaperEdge[] {
    const result: PaperEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.vertices.includes(vertexId)) {
        result.push(edge);
      }
    }
    return result;
  }
  
  /**
   * Get triangles containing a vertex
   */
  getVertexTriangles(vertexId: number): PaperTriangle[] {
    const result: PaperTriangle[] = [];
    for (const tri of this.triangles.values()) {
      if (tri.vertices.includes(vertexId)) {
        result.push(tri);
      }
    }
    return result;
  }
  
  /**
   * Split a vertex - used when tear changes direction
   * Creates a new vertex at same position, reassigns triangles
   */
  splitVertex(vertexId: number, trianglesToMove: number[]): number {
    const original = this.vertices.get(vertexId)!;
    
    // Create new vertex
    const newId = this.nextVertexId++;
    const newVertex: PaperVertex = {
      ...original,
      id: newId,
      position: { ...original.position },
      uv: { ...original.uv },
      velocity: { ...original.velocity },
    };
    this.vertices.set(newId, newVertex);
    
    // Move specified triangles to new vertex
    for (const triId of trianglesToMove) {
      const tri = this.triangles.get(triId)!;
      const idx = tri.vertices.indexOf(vertexId);
      if (idx !== -1) {
        tri.vertices[idx] = newId;
      }
    }
    
    // Rebuild connectivity
    this.rebuildEdges();
    
    return newId;
  }
  
  /**
   * Tear along an edge - marks edge as torn and updates boundaries
   */
  tearEdge(v0: number, v1: number): void {
    const edge = this.getEdge(v0, v1);
    if (!edge || edge.isTorn) return;
    
    edge.isTorn = true;
    edge.isBoundary = true;
    
    // If internal edge, we need to split it
    if (edge.triangles.length === 2) {
      // Split vertices at edge endpoints
      const [t0, t1] = edge.triangles;
      
      // New vertex for each endpoint on the "right" side of tear
      const newV0 = this.splitVertex(v0, [t1]);
      const newV1 = this.splitVertex(v1, [t1]);
      
      // Mark new boundary vertices
      this.vertices.get(v0)!.isBoundary = true;
      this.vertices.get(v1)!.isBoundary = true;
      this.vertices.get(newV0)!.isBoundary = true;
      this.vertices.get(newV1)!.isBoundary = true;
    }
    
    this.rebuildEdges();
  }
  
  /**
   * Insert a vertex on an edge - for tear propagation
   */
  insertVertexOnEdge(v0: number, v1: number, t: number): number {
    const vert0 = this.vertices.get(v0)!;
    const vert1 = this.vertices.get(v1)!;
    
    // Interpolate position and UV
    const newId = this.nextVertexId++;
    const newVertex: PaperVertex = {
      id: newId,
      position: {
        x: vert0.position.x + t * (vert1.position.x - vert0.position.x),
        y: vert0.position.y + t * (vert1.position.y - vert0.position.y),
        z: vert0.position.z + t * (vert1.position.z - vert0.position.z),
      },
      uv: {
        x: vert0.uv.x + t * (vert1.uv.x - vert0.uv.x),
        y: vert0.uv.y + t * (vert1.uv.y - vert0.uv.y),
      },
      velocity: { x: 0, y: 0, z: 0 },
      mass: (vert0.mass + vert1.mass) / 2,
      pinned: false,
      isBoundary: true,
      isTearTip: true,
    };
    this.vertices.set(newId, newVertex);
    
    // Update triangles that share this edge
    const edge = this.getEdge(v0, v1);
    if (edge) {
      for (const triId of edge.triangles) {
        const tri = this.triangles.get(triId)!;
        
        // Find which edge in triangle this is
        const idx0 = tri.vertices.indexOf(v0);
        const idx1 = tri.vertices.indexOf(v1);
        
        if (idx0 !== -1 && idx1 !== -1) {
          // Split this triangle into two
          const otherIdx = 3 - idx0 - idx1;
          const otherV = tri.vertices[otherIdx];
          
          // Modify existing triangle
          tri.vertices[idx1] = newId;
          
          // Add new triangle
          this.addTriangle(newId, v1, otherV);
        }
      }
    }
    
    this.rebuildEdges();
    return newId;
  }
  
  /**
   * Get all boundary vertices (ordered along boundary)
   */
  getBoundaryLoop(): number[] {
    const boundary: number[] = [];
    const visited = new Set<number>();
    
    // Find a boundary vertex to start
    let startVertex: number | null = null;
    for (const vertex of this.vertices.values()) {
      if (vertex.isBoundary && !vertex.pinned) {
        startVertex = vertex.id;
        break;
      }
    }
    
    if (startVertex === null) return boundary;
    
    // Walk the boundary
    let current = startVertex;
    while (!visited.has(current)) {
      visited.add(current);
      boundary.push(current);
      
      // Find next boundary vertex
      const edges = this.getVertexEdges(current);
      let found = false;
      for (const edge of edges) {
        if (edge.isBoundary) {
          const next = edge.vertices[0] === current ? edge.vertices[1] : edge.vertices[0];
          if (!visited.has(next)) {
            current = next;
            found = true;
            break;
          }
        }
      }
      if (!found) break;
    }
    
    return boundary;
  }
  
  /**
   * Get flat arrays for Three.js BufferGeometry
   */
  getBufferData(): {
    positions: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    boundaryMask: Float32Array;
  } {
    // Create vertex array (may have gaps due to deletions)
    const vertexArray = Array.from(this.vertices.values());
    const vertexIdToIndex = new Map<number, number>();
    vertexArray.forEach((v, i) => vertexIdToIndex.set(v.id, i));
    
    const positions = new Float32Array(vertexArray.length * 3);
    const uvs = new Float32Array(vertexArray.length * 2);
    const boundaryMask = new Float32Array(vertexArray.length);
    
    for (let i = 0; i < vertexArray.length; i++) {
      const v = vertexArray[i];
      positions[i * 3] = v.position.x;
      positions[i * 3 + 1] = v.position.y;
      positions[i * 3 + 2] = v.position.z;
      uvs[i * 2] = v.uv.x;
      uvs[i * 2 + 1] = v.uv.y;
      boundaryMask[i] = v.isBoundary ? 1.0 : 0.0;
    }
    
    // Build index buffer
    const indexList: number[] = [];
    for (const tri of this.triangles.values()) {
      indexList.push(
        vertexIdToIndex.get(tri.vertices[0])!,
        vertexIdToIndex.get(tri.vertices[1])!,
        vertexIdToIndex.get(tri.vertices[2])!
      );
    }
    
    return {
      positions,
      uvs,
      indices: new Uint32Array(indexList),
      boundaryMask,
    };
  }
}

