/* =========================================================
   explore.js — PART 5
   Browse/search TourMate's curated destinations. No Firestore
   reads here at all — DESTINATIONS is a static, free dataset.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("explore");

  const CATEGORIES = [
    { key: "all", label: "All" },
    { key: "nature", label: "Nature" },
    { key: "adventure", label: "Adventure" },
    { key: "beach", label: "Beach" },
    { key: "mountain", label: "Mountain" },
    { key: "budget", label: "Budget-friendly" },
    { key: "weekend", label: "Weekend" },
  ];

  const params = new URLSearchParams(window.location.search);
  let activeCategory = CATEGORIES.some((c) => c.key === params.get("tag")) ? params.get("tag") : "all";

  const searchInput = qs("#exploreSearch");
  const categoryRow = qs("#categoryRow");
  const grid = qs("#exploreGrid");

  renderCategoryChips();
  renderGrid();

  searchInput.addEventListener("input", renderGrid);

  function renderCategoryChips() {
    categoryRow.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip" + (cat.key === activeCategory ? " active" : "");
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        activeCategory = cat.key;
        searchInput.value = "";
        renderCategoryChips();
        renderGrid();
      });
      categoryRow.appendChild(btn);
    });
  }

  function renderGrid() {
    const query = searchInput.value.trim();

    let results;
    if (query) {
      results = searchDestinations(query);
    } else if (activeCategory === "all") {
      results = getAllDestinations();
    } else {
      results = getDestinationsByTag(activeCategory);
    }

    renderDestinationCards(grid, results);
  }
})();
