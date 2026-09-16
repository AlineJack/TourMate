/* =========================================================
   map.js — Leaflet base map for planner.html

   MAP PROVIDER: OpenFreeMap (OpenStreetMap data), with the
   OpenStreetMap standard raster tiles kept as a fallback.

   WHY WE MOVED OFF THE OSM PUBLIC TILE SERVER
   TourMate's tiles came back stamped "Access blocked for not
   following the tile usage policy". That is OSM's *general*
   block, not the "Referer is required" one — it does not clear
   itself, and OSM's policy is explicit that third-party apps
   making regular use of the volunteer servers should move to
   another tile source. So the base layer now comes from
   OpenFreeMap, which exists specifically to serve this case:
   free, no registration, no API key, no usage limits, and the
   map data is still OpenStreetMap. Nothing here needs a key,
   an account, a credit card, or any billing setup.

   WHY VECTOR TILES / MapLibre
   The keyless tile services left in 2026 serve vector tiles,
   so the base layer is drawn by MapLibre GL. It is wrapped by
   maplibre-gl-leaflet and added as an ordinary Leaflet layer
   in the tile pane, which means the rest of TourMate is
   untouched: this is still a normal L.map, markers, popups,
   zoom, pan and every planner.js call work exactly as before.
   Leaflet keeps ownership of all interaction (the GL layer is
   non-interactive), so there is one set of gestures, not two.

   FALLBACK
   If WebGL is unavailable (older phones, blocked GPU) or the
   GL libraries fail to load, we fall back to the OSM raster
   tile layer rather than showing nothing. That path keeps the
   referrerPolicy required by OSM's tile policy.

   OTHER NOTES
   - Normal interactive loading only: only what is on screen.
     No prefetching, no bulk/offline downloading, no polling.
   - One map instance per page; initTourMap() is idempotent.
   ========================================================= */

/* Provider chain, tried in order. Everything here is keyless. */
const TOUR_MAP_PROVIDERS = [
  {
    id: "openfreemap",
    kind: "vector",
    label: "OpenFreeMap",
    style: "https://tiles.openfreemap.org/styles/liberty",
    // OpenFreeMap asks for this exact credit; OSM is credited as the data source.
    attribution:
      '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
      '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
      'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  },
  {
    id: "osm",
    kind: "raster",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    // OSM's tile policy requires tile requests to carry a Referer.
    referrerPolicy: "strict-origin-when-cross-origin",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  },
];

let tourMapInstance = null;
let tourMapMarker = null;
let tourMapBaseLayer = null;
let tourMapProviderIndex = 0;
let tourMapTileErrorCount = 0;
let tourMapHasLoadedTile = false;
let tourMapBlocked = false; // set when a provider is known to be refusing us
let tourMapFailTimer = null;
let tourMapLastLocation = null; // { lat, lon, label } — reapplied after a manual retry

/** MapLibre needs WebGL; some older/locked-down devices don't have it. */
function tourMapSupportsWebGL() {
  try {
    if (typeof window.maplibregl === "undefined" || typeof L.maplibreGL !== "function") return false;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch (err) {
    return false;
  }
}

function initTourMap() {
  try {
    const mapEl = document.getElementById("map");
    // Idempotent on purpose: planner.js calls this once, but a second call
    // (re-entry, future page change) must not create a second map instance.
    if (!mapEl || tourMapInstance) return;

    if (typeof window.L === "undefined") {
      showMapMessage(mapEl, "The map library could not load. Check your internet connection and reload the page.", true, false);
      return;
    }

    tourMapInstance = L.map(mapEl, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([20, 10], 2);

    tourMapHasLoadedTile = false;
    tourMapBlocked = false;
    // Skip the vector provider outright when WebGL isn't available, rather
    // than letting it fail and time out first.
    attachTourMapBaseLayer(mapEl, tourMapSupportsWebGL() ? 0 : 1);

    // Leaflet can initialize before a responsive grid/card has its final size.
    const refresh = () => safeInvalidateTourMap();
    setTimeout(refresh, 0);
    setTimeout(refresh, 250);
    window.addEventListener("resize", refresh);

    // Future-proofing: if the map card ever ends up inside a tab, modal,
    // or other container that starts hidden or animates open, Leaflet's
    // cached size is wrong until the moment it becomes visible/resizes.
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => safeInvalidateTourMap());
      resizeObserver.observe(mapEl);
    }
    if (typeof IntersectionObserver !== "undefined") {
      const visibilityObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) safeInvalidateTourMap();
      });
      visibilityObserver.observe(mapEl);
    }

    // Safety net: some network blocks never fire an error event at all
    // (they just hang). If nothing has rendered within 10s, move on
    // instead of leaving a grey box that "loads" forever.
    armTourMapFailTimer(mapEl);
  } catch (err) {
    console.error("Map initialization failed:", err);
    const mapEl = document.getElementById("map");
    if (mapEl) {
      showMapMessage(mapEl, "The map couldn't be shown right now. The rest of the planner still works normally.", true, true);
    }
    tourMapInstance = null;
  }
}

