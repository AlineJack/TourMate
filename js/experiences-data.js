/* =========================================================
   experiences-data.js
   The ONLY file that talks to Firestore/Storage for Traveler
   Experiences. Every other page goes through the functions
   here instead of calling `db`/`fbStorage` directly, so the
   handful of real cloud reads/writes this app makes are easy
   to find, audit, and keep cheap.

   Collection: experiences
     userId          string   — Firebase uid of the traveler (never a guest)
     userName        string   — denormalized so cards don't need a lookup read
     destinationId   string   — matches a DESTINATIONS[].id from destinations.js
     destinationName string   — denormalized, same reason as userName
     title           string
     tripDuration    number   — days
     approxCost      number   — approx BDT per person
     rating          number   — 1-5
     description     string   — the traveler's story
     placesVisited   string[]
     tips            string[] — "Traveler Recommendations" (PART 9)
     days            {title, description}[] — optional day-by-day (PART 10)
     photos          string[] — optional Storage download URLs, max 5
     helpfulCount    number
     createdAt       Firestore server timestamp

   Query design deliberately avoids composite indexes (PART 15,
   PART 22 — keep Firestore usage simple and cheap): every query
   filters or orders on a single field; where a destination page
   needs both a filter AND a chronological order, sorting happens
   client-side on the (small) result set instead of asking
   Firestore for a composite index.
   ========================================================= */

const EXPERIENCES_COLLECTION = "experiences";
const MAX_EXPERIENCE_PHOTOS = 5;
const MAX_PHOTO_DIMENSION = 1280;
const MAX_ORIGINAL_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB — guard before we even try to compress

/* ---------- reads ---------- */

/** Most recent experiences across all destinations, for Home + the Experiences browse page. */
function getRecentExperiences(limitCount) {
  return db
    .collection(EXPERIENCES_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limitCount || 6)
    .get()
    .then(snapshotToList);
}

/** Most "helpful" experiences, for Home's "Popular traveler experiences". */
function getPopularExperiences(limitCount) {
  return db
    .collection(EXPERIENCES_COLLECTION)
    .orderBy("helpfulCount", "desc")
    .limit(limitCount || 3)
    .get()
    .then(snapshotToList);
}

/**
 * Experiences for one destination, newest first. Filters server-side,
 * sorts client-side (see file header) so this never needs a composite index.
 */
function getExperiencesByDestination(destinationId, limitCount) {
  return db
    .collection(EXPERIENCES_COLLECTION)
    .where("destinationId", "==", destinationId)
    .limit(limitCount || 20)
    .get()
    .then(snapshotToList)
    .then((list) => list.sort(byCreatedAtDesc));
}

function getExperienceById(id) {
  return db
    .collection(EXPERIENCES_COLLECTION)
    .doc(id)
    .get()
    .then((doc) => (doc.exists ? docToExperience(doc) : null));
}

function snapshotToList(snapshot) {
  const list = [];
  snapshot.forEach((doc) => list.push(docToExperience(doc)));
  return list;
}

function docToExperience(doc) {
  return Object.assign({ id: doc.id }, doc.data());
}

function byCreatedAtDesc(a, b) {
  const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
  const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
  return bTime - aTime;
}

/* ---------- writes ---------- */

/**
 * Creates a Traveler Experience. `photoFiles` is a plain array of File
 * objects (already validated/compressed by compressImageForUpload before
 * being passed in) — pass [] or omit for a photo-free post (PART 14: a
 * user must be able to publish without photos).
 *
 * Returns a Promise resolving to the new experience's id.
 */
function createExperience(session, fields, photoFiles) {
  if (!session || session.isGuest) {
    return Promise.reject(new Error("Create a free account to share a traveler experience."));
  }

  const docRef = db.collection(EXPERIENCES_COLLECTION).doc(); // generates an id, doesn't write yet
  const files = (photoFiles || []).slice(0, MAX_EXPERIENCE_PHOTOS);

  const uploadPromise = files.length
    ? uploadExperiencePhotos(session.ownerId, docRef.id, files)
    : Promise.resolve([]);

  return uploadPromise.then((photoUrls) => {
    return docRef.set({
      userId: session.ownerId,
      userName: session.name,
      destinationId: fields.destinationId,
      destinationName: fields.destinationName,
      title: fields.title,
      tripDuration: Number(fields.tripDuration) || 0,
      approxCost: Number(fields.approxCost) || 0,
      rating: Number(fields.rating) || 0,
      description: fields.description || "",
      placesVisited: fields.placesVisited || [],
      tips: fields.tips || [],
      days: fields.days || [],
      photos: photoUrls,
      helpfulCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }).then(() => docRef.id);
}

function uploadExperiencePhotos(ownerId, experienceId, files) {
  const uploads = files.map((file, index) => {
    const path = "experience-photos/" + ownerId + "/" + experienceId + "/" + index + ".jpg";
    return fbStorage
      .ref(path)
      .put(file, { contentType: "image/jpeg" })
      .then((snapshot) => snapshot.ref.getDownloadURL());
  });
  return Promise.all(uploads);
}

/**
 * Marks an experience helpful. Guarded by the caller checking
 * hasMarkedHelpful() first (storage.js) so the same browser can't
 * inflate the count — this keeps the whole feature to one field
 * update instead of a second collection of per-user votes.
 */
function markExperienceHelpful(experienceId) {
  return db
    .collection(EXPERIENCES_COLLECTION)
    .doc(experienceId)
    .update({ helpfulCount: firebase.firestore.FieldValue.increment(1) });
}

/* ---------- photo compression (client-side, PART 14) ---------- */

/**
 * Resizes an image File down to at most MAX_PHOTO_DIMENSION on its
 * longest side and re-encodes it as JPEG, entirely in the browser —
 * no upload of the original, no server-side processing.
 * Rejects with a user-facing message for non-image or oversized files.
 */
function compressImageForUpload(file) {
  if (!file.type || file.type.indexOf("image/") !== 0) {
    return Promise.reject(new Error(file.name + " isn't an image file."));
  }
  if (file.size > MAX_ORIGINAL_PHOTO_BYTES) {
    return Promise.reject(new Error(file.name + " is too large (max 10MB before compression)."));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height && width > MAX_PHOTO_DIMENSION) {
        height = Math.round((height * MAX_PHOTO_DIMENSION) / width);
        width = MAX_PHOTO_DIMENSION;
      } else if (height > MAX_PHOTO_DIMENSION) {
        width = Math.round((width * MAX_PHOTO_DIMENSION) / height);
        height = MAX_PHOTO_DIMENSION;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process " + file.name))),
        "image/jpeg",
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(file.name + " could not be read as an image."));
    };

    img.src = objectUrl;
  });
}
