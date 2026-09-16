/* =========================================================
   settings-store.js
   The one place that reads/writes the theme setting. The
   navbar toggle (app.js) and the early inline snippet in each
   page's <head> both go through the same "tourmate_theme" key
   via this file, so there's exactly one source of truth.
   ========================================================= */

const THEME_KEY = "tourmate_theme";

function getTheme() {
  const value = localStorage.getItem(THEME_KEY);
  return value === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, value);
  document.documentElement.setAttribute("data-theme", value);
  return value;
}
