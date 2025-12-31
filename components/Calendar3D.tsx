'use client';

import { Suspense, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Environment, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import CalendarPage from './CalendarPage';
import TearMechanic from './TearMechanic';
import PaperParticles from './PaperParticles';
import { generateCalendarDates, CalendarDate } from '@/utils/dateUtils';
import { colors, dimensions } from '@/styles/design-tokens';

interface CalendarBindProps {
  position: [number, number, number];
}

function CalendarBind({ position }: CalendarBindProps) {
  const scale = 3 / dimensions.paper.width;
  const bindWidth = dimensions.bind.width * scale;
  const bindHeight = dimensions.bind.height * scale;
  
  return (
    <group position={position}>
      <RoundedBox
        args={[bindWidth, bindHeight, 0.05]}
        radius={0.01}
        smoothness={4}
      >
        <meshStandardMaterial
          color={colors.calendarBind}
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>
      {/* Shadow underneath bind */}
      <mesh position={[0, -0.02, -0.02]}>
        <planeGeometry args={[bindWidth, bindHeight * 0.5]} />
        <meshBasicMaterial 
          color="#000000" 
          transparent 
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}

function CalendarScene() {
  const dates = useMemo(() => generateCalendarDates(), []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tearProgress, setTearProgress] = useState(0);
  const [curveAmount, setCurveAmount] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showParticles, setShowParticles] = useState(false);
  
  const scale = 3 / dimensions.paper.width;
  const paperHeight = dimensions.paper.height * scale;
  
  const handleTearComplete = () => {
    setShowParticles(true);
    setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + 1, dates.length - 1));
      setShowParticles(false);
      setTearProgress(0);
      setDragOffset({ x: 0, y: 0 });
    }, 100);
  };
  
  // Pages to render (current + next)
  const visiblePages = [
    dates[currentIndex],
    dates[Math.min(currentIndex + 1, dates.length - 1)],
  ].filter((d, i, arr) => i === 0 || d !== arr[0]); // Remove duplicate if at end
  
  const paperBounds = {
    width: dimensions.paper.width * scale,
    height: paperHeight,
    position: [0, 0, 0] as [number, number, number],
  };
  
  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={50} />
      
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8}
        castShadow
      />
      <directionalLight 
        position={[-3, 2, 4]} 
        intensity={0.3}
      />
      
      {/* Calendar bind at top */}
      <CalendarBind position={[0, paperHeight / 2 + 0.12, 0.03]} />
      
      {/* Calendar pages - render in reverse order for proper z-stacking */}
      {visiblePages.slice().reverse().map((date, reverseIndex) => {
        const index = visiblePages.length - 1 - reverseIndex;
        const isTop = index === 0;
        const zOffset = -index * 0.03;
        
        return (
          <CalendarPage
            key={`${date.year}-${date.month}-${date.day}`}
            date={date}
            position={[0, 0, zOffset]}
            isTop={isTop}
            tearProgress={isTop ? tearProgress : 0}
            curveAmount={isTop ? curveAmount : 0}
            dragOffset={isTop ? dragOffset : { x: 0, y: 0 }}
          />
        );
      })}
      
      {/* Paper particles on tear */}
      <PaperParticles
        active={showParticles || tearProgress >= 1}
        origin={[0, paperHeight / 2, 0]}
        direction={dragOffset}
      />
      
      {/* Tear mechanic */}
      <TearMechanic
        onTearProgress={setTearProgress}
        onTearComplete={handleTearComplete}
        onDragOffset={setDragOffset}
        onCurveAmount={setCurveAmount}
        enabled={currentIndex < dates.length - 1}
        paperBounds={paperBounds}
      />
    </>
  );
}

// Loading component
function LoadingFallback() {
  return (
    <Html center>
      <div className="text-[#666] font-['Instrument_Sans'] text-lg">
        Loading calendar...
      </div>
    </Html>
  );
}

export default function Calendar3D() {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        gl={{ 
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <CalendarScene />
        </Suspense>
      </Canvas>
    </div>
  );
}

