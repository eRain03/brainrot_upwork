/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#FF9500",
        "primary-dark": "#E68600",
        "background-light": "#FFF7EB",
        "background-dark": "#18181b",
        "surface-light": "#FFFFFF",
        "surface-dark": "#27272a",
        "secondary-surface-light": "#FFEDD5",
        "secondary-surface-dark": "#3f3f46",
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        'xl': "1rem",
        '2xl': "1.5rem",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
