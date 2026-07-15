import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: "#f97316",
        ink: "#0a0a0a",
      },
    },
  },
  plugins: [],
};
export default config;
