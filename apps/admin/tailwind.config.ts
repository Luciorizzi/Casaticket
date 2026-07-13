import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#f4efe4',
        ink: '#141312',
        rust: '#bc5c3d',
        moss: '#6f7d57',
        steel: '#52606d',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

