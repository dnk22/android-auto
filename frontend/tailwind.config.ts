import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
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

export default config;
