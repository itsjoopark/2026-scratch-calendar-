// Design tokens extracted from Figma designs
// Japanese-style tear-off calendar - Hanji paper aesthetic

export const colors = {
  // Background
  background: '#f0eee9',       // Warm beige/cream
  
  // Calendar elements
  calendarBind: '#d9d6d6',     // Light gray binding strip
  paper: '#faf8f5',            // Hanji paper base (slightly warm white)
  paperTexture: '#f5f3ee',     // Paper texture highlight
  
  // Typography
  year: '#2b79ff',             // Bright blue for year
  month: '#2b79ff',            // Bright blue for month
  day: '#000000',              // Black for day number
  // dayNewYear: '#c41e3a',       // Commented out - was causing glitches
  
  // UI elements
  instructionText: '#666666',  // Gray instruction text
  instructionOpacity: 0.7,
  
  // Shadow colors
  bindShadow: 'rgba(0, 0, 0, 0.25)',
  paperShadow: 'rgba(0, 0, 0, 0.1)',
  paperDragShadow: 'rgba(0, 0, 0, 0.3)',
  
  // Paper edge effects
  tornEdge: '#e8e6e1',
  paperFiber: '#d4d2cd',
} as const;

export const typography = {
  year: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 400,
    fontSize: '25px',
    fontVariationSettings: "'wdth' 100",
  },
  day: {
    fontFamily: "'Instrument Serif', serif",
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: '200px',
    lineHeight: 1,
  },
  month: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 600,
    fontSize: '25px',
    fontVariationSettings: "'wdth' 100",
  },
  instruction: {
    fontFamily: "'Instrument Sans', sans-serif",
    fontWeight: 400,
    fontSize: '16px',
  },
} as const;

export const dimensions = {
  // Calendar paper dimensions
  paper: {
    width: 450,
    height: 600,
  },
  // Calendar bind (top strip)
  bind: {
    width: 455,
    height: 30,
  },
  // Content positioning
  content: {
    topOffset: 161,
    monthOffset: 261,
    frameWidth: 167,
  },
  // 3D scene
  scene: {
    paperDepth: 0.5,        // Paper thickness in 3D
    stackOffset: 0.02,      // Spacing between stacked pages
    bindHeight: 30,
    cameraDistance: 6,
  },
} as const;

export const shadows = {
  bind: '0px 2px 5px rgba(0, 0, 0, 0.25)',
  paperRest: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.1))',
  paperDrag: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3))',
} as const;

export const animation = {
  // Tear animation parameters
  tear: {
    dragThreshold: 120,        // Pixels to drag before tearing
    tearDuration: 0.4,         // Seconds for tear animation
    rotationMax: 45,           // Max rotation degrees on tear
    scaleOnTear: 0.8,          // Scale factor when torn
  },
  // Paper curl effect
  curl: {
    maxRotateX: 45,            // Max X rotation during drag
    maxRotateY: 15,            // Max Y rotation during drag
    maxRotateZ: 8,             // Max Z rotation during drag
  },
  // Particle effects
  particles: {
    count: 30,                 // Number of paper particles
    minSize: 2,
    maxSize: 8,
    duration: 0.8,
  },
} as const;

// Date configuration
export const dateConfig = {
  startDate: new Date(2025, 11, 30), // December 30, 2025
  totalDays: 3,                       // Dec 30, Dec 31, Jan 1
  specialDates: {
    newYear: { month: 0, day: 1 },    // January 1st gets special styling
  },
} as const;

// Japanese calendar aesthetics
export const japaneseStyle = {
  // Traditional color names (for reference)
  shirokuchiba: '#f5f0e6',     // Natural paper white
  sumi: '#1c1c1c',             // Ink black
  // beni: '#c41e3a',             // Commented out - was causing glitches
  ai: '#2b79ff',               // Indigo blue (modernized)
  
  // Paper texture parameters
  paperTexture: {
    fiberDensity: 0.3,
    warmth: 0.95,
    roughness: 0.7,
  },
} as const;


