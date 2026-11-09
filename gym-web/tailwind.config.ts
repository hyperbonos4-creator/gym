import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta GYM — base oscura + acento eléctrico (cian → violeta), energía lima.
        gym: {
          black: "#05070D",
          navy: "#0A0F1C",
          panel: "#0E1424",
          border: "#1E2A44",
          primary: "#38BDF8", // cian
          primaryDeep: "#2563EB",
          violet: "#7C3AED",
          accent: "#A3E635", // lima (energía / activo)
          silver: "#E8EEFC",
          muted: "#8B9AC0",
        },
        status: {
          ok: "#22E0A1",
          warn: "#FFB02E",
          err: "#FF4D6D",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(56, 189, 248, 0.35)",
        "glow-strong": "0 0 30px rgba(124, 58, 237, 0.55)",
        panel: "0 8px 40px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "gym-radial":
          "radial-gradient(circle at 30% 20%, rgba(56,189,248,0.10), transparent 45%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.14), transparent 42%)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.15)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        brandFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        brandGlow: {
          "0%, 100%": { filter: "drop-shadow(0 0 18px rgba(56,189,248,0.22))" },
          "50%": { filter: "drop-shadow(0 0 36px rgba(167,139,250,0.45))" },
        },
        brandShine: {
          "0%, 18%": { transform: "translateX(-130%)" },
          "52%, 100%": { transform: "translateX(130%)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        fadeUp: "fadeUp 0.35s ease-out",
        brandFloat: "brandFloat 5.5s ease-in-out infinite",
        brandGlow: "brandGlow 3.6s ease-in-out infinite",
        brandShine: "brandShine 4.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
