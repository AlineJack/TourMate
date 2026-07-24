# TourMate

A small tour-planning web app built for a university ISD project, using only **HTML, CSS, and JavaScript** (no framework, no backend).

## Pages

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero + short intro, links to log in, register, or continue as guest |
| Login / Register | `login.html` | One card, two tabs — log in or create an account — plus a guest option |
| Dashboard | `dashboard.html` | Welcome message, quick stats, and your saved tours as "luggage tag" cards |
| Tour Planner | `planner.html` | The main page: destination, dates, budget, expenses, notes, weather preview, map preview, and a live trip summary |
| Profile | `profile.html` | Name, email, saved plan count, and log out |

## How to run it

Because the weather and map features fetch data over the internet, the app needs to be opened with an internet connection. Two ways to run it:

1. **Simplest:** double-click `index.html` to open it in your browser.
2. **More reliable (recommended):** serve the folder with any static server, for example:
   - VS Code's "Live Server" extension, or
   - `npx serve .` from inside the `tourmate` folder

Either way works — a local server just avoids occasional browser restrictions on `file://` pages.

## How data is stored

There is no backend or database. Everything is saved in the browser's `localStorage`:

- `tourmate_users` — registered accounts (demo only — see note below)
- `tourmate_session` — who is currently signed in (a real user or a guest)
- `tourmate_tours` — every saved tour plan, each tagged with an owner

Because it's `localStorage`, data is local to one browser on one device. Clearing your browser's site data will reset the app.

**Note on accounts:** since this project intentionally has no server, passwords are stored in plain text in `localStorage` purely so sign-up/login can work end to end for the demo. A real product would send credentials to a server and store a salted hash there instead — never do this in production.

## Free APIs used

- **Map:** [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) tiles (via the `unpkg` CDN, no API key)
- **Weather:** [Open-Meteo](https://open-meteo.com/) — geocoding endpoint to turn a destination into coordinates, and the forecast endpoint for current + 3-day weather (no API key)

## File structure

```
tourmate/
├── index.html
├── login.html
├── dashboard.html
├── planner.html
├── profile.html
├── css/
│   └── style.css
└── js/
    ├── storage.js   — all localStorage reading/writing
    ├── app.js       — shared navbar, formatters, toast, route guards
    ├── home.js      — Home page logic
    ├── auth.js      — Login/Register logic
    ├── dashboard.js — Dashboard logic
    ├── planner.js   — Tour Planner logic (form, expenses, save/delete)
    ├── weather.js   — Open-Meteo geocoding + forecast
    └── map.js       — Leaflet map setup
```

## Scope

By design, this project does **not** include hotel/flight booking, payments, chat, an AI assistant, reviews, an admin panel, or social features — it's a focused tour-planning tool, not a travel marketplace.
