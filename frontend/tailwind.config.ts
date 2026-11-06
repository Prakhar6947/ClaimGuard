import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        canvas: "#F6F6F3",
        ink: "#18181B",
        clinical: {
          DEFAULT: "#0F766E",
          dark: "#115E59",
          light: "#F0FDFA",
        },
      },
    },
  },
  plugins: [],
};
export default config;
