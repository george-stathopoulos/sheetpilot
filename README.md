# SheetPilot

Turn any spreadsheet into a tracked workflow with reminders and insights. Customers, salaries, contracts, inventory: if it has rows, dates and a status, SheetPilot can track it.

## MVP features

- Import CSV, Excel (.xlsx via SheetJS from a CDN) or pasted cells
- Automatic column type detection (text, number, money, date, status, email), editable in Setup
- Editable table with search, status filter and sorting
- Reminders: choose which date columns trigger them, with an offset (e.g. -30 days before a contract end); Done and +7d buttons
- "Gone quiet" rule: flag rows with no activity for N days
- Per-row notes timeline
- Insights: totals by status, numeric column stats, top rows by amount
- CSV export

## Run it

```bash
python3 -m http.server 8765
```

Open http://localhost:8765. No build step, no backend. Data is stored only in the browser (localStorage).

## Not in the MVP yet

Google Sheets live sync, user accounts and sharing, per-column permissions (needed for sensitive data like salaries), email/push notifications, multi-sheet Excel workbooks (only the first sheet is read).
