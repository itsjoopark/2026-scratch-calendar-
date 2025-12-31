import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Figma design tokens
        background: '#f0eee9',
        paper: '#faf8f5',
        bind: '#d9d6d6',
        'accent-blue': '#2b79ff',
        'day-black': '#000000',
        'new-year-red': '#c41e3a',
        instruction: '#666666',
        
        // Paper texture colors
        'paper-fiber': '#d4d2cd',
        'torn-edge': '#e8e6e1',
      },
      fontFamily: {
        'instrument-sans': ['Instrument Sans', 'sans-serif'],
        'instrument-serif': ['Instrument Serif', 'serif'],
      },
      fontSize: {
        'calendar-day': ['200px', { lineHeight: '1' }],
        'calendar-year': ['25px', { lineHeight: 'normal' }],
        'calendar-month': ['25px', { lineHeight: 'normal' }],
      },
      boxShadow: {
        'bind': '0px 2px 5px rgba(0, 0, 0, 0.25)',
        'paper': '0 2px 10px rgba(0, 0, 0, 0.1)',
        'paper-drag': '0 20px 40px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'paper-flutter': 'paper-flutter 3s ease-in-out infinite',
        'tear-away': 'tear-away 0.4s ease-in forwards',
        'particle-fall': 'particle-fall 0.8s ease-out forwards',
      },
      keyframes: {
        'paper-flutter': {
          '0%, 100%': { transform: 'rotateX(0deg) rotateY(0deg)' },
          '25%': { transform: 'rotateX(2deg) rotateY(-1deg)' },
          '75%': { transform: 'rotateX(-1deg) rotateY(2deg)' },
        },
        'tear-away': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-100px) rotate(15deg)', opacity: '0' },
        },
        'particle-fall': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100px) rotate(180deg)', opacity: '0' },
        },
      },
      spacing: {
        'calendar-width': '450px',
        'calendar-height': '600px',
        'bind-width': '455px',
        'bind-height': '30px',
      },
    },
  },
  plugins: [],
};

export default config;
