/* =========================================================
   home.js — logic for index.html only
   ========================================================= */

(function () {
  const session = getSession();
  const navLinks = qs("#homeNavLinks");
  const heroActions = qs(".hero-actions");
  const heroGuestBtn = qs("#guestBtn");

  if (session) {
    // already signed in (or guest) — no need to push login/register again
    navLinks.innerHTML = '<a href="dashboard.html" class="active">Go to dashboard</a>' +
      (typeof isAdminSession === "function" && isAdminSession(session)
        ? '<a href="admin.html">Admin</a>'
        : "");
    heroActions.innerHTML =
      '<a href="dashboard.html" class="btn btn-primary">Go to dashboard</a>' +
      '<a href="profile.html" class="btn btn-outline">View profile</a>';
    heroGuestBtn.style.display = "none";
  } else {
    navLinks.innerHTML =
      '<a href="login.html?tab=login">Log in</a>' +
      '<a href="login.html?tab=register">Sign up</a>';

    heroGuestBtn.addEventListener("click", () => {
      startGuestSession();
      window.location.href = "dashboard.html";
    });
  }

  // The home page has a custom navbar, so its theme toggle must be wired here.
  initThemeToggle();

  // mobile menu toggle (same behaviour as initNavbar, home page has a custom nav so wire it directly)
  const toggle = qs(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }
})();
