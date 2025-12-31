'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { animation } from '@/styles/design-tokens';

interface TearMechanicProps {
  onTearProgress: (progress: number) => void;
  onTearComplete: () => void;
  onDragOffset: (offset: { x: number; y: number }) => void;
  onCurveAmount: (amount: number) => void;
  enabled: boolean;
  paperBounds: { width: number; height: number; position: [number, number, number] };
}

export default function TearMechanic({
  onTearProgress,
  onTearComplete,
  onDragOffset,
  onCurveAmount,
  enabled,
  paperBounds,
}: TearMechanicProps) {
  const { camera, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState({ x: 0, y: 0 });
  const [isTearing, setIsTearing] = useState(false);
  
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const intersectPoint = useRef(new THREE.Vector3());
  
  // Create invisible interaction plane
  const interactionPlane = useRef<THREE.Mesh | null>(null);
  
  const getMousePosition = useCallback((event: MouseEvent | TouchEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in event) {
      clientX = event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX ?? 0;
      clientY = event.touches[0]?.clientY ?? event.changedTouches[0]?.clientY ?? 0;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    mouse.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, [gl]);
  
  const handlePointerDown = useCallback((event: MouseEvent | TouchEvent) => {
    if (!enabled || isTearing) return;
    
    const pos = getMousePosition(event);
    
    // Check if click is on the paper area
    raycaster.current.setFromCamera(mouse.current, camera);
    raycaster.current.ray.intersectPlane(plane.current, intersectPoint.current);
    
    const hitX = Math.abs(intersectPoint.current.x - paperBounds.position[0]) < paperBounds.width / 2;
    const hitY = Math.abs(intersectPoint.current.y - paperBounds.position[1]) < paperBounds.height / 2;
    
    if (hitX && hitY) {
      setIsDragging(true);
      setDragStart(pos);
      setCurrentDrag({ x: 0, y: 0 });
      gl.domElement.style.cursor = 'grabbing';
    }
  }, [enabled, isTearing, getMousePosition, camera, paperBounds, gl]);
  
  const handlePointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!isDragging || !dragStart || isTearing) return;
    
    const pos = getMousePosition(event);
    const deltaX = pos.x - dragStart.x;
    const deltaY = pos.y - dragStart.y;
    
    setCurrentDrag({ x: deltaX, y: deltaY });
    onDragOffset({ x: deltaX, y: deltaY });
    
    // Calculate tear progress (primarily based on upward drag)
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const upwardDrag = -deltaY; // Negative because Y increases downward in screen coords
    
    // Weight upward drag more heavily
    const effectiveDrag = Math.max(dragDistance, upwardDrag * 1.5);
    const progress = Math.min(effectiveDrag / animation.tear.dragThreshold, 1);
    
    onTearProgress(progress);
    onCurveAmount(isDragging ? 1 : 0);
    
    // Visual feedback - cursor changes as user gets closer to tearing
    if (progress > 0.7) {
      gl.domElement.style.cursor = 'n-resize';
    }
  }, [isDragging, dragStart, isTearing, getMousePosition, onDragOffset, onTearProgress, onCurveAmount, gl]);
  
  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    
    const dragDistance = Math.sqrt(currentDrag.x * currentDrag.x + currentDrag.y * currentDrag.y);
    const upwardDrag = -currentDrag.y;
    const effectiveDrag = Math.max(dragDistance, upwardDrag * 1.5);
    
    if (effectiveDrag > animation.tear.dragThreshold) {
      // Trigger tear!
      setIsTearing(true);
      onTearProgress(1);
      
      // Complete tear after animation
      setTimeout(() => {
        onTearComplete();
        setIsTearing(false);
        onTearProgress(0);
        onDragOffset({ x: 0, y: 0 });
      }, animation.tear.tearDuration * 1000);
    } else {
      // Snap back
      onTearProgress(0);
      onDragOffset({ x: 0, y: 0 });
    }
    
    setIsDragging(false);
    setDragStart(null);
    setCurrentDrag({ x: 0, y: 0 });
    onCurveAmount(0);
    gl.domElement.style.cursor = 'grab';
  }, [isDragging, currentDrag, onTearProgress, onTearComplete, onDragOffset, onCurveAmount, gl]);
  
  // Set up event listeners
  useEffect(() => {
    const element = gl.domElement;
    
    element.addEventListener('mousedown', handlePointerDown);
    element.addEventListener('mousemove', handlePointerMove);
    element.addEventListener('mouseup', handlePointerUp);
    element.addEventListener('mouseleave', handlePointerUp);
    
    // Touch events for mobile
    element.addEventListener('touchstart', handlePointerDown, { passive: false });
    element.addEventListener('touchmove', handlePointerMove, { passive: false });
    element.addEventListener('touchend', handlePointerUp);
    element.addEventListener('touchcancel', handlePointerUp);
    
    return () => {
      element.removeEventListener('mousedown', handlePointerDown);
      element.removeEventListener('mousemove', handlePointerMove);
      element.removeEventListener('mouseup', handlePointerUp);
      element.removeEventListener('mouseleave', handlePointerUp);
      element.removeEventListener('touchstart', handlePointerDown);
      element.removeEventListener('touchmove', handlePointerMove);
      element.removeEventListener('touchend', handlePointerUp);
      element.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [gl, handlePointerDown, handlePointerMove, handlePointerUp]);
  
  // Set initial cursor
  useEffect(() => {
    if (enabled) {
      gl.domElement.style.cursor = 'grab';
    }
  }, [enabled, gl]);
  
  return null;
}

