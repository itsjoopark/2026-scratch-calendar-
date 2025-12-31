'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarScene } from '@/lib/three/calendar-scene';

interface CalendarDate {
  year: number;
  month: string;
  day: number;
  isNewYear: boolean;
}

function getCountdownToNewYear(): { days: number; hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const newYear = new Date(2026, 0, 1, 0, 0, 0);
  const diff = newYear.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CalendarScene | null>(null);
  const [currentDate, setCurrentDate] = useState<CalendarDate | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;
    
    setMounted(true);
    
    const scene = new CalendarScene(containerRef.current);
    sceneRef.current = scene;
    
    // Set up date change callback
    scene.onDateChange = (date) => {
      setCurrentDate(date);
    };
    
    // Set initial date
    setCurrentDate(scene.getCurrentDate());
    
    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdownToNewYear());
    }, 1000);
    
    setCountdown(getCountdownToNewYear());
    
    return () => clearInterval(timer);
  }, []);

  return (
    <main 
      className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative"
      style={{ 
        // Figma background: #f0eee9
        backgroundColor: '#f0eee9' 
      }}
    >
      {/* Three.js Canvas Container */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-[500px] aspect-[3/4] select-none"
        style={{ 
          maxHeight: 'calc(100vh - 180px)',
          touchAction: 'none',
          zIndex: 10, // Above fireworks background
        }}
        aria-label="Drag to rip off the page"
      />
      
      {/* Instructions */}
      <p 
        className="mt-6 text-center text-base px-4"
        style={{ 
          color: '#666666',
          opacity: 0.7,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          position: 'relative',
          zIndex: 10,
        }}
      >
        Drag to rip off the page
      </p>
      
      {/* Countdown display */}
      {mounted && countdown.days >= 0 && (
        <div className="mt-5 text-center" style={{ position: 'relative', zIndex: 10 }}>
          <p 
            className="text-sm mb-2"
            style={{ 
              color: '#999',
              fontFamily: "'Instrument Sans', system-ui, sans-serif"
            }}
          >
            Countdown to 2026
          </p>
          <div 
            className="flex gap-4 justify-center"
            style={{ 
              color: '#2b79ff',
              fontFamily: "'Instrument Sans', system-ui, sans-serif"
            }}
          >
            <div className="flex flex-col items-center">
              <span 
                className="text-2xl font-semibold" 
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {countdown.days}
              </span>
              <span className="text-xs" style={{ color: '#999' }}>days</span>
            </div>
            <div className="flex flex-col items-center">
              <span 
                className="text-2xl font-semibold" 
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {String(countdown.hours).padStart(2, '0')}
              </span>
              <span className="text-xs" style={{ color: '#999' }}>hours</span>
            </div>
            <div className="flex flex-col items-center">
              <span 
                className="text-2xl font-semibold" 
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {String(countdown.minutes).padStart(2, '0')}
              </span>
              <span className="text-xs" style={{ color: '#999' }}>min</span>
            </div>
            <div className="flex flex-col items-center">
              <span 
                className="text-2xl font-semibold" 
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {String(countdown.seconds).padStart(2, '0')}
              </span>
              <span className="text-xs" style={{ color: '#999' }}>sec</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <footer 
        className="absolute bottom-4 text-center text-xs px-4"
        style={{ 
          color: '#bbb',
          fontFamily: "'Instrument Sans', system-ui, sans-serif"
        }}
      >
        New Year 2026 Tear-Off Calendar
      </footer>
    </main>
  );
}
