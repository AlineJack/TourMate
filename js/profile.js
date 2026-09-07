/* =========================================================
   profile.js — logic for profile.html only

   View mode shows name, email, bio, gender, home address and
   saved-plan count. Edit mode is a form that writes:
     - name              -> Firebase Auth displayName (skipped for guests)
     - bio/gender/address -> loadProfileExtra()/saveProfileExtra() in
                              storage.js (localStorage, same as tour data)
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;
  initNavbar("profile");

  const GENDER_LABELS = {
    "":       "Not set",
    "female": "Female",
    "male":   "Male",
  };

  /** Rejects with `message` if `promise` hasn't settled within `ms`, so a save can never hang forever. */
  function withTimeout(promise, ms, message) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        reject(new Error(message));
      }, ms);

      promise.then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function renderAvatarAndName(name) {
    const initials = session.isGuest
      ? "G"
      : name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join("");

    qs("#avatarCircle").textContent = initials || "?";
    qs("#profileName").textContent = name;
  }

  function renderDetails(extra) {
    const data = extra || {};
    qs("#profileBioView").textContent = data.bio ? data.bio : "Not set";
    qs("#profileGenderView").textContent = data.gender ? (GENDER_LABELS[data.gender] || data.gender) : "Not set";
    qs("#profileAddressView").textContent = data.homeAddress ? data.homeAddress : "Not set";
  }

  /* ---------- initial render ---------- */

  renderAvatarAndName(session.name);
  qs("#profileEmail").textContent = session.isGuest ? "Guest session — no account" : session.email;

  const tourCount = getToursForOwner(session.ownerId).length;
  qs("#profilePlanCount").textContent = tourCount;

  if (session.isGuest) {
    qs("#guestNote").style.display = "block";
    qs("#createAccountBtn").style.display = "inline-flex";
  }

  let currentExtra = {};

  loadProfileExtra(session).then(function (extra) {
    currentExtra = extra || {};
    renderDetails(currentExtra);
  });

  /* ---------- logout ---------- */

  function logout() {
    // clearSession() now returns a Promise (it calls auth.signOut() internally)
    clearSession().then(() => {
      window.location.href = "index.html";
    });
  }

  qs("#profileLogoutBtn").addEventListener("click", logout);

  /* ---------- edit mode ---------- */

  const viewMode  = qs("#profileViewMode");
  const form      = qs("#profileForm");

  function setFieldError(id, message) {
    const el = qs("#" + id);
    if (el) el.textContent = message || "";
  }

  function setFormMessage(message, type) {
    const el = qs("#profileFormMessage");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("error", "success");
    el.classList.add(type || "error");
    el.classList.toggle("show", Boolean(message));
  }

  function enterEditMode() {
    qs("#profileNameInput").value = session.isGuest ? "" : session.name;
    qs("#profileNameInput").disabled = session.isGuest;
    qs("#profileBioInput").value = currentExtra.bio || "";
    qs("#profileGenderInput").value = currentExtra.gender || "";
    qs("#profileAddressInput").value = currentExtra.homeAddress || "";

    setFieldError("profileNameError", "");
    setFieldError("profileBioError", "");
    setFieldError("profileAddressError", "");
    setFormMessage("");

    viewMode.style.display = "none";
    form.style.display = "block";
  }

  function exitEditMode() {
    form.style.display = "none";
    viewMode.style.display = "block";
  }

  qs("#editProfileBtn").addEventListener("click", enterEditMode);
  qs("#cancelEditBtn").addEventListener("click", exitEditMode);

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    setFieldError("profileNameError", "");
    setFieldError("profileBioError", "");
    setFieldError("profileAddressError", "");
    setFormMessage("");

    const name        = qs("#profileNameInput").value.trim();
    const bio          = qs("#profileBioInput").value.trim();
    const gender       = qs("#profileGenderInput").value;
    const homeAddress = qs("#profileAddressInput").value.trim();

    let hasError = false;

    if (!session.isGuest && name.length < 2) {
      setFieldError("profileNameError", "Enter your name.");
      hasError = true;
    }

    if (bio.length > 300) {
      setFieldError("profileBioError", "Keep your bio under 300 characters.");
      hasError = true;
    }

    if (homeAddress.length > 200) {
      setFieldError("profileAddressError", "Keep your address under 200 characters.");
      hasError = true;
    }

    if (hasError) return;

    const saveBtn = qs("#saveProfileBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    // Guests have no Firebase user to rename — only the local session
    // snapshot is updated for them. Real accounts update Auth too, since
    // the navbar and dashboard read displayName-derived data from it.
    const updateName = session.isGuest || !auth.currentUser
      ? Promise.resolve()
      : auth.currentUser.updateProfile({ displayName: name });

    const savePromise = updateName.then(function () {
      return saveProfileExtra(session, { bio: bio, gender: gender, homeAddress: homeAddress });
    });

    // Guards against a hung network call (e.g. no connection) leaving the
    // button stuck on "Saving…" forever.
    withTimeout(savePromise, 12000, "That took too long — check your internet connection and try again.")
      .then(function (savedExtra) {
        currentExtra = savedExtra;

        if (!session.isGuest) {
          session.name = name;
          updateSessionFields({ name: name });
        }

        renderAvatarAndName(session.name);
        renderDetails(currentExtra);

        saveBtn.disabled = false;
        saveBtn.textContent = "Save changes";

        exitEditMode();
        showToast("Profile updated");
      })
      .catch(function (error) {
        console.error("Profile update failed:", error);

        saveBtn.disabled = false;
        saveBtn.textContent = "Save changes";

        setFormMessage(
          (error && error.message) || "Something went wrong saving your profile. Please try again.",
          "error"
        );
      });
  });
})();
