import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { primary: { DEFAULT: "#0c93e7", deep: "#0b426e", navy: "#072b49" } } } },
  plugins: [require("tailwindcss-animate")],
};
export default config;
