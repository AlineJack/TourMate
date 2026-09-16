/* =========================================================
   join.js — local-first Share / Invite flow
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("dashboard");

  const params = new URLSearchParams(window.location.search);
  const payload = decodeInvitePayload(params.get("invite"));

  if (!payload) {
    qs("#invalidInvite").style.display = "";
    qs("#invitePreview").style.display = "none";
    return;
  }

  qs("#invitePreview").style.display = "";
  qs("#inviteDestination").textContent = payload.destination || "—";
  qs("#inviteDates").textContent =
    payload.startDate && payload.endDate ? formatDateRange(payload.startDate, payload.endDate) : "—";
  qs("#inviteBudget").textContent = formatCurrency(payload.budget || 0, payload.currency || "BDT");
  qs("#joinNameInput").value = session.name || "";

  const existing = getSharedTourForSession(payload.sharedTripId || payload.token, session.ownerId) ||
    getAllTours().find((tour) => tour.sharedTripId === (payload.sharedTripId || payload.token));

  const button = qs("#joinTripBtn");
  const status = qs("#joinModeText");
  const conflictBox = qs("#inviteConflict");
  const conflictText = qs("#conflictText");

  const conflictStatus = getInviteConflictStatus(existing, payload);

  function goToTour(tour) {
    window.location.href = "planner.html?id=" + encodeURIComponent(tour.id);
  }

  function doJoinOrUpdate() {
    const memberName = qs("#joinNameInput").value.trim() || session.name || "Trip member";

    if (existing) {
      const tour = updateTourFromInvite(existing, payload, memberName, session.ownerId);
      if (!tour) {
        showToast("This invite no longer matches the local shared trip");
        return;
      }
      showToast("Shared trip updated from the latest link");
      goToTour(tour);
    } else {
      const tour = joinTourFromInvite(session.ownerId, payload, memberName);
      showToast("Joined trip — your local shared copy is ready");
      goToTour(tour);
    }
  }

  if (conflictStatus === "older") {
    // The local copy has been edited more times than this link has —
    // importing it as-is would silently throw those edits away, so make
    // the person choose instead of doing it for them.
    button.style.display = "none";
    conflictBox.style.display = "block";
    conflictText.textContent =
      "Your local copy of this trip (revision " + (Number(existing.revision) || 1) + ") looks newer than this link " +
      "(revision " + (Number(payload.revision) || 1) + "). Updating from this link will overwrite those local changes.";

    qs("#keepLocalBtn").addEventListener("click", () => goToTour(existing));
    qs("#overwriteBtn").addEventListener("click", doJoinOrUpdate);

    if (status) {
      status.textContent = "This link is behind your local copy of the trip.";
    }
  } else {
    conflictBox.style.display = "none";

    if (existing) {
      button.textContent = "Update my local copy";
      if (status) {
        status.textContent =
          "A local copy of this Shared Trip ID already exists on this browser. Updating it imports the latest snapshot from this link.";
      }
    } else if (status) {
      status.textContent =
        "Joining imports this trip into your local TourMate data. A shared link does not create a live server connection in local-first mode.";
    }

    button.addEventListener("click", doJoinOrUpdate);
  }
})();