function armTourMapFailTimer(mapEl) {
  clearTimeout(tourMapFailTimer);
  tourMapFailTimer = setTimeout(() => {
    if (!tourMapHasLoadedTile) handleTourMapProviderFailure(mapEl, "timed out waiting for map tiles");
  }, 10000);
}

function attachTourMapBaseLayer(mapEl, providerIndex) {
  const provider = TOUR_MAP_PROVIDERS[providerIndex];
  if (!provider) {
    handleTourMapFinalFailure(mapEl);
    return;
  }

  tourMapProviderIndex = providerIndex;
  tourMapTileErrorCount = 0;

  if (tourMapBaseLayer && tourMapInstance) {
    tourMapInstance.removeLayer(tourMapBaseLayer);
    tourMapBaseLayer = null;
  }

  tourMapBaseLayer =
    provider.kind === "vector"
      ? buildTourMapVectorLayer(mapEl, provider)
      : buildTourMapRasterLayer(mapEl, provider);

  if (!tourMapBaseLayer) {
    handleTourMapProviderFailure(mapEl, provider.label + " could not be initialized");
    return;
  }

  tourMapBaseLayer.addTo(tourMapInstance);
}

/** OpenFreeMap vector tiles, drawn by MapLibre GL inside a Leaflet layer. */
function buildTourMapVectorLayer(mapEl, provider) {
  try {
    const layer = L.maplibreGL({
      style: provider.style,
      attribution: provider.attribution,
      interactive: false, // Leaflet keeps ownership of zoom/pan/touch
    });

    // maplibre-gl-leaflet extends a bare L.Layer, which has no
    // getAttribution, so Leaflet's attribution control would skip it and
    // the required OpenFreeMap/OpenMapTiles/OSM credit would never show.
    // Defining it here is the idiomatic fix and makes the credit appear
    // and disappear automatically as the layer is added or removed.
    layer.getAttribution = function () {
      return provider.attribution;
    };

    // The GL map only exists once the layer has been added, so hook it then.
    layer.once("add", () => {
      let glMap = null;
      try {
        glMap = layer.getMaplibreMap();
      } catch (err) {
        return;
      }
      if (!glMap) return;

      glMap.on("load", () => {
        tourMapHasLoadedTile = true;
        clearTimeout(tourMapFailTimer);
        mapEl.classList.remove("map-load-error");
        safeInvalidateTourMap();
      });

      glMap.on("error", (e) => {
        // MapLibre reports per-tile hiccups here too, so only treat a
        // sustained failure with nothing drawn as a provider outage.
        if (tourMapHasLoadedTile) return;
        tourMapTileErrorCount += 1;
        if (tourMapTileErrorCount >= 4) {
          handleTourMapProviderFailure(mapEl, provider.label + " tiles failed to load");
        }
      });
    });

    return layer;
  } catch (err) {
    console.error("Could not create the vector base layer:", err);
    return null;
  }
}

/** OpenStreetMap raster tiles — fallback only. */
function buildTourMapRasterLayer(mapEl, provider) {
  try {
    const layer = L.tileLayer(provider.url, {
      maxZoom: provider.maxZoom,
      referrerPolicy: provider.referrerPolicy,
      attribution: provider.attribution,
    });

    layer.on("tileload", () => {
      tourMapHasLoadedTile = true;
      clearTimeout(tourMapFailTimer);
      // A blocked tile is still a successful image load, so "a tile loaded"
      // is not proof the map is healthy. Once the probe says we're blocked,
      // don't let these events clear the error state.
      if (!tourMapBlocked) mapEl.classList.remove("map-load-error");
    });

    layer.on("tileerror", () => {
      tourMapTileErrorCount += 1;
      if (!tourMapHasLoadedTile && tourMapTileErrorCount >= 6) {
        handleTourMapProviderFailure(mapEl, provider.label + " tiles failed to load");
      }
    });

    probeTourMapAccess(mapEl, provider);
    return layer;
  } catch (err) {
    console.error("Could not create the raster base layer:", err);
    return null;
  }
}

