/* =========================================================
   profile-store.js
   Profile editing (name, bio, gender, home address) works
   entirely from localStorage now — saving a profile no longer
   calls auth.currentUser.updateProfile(), so it can't hang or
   fail because Firebase is unreachable. Firebase Auth still
   supplies the *account* (email, login) — this just stores the
   editable profile details next to it.
   ========================================================= */

const PROFILE_KEY = "tourmate_profile";
const OLD_PROFILE_KEY = "tourmate_profiles"; // pre-existing key name, kept for one-time migration

(function migrateOldProfileKeyOnce() {
  const hasNew = localStorage.getItem(PROFILE_KEY);
  const old = localStorage.getItem(OLD_PROFILE_KEY);
  if (!hasNew && old) {
    localStorage.setItem(PROFILE_KEY, old);
  }
})();

function getAllProfiles() {
  return readJSON(PROFILE_KEY, {});
}

function saveAllProfiles(all) {
  return writeJSON(PROFILE_KEY, all);
}

/** Returns { name, bio, gender, homeAddress } for the given session — never rejects. */
function getProfile(session) {
  if (!session) return { name: "", bio: "", gender: "", homeAddress: "" };
  const stored = getAllProfiles()[session.ownerId] || {};
  return {
    name: stored.name || session.name || "",
    bio: stored.bio || "",
    gender: stored.gender || "",
    homeAddress: stored.homeAddress || "",
  };
}

/**
 * Saves { name, bio, gender, homeAddress } for the given session, purely
 * locally. If the name changed, also refreshes the cached session
 * (storage.js's updateSessionFields) so the navbar updates immediately —
 * no Firebase call involved either way.
 */
function saveProfile(session, data) {
  if (!session) return Promise.reject(new Error("No active session."));

  const all = getAllProfiles();
  all[session.ownerId] = {
    name: data.name || "",
    bio: data.bio || "",
    gender: data.gender || "",
    homeAddress: data.homeAddress || "",
  };
  const ok = saveAllProfiles(all);
  if (!ok) return Promise.reject(new Error("Could not save — your browser's local storage may be full."));

  if (data.name && data.name !== session.name) {
    updateSessionFields({ name: data.name });
  }

  return Promise.resolve(all[session.ownerId]);
}
