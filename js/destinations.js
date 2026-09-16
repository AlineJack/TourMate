/* =========================================================
   destinations.js
   Curated, hand-written TourMate destination content — no
   database, no API, no cost. This is the single dataset that
   Home Recommendations, Explore, the Guide, and the
   destination detail page all read from.

   This is clearly labeled "TourMate Guide" content anywhere it
   is shown to a user (see PART 8 of the spec) — it is written
   by TourMate, not submitted by a traveler.

   Shape of one destination:
   {
     id:              string   — slug used in URLs (?d=sajek) and as
                                  experiences.destinationId
     name:            string
     region:          string   — short "where is this" line
     tags:            string[] — used for Explore categories +
                                  Guide trip-type matching
                                  (mountain, nature, adventure, beach,
                                  budget, weekend, riverine)
     recommendedDays: {min, max}
     budgetRange:     {min, max} — approx BDT per person
     summary:         string   — one/two sentence card blurb
     description:     string   — longer paragraph for the detail page
     thingsToDo:      string[]
     placesToVisit:   string[]
     prepGuidance:    string[] — "how to prepare" bullet points
     checklistSuggestions: string[] — seeds the Checklist feature
   }
   ========================================================= */

const DESTINATIONS = [
  {
    id: "sajek",
    name: "Sajek Valley",
    region: "Rangamati, Chittagong Hill Tracts",
    tags: ["mountain", "nature", "adventure", "weekend"],
    emoji: "⛰️",
    pros: ["Dramatic cloud-sea views", "Cool climate year-round", "Manageable 2-3 day trip"],
    cons: ["Long, winding road up", "Patchy mobile network in parts of the valley", "Cards rarely accepted"],
    recommendedDays: { min: 2, max: 3 },
    budgetRange: { min: 4000, max: 7000 },
    summary: "Cloud-covered hilltops and a cool climate, one of the most popular short mountain escapes.",
    description:
      "Sajek sits high in the Chittagong Hill Tracts, known for the sea of clouds that rolls over the valley in the early morning. It's a compact trip — most of the experience is the journey up through winding hill roads and the view from the resorts at the top — which makes it a reliable pick when you only have a couple of days free.",
    thingsToDo: [
      "Watch the sunrise cloud sea from Konglak Para",
      "Walk through Ruilui Para and the local Tripura/Lushai villages",
      "Visit the Sajek helipad viewpoint",
      "Try local Chakma/Tripura style bamboo-cooked chicken",
    ],
    placesToVisit: ["Konglak Para", "Ruilui Para", "Sajek Helipad", "Hajachara Waterfall"],
    prepGuidance: [
      "Roads are hilly and winding — travel in daylight where possible",
      "Nights are noticeably cooler than in the plains, even outside winter",
      "Mobile network is patchy in parts of the valley",
      "Army/BGB escort convoys sometimes run at fixed times on the Khagrachari road — check the current schedule before you set off",
    ],
    checklistSuggestions: ["Warm layer for the evening", "Power bank", "Cash (cards are unreliable here)", "Comfortable walking shoes", "Torch/flashlight"],
  },
  {
    id: "sylhet",
    name: "Sylhet",
    region: "Sylhet Division",
    tags: ["nature", "weekend", "budget"],
    emoji: "🍃",
    pros: ["Well connected by road, rail, and air", "Budget-friendly", "Sights are close together"],
    cons: ["Boat fares need negotiating upfront", "River clarity depends on the season"],
    recommendedDays: { min: 2, max: 3 },
    budgetRange: { min: 3500, max: 6000 },
    summary: "Green tea gardens, rolling hills, and the Ratargul swamp forest — an easy, budget-friendly nature trip.",
    description:
      "Sylhet is a green, hilly region built around tea estates and shrines. It's well connected by road, rail, and air from Dhaka, and the sights are spread across a manageable area, so it works well as a first nature trip if you don't want a long or expensive journey.",
    thingsToDo: [
      "Walk through a working tea estate",
      "Take a boat through Ratargul Swamp Forest",
      "Visit Jaflong for the river and stone collection area",
      "See the Lalakhal blue water",
    ],
    placesToVisit: ["Ratargul Swamp Forest", "Jaflong", "Lalakhal", "Malnicherra Tea Estate"],
    prepGuidance: [
      "Ratargul is best visited by hired boat — prices are more predictable if you agree the fare before boarding",
      "Some sights (Jaflong, Lalakhal) are a fair distance apart, so a hired CNG/car for the day is easier than public transport",
      "Rain can affect river clarity at Lalakhal — it's more blue in the dry season",
    ],
    checklistSuggestions: ["Rain cover for bags", "Sandals you don't mind getting wet", "Sunscreen", "Cash for boat/CNG fares"],
  },
  {
    id: "sunamganj",
    name: "Sunamganj (Tanguar Haor)",
    region: "Sylhet Division",
    tags: ["nature", "riverine", "adventure", "budget"],
    emoji: "🚤",
    pros: ["Unique open-water houseboat experience", "Great for birdwatching", "Feels remote and quiet"],
    cons: ["Only dramatic roughly 6 months a year", "Houseboats need advance booking", "Limited facilities on the water"],
    recommendedDays: { min: 2, max: 3 },
    budgetRange: { min: 4000, max: 7500 },
    summary: "A vast wetland (haor) best explored by houseboat — wide open water, birds, and quiet villages.",
    description:
      "Tanguar Haor is a seasonal wetland that turns into a huge, open body of water in the monsoon and post-monsoon months. Trips here are usually built around a rented houseboat that you sleep on, moving between open water and small hill-adjacent villages.",
    thingsToDo: [
      "Rent a houseboat for an overnight haor trip",
      "Watch sunrise/sunset over open water",
      "Visit nearby Tekerghat and the hills across the border",
      "Birdwatching in the cooler months",
    ],
    placesToVisit: ["Tanguar Haor", "Tekerghat", "Niladri Lake (Shaplar Beel)"],
    prepGuidance: [
      "Houseboats need to be booked ahead, especially on weekends",
      "The haor is only this dramatic roughly June–November; check water levels for other months",
      "Life jackets should be provided on the boat — confirm before departure",
    ],
    checklistSuggestions: ["Life jacket (or confirm the boat provides one)", "Warm layer for open-water nights", "Waterproof phone pouch", "Basic motion-sickness medicine if needed"],
  },
  {
    id: "kuakata",
    name: "Kuakata",
    region: "Patuakhali, Barisal Division",
    tags: ["beach", "budget", "weekend"],
    emoji: "🌅",
    pros: ["Sunrise and sunset from the same spot", "Less crowded than Cox's Bazar", "Budget-friendly"],
    cons: ["Fewer big hotel chains", "Longer, mixed road-and-ferry journey"],
    recommendedDays: { min: 2, max: 3 },
    budgetRange: { min: 3000, max: 5500 },
    summary: "A quieter, less crowded beach than Cox's Bazar, known for watching both sunrise and sunset from the same spot.",
    description:
      "Kuakata is a flat, wide beach on the southern coast where the shoreline runs in a way that lets you see both sunrise and sunset over the water. It's smaller and calmer than Cox's Bazar, which makes it a good pick if you want beach time without the crowds.",
    thingsToDo: [
      "Watch sunrise and sunset from the main beach",
      "Visit the Rakhine Buddhist temple",
      "Take a boat to Fatrar Char for mangrove forest",
      "Try fresh seafood at the beach-side stalls",
    ],
    placesToVisit: ["Kuakata Main Beach", "Rakhine Buddhist Temple", "Fatrar Char", "Gangamati Reserve Forest"],
    prepGuidance: [
      "The journey involves a mix of road and, depending on route, a ferry crossing — build in extra time",
      "Fewer big hotel chains here than Cox's Bazar — book guesthouses ahead on weekends/holidays",
    ],
    checklistSuggestions: ["Sunscreen", "Hat/cap", "Flip-flops", "Change of clothes for the beach"],
  },
  {
    id: "coxsbazar",
    name: "Cox's Bazar",
    region: "Chattogram Division",
    tags: ["beach", "popular", "weekend"],
    emoji: "🏖️",
    pros: ["Longest natural sea beach in the country", "Most tourist infrastructure of any coast town", "Options for every budget"],
    cons: ["Can get very crowded on holidays", "Hotel prices spike on weekends", "Saint Martin's ferry runs in dry season only"],
    recommendedDays: { min: 3, max: 4 },
    budgetRange: { min: 4000, max: 8000 },
    summary: "The country's best-known beach town, with the longest natural sea beach and the most tourist infrastructure.",
    description:
      "Cox's Bazar is the most developed beach destination, with a long, wide stretch of sand and the widest range of hotels, restaurants, and day trips of anywhere on the coast. It's an easy choice if you want reliable infrastructure and options for every budget.",
    thingsToDo: [
      "Walk or ride along the main beach",
      "Day trip to Himchari for waterfalls and hilltop views",
      "Boat trip to Inani Beach",
      "Ferry to Saint Martin's Island (seasonal)",
    ],
    placesToVisit: ["Laboni Beach", "Himchari National Park", "Inani Beach", "Saint Martin's Island"],
    prepGuidance: [
      "Saint Martin's ferries typically run only in the dry season (roughly October–March) — check before planning around it",
      "Hotel prices swing a lot between weekdays and weekends/holidays",
      "Strong currents in places — stick to areas with lifeguards/flags where available",
    ],
    checklistSuggestions: ["Sunscreen", "Swimwear", "Reusable water bottle", "Waterproof phone case"],
  },
  {
    id: "bandarban",
    name: "Bandarban",
    region: "Chattogram Hill Tracts",
    tags: ["mountain", "adventure", "nature"],
    emoji: "🥾",
    pros: ["Best trekking terrain of the hill districts", "Dramatic waterfalls and viewpoints", "Multi-day route options"],
    cons: ["Some areas need prior permission", "Trails get slippery in rainy season", "Needs a longer stay to do it justice"],
    recommendedDays: { min: 3, max: 4 },
    budgetRange: { min: 5000, max: 9000 },
    summary: "The most rugged of the hill districts — waterfalls, trekking, and hilltop resorts with long valley views.",
    description:
      "Bandarban has the most trekking-oriented terrain of the hill districts, from short hikes to multi-day routes to peaks like Keokradong. It rewards a longer stay — there's more here than can comfortably fit into a weekend.",
    thingsToDo: [
      "Trek toward Nilgiri or Keokradong (multi-day options available)",
      "Visit Nafakhum or Boga Lake for a shorter trip",
      "See the Golden Temple (Buddha Dhatu Jadi)",
      "Chimbuk hill viewpoint",
    ],
    placesToVisit: ["Nilgiri", "Boga Lake", "Nafakhum Waterfall", "Buddha Dhatu Jadi (Golden Temple)"],
    prepGuidance: [
      "Some areas require prior permission/registration — check current requirements before you go",
      "Longer treks need a local guide — arrange this in Bandarban town, not last minute",
      "Rainy season makes trails slippery and some routes seasonal-only",
    ],
    checklistSuggestions: ["Trekking shoes with grip", "Rain poncho", "Insect repellent", "Water purification tablets", "Basic first-aid kit"],
  },
  {
    id: "rangamati",
    name: "Rangamati",
    region: "Chittagong Hill Tracts",
    tags: ["nature", "riverine", "weekend", "budget"],
    emoji: "🛶",
    pros: ["Easy, low-effort hill scenery", "Everything reachable by boat", "Good short 2-day trip"],
    cons: ["Less dramatic than Sajek or Bandarban", "Boat routes need price agreement upfront"],
    recommendedDays: { min: 2, max: 2 },
    budgetRange: { min: 3000, max: 5500 },
    summary: "A lake town built around Kaptai Lake — easy boat rides, a hanging bridge, and a relaxed pace.",
    description:
      "Rangamati sits on the edge of Kaptai Lake, and most of what there is to see is reached by boat. It's a gentler, shorter trip than Sajek or Bandarban — a good option when you want hill-district scenery without a long or bumpy road trip.",
    thingsToDo: [
      "Cross the Kaptai Lake hanging bridge",
      "Boat ride across Kaptai Lake",
      "Visit a local tribal (Chakma) market",
      "See the floating/submerged Rajban Bihar area",
    ],
    placesToVisit: ["Kaptai Lake", "Rangamati Hanging Bridge", "Rajban Bihar", "Shuvolong Waterfall"],
    prepGuidance: [
      "Boat trips to Shuvolong take longer in the dry season when water levels drop",
      "Agree the boat route and price before setting off — several stops are usually bundled together",
    ],
    checklistSuggestions: ["Sunscreen", "Cash for boat hire", "Light rain jacket"],
  },
  {
    id: "sreemangal",
    name: "Sreemangal",
    region: "Moulvibazar, Sylhet Division",
    tags: ["nature", "budget", "weekend"],
    emoji: "🍵",
    pros: ["Very budget-friendly", "Relaxed pace, easy to get around by bike", "Pairs naturally with a Sylhet trip"],
    cons: ["Fewer big-name attractions than other hill destinations", "Tea estate access can be limited without a guide"],
    recommendedDays: { min: 2, max: 2 },
    budgetRange: { min: 3000, max: 5000 },
    summary: "Bangladesh's tea capital — rolling tea gardens, a rainforest park, and the famous seven-layer tea.",
    description:
      "Sreemangal is a quiet town surrounded by tea estates in the Sylhet region, best explored slowly by bicycle or on foot. It pairs well with a wider Sylhet trip or stands on its own as an easy, inexpensive nature getaway.",
    thingsToDo: [
      "Cycle between tea estates",
      "Walk the trails at Lawachara National Park",
      "Try the seven-layer tea",
      "Visit a Khasi village",
    ],
    placesToVisit: ["Lawachara National Park", "Nilkantha Tea Cabin", "Madhabpur Lake"],
    prepGuidance: [
      "Lawachara is best visited early morning for a chance at spotting wildlife",
      "Tea estates are private property — stick to public paths unless invited in",
      "Bicycles are the easiest way to get around town",
    ],
    checklistSuggestions: ["Comfortable walking/cycling shoes", "Insect repellent", "Reusable water bottle", "Cash for small vendors"],
  },
];

