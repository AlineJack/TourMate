/* =========================================================
   app.js
   Shared UI helpers used across every page: the navbar
   (active link, mobile toggle, logout), route guards,
   a small toast notification, and common formatters.
   Include storage.js before this file.
   ========================================================= */

/* ---------- tiny DOM shortcuts ---------- */

function qs(selector, scope) {
  return (scope || document).querySelector(selector);
}

function qsa(selector, scope) {
  return Array.from((scope || document).querySelectorAll(selector));
}

/* ---------- route guards ---------- */

/** Call on dashboard/planner/profile: sends visitors with no session back to the home page. */
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = "index.html";
  }
  return session;
}

/* ---------- navbar ---------- */

/**
 * Wires up the navbar that's already in the page's HTML:
 * - highlights the current page's link
 * - shows the signed-in name (or "Guest")
 * - opens/closes the mobile menu
 * - binds the logout button, if one exists on the page
 */
function initNavbar(currentPage) {
  const links = qsa(".nav-links a");
  links.forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.classList.add("active");
    }
  });

  const session = getSession();
  const nameSlot = qs("[data-nav-user]");
  if (nameSlot) {
    nameSlot.textContent = session ? "Hi, " + session.name : "";
  }

  const toggle = qs(".nav-toggle");
  const navLinks = qs(".nav-links");
  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  const logoutBtn = qs("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // clearSession() now also calls auth.signOut() (returns a Promise).
      // We redirect after Firebase confirms the sign-out is complete.
      clearSession().then(() => {
        window.location.href = "index.html";
      });
    });
  }

  initAdminNav(currentPage);
  // Admin is injected after the normal links, so highlight it after insertion too.
  const activeLink = qs('.nav-links a[data-page="' + currentPage + '"]');
  if (activeLink) activeLink.classList.add("active");
  initThemeToggle();
}

function initAdminNav(currentPage) {
  const nav = qs(".nav-links");
  if (!nav || typeof isAdminSession !== "function") return;

  const existing = nav.querySelector('[data-page="admin"]');
  const session = getSession();

  if (session && isAdminSession(session) && !existing) {
    const adminLink = document.createElement("a");
    adminLink.href = "admin.html";
    adminLink.dataset.page = "admin";
    if (currentPage === "admin") adminLink.classList.add("active");
    adminLink.textContent = "Admin";
    nav.appendChild(adminLink);
  } else if ((!session || !isAdminSession(session)) && existing) {
    existing.remove();
  }
}

/* ---------- theme toggle (PART 17) ----------
   The <html> element's data-theme attribute is already set as
   early as possible by a tiny inline script in every page's
   <head> (before first paint, using settings-store.js's same
   "tourmate_theme" key) — this just wires up the button so the
   user can flip it, via the ONE shared getTheme()/setTheme()
   in settings-store.js.
*/
function initThemeToggle() {
  const btn = qs("[data-theme-toggle]");
  if (!btn) return;

  updateIcon();

  btn.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
    updateIcon();
  });

  function updateIcon() {
    const dark = getTheme() === "dark";
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.setAttribute("aria-pressed", String(dark));
  }
}

/* ---------- toast ---------- */

let toastTimer = null;

function showToast(message) {
  let toast = qs(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

/* ---------- formatting helpers ---------- */

/**
 * Sums amountFn(item) per currency across a list of tours and formats
 * each group with the ONE shared formatCurrency() (tour-store.js) —
 * used where a dashboard-level total might span more than one
 * currency, so nothing gets silently mislabeled.
 */
function formatMixedCurrencyTotal(items, amountFn) {
  const totals = {};
  items.forEach((item) => {
    const currency = item.currency || "BDT";
    totals[currency] = (totals[currency] || 0) + amountFn(item);
  });
  const currencies = Object.keys(totals);
  if (currencies.length === 0) return formatCurrency(0, "BDT");
  return currencies.map((c) => formatCurrency(totals[c], c)).join(" + ");
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatDateRange(start, end) {
  if (!start || !end) return "Dates not set";
  const startLabel = formatDateShort(start);
  const endD = new Date(end + "T00:00:00");
  const endLabel = endD.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return startLabel + " – " + endLabel;
}

function tripDurationNights(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
}

/** Where a tour sits relative to today: 'upcoming' | 'ongoing' | 'completed' */
function getTourStatus(startDate, endDate) {
  if (!startDate || !endDate) return "upcoming";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "ongoing";
}

function totalSpent(expenses) {
  return (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function truncate(text, max) {
  const str = text || "";
  if (str.length <= max) return str;
  return str.slice(0, max).trim() + "…";
}

/* ---------- shared destination card grid (PART 8: always badged as
   TourMate Guide content) — used by Home Recommendations, Explore,
   and the Guide's search results. ---------- */
function renderDestinationCards(container, destinations) {
  container.innerHTML = "";

  if (destinations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No destinations match</h3><p>Try a different search or category.</p>";
    container.appendChild(empty);
    return;
  }

  destinations.forEach((dest) => {
    const card = document.createElement("a");
    card.className = "destination-card";
    card.href = "destination.html?id=" + encodeURIComponent(dest.id);
    card.innerHTML =
      '<span class="guide-badge">TourMate Guide</span>' +
      "<h3>" + escapeHtml(dest.name) + "</h3>" +
      '<div class="dest-region">' + escapeHtml(dest.region) + "</div>" +
      '<p class="dest-summary">' + escapeHtml(dest.summary) + "</p>" +
      '<div class="dest-meta"><span>' + formatDayRange(dest.recommendedDays) + "</span><span>" + formatBudgetRange(dest.budgetRange) + "</span></div>";
    container.appendChild(card);
  });
}

/* ---------- shared "Traveler Experience" card (PART 8: always badged,
   never mistaken for TourMate Guide content) — used by the Dashboard's
   "From other travelers", the Experiences browse page, and a
   destination's related-experiences list. ---------- */
function buildExperienceCard(exp) {
  const a = document.createElement("a");
  a.className = "experience-card";
  a.href = "experience.html?id=" + encodeURIComponent(exp.id);
  a.innerHTML =
    '<span class="experience-badge">Traveler Experience' + (exp.isSample ? " · sample" : "") + "</span>" +
    "<h3>" + escapeHtml(exp.title) + "</h3>" +
    '<div class="exp-dest">' + escapeHtml(exp.destination || "") + "</div>" +
    '<div class="exp-meta">' +
    '<span class="exp-rating">' + "★".repeat(Math.round(exp.rating || 0)) + "</span>" +
    (exp.tripDuration ? "<span>" + exp.tripDuration + " day" + (exp.tripDuration === 1 ? "" : "s") + "</span>" : "") +
    (exp.approxCost ? "<span>" + formatCurrency(exp.approxCost, "BDT") + "/person</span>" : "") +
    "</div>" +
    '<p class="exp-snippet">' + escapeHtml(truncate(exp.description || "", 120)) + "</p>";
  return a;
}
