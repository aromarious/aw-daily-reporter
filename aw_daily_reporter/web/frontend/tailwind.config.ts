import type { Config } from "tailwindcss";

const config: Config & { daisyui?: { themes?: string[] } } = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
            DEFAULT: "#6366f1", // Indigo 500
            hover: "#4f46e5", // Indigo 600
        },
        card: {
            bg: "rgba(255, 255, 255, 0.85)",
            border: "rgba(226, 232, 240, 0.8)",
        },
        text: {
            primary: "#1e293b", // Slate 800
            muted: "#64748b", // Slate 500
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      backgroundImage: {
        'premium-gradient': "radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.15) 0px, transparent 50%)",
      },
      screens: {
          'timeline': '350px', // Custom breakpoint if needed
      }
    },
  },
  plugins: [
    require("daisyui"),
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  daisyui: {
    themes: ["light", "dark"],
  },
};
export default config;
