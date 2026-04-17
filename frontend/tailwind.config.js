/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 50px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
