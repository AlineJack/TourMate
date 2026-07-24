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
      clearSession();
      window.location.href = "index.html";
    });
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

function formatMoney(amount) {
  const value = Number(amount) || 0;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
