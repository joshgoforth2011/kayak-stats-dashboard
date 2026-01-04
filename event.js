// Kayak Stats Dashboard (Event Details)
// Paste the same published CSV URLs you used in app.js

const EVENTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=757517635&single=true&output=csv";
const ANGLER_WIDE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=620292831&single=true&output=csv";

const AW = {
  event_id: "event_id",
  event_date: "event_date",
  trail: "trail",
  season: "season",
  angler: "angler",
  angler_state: "angler_state",
  angler_url: "angler_url",
  rank: "rank",
  total_length_in: "total_length_in",
  big_bass_in: "big_bass_in",
  fish_limit: "fish_limit",
  limit_pct: "Limit%",
  aoy: "AOY Points",
  fish1: "fish_1_in",
  fish2: "fish_2_in",
  fish3: "fish_3_in",
  fish4: "fish_4_in",
  fish5: "fish_5_in",
  fish6: "fish_6_in",
  fish7: "fish_7_in",
  fish8: "fish_8_in",
  fish9: "fish_9_in",
  fish10: "fish_10_in",
};

const EVT = {
  event_id: "event_id",
  trail: "trail",
  season: "season",
  event_name: "event_name",
  event_date: "event_date",
  source_url: "source_url",
  fish_limit: "fish_limit",
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

function fmtInches(n) { return `${n.toFixed(1)}"`; }

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function fishList(row, maxN = 10) {
  const keys = [AW.fish1,AW.fish2,AW.fish3,AW.fish4,AW.fish5,AW.fish6,AW.fish7,AW.fish8,AW.fish9,AW.fish10];
  const used = keys.slice(0, maxN).map(k => num(row[k])).filter(v => v > 0);
  return used.length ? used.map(v => fmtInches(v)).join(", ") : "—";
}

function compareRows(a, b, key) {
  const numericish = ["rank","total_length_in","big_bass_in","Limit%","AOY Points"].includes(key);
  if (numericish) return num(a[key]) - num(b[key]);
  const as = String(a[key] ?? "").toLowerCase();
  const bs = String(b[key] ?? "").toLowerCase();
  return as.localeCompare(bs);
}

let sortKey = "rank";
let sortDir = "asc";
let showAllFish = true;

(async function init() {
  const event_id = getParam("event_id");
  if (!event_id) {
    document.getElementById("eventTitle").textContent = "Missing event_id";
    document.getElementById("eventMeta").textContent = "Open this page from the Home table click.";
    return;
  }

  const [eventsText, awText] = await Promise.all([
    fetch(EVENTS_CSV_URL, { cache: "no-store" }).then(r => r.text()),
    fetch(ANGLER_WIDE_CSV_URL, { cache: "no-store" }).then(r => r.text()),
  ]);

  const eventsAll = toObjects(eventsText);
  const awAll = toObjects(awText);

  const evtRow = eventsAll.find(e => e[EVT.event_id] === event_id) || null;
  const rows = awAll.filter(r => r[AW.event_id] === event_id);

  const name = evtRow ? (evtRow[EVT.event_name] || `Event ${event_id}`) : `Event ${event_id}`;
  const date = evtRow ? (evtRow[EVT.event_date] || "") : (rows[0]?.[AW.event_date] || "");
  const trail = evtRow ? (evtRow[EVT.trail] || "") : (rows[0]?.[AW.trail] || "");
  const season = evtRow ? (evtRow[EVT.season] || "") : (rows[0]?.[AW.season] || "");

  document.getElementById("crumbEvent").textContent = name;
  document.getElementById("eventTitle").textContent = name;
  document.getElementById("eventMeta").textContent = [season, trail, date].filter(Boolean).join(" • ");

  if (evtRow && evtRow[EVT.source_url]) {
    const link = document.getElementById("eventSourceLink");
    link.href = evtRow[EVT.source_url];
    link.style.display = "inline-block";
  }

  const anglerCount = new Set(rows.map(r => r[AW.angler])).size;

  // Winner
  let winner = null;
  for (const r of rows) {
    const rank = num(r[AW.rank]);
    const total = num(r[AW.total_length_in]);

    if (!winner) {
      winner = { angler: r[AW.angler], state: r[AW.angler_state], rank, total };
      continue;
    }

    const winnerHasRank = winner.rank > 0;
    const rHasRank = rank > 0;

    if (rHasRank && (!winnerHasRank || rank < winner.rank || (rank === winner.rank && total > winner.total))) {
      winner = { angler: r[AW.angler], state: r[AW.angler_state], rank, total };
    } else if (!rHasRank && !winnerHasRank && total > winner.total) {
      winner = { angler: r[AW.angler], state: r[AW.angler_state], rank: 0, total };
    }
  }

  // Big bass leader
  let bigBass = { len: 0, angler: null, state: null };
  for (const r of rows) {
    const bb = num(r[AW.big_bass_in]);
    if (bb > bigBass.len) bigBass = { len: bb, angler: r[AW.angler], state: r[AW.angler_state] };
  }

  const avgTotal = rows.length ? rows.reduce((s, r) => s + num(r[AW.total_length_in]), 0) / rows.length : 0;
  const fishLimit = (evtRow?.[EVT.fish_limit] || rows[0]?.[AW.fish_limit] || "").trim();

  document.getElementById("kpiWinner").textContent = winner?.angler || "—";
  document.getElementById("kpiWinnerSub").textContent = winner?.total ? `Rank ${winner.rank || "—"} • ${fmtInches(winner.total)}` : "";

  document.getElementById("kpiAnglers").textContent = String(anglerCount || 0);
  document.getElementById("kpiFishLimit").textContent = fishLimit ? `Fish limit: ${fishLimit}` : "";

  document.getElementById("kpiWinningTotal").textContent = winner?.total ? fmtInches(winner.total) : "—";
  document.getElementById("kpiAvgTotal").textContent = rows.length ? `Avg total: ${fmtInches(avgTotal)}` : "";

  document.getElementById("kpiBigBass").textContent = bigBass.len ? fmtInches(bigBass.len) : "—";
  document.getElementById("kpiBigBassSub").textContent = bigBass.angler ? `${bigBass.angler}${bigBass.state ? ` (${bigBass.state})` : ""}` : "";

  const tbody = document.getElementById("resultsTable");
  const note = document.getElementById("resultsNote");
  const search = document.getElementById("resultSearch");
  const fishToggle = document.getElementById("fishToggle");

  fishToggle.textContent = showAllFish ? "Show Fish 1–5" : "Show Fish 1–10";
  fishToggle.addEventListener("click", () => {
    showAllFish = !showAllFish;
    fishToggle.textContent = showAllFish ? "Show Fish 1–5" : "Show Fish 1–10";
    render();
  });

  function render() {
    const q = (search.value || "").toLowerCase();

    let filtered = rows.filter(r => {
      const hay = [r[AW.angler], r[AW.angler_state]].join(" ").toLowerCase();
      return !q || hay.includes(q);
    });

    filtered.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });

    tbody.innerHTML = "";
    for (const r of filtered) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${num(r[AW.rank]) || "—"}</td>
        <td>${r[AW.angler_url] ? `<a href="${r[AW.angler_url]}" target="_blank" rel="noopener noreferrer">${r[AW.angler] || ""}</a>` : (r[AW.angler] || "")}</td>
        <td>${r[AW.angler_state] || ""}</td>
        <td>${num(r[AW.big_bass_in]) ? fmtInches(num(r[AW.big_bass_in])) : "—"}</td>
        <td>${num(r[AW.total_length_in]) ? fmtInches(num(r[AW.total_length_in])) : "—"}</td>
        <td>${r[AW.limit_pct] || "—"}</td>
        <td>${r[AW.aoy] || "—"}</td>
        <td>${fishList(r, showAllFish ? 10 : 5)}</td>
      `;
      tbody.appendChild(tr);
    }

    note.textContent = `Showing ${filtered.length} of ${rows.length} anglers • Click headers to sort`;
  }

  document.querySelectorAll("thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (sortKey === key) sortDir = (sortDir === "asc" ? "desc" : "asc");
      else { sortKey = key; sortDir = "asc"; }
      render();
    });
  });

  search.addEventListener("input", render);
  render();
})();
