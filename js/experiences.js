/* =========================================================
   experiences.js
   Browse Traveler Experiences: All / Recent / Popular, with a
   free-text destination search — never filtered by a
   destination id, so an experience for "Tanguar Haor" (not in
   the curated catalog) shows up just as well as one for Sajek.
   Reads are synchronous (localStorage), so this can never sit
   on an endless "Loading…" state.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("experiences");

  const grid = qs("#experiencesGrid");
  const searchInput = qs("#destinationSearch");
  const sortRow = qs("#sortRow");

  let sortMode = "recent"; // "all" | "recent" | "popular"

  renderSortChips();
  renderGrid();

  searchInput.addEventListener("input", renderGrid);

  function renderSortChips() {
    sortRow.innerHTML = "";
    [
      { key: "recent", label: "Recent" },
      { key: "popular", label: "Popular" },
      { key: "all", label: "All" },
    ].forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip" + (opt.key === sortMode ? " active" : "");
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        sortMode = opt.key;
        renderSortChips();
        renderGrid();
      });
      sortRow.appendChild(btn);
    });
  }

  function renderGrid() {
    const query = searchInput.value.trim();

    let list = query
      ? searchExperiences(query)
      : sortMode === "popular"
      ? getPopularExperiences(30)
      : sortMode === "all"
      ? getAllExperiences()
      : getRecentExperiences(30);

    // A destination search should still respect the chosen sort order.
    if (query) {
      list = sortMode === "popular"
        ? list.slice().sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0))
        : list.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    grid.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = query
        ? "<h3>No experiences found for \"" + escapeHtml(query) + "\"</h3><p>Be the first to share one for this destination.</p>" +
          '<a href="experience-form.html?destination=' + encodeURIComponent(query) + '" class="btn btn-primary">Share your experience</a>'
        : "<h3>No traveler experiences yet</h3><p>Be the first to share how your trip went.</p>" +
          '<a href="experience-form.html" class="btn btn-primary">Share your experience</a>';
      grid.appendChild(empty);
      return;
    }

    list.forEach((exp) => grid.appendChild(buildExperienceCard(exp)));
  }
})();
