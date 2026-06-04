/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "Arial", "sans-serif"],
      },
      colors: {
        ink: "#17384a",
        mist: "#f3f8f8",
        teal: {
          50: "#eefafa",
          100: "#d9f2f1",
          200: "#b7e3e1",
          300: "#87cfcc",
          400: "#54b5b3",
          500: "#369897",
          600: "#2b7a7b",
          700: "#286263",
          800: "#275051",
          900: "#254447"
        }
      },
      boxShadow: {
        soft: "0 16px 45px rgba(32, 94, 101, 0.10)",
        card: "0 8px 24px rgba(35, 75, 87, 0.08)",
      },
    },
  },
  plugins: [],
};
