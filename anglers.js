// Anglers directory (computed from Angler_Wide)
const ANGLER_WIDE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIsYaYhvyYXo0B57TjF2Ws88bJL5UPJgaXYQgmxmHMQxCQlFvb2oc_KArcXeju0UHnXh8FV7898-9j/pub?gid=620292831&single=true&output=csv";

const AW = {
  angler: "angler",
  angler_state: "angler_state",
  rank: "rank",
  total_length_in: "total_length_in",
  big_bass_in: "big_bass_in",
  event_id: "event_id",
};

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
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

(async function init() {
  const text = await fetch(ANGLER_WIDE_CSV_URL, { cache: "no-store" }).then(r => r.text());
  const rows = toObjects(text);

  // Aggregate by angler
  const map = new Map();
  for (const r of rows) {
    const name = (r[AW.angler] || "").trim();
    if (!name) continue;

    if (!map.has(name)) {
      map.set(name, {
        angler: name,
        state: (r[AW.angler_state] || "").trim(),
        events: new Set(),
        sumFinish: 0,
        finishCount: 0,
        bestFinish: null,
        sumTotal: 0,
        totalCount: 0,
        bestBigBass: 0,
      });
    }

    const a = map.get(name);
    a.events.add(r[AW.event_id]);

    const rk = num(r[AW.rank]);
    if (rk > 0) {
      a.sumFinish += rk;
      a.finishCount += 1;
      a.bestFinish = (a.bestFinish === null) ? rk : Math.min(a.bestFinish, rk);
    }

    const tot = num(r[AW.total_length_in]);
    if (tot > 0) {
      a.sumTotal += tot;
      a.totalCount += 1;
    }

    const bb = num(r[AW.big_bass_in]);
    if (bb > a.bestBigBass) a.bestBigBass = bb;
  }

  const anglers = [...map.values()].map(a => ({
    ...a,
    eventCount: a.events.size,
    avgFinish: a.finishCount ? (a.sumFinish / a.finishCount) : 0,
    avgTotal: a.totalCount ? (a.sumTotal / a.totalCount) : 0,
  }));

  // Default sort: most events, then best avg finish
  anglers.sort((a, b) => (b.eventCount - a.eventCount) || (a.avgFinish - b.avgFinish));

  const tbody = document.getElementById("anglersTable");
  const note = document.getElementById("note");
  const searchBox = document.getElementById("searchBox");

  function render() {
    const q = (searchBox.value || "").toLowerCase();
    const filtered = anglers.filter(a => {
      const hay = `${a.angler} ${a.state}`.toLowerCase();
      return !q || hay.includes(q);
    });

    tbody.innerHTML = "";
    for (const a of filtered) {
      const tr = document.createElement("tr");
      tr.className = "rowlink";
      tr.style.cursor = "pointer";
      tr.title = "Click to open profile";

      tr.addEventListener("click", () => {
        window.location.href = `anglerprofile.html?angler=${encodeURIComponent(a.angler)}`;
      });

      tr.innerHTML = `
        <td><span class="badge badge-win">👤 ${a.angler}</span></td>
        <td>${a.state || ""}</td>
        <td>${a.eventCount}</td>
        <td>${a.avgFinish ? a.avgFinish.toFixed(2) : "—"}</td>
        <td>${a.bestFinish ?? "—"}</td>
        <td>${a.avgTotal ? fmtInches(a.avgTotal) : "—"}</td>
        <td>${a.bestBigBass ? `<span class="badge badge-bb">🐟 ${fmtInches(a.bestBigBass)}</span>` : "—"}</td>
      `;
      tbody.appendChild(tr);
    }

    note.textContent = `Showing ${filtered.length} anglers`;
  }

  searchBox.addEventListener("input", render);
  render();
})();
