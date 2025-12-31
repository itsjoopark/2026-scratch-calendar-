'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'motion/react';
import { CalendarDate, generateCalendarDates } from '@/utils/dateUtils';

// Number of horizontal strips for curl effect
const CURL_SEGMENTS = 20;

// Generate paper texture SVG
const PaperTexture = ({ id }: { id: string }) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.12 }} preserveAspectRatio="none">
    <defs>
      <filter id={`paper-texture-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
    <rect width="100%" height="100%" filter={`url(#paper-texture-${id})`} />
  </svg>
);

// Paper particles on tear
function PaperParticles({ active, origin }: { active: boolean; origin: { x: number; y: number } }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    size: number;
    vx: number;
    vy: number;
  }>>([]);

  useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: 35 }, (_, i) => ({
        id: Date.now() + i,
        x: origin.x + (Math.random() - 0.5) * 350,
        y: origin.y + Math.random() * 100,
        rotation: Math.random() * 360,
        size: 2 + Math.random() * 12,
        vx: (Math.random() - 0.5) * 200,
        vy: 50 + Math.random() * 150,
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(() => setParticles([]), 1500);
      return () => clearTimeout(timer);
    }
  }, [active, origin]);

  return (
    <AnimatePresence>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * 0.6,
            left: p.x,
            top: p.y,
            backgroundColor: '#faf8f5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            borderRadius: '1px',
          }}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
          animate={{
            x: p.vx,
            y: p.vy + 400,
            rotate: p.rotation + 720,
            opacity: 0,
            scale: 0.2,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        />
      ))}
    </AnimatePresence>
  );
}

// Page content component
function PageContent({ date, segmentIndex, totalSegments }: { 
  date: CalendarDate; 
  segmentIndex?: number;
  totalSegments?: number;
}) {
  const dayColor = date.isNewYear ? '#c41e3a' : '#000000';
  const segmentHeight = totalSegments ? 100 / totalSegments : 100;
  const topOffset = segmentIndex !== undefined ? segmentIndex * segmentHeight : 0;
  
  // For segmented rendering, we clip the content
  const clipStyle = segmentIndex !== undefined ? {
    clipPath: `inset(${topOffset}% 0 ${100 - topOffset - segmentHeight}% 0)`,
    transform: `translateY(-${topOffset}%)`,
  } : {};
  
  return (
    <div className="absolute inset-0" style={clipStyle}>
      <div className="absolute inset-0" style={{ backgroundColor: '#faf8f5' }}>
        <PaperTexture id={`seg-${segmentIndex ?? 'full'}`} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p 
          className="text-center"
          style={{ 
            fontFamily: "'Instrument Sans', sans-serif",
            fontSize: '25px',
            color: '#2b79ff'
          }}
        >
          {date.year}
        </p>
        <p 
          style={{ 
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: '200px',
            lineHeight: 1,
            color: dayColor,
          }}
        >
          {date.day}
        </p>
        <p 
          className="text-center mt-2"
          style={{ 
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: 600,
            fontSize: '25px',
            color: '#2b79ff'
          }}
        >
          {date.month}
        </p>
      </div>
    </div>
  );
}

