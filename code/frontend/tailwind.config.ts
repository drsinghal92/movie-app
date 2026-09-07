import type { Config } from "tailwindcss";

// Maps to the tokens defined in docs/style-guide.html. Colors and fonts are
// wired to CSS custom properties so the style guide stays the one source of
// the actual values.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        ink: "var(--ink)",
        dark: "var(--dark)",
        "dark-elev": "var(--dark-elev)",
        "dark-elev-2": "var(--dark-elev-2)",
        white: "var(--white)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        hairline: "var(--hairline)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};

export default config;
