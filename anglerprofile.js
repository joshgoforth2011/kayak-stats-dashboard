// Angler Profile page (Static) — Josh Goforth dashboard
// Data sources (already wired)
const EVENTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=757517635&single=true&output=csv";
const ANGLER_WIDE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=620292831&single=true&output=csv";

const EVT = {
  event_id: "event_id",
  event_name: "event_name",
  event_date: "event_date",
  trail: "trail",
  season: "season",
  source_url: "source_url",
};

const AW = {
  event_id: "event_id",
  event_date: "event_date",
  trail: "trail",
  season: "season",
  angler: "angler",
  angler_state: "angler_state",
  rank: "rank",
  total_length_in: "total_length_in",
  big_bass_in: "big_bass_in",
  limit_pct: "Limit%",
  aoy: "AOY Points",
  fish1: "fish_1_in",
  fish2: "fish_2_in",
  fish3: "fish_3_in",
  fish4: "fish_4_in",
  fish5: "fish_5_in",
};

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

// CSV helpers
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

    if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }

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
  const m = parseCSV(csvText);
  const headers = m[0].map(h => h.trim());
  return m.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = (r[i] ?? "").trim());
    return o;
  });
}

function num(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
function fmtInches(n) { return `${n.toFixed(1)}"`; }
function unique(arr) { return [...new Set(arr)].filter(v => String(v).trim() !== ""); }
function parseDateLoose(s) { const d = new Date(s); return Number.isFinite(d.getTime()) ? d : new Date(0); }

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

function fishTop5(row) {
  const fish = [AW.fish1, AW.fish2, AW.fish3, AW.fish4, AW.fish5]
    .map(k => num(row[k]))
    .filter(v => v > 0);
  return fish.length ? fish.map(v => fmtInches(v)).join(", ") : "—";
}

// Sorting state
let sortKey = "event_date";
let sortDir = "desc"; // newest first

function compare(a, b, key) {
  if (key === "event_date") return parseDateLoose(a.event_date) - parseDateLoose(b.event_date);

  const numericish = ["rank", "total_length_in", "big_bass_in"].includes(key);
  if (numericish) return num(a[key]) - num(b[key]);

  return String(a[key] ?? "").toLowerCase().localeCompare(String(b[key] ?? "").toLowerCase());
}

(async function init() {
  const angler = getParam("angler");
  if (!angler) {
    document.getElementById("anglerName").textContent = "Missing angler";
    document.getElementById("anglerMeta").textContent = "Open this page from Anglers and click a name.";
    return;
  }

  const [eventsText, awText] = await Promise.all([
    fetch(EVENTS_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(ANGLER_WIDE_CSV_URL, { cache: "no-store" }).then(r => r.text()),
  ]);

  const eventsAll = toObjects(eventsText);
  const awAll = toObjects(awText);

  const rows = awAll.filter(r => (r[AW.angler] || "").trim() === angler);
  const state = (rows[0]?.[AW.angler_state] || "").trim();

  document.getElementById("crumbAngler").textContent = angler;
  document.getElementById("anglerName").textContent = angler;
  document.getElementById("anglerMeta").textContent = state ? `State: ${state}` : "";

  const eventById = new Map(eventsAll.map(e => [e[EVT.event_id], e]));

  const normalized = rows.map(r => {
    const ev = eventById.get(r[AW.event_id]) || {};
    return {
      event_id: r[AW.event_id],
      event_name: ev[EVT.event_name] || "(Event)",
      event_date: ev[EVT.event_date] || r[AW.event_date] || "",
      trail: ev[EVT.trail] || r[AW.trail] || "",
      season: ev[EVT.season] || r[AW.season] || "",
      source_url: ev[EVT.source_url] || "",
      rank: num(r[AW.rank]) || 0,
      total_length_in: num(r[AW.total_length_in]) || 0,
      big_bass_in: num(r[AW.big_bass_in]) || 0,
      ["Limit%"]: r[AW.limit_pct] || "",
      ["AOY Points"]: r[AW.aoy] || "",
      _fish: r,
    };
  });

  const seasonFilter = document.getElementById("seasonFilter");
  const trailFilter = document.getElementById("trailFilter");
  const searchBox = document.getElementById("searchBox");

  setOptions(seasonFilter, unique(normalized.map(r => r.season)).sort().reverse(), "All seasons");
  setOptions(trailFilter, unique(normalized.map(r => r.trail)).sort(), "All trails");

  function computeKPIs(filtered) {
    const eventsCount = filtered.length;
    const seasonsCount = unique(filtered.map(r => r.season)).length;

    const finishRows = filtered.filter(r => r.rank > 0);
    const avgFinish = finishRows.length ? finishRows.reduce((s, r) => s + r.rank, 0) / finishRows.length : 0;
    const bestFinish = finishRows.length ? Math.min(...finishRows.map(r => r.rank)) : null;
    const worstFinish = finishRows.length ? Math.max(...finishRows.map(r => r.rank)) : null;

    const totalRows = filtered.filter(r => r.total_length_in > 0);
    const avgTotal = totalRows.length ? totalRows.reduce((s, r) => s + r.total_length_in, 0) / totalRows.length : 0;
    const bestTotalRow = totalRows.length
      ? totalRows.reduce((best, r) => (r.total_length_in > best.total_length_in ? r : best), totalRows[0])
      : null;

    const bestBBRow = filtered.length
      ? filtered.reduce((best, r) => (r.big_bass_in > best.big_bass_in ? r : best), filtered[0])
      : null;

    document.getElementById("kpiEvents").textContent = String(eventsCount);
    document.getElementById("kpiSeasons").textContent = seasonsCount ? `Seasons: ${seasonsCount}` : "";

    document.getElementById("kpiAvgFinish").textContent = avgFinish ? avgFinish.toFixed(2) : "—";
    document.getElementById("kpiBestWorst").textContent =
      (bestFinish !== null && worstFinish !== null) ? `Best: ${bestFinish} • Worst: ${worstFinish}` : "";

    document.getElementById("kpiAvgTotal").textContent = avgTotal ? fmtInches(avgTotal) : "—";
    document.getElementById("kpiBestTotal").textContent =
      bestTotalRow ? `Best: ${fmtInches(bestTotalRow.total_length_in)} (${bestTotalRow.event_name})` : "";

    document.getElementById("kpiBestBB").textContent =
      bestBBRow && bestBBRow.big_bass_in ? fmtInches(bestBBRow.big_bass_in) : "—";
    document.getElementById("kpiBestBBEvent").textContent =
      bestBBRow && bestBBRow.big_bass_in ? `${bestBBRow.event_name}` : "";
  }

  function render() {
    const season = seasonFilter.value;
    const trail = trailFilter.value;
    const q = (searchBox.value || "").toLowerCase();

    let filtered = normalized.filter(r => {
      const okSeason = !season || r.season === season;
      const okTrail = !trail || r.trail === trail;
      const hay = [r.event_name, r.trail, r.season, r.event_date].join(" ").toLowerCase();
      const okSearch = !q || hay.includes(q);
      return okSeason && okTrail && okSearch;
    });

    filtered.sort((a, b) => {
      const c = compare(a, b, sortKey);
      return sortDir === "asc" ? c : -c;
    });

    computeKPIs(filtered);

    const tbody = document.getElementById("resultsTable");
    const note = document.getElementById("note");
    tbody.innerHTML = "";

    for (const r of filtered) {
      const tr = document.createElement("tr");
      tr.className = "rowlink";
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `event.html?event_id=${encodeURIComponent(r.event_id)}`;
      });

      tr.innerHTML = `
        <td>${r.event_date || ""}</td>
        <td>${r.source_url
          ? `<a href="${r.source_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${r.event_name}</a>`
          : r.event_name}</td>
        <td>${r.trail}</td>
        <td>${r.rank || "—"}</td>
        <td>${r.total_length_in ? fmtInches(r.total_length_in) : "—"}</td>
        <td>${r.big_bass_in ? fmtInches(r.big_bass_in) : "—"}</td>
        <td>${r["Limit%"] || "—"}</td>
        <td>${r["AOY Points"] || "—"}</td>
        <td>${fishTop5(r._fish)}</td>
      `;

      tbody.appendChild(tr);
    }

    note.textContent = `Showing ${filtered.length} of ${normalized.length} results • Click headers to sort • Click a row for Event Details`;
  }

  document.querySelectorAll("thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (sortKey === key) sortDir = (sortDir === "asc" ? "desc" : "asc");
      else {
        sortKey = key;
        sortDir = (key === "event_date" ? "desc" : "asc");
      }
      render();
    });
  });

  seasonFilter.addEventListener("change", render);
  trailFilter.addEventListener("change", render);
  searchBox.addEventListener("input", render);

  render();
})();
