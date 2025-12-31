/**
 * TearSimulation - Force-based tear propagation
 * 
 * Implements the core algorithm from "Interactive Paper Tearing":
 * 1. Gather in-plane forces at tear tips
 * 2. Cluster forces into opposing groups
 * 3. Compute tear direction as bisector in UV space
 * 4. Propagate if energy exceeds threshold
 */

import { PaperMesh } from './paper-mesh';
import {
  PaperConfig,
  PaperVertex,
  TearTip,
  Force,
  ForceCluster,
  Vec2,
  Vec3,
  vec2,
  vec3,
} from './types';

export class TearSimulation {
  private mesh: PaperMesh;
  private config: PaperConfig;
  
  // Active tear tips
  tearTips: TearTip[] = [];
  
  // Grab interaction state
  private grabVertex: number | null = null;
  private grabForce: Vec3 = { x: 0, y: 0, z: 0 };
  
  // Force accumulator per vertex
  private vertexForces: Map<number, Vec3> = new Map();
  
  constructor(mesh: PaperMesh, config: PaperConfig) {
    this.mesh = mesh;
    this.config = config;
  }
  
  /**
   * Main simulation step
   */
  step(dt: number): void {
    // Clear forces
    this.vertexForces.clear();
    
    // Compute internal forces (stretch + shear resistance)
    this.computeInternalForces();
    
    // Apply external forces (gravity, grab)
    this.applyExternalForces();
    
    // Process tear tips
    for (const tip of this.tearTips) {
      this.processTearTip(tip, dt);
    }
    
    // Integrate motion (semi-implicit Euler)
    this.integrate(dt);
  }
  
  /**
   * Compute in-plane forces from strain
   * Paper is near-inextensible, so high stiffness
   */
  private computeInternalForces(): void {
    for (const tri of this.mesh.triangles.values()) {
      const [v0, v1, v2] = tri.vertices.map(id => this.mesh.vertices.get(id)!);
      
      // Current edge vectors in 3D
      const e1_3d = vec3.sub(v1.position, v0.position);
      const e2_3d = vec3.sub(v2.position, v0.position);
      
      // Rest edge vectors in UV (2D)
      const e1_uv = vec2.sub(v1.uv, v0.uv);
      const e2_uv = vec2.sub(v2.uv, v0.uv);
      
      // Compute deformation gradient F (simplified 2x2)
      // This measures how much the triangle has stretched/sheared
      const detRest = e1_uv.x * e2_uv.y - e1_uv.y * e2_uv.x;
      if (Math.abs(detRest) < 0.0001) continue;
      
      const invDetRest = 1 / detRest;
      
      // Compute strain (deviation from rest)
      const len1 = vec3.length(e1_3d);
      const len2 = vec3.length(e2_3d);
      const restLen1 = vec2.length(e1_uv) * this.config.width;
      const restLen2 = vec2.length(e2_uv) * this.config.height;
      
      // Stretch strain
      const strain1 = (len1 - restLen1) / restLen1;
      const strain2 = (len2 - restLen2) / restLen2;
      
      // Force magnitude (Hooke's law, very stiff for paper)
      const forceMag1 = strain1 * this.config.stiffness * tri.restArea;
      const forceMag2 = strain2 * this.config.stiffness * tri.restArea;
      
      // Force directions (along edges)
      const dir1 = vec3.normalize(e1_3d);
      const dir2 = vec3.normalize(e2_3d);
      
      // Apply forces to vertices
      const f1 = vec3.scale(dir1, -forceMag1);
      const f2 = vec3.scale(dir2, -forceMag2);
      
      this.addForce(v0.id, vec3.add(f1, f2));
      this.addForce(v1.id, vec3.scale(f1, -1));
      this.addForce(v2.id, vec3.scale(f2, -1));
    }
  }
  
  /**
   * Apply external forces (gravity, damping, grab)
   */
  private applyExternalForces(): void {
    const gravity = { x: 0, y: -0.5, z: 0 }; // Mild gravity
    
    for (const vertex of this.mesh.vertices.values()) {
      if (vertex.pinned) continue;
      
      // Gravity
      this.addForce(vertex.id, vec3.scale(gravity, vertex.mass));
      
      // Damping (velocity-proportional drag)
      const damping = vec3.scale(vertex.velocity, -this.config.damping);
      this.addForce(vertex.id, damping);
    }
    
    // Grab force
    if (this.grabVertex !== null) {
      this.addForce(this.grabVertex, this.grabForce);
    }
  }
  
  /**
   * Add force to a vertex
   */
  private addForce(vertexId: number, force: Vec3): void {
    const existing = this.vertexForces.get(vertexId) || { x: 0, y: 0, z: 0 };
    this.vertexForces.set(vertexId, vec3.add(existing, force));
  }
  
