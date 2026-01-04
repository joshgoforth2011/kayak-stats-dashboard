// Kayak Stats Dashboard (Home)
// 1) Publish Google Sheet tabs as CSV and paste URLs below.
//    - Events tab -> EVENTS_CSV_URL
//    - Angler_Wide tab -> ANGLER_WIDE_CSV_URL
//
// NOTE: If you're testing locally, use a local web server (not file://).
// Example: `python -m http.server 8000` then open http://localhost:8000/

const EVENTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=757517635&single=true&output=csv";
const ANGLER_WIDE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=620292831&single=true&output=csv";
const SEASON_SUMMARY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=501135877&single=true&output=csv"; // optional but wired

// Column names you provided
const EVT = {
  event_id: "event_id",
  trail: "trail",
  season: "season",
  event_name: "event_name",
  event_date: "event_date",
  source_url: "source_url",
  fish_limit: "fish_limit",
};

const AW = {
  event_id: "event_id",
  season: "season",
  trail: "trail",
  angler: "angler",
  angler_state: "angler_state",
  angler_url: "angler_url",
  rank: "rank",
  total_length_in: "total_length_in",
  big_bass_in: "big_bass_in",
};

// Optional Season_Summary support (gives more stable KPI averages)
const SS = {
  season: "season",
  trail: "trail",
  angler: "angler",
  season_total: "season_total_length_in",
  best_big_bass: "best_big_bass_in",
};


function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (ch === ',' && !inQuotes) { row.push(cur); cur = ""; continue; }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cur);
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = []; cur = "";
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
  const headers = matrix[0].map(h => h.trim());
  return matrix.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] ?? "").trim());
    return obj;
  });
}

