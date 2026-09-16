/* =========================================================
   tour-store.js
   Everything about tour data lives here: CRUD, the checklist
   that rides on each tour, budget math, and the local
   invite/share prototype. Depends only on storage.js's
   readJSON/writeJSON/generateId — no Firebase, ever.
   ========================================================= */

const TOUR_KEY = "tourmate_tours";
const DEFAULT_CURRENCY = "BDT";

const CURRENCIES = {
  BDT: { symbol: "৳", label: "BDT — Bangladeshi Taka" },
  USD: { symbol: "$", label: "USD — US Dollar" },
  INR: { symbol: "₹", label: "INR — Indian Rupee" },
  CNY: { symbol: "¥", label: "CNY — Chinese Yuan" },
};

/* ---------- backward compatibility ----------
   Old tours saved before travelers/currency/members/checklist
   existed are missing those fields. Every read goes through
   this, so no page has to remember to guard against it itself.
*/
function normalizeTour(tour) {
  if (!tour) return tour;
  if (tour.currency == null) tour.currency = DEFAULT_CURRENCY;
  if (tour.travelers == null || tour.travelers < 1) tour.travelers = 1;
  if (!Array.isArray(tour.checklist)) tour.checklist = [];
  if (!Array.isArray(tour.expenses)) tour.expenses = [];
  if (!tour.inviteToken) tour.inviteToken = null;
  if (!tour.sharedTripId) tour.sharedTripId = null;
  if (!tour.ownerName) tour.ownerName = null;
  if (!tour.sharedMode) tour.sharedMode = "private";
  if (!Array.isArray(tour.members)) tour.members = [];
  if (!tour.updatedAt) tour.updatedAt = tour.createdAt || new Date().toISOString();
  if (!tour.createdAt) tour.createdAt = tour.updatedAt;
  // Simple revision counter used by the share/invite conflict check below —
  // tours saved before this existed just start at 1, same as a brand-new trip.
  if (!Number.isFinite(tour.revision) || tour.revision < 1) tour.revision = 1;
  return tour;
}

function getAllTours() {
  return readJSON(TOUR_KEY, []).map(normalizeTour);
}

function saveAllTours(tours) {
  return writeJSON(TOUR_KEY, tours);
}

