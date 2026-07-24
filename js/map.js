/* =========================================================
   map.js — small Leaflet + OpenStreetMap helper for planner.html
   Free map tiles, no API key needed.
   ========================================================= */

let tourMapInstance = null;
let tourMapMarker = null;

function initTourMap() {
  if (tourMapInstance || !document.getElementById("map")) return;

  tourMapInstance = L.map("map", {
    scrollWheelZoom: false,
  }).setView([20, 10], 2); // world view until a destination is set

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(tourMapInstance);
}

function updateTourMapLocation(lat, lon, label) {
  if (!tourMapInstance) return;

  tourMapInstance.setView([lat, lon], 10);

  if (tourMapMarker) {
    tourMapInstance.removeLayer(tourMapMarker);
  }
  tourMapMarker = L.marker([lat, lon]).addTo(tourMapInstance);
  if (label) {
    tourMapMarker.bindPopup(label).openPopup();
  }

  // Leaflet sometimes needs a nudge to redraw correctly inside a card that just became visible
  setTimeout(() => tourMapInstance.invalidateSize(), 200);
}
