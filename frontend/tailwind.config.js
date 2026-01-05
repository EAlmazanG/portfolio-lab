/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#13ec5b",
        "background-light": "#f6f8f6",
        "background-dark": "#111813", 
        "surface-dark": "#1c271f",
        "border-dark": "#28392e",
        "border-active": "#3b5443",
        "text-secondary": "#9db9a6"
      },
      fontFamily: {
        "display": ["Manrope", "sans-serif"]
      },
    },
  },
  plugins: [],
};