// Static background page
function StaticPage({ date, zIndex }: { date: CalendarDate; zIndex: number }) {
  return (
    <div 
      className="absolute overflow-hidden rounded-sm"
      style={{ 
        width: '450px', 
        height: '600px',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex,
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <PageContent date={date} />
    </div>
  );
}

// Individual curl segment
interface CurlSegmentProps {
  date: CalendarDate;
  segmentIndex: number;
  totalSegments: number;
  curlProgress: number; // 0 to 1
  isDragging: boolean;
}

function CurlSegment({ date, segmentIndex, totalSegments, curlProgress, isDragging }: CurlSegmentProps) {
  const segmentHeight = 600 / totalSegments;
  
  // Calculate rotation for this segment
  // Bottom segments curl first and curl more
  const segmentPosition = segmentIndex / (totalSegments - 1); // 0 = top, 1 = bottom
  
  // Progressive curl: bottom segments start curling first
  const curlDelay = (1 - segmentPosition) * 0.3; // Top segments have more delay
  const adjustedProgress = Math.max(0, Math.min(1, (curlProgress - curlDelay) / (1 - curlDelay)));
  
  // Rotation increases with progress, bottom segments rotate more
  const maxRotation = -180 * (0.5 + segmentPosition * 0.5); // -90° to -180°
  const rotation = adjustedProgress * maxRotation;
  
  // Z translation to create cylinder effect
  const zOffset = Math.sin(adjustedProgress * Math.PI) * 30 * segmentPosition;
  
  // Y translation - segments move up as they curl
  const yOffset = adjustedProgress * -segmentHeight * 0.3 * segmentPosition;
  
  // Scale slightly to prevent gaps
  const scaleY = 1 + (adjustedProgress * 0.02);
  
  return (
    <div
      style={{
        position: 'absolute',
        top: segmentIndex * segmentHeight,
        left: 0,
        width: '450px',
        height: segmentHeight + 1, // +1 to prevent gaps
        transformOrigin: 'center top',
        transform: `
          perspective(1000px)
          translateY(${yOffset}px)
          translateZ(${zOffset}px)
          rotateX(${rotation}deg)
          scaleY(${scaleY})
        `,
        backfaceVisibility: 'hidden',
        overflow: 'hidden',
      }}
    >
      <div 
        style={{ 
          width: '450px', 
          height: '600px',
          marginTop: -segmentIndex * segmentHeight,
          backgroundColor: '#faf8f5',
        }}
      >
        <PageContent date={date} />
      </div>
    </div>
  );
}

// Draggable curl page with segmented curl effect
interface CurlablePageProps {
  date: CalendarDate;
  pageKey: number;
  zIndex: number;
  onTearComplete: () => void;
  canTear: boolean;
}

function CurlablePage({ date, pageKey, zIndex, onTearComplete, canTear }: CurlablePageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [tearState, setTearState] = useState<'idle' | 'curling' | 'tearing' | 'torn'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Motion values for drag
  const dragY = useMotionValue(0);
  const dragX = useMotionValue(0);
  
  // Spring for smooth curl animation
  const curlProgress = useSpring(0, { stiffness: 300, damping: 30 });
  const [curlValue, setCurlValue] = useState(0);
  
  // Track curl progress
  useEffect(() => {
    const unsubscribe = curlProgress.on('change', (v) => {
      setCurlValue(v);
    });
    return unsubscribe;
  }, [curlProgress]);
  
  // Track if tear has been triggered during this drag
  const tearTriggeredRef = useRef(false);
  
  // Trigger tear animation
  const handleTearTrigger = useCallback((finalX: number, finalY: number) => {
    setTearState('tearing');
    setIsDragging(false);
    
    // Animate to full curl
    curlProgress.set(1);
    
    // After curl completes, trigger fall animation
    setTimeout(() => {
      setTearState('torn');
      
      // Notify parent after fall animation
      setTimeout(() => {
        onTearComplete();
      }, 600);
    }, 300);
  }, [curlProgress, onTearComplete]);
  
  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!canTear || tearState !== 'idle') return;
    
    setIsDragging(true);
    setTearState('curling');
    tearTriggeredRef.current = false;
    
    const startY = e.clientY;
    const startX = e.clientX;
    
    const handleMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY; // Positive when dragging up
      const deltaX = moveEvent.clientX - startX;
      
      dragY.set(deltaY);
      dragX.set(deltaX);
      
      // Calculate curl progress (0 to 1)
      // Curl starts after 20px drag, completes at 150px
      const progress = Math.max(0, Math.min(1, (deltaY - 20) / 130));
      curlProgress.set(progress);
      
      // Auto-trigger tear at 85% curl
      if (progress > 0.85 && !tearTriggeredRef.current) {
        tearTriggeredRef.current = true;
        handleTearTrigger(deltaX, deltaY);
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
      }
    };
    
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      
      if (tearTriggeredRef.current) return;
      
      const currentProgress = curlProgress.get();
      
      if (currentProgress > 0.7) {
        // Complete the tear
        tearTriggeredRef.current = true;
        handleTearTrigger(dragX.get(), dragY.get());
      } else {
        // Snap back
        setIsDragging(false);
        setTearState('idle');
        curlProgress.set(0);
        dragY.set(0);
        dragX.set(0);
      }
    };
    
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [canTear, tearState, curlProgress, dragY, dragX, handleTearTrigger]);
  
  // Segments for curl effect
  const segments = useMemo(() => {
    return Array.from({ length: CURL_SEGMENTS }, (_, i) => i);
  }, []);
  
  // Don't render if torn
  if (tearState === 'torn') {
    return null;
  }
  
  return (
    <motion.div
      ref={containerRef}
      className="absolute cursor-grab active:cursor-grabbing"
      style={{
        width: '450px',
        height: '600px',
        left: '50%',
        top: '50%',
        marginLeft: '-225px',
        marginTop: '-300px',
        zIndex,
        transformStyle: 'preserve-3d',
        perspective: '1200px',
      }}
      onPointerDown={handlePointerDown}
      initial={{ opacity: 1 }}
      animate={tearState === 'tearing' ? {
        y: 500,
        rotateX: -60,
        rotateZ: dragX.get() > 0 ? 20 : -20,
        opacity: 0,
        scale: 0.6,
      } : {}}
      transition={tearState === 'tearing' ? {
        duration: 0.6,
        ease: [0.45, 0.05, 0.55, 0.95],
      } : {}}
    >
      {/* Shadow under curling paper */}
      <motion.div
        className="absolute rounded-lg"
        style={{
          width: '430px',
          height: '580px',
          left: '10px',
          top: '10px',
          background: 'rgba(0,0,0,0.15)',
          filter: 'blur(15px)',
          opacity: isDragging ? 0.6 + curlValue * 0.4 : 0.3,
          transform: `translateY(${5 + curlValue * 20}px) scale(${1 - curlValue * 0.1})`,
        }}
      />
      
      {/* Curling paper segments */}
      <div 
        className="relative w-full h-full rounded-sm overflow-hidden"
        style={{
          transformStyle: 'preserve-3d',
          filter: isDragging 
            ? `drop-shadow(0 ${10 + curlValue * 30}px ${20 + curlValue * 30}px rgba(0,0,0,${0.2 + curlValue * 0.2}))`
            : 'drop-shadow(0 4px 12px rgba(0,0,0,0.1))',
        }}
      >
        {(tearState === 'curling' || tearState === 'tearing') && curlValue > 0.01 ? (
          // Segmented curl view
          segments.map((i) => (
            <CurlSegment
              key={i}
              date={date}
              segmentIndex={i}
              totalSegments={CURL_SEGMENTS}
              curlProgress={curlValue}
              isDragging={isDragging}
            />
          ))
        ) : (
          // Normal flat view
          <div className="absolute inset-0 rounded-sm overflow-hidden">
            <PageContent date={date} />
          </div>
        )}
      </div>
      
      {/* Curl hint visual - bottom edge lift */}
      {tearState === 'idle' && canTear && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.08), transparent)',
            borderRadius: '0 0 4px 4px',
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
}

