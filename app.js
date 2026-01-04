// Home dashboard: KPIs + Latest Events table
// Wired to your published Google Sheets CSV endpoints

const EVENTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=757517635&single=true&output=csv";

const ANGLER_WIDE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=620292831&single=true&output=csv";

const SEASON_SUMMARY_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=501135877&single=true&output=csv";

// Column mappings
const EVT = {
  event_id: "event_id",
  trail: "trail",
  season: "season",
  event_name: "event_name",
  event_date: "event_date",
  source_url: "source_url",
};

const AW = {
  event_id: "event_id",
  angler: "angler",
  angler_state: "angler_state",
  angler_url: "angler_url",
  rank: "rank",
  total_length_in: "total_length_in",
  big_bass_in: "big_bass_in",
  day: "day",
  fish_limit: "fish_limit",
};

const SS = {
  season: "season",
  trail: "trail",
  angler: "angler",
  season_total: "season_total_length_in",
  best_big_bass: "best_big_bass_in",
};

// ---------------- CSV parsing helpers ----------------
function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  return rows;
}

function toObjects(csvText) {
  const matrix = parseCSV(csvText);
  if (!matrix.length) return [];
  const headers = matrix[0].map(h => h.trim());
  return matrix.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

function num(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function fmtInches(n) {
  return `${n.toFixed(1)}"`;
}

function unique(arr) {
  return [...new Set(arr)].filter(v => String(v).trim() !== "");
}

function parseDateLoose(s) {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : new Date(0);
}

function setOptions(selectEl, values, allLabel = "All") {
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = allLabel;
  selectEl.appendChild(optAll);

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

// --------------- Event stats (winner / big bass / anglers) ---------------
function buildEventStats(anglerWideRows) {
  const map = new Map();

  for (const r of anglerWideRows) {
    const id = r[AW.event_id];
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        anglers: new Set(),
        winnerName: null,
        winnerTotal: 0,
        winnerRank: Number.POSITIVE_INFINITY,
        bigBass: 0,
        bigBassAngler: null,
      });
    }

    const s = map.get(id);
    const angler = (r[AW.angler] || "").trim();
    if (angler) s.anglers.add(angler);

    const rank = num(r[AW.rank]) || Number.POSITIVE_INFINITY;
    const total = num(r[AW.total_length_in]);
    const bb = num(r[AW.big_bass_in]);

    const hasRank = num(r[AW.rank]) > 0;
    if (hasRank) {
      if (rank < s.winnerRank || (rank === s.winnerRank && total > s.winnerTotal)) {
        s.winnerRank = rank;
        s.winnerName = angler || "—";
        s.winnerTotal = total;
      }
    } else {
      // Fallback: if ranks missing, pick highest total
      if (!s.winnerName || total > s.winnerTotal) {
        s.winnerName = angler || "—";
        s.winnerTotal = total;
        s.winnerRank = Number.POSITIVE_INFINITY;
      }
    }

    if (bb > s.bigBass) {
      s.bigBass = bb;
      s.bigBassAngler = angler || null;
    }
  }

  const out = new Map();
  for (const [event_id, s] of map.entries()) {
    out.set(event_id, {
      anglerCount: s.anglers.size,
      winnerName: s.winnerName || "—",
      winnerTotal: s.winnerTotal || 0,
      bigBass: s.bigBass || 0,
      bigBassAngler: s.bigBassAngler || null,
    });
  }

  return out;
}

// ---------------- Render: KPIs ----------------
function renderKPIs(eventsFiltered, anglerWideFiltered, eventStatsById, seasonSummaryFiltered, seasonSummaryAll) {
  const totalEvents = eventsFiltered.length;
  const totalAnglers = unique(anglerWideFiltered.map(r => r[AW.angler])).length;

  // Prefer Season_Summary for averages
  let avgTotal = 0;
  let avgBigBass = 0;

  if (seasonSummaryAll && seasonSummaryAll.length) {
    const base = (seasonSummaryFiltered && seasonSummaryFiltered.length) ? seasonSummaryFiltered : seasonSummaryAll;
    avgTotal = base.reduce((s, d) => s + num(d[SS.season_total]), 0) / base.length;
    avgBigBass = base.reduce((s, d) => s + num(d[SS.best_big_bass]), 0) / base.length;
  } else {
    // Fallback: avg winner total across filtered events + avg big bass across filtered rows
    const winnerTotals = [...eventStatsById.values()].map(s => s.winnerTotal).filter(v => v > 0);
    avgTotal = winnerTotals.length ? winnerTotals.reduce((a, b) => a + b, 0) / winnerTotals.length : 0;

    const bb = anglerWideFiltered.map(r => num(r[AW.big_bass_in])).filter(v => v > 0);
    avgBigBass = bb.length ? bb.reduce((a, b) => a + b, 0) / bb.length : 0;
  }

  document.getElementById("kpiTotalEvents").textContent = totalEvents;
  document.getElementById("kpiTotalAnglers").textContent = totalAnglers;
  document.getElementById("kpiAvgWinnerTotal").textContent = avgTotal ? fmtInches(avgTotal) : "—";
  document.getElementById("kpiAvgBigBass").textContent = avgBigBass ? fmtInches(avgBigBass) : "—";
}

