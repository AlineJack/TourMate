/* =========================================================
   admin.js
   A FRONTEND-ONLY local prototype. Everything here reads and
   writes the same localStorage this browser already has —
   there is no separate backend and no data from any other
   device. Real server-side admin authorization is future
   Firebase-security-rules work; see js/roles.js for the
   allowlist that gates this page.
   ========================================================= */

(function () {
  const session = requireAdmin(); // just an auth check — redirects to index.html if not signed in at all
  if (!session) return;

  initNavbar("admin");

  const deniedBox = qs("#adminDenied");
  const contentBox = qs("#adminContent");

  if (!isAdminSession(session)) {
    // Signed in, but not on the allowlist — a real JS check, not a CSS
    // trick, and nothing below this line ever renders for this visitor.
    deniedBox.style.display = "";
    contentBox.style.display = "none";
    return;
  }

  deniedBox.style.display = "none";
  contentBox.style.display = "";

  const configSummary = getAdminConfigSummary();
  const accessText = qs("#adminAccessInfo");
  if (accessText) {
    accessText.textContent =
      "Signed in as " + (session.email || session.name) +
      ". Admin access is granted by the allowlist in js/roles.js (" +
      configSummary.uidCount + " UID and " + configSummary.emailCount + " email rule" +
      (configSummary.emailCount === 1 ? "" : "s") + ").";
  }

  renderStats();
  renderExperienceList();
  renderTourList();
  renderDestinationList();
  renderSystemInfo();

  qs("#adminExperienceList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-exp]");
    if (!btn) return;
    const ok = window.confirm("Delete this experience? This can't be undone.");
    if (!ok) return;
    deleteExperience(btn.dataset.deleteExp);
    renderStats();
    renderExperienceList();
    showToast("Experience deleted");
  });

  qs("#adminTourList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-tour]");
    if (!btn) return;
    const ok = window.confirm("Delete this tour? This can't be undone.");
    if (!ok) return;
    deleteTour(btn.dataset.deleteTour);
    renderStats();
    renderTourList();
    showToast("Tour deleted");
  });

  qs("#clearSampleBtn").addEventListener("click", () => {
    const ok = window.confirm("Remove all sample/demo experiences (isSample: true)? User-created experiences are not affected.");
    if (!ok) return;

    getAllExperiences()
      .filter((e) => e.isSample)
      .forEach((e) => deleteExperience(e.id));

    renderStats();
    renderExperienceList();
    showToast("Sample experiences cleared");
  });

  function renderStats() {
    const tours = getAllTours();
    const sharedTours = tours.filter((t) => t.sharedMode === "shared");
    const experiences = getAllExperiences();
    const sampleCount = experiences.filter((e) => e.isSample).length;
    const savedTotal = Object.values(readJSON("tourmate_saved_experiences", {})).reduce((sum, arr) => sum + arr.length, 0);
    const helpfulTotal = Object.values(readJSON("tourmate_helpful_marks", {})).reduce((sum, arr) => sum + arr.length, 0);
    const profileCount = Object.keys(getAllProfiles()).length;

    const stats = [
      { label: "Tours (local)", value: tours.length },
      { label: "Shared trips", value: sharedTours.length },
      { label: "Experiences (posts)", value: experiences.length + " (" + sampleCount + " sample)" },
      { label: "Saved bookmarks", value: savedTotal },
      { label: "Helpful marks", value: helpfulTotal },
      { label: "Local profiles", value: profileCount },
      { label: "Destinations in catalog", value: getAllDestinations().length },
    ];

    const row = qs("#adminStats");
    row.innerHTML = "";
    stats.forEach((s) => {
      const card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = '<div class="stat-value">' + s.value + '</div><div class="stat-label">' + s.label + "</div>";
      row.appendChild(card);
    });
  }

  function renderExperienceList() {
    const list = qs("#adminExperienceList");
    const experiences = getAllExperiences().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = "";
    if (experiences.length === 0) {
      list.innerHTML = '<li class="empty-hint">No experiences stored.</li>';
      return;
    }

    experiences.forEach((exp) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.innerHTML =
        "<div><strong>" + escapeHtml(exp.title) + "</strong>" +
        '<div class="dest-region">' + escapeHtml(exp.destination) + " · " + escapeHtml(exp.author) +
        (exp.isSample ? " · sample" : "") + " · " + (exp.helpfulCount || 0) + " helpful</div></div>" +
        '<div class="admin-list-actions">' +
        '<a class="btn btn-outline btn-sm" href="experience.html?id=' + encodeURIComponent(exp.id) + '">View</a>' +
        '<button class="btn btn-danger btn-sm" data-delete-exp="' + exp.id + '" type="button">Delete</button>' +
        "</div>";
      list.appendChild(li);
    });
  }

  function renderTourList() {
    const list = qs("#adminTourList");
    const tours = getAllTours().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    list.innerHTML = "";
    if (tours.length === 0) {
      list.innerHTML = '<li class="empty-hint">No tours stored.</li>';
      return;
    }

    tours.forEach((tour) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.innerHTML =
        "<div><strong>" + escapeHtml(tour.destination || "Untitled trip") + "</strong>" +
        '<div class="dest-region">owner: ' + escapeHtml(tour.ownerId) + " · " + formatCurrency(tour.budget, tour.currency) +
        " · " + tour.travelers + " traveler" + (tour.travelers === 1 ? "" : "s") +
        (tour.sharedMode === "shared" ? " · shared" : "") + "</div></div>" +
        '<div class="admin-list-actions">' +
        '<a class="btn btn-outline btn-sm" href="planner.html?id=' + encodeURIComponent(tour.id) + '">View</a>' +
        '<button class="btn btn-danger btn-sm" data-delete-tour="' + tour.id + '" type="button">Delete</button>' +
        "</div>";
      list.appendChild(li);
    });
  }

  function renderDestinationList() {
    const list = qs("#adminDestinationList");
    list.innerHTML = "";
    getAllDestinations().forEach((dest) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.innerHTML =
        "<div><strong>" + dest.emoji + " " + escapeHtml(dest.name) + "</strong>" +
        '<div class="dest-region">' + escapeHtml(dest.region) + " · " + formatBudgetRange(dest.budgetRange) + "</div></div>" +
        '<a class="btn btn-outline btn-sm" href="destination.html?id=' + dest.id + '">View</a>';
      list.appendChild(li);
    });
  }

  function renderSystemInfo() {
    const list = qs("#adminSystemInfo");
    if (!list) return;

    const rows = [
      ["Authentication", "Firebase Auth (sign-up, login, logout, email verification, guest sessions)"],
      ["Application data", "Browser localStorage — tours, experiences, checklist, profile, sharing, theme"],
      ["Theme", "Currently " + getTheme() + " (per-browser, key: tourmate_theme)"],
      ["Deployment", "GitHub Pages (static hosting)"],
    ];

    list.innerHTML = "";
    rows.forEach(([label, value]) => {
      const li = document.createElement("li");
      li.className = "admin-list-item";
      li.innerHTML = "<div><strong>" + escapeHtml(label) + "</strong></div><div class=\"dest-region\">" + escapeHtml(value) + "</div>";
      list.appendChild(li);
    });
  }
})();
