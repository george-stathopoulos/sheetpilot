# Messy sheets and supported files

Real spreadsheets are rarely tidy. SheetPilot is built to cope with the common problems.

## Files

| You have | What happens |
|---|---|
| An **Excel** file (.xlsx, .xls) — **recommended** | Every tab is read, dates stay dates, and your real formulas are shown in plain words. Tabs that only contain formulas and no data (empty monthly templates) are skipped, with a note. |
| A **CSV** file, or tab or semicolon separated text | Read directly, and the separator is detected for you. A CSV has only values, so formulas are inferred from the numbers instead. |
| **Cells copied** from Excel or Google Sheets | Paste them into the import dialog. |
| **Google Sheets** | Download as **Excel (.xlsx)** for the best results (File → Download), or copy the cells. There is no live connection. |

The Excel reader is loaded from a CDN the first time you import an Excel file, so that needs an internet connection. CSV works offline.

## Headers and labels

- A **title row or label rows above the headers** are skipped: SheetPilot finds the real header row.
- **Repeated or very long headers**, such as the same "0 = not met, 3 = partly, 5 = OK" over several columns, are replaced with the short name from the row above, and the long text becomes a tooltip.
- Cells **to the right of the table**, such as a legend, are ignored.

## Dates

- Dates written `2026-10-08`, `08.10.2026` or `10/8/2026` are all understood.
- If the order is unclear (day first or month first), SheetPilot decides from the rest of the column: a value such as `25.03.2026` shows that it is day first, dots usually mean day first, and a stray ambiguous value is resolved by its neighbouring dates. It tells you when it had to guess.

## Side-by-side tables

Price lists and similar layouts, where several blocks sit next to each other under shared headings, are converted into one row per block, section, item and plan. A note on the sheet says when that happened. This works for blocks that have a header row and numbers beneath it.

## What it cannot do

- It does not run macros, pivot tables or charts from the original file.
- Conditional or lookup formulas are shown but not evaluated; the values in the file are used.
- Very large files (hundreds of thousands of rows) become slow, because everything runs on your device.
- Merged cells in the data area may need a clean-up first.

If a column is read as the wrong type, change it in **Setup → Column types**.

Next: [Reminders and the table](reminders-and-table.md).