// ---------------- Render: Events table ----------------
function renderEventsTable(eventsFiltered, eventStatsById) {
  const tbody = document.getElementById("eventsTable");
  const note = document.getElementById("note");
  tbody.innerHTML = "";

  const sorted = [...eventsFiltered].sort(
    (a, b) => parseDateLoose(b[EVT.event_date]) - parseDateLoose(a[EVT.event_date])
  );

  for (const e of sorted) {
    const id = e[EVT.event_id];
    const detailsUrl = `event.html?event_id=${encodeURIComponent(id)}`;

    const name = e[EVT.event_name] || "";
    const date = e[EVT.event_date] || "";
    const trail = e[EVT.trail] || "";
    const sourceUrl = e[EVT.source_url] || "";

    const stats = eventStatsById.get(id);
    const winner = stats ? stats.winnerName : "—";
    const totalLen = stats ? fmtInches(stats.winnerTotal) : "—";
    const anglers = stats ? stats.anglerCount : "—";
    const bbLen = stats && stats.bigBass ? fmtInches(stats.bigBass) : "—";
    const bbAngler = stats?.bigBassAngler || "";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <a class="event-link" href="${detailsUrl}">
          ${name}
        </a>
        ${sourceUrl
          ? `<a class="subtle-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Source</a>`
          : ""}
      </td>
      <td>${date}</td>
      <td>${trail}</td>
      <td>${winner !== "—"
        ? `<span class="badge badge-win">🏆 ${winner}</span>`
        : `<span class="badge badge-muted">—</span>`}
      </td>
      <td>${totalLen}</td>
      <td>${bbLen !== "—"
        ? `<span class="badge badge-bb">🐟 ${bbLen}${bbAngler ? ` • ${bbAngler}` : ""}</span>`
        : `<span class="badge badge-muted">—</span>`}
      </td>
      <td>${anglers}</td>
      <td>
        <a class="details-link" href="${detailsUrl}">
          Click Here for Event Details
        </a>
      </td>
    `;

    tbody.appendChild(tr);
  }

  note.textContent = `Showing ${sorted.length} events`;
}


// ---------------- Init ----------------
(async function init() {
  const seasonFilter = document.getElementById("seasonFilter");
  const trailFilter = document.getElementById("trailFilter");
  const searchBox = document.getElementById("searchBox");

  // Fetch all CSVs
  const [eventsText, awText, ssText] = await Promise.all([
    fetch(EVENTS_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(ANGLER_WIDE_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(SEASON_SUMMARY_CSV_URL, { cache: "no-store" }).then(r => r.text()),
  ]);

  const eventsAll = toObjects(eventsText);
  const anglerWideAll = toObjects(awText);
  const seasonSummaryAll = toObjects(ssText);

  // Filters options from Events tab (best UX)
  const seasons = unique(eventsAll.map(d => d[EVT.season])).sort().reverse();
  const trails = unique(eventsAll.map(d => d[EVT.trail])).sort();

  setOptions(seasonFilter, seasons, "All seasons");
  setOptions(trailFilter, trails, "All trails");

  function apply() {
    const season = seasonFilter.value;
    const trail = trailFilter.value;
    const q = (searchBox.value || "").toLowerCase();

    const eventsFiltered = eventsAll.filter(e => {
      const okSeason = !season || e[EVT.season] === season;
      const okTrail = !trail || e[EVT.trail] === trail;
      const hay = [e[EVT.event_name], e[EVT.trail], e[EVT.season], e[EVT.event_date]].join(" ").toLowerCase();
      const okSearch = !q || hay.includes(q);
      return okSeason && okTrail && okSearch;
    });

    const eventIds = new Set(eventsFiltered.map(e => e[EVT.event_id]));
    const anglerWideFiltered = anglerWideAll.filter(r => eventIds.has(r[AW.event_id]));

    const seasonSummaryFiltered = seasonSummaryAll.filter(r => {
      const okSeason = !season || r[SS.season] === season;
      const okTrail = !trail || r[SS.trail] === trail;
      return okSeason && okTrail;
    });

    const eventStatsById = buildEventStats(anglerWideFiltered);

    renderKPIs(eventsFiltered, anglerWideFiltered, eventStatsById, seasonSummaryFiltered, seasonSummaryAll);
    renderEventsTable(eventsFiltered, eventStatsById);
  }

  seasonFilter.addEventListener("change", apply);
  trailFilter.addEventListener("change", apply);
  searchBox.addEventListener("input", apply);

  apply();
})();