/* ---------- lookup helpers ---------- */

function getAllDestinations() {
  return DESTINATIONS;
}

function getDestinationById(id) {
  return DESTINATIONS.find((d) => d.id === id) || null;
}

function getDestinationsByTag(tag) {
  return DESTINATIONS.filter((d) => d.tags.includes(tag));
}

/** Simple case/diacritic-loose text search across name + region + tags. */
function searchDestinations(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return DESTINATIONS.filter((d) => {
    return (
      d.name.toLowerCase().includes(q) ||
      d.region.toLowerCase().includes(q) ||
      d.tags.some((t) => t.includes(q))
    );
  });
}

/** Destinations whose recommended-days range overlaps the given day count. */
function getDestinationsForDuration(days) {
  const n = Number(days);
  if (!n || n <= 0) return [];
  return DESTINATIONS.filter((d) => n >= d.recommendedDays.min && n <= d.recommendedDays.max + 1);
}

/** Destinations whose budget range could fit the given per-person amount (BDT). */
function getDestinationsForBudget(amount) {
  const n = Number(amount);
  if (!n || n <= 0) return [];
  // "fits the budget" = the destination's minimum is at or below what the
  // person has, with a little headroom so a ৳5,000 budget still surfaces a
  // ৳4,000–7,000 destination.
  return DESTINATIONS.filter((d) => d.budgetRange.min <= n * 1.15);
}

/**
 * Destination budgets are always BDT (the catalog itself is
 * Bangladesh-focused) — routed through the ONE shared formatCurrency()
 * from tour-store.js rather than a second money formatter.
 */
function formatBudgetRange(range) {
  return formatCurrency(range.min, "BDT") + "–" + formatCurrency(range.max, "BDT");
}

function formatDayRange(range) {
  if (range.min === range.max) return range.min + " day" + (range.min === 1 ? "" : "s");
  return range.min + "–" + range.max + " days";
}
