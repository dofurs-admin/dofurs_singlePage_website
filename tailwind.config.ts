import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#f7f4ef',
        peach: '#fde8da',
        petal: '#fff8f2',
        coral: '#e39a5d',
        sand: '#f3ebe1',
        ink: '#1f1f1f',
      },
      boxShadow: {
        soft: '0 12px 30px -18px rgba(0, 0, 0, 0.25)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      backgroundImage: {
        'hero-overlay': 'linear-gradient(120deg, rgba(247,244,239,0.80), rgba(253,232,218,0.56))',
      },
    },
  },
  plugins: [],
};

export default config;
