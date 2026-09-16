/* =========================================================
   dashboard.js — logic for dashboard.html only
   ========================================================= */

(function () {
  /* ---------- static data ----------
     These must stay ABOVE the render calls below. `const` bindings are
     hoisted but sit in the Temporal Dead Zone until their declaration is
     evaluated, so a render call placed before them threw
     "Cannot access 'INSPIRATION_CHIPS' before initialization".
     Function declarations are fully hoisted, so the render functions
     themselves can stay further down — only the data has to move up. */

  const INSPIRATION_CHIPS = [
    { emoji: "⛰️", label: "Mountain escape", tag: "mountain" },
    { emoji: "🌿", label: "Nature trip", tag: "nature" },
    { emoji: "🏖️", label: "Beach trip", tag: "beach" },
    { emoji: "🧗", label: "Adventure trip", tag: "adventure" },
    { emoji: "💰", label: "Budget trip", tag: "budget" },
    { emoji: "🎒", label: "Weekend trip", tag: "weekend" },
  ];

  const HELPFUL_SUGGESTIONS = [
    { text: "Have only 2 days?", href: "guide.html?q=" + encodeURIComponent("I have 2 days") },
    { text: "Looking for a budget trip?", href: "explore.html?tag=budget" },
    { text: "Want a nature destination?", href: "explore.html?tag=nature" },
    { text: "Explore trips shared by travelers.", href: "experiences.html" },
  ];

  /* ---------- boot ---------- */

  const session = requireAuth();
  if (!session) return;
  initNavbar("dashboard");

  qs("#welcomeHeading").textContent = "Welcome back, " + session.name + " 👋";

  renderDashboard();
  renderRecommendedDestinations();
  renderPopularDestinations();
  renderTravelInspiration();
  renderHelpfulSuggestions();
  renderPopularExperiences();

  function renderDashboard() {
    const tours = getToursForOwner(session.ownerId);

    // --- quick trip summary stats ---
    const upcomingCount = tours.filter(
      (t) => getTourStatus(t.startDate, t.endDate) === "upcoming"
    ).length;
    qs("#statTotal").textContent = tours.length;
    qs("#statUpcoming").textContent = upcomingCount;
    qs("#statBudget").textContent = formatMixedCurrencyTotal(tours, (t) => Number(t.budget) || 0);
    qs("#welcomeSub").textContent =
      tours.length === 0
        ? "You haven't planned any trips yet."
        : "You have " + tours.length + " saved trip" + (tours.length === 1 ? "" : "s") + ".";

    // --- tour cards ---
    const grid = qs("#tourGrid");
    const emptyState = qs("#emptyState");
    grid.innerHTML = "";

    if (tours.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    tours.forEach((tour) => {
      grid.appendChild(buildTourCard(tour));
    });
  }

  function buildTourCard(tour) {
    const status = getTourStatus(tour.startDate, tour.endDate);
    const spent = totalSpent(tour.expenses);
    const budget = Number(tour.budget) || 0;
    const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const isOver = budget > 0 && spent > budget;

    const wrapper = document.createElement("div");
    wrapper.className = "tag-shadow";
    wrapper.innerHTML =
      '<div class="tour-tag" tabindex="0" role="link" aria-label="Open ' +
      escapeHtml(tour.destination || "Untitled trip") +
      '">' +
      '<span class="tag-ribbon ' + status + '">' + statusLabel(status) + "</span>" +
      (tour.sharedMode === "shared" ? '<span class="guide-badge" style="display:inline-block;margin-bottom:8px;">Shared trip</span>' : "") +
      "<h3>" + escapeHtml(tour.destination || "Untitled trip") + "</h3>" +
      '<div class="tag-dates">' + formatDateRange(tour.startDate, tour.endDate) + "</div>" +
      '<div class="tag-budget-row">' +
      '<div class="tag-figures"><span>' + formatCurrency(spent, tour.currency) + " spent</span><span>" + formatCurrency(budget, tour.currency) + " budget</span></div>" +
      '<div class="progress-track"><div class="progress-fill' + (isOver ? " over-budget" : "") + '" style="width:' + percent + '%"></div></div>' +
      "</div>" +
      '<div class="tag-actions">' +
      '<span class="btn btn-outline btn-sm" style="pointer-events:none;">View trip</span>' +
      '<button class="icon-btn" data-delete="' + tour.id + '" title="Delete tour" aria-label="Delete tour" type="button">✕</button>' +
      "</div>" +
      "</div>";

    const tag = wrapper.querySelector(".tour-tag");
    const goToPlanner = () => {
      window.location.href = "planner.html?id=" + encodeURIComponent(tour.id);
    };
    tag.addEventListener("click", goToPlanner);
    tag.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        goToPlanner();
      }
    });

    wrapper.querySelector("[data-delete]").addEventListener("click", (e) => {
      e.stopPropagation();
      const ok = window.confirm(
        'Delete the trip to "' + (tour.destination || "this destination") + '"? This can\'t be undone.'
      );
      if (!ok) return;
      deleteTour(tour.id);
      showToast("Trip deleted");
      renderDashboard();
    });

    return wrapper;
  }

  function statusLabel(status) {
    if (status === "ongoing") return "Ongoing";
    if (status === "completed") return "Completed";
    return "Upcoming";
  }

  /* ---------- Home Recommendations (PART 4) ---------- */

  // A small, deterministic-per-day rotation so "Recommended for you" isn't
  // the exact same four destinations on every single visit, without needing
  // any real personalization logic or extra reads.
  function renderRecommendedDestinations() {
    const all = getAllDestinations();
    const dayOffset = new Date().getDate() % all.length;
    const rotated = all.slice(dayOffset).concat(all.slice(0, dayOffset));
    renderDestinationCards(qs("#recommendedRow"), rotated.slice(0, 4));
  }

  /** PART 15/16: the same DESTINATIONS source Explore and destination.html use — no separate database. */
  function renderPopularDestinations() {
    renderDestinationCards(qs("#popularDestinationsRow"), getAllDestinations());
  }

  function renderTravelInspiration() {
    const row = qs("#inspirationRow");
    row.innerHTML = "";
    INSPIRATION_CHIPS.forEach((chip) => {
      const a = document.createElement("a");
      a.className = "inspiration-chip";
      a.href = "explore.html?tag=" + encodeURIComponent(chip.tag);
      a.innerHTML = '<span class="chip-emoji">' + chip.emoji + "</span>" + escapeHtml(chip.label);
      row.appendChild(a);
    });
  }

  function renderHelpfulSuggestions() {
    const row = qs("#suggestionsRow");
    row.innerHTML = "";
    HELPFUL_SUGGESTIONS.forEach((s) => {
      const a = document.createElement("a");
      a.className = "suggestion-chip";
      a.href = s.href;
      a.innerHTML = "<span>" + escapeHtml(s.text) + '</span><span class="arrow">→</span>';
      row.appendChild(a);
    });
  }

  function renderPopularExperiences() {
    const row = qs("#popularExperiencesRow");
    const list = getPopularExperiences(3);

    row.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        "<h3>No traveler experiences yet</h3>" +
        "<p>Be the first to share how your trip actually went.</p>" +
        '<a href="experience-form.html" class="btn btn-primary">Share your experience</a>';
      row.appendChild(empty);
      return;
    }

    list.forEach((exp) => row.appendChild(buildExperienceCard(exp)));
  }
})();
