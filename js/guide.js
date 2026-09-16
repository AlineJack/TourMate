/* =========================================================
   guide.js — PART 6
   A rule-based assistant: no paid AI API, just keyword
   extraction over plain text, matched against the static
   DESTINATIONS dataset (destinations.js). Works from quick-pick
   chips or free text, per the user's choice for this feature.
   ========================================================= */

(function () {
  const session = requireAuth();
  if (!session) return;

  initNavbar("explore");

  const thread = qs("#guideThread");
  const form = qs("#guideForm");
  const input = qs("#guideInput");

  const QUICK_CHIPS = [
    "I have 2 days",
    "I want an adventure trip",
    "I have ৳5,000",
    "What can I do in Sajek?",
    "What should I take?",
  ];

  renderChips();
  appendGuideBubble(
    "Ask me about how many days you have, your budget, a kind of trip, or a specific place — try a quick option below or type your own."
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    askGuide(text);
    input.value = "";
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("q")) {
    askGuide(params.get("q"));
  }

  function renderChips() {
    const row = qs("#guideChips");
    row.innerHTML = "";
    QUICK_CHIPS.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-chip";
      btn.textContent = text;
      btn.addEventListener("click", () => askGuide(text));
      row.appendChild(btn);
    });
  }

  function askGuide(text) {
    appendUserBubble(text);
    const answer = answerGuideQuery(text);
    appendGuideBubble(answer.html, true);
  }

  function appendUserBubble(text) {
    const div = document.createElement("div");
    div.className = "guide-bubble guide-bubble-user";
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function appendGuideBubble(html, isHtml) {
    const div = document.createElement("div");
    div.className = "guide-bubble guide-bubble-guide";
    if (isHtml) {
      div.innerHTML = html;
    } else {
      div.textContent = html;
    }
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  /* ---------- rule-based parsing ---------- */

  function answerGuideQuery(rawText) {
    const q = rawText.toLowerCase();

    const mentionedDest = findMentionedDestination(q);
    if (mentionedDest) return buildDestinationAnswer(mentionedDest);

    if (/pack(ing)?\b|checklist\b|what.*\b(take|bring)\b/.test(q)) {
      return buildPackingAnswer();
    }

    const dayCount = extractDayCount(q);
    const budgetAmount = extractBudget(q);
    const tag = extractTag(q);

    if (dayCount || budgetAmount || tag) {
      const matches = scoreDestinations(dayCount, budgetAmount, tag);
      const bits = [];
      if (dayCount) bits.push(dayCount + "-day trips");
      if (budgetAmount) bits.push("around " + formatCurrency(budgetAmount, "BDT"));
      if (tag) bits.push(tag + " trips");
      return buildResultsAnswer(matches, "Here's what fits " + bits.join(" and ") + ":");
    }

    return buildFallbackAnswer();
  }

  function findMentionedDestination(q) {
    const flatQuery = q.replace(/[^a-z0-9]/g, "");
    return (
      getAllDestinations().find((d) => {
        const flatName = d.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return flatQuery.includes(flatName) || flatQuery.includes(d.id);
      }) || null
    );
  }

  function extractDayCount(q) {
    if (/\bweekend\b/.test(q)) return 2;
    const m = q.match(/(\d+)\s*-?\s*(day|days)\b/);
    return m ? parseInt(m[1], 10) : null;
  }

  function extractBudget(q) {
    let m = q.match(/৳\s?([\d,]+)/);
    if (!m) m = q.match(/(?:tk|taka|bdt)\.?\s?([\d,]+)/i);
    if (!m) m = q.match(/([\d,]+)\s?(?:tk|taka|bdt)\b/i);
    if (m) return parseInt(m[1].replace(/,/g, ""), 10);

    if (/\b(budget|afford|spend|have)\b/.test(q)) {
      const bare = q.match(/\b(\d{3,6})\b/);
      if (bare) return parseInt(bare[1], 10);
    }
    return null;
  }

  function extractTag(q) {
    const map = [
      { re: /adventure|trek|hik/, tag: "adventure" },
      { re: /beach|\bsea\b|coast/, tag: "beach" },
      { re: /mountain|\bhill/, tag: "mountain" },
      { re: /nature|forest|green/, tag: "nature" },
      { re: /budget|cheap|affordable/, tag: "budget" },
      { re: /weekend|short trip/, tag: "weekend" },
      { re: /river|lake|haor|boat/, tag: "riverine" },
    ];
    const hit = map.find((entry) => entry.re.test(q));
    return hit ? hit.tag : null;
  }

  function scoreDestinations(dayCount, budgetAmount, tag) {
    const durationIds = dayCount ? new Set(getDestinationsForDuration(dayCount).map((d) => d.id)) : null;
    const budgetIds = budgetAmount ? new Set(getDestinationsForBudget(budgetAmount).map((d) => d.id)) : null;
    const tagIds = tag ? new Set(getDestinationsByTag(tag).map((d) => d.id)) : null;

    return getAllDestinations()
      .map((d) => {
        let score = 0;
        if (durationIds && durationIds.has(d.id)) score++;
        if (budgetIds && budgetIds.has(d.id)) score++;
        if (tagIds && tagIds.has(d.id)) score++;
        return { dest: d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.dest);
  }

  /* ---------- answer builders ---------- */

  function buildDestinationAnswer(dest) {
    const items = dest.thingsToDo
      .slice(0, 4)
      .map((t) => "<li>" + escapeHtml(t) + "</li>")
      .join("");
    return {
      html:
        "<p>Here's what TourMate has on <strong>" + escapeHtml(dest.name) + "</strong>:</p>" +
        '<ul class="bullet-list">' + items + "</ul>" +
        '<a class="btn btn-outline btn-sm" href="destination.html?id=' + dest.id + '">View full guide &amp; traveler experiences →</a>',
    };
  }

  function buildPackingAnswer() {
    const common = [
      "Comfortable shoes",
      "Phone charger or power bank",
      "Cash for small vendors",
      "Basic first-aid items",
      "ID/documents",
      "Weather-appropriate clothing",
    ];
    const items = common.map((t) => "<li>" + escapeHtml(t) + "</li>").join("");
    return {
      html:
        "<p>A general starting list — TourMate also tailors this per destination and lets you check items off:</p>" +
        '<ul class="bullet-list">' + items + "</ul>" +
        '<a class="btn btn-outline btn-sm" href="checklist.html">Open your Checklist →</a>',
    };
  }

  function buildResultsAnswer(matches, introText) {
    if (matches.length === 0) {
      return {
        html: "<p>I couldn't find a close match for that. Try mentioning a number of days, a budget, or a trip type like adventure, beach, nature, or mountain.</p>",
      };
    }
    const cards = matches
      .map(
        (d) =>
          '<div class="guide-result-card">' +
          "<strong>" + escapeHtml(d.name) + "</strong> <span class=\"dest-region\">" + escapeHtml(d.region) + "</span>" +
          '<div class="dest-meta"><span>' + formatDayRange(d.recommendedDays) + "</span><span>" + formatBudgetRange(d.budgetRange) + "</span></div>" +
          '<a href="destination.html?id=' + d.id + '">View details →</a>' +
          "</div>"
      )
      .join("");
    return { html: "<p>" + escapeHtml(introText) + '</p><div class="guide-results">' + cards + "</div>" };
  }

  function buildFallbackAnswer() {
    return {
      html:
        "<p>I'm not sure I understood that. Try one of the quick options above, or mention a number of days, a budget, or a trip type (adventure, beach, nature, mountain, budget, weekend).</p>",
    };
  }
})();
