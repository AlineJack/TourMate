/*
  TOURMATE ADMIN CONFIGURATION

  Add an authenticated Firebase account's email below to give that
  account Admin access to admin.html and the "Admin" nav link.

  Example:
  const ADMIN_EMAILS = [
    "your-email@example.com"
  ];

  - Guests can never be admins, no matter what.
  - The email must match exactly what that account signed up with
    (case-insensitive, extra spaces are trimmed automatically).
  - You can alternatively list a Firebase Auth UID in ADMIN_UIDS
    below — useful if you don't want the email hardcoded — but for
    most people editing ADMIN_EMAILS is the easiest way to add an
    admin.
  - This is frontend-only access control, fine for this local-first
    prototype/university project, but NOT real security: anyone who
    can edit the deployed JavaScript could bypass it. Real security
    (Firebase custom claims / server-side rules) is future-phase work.
*/

const ADMIN_UIDS = [
  // "PASTE_YOUR_FIREBASE_UID_HERE"
];

const ADMIN_EMAILS = [
  // "your-email@example.com"
];

function isAdminSession(session) {
  if (!session || session.isGuest) return false;

  const uid = String(session.ownerId || "").trim();
  const email = String(session.email || "").trim().toLowerCase();

  return ADMIN_UIDS.some((value) => String(value).trim() === uid) ||
    ADMIN_EMAILS.some((value) => String(value).trim().toLowerCase() === email);
}

function getAdminConfigSummary() {
  return {
    uidCount: ADMIN_UIDS.filter(Boolean).length,
    emailCount: ADMIN_EMAILS.filter(Boolean).length,
  };
}

/**
 * Ensures there's at least a signed-in/guest session (redirects to
 * index.html otherwise, same rule as every other page) and returns it.
 * This does NOT redirect away for a non-admin — admin.js renders a clear
 * "Admin access required" state on the page itself for anyone signed in
 * but not on the allowlist, instead of silently bouncing them elsewhere
 * with no explanation.
 */
function requireAdmin() {
  return requireAuth();
}