/* A blocked OSM tile is not a failed request as far as the browser is
   concerned: OSM answers 403 with a real PNG that says "Access blocked".
   An <img> fires `load` for that, never `error`, so tileerror never fires
   and the map sits there showing notice tiles with nothing reported. One
   cheap probe turns that silent state into an accurate message.
   Diagnostics only — any failure here (CORS, offline, ad-blocker) is
   ignored so it can never make the map worse than it already is. */
function probeTourMapAccess(mapEl, provider) {
  if (typeof fetch !== "function" || provider.kind !== "raster") return;
  const probeUrl = provider.url.replace("{z}", "2").replace("{x}", "2").replace("{y}", "1");
  fetch(probeUrl, { method: "GET", cache: "force-cache", referrerPolicy: provider.referrerPolicy })
    .then((res) => {
      if (res.status === 403 || res.status === 429) {
        tourMapBlocked = true;
        console.warn("TourMate map: " + provider.label + " returned " + res.status + " for a tile request.");
        showMapMessage(
          mapEl,
          provider.label + " is currently refusing tile requests from this site (HTTP " + res.status + ").",
          true,
          true
        );
      }
    })
    .catch(() => {
      /* ignored on purpose — see comment above */
    });
}

function handleTourMapProviderFailure(mapEl, reason) {
  if (tourMapHasLoadedTile) return; // already recovered, nothing to do
  const nextIndex = tourMapProviderIndex + 1;
  if (nextIndex < TOUR_MAP_PROVIDERS.length) {
    console.warn("TourMate map: " + reason + " — falling back to " + TOUR_MAP_PROVIDERS[nextIndex].label + ".");
    attachTourMapBaseLayer(mapEl, nextIndex);
    armTourMapFailTimer(mapEl);
  } else {
    console.warn("TourMate map: " + reason + ".");
    handleTourMapFinalFailure(mapEl);
  }
}

function handleTourMapFinalFailure(mapEl) {
  clearTimeout(tourMapFailTimer);
  showMapMessage(
    mapEl,
    "Map tiles could not be loaded. Check your internet connection or any browser/network blocking rules, then retry.",
    true,
    true
  );
}

function showMapMessage(mapEl, text, isError, showRetry) {
  if (isError) mapEl.classList.add("map-load-error");
  const caption = document.getElementById("mapCaption");
  if (!caption) return;

  // Rebuilt from scratch each time: the probe and the load timeout can both
  // report, and appending blindly used to stack duplicate Retry buttons.
  caption.textContent = text;
  if (showRetry) {
    caption.appendChild(document.createTextNode(" "));
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "map-retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", retryTourMap);
    caption.appendChild(retryBtn);
  }
}

/** Fully re-initializes the map (used by the Retry button after a final failure). */
function retryTourMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  try {
    if (tourMapInstance) {
      tourMapInstance.remove();
    }
  } catch (err) {
    console.error("Could not tear down previous map instance:", err);
  }

  clearTimeout(tourMapFailTimer);
  tourMapInstance = null;
  tourMapMarker = null;
  tourMapBaseLayer = null;
  tourMapProviderIndex = 0;
  tourMapTileErrorCount = 0;
  tourMapHasLoadedTile = false;
  tourMapBlocked = false;
  mapEl.classList.remove("map-load-error");
  mapEl.innerHTML = "";

  initTourMap();

  if (tourMapLastLocation) {
    updateTourMapLocation(tourMapLastLocation.lat, tourMapLastLocation.lon, tourMapLastLocation.label);
  }
}

function safeInvalidateTourMap() {
  try {
    if (tourMapInstance) tourMapInstance.invalidateSize(false);
  } catch (err) {
    console.error("Map invalidateSize failed:", err);
  }
}

function updateTourMapLocation(lat, lon, label) {
  try {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    tourMapLastLocation = { lat: latitude, lon: longitude, label: label || "" };

    if (!tourMapInstance) return; // map failed to init — weather/other features still work

    tourMapInstance.invalidateSize(false);
    tourMapInstance.setView([latitude, longitude], 10, { animate: true });

    if (tourMapMarker) {
      tourMapInstance.removeLayer(tourMapMarker);
    }

    tourMapMarker = L.marker([latitude, longitude]).addTo(tourMapInstance);
    if (label) {
      tourMapMarker.bindPopup(escapeHtml(label)).openPopup();
    }

    setTimeout(() => safeInvalidateTourMap(), 150);
  } catch (err) {
    console.error("Could not update the map location:", err);
  }
}
