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
          950: '#0B0F19',
          900: '#111827',
          800: '#1F2937',
          750: '#2A3544',
          700: '#374151',
        },
        primaryAqua: {
          DEFAULT: '#38BDF8',
          hover: '#0EA5E9',
          light: '#7DD3FC',
        },
        accentPink: {
          DEFAULT: '#F43F5E',
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