  /**
   * Get force on a vertex
   */
  private getForce(vertexId: number): Vec3 {
    return this.vertexForces.get(vertexId) || { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Process a tear tip - core algorithm from paper
   */
  private processTearTip(tip: TearTip, dt: number): void {
    const vertex = this.mesh.vertices.get(tip.vertexId);
    if (!vertex || !vertex.isBoundary) return;
    
    // Step 1: Gather forces from adjacent triangles
    const triangles = this.mesh.getVertexTriangles(tip.vertexId);
    const forces: Force[] = [];
    
    for (const tri of triangles) {
      // Get other vertices of triangle
      const others = tri.vertices.filter(id => id !== tip.vertexId);
      
      for (const otherId of others) {
        const otherVertex = this.mesh.vertices.get(otherId)!;
        const otherForce = this.getForce(otherId);
        
        // Project force into UV space
        const uvDir = vec2.sub(otherVertex.uv, vertex.uv);
        const uvDist = vec2.length(uvDir);
        
        if (uvDist < 0.001) continue;
        
        // Force component in UV direction
        const force3d = vec3.length(otherForce);
        const uvForce: Force = {
          vertex: otherId,
          direction: vec2.normalize(uvDir),
          magnitude: force3d * uvDist,
        };
        
        forces.push(uvForce);
      }
    }
    
    // Step 2: Cluster forces into two opposing groups
    const clusters = this.clusterForces(forces);
    
    if (clusters.length < 2) return; // Need opposing forces
    
    // Step 3: Compute tear direction as bisector
    const tearDir = this.computeTearDirection(clusters[0], clusters[1], tip);
    
    // Step 4: Compute energy release
    const energy = this.computeEnergyRelease(clusters[0], clusters[1]);
    tip.energy += energy * dt;
    
    // Step 5: Propagate if threshold exceeded
    if (tip.energy > this.config.fractureThreshold) {
      this.propagateTear(tip, tearDir);
      tip.energy = 0; // Reset after propagation
    }
    
    tip.tearDirection = tearDir;
  }
  
  /**
   * Cluster forces into approximately opposing groups
   * Uses angular partitioning in UV space
   */
  private clusterForces(forces: Force[]): ForceCluster[] {
    if (forces.length < 2) return [];
    
    // Find the two most opposing force directions
    let maxOpposition = -1;
    let bestI = 0, bestJ = 1;
    
    for (let i = 0; i < forces.length; i++) {
      for (let j = i + 1; j < forces.length; j++) {
        const dot = vec2.dot(forces[i].direction, forces[j].direction);
        const opposition = -dot; // More negative = more opposing
        if (opposition > maxOpposition) {
          maxOpposition = opposition;
          bestI = i;
          bestJ = j;
        }
      }
    }
    
    // Use these as cluster seeds
    const seedA = forces[bestI].direction;
    const seedB = forces[bestJ].direction;
    
    // Partition all forces into two clusters
    const clusterA: Force[] = [];
    const clusterB: Force[] = [];
    
    for (const force of forces) {
      const dotA = vec2.dot(force.direction, seedA);
      const dotB = vec2.dot(force.direction, seedB);
      
      if (dotA > dotB) {
        clusterA.push(force);
      } else {
        clusterB.push(force);
      }
    }
    
    // Compute cluster centroids
    const computeCluster = (forces: Force[]): ForceCluster => {
      let sumDir = { x: 0, y: 0 };
      let totalMag = 0;
      
      for (const f of forces) {
        sumDir = vec2.add(sumDir, vec2.scale(f.direction, f.magnitude));
        totalMag += f.magnitude;
      }
      
      return {
        direction: vec2.normalize(sumDir),
        magnitude: totalMag,
        forces,
      };
    };
    
    return [computeCluster(clusterA), computeCluster(clusterB)];
  }
  
  /**
   * Compute tear direction as bisector of opposing forces
   * Adjusted for paper fiber direction (anisotropy)
   */
  private computeTearDirection(
    clusterA: ForceCluster,
    clusterB: ForceCluster,
    tip: TearTip
  ): Vec2 {
    // Bisector of the two force directions
    let bisector = vec2.bisector(clusterA.direction, clusterB.direction);
    
    // The tear goes perpendicular to the bisector (between the forces)
    let tearDir = vec2.perpendicular(bisector);
    
    // Ensure tear continues in consistent direction
    if (vec2.dot(tearDir, tip.tearDirection) < 0) {
      tearDir = vec2.scale(tearDir, -1);
    }
    
    // Apply fiber anisotropy
    if (this.config.fiberAnisotropy > 0) {
      const fiber = this.config.fiberDirection;
      const fiberDot = Math.abs(vec2.dot(tearDir, fiber));
      
      // Bias toward fiber direction
      const fiberBias = vec2.scale(fiber, fiberDot * this.config.fiberAnisotropy);
      tearDir = vec2.normalize(vec2.add(
        vec2.scale(tearDir, 1 - this.config.fiberAnisotropy),
        fiberBias
      ));
    }
    
    return tearDir;
  }
  
  /**
   * Compute energy release rate from opposing forces
   */
  private computeEnergyRelease(clusterA: ForceCluster, clusterB: ForceCluster): number {
    // Energy is proportional to force magnitudes and how opposing they are
    const opposition = -vec2.dot(clusterA.direction, clusterB.direction);
    const combinedMagnitude = (clusterA.magnitude + clusterB.magnitude) / 2;
    
    return opposition * combinedMagnitude;
  }
  
  /**
   * Propagate tear in computed direction
   */
  private propagateTear(tip: TearTip, direction: Vec2): void {
    const vertex = this.mesh.vertices.get(tip.vertexId)!;
    
    // Find the edge that best aligns with tear direction
    const edges = this.mesh.getVertexEdges(tip.vertexId);
    
    let bestEdge: { v0: number; v1: number } | null = null;
    let bestAlignment = -Infinity;
    
    for (const edge of edges) {
      if (edge.isTorn) continue;
      
      const otherId = edge.vertices[0] === tip.vertexId ? edge.vertices[1] : edge.vertices[0];
      const other = this.mesh.vertices.get(otherId)!;
      
      // Edge direction in UV
      const edgeDir = vec2.normalize(vec2.sub(other.uv, vertex.uv));
      const alignment = vec2.dot(edgeDir, direction);
      
      if (alignment > bestAlignment) {
        bestAlignment = alignment;
        bestEdge = { v0: tip.vertexId, v1: otherId };
      }
    }
    
    if (bestEdge && bestAlignment > 0.3) {
      // Tear this edge
      this.mesh.tearEdge(bestEdge.v0, bestEdge.v1);
      
      // Move tear tip to the other vertex
      tip.vertexId = bestEdge.v1;
      tip.uvPosition = this.mesh.vertices.get(bestEdge.v1)!.uv;
      
      // Mark new tip
      this.mesh.vertices.get(tip.vertexId)!.isTearTip = true;
      this.mesh.vertices.get(tip.vertexId)!.isBoundary = true;
    }
  }
  
  /**
   * Integrate vertex positions
   */
  private integrate(dt: number): void {
    for (const vertex of this.mesh.vertices.values()) {
      if (vertex.pinned) continue;
      
      const force = this.getForce(vertex.id);
      
      // Acceleration
      const acc = vec3.scale(force, 1 / vertex.mass);
      
      // Update velocity (semi-implicit Euler)
      vertex.velocity = vec3.add(vertex.velocity, vec3.scale(acc, dt));
      
      // Update position
      vertex.position = vec3.add(vertex.position, vec3.scale(vertex.velocity, dt));
      
      // Clamp Z to prevent paper going too far
      vertex.position.z = Math.max(-0.5, Math.min(0.5, vertex.position.z));
    }
  }
  
  /**
   * Start grabbing at a position
   */
  startGrab(uvPosition: Vec2): void {
    // Find nearest vertex
    let nearest: number | null = null;
    let nearestDist = Infinity;
    
    for (const vertex of this.mesh.vertices.values()) {
      if (vertex.pinned) continue;
      
      const dist = vec2.length(vec2.sub(vertex.uv, uvPosition));
      if (dist < nearestDist && dist < this.config.grabRadius) {
        nearestDist = dist;
        nearest = vertex.id;
      }
    }
    
    this.grabVertex = nearest;
  }
  
  /**
   * Update grab force based on target position
   */
  updateGrab(targetPosition: Vec3): void {
    if (this.grabVertex === null) return;
    
    const vertex = this.mesh.vertices.get(this.grabVertex)!;
    
    // Spring force toward target
    const delta = vec3.sub(targetPosition, vertex.position);
    this.grabForce = vec3.scale(delta, this.config.grabStiffness);
    
    // Check if we should initiate a tear
    const forceMag = vec3.length(this.grabForce);
    if (forceMag > this.config.fractureThreshold * 2 && vertex.isBoundary) {
      this.initiateTearAt(this.grabVertex);
    }
  }
  
  /**
   * End grab interaction
   */
  endGrab(): void {
    this.grabVertex = null;
    this.grabForce = { x: 0, y: 0, z: 0 };
  }
  
  /**
   * Initiate a tear at a boundary vertex
   */
  initiateTearAt(vertexId: number): void {
    const vertex = this.mesh.vertices.get(vertexId);
    if (!vertex || !vertex.isBoundary) return;
    
    // Check if already a tear tip
    if (this.tearTips.some(t => t.vertexId === vertexId)) return;
    
    // Create new tear tip
    const tip: TearTip = {
      vertexId,
      uvPosition: vertex.uv,
      tearDirection: { x: 0, y: 1 }, // Initial direction (will be computed)
      energy: 0,
    };
    
    this.tearTips.push(tip);
    vertex.isTearTip = true;
  }
  
  /**
   * Check if simulation has active tears
   */
  hasActiveTears(): boolean {
    return this.tearTips.length > 0;
  }
  
  /**
   * Get tear tip positions (for visualization)
   */
  getTearTipPositions(): Vec3[] {
    return this.tearTips.map(tip => {
      const vertex = this.mesh.vertices.get(tip.vertexId);
      return vertex ? vertex.position : { x: 0, y: 0, z: 0 };
    });
  }
}

