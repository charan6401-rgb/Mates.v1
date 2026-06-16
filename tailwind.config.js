/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slateDark: {
          950: '#0B0F19', // Deep interstellar canvas
          900: '#111827', // Card Slate bg
          800: '#1F2937', // Inner board trim
          750: '#2C374E',
          850: '#182235'
        },
        primaryAqua: {
          DEFAULT: '#38BDF8', // Cyber sky blue
          hover: '#0EA5E9',
          light: '#7DD3FC',
        },
        accentPink: {
          DEFAULT: '#F43F5E', // Warm hearts/moderation status
          hover: '#E11D48',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
