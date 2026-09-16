/* =========================================================
   destination.js
   Renders one destination's TourMate Guide content — including
   an image banner and pros/cons — plus its related Traveler
   Experiences (now read from localStorage, matched by free-text
   destination name, not a destination id), and connects
   "Plan this trip" into the EXISTING Trip Planner. Everything
   here runs synchronously against local data; there is no
   network call that could leave this page half-loaded.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("explore");

  const params = new URLSearchParams(window.location.search);
  const dest = getDestinationById(params.get("id"));

  if (!dest) {
    qs("#destNotFound").style.display = "";
    qs("#destContent").style.display = "none";
    return;
  }

  qs("#destContent").style.display = "";
  qs("#destNotFound").style.display = "none";

  qs("#pageTitle").textContent = dest.name + " — TourMate";
  qs("#destHero").innerHTML = '<span class="dest-hero-emoji">' + (dest.emoji || "🗺️") + "</span>";
  qs("#destName").textContent = dest.name;
  qs("#destRegion").textContent = dest.region;
  qs("#destDescription").textContent = dest.description;
  qs("#destDaysStat").textContent = formatDayRange(dest.recommendedDays);
  qs("#destBudgetStat").textContent = formatBudgetRange(dest.budgetRange);

  renderTagPills(qs("#destTagsRow"), dest.tags);
  renderBulletList(qs("#destThingsToDo"), dest.thingsToDo);
  renderBulletList(qs("#destPlacesToVisit"), dest.placesToVisit);
  renderBulletList(qs("#destPrepGuidance"), dest.prepGuidance);
  renderBulletList(qs("#destPros"), dest.pros);
  renderBulletList(qs("#destCons"), dest.cons);

  qs("#shareExperienceLink").href = "experience-form.html?destination=" + encodeURIComponent(dest.name);

  qs("#planTripBtn").addEventListener("click", () => {
    const tour = createBlankTour(session.ownerId);
    tour.destination = dest.name;
    tour.budget = Math.round((dest.budgetRange.min + dest.budgetRange.max) / 2 / 100) * 100;
    tour.notes =
      "Things to do:\n" + dest.thingsToDo.map((t) => "- " + t).join("\n") +
      "\n\nBefore you go:\n" + dest.prepGuidance.map((t) => "- " + t).join("\n");
    tour.checklist = dest.checklistSuggestions.map(createChecklistItem);

    upsertTour(tour);
    showToast("Trip started — customize it in the planner");
    window.location.href = "planner.html?id=" + tour.id;
  });

  renderRelatedExperiences(dest);

  function renderTagPills(container, tags) {
    container.innerHTML = "";
    (tags || []).forEach((tag) => {
      const span = document.createElement("span");
      span.className = "tag-pill";
      span.textContent = tag;
      container.appendChild(span);
    });
  }

  function renderBulletList(container, items) {
    container.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      container.appendChild(li);
    });
  }

  function renderRelatedExperiences(destination) {
    const row = qs("#destExperiencesRow");
    const list = getExperiencesByDestination(destination.name);

    row.innerHTML = "";
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        "<h3>No traveler experiences yet for " + escapeHtml(destination.name) + "</h3>" +
        "<p>Be the first to share how your trip went.</p>" +
        '<a href="experience-form.html?destination=' + encodeURIComponent(destination.name) + '" class="btn btn-primary">Share your experience</a>';
      row.appendChild(empty);
      return;
    }

    list.forEach((exp) => row.appendChild(buildExperienceCard(exp)));
  }
})();
