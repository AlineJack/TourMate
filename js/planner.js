/* =========================================================
   planner.js — logic for planner.html only
   Loads a tour (or starts a blank one), keeps the trip
   summary live as fields change, manages expenses, and
   hands destination text off to weather.js / map.js.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;
  initNavbar("planner");
  initTourMap();

  const destinationInput = qs("#destinationInput");
  const startDateInput = qs("#startDateInput");
  const endDateInput = qs("#endDateInput");
  const budgetInput = qs("#budgetInput");
  const travelersInput = qs("#travelersInput");
  const currencyInput = qs("#currencyInput");
  const notesInput = qs("#notesInput");

  getCurrencyOptions().forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.code;
    option.textContent = opt.label;
    currencyInput.appendChild(option);
  });

  /* ---------- load the right tour ---------- */

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  let currentTour;

  if (requestedId) {
    const existing = getTourById(requestedId);
    if (existing && canEditTour(session, existing)) {
      currentTour = existing;
    } else {
      // stale or inaccessible id — fall back to a fresh tour instead of exposing another user's private trip.
      currentTour = createBlankTour(session.ownerId);
      history.replaceState(null, "", "planner.html");
    }
  } else {
    currentTour = createBlankTour(session.ownerId);
  }

  // Tours saved before the Checklist feature existed have no `checklist`
  // field yet — normalize once, here, so every later read/write on
  // currentTour.checklist is safe.
  currentTour.checklist = getChecklist(currentTour);

  /* ---------- populate the form from the tour ---------- */

  destinationInput.value = currentTour.destination || "";
  startDateInput.value = currentTour.startDate || "";
  endDateInput.value = currentTour.endDate || "";
  budgetInput.value = currentTour.budget || "";
  travelersInput.value = currentTour.travelers || 1;
  currencyInput.value = currentTour.currency || "BDT";
  notesInput.value = currentTour.notes || "";
  if (currentTour.startDate) endDateInput.min = currentTour.startDate;

  refreshHeader();
  renderSharedTripNotice();
  renderExpenseList();
  renderChecklist();
  updateSummaryDisplay();

  if (currentTour.lat && currentTour.lon) {
    updateTourMapLocation(currentTour.lat, currentTour.lon, currentTour.placeLabel);
    qs("#mapCaption").textContent = currentTour.placeLabel || "";
    renderWeatherPlaceholder("Loading weather…");
    fetchWeather(currentTour.lat, currentTour.lon)
      .then((data) => renderWeather(data, currentTour.placeLabel))
      .catch((err) => {
        console.error(err);
        renderWeatherError("Could not load the latest weather. Try Check weather again.");
      });
  }

  /* ---------- shared trip state ---------- */

  function renderSharedTripNotice() {
    const box = qs("#sharedTripNotice");
    if (!box) return;

    if (!currentTour.id || currentTour.sharedMode !== "shared") {
      box.style.display = "none";
      box.innerHTML = "";
      return;
    }

    const members = Array.isArray(currentTour.members) ? currentTour.members : [];
    const names = members.map((member) => member.name).filter(Boolean);
    box.style.display = "block";
    box.innerHTML =
      '<strong>Shared trip</strong>' +
      '<span>Shared ID: ' + escapeHtml(currentTour.sharedTripId || "—") + '</span>' +
      '<span>' + (names.length ? ("Members: " + escapeHtml(names.join(", "))) : "Invite members with Share / Invite") + '</span>' +
      '<span class="shared-trip-hint">Local-first mode: same-browser members can use the shared local record; cross-device changes require sharing the latest link again.</span>';
  }

  /* ---------- header state ---------- */

  function refreshHeader() {
    if (currentTour.id) {
      qs("#plannerTitle").textContent = "Editing: " + (currentTour.destination || "trip");
      qs("#saveTourBtn").textContent = "Update tour";
      qs("#deleteTourBtn").style.display = "inline-flex";
      qs("#shareTripBtn").style.display = "inline-flex";
    } else {
      qs("#plannerTitle").textContent = "Plan a new tour";
      qs("#saveTourBtn").textContent = "Save tour";
      qs("#deleteTourBtn").style.display = "none";
      qs("#shareTripBtn").style.display = "none";
    }
  }

  /* ---------- live trip summary (PART 12C: budget math, divide-by-zero safe) ---------- */

  function updateSummaryDisplay() {
    const destination = destinationInput.value.trim();
    const start = startDateInput.value;
    const end = endDateInput.value;
    const currency = currencyInput.value || "BDT";
    const nights = tripDurationNights(start, end);

    // Reuse the tour's own numbers via computeBudgetSummary() (tour-store.js)
    // by reading the live form values into a throwaway tour-shaped object —
    // this way the Planner and the shared budget-math helper never drift.
    const summary = computeBudgetSummary({
      budget: Number(budgetInput.value) || 0,
      travelers: Number(travelersInput.value) || 1,
      expenses: currentTour.expenses,
    });

    qs("#summaryDestination").textContent = destination || "—";
    qs("#summaryDates").textContent = start && end ? formatDateRange(start, end) : "—";
    qs("#summaryDuration").textContent = nights > 0 ? nights + " night" + (nights === 1 ? "" : "s") : "—";
    qs("#summaryTravelers").textContent = summary.travelers;

    qs("#summaryBudget").textContent = formatCurrency(summary.totalBudget, currency);
    qs("#summaryBudgetPerPerson").textContent = formatCurrency(summary.perPersonBudget, currency) + "/person";
    qs("#summarySpent").textContent = formatCurrency(summary.totalSpent, currency);
    qs("#summarySpentPerPerson").textContent = formatCurrency(summary.perPersonSpent, currency) + "/person";

    const remainingEl = qs("#summaryRemaining");
    remainingEl.textContent = formatCurrency(summary.remaining, currency);
    remainingEl.classList.toggle("negative", summary.remaining < 0);
    qs("#summaryRemainingPerPerson").textContent = formatCurrency(summary.remainingPerPerson, currency) + "/person";

    const percent = summary.totalBudget > 0 ? Math.min(100, Math.round((summary.totalSpent / summary.totalBudget) * 100)) : 0;
    const fill = qs("#summaryProgressFill");
    fill.style.width = percent + "%";
    fill.classList.toggle("over-budget", summary.totalBudget > 0 && summary.totalSpent > summary.totalBudget);

    qs("#expenseTotal").textContent = formatCurrency(summary.totalSpent, currency);
  }

  [destinationInput, startDateInput, endDateInput, budgetInput, travelersInput, currencyInput].forEach((el) => {
    el.addEventListener("input", updateSummaryDisplay);
  });

  startDateInput.addEventListener("change", () => {
    endDateInput.min = startDateInput.value;
  });

  /* ---------- expenses ---------- */

  function renderExpenseList() {
    const list = qs("#expenseList");
    list.innerHTML = "";

    if (currentTour.expenses.length === 0) {
      const li = document.createElement("li");
      li.style.cssText = "justify-content:center;border-bottom:none;color:var(--ink-faint);padding:18px 0;";
      li.textContent = "No expenses logged yet.";
      list.appendChild(li);
      return;
    }

    currentTour.expenses.forEach((exp) => {
      const li = document.createElement("li");
      li.innerHTML =
        '<div class="expense-info"><span class="expense-name">' +
        escapeHtml(exp.name) +
        '</span><span class="expense-meta">' +
        escapeHtml(exp.category) +
        "</span></div>" +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span class="expense-amount">' + formatCurrency(exp.amount, currentTour.currency) + "</span>" +
        '<button class="icon-btn" data-delete-expense="' + exp.id + '" title="Remove expense" type="button">✕</button>' +
        "</div>";
      list.appendChild(li);
    });
  }

  qs("#expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const errorEl = qs("#expenseError");
    errorEl.textContent = "";

    const name = qs("#expenseName").value.trim();
    const category = qs("#expenseCategory").value;
    const amount = Number(qs("#expenseAmount").value);

    if (!name) {
      errorEl.textContent = "Enter what this expense was for.";
      return;
    }
    if (!amount || amount <= 0) {
      errorEl.textContent = "Enter an amount greater than 0.";
      return;
    }

    currentTour.expenses.push({ id: generateId("exp"), name, category, amount });
    qs("#expenseName").value = "";
    qs("#expenseAmount").value = "";

    renderExpenseList();
    updateSummaryDisplay();
    persistCurrentTour(false);
  });

  qs("#expenseList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-expense]");
    if (!btn) return;
    currentTour.expenses = currentTour.expenses.filter((exp) => exp.id !== btn.dataset.deleteExpense);
    renderExpenseList();
    updateSummaryDisplay();
    persistCurrentTour(false);
  });

  /* ---------- checklist (PART 13) ---------- */

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
        '<span>' + escapeHtml(item.text) + "</span>" +
        "</label>" +
        '<button class="icon-btn" data-delete-checklist="' + item.id + '" title="Remove item" type="button">✕</button>';
      list.appendChild(li);
    });
  }

  qs("#checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = qs("#checklistInput");
    const text = input.value.trim();
    if (!text) return;

    currentTour.checklist.push(createChecklistItem(text));
    input.value = "";

    renderChecklist();
    persistCurrentTour(false);
  });

  qs("#checklistList").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-delete-checklist]");
    if (deleteBtn) {
      currentTour.checklist = currentTour.checklist.filter((item) => item.id !== deleteBtn.dataset.deleteChecklist);
      renderChecklist();
      persistCurrentTour(false);
      return;
    }

    const checkbox = e.target.closest("[data-toggle-checklist]");
    if (checkbox) {
      const item = currentTour.checklist.find((i) => i.id === checkbox.dataset.toggleChecklist);
      if (item) item.checked = checkbox.checked;
      renderChecklist();
      persistCurrentTour(false);
    }
  });

  /* ---------- save / delete ---------- */

  function persistCurrentTour(showFeedback) {
    currentTour.destination = destinationInput.value.trim();
    currentTour.startDate = startDateInput.value;
    currentTour.endDate = endDateInput.value;
    currentTour.budget = Number(budgetInput.value) || 0;
    currentTour.travelers = Math.max(1, Number(travelersInput.value) || 1);
    currentTour.currency = currencyInput.value || "BDT";
    currentTour.notes = notesInput.value;

    qs("#destinationError").textContent = "";
    qs("#dateError").textContent = "";

    if (!currentTour.destination) {
      qs("#destinationError").textContent = "Enter a destination to save this trip.";
      return false;
    }
    if (currentTour.startDate && currentTour.endDate && currentTour.endDate < currentTour.startDate) {
      qs("#dateError").textContent = "End date should be on or after the start date.";
      return false;
    }

    // Bump the simple revision counter on every real save of an existing
    // trip (not on the very first save, which starts at revision 1) — this
    // is what lets an old Share/Invite link be recognized as out of date.
    if (currentTour.id) {
      currentTour.revision = (Number(currentTour.revision) || 1) + 1;
    }

    currentTour = upsertTour(currentTour);

    if (params.get("id") !== currentTour.id) {
      history.replaceState(null, "", "planner.html?id=" + encodeURIComponent(currentTour.id));
      params.set("id", currentTour.id);
    }

    refreshHeader();
    if (showFeedback) showToast("Trip saved ✓");
    return true;
  }

  qs("#saveTourBtn").addEventListener("click", () => persistCurrentTour(true));

  qs("#deleteTourBtn").addEventListener("click", () => {
    if (!currentTour.id) return;
    const ok = window.confirm('Delete the trip to "' + currentTour.destination + '"? This can\'t be undone.');
    if (!ok) return;
    deleteTour(currentTour.id);
    window.location.href = "dashboard.html";
  });

  /* ---------- share / local collaboration ---------- */

  const shareModal = qs("#shareModal");
  const shareLinkInput = qs("#shareLinkInput");
  const shareCopyBtn = qs("#shareCopyBtn");
  const shareNativeBtn = qs("#shareNativeBtn");
  const shareModalStatus = qs("#shareModalStatus");

  function openShareModal(link) {
    shareLinkInput.value = link;
    shareModalStatus.textContent = "";
    shareNativeBtn.style.display =
      typeof navigator !== "undefined" && typeof navigator.share === "function" ? "inline-flex" : "none";
    shareModal.style.display = "flex";
    shareModal.setAttribute("aria-hidden", "false");
    // Select the link so a plain Ctrl/Cmd+C always works even if the
    // Clipboard API itself is unavailable (e.g. non-HTTPS deployments).
    shareLinkInput.focus();
    shareLinkInput.select();
  }

  function closeShareModal() {
    shareModal.style.display = "none";
    shareModal.setAttribute("aria-hidden", "true");
  }

  qs("#shareModalClose").addEventListener("click", closeShareModal);
  qs("#shareModalCloseBtn").addEventListener("click", closeShareModal);
  shareModal.addEventListener("click", (e) => {
    if (e.target === shareModal) closeShareModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && shareModal.style.display !== "none") closeShareModal();
  });

  function copyShareLinkFallback() {
    try {
      const ok = document.execCommand("copy");
      shareModalStatus.textContent = ok
        ? "Link copied ✓"
        : "Couldn't copy automatically — the link is selected, press Ctrl/Cmd+C.";
    } catch (err) {
      shareModalStatus.textContent = "Couldn't copy automatically — the link is selected, press Ctrl/Cmd+C.";
    }
  }

  shareCopyBtn.addEventListener("click", () => {
    shareLinkInput.focus();
    shareLinkInput.select();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(shareLinkInput.value)
        .then(() => {
          shareModalStatus.textContent = "Link copied ✓";
        })
        .catch(copyShareLinkFallback);
    } else {
      copyShareLinkFallback();
    }
  });

  shareNativeBtn.addEventListener("click", () => {
    navigator
      .share({
        title: "Join my TourMate trip",
        text: "Anyone with this link can import a copy of this trip in TourMate.",
        url: shareLinkInput.value,
      })
      .catch(() => {
        // User cancellation is normal; no error toast is needed.
      });
  });

  qs("#shareTripBtn").addEventListener("click", () => {
    if (!currentTour.id) return;

    // Always save the latest form values (and bump the revision counter)
    // before generating the snapshot, so the link reflects what's on screen.
    const saved = persistCurrentTour(false);
    if (!saved) return;

    currentTour.ownerName = session.name;
    currentTour.members = Array.isArray(currentTour.members) ? currentTour.members : [];
    if (!currentTour.members.some((member) => member.ownerId === session.ownerId)) {
      currentTour.members.unshift({
        ownerId: session.ownerId,
        name: session.name,
        role: "owner",
        joinedAt: new Date().toISOString(),
      });
    }

    const link = buildInviteLink(currentTour);
    openShareModal(link);

    refreshHeader();
    renderSharedTripNotice();
  });

  /* ---------- weather + map (share one geocoding lookup) ---------- */

  qs("#weatherBtn").addEventListener("click", handleCheckWeather);

  // Typing a destination alone only updates the trip summary text (see the
  // "input" listener above) — actually placing it on the map/weather card
  // needs a geocoding lookup, which used to require finding the "Check
  // weather" button. Enter now does the same thing, so the obvious action
  // ("type destination, hit Enter") also works.
  destinationInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCheckWeather();
    }
  });

  async function handleCheckWeather() {
    const destination = destinationInput.value.trim();
    qs("#destinationError").textContent = "";

    if (!destination) {
      qs("#destinationError").textContent = "Enter a destination first.";
      return;
    }

    const btn = qs("#weatherBtn");
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Checking…";
    renderWeatherPlaceholder("Looking up " + destination + "…");
    qs("#mapCaption").textContent = "Looking up " + destination + "…";

    try {
      const place = await geocodeDestination(destination);
      if (!place) {
        renderWeatherError("Couldn't find that place. Try a different spelling.");
        qs("#mapCaption").textContent = "Couldn't find that place on the map.";
        return;
      }

      currentTour.lat = place.lat;
      currentTour.lon = place.lon;
      currentTour.placeLabel = place.label;

      const weatherData = await fetchWeather(place.lat, place.lon);
      renderWeather(weatherData, place.label);
      updateTourMapLocation(place.lat, place.lon, place.label);
      qs("#mapCaption").textContent = place.label;

      persistCurrentTour(false);
    } catch (err) {
      console.error(err);
      renderWeatherError("Something went wrong fetching the weather. Check your connection and try again.");
      qs("#mapCaption").textContent = "Map could not be updated.";
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
})();