function getToursForOwner(ownerId) {
  return getAllTours()
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function getTourById(id) {
  return getAllTours().find((t) => t.id === id) || null;
}

function canEditTour(session, tour) {
  if (!session || !tour) return false;
  if (tour.ownerId === session.ownerId) return true;
  if (Array.isArray(tour.members) && tour.members.some((member) => member.ownerId === session.ownerId)) return true;
  // Configured admins (js/roles.js) can open and manage any local trip from
  // the Admin dashboard's "View" link — see admin.html/admin.js.
  return typeof isAdminSession === "function" && isAdminSession(session);
}

function getSharedTourForSession(sharedTripId, ownerId) {
  if (!sharedTripId || !ownerId) return null;
  return getAllTours().find((tour) =>
    tour.sharedTripId === sharedTripId &&
    (tour.ownerId === ownerId || (tour.members || []).some((member) => member.ownerId === ownerId))
  ) || null;
}

function createBlankTour(ownerId) {
  return normalizeTour({
    id: null, // assigned on first save
    ownerId: ownerId,
    destination: "",
    lat: null,
    lon: null,
    placeLabel: "",
    startDate: "",
    endDate: "",
    budget: 0,
    currency: DEFAULT_CURRENCY,
    travelers: 1,
    notes: "",
    expenses: [],
    checklist: [], // { id, text, checked } — see createChecklistItem()
    owner: ownerId,
    ownerName: null,
    members: [],
    sharedTripId: null,
    sharedMode: "private",
    inviteToken: null,
    revision: 1,
    createdAt: null,
    updatedAt: null,
  });
}

function getChecklist(tour) {
  return (tour && tour.checklist) || [];
}

function createChecklistItem(text) {
  return { id: generateId("chk"), text: text, checked: false };
}

/** Creates the tour if it has no id yet, otherwise overwrites it. Returns the saved tour. */
function upsertTour(tour) {
  normalizeTour(tour);
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

/** Move every guest-owned tour to a newly-created account (after registration). */
function migrateGuestToursToOwner(ownerId) {
  if (!ownerId) return;
  const tours = getAllTours();
  let changed = false;

  tours.forEach((tour) => {
    if (tour.ownerId === "guest") {
      tour.ownerId = ownerId;
      tour.owner = ownerId;
      changed = true;
    }
  });

  if (changed) saveAllTours(tours);
}

/* ---------- currency ---------- */

function getCurrencySymbol(code) {
  return (CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY]).symbol;
}

function getCurrencyOptions() {
  return Object.keys(CURRENCIES).map((code) => ({ code: code, label: CURRENCIES[code].label }));
}

/**
 * The ONE money formatter for the whole app — replaces the old
 * mixed "$"/৳ formatting. Display-only: no live exchange rates.
 */
function formatCurrency(amount, currencyCode) {
  const value = Number(amount) || 0;
  const symbol = getCurrencySymbol(currencyCode || DEFAULT_CURRENCY);
  return symbol + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/* ---------- budget math (PART 12C) ---------- */

/**
 * Returns { totalBudget, totalSpent, travelers, perPersonBudget,
 * perPersonSpent, remaining, remainingPerPerson }, all safe against
 * divide-by-zero (travelers is always normalized to >= 1).
 */
function computeBudgetSummary(tour) {
  const travelers = Math.max(1, Number(tour.travelers) || 1);
  const totalBudget = Number(tour.budget) || 0;
  const totalSpent = (tour.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = totalBudget - totalSpent;

  return {
    totalBudget: totalBudget,
    totalSpent: totalSpent,
    travelers: travelers,
    perPersonBudget: totalBudget / travelers,
    perPersonSpent: totalSpent / travelers,
    remaining: remaining,
    remainingPerPerson: remaining / travelers,
  };
}

/* ---------- sharing / invite prototype (PART 14) ----------
   IMPORTANT: this is a LOCAL-ONLY prototype. localStorage cannot
   sync across devices, so the "invite link" carries a snapshot of
   the trip encoded right in the URL — opening it (on this browser
   or another) imports a separate local COPY, not a live shared
   trip. No real-time collaboration is implied or attempted here;
   that is future Firebase-phase work.
*/

function generateInviteToken() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

function buildInviteSnapshot(tour) {
  return {
    version: 2,
    token: tour.inviteToken,
    sharedTripId: tour.sharedTripId,
    ownerId: tour.ownerId,
    ownerName: tour.ownerName || "Trip owner",
    destination: tour.destination,
    startDate: tour.startDate,
    endDate: tour.endDate,
    budget: tour.budget,
    currency: tour.currency,
    travelers: tour.travelers,
    notes: tour.notes,
    expenses: tour.expenses || [],
    checklist: tour.checklist || [],
    lat: tour.lat,
    lon: tour.lon,
    placeLabel: tour.placeLabel || "",
    members: tour.members || [],
    createdAt: tour.createdAt || tour.updatedAt || new Date().toISOString(),
    updatedAt: tour.updatedAt || new Date().toISOString(),
    // Simple local revision counter (1, 2, 3…), bumped on every save in
    // planner.js. Lets a recipient tell whether a link is ahead of or
    // behind whatever local copy they already have — see
    // getInviteConflictStatus() below.
    revision: Number(tour.revision) || 1,
  };
}

/**
 * Ensures the trip has a stable shared identity, then builds a link that
 * carries the current editable snapshot. It is a local-first collaboration
 * link: no server/database is involved.
 */
function buildInviteLink(tour) {
  if (!tour.inviteToken) tour.inviteToken = generateInviteToken();
  if (!tour.sharedTripId) tour.sharedTripId = "shared_" + generateInviteToken();
  tour.sharedMode = "shared";
  upsertTour(tour);

  const raw = btoa(encodeURIComponent(JSON.stringify(buildInviteSnapshot(tour))));
  const encoded = raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return new URL("join.html?invite=" + encoded, window.location.href).href;
}

/** Decodes an invite payload from the URL. Returns null if it is missing/corrupted. */
function decodeInvitePayload(encoded) {
  if (!encoded) return null;
  try {
    const normalized = String(encoded).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(decodeURIComponent(atob(padded)));
    if (!payload || typeof payload !== "object") return null;
    if (!payload.sharedTripId && payload.token) payload.sharedTripId = payload.token;
    return payload;
  } catch (err) {
    console.error("Could not read invite link:", err);
    return null;
  }
}

function copyInviteIntoTour(tour, payload, memberName, memberOwnerId) {
  tour.destination = payload.destination || "";
  tour.startDate = payload.startDate || "";
  tour.endDate = payload.endDate || "";
  tour.budget = Number(payload.budget) || 0;
  tour.currency = payload.currency || DEFAULT_CURRENCY;
  tour.travelers = Math.max(1, Number(payload.travelers) || 1);
  tour.notes = payload.notes || "";
  tour.expenses = Array.isArray(payload.expenses) ? payload.expenses.map((expense) => ({ ...expense })) : [];
  tour.checklist = Array.isArray(payload.checklist)
    ? payload.checklist.map((item) => ({
        id: item.id || generateId("chk"),
        text: item.text || "",
        checked: Boolean(item.checked),
      }))
    : [];
  tour.lat = payload.lat ?? null;
  tour.lon = payload.lon ?? null;
  tour.placeLabel = payload.placeLabel || "";
  tour.inviteToken = payload.token || tour.inviteToken || null;
  tour.sharedTripId = payload.sharedTripId || tour.sharedTripId || null;
  tour.sharedMode = "shared";
  tour.ownerName = payload.ownerName || tour.ownerName || "Trip owner";

  const incomingMembers = Array.isArray(payload.members) ? payload.members : [];
  const membersByOwner = new Map();
  (tour.members || []).forEach((member) => {
    if (member && member.ownerId) membersByOwner.set(member.ownerId, member);
  });
  incomingMembers.forEach((member) => {
    if (member && member.ownerId) membersByOwner.set(member.ownerId, member);
  });

  if (memberOwnerId && !membersByOwner.has(memberOwnerId)) {
    membersByOwner.set(memberOwnerId, {
      ownerId: memberOwnerId,
      name: memberName || "Trip member",
      role: "editor",
      joinedAt: new Date().toISOString(),
    });
  }

  tour.members = Array.from(membersByOwner.values());

  // Never let an import move the revision counter backwards — the local
  // copy keeps counting up from whichever is higher once the two are
  // merged, so a future compare against this same tour still works.
  tour.revision = Math.max(Number(tour.revision) || 1, Number(payload.revision) || 1);

  return tour;
}

/**
 * Compares a shared-trip link against whatever local copy already exists
 * for it, so join.js can warn before an import overwrites newer local
 * edits. Kept deliberately simple (a single incrementing counter) per the
 * "university project, not a production sync engine" scope:
 *   - "new"   no local copy yet — nothing to conflict with, safe to import
 *   - "newer" the link is ahead of the local copy — safe to update
 *   - "same"  link and local copy are at the same revision
 *   - "older" the local copy has edits this link doesn't — importing would
 *             overwrite them, so the caller should confirm first
 */
function getInviteConflictStatus(existingTour, payload) {
  if (!existingTour) return "new";
  const localRevision = Number(existingTour.revision) || 1;
  const incomingRevision = Number(payload.revision) || 1;
  if (incomingRevision > localRevision) return "newer";
  if (incomingRevision === localRevision) return "same";
  return "older";
}

/**
 * Join behavior:
 * - same browser + same account already has the shared trip -> update it
 * - same browser + another account already has that shared trip -> update that local shared record
 * - otherwise create a new local editable copy
 */
function joinTourFromInvite(ownerId, payload, memberName) {
  const sharedTripId = payload.sharedTripId || payload.token || generateInviteToken();
  let existing = getSharedTourForSession(sharedTripId, ownerId);

  if (!existing) {
    existing = getAllTours().find((tour) => tour.sharedTripId === sharedTripId) || null;
  }

  if (existing) {
    copyInviteIntoTour(existing, payload, memberName, ownerId);
    return upsertTour(existing);
  }

  const tour = createBlankTour(ownerId);
  tour.ownerId = ownerId;
  tour.owner = payload.ownerId || ownerId;
  tour.ownerName = payload.ownerName || "Trip owner";
  tour.sharedTripId = sharedTripId;
  tour.sharedMode = "shared";
  tour.members = [];
  copyInviteIntoTour(tour, payload, memberName, ownerId);

  return upsertTour(tour);
}

/** Applies a newer invite snapshot to an existing local shared trip. */
function updateTourFromInvite(tour, payload, memberName, memberOwnerId) {
  if (!tour || !payload) return null;
  if (!tour.sharedTripId || tour.sharedTripId !== (payload.sharedTripId || payload.token)) return null;
  copyInviteIntoTour(tour, payload, memberName, memberOwnerId);
  return upsertTour(tour);
}