export default function Calendar2D() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const calendarDates = useRef(generateCalendarDates()).current;

  const handleTearComplete = useCallback(() => {
    console.log('Tear complete! Index:', currentIndex, '→', currentIndex + 1);
    
    // Show particles
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 100);
    
    // Prevent double-tears
    setIsTransitioning(true);
    
    // Advance to next date (continues past Jan 1!)
    setCurrentIndex(prev => {
      const next = prev + 1;
      // Loop back if we reach the end (Option A behavior as fallback)
      if (next >= calendarDates.length) {
        return 0;
      }
      return next;
    });
    
    // Allow next tear after transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
  }, [currentIndex, calendarDates.length]);

  // Current and next dates
  const currentDate = calendarDates[currentIndex];
  const nextIndex = (currentIndex + 1) % calendarDates.length;
  const nextDate = calendarDates[nextIndex];
  const canTear = !isTransitioning;

  return (
    <div 
      className="relative mx-auto select-none touch-none"
      style={{ 
        width: '455px', 
        height: '680px',
        perspective: '1500px',
      }}
    >
      {/* Calendar Bind */}
      <div 
        className="absolute left-1/2 rounded-t-md"
        style={{ 
          transform: 'translateX(-50%)',
          top: 0,
          width: '455px',
          height: '30px',
          backgroundColor: '#d9d6d6',
          boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.25)',
          zIndex: 100,
        }}
      >
        {/* Binding holes/ring hint */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-20">
          {[0, 1].map((i) => (
            <div 
              key={i}
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: '#b8b5b5', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}
            />
          ))}
        </div>
      </div>
      
      {/* Calendar Pages Container */}
      <div 
        className="relative w-full h-full" 
        style={{ paddingTop: '30px' }}
      >
        {/* Next page (static, underneath) - always visible */}
        <StaticPage
          key={`static-${nextIndex}`}
          date={nextDate}
          zIndex={1}
        />
        
        {/* Current page (curlable, on top) */}
        <AnimatePresence mode="popLayout">
          <CurlablePage
            key={`curl-${currentIndex}`}
            pageKey={currentIndex}
            date={currentDate}
            zIndex={10}
            onTearComplete={handleTearComplete}
            canTear={canTear}
          />
        </AnimatePresence>
      </div>

      {/* Paper Particles */}
      <PaperParticles 
        active={showParticles}
        origin={{ x: 227, y: 550 }}
      />
      
      {/* Date indicator */}
      <div 
        className="absolute bottom-0 left-0 right-0 text-center text-xs py-2"
        style={{ color: '#999' }}
      >
        {currentDate.month} {currentDate.day}, {currentDate.year}
      </div>
    </div>
  );
}
