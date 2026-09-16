/* =========================================================
   experience-form.js
   Creates a Traveler Experience, saved locally via
   experience-store.js. Only real, signed-in accounts may post
   (guests see an explanatory notice instead) — this is a
   product choice carried over unchanged from the original
   design (so a posted experience reads as coming from a real
   traveler), not a technical limitation of local storage.
   Photos are optional and compressed client-side before saving.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  if (session.isGuest) {
    qs("#guestNotice").style.display = "";
    qs("#experienceForm").style.display = "none";
    initNavbar("experiences");
    return;
  }

  initNavbar("experiences");
  qs("#experienceForm").style.display = "";

  const places = [];
  const tips = [];
  const days = []; // { id, title, description }
  const photos = []; // { id, dataUrl } — dataUrl is already compressed (see compressImageForLocalStorage)
  let rating = 0;

  populateDestinationField();
  renderRatingPicker();
  renderPlaces();
  renderTips();
  renderDays();
  renderPhotoPreviews();

  qs("#addPlaceBtn").addEventListener("click", () => addToList(qs("#placeInput"), places, renderPlaces));
  qs("#addTipBtn").addEventListener("click", () => addToList(qs("#tipInput"), tips, renderTips));
  qs("#addDayBtn").addEventListener("click", () => {
    days.push({ id: generateId("day"), title: "", description: "" });
    renderDays();
  });

  qs("#placesList").addEventListener("click", (e) => removeFromList(e, "[data-remove-place]", places, renderPlaces));
  qs("#tipsList").addEventListener("click", (e) => removeFromList(e, "[data-remove-tip]", tips, renderTips));

  qs("#photoInput").addEventListener("change", handlePhotoSelection);

  qs("#experienceForm").addEventListener("submit", handleSubmit);

  /**
   * The destination field is free text (PART 4 of this phase) — any
   * destination is valid, not just ones in TourMate's curated catalog.
   * The datalist below is a convenience, not a restriction: typing
   * "Tanguar Haor" or "a small village" works exactly the same either way.
   */
  function populateDestinationField() {
    const datalist = qs("#destinationSuggestions");
    getAllDestinations().forEach((dest) => {
      const opt = document.createElement("option");
      opt.value = dest.name;
      datalist.appendChild(opt);
    });

    const params = new URLSearchParams(window.location.search);
    const preset = params.get("destination");
    if (preset) qs("#expDestination").value = preset;
  }

  function renderRatingPicker() {
    const container = qs("#ratingPicker");
    container.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "star-btn" + (i <= rating ? " filled" : "");
      btn.textContent = i <= rating ? "★" : "☆";
      btn.setAttribute("aria-label", i + " star" + (i === 1 ? "" : "s"));
      btn.addEventListener("click", () => {
        rating = i;
        renderRatingPicker();
      });
      container.appendChild(btn);
    }
  }

  const MAX_LIST_ITEMS = 15; // keeps each experience's stored size reasonable for localStorage

  function addToList(input, list, renderFn) {
    const value = input.value.trim();
    if (!value) return;
    if (list.length >= MAX_LIST_ITEMS) {
      showToast("You can add up to " + MAX_LIST_ITEMS + " of these");
      return;
    }
    list.push(value);
    input.value = "";
    renderFn();
  }

  function removeFromList(e, selector, list, renderFn) {
    const btn = e.target.closest(selector);
    if (!btn) return;
    list.splice(Number(btn.dataset.index), 1);
    renderFn();
  }

  function renderPlaces() {
    const list = qs("#placesList");
    list.innerHTML = "";
    if (places.length === 0) {
      list.innerHTML = '<li class="empty-hint">No places added yet.</li>';
      return;
    }
    places.forEach((place, index) => {
      const li = document.createElement("li");
      li.className = "chip-item";
      li.innerHTML =
        "<span>" + escapeHtml(place) + "</span>" +
        '<button type="button" class="icon-btn" data-remove-place data-index="' + index + '" title="Remove">✕</button>';
      list.appendChild(li);
    });
  }

  function renderTips() {
    const list = qs("#tipsList");
    list.innerHTML = "";
    if (tips.length === 0) {
      list.innerHTML = '<li class="empty-hint">No tips added yet.</li>';
      return;
    }
    tips.forEach((tip, index) => {
      const li = document.createElement("li");
      li.className = "chip-item";
      li.innerHTML =
        "<span>" + escapeHtml(tip) + "</span>" +
        '<button type="button" class="icon-btn" data-remove-tip data-index="' + index + '" title="Remove">✕</button>';
      list.appendChild(li);
    });
  }

  function renderDays() {
    const container = qs("#daysList");
    container.innerHTML = "";

    if (days.length === 0) {
      container.innerHTML = '<p class="empty-hint">No day-by-day breakdown added — that\'s okay, it\'s optional.</p>';
      return;
    }

    days.forEach((day, index) => {
      const block = document.createElement("div");
      block.className = "day-block";
      block.innerHTML =
        '<div class="day-block-head"><strong>Day ' + (index + 1) + "</strong>" +
        '<button type="button" class="icon-btn" data-remove-day="' + day.id + '" title="Remove day">✕</button></div>' +
        '<input type="text" class="field-input" data-day-title="' + day.id + '" placeholder="e.g. Travel and check-in" value="' + escapeHtml(day.title) + '" />' +
        '<textarea class="field-input" rows="2" data-day-desc="' + day.id + '" placeholder="What happened this day?">' + escapeHtml(day.description) + "</textarea>";
      container.appendChild(block);
    });

    qsa("[data-day-title]", container).forEach((input) => {
      input.addEventListener("input", () => {
        const day = days.find((d) => d.id === input.dataset.dayTitle);
        if (day) day.title = input.value;
      });
    });
    qsa("[data-day-desc]", container).forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const day = days.find((d) => d.id === textarea.dataset.dayDesc);
        if (day) day.description = textarea.value;
      });
    });
    qsa("[data-remove-day]", container).forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = days.findIndex((d) => d.id === btn.dataset.removeDay);
        if (idx !== -1) days.splice(idx, 1);
        renderDays();
      });
    });
  }

  function handlePhotoSelection(e) {
    const errorEl = qs("#photoError");
    errorEl.textContent = "";

    const files = Array.from(e.target.files || []);
    const remainingSlots = MAX_EXPERIENCE_PHOTOS - photos.length;

    if (files.length > remainingSlots) {
      errorEl.textContent = "Only " + MAX_EXPERIENCE_PHOTOS + " photos allowed — added the first " + Math.max(remainingSlots, 0) + ".";
    }

    files.slice(0, remainingSlots).forEach((file) => {
      compressImageForLocalStorage(file)
        .then((dataUrl) => {
          photos.push({ id: generateId("photo"), dataUrl: dataUrl });
          renderPhotoPreviews();
        })
        .catch((err) => {
          errorEl.textContent = err.message;
        });
    });

    e.target.value = ""; // allow re-selecting the same file later
  }

  function renderPhotoPreviews() {
    const row = qs("#photoPreviewRow");
    row.innerHTML = "";
    photos.forEach((photo) => {
      const wrap = document.createElement("div");
      wrap.className = "photo-preview";
      const img = document.createElement("img");
      img.src = photo.dataUrl;
      img.alt = "Photo preview";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "icon-btn photo-remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.title = "Remove photo";
      removeBtn.addEventListener("click", () => {
        const idx = photos.findIndex((p) => p.id === photo.id);
        if (idx !== -1) photos.splice(idx, 1);
        renderPhotoPreviews();
      });
      wrap.appendChild(img);
      wrap.appendChild(removeBtn);
      row.appendChild(wrap);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errorEl = qs("#expFormError");
    errorEl.textContent = "";

    // Free text — any destination is valid, not just ones in the
    // curated catalog (a small village, "Tanguar Haor", etc.)
    const destination = qs("#expDestination").value.trim();
    const title = qs("#expTitle").value.trim();
    const tripDuration = Number(qs("#expDuration").value);
    const approxCost = Number(qs("#expCost").value);
    const description = qs("#expDescription").value.trim();

    if (!destination || !title || !tripDuration || tripDuration < 1 || !description || rating < 1) {
      errorEl.textContent = "Please fill in destination, title, duration, your story, and a rating.";
      return;
    }

    const submitBtn = qs("#submitExpBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing…";

    const fields = {
      destination: destination,
      title: title,
      tripDuration: tripDuration,
      approxCost: approxCost,
      rating: rating,
      description: description,
      places: places,
      tips: tips,
      days: days.filter((d) => d.title.trim() || d.description.trim()).map((d) => ({ title: d.title.trim(), description: d.description.trim() })),
    };

    saveExperience(session, fields, photos.map((p) => p.dataUrl))
      .then((id) => {
        showToast("Experience published");
        window.location.href = "experience.html?id=" + id;
      })
      .catch((err) => {
        console.error("Could not publish experience:", err);
        errorEl.textContent = err.message || "Could not publish your experience. Please try again.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Publish experience";
      });
  }
})();
