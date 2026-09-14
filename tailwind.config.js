/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#070D18',
        surface: '#0F1726',
        'surface-raised': '#121C2D',
        'surface-hover': '#1A2538',
        border: '#1D2A3D',
        'border-strong': '#2A3A52',
        brand: {
          start: '#7C3AED',
          end: '#8B5CF6',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        accent: '#8B5CF6',
        'accent-soft': '#8B5CF61A',
        'accent-hover': '#A78BFA',
        ink: {
          DEFAULT: '#F8FAFC',
          muted: '#94A3B8',
          faint: '#64748B',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        ticket: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 20px -5px rgba(139, 92, 246, 0.25)',
        'elevated': '0 4px 24px -4px rgba(0, 0, 0, 0.4), 0 1px 0 0 rgba(255,255,255,0.03) inset',
      },
    },
  },
  plugins: [],
}
