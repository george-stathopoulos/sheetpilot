# Privacy and security

## Your data stays on your computer

SheetPilot is a web page that runs entirely in your browser. When you import a file, it is read on your device. It is **not uploaded**, there is no account, and there is no server that receives your data.

- Your sheets are stored in your browser's own storage on this computer only.
- The app has **no cookies and no ads**.
- The website and the app count visits anonymously with Cloudflare Web Analytics: page views only, with no cookies and no personal data. **The contents of your sheet are never part of that.** Pages opened from a share link do not load the counter at all, because the link itself carries the shared data.
- The Excel reader is loaded from a public CDN the first time you import an Excel file. That request does not contain your file.

## Sharing and exporting

- An **exported web page** is a file you control. Treat it like the data it shows.
- A **share link** contains the data it shares inside the link. Only share what you are happy for the recipient to read, and remember that messaging apps may store links. See [Export and share](export-and-share.md).
- **Snapshots** open in a sandbox with scripts disabled. **Interactive copies** are parsed as plain data and shown with all text escaped, so a link cannot run code.

## Sensitive sheets

SheetPilot has no accounts or per-column permissions. It is a good fit for looking at a sensitive sheet (salaries, customers) privately on your own computer. It is not a way to control who sees it. If you share or export, you decide what leaves your computer.

## Open source

The code is public, so you can read how it works, run it from a local folder, or host it yourself. Report a problem on GitHub.
