/* =========================================================
   weather.js — small Open-Meteo helper for planner.html
   Two free, key-less Open-Meteo endpoints:
     1. Geocoding API  — turns "Cox's Bazar" into lat/lon
     2. Forecast API   — turns lat/lon into current + 3-day weather
   ========================================================= */

const WEATHER_CODES = {
  0: ["Clear sky", "☀️"],
  1: ["Mostly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Foggy", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌦️"],
  61: ["Light rain", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌦️"],
  82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm", "⛈️"],
  99: ["Severe thunderstorm", "⛈️"],
};

function weatherCodeInfo(code) {
  return WEATHER_CODES[code] || ["Weather unavailable", "🌡️"];
}

/** Turns a place name into { lat, lon, label }. Returns null if nothing matched. */
async function geocodeDestination(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?name=" +
    encodeURIComponent(query) +
    "&count=1&language=en&format=json";

  const response = await fetch(url);
  if (!response.ok) throw new Error("Geocoding request failed");

  const data = await response.json();
  if (!data.results || data.results.length === 0) return null;

  const place = data.results[0];
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return {
    lat: place.latitude,
    lon: place.longitude,
    label: parts.join(", "),
  };
}

/** Fetches current weather + a 3-day outlook for a coordinate. */
async function fetchWeather(lat, lon) {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" +
    lat +
    "&longitude=" +
    lon +
    "&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3";

  const response = await fetch(url);
  if (!response.ok) throw new Error("Forecast request failed");
  return response.json();
}

function renderWeatherPlaceholder(message) {
  qs("#weatherBody").innerHTML = '<div class="weather-placeholder">' + message + "</div>";
}

function renderWeatherError(message) {
  qs("#weatherBody").innerHTML = '<div class="weather-placeholder">' + message + "</div>";
}

function renderWeather(weatherData, placeLabel) {
  const current = weatherData.current_weather;
  const [desc, icon] = weatherCodeInfo(current.weathercode);
  const days = weatherData.daily.time;

  let daysHtml = "";
  for (let i = 0; i < days.length; i++) {
    const dayDate = new Date(days[i] + "T00:00:00");
    const dayLabel = i === 0 ? "Today" : dayDate.toLocaleDateString(undefined, { weekday: "short" });
    const [, dIcon] = weatherCodeInfo(weatherData.daily.weathercode[i]);
    const hi = Math.round(weatherData.daily.temperature_2m_max[i]);
    const lo = Math.round(weatherData.daily.temperature_2m_min[i]);
    daysHtml +=
      '<div class="weather-day"><div class="wd-label">' +
      dayLabel +
      '</div><div class="wd-icon">' +
      dIcon +
      '</div><div class="wd-temp">' +
      hi +
      "° / " +
      lo +
      "°</div></div>";
  }

  qs("#weatherBody").innerHTML =
    '<div class="weather-current">' +
    '<div class="weather-icon">' + icon + "</div>" +
    "<div>" +
    '<div class="weather-temp">' + Math.round(current.temperature) + "°C</div>" +
    '<div class="weather-desc">' + desc + (placeLabel ? " in " + placeLabel : "") + "</div>" +
    "</div>" +
    "</div>" +
    '<div class="weather-days">' + daysHtml + "</div>";
}
