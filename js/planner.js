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
  const notesInput = qs("#notesInput");

  /* ---------- load the right tour ---------- */

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  let currentTour;

  if (requestedId) {
    const existing = getTourById(requestedId);
    if (existing && existing.ownerId === session.ownerId) {
      currentTour = existing;
    } else {
      // stale or foreign id — fall back to a fresh tour instead of erroring out
      currentTour = createBlankTour(session.ownerId);
      history.replaceState(null, "", "planner.html");
    }
  } else {
    currentTour = createBlankTour(session.ownerId);
  }

  /* ---------- populate the form from the tour ---------- */

  destinationInput.value = currentTour.destination || "";
  startDateInput.value = currentTour.startDate || "";
  endDateInput.value = currentTour.endDate || "";
  budgetInput.value = currentTour.budget || "";
  notesInput.value = currentTour.notes || "";
  if (currentTour.startDate) endDateInput.min = currentTour.startDate;

  refreshHeader();
  renderExpenseList();
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

  /* ---------- header state ---------- */

  function refreshHeader() {
    if (currentTour.id) {
      qs("#plannerTitle").textContent = "Editing: " + (currentTour.destination || "trip");
      qs("#saveTourBtn").textContent = "Update tour";
      qs("#deleteTourBtn").style.display = "inline-flex";
    } else {
      qs("#plannerTitle").textContent = "Plan a new tour";
      qs("#saveTourBtn").textContent = "Save tour";
      qs("#deleteTourBtn").style.display = "none";
    }
  }

  /* ---------- live trip summary ---------- */

  function updateSummaryDisplay() {
    const destination = destinationInput.value.trim();
    const start = startDateInput.value;
    const end = endDateInput.value;
    const budget = Number(budgetInput.value) || 0;
    const spent = totalSpent(currentTour.expenses);
    const remaining = budget - spent;
    const nights = tripDurationNights(start, end);

    qs("#summaryDestination").textContent = destination || "—";
    qs("#summaryDates").textContent = start && end ? formatDateRange(start, end) : "—";
    qs("#summaryDuration").textContent = nights > 0 ? nights + " night" + (nights === 1 ? "" : "s") : "—";
    qs("#summaryBudget").textContent = formatMoney(budget);
    qs("#summarySpent").textContent = formatMoney(spent);

    const remainingEl = qs("#summaryRemaining");
    remainingEl.textContent = formatMoney(remaining);
    remainingEl.classList.toggle("negative", remaining < 0);

    const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const fill = qs("#summaryProgressFill");
    fill.style.width = percent + "%";
    fill.classList.toggle("over-budget", budget > 0 && spent > budget);

    qs("#expenseTotal").textContent = formatMoney(spent);
  }

  [destinationInput, startDateInput, endDateInput, budgetInput].forEach((el) => {
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
        '<span class="expense-amount">' + formatMoney(exp.amount) + "</span>" +
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

  /* ---------- save / delete ---------- */

  function persistCurrentTour(showFeedback) {
    currentTour.destination = destinationInput.value.trim();
    currentTour.startDate = startDateInput.value;
    currentTour.endDate = endDateInput.value;
    currentTour.budget = Number(budgetInput.value) || 0;
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

  /* ---------- weather + map (share one geocoding lookup) ---------- */

  qs("#weatherBtn").addEventListener("click", handleCheckWeather);

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
