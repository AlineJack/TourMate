/* =========================================================
   profile.js — logic for profile.html only
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;
  initNavbar("profile");

  const initials = session.isGuest
    ? "G"
    : session.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");

  qs("#avatarCircle").textContent = initials || "?";
  qs("#profileName").textContent = session.name;
  qs("#profileEmail").textContent = session.isGuest ? "Guest session — no account" : session.email;

  const tourCount = getToursForOwner(session.ownerId).length;
  qs("#profilePlanCount").textContent = tourCount;

  if (session.isGuest) {
    qs("#guestNote").style.display = "block";
    qs("#createAccountBtn").style.display = "inline-flex";
  }

  function logout() {
    clearSession();
    window.location.href = "index.html";
  }

  qs("#profileLogoutBtn").addEventListener("click", logout);
})();
