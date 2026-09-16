/* =========================================================
   storage.js
   Low-level primitives only: JSON read/write (hardened against
   corrupted data and full storage), ID generation, and the
   signed-in session cache. Tour, experience, profile, and
   settings data each have their own dedicated *-store.js file
   that builds on these — see tour-store.js, experience-store.js,
   profile-store.js, settings-store.js.
   ========================================================= */

/* ---------- small helpers ---------- */

/** Reads and parses JSON from localStorage. Corrupted or missing data safely falls back. */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    console.error("Could not read " + key + " from storage — using default.", err);
    return fallback;
  }
}

/**
 * Writes JSON to localStorage. Returns true on success, false on failure
 * (e.g. the browser's storage quota is full) so callers that need to know
 * — like publishing an experience with photos — can show a real error
 * instead of pretending the save worked.
 */
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error("Could not save " + key + " to storage", err);
    return false;
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
  The session object shape is the same everywhere so every
  consumer (dashboard.js, profile.js, planner.js, home.js,
  app.js) continues to work without any changes:

  {
    ownerId:  string,   // Firebase uid, or "guest"
    name:     string,   // displayName from Firebase, or locally edited
    email:    string,   // email from Firebase
    isGuest:  boolean
  }

  Firebase Authentication remains the source of truth for WHO is
  signed in (login, registration, email verification, guest mode
  are all preserved). This cached copy is what lets every page
  read "am I signed in, and as whom" synchronously and instantly,
  and is also what keeps the app usable if Firebase is briefly
  unreachable after the first sign-in.
*/

const SESSION_KEY = "tourmate_session";

/** Read the cached session. Returns null when nobody is signed in. */
function getSession() {
  return readJSON(SESSION_KEY, null);
}

/** Internal — only called by syncSessionFromFirebase() and startGuestSession(). */
function setSession(session) {
  writeJSON(SESSION_KEY, session);
}

/**
 * Sign out of Firebase AND wipe the local cache.
 * Called by the logout button (app.js) and profile.js.
 * Returns a Promise so callers can await it before redirecting.
 */
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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
 * Used by profile-store.js after a local profile save.
 */
function updateSessionFields(patch) {
  const session = getSession();
  if (!session) return null;

  const updated = Object.assign({}, session, patch);
  setSession(updated);
  return updated;
}
