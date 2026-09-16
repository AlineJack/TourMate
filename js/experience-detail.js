/* =========================================================
   experience-detail.js
   Full view of one Traveler Experience — loaded entirely from
   localStorage (experience-store.js), so an invalid id always
   shows a clear "not found" state instead of a blank page, and
   nothing here can hang waiting on a network call. Also wires:
   - "Helpful" (one increment per browser, local dedup guard)
   - "Save" (local bookmark)
   - "Use this trip" -> creates a NEW tour in the existing
     planner for the current user. Never touches the original
     traveler's data (separate copy, not an overwrite).
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("experiences");

  const params = new URLSearchParams(window.location.search);
  const experienceId = params.get("id");
  const exp = experienceId ? getExperienceById(experienceId) : null;

  if (!exp) {
    showNotFound();
  } else {
    renderExperience(exp);
  }

  function showNotFound() {
    qs("#expNotFound").style.display = "";
    qs("#expContent").style.display = "none";
  }

  function renderExperience(exp) {
    qs("#expContent").style.display = "";
    qs("#pageTitle").textContent = exp.destination + " — " + exp.tripDuration + " Day Experience — TourMate";
    if (exp.isSample) qs(".experience-badge").textContent = "Traveler Experience · sample";
    qs("#expTitle").textContent = exp.title;
    qs("#expByline").textContent = "By " + exp.author + " · " + exp.destination;

    qs("#expRatingStat").textContent = "★".repeat(Math.round(exp.rating || 0)) + " (" + (exp.rating || 0) + "/5)";
    qs("#expDurationStat").textContent = (exp.tripDuration || "—") + (exp.tripDuration ? " day" + (exp.tripDuration === 1 ? "" : "s") : "");
    qs("#expCostStat").textContent = exp.approxCost ? formatCurrency(exp.approxCost, "BDT") : "—";

    qs("#expDescription").textContent = exp.description;

    renderOptionalList("#placesCard", "#expPlaces", exp.places);
    renderOptionalList("#tipsCard", "#expTips", exp.tips);
    renderDays(exp.days);
    renderPhotos(exp.photos);

    setupHelpfulButton(exp);
    setupSaveButton(exp);
    setupTakeTripButton(exp);
  }

  function renderOptionalList(cardSelector, listSelector, items) {
    const card = qs(cardSelector);
    const list = qs(listSelector);
    if (!items || items.length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    list.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function renderDays(days) {
    const card = qs("#daysCard");
    if (!days || days.length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    const container = qs("#expDays");
    container.innerHTML = "";
    days.forEach((day, index) => {
      const block = document.createElement("div");
      block.className = "day-block day-block-readonly";
      block.innerHTML =
        "<strong>Day " + (index + 1) + (day.title ? ": " + escapeHtml(day.title) : "") + "</strong>" +
        (day.description ? "<p>" + escapeHtml(day.description) + "</p>" : "");
      container.appendChild(block);
    });
  }

  function renderPhotos(photos) {
    const card = qs("#photosCard");
    if (!photos || photos.length === 0) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    const grid = qs("#expPhotos");
    grid.innerHTML = "";
    photos.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Traveler photo";
      img.loading = "lazy";
      grid.appendChild(img);
    });
  }

  /** No firebase.firestore.FieldValue.increment() — plain local read-modify-write, synchronous. */
  function setupHelpfulButton(exp) {
    const btn = qs("#helpfulBtn");
    let count = exp.helpfulCount || 0;
    const alreadyMarked = hasMarkedHelpful(session.ownerId, exp.id);

    updateHelpfulLabel();
    if (alreadyMarked) btn.classList.add("active");

    btn.addEventListener("click", () => {
      if (hasMarkedHelpful(session.ownerId, exp.id)) {
        showToast("Already marked helpful");
        return;
      }
      count = markExperienceHelpful(session.ownerId, exp.id);
      updateHelpfulLabel();
      btn.classList.add("active");
    });

    function updateHelpfulLabel() {
      qs("#helpfulCount").textContent = count;
    }
  }

  function setupSaveButton(exp) {
    const btn = qs("#saveBtn");
    updateLabel(isExperienceSaved(session.ownerId, exp.id));

    btn.addEventListener("click", () => {
      const nowSaved = toggleSavedExperience(session.ownerId, exp.id);
      updateLabel(nowSaved);
      showToast(nowSaved ? "Saved" : "Removed from saved");
    });

    function updateLabel(isSaved) {
      btn.textContent = isSaved ? "★ Saved" : "☆ Save";
      btn.classList.toggle("active", isSaved);
    }
  }

  function setupTakeTripButton(exp) {
    qs("#takeTripBtn").addEventListener("click", () => {
      // Best-effort match back to a curated destination (for checklist
      // seeding only) — the experience's destination is free text, so
      // there may not be one, and that's fine.
      const destination = findMatchingCuratedDestination(exp.destination);

      const tour = createBlankTour(session.ownerId);
      tour.destination = exp.destination;
      tour.budget = exp.approxCost || 0;

      let notes = "Based on " + exp.author + "'s " + (exp.tripDuration || "?") + "-day trip:\n\n" + exp.description;
      if (exp.tips && exp.tips.length) {
        notes += "\n\nTraveler tips:\n" + exp.tips.map((t) => "- " + t).join("\n");
      }
      tour.notes = notes;
      tour.checklist = destination ? destination.checklistSuggestions.map(createChecklistItem) : [];

      upsertTour(tour);
      showToast("Trip started from this experience");
      window.location.href = "planner.html?id=" + tour.id;
    });
  }

  function findMatchingCuratedDestination(destinationText) {
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
