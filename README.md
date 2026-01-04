# Kayak Stats Dashboard (Static)

This is a static HTML/CSS/JS dashboard that reads your Google Sheets tabs published as CSV.

## What you get
- Home dashboard with KPIs + Latest Events table
- Click any event -> Event Details page with full results (sortable/searchable)
- Winner, Total Length, Big Bass, and Angler count are computed from the Angler_Wide tab via event_id.

## Setup
1) In Google Sheets:
   - File -> Share -> Publish to web
   - Publish the following tabs as CSV:
     - Events
     - Angler_Wide

2) CSV URLs are already wired in. If you fork/copy, update them in:
   - app.js (EVENTS_CSV_URL, ANGLER_WIDE_CSV_URL)
   - event.js (EVENTS_CSV_URL, ANGLER_WIDE_CSV_URL)

3) Run locally (recommended):
   - In this folder, run:
     python -m http.server 8000
   - Open:
     http://localhost:8000/

## Notes
- If you open index.html with file:// the browser may block fetch(). Use a local server.
