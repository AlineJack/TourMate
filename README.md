# TourMate

A tour-planning and travel-discovery web app, using only **HTML, CSS, and JavaScript**.

## Current phase: local-storage-first

TourMate is being built in two phases:

- **Current phase (this codebase):** every application feature — tours, checklists, Traveler Experiences, profile, theme, sharing, and the admin workspace — is handled locally by the browser's `localStorage`.
- **Firebase Authentication is the identity layer:** registration, email verification, login, and guest mode still use real Firebase Auth. No password is stored in localStorage.
- **Future phase:** Firestore/Storage can later replace the local stores for true cross-device data, live collaboration, and server-enforced admin roles. The older Firestore/Storage code is kept only as migration material.

## Pages

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero + short intro, links to log in, register, or continue as guest |
| Login / Register | `login.html` | One card, two tabs — log in or create an account — plus a guest option |
| Dashboard | `dashboard.html` | Quick stats, your saved tours, Popular Destinations, travel inspiration, and popular traveler experiences |
| Tour Planner | `planner.html` | Destination, dates, travelers, currency, budget (with per-person math), expenses, checklist, notes, weather/map preview, and Share/Invite |
| Explore | `explore.html` | Search or browse TourMate's curated destinations by category |
| Destination | `destination.html?id=` | One destination's guide info — image, description, budget/duration, things to do, pros/cons — plus related Traveler Experiences and "Plan this trip" |
| Guide | `guide.html` | A rule-based assistant — quick-pick chips or free text, matched against the destination dataset (no paid AI) |
| Experiences | `experiences.html` | Browse Traveler Experiences — All / Recent / Popular, with free-text destination search |
| Share an experience | `experience-form.html` | Post a Traveler Experience for **any** destination (free text) — cost, places, tips, optional day-by-day, optional photos. Requires a real account (not a guest) |
| Experience detail | `experience.html?id=` | Full write-up of one traveler's trip, with Helpful / Save / "Use this trip" |
| Checklist | `checklist.html` | Pick a trip and manage its packing checklist (same data as the Planner's Checklist card) |
| Join a trip | `join.html?invite=` | Opens a Share/Invite link and imports a local copy of that trip (see "Sharing" below) |
| Profile | `profile.html` | Name, email, bio, gender, home address, saved plan count, editing, and log out |
| Admin | `admin.html` | Admin-only local dashboard — see "Admin access" below |

## How to run it

Because the weather, map and font features fetch data over the internet, an internet connection is needed for those specific extras — the rest of the app (tours, experiences, checklist, profile, theme, admin) works fully offline once the page has loaded. Two ways to run it:

1. **Simplest:** double-click `index.html` to open it in your browser.
2. **More reliable (recommended):** serve the folder with any static server, for example:
   - VS Code's "Live Server" extension, or
   - `npx serve .` from inside the `tourmate` folder

## How data is stored

Firebase Authentication supplies the account itself (email, login state, guest mode). Everything else lives in `localStorage`, organized into a few small, single-purpose files instead of one giant storage blob:

- `js/storage.js` — low-level primitives only: safe JSON read/write (corrupted data and full storage both fail gracefully instead of crashing the page), ID generation, and the signed-in session cache
- `js/tour-store.js` — tours, the checklist that rides on each tour, currency/budget math, and the Share/Invite prototype
- `js/experience-store.js` — Traveler Experiences: CRUD, search/sort, Helpful/Save, sample-data seeding, and photo compression tuned for `localStorage`'s small quota
- `js/profile-store.js` — name/bio/gender/home address
- `js/settings-store.js` — the light/dark theme choice

Keys used: `tourmate_session`, `tourmate_tours`, `tourmate_experiences`, `tourmate_saved_experiences`, `tourmate_helpful_marks`, `tourmate_profile`, `tourmate_theme`. All of this is local to one browser on one device — there is no cross-device sync in this phase.

**On accounts:** registration and login go through real Firebase Authentication, so no password is ever stored by this app, in `localStorage` or anywhere else — Firebase handles that entirely.

## Currency

Every tour has its own currency (BDT, USD, INR, or CNY — BDT by default). There is exactly **one** money formatter in the app (`formatCurrency()` in `js/tour-store.js`); nothing hardcodes a `$` sign anymore. Currency selection is display-only in this phase — there are no live exchange rates, so amounts in different currencies are shown side by side rather than converted.

## Sharing a trip (local-first collaboration)

The Planner's **Share / Invite** button first saves the latest trip state, then creates a link containing a snapshot plus a stable `sharedTripId`.

When a friend opens the link and joins:

1. They get an editable local TourMate trip with the same `sharedTripId`.
2. On the same browser/device, the shared record can be reused by another signed-in account.
3. Across different devices, browser `localStorage` cannot provide live sync. The practical prototype workflow is to share the **latest link again** after edits; the recipient can choose **Update my local copy**.

This gives the university project a clear collaboration concept without pretending that localStorage is a backend. True live multi-device editing requires Firestore or another shared database later.

## Admin access

`admin.html` is restricted to configured administrator accounts. Normal users and guests do not see the Admin navigation item and are redirected to the Dashboard if they try to open the page directly.

Admin access is configured in `js/roles.js` using either Firebase Auth UID(s) or exact email address(es):

```js
const ADMIN_UIDS = [
  "PASTE_YOUR_FIREBASE_UID_HERE"
];

const ADMIN_EMAILS = [
  "admin@example.com"
];
```

For the project demo, configure the one account you will use as the TourMate administrator. This is still frontend-only role gating in the local-first phase; it is not a security boundary because browser code can be modified. Later, Firebase custom claims/security rules should enforce the role server-side.

The Admin workspace shows local tour/experience/profile statistics, experience moderation controls, the local tour list, and the destination catalog.

## Sample data

`experience-store.js` seeds six realistic sample Traveler Experiences (Sajek, Sylhet, Bandarban, Cox's Bazar, Sreemangal, and Tanguar Haor) the first time the experience list is empty, tagged `isSample: true`, so Experiences never looks empty for a first-time visitor. They're never re-seeded once any experience exists.

## Free APIs used

- **Map:** [Leaflet](https://leafletjs.com/) for the map, markers and interaction, with the base map drawn from [OpenFreeMap](https://openfreemap.org/) vector tiles via [MapLibre GL](https://maplibre.org/) (all from the `unpkg` CDN).

  **No configuration is required.** OpenFreeMap needs no API key, no account, no registration and no billing — the tile URL is hard-coded in `js/map.js` and works as-is on GitHub Pages. Map data is still OpenStreetMap; OpenFreeMap just hosts the tiles. If a device has no WebGL, `map.js` automatically falls back to OpenStreetMap raster tiles.

  > We moved off OpenStreetMap's own public tile server because it returned *"Access blocked for not following the tile usage policy"*. OSM's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) asks third-party apps to use another tile source, which is exactly what OpenFreeMap is for.
- **Weather:** [Open-Meteo](https://open-meteo.com/) — geocoding + forecast, no API key
- **Destinations:** a small hand-written TourMate dataset (`js/destinations.js`) — no external API, no cost

## File structure

```
tourmate/
├── index.html, login.html, dashboard.html, planner.html, profile.html
├── explore.html, destination.html, guide.html
├── experiences.html, experience-form.html, experience.html
├── checklist.html, join.html, admin.html
├── firestore.rules, storage.rules      — unused in this phase, kept for the future Firebase migration
├── css/style.css
└── js/
    ├── storage.js             — low-level localStorage primitives + session
    ├── tour-store.js          — tours, checklist, currency/budget math, invite prototype
    ├── experience-store.js    — Traveler Experiences (fully local for this phase)
    ├── profile-store.js       — profile data
    ├── settings-store.js      — theme
    ├── app.js                 — shared navbar, theme toggle, formatters, toast, route guards, shared card renderers
    ├── destinations.js        — curated destination dataset + lookup/search helpers
    ├── home.js, auth.js       — Home and Login/Register logic (Firebase Auth)
    ├── dashboard.js, planner.js, profile.js, checklist.js
    ├── explore.js, destination.js, guide.js
    ├── experiences.js, experience-form.js, experience-detail.js
    ├── join.js, admin.js
    ├── weather.js, map.js     — Open-Meteo + Leaflet/OpenFreeMap
    └── experiences-data.js    — dormant Firestore/Storage code, kept for the future migration; not loaded by any page
```

## Scope

TourMate stays a focused travel-planning and discovery companion — not a travel marketplace. It intentionally does **not** include hotel/flight booking, payments, a marketplace, real-time collaboration, secure production admin auth, an AI chatbot, follower/following systems, comments, notifications, or complex analytics. Traveler Experiences stay lightweight (Helpful/Save, no comments), the Guide is plain keyword matching against a static dataset, and the Share/Invite and Admin features are explicitly local prototypes rather than finished multi-user systems.
