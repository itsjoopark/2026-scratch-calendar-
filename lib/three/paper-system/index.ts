/**
 * Paper Tearing System
 * 
 * Based on "Interactive Paper Tearing" (Schreck et al., Eurographics 2017)
 * 
 * Architecture:
 * - PaperMesh: Coarse triangular topology management
 * - TearSimulation: Force-based tear propagation in UV space
 * - TearMask: Procedural torn edge detail (texture-based)
 * - PaperController: Main interface integrating all systems
 * 
 * Key concepts:
 * 1. Near-inextensible thin sheet simulation
 * 2. Boundary-driven tearing (not volumetric)
 * 3. Tear computed in 2D pattern (UV) space
 * 4. Force clustering + bisector for tear direction
 * 5. High-frequency detail via procedural textures
 */

export { PaperMesh } from './paper-mesh';
export { TearSimulation } from './tear-simulation';
export { TearMask, paperShaders } from './tear-mask';
export { PaperController, type CalendarDate } from './paper-controller';
export * from './types';

