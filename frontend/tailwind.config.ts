import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0B132B",
        surface: "#F4F7F6",
        bg: "#F4F7F6",
        card: "#FFFFFF",
        border: "#D8E0DC",
        accent: "#7209B7",
        cyan: "#4CC9F0",
        muted: "#5B6578",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11, 19, 43, 0.06), 0 8px 24px rgba(11, 19, 43, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
