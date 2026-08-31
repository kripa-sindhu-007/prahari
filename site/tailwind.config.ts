import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sentinel dark palette — deep slate base, green = pass, red = refuse.
        bg: {
          DEFAULT: "#0B1120",   // page base (just above pure black, no OLED smear)
          soft: "#0F172A",      // raised base
        },
        surface: {
          DEFAULT: "#111A2E",   // cards / terminal body
          soft: "#0D1526",      // terminal chrome / insets
          raised: "#16223A",    // hover / elevated
        },
        line: {
          DEFAULT: "#1E2A44",   // hairline borders
          soft: "#182338",
          strong: "#2C3A5A",
        },
        ink: {
          DEFAULT: "#F1F5F9",   // primary text
          soft: "#CBD5E1",      // secondary text
          muted: "#8595AD",     // tertiary / captions
          faint: "#5A6B87",     // comments in code
        },
        pass: {
          DEFAULT: "#22C55E",   // validated / go
          soft: "#4ADE80",
          dim: "#16351f",       // pass surface tint
        },
        fail: {
          DEFAULT: "#F26060",   // boot failure
          soft: "#F87171",
          dim: "#3a1a1f",       // fail surface tint
        },
        warn: {
          DEFAULT: "#F5B84B",   // secrets / defaults note
        },
        beam: {
          DEFAULT: "#38BDF8",   // sentinel accent (watchtower beam)
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      maxWidth: {
        content: "72rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(56,189,248,0.15), 0 0 60px -12px rgba(56,189,248,0.35)",
        passglow: "0 0 0 1px rgba(34,197,94,0.25), 0 0 50px -10px rgba(34,197,94,0.4)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "cursor-blink": {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "beam-drift": {
          "0%, 100%": { transform: "translate(0,0)", opacity: "0.5" },
          "50%": { transform: "translate(30px,-20px)", opacity: "0.8" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "cursor-blink": "cursor-blink 1.1s step-end infinite",
        "beam-drift": "beam-drift 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
