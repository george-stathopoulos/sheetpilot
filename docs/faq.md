# FAQ

## Does my file get uploaded anywhere?

No. SheetPilot runs in your browser and reads your file on your device. See [Privacy and security](privacy-and-security.md).

## What can I open, and what works best?

Excel files (.xlsx and .xls, every tab), CSV or other delimited text, and cells pasted from Excel or Google Sheets. **Excel is best:** it keeps formulas, tabs and dates, which CSV loses. See [Messy sheets and supported files](messy-sheets.md).

## Can it connect to Google Sheets and stay in sync?

Not yet. Download the sheet as CSV or Excel, or paste the cells. A live connection would need sign-in and a server, which SheetPilot deliberately does not have.

## It picked the wrong main number or grouping. What do I do?

Use the dropdowns above the comparison chart, or **Setup → How SheetPilot reads this sheet**. Your choice is remembered. See [How SheetPilot reads your sheet](how-it-reads-your-sheet.md).

## Why does it say "lower is better" (or the opposite)?

The direction is guessed from the column name: hours, cost and churn are lower-is-better, scores and revenue higher-is-better. If it is wrong, change it next to the chart. Anything it cannot judge is shown with no good or bad colouring.

## Does it work in other languages?

Dates, numbers and text are handled in any language, but the name-based guesses (which column is the main number, which direction is good) are written for English column names. In other languages it plays safe, uses averages and shows no good or bad direction.

## My sheets disappeared.

Sheets are saved in your browser's storage. Clearing site data, using a private window, or switching browser or computer starts you fresh. Export a copy to keep one.

## How big a file can I use?

Tens of thousands of rows are fine. Hundreds of thousands will be slow because everything runs on your device.

## Is it free?

Yes, and open source. If it helps you, tell someone who lives in spreadsheets.

## Who makes it?

[George Stathopoulos](https://george-stathopoulos.github.io/). The CV, other projects and contact details are on that site.
