/* =========================================================
   storage.js
   STEP 2 UPDATE: User/session functions now delegate to
   Firebase Authentication. Tour data still uses localStorage
   for now (Steps 3–8 will migrate it to Firestore).

   WHAT CHANGED IN STEP 2
   - Removed: getUsers(), saveUsers(), findUserByEmail(),
     createUser() — Firebase Auth owns accounts now.
   - Changed: getSession() still reads from localStorage, but
     the stored value is now a lightweight snapshot written
     by syncSessionFromFirebase() after Firebase confirms auth,
     NOT a password-bearing user object.
   - Changed: clearSession() now also calls auth.signOut().
   - Added: syncSessionFromFirebase(firebaseUser) — call this
     after Firebase confirms a user is signed in; it writes
     the same shape that every other file already reads.
   - Unchanged: every tour function (getAllTours, upsertTour,
     deleteTour, etc.) — tours still live in localStorage.
   - Unchanged: startGuestSession() — guest path is unchanged.
   - Unchanged: generateId(), readJSON(), writeJSON() helpers.

   WHY localStorage FOR THE SESSION SNAPSHOT?
   All page JS files call getSession() synchronously at startup
   (requireAuth, initNavbar, home.js). Firebase Auth is async,
   so we cache the session object in localStorage after sign-in.
   Firebase remains the source of truth — if the token expires,
   onAuthStateChanged (in auth.js) clears the snapshot.
   ========================================================= */

const STORAGE_KEYS = {
  // "users" key removed — Firebase Auth owns accounts now
  session:  "tourmate_session",
  tours:    "tourmate_tours",
  profiles: "tourmate_profiles", // bio/gender/home address, keyed by ownerId (uid or "guest")
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

/* ---------- session ---------- */
/*
  The session object shape is the same as before so every
  existing consumer (dashboard.js, profile.js, planner.js,
  home.js, app.js) continues to work without any changes:

  {
    ownerId:  string,   // Firebase uid, or "guest"
    name:     string,   // displayName from Firebase
    email:    string,   // email from Firebase
    isGuest:  boolean
  }
*/

/** Read the cached session. Returns null when nobody is signed in. */
function getSession() {
  return readJSON(STORAGE_KEYS.session, null);
}

/** Internal — only called by syncSessionFromFirebase() and startGuestSession(). */
function setSession(session) {
  writeJSON(STORAGE_KEYS.session, session);
}

/**
 * Sign out of Firebase AND wipe the local cache.
 * Called by the logout button (app.js) and profile.js.
 * Returns a Promise so callers can await it before redirecting.
 */
function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
  // auth is the global Firebase Auth handle created in firebase-config.js
  return auth.signOut();
}

/**
 * Called right after Firebase confirms a real user is signed in.
 * Writes the lightweight session snapshot that the rest of the
 * app reads via getSession().
 *
 * @param {firebase.User} firebaseUser - the user object from onAuthStateChanged
 */
function syncSessionFromFirebase(firebaseUser) {
  setSession({
    ownerId: firebaseUser.uid,           // stable Firebase uid used as tour owner key
    name:    firebaseUser.displayName || firebaseUser.email.split("@")[0],
    email:   firebaseUser.email,
    isGuest: false,
  });
}

/** Guest path is unchanged — same object shape, same key. */
function startGuestSession() {
  setSession({ ownerId: "guest", name: "Guest", email: "", isGuest: true });
}

/**
 * Merge a patch (e.g. { name: "New Name" }) into the cached session and
 * write it back, so every page that reads getSession() (navbar, dashboard,
 * profile) sees the change immediately without a full reload.
 * Used by profile.js after a successful profile edit.
 */
function updateSessionFields(patch) {
  const session = getSession();
  if (!session) return null;

  const updated = Object.assign({}, session, patch);
  setSession(updated);
  return updated;
}

/* ---------- profile details: bio, gender, home address ---------- */
/*
  Firebase Auth's user object only holds displayName/email/photoURL — it
  has no room for bio, gender, or home address. Like tour data, these
  extra fields are kept in localStorage, keyed by ownerId (the Firebase
  uid for a real account, or "guest" for a guest session) — one object,
  same key, for every kind of session, so there's nothing extra to set
  up in Firebase for this to work.

  (An earlier version of this stored real accounts' details in Cloud
  Firestore. That meant a profile save could hang indefinitely if the
  Firestore database hadn't been created yet or its security rules
  weren't in place — so it moved to localStorage, matching how tour
  data already works.)

  Both functions return a Promise so profile.js can use one code path
  regardless of which kind of session is active.
*/

function getAllProfileExtras() {
  return readJSON(STORAGE_KEYS.profiles, {});
}

/** Fetch { bio, gender, homeAddress } for the given session. Never rejects. */
function loadProfileExtra(session) {
  if (!session) return Promise.resolve({});
  return Promise.resolve(getAllProfileExtras()[session.ownerId] || {});
}

/** Save { bio, gender, homeAddress } for the given session. Resolves with the saved data. */
function saveProfileExtra(session, data) {
  if (!session) return Promise.reject(new Error("No active session."));

  const all = getAllProfileExtras();
  all[session.ownerId] = data;
  writeJSON(STORAGE_KEYS.profiles, all);

  return Promise.resolve(data);
}

/**
 * Move all locally-saved guest tours to a newly-created Firebase account.
 * This lets a guest keep the trips they created after registering.
 *
 * Firebase Authentication creates the account before verification, but
 * the TourMate app does not allow that account into the app until the
 * email is verified. The transfer is local-only and does not expose data.
 */
function migrateGuestToursToOwner(ownerId) {
  if (!ownerId) return;

  const tours = getAllTours();
  let changed = false;

  tours.forEach(function (tour) {
    if (tour.ownerId === "guest") {
      tour.ownerId = ownerId;
      changed = true;
    }
  });

  if (changed) {
    saveAllTours(tours);
  }
}

/* ---------- tours (unchanged from original) ---------- */

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
    id:         null,   // assigned on first save
    ownerId:    ownerId,
    destination: "",
    lat:        null,
    lon:        null,
    placeLabel: "",
    startDate:  "",
    endDate:    "",
    budget:     0,
    notes:      "",
    expenses:   [],
    createdAt:  null,
    updatedAt:  null,
  };
}

/** Creates the tour if it has no id yet, otherwise overwrites it. Returns the saved tour. */
function upsertTour(tour) {
  const tours = getAllTours();
  const now   = new Date().toISOString();

  if (!tour.id) {
    tour.id        = generateId("tour");
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