function num(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function unique(arr) {
  return [...new Set(arr)].filter(v => String(v).trim() !== "");
}

function fmtInches(n) {
  return `${n.toFixed(1)}"`;
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

function buildEventStats(anglerWideRows) {
  // event_id -> { anglers:Set, winnerName, winnerTotal, winnerRank, bigBass, bigBassAngler }
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
    const angler = r[AW.angler] || "";
    s.anglers.add(angler);

    const rank = num(r[AW.rank]) || Number.POSITIVE_INFINITY;
    const total = num(r[AW.total_length_in]);
    const bigBass = num(r[AW.big_bass_in]);

    // Winner logic: prefer lowest rank; tie-break on total length
    const hasRank = num(r[AW.rank]) > 0;
    if (hasRank) {
      if (rank < s.winnerRank || (rank === s.winnerRank && total > s.winnerTotal)) {
        s.winnerRank = rank;
        s.winnerName = angler;
        s.winnerTotal = total;
      }
    } else if (!s.winnerName || total > s.winnerTotal) {
      s.winnerName = angler;
      s.winnerTotal = total;
      s.winnerRank = Number.POSITIVE_INFINITY;
    }

    // Big bass leader
    if (bigBass > s.bigBass) {
      s.bigBass = bigBass;
      s.bigBassAngler = angler;
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

function renderKPIs(eventsFiltered, anglerWideFiltered, eventStatsById, seasonSummaryFiltered, seasonSummaryAll) {
  const totalEvents = eventsFiltered.length;
  const totalAnglers = unique(anglerWideFiltered.map(r => r[AW.angler])).length;

  // Prefer Season_Summary for KPI averages if present
  let avgTotal = 0;
  let avgBigBass = 0;

  if (seasonSummaryAll && seasonSummaryAll.length) {
    const base = (seasonSummaryFiltered && seasonSummaryFiltered.length) ? seasonSummaryFiltered : seasonSummaryAll;
    avgTotal = base.reduce((s, d) => s + num(d[SS.season_total]), 0) / base.length;
    avgBigBass = base.reduce((s, d) => s + num(d[SS.best_big_bass]), 0) / base.length;
  } else {
    // Fallback: avg winner total across filtered events
    const winnerTotals = [...eventStatsById.values()].map(s => s.winnerTotal).filter(v => v > 0);
    avgTotal = winnerTotals.length ? winnerTotals.reduce((a, b) => a + b, 0) / winnerTotals.length : 0;

    // Avg big bass across all angler rows filtered
    const bb = anglerWideFiltered.map(r => num(r[AW.big_bass_in])).filter(v => v > 0);
    avgBigBass = bb.length ? bb.reduce((a, b) => a + b, 0) / bb.length : 0;
  }

  document.getElementById("kpiTotalEvents").textContent = totalEvents;
  document.getElementById("kpiTotalAnglers").textContent = totalAnglers;
  document.getElementById("kpiAvgWinnerTotal").textContent = fmtInches(avgTotal);
  document.getElementById("kpiAvgBigBass").textContent = fmtInches(avgBigBass);
}

function renderLatestEventsTable(eventsFiltered, eventStatsById) {
  const tbody = document.getElementById("eventsTable");
  tbody.innerHTML = "";

  const latest = [...eventsFiltered]
    .sort((a, b) => parseDateLoose(b[EVT.event_date]) - parseDateLoose(a[EVT.event_date]))
    .slice(0, 12);

  for (const e of latest) {
    const id = e[EVT.event_id];
    const stats = eventStatsById.get(id);

    const name = e[EVT.event_name] || "";
    const date = e[EVT.event_date] || "";
    const trail = e[EVT.trail] || "";
    const url = e[EVT.source_url];

    const winner = stats ? stats.winnerName : "—";
    const totalLen = stats ? fmtInches(stats.winnerTotal) : "—";
    const anglers = stats ? stats.anglerCount : "—";
    const bbLen = stats && stats.bigBass ? fmtInches(stats.bigBass) : "—";
    const bbAngler = stats && stats.bigBassAngler ? stats.bigBassAngler : "";

    const tr = document.createElement("tr");
    tr.className = "rowlink";
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      window.location.href = `event.html?event_id=${encodeURIComponent(id)}`;
    });

    tr.innerHTML = `
      <td>${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${name}</a>` : name}</td>
      <td>${date}</td>
      <td>${trail}</td>
      <td>${winner !== "—" ? `<span class="badge badge-win">🏆 ${winner}</span>` : `<span class="badge badge-muted">—</span>`}</td>
      <td>${totalLen}</td>
      <td>${bbLen !== "—" ? `<span class="badge badge-bb">🐟 ${bbLen}${bbAngler ? ` • ${bbAngler}` : ""}</span>` : `<span class="badge badge-muted">—</span>`}</td>
      <td>${anglers}</td>
    `;
    tbody.appendChild(tr);
  }
}

(async function init() {
  const [eventsText, awText, ssText] = await Promise.all([
    fetch(EVENTS_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(ANGLER_WIDE_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(SEASON_SUMMARY_CSV_URL, { cache: "no-store" }).then(r => r.text()),
  ]);

  const eventsAll = toObjects(eventsText);
  const anglerWideAll = toObjects(awText);
  const seasonSummaryAll = toObjects(ssText);

  // Filters
  const seasonFilter = document.getElementById("seasonFilter");
  const trailFilter = document.getElementById("trailFilter");
  const searchBox = document.getElementById("searchBox");

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

    // keep Angler_Wide aligned to filtered events
    const eventIds = new Set(eventsFiltered.map(e => e[EVT.event_id]));
    const anglerWideFiltered = anglerWideAll.filter(r => {
      if (!eventIds.has(r[AW.event_id])) return false;
      const okSeason = !season || r[AW.season] === season;
      const okTrail = !trail || r[AW.trail] === trail;
      return okSeason && okTrail;
    });

    const eventStatsById = buildEventStats(anglerWideFiltered);

    const seasonSummaryFiltered = seasonSummaryAll.filter(r => {
      const okSeason = !season || r[SS.season] === season;
      const okTrail = !trail || r[SS.trail] === trail;
      return okSeason && okTrail;
    });

    renderKPIs(eventsFiltered, anglerWideFiltered, eventStatsById, seasonSummaryFiltered, seasonSummaryAll);
    renderLatestEventsTable(eventsFiltered, eventStatsById);
  }

  seasonFilter.addEventListener("change", apply);
  trailFilter.addEventListener("change", apply);
  searchBox.addEventListener("input", apply);

  apply();
})();