/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#004B8A', // Pantone 3005
          light: '#0075B3',   // Pantone 2945
          dark: '#003366',
        },
        neutral: {
          DEFAULT: '#999999', // Cool Gray 10
          light: '#CCCCCC',
          dark: '#666666',
        },
        danger: '#DC2C2C',
        warning: '#FF8C00',
        success: '#28A745',
      },
      spacing: {
        'sidebar': '280px',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};

