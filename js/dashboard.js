/* =========================================================
   dashboard.js — logic for dashboard.html only
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;
  initNavbar("dashboard");

  qs("#welcomeHeading").textContent = "Welcome back, " + session.name + " 👋";

  renderDashboard();

  function renderDashboard() {
    const tours = getToursForOwner(session.ownerId);

    // --- quick trip summary stats ---
    const upcomingCount = tours.filter(
      (t) => getTourStatus(t.startDate, t.endDate) === "upcoming"
    ).length;
    const totalBudget = tours.reduce((sum, t) => sum + (Number(t.budget) || 0), 0);

    qs("#statTotal").textContent = tours.length;
    qs("#statUpcoming").textContent = upcomingCount;
    qs("#statBudget").textContent = formatMoney(totalBudget);
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
      "<h3>" + escapeHtml(tour.destination || "Untitled trip") + "</h3>" +
      '<div class="tag-dates">' + formatDateRange(tour.startDate, tour.endDate) + "</div>" +
      '<div class="tag-budget-row">' +
      '<div class="tag-figures"><span>' + formatMoney(spent) + " spent</span><span>" + formatMoney(budget) + " budget</span></div>" +
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
})();
