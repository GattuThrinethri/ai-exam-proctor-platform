/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b19',
          900: '#0b132b',
          850: '#0f172a',
          800: '#131d33',
          750: '#162238',
          700: '#1a2744',
          600: '#233354',
          500: '#2e416a',
          400: '#435b8c',
        },
        tealAccent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        purpleAccent: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
        },
        pastel: {
          canvas: '#0b132b',      // Dark navy page background
          card: '#131d33',        // Navy card surface
          cardSoft: '#162238',    // Lighter navy card surface
          border: '#1e2d4a',      // Muted navy border
          lavender: '#1e1b4b',    // Dark lavender tint
          lavenderDark: '#c084fc',
          blue: '#0c2a4a',        // Dark blue cyan
          blueDark: '#38bdf8',
          mint: '#064e3b',        // Dark teal/mint
          mintDark: '#2dd4bf',
          peach: '#451a03',       // Dark amber/peach
          peachDark: '#fb923c',
          rose: '#4c0519',        // Dark rose
          roseDark: '#f43f5e',
          slate: '#0f172a',
          slateDark: '#cbd5e1',
        },
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6', // Teal cyan primary
          600: '#0d9488',
          700: '#0f766e',
        }
      }
    },
  },
  plugins: [],
}

