# SheetPilot

Turn any spreadsheet into a tracked workflow with reminders and insights. Customers, salaries, contracts, inventory: if it has rows, dates and a status, SheetPilot can track it.

## MVP features

- Import CSV, Excel (.xlsx via SheetJS from a CDN) or pasted cells
- Reads messy sheets: finds the real header row (even under label rows), day-first or month-first dates, semicolon/tab/comma delimiters
- Works out what each column is (text, number, money, percent, date, status, yes/no, link, long text), editable in Setup
- Discovers the calculation logic between columns (sums, ratios, copies) and flags rows that break it; shows real formulas when you upload .xlsx (untested)
- Builds an interactive dashboard from that: filters, KPI cards, grouped bars (click to filter), trend line, criteria heatmap, distribution, lowest/highest list
- Self-adjusting analysis: scores candidates for the main number, grouping column and timeline; infers total vs average and whether higher or lower is better; writes plain-language findings (including "no group stands out") and data-quality notes
- A "How I read your sheet" review with an Auto/override control for each choice; overrides are remembered per sheet
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
