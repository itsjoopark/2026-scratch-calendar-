'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CalendarDate } from '@/utils/dateUtils';
import { colors, dimensions } from '@/styles/design-tokens';

interface CalendarPageProps {
  date: CalendarDate;
  position: [number, number, number];
  isTop: boolean;
  tearProgress: number;
  curveAmount: number;
  dragOffset: { x: number; y: number };
}

// Create paper texture with hanji-style fibers
function createPaperTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  
  // Base warm white
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, 1024, 1024);
  
  // Add subtle grain
  ctx.fillStyle = 'rgba(235, 230, 220, 0.3)';
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const size = Math.random() * 1.5;
    ctx.fillRect(x, y, size, size);
  }
  
  // Add hanji-style fibers (subtle, organic lines)
  ctx.strokeStyle = 'rgba(200, 195, 180, 0.08)';
  ctx.lineWidth = 0.5;
  
  for (let i = 0; i < 300; i++) {
    const x1 = Math.random() * 1024;
    const y1 = Math.random() * 1024;
    const length = 30 + Math.random() * 80;
    const angle = Math.random() * Math.PI * 2;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    // Create slightly curved fiber
    const cx = x1 + Math.cos(angle) * length * 0.5 + (Math.random() - 0.5) * 20;
    const cy = y1 + Math.sin(angle) * length * 0.5 + (Math.random() - 0.5) * 20;
    const x2 = x1 + Math.cos(angle) * length;
    const y2 = y1 + Math.sin(angle) * length;
    
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }
  
  // Add some darker fiber specks
  ctx.fillStyle = 'rgba(180, 170, 155, 0.15)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export default function CalendarPage({ 
  date, 
  position, 
  isTop, 
  tearProgress, 
  curveAmount,
  dragOffset 
}: CalendarPageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tornRef = useRef(false);
  
  // Scale factor to convert pixels to 3D units (450px = 3 units)
  const scale = 3 / dimensions.paper.width;
  const paperWidth = dimensions.paper.width * scale;
  const paperHeight = dimensions.paper.height * scale;
  
  // Create paper texture
  const paperTexture = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return createPaperTexture();
  }, []);
  
  // Calculate text color based on date
  const dayColor = date.isNewYear ? '#c41e3a' : colors.day;
  
  // Track if torn
  useEffect(() => {
    if (tearProgress >= 1 && !tornRef.current) {
      tornRef.current = true;
    }
    if (tearProgress === 0) {
      tornRef.current = false;
    }
  }, [tearProgress]);
  
  // Animate the page based on drag and tear
  useFrame(() => {
    if (!groupRef.current) return;
    
    if (isTop && tearProgress < 1) {
      // Apply curl effect based on drag - make it feel like paper
      const dragMagnitude = Math.sqrt(dragOffset.x * dragOffset.x + dragOffset.y * dragOffset.y);
      const normalizedMag = Math.min(dragMagnitude / 150, 1);
      
      // Rotation follows drag direction
      const rotX = (-dragOffset.y / 200) * 0.5 * curveAmount;
      const rotY = (dragOffset.x / 200) * 0.3 * curveAmount;
      const rotZ = (dragOffset.x / 300) * 0.15 * curveAmount;
      
      groupRef.current.rotation.x = rotX;
      groupRef.current.rotation.y = rotY;
      groupRef.current.rotation.z = rotZ;
      
      // Translate based on drag (constrained)
      groupRef.current.position.x = position[0] + (dragOffset.x / 100) * 0.5;
      groupRef.current.position.y = position[1] + (dragOffset.y / 100) * 0.5;
      groupRef.current.position.z = position[2] + normalizedMag * 0.3;
    } else if (tearProgress >= 1) {
      // Tear animation - fly away with physics feel
      groupRef.current.position.y += 0.08;
      groupRef.current.position.x += dragOffset.x > 0 ? 0.02 : -0.02;
      groupRef.current.rotation.z += dragOffset.x > 0 ? 0.05 : -0.05;
      groupRef.current.rotation.x -= 0.02;
    } else if (!isTop) {
      // Reset non-top pages
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.position.set(position[0], position[1], position[2]);
    }
  });
  
  // Calculate opacity for tear animation
  const opacity = tearProgress >= 1 ? Math.max(0, 1 - (tearProgress - 1) * 5) : 1;
  
  return (
    <group ref={groupRef} position={position}>
      {/* Paper body - main surface */}
      <RoundedBox
        args={[paperWidth, paperHeight, 0.015]}
        radius={0.005}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#faf8f5"
          map={paperTexture}
          roughness={0.85}
          metalness={0}
          transparent
          opacity={opacity}
        />
      </RoundedBox>
      
      {/* Paper edge - subtle depth */}
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[paperWidth, paperHeight, 0.01]} />
        <meshStandardMaterial 
          color="#ebe8e3" 
          roughness={0.9}
          transparent
          opacity={opacity * 0.8}
        />
      </mesh>
      
      {/* Year text */}
      <Text
        position={[0, paperHeight * 0.27, 0.02]}
        fontSize={0.17}
        color={colors.year}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/instrumentsans/v1/pximypc9vsFDm051Uf6KVwgkfoSxQ0GssKtJnFGmQ9E.woff2"
      >
        {date.year}
      </Text>
      
      {/* Day number - large italic */}
      <Text
        position={[0, 0.05, 0.02]}
        fontSize={1.5}
        color={dayColor}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/instrumentserif/v4/jizBRFtNs2ka5fXjeivQ4LroWlx-5zIZj1a0.woff2"
        fontStyle="italic"
        letterSpacing={-0.05}
      >
        {date.day}
      </Text>
      
      {/* Month text */}
      <Text
        position={[0, -paperHeight * 0.28, 0.02]}
        fontSize={0.17}
        color={colors.month}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/instrumentsans/v1/pxiDypc9vsFDm051Uf6KVwgkfoSbQk8dMH-5JYNNzCaY.woff2"
        fontWeight={600}
      >
        {date.month}
      </Text>
    </group>
  );
}
