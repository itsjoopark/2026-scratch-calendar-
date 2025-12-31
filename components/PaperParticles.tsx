'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { animation, colors } from '@/styles/design-tokens';

interface PaperParticlesProps {
  active: boolean;
  origin: [number, number, number];
  direction: { x: number; y: number };
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: THREE.Vector3;
  scale: number;
  lifetime: number;
  maxLifetime: number;
}

export default function PaperParticles({ active, origin, direction }: PaperParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  // Generate particles when tear is activated
  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = [];
      const count = animation.particles.count;
      
      for (let i = 0; i < count; i++) {
        // Spread particles along the top edge of the paper
        const spreadX = (Math.random() - 0.5) * 3;
        const spreadY = (Math.random() - 0.5) * 0.5;
        
        // Velocity based on tear direction
        const baseVelX = direction.x * 0.02 + (Math.random() - 0.5) * 0.03;
        const baseVelY = Math.abs(direction.y) * 0.03 + Math.random() * 0.02;
        const baseVelZ = (Math.random() - 0.5) * 0.02;
        
        newParticles.push({
          position: new THREE.Vector3(
            origin[0] + spreadX,
            origin[1] + 2 + spreadY,
            origin[2] + Math.random() * 0.1
          ),
          velocity: new THREE.Vector3(baseVelX, baseVelY, baseVelZ),
          rotation: new THREE.Euler(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          ),
          rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
          ),
          scale: animation.particles.minSize + 
            Math.random() * (animation.particles.maxSize - animation.particles.minSize),
          lifetime: 0,
          maxLifetime: animation.particles.duration + Math.random() * 0.3,
        });
      }
      
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [active, origin, direction]);
  
  // Animate particles
  useFrame((_, delta) => {
    if (particles.length === 0) return;
    
    setParticles(prev => 
      prev
        .map(p => {
          // Update position
          p.position.add(p.velocity);
          
          // Apply gravity
          p.velocity.y -= 0.001;
          
          // Air resistance
          p.velocity.multiplyScalar(0.98);
          
          // Update rotation
          p.rotation.x += p.rotationSpeed.x;
          p.rotation.y += p.rotationSpeed.y;
          p.rotation.z += p.rotationSpeed.z;
          
          // Update lifetime
          p.lifetime += delta;
          
          return p;
        })
        .filter(p => p.lifetime < p.maxLifetime)
    );
  });
  
  // Particle geometry - small irregular paper scraps
  const particleGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Create irregular quadrilateral shape
    shape.moveTo(-0.5, -0.3);
    shape.lineTo(0.4, -0.5);
    shape.lineTo(0.5, 0.4);
    shape.lineTo(-0.4, 0.5);
    shape.closePath();
    
    const geometry = new THREE.ShapeGeometry(shape);
    return geometry;
  }, []);
  
  return (
    <group ref={groupRef}>
      {particles.map((particle, i) => {
        const opacity = 1 - (particle.lifetime / particle.maxLifetime);
        const scale = particle.scale * 0.01 * (1 - particle.lifetime / particle.maxLifetime * 0.3);
        
        return (
          <mesh
            key={i}
            position={particle.position}
            rotation={particle.rotation}
            scale={[scale, scale, scale]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color={colors.paper}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

