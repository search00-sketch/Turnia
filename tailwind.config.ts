import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Magenta: sólo para acciones (reservar, guardar).
        brand: {
          50: "#fcf0f4",
          100: "#f8e3eb",
          200: "#f3c3d3",
          300: "#f3a6c1",
          400: "#e46d95",
          500: "#d63f71",
          600: "#c8255a",
          700: "#a81d4b",
          800: "#86193e",
          900: "#6c1734",
        },
        // Ciruela: tinta, encabezados y fondos destacados.
        plum: {
          50: "#f5f2f6",
          100: "#ece4ea",
          200: "#d9c9d4",
          300: "#b9a2b3",
          400: "#8d6f86",
          500: "#7d6577",
          600: "#5b3f55",
          700: "#4b2a47",
          800: "#3a2238",
          900: "#2a1830",
        },
        // Grises con un toque ciruela: reemplazan al gris genérico en toda la app.
        neutral: {
          50: "#f7f4f7",
          100: "#efe9ee",
          200: "#e3dae1",
          300: "#cdbfca",
          400: "#a3909e",
          500: "#7d6577",
          600: "#64505f",
          700: "#4d3a49",
          800: "#3a2a37",
          900: "#2a1830",
        },
        // Arena: superficies cálidas (ilustraciones, avisos).
        sand: {
          50: "#f6efe8",
          100: "#efe2d6",
          200: "#e9d6c7",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 0 rgba(42, 24, 48, 0.06), 0 2px 10px rgba(42, 24, 48, 0.05)",
        cardHover: "0 10px 26px rgba(42, 24, 48, 0.12)",
        cta: "0 6px 16px rgba(200, 37, 90, 0.28)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
