/* =========================================================
   experience-store.js
   Traveler Experiences, entirely on localStorage for this
   phase. This is now the ONLY code path the UI uses — the
   Firestore version (experiences-data.js) is kept in the
   project, unused, for the future Firebase migration; nothing
   in this file touches `db` or `fbStorage`.

   Experience shape:
     id, destination (free text), title, description, author,
     authorId, rating, places[], tips[], days[], photos[],
     helpfulCount, createdAt, isSample
   ========================================================= */

const EXPERIENCES_KEY = "tourmate_experiences";
const MAX_EXPERIENCE_PHOTOS = 5;

// Local-storage photo limits are deliberately tighter than a real upload
// service would need — everything here lives in the same small
// per-origin localStorage quota as the rest of the app's data.
const MAX_PHOTO_DIMENSION = 800;
const MAX_PHOTO_DATA_URL_LENGTH = 350000; // ~260KB binary once base64 overhead is removed

/* ---------- low-level read/write ---------- */

function getAllExperiences() {
  return readJSON(EXPERIENCES_KEY, []);
}

function saveAllExperiences(list) {
  return writeJSON(EXPERIENCES_KEY, list);
}

/* ---------- public read API ---------- */

function getExperiences() {
  return getAllExperiences();
}

function getExperienceById(id) {
  return getAllExperiences().find((e) => e.id === id) || null;
}

/** Free-text match against destination (PART 4/8: not tied to the curated destination list at all). */
function getExperiencesByDestination(destinationText) {
  const needle = normalizeText(destinationText);
  if (!needle) return [];
  return getAllExperiences().filter((e) => matchesDestination(e, needle));
}

/** Matches destination, title, or description — used by the Experiences search box. */
function searchExperiences(query) {
  const needle = normalizeText(query);
  if (!needle) return getAllExperiences();
  return getAllExperiences().filter(
    (e) =>
      matchesDestination(e, needle) ||
      normalizeText(e.title).includes(needle) ||
      normalizeText(e.description).includes(needle)
  );
}

function getRecentExperiences(limitCount) {
  return getAllExperiences()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limitCount || 12);
}

function getPopularExperiences(limitCount) {
  return getAllExperiences()
    .sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0))
    .slice(0, limitCount || 12);
}

function getSavedExperiencesFull(ownerId) {
  const ids = getSavedExperienceIds(ownerId);
  return getAllExperiences().filter((e) => ids.includes(e.id));
}

function normalizeText(text) {
  return (text || "").toString().trim().toLowerCase();
}

function matchesDestination(experience, needle) {
  return normalizeText(experience.destination).includes(needle) || needle.includes(normalizeText(experience.destination));
}

/* ---------- write API ---------- */

/**
 * Builds and saves a new experience. `photoDataUrls` are already-
 * compressed data URL strings (see compressImageForLocalStorage,
 * called once by the form at photo-selection time — not repeated
 * here). Returns a Promise resolving to the new experience's id;
 * never touches the network, so it cannot hang waiting on a server.
 */
function saveExperience(session, fields, photoDataUrls) {
  return Promise.resolve().then(() => {
    const experience = {
      id: generateId("exp"),
      destination: fields.destination,
      title: fields.title,
      description: fields.description,
      author: session.name,
      authorId: session.ownerId,
      rating: Number(fields.rating) || 0,
      places: fields.places || [],
      tips: fields.tips || [],
      days: fields.days || [],
      tripDuration: Number(fields.tripDuration) || 0,
      approxCost: Number(fields.approxCost) || 0,
      photos: (photoDataUrls || []).slice(0, MAX_EXPERIENCE_PHOTOS),
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
      isSample: false,
    };

    const list = getAllExperiences();
    list.push(experience);
    const ok = saveAllExperiences(list);
    if (!ok) {
      throw new Error("Could not save — your browser's local storage may be full. Try removing a photo.");
    }
    return experience.id;
  });
}

function updateExperience(experience) {
  const list = getAllExperiences();
  const index = list.findIndex((e) => e.id === experience.id);
  if (index === -1) return false;
  list[index] = experience;
  return saveAllExperiences(list);
}

function deleteExperience(id) {
  const list = getAllExperiences().filter((e) => e.id !== id);
  return saveAllExperiences(list);
}

/* ---------- helpful + save (PART 9, all local) ---------- */

function getAllSavedExperiences() {
  return readJSON("tourmate_saved_experiences", {});
}

function getSavedExperienceIds(ownerId) {
  if (!ownerId) return [];
  return getAllSavedExperiences()[ownerId] || [];
}

function isExperienceSaved(ownerId, experienceId) {
  return getSavedExperienceIds(ownerId).includes(experienceId);
}

function toggleSavedExperience(ownerId, experienceId) {
  if (!ownerId) return false;
  const all = getAllSavedExperiences();
  const current = all[ownerId] || [];
  const isSaved = current.includes(experienceId);

  all[ownerId] = isSaved ? current.filter((id) => id !== experienceId) : current.concat([experienceId]);
  writeJSON("tourmate_saved_experiences", all);
  return !isSaved;
}

function getAllHelpfulMarks() {
  return readJSON("tourmate_helpful_marks", {});
}

function hasMarkedHelpful(ownerId, experienceId) {
  if (!ownerId) return false;
  return (getAllHelpfulMarks()[ownerId] || []).includes(experienceId);
}

/**
 * Marks an experience helpful exactly once per (ownerId, experience) —
 * a second click is a no-op. Returns the experience's new helpfulCount.
 * No firebase.firestore.FieldValue.increment() — plain local read-modify-write.
 */
