/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    container: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans JP'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
