/* =========================================================
   storage.js
   All localStorage reading/writing lives here. No DOM code.
   Keeping this separate means every other file just calls
   plain functions like getSession() or upsertTour(tour)
   instead of touching localStorage directly.

   NOTE ON SECURITY: this project has no backend/database, as
   required by the assignment (HTML/CSS/JS + localStorage
   only). Accounts are therefore stored in the browser only,
   and passwords are kept in plain text purely so the demo
   works end to end. This is fine for a local class project,
   but a real product would never do this — it would send
   credentials to a server and store a salted hash there.
   ========================================================= */

const STORAGE_KEYS = {
  users: "tourmate_users",
  session: "tourmate_session",
  tours: "tourmate_tours",
};

/* ---------- small helpers ---------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Could not read " + key + " from storage", err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Could not save " + key + " to storage", err);
  }
}

function generateId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/* ---------- users ---------- */

function getUsers() {
  return readJSON(STORAGE_KEYS.users, []);
}

function saveUsers(users) {
  writeJSON(STORAGE_KEYS.users, users);
}

function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  return getUsers().find((u) => u.email.toLowerCase() === normalized);
}

function createUser({ name, email, password }) {
  const users = getUsers();
  const user = {
    id: generateId("user"),
    name: name.trim(),
    email: email.trim(),
    password: password, // plain text — see note at top of file
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

/* ---------- session ---------- */

function getSession() {
  return readJSON(STORAGE_KEYS.session, null);
}

function setSession(session) {
  writeJSON(STORAGE_KEYS.session, session);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

function startGuestSession() {
  setSession({ ownerId: "guest", name: "Guest", email: "", isGuest: true });
}

function startUserSession(user) {
  setSession({
    ownerId: user.id,
    name: user.name,
    email: user.email,
    isGuest: false,
  });
}

/* ---------- tours ---------- */

function getAllTours() {
  return readJSON(STORAGE_KEYS.tours, []);
}

function saveAllTours(tours) {
  writeJSON(STORAGE_KEYS.tours, tours);
}

function getToursForOwner(ownerId) {
  return getAllTours()
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function getTourById(id) {
  return getAllTours().find((t) => t.id === id) || null;
}

function createBlankTour(ownerId) {
  return {
    id: null, // assigned on first save
    ownerId: ownerId,
    destination: "",
    lat: null,
    lon: null,
    placeLabel: "",
    startDate: "",
    endDate: "",
    budget: 0,
    notes: "",
    expenses: [],
    createdAt: null,
    updatedAt: null,
  };
}

/** Creates the tour if it has no id yet, otherwise overwrites it. Returns the saved tour (with its id). */
function upsertTour(tour) {
  const tours = getAllTours();
  const now = new Date().toISOString();

  if (!tour.id) {
    tour.id = generateId("tour");
    tour.createdAt = now;
    tour.updatedAt = now;
    tours.push(tour);
  } else {
    const index = tours.findIndex((t) => t.id === tour.id);
    tour.updatedAt = now;
    if (index === -1) {
      tours.push(tour);
    } else {
      tours[index] = tour;
    }
  }

  saveAllTours(tours);
  return tour;
}

function deleteTour(id) {
  const tours = getAllTours().filter((t) => t.id !== id);
  saveAllTours(tours);
}