function markExperienceHelpful(ownerId, experienceId) {
  if (hasMarkedHelpful(ownerId, experienceId)) {
    const existing = getExperienceById(experienceId);
    return existing ? existing.helpfulCount || 0 : 0;
  }

  const list = getAllExperiences();
  const experience = list.find((e) => e.id === experienceId);
  if (!experience) return 0;

  experience.helpfulCount = (experience.helpfulCount || 0) + 1;
  saveAllExperiences(list);

  const marks = getAllHelpfulMarks();
  marks[ownerId] = (marks[ownerId] || []).concat([experienceId]);
  writeJSON("tourmate_helpful_marks", marks);

  return experience.helpfulCount;
}

/* ---------- sample data (PART 6) ---------- */

function seedSampleExperiencesIfEmpty() {
  if (getAllExperiences().length > 0) return;

  const samples = [
    {
      destination: "Sajek Valley",
      title: "Three days above the clouds",
      description:
        "We went with four friends and stayed two nights at a hilltop resort in Konglak Para. The cloud sea at sunrise was worth the bumpy road up — genuinely one of the best mornings I've had. Food options in the valley are simple but good.",
      rating: 5,
      places: ["Konglak Para", "Ruilui Para", "Sajek Helipad"],
      tips: ["Leave Khagrachari before 8am to catch the escort convoy", "Bring a warm layer for the evening", "Carry cash — cards don't work up there"],
      approxCost: 5800,
      tripDuration: 3,
    },
    {
      destination: "Sylhet",
      title: "A quick green weekend",
      description:
        "Did this as a 2-day trip from Dhaka — flew in, hired a car for both days. Ratargul in the morning light was calm and beautiful, and Jaflong's stone-collecting river was a nice change of pace in the afternoon.",
      rating: 4,
      places: ["Ratargul Swamp Forest", "Jaflong", "Lalakhal"],
      tips: ["Agree the boat price before boarding at Ratargul", "Lalakhal is bluer in the dry season"],
      approxCost: 4500,
      tripDuration: 2,
    },
    {
      destination: "Bandarban",
      title: "Nafakhum and the long road there",
      description:
        "Four days, mostly spent getting to and from Nafakhum waterfall with a local guide. Physically tougher than I expected but the waterfall itself was huge and worth it. Stayed in Bandarban town both ends of the trip.",
      rating: 4,
      places: ["Nafakhum Waterfall", "Boga Lake", "Buddha Dhatu Jadi"],
      tips: ["Arrange a guide in town, not last minute", "Trails are slippery — proper shoes matter here"],
      approxCost: 7200,
      tripDuration: 4,
    },
    {
      destination: "Cox's Bazar",
      title: "Long weekend, no real plan",
      description:
        "Kept it simple — beach walks, one day trip to Himchari, seafood every night. Didn't manage to get to Saint Martin's since it wasn't the season, but the main beach alone filled up three days easily.",
      rating: 4,
      places: ["Laboni Beach", "Himchari National Park"],
      tips: ["Book hotels ahead if it's a weekend", "Stick to flagged areas — the current is strong in places"],
      approxCost: 6000,
      tripDuration: 3,
    },
    {
      destination: "Sreemangal",
      title: "Tea gardens and seven-layer tea",
      description:
        "Sreemangal is smaller and quieter than I expected — spent two days cycling between tea estates, visited a small Khasi village, and obviously tried the seven-layer tea (it's a real thing and it's good).",
      rating: 5,
      places: ["Lawachara National Park", "Nilkantha Tea Cabin", "a local tea estate"],
      tips: ["Rent a bicycle — distances between estates are very manageable", "Go early to Lawachara for a chance at spotting hoolock gibbons"],
      approxCost: 3800,
      tripDuration: 2,
    },
    {
      destination: "Tanguar Haor",
      title: "A night on the water",
      description:
        "Booked a houseboat out of Sunamganj with six of us — slept on deck under a huge sky, moved between open water and small hillside villages the next day. Very different pace from anything else on this list.",
      rating: 5,
      places: ["Tanguar Haor", "Tekerghat"],
      tips: ["Book the houseboat a week ahead for weekends", "Confirm life jackets are on board before you leave the dock"],
      approxCost: 5200,
      tripDuration: 2,
    },
  ];

  const now = Date.now();
  const experiences = samples.map((s, index) => ({
    id: generateId("exp"),
    destination: s.destination,
    title: s.title,
    description: s.description,
    author: "TourMate Traveler",
    authorId: "sample",
    rating: s.rating,
    places: s.places,
    tips: s.tips,
    days: [],
    photos: [],
    helpfulCount: Math.max(1, samples.length - index),
    // staggered timestamps so "Recent" has a sensible order on first load
    createdAt: new Date(now - index * 1000 * 60 * 60 * 24).toISOString(),
    isSample: true,
    approxCost: s.approxCost,
    tripDuration: s.tripDuration,
  }));

  saveAllExperiences(experiences);
}

// Runs once per page load; the length check above makes it a no-op
// after the first time, so experiences are never duplicated.
seedSampleExperiencesIfEmpty();

/* ---------- photo compression, tuned for localStorage (PART 10) ---------- */

/**
 * Resizes+compresses an image File to a small JPEG data URL suitable
 * for localStorage. Rejects non-images, oversized originals, and any
 * result that's still too large after compression (asking for a
 * smaller photo rather than silently blowing the storage quota).
 */
function compressImageForLocalStorage(file) {
  if (!file.type || file.type.indexOf("image/") !== 0) {
    return Promise.reject(new Error(file.name + " isn't an image file."));
  }
  if (file.size > 10 * 1024 * 1024) {
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

      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

      if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        reject(new Error(file.name + " is still too large after compression — try a simpler photo or fewer photos."));
        return;
      }
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(file.name + " could not be read as an image."));
    };

    img.src = objectUrl;
  });
}
