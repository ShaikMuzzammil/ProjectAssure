import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { primary: { DEFAULT: "#0c93e7", deep: "#0b426e", navy: "#072b49" } } } },
  plugins: [tailwindcssAnimate],
};
export default config;
