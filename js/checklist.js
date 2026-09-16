/* =========================================================
   checklist.js — PART 13
   Standalone Checklist page. Deliberately reuses the exact
   same tour.checklist data the Planner's Checklist card
   writes to (via getChecklist/createChecklistItem/upsertTour
   from storage.js) — this is a second entry point onto the
   same per-trip data, not a separate checklist system.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("checklist");

  const tours = getToursForOwner(session.ownerId);

  if (tours.length === 0) {
    qs("#noTripsState").style.display = "";
    qs("#checklistBody").style.display = "none";
    return;
  }

  qs("#checklistBody").style.display = "";

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  let currentTour = (requestedId && tours.find((t) => t.id === requestedId)) || tours[0];
  currentTour.checklist = getChecklist(currentTour);

  const tripSelect = qs("#tripSelect");

  renderTripSelect();
  renderChecklist();
  renderSuggestions();

  tripSelect.addEventListener("change", () => {
    currentTour = getTourById(tripSelect.value) || tours[0];
    currentTour.checklist = getChecklist(currentTour);
    history.replaceState(null, "", "checklist.html?id=" + encodeURIComponent(currentTour.id));
    renderChecklist();
    renderSuggestions();
  });

  qs("#checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = qs("#checklistInput");
    const text = input.value.trim();
    if (!text) return;

    currentTour.checklist.push(createChecklistItem(text));
    input.value = "";
    saveAndRerender();
  });

  qs("#checklistList").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-delete-checklist]");
    if (deleteBtn) {
      currentTour.checklist = currentTour.checklist.filter((item) => item.id !== deleteBtn.dataset.deleteChecklist);
      saveAndRerender();
      return;
    }
    const checkbox = e.target.closest("[data-toggle-checklist]");
    if (checkbox) {
      const item = currentTour.checklist.find((i) => i.id === checkbox.dataset.toggleChecklist);
      if (item) item.checked = checkbox.checked;
      saveAndRerender();
    }
  });

  qs("#suggestedRow").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-suggestion]");
    if (!btn) return;
    currentTour.checklist.push(createChecklistItem(btn.dataset.addSuggestion));
    saveAndRerender();
  });

  function saveAndRerender() {
    currentTour = upsertTour(currentTour);
    renderChecklist();
    renderSuggestions();
  }

  function renderTripSelect() {
    tripSelect.innerHTML = "";
    tours.forEach((tour) => {
      const opt = document.createElement("option");
      opt.value = tour.id;
      let label = tour.destination || "Untitled trip";
      if (tour.startDate && tour.endDate) label += " — " + formatDateRange(tour.startDate, tour.endDate);
      opt.textContent = label;
      if (tour.id === currentTour.id) opt.selected = true;
      tripSelect.appendChild(opt);
    });
  }

  function renderChecklist() {
    const list = qs("#checklistList");
    list.innerHTML = "";

    if (currentTour.checklist.length === 0) {
      const li = document.createElement("li");
      li.style.cssText = "justify-content:center;border-bottom:none;color:var(--ink-faint);padding:18px 0;";
      li.textContent = "No checklist items yet.";
      list.appendChild(li);
      return;
    }

    currentTour.checklist.forEach((item) => {
      const li = document.createElement("li");
      li.className = "checklist-item" + (item.checked ? " checked" : "");
      li.innerHTML =
        '<label class="checklist-label">' +
        '<input type="checkbox" data-toggle-checklist="' + item.id + '"' + (item.checked ? " checked" : "") + " />" +
        "<span>" + escapeHtml(item.text) + "</span>" +
        "</label>" +
        '<button class="icon-btn" data-delete-checklist="' + item.id + '" title="Remove item" type="button">✕</button>';
      list.appendChild(li);
    });
  }

  function renderSuggestions() {
    const row = qs("#suggestedRow");
    const dest = findMatchingDestination(currentTour.destination);

    if (!dest) {
      row.innerHTML = '<p class="empty-hint">No matching TourMate destination for suggestions — add your own items above.</p>';
      return;
    }

    const existingTexts = currentTour.checklist.map((i) => i.text.toLowerCase());
    const remaining = dest.checklistSuggestions.filter((s) => !existingTexts.includes(s.toLowerCase()));

    if (remaining.length === 0) {
      row.innerHTML = '<p class="empty-hint">You\'ve added all of ' + escapeHtml(dest.name) + '\'s suggested items.</p>';
      return;
    }

    row.innerHTML = "";
    remaining.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip";
      btn.textContent = "+ " + text;
      btn.dataset.addSuggestion = text;
      row.appendChild(btn);
    });
  }

  function findMatchingDestination(destinationText) {
    const flat = (destinationText || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!flat) return null;
    return (
      getAllDestinations().find((d) => {
        const flatName = d.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return flat.includes(flatName) || flatName.includes(flat) || flat.includes(d.id);
      }) || null
    );
  }
})();
