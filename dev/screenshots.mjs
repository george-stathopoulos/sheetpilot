/**
 * Captures the documentation screenshots into docs/images/ from the app's built-in sample sheets
 * (generated data, so the images can be published freely).
 *
 *   npm install && node dev/screenshots.mjs
 *
 * Needs Google Chrome (via playwright-core). Serves the repository folder on a local port.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const OUT = join( ROOT, 'docs/images' );
mkdirSync( OUT, { recursive: true } );
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer( ( req, res ) => {
	const path = normalize( decodeURIComponent( req.url.split( '?' )[ 0 ] ) ).replace( /^(\.\.[/\\])+/, '' );
	const file = join( ROOT, path === '/' ? 'index.html' : path );
	if ( ! existsSync( file ) ) { res.writeHead( 404 ).end(); return; }
	res.writeHead( 200, { 'content-type': TYPES[ extname( file ) ] || 'application/octet-stream', 'cache-control': 'no-store' } ).end( readFileSync( file ) );
} ).listen( 0 );
const BASE = `http://127.0.0.1:${ server.address().port }/`;

const browser = await chromium.launch( { channel: 'chrome' } );

async function open( sample, { theme = 'clean', width = 1440, height = 900, reviewed = true } = {} ) {
	const context = await browser.newContext( { viewport: { width, height }, deviceScaleFactor: 2, locale: 'en-US', colorScheme: 'light', permissions: [ 'clipboard-read', 'clipboard-write' ] } );
	const page = await context.newPage();
	await page.goto( BASE );
	await page.click( '#btnImport' );
	await page.click( `[data-sample=${ sample }]` );
	await page.waitForSelector( 'section[data-sec]' );
	if ( reviewed ) await page.click( '[data-act=reviewed]' );
	if ( theme !== 'clean' ) await page.click( `.chip[data-t=${ theme }]` );
	await page.waitForTimeout( 300 );
	return { page, context };
}
const shot = ( page, name, target ) => ( target ? page.locator( target ).first() : page ).screenshot( { path: join( OUT, name + '.png' ) } );
const done = ( name ) => console.log( 'wrote', name );

// Tickets: dashboard, "how I read your sheet", themes, table, setup, findings and chart.
{
	let { page, context } = await open( 'tickets', { reviewed: false } );
	await shot( page, 'read-your-sheet', '.review' ); done( 'read-your-sheet' );
	await page.click( '[data-act=reviewed]' ); await page.waitForTimeout( 200 );
	await shot( page, 'dashboard' ); done( 'dashboard' );
	await shot( page, 'findings', 'section[data-sec=findings]' ); done( 'findings' );
	await shot( page, 'comparison-chart', 'section[data-sec=bars]' ); done( 'comparison-chart' );
	await shot( page, 'trend', 'section[data-sec=trend]' ); done( 'trend' );
	await page.click( '#tabs [data-tab=table]' ); await page.waitForTimeout( 200 ); await shot( page, 'table' ); done( 'table' );
	await page.click( '#tabs [data-tab=setup]' ); await page.waitForTimeout( 200 ); await shot( page, 'setup' ); done( 'setup' );
	await page.click( '#tabs [data-tab=dash]' );
	await page.click( '#btnImport' ); await page.waitForTimeout( 200 ); await shot( page, 'import-dialog', '#importDlg' ); done( 'import-dialog' ); await page.keyboard.press( 'Escape' );
	await page.click( '#btnOut' ); await page.waitForTimeout( 200 ); await shot( page, 'export-dialog', '#outDlg' ); done( 'export-dialog' ); await page.keyboard.press( 'Escape' );
	await page.click( '#btnShare' ); await page.waitForTimeout( 200 );
	await page.click( '#outGo' ); await page.waitForTimeout( 400 ); await shot( page, 'share-dialog', '#outDlg' ); done( 'share-dialog' );
	const link = await page.inputValue( '#linkOut' );
	const snap = await context.newPage(); await snap.goto( link ); await snap.waitForTimeout( 800 ); await shot( snap, 'snapshot', null ); done( 'snapshot' );
	await context.close();
}
for ( const t of [ 'corporate', 'midnight', 'sunset', 'forest' ] ) {
	const { page, context } = await open( 'tickets', { theme: t } );
	await shot( page, `theme-${ t }` ); done( `theme-${ t }` );
	await context.close();
}

// Reviews: heatmap of scored criteria.  Sales: logic found from the values.
{
	let { page, context } = await open( 'reviews' );
	await shot( page, 'heatmap', 'section[data-sec=heat]' ); done( 'heatmap' );
	await context.close();
	( { page, context } = await open( 'sales' ) );
	await shot( page, 'logic', 'section[data-sec=logic]' ); done( 'logic' );
	await context.close();
}
// Customers: reminders.
{
	const { page, context } = await open( 'customers' );
	await page.click( '#tabs [data-tab=rem]' ); await page.waitForTimeout( 200 );
	await shot( page, 'reminders' ); done( 'reminders' );
	await context.close();
}

await browser.close();
server.close();
