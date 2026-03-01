/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: "#030712",  // Deepest background
          900: "#0a0f1a",  // Dark background
          800: "#111827",  // Card background
          700: "#1e293b",  // Border dark
        },
        neon: {
          cyan: "#00f3ff",
          cyanHover: "#00d4e6",
          glow: "rgba(0, 243, 255, 0.5)",
          glowStrong: "rgba(0, 243, 255, 0.8)",
        },
        space: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
        }
      },
      backgroundImage: {
        'aerodrome-glow': "radial-gradient(ellipse_at_top_right, rgba(0, 243, 255, 0.12) 0%, rgba(0, 0, 0, 0.4) 50%, #030712 100%)",
        'space-noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 243, 255, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 243, 255, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0, 243, 255, 0.3), 0 0 40px rgba(0, 243, 255, 0.1)',
        'neon-hover': '0 0 30px rgba(0, 243, 255, 0.5), 0 0 60px rgba(0, 243, 255, 0.2)',
      }
    },
  },
  plugins: [],
}
