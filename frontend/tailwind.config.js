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
        pastel: {
          canvas: '#f4f6fb',      // Light lavender/blue-gray page background
          card: '#ffffff',        // Crisp card surface
          cardSoft: '#fbfcfe',    // Subtle tinted card
          border: '#e6ebf5',      // Soft muted border
          lavender: '#f3f0ff',    // Soft lavender
          lavenderDark: '#6d28d9',
          blue: '#edf5ff',        // Pastel blue
          blueDark: '#1d4ed8',
          mint: '#eafaf1',        // Soft mint
          mintDark: '#047857',
          peach: '#fff4eb',       // Soft peach/amber
          peachDark: '#c2410c',
          rose: '#fff1f2',        // Soft rose
          roseDark: '#be123c',
          slate: '#f8fafc',
          slateDark: '#334155',
        },
        brand: {
          50: '#f4f6fb',
          100: '#e8edf8',
          200: '#d5def2',
          500: '#6366f1', // soft pastel indigo
          600: '#4f46e5',
          700: '#4338ca',
        }
      }
    },
  },
  plugins: [],
}
