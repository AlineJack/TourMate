/* =========================================================
   profile.js — logic for profile.html only

   Everything here — name, bio, gender, home address — now
   saves through profile-store.js straight to localStorage.
   Saving no longer calls auth.currentUser.updateProfile(), so
   it can't hang or fail because Firebase is unreachable; only
   the account's email/login stays with Firebase Auth.
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

  function renderDetails(profile) {
    qs("#profileBioView").textContent = profile.bio ? profile.bio : "Not set";
    qs("#profileGenderView").textContent = profile.gender ? (GENDER_LABELS[profile.gender] || profile.gender) : "Not set";
    qs("#profileAddressView").textContent = profile.homeAddress ? profile.homeAddress : "Not set";
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

  let currentProfile = getProfile(session);
  renderDetails(currentProfile);

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
    qs("#profileBioInput").value = currentProfile.bio || "";
    qs("#profileGenderInput").value = currentProfile.gender || "";
    qs("#profileAddressInput").value = currentProfile.homeAddress || "";

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

    // Purely local now — no Firebase call, so this can't hang waiting on
    // a network response. Guests keep their local-only display name;
    // real accounts get their cached session name refreshed too (see
    // profile-store.js's saveProfile), so the navbar updates immediately.
    saveProfile(session, { name: session.isGuest ? session.name : name, bio: bio, gender: gender, homeAddress: homeAddress })
      .then(function (savedProfile) {
        currentProfile = savedProfile;

        renderAvatarAndName(session.name);
        renderDetails(currentProfile);

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
