import type { Config } from "tailwindcss";

const config: Config = {
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
        card: "var(--card)",
        "card-solid": "var(--card-solid)",
        "card-hover": "var(--card-hover)",
        field: "var(--field)",
        border: "var(--border)",
        "border-light": "var(--border-light)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",
        "accent-glow": "var(--accent-glow)",
        green: "var(--green)",
        red: "var(--red)",
        gold: "var(--gold)",
        muted: "var(--muted)",
        "muted-light": "var(--muted-light)",
        orange: "var(--orange)",
      },
    },
  },
  plugins: [],
};
export default config;
