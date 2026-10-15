/** Renders website/src/assets/og.jpg (the social image) from the logo and the headline. Run: node dev/og.mjs */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const icon = readFileSync( 'website/src/assets/favicon.svg', 'utf8' );
const browser = await chromium.launch( { channel: 'chrome' } );
const page = await browser.newPage( { viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 } );
await page.setContent( `<body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(60% 80% at 90% 0%,rgba(33,163,102,.45),transparent 70%),radial-gradient(50% 60% at 0% 100%,rgba(255,213,74,.18),transparent 70%),#0b130e;color:#f5f4ee;position:relative">
<div style="position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:18px"><div style="width:72px;height:72px">${ icon }</div><div style="font-size:40px;font-weight:800;letter-spacing:-.02em">Sheet<span style="color:#3ddc84">Pilot</span></div></div>
<div style="position:absolute;left:72px;top:210px;width:640px"><div style="font-size:70px;line-height:1.05;font-weight:800;letter-spacing:-.035em">Your spreadsheet.<br><span style="background:linear-gradient(transparent 62%,rgba(255,213,74,.5) 62%)">Now a dashboard.</span></div>
<div style="margin-top:28px;font-size:26px;line-height:1.45;color:#c3c2b7">Drop in a CSV or Excel file. It works out what's inside and what stands out. Free, in your browser.</div></div>
<svg viewBox="0 0 330 300" style="position:absolute;right:56px;top:170px;width:400px"><rect x="4" y="4" width="322" height="292" rx="20" fill="#14221a" stroke="#2f453a" stroke-width="3"/><rect x="24" y="26" width="86" height="46" rx="10" fill="#101c15" stroke="#223329" stroke-width="2"/><rect x="122" y="26" width="86" height="46" rx="10" fill="#101c15" stroke="#223329" stroke-width="2"/><rect x="220" y="26" width="86" height="46" rx="10" fill="#101c15" stroke="#223329" stroke-width="2"/><g fill="#3ddc84"><rect x="34" y="226" width="30" height="40" rx="6"/><rect x="74" y="200" width="30" height="66" rx="6"/><rect x="114" y="170" width="30" height="96" rx="6"/><rect x="154" y="146" width="30" height="120" rx="6"/><rect x="194" y="120" width="30" height="146" rx="6"/><rect x="234" y="96" width="30" height="170" rx="6"/></g><path d="M300 70 262 86l14 6 6 16z" fill="#ffd54a"/></svg>
</body>` );
await page.screenshot( { path: 'website/src/assets/og.jpg', type: 'jpeg', quality: 88 } );
await browser.close();
console.log( 'og.jpg written' );
