/**
 * Builds the SheetPilot website into website/dist (published to GitHub Pages from the gh-pages branch).
 *
 * Pages: home, the live app (the app itself, copied to app/), the Help center generated from
 * ../docs/*.md (so the website and the docs never drift apart), and a 404 page. Same layout, footer
 * and project list as the other project sites.
 *
 * Run from the repository root: node website/build.mjs
 */
import MarkdownIt from 'markdown-it';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

/* ------------------------------------------------------------------ Config */

const SITE = {
	name: 'SheetPilot',
	url: 'https://george-stathopoulos.github.io/sheetpilot/',
	base: '/sheetpilot/', // Used only by 404.html, which GitHub Pages serves from any path.
	author: 'George Stathopoulos',
	authorUrl: 'https://george-stathopoulos.github.io/',
	repo: 'https://github.com/george-stathopoulos/sheetpilot',
};

// Every project site lists the others (and the personal site keeps them all). Keep this list the
// same in each project's website build.
const PROJECTS = [
	{ name: 'Gatehouse', url: 'https://george-stathopoulos.github.io/gatehouse/', text: 'AI governance and cost control for WordPress' },
	{ name: 'Helpdesk Hero', url: 'https://george-stathopoulos.github.io/helpdesk-hero/', text: 'WordPress support with diagnostics and password-free access' },
	{ name: 'Fixpass', url: 'https://george-stathopoulos.github.io/fixpass/', text: 'Spotlight the problem and give support safe, temporary access' },
	{ name: 'FixSpot', url: 'https://george-stathopoulos.github.io/fixspot/', text: 'Point at what is broken on any website and share a private link' },
	{ name: 'SheetPilot', url: 'https://george-stathopoulos.github.io/sheetpilot/', text: 'Turn any spreadsheet into an interactive dashboard, in your browser' },
	{ name: 'Expenity', url: 'https://expenity.github.io/expenity/', text: 'Know where your money goes. English and Greek' },
];

const ROOT = process.cwd();
const OUT = join( ROOT, 'website/dist' );
const SRC = join( ROOT, 'website/src' );
const VERSION = JSON.parse( readFileSync( join( ROOT, 'package.json' ), 'utf8' ) ).version;
// Asset links change on every build, so browsers never keep a stale script or stylesheet.
const ASSET_V = VERSION + '.' + Date.now().toString( 36 );

rmSync( OUT, { recursive: true, force: true } );
mkdirSync( OUT, { recursive: true } );
cpSync( join( SRC, 'assets' ), join( OUT, 'assets' ), { recursive: true } );
writeFileSync( join( OUT, '.nojekyll' ), '' );

// The app itself is the live demo: the same files, served from app/.
mkdirSync( join( OUT, 'app' ), { recursive: true } );
for ( const f of [ 'index.html', 'app.js', 'style.css', 'favicon.svg' ] ) cpSync( join( ROOT, f ), join( OUT, 'app', f ) );

/* ------------------------------------------------------------------ Images */

// Screenshots (made by dev/screenshots.mjs): docs/images/*.png -> assets/img/*.jpg (1800px, sharp on retina screens).
mkdirSync( join( OUT, 'assets/img' ), { recursive: true } );
const IMG = {};
for ( const f of readdirSync( join( ROOT, 'docs/images' ) ) ) {
	if ( ! f.endsWith( '.png' ) ) continue;
	const name = f.replace( /\.png$/, '' );
	const out = join( OUT, 'assets/img', name + '.jpg' );
	execFileSync( 'sips', [ '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1800', join( ROOT, 'docs/images', f ), '--out', out ], { stdio: 'ignore' } );
	const dims = execFileSync( 'sips', [ '-g', 'pixelWidth', '-g', 'pixelHeight', out ], { encoding: 'utf8' } );
	IMG[ name ] = { w: Number( /pixelWidth: (\d+)/.exec( dims )[ 1 ] ), h: Number( /pixelHeight: (\d+)/.exec( dims )[ 1 ] ) };
}

function img( name, alt, root ) {
	const d = IMG[ name ];
	if ( ! d ) throw new Error( 'Missing screenshot: ' + name );
	return `<img src="${ root }assets/img/${ name }.jpg" width="${ d.w }" height="${ d.h }" alt="${ alt.replace( /"/g, '&quot;' ) }" loading="lazy" decoding="async">`;
}

/* ------------------------------------------------------------------ Helpers */

const esc = ( s ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
const slug = ( t ) =>
	t
		.toLowerCase()
		.replace( /<[^>]+>/g, '' )
		.replace( /[^\p{L}\p{N}\s_-]/gu, '' )
		.trim()
		.replace( /\s/g, '-' );

const svg = ( d, size = 22 ) => `<svg width="${ size }" height="${ size }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ d }</svg>`;
const I = {
	sun: svg( '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 18 ),
	menu: svg( '<path d="M4 7h16M4 12h16M4 17h16"/>', 20 ),
	open: svg( '<path d="M5 12h14M13 6l6 6-6 6"/>', 18 ),
	play: svg( '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>' ),
	brain: svg( '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>' ),
	chart: svg( '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>' ),
	share: svg( '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>' ),
	grid: svg( '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>' ),
	shield: svg( '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>' ),
	help: svg( '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>' ),
};

/* ------------------------------------------------------------------ Layout */

const NAV = [
	{ id: 'how', label: 'How it works', href: 'index.html#how' },
	{ id: 'features', label: 'Features', href: 'index.html#features' },
	{ id: 'templates', label: 'Templates', href: 'index.html#templates' },
	{ id: 'app', label: 'Open the app', href: 'app/' },
	{ id: 'docs', label: 'Help center', href: 'docs/' },
];

// The logo: a paper plane flying over rising bars (same artwork as favicon.svg).
const LOGO_RAW = readFileSync( join( SRC, 'assets/favicon.svg' ), 'utf8' ).replace( '<svg ', '<svg class="logo-mark" width="30" height="30" aria-hidden="true" ' );
function logo( n = 1 ) {
	return `${ LOGO_RAW.replace( /spg/g, 'spg' + n ).replace( /spc/g, 'spc' + n ) }<span class="logo-text">Sheet<b>Pilot</b></span>`;
}

function layout( { title, description, root, current = '', body, canonical = '', extraHead = '', home = false } ) {
	const full = title === SITE.name ? `${ SITE.name }: turn any spreadsheet into a dashboard` : `${ title } · ${ SITE.name }`;
	const fix = ( href ) => ( root === '' && href.startsWith( 'index.html#' ) ? href.slice( 10 ) : root + href );
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ esc( full ) }</title>
<meta name="description" content="${ esc( description ) }">
<meta name="theme-color" content="#107c41">
<link rel="canonical" href="${ SITE.url }${ canonical }">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${ SITE.name }">
<meta property="og:title" content="${ esc( full ) }">
<meta property="og:description" content="${ esc( description ) }">
<meta property="og:url" content="${ SITE.url }${ canonical }">
<meta property="og:image" content="${ SITE.url }assets/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${ root }assets/favicon.svg" type="image/svg+xml">
<!-- Cloudflare Web Analytics: counts visits anonymously, no cookies --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "64332b427a604e879f82853393ebdb0d"}'></script><!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="${ root }assets/site.css?v=${ ASSET_V }">
<link rel="stylesheet" href="${ root }assets/brand.css?v=${ ASSET_V }">
<link rel="stylesheet" href="${ root }assets/home.css?v=${ ASSET_V }">
<script>try{localStorage.removeItem('hdh-site-theme');var t=sessionStorage.getItem('hdh-site-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}</script>
${ extraHead }
</head>
<body data-root="${ root }"${ home ? ' class="is-home"' : '' }>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
	<div class="wrap">
		<a class="brand brand--logo" href="${ root || './' }" aria-label="SheetPilot home">${ logo() }</a>
		<nav id="site-nav" class="nav" aria-label="Main">
			${ NAV.map( ( n ) => `<a href="${ fix( n.href ) }"${ current === n.id ? ' aria-current="page"' : '' }>${ n.label }</a>` ).join( '\n\t\t\t' ) }
		</nav>
		<div class="head-actions">
			<button class="icon-btn" type="button" data-theme-toggle aria-label="Dark theme" aria-pressed="false">${ I.sun }</button>
			<a class="btn btn-primary btn-sm" href="${ root }app/">${ I.open } Open app</a>
			<button class="icon-btn menu-btn" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false" aria-label="Menu">${ I.menu }</button>
		</div>
	</div>
</header>
<main id="main">
${ body }
</main>
<footer class="site-foot">
	<div class="wrap">
		<div class="foot-grid">
			<div class="foot-about">
				<a class="brand brand--logo" href="${ root || './' }" aria-label="SheetPilot home">${ logo( 2 ) }</a>
				<p>Turn any spreadsheet into an interactive dashboard, in your browser. It works out what's in your sheet and tells you what stands out. Free and open source.</p>
			</div>
			<div>
				<h2>Product</h2>
				<ul>
					<li><a href="${ fix( 'index.html#how' ) }">How it works</a></li>
					<li><a href="${ fix( 'index.html#features' ) }">Features</a></li>
					<li><a href="${ root }app/">Open the app</a></li>
					<li><a href="${ SITE.repo }">Source on GitHub</a></li>
				</ul>
			</div>
			<div>
				<h2>Help</h2>
				<ul>
					<li><a href="${ root }docs/">Help center</a></li>
					<li><a href="${ root }docs/getting-started/">Getting started</a></li>
					<li><a href="${ root }docs/export-and-share/">Export and share</a></li>
					<li><a href="${ root }docs/faq/">FAQ</a></li>
				</ul>
			</div>
			<div>
				<h2>More projects</h2>
				<ul>
					${ PROJECTS.filter( ( p ) => p.name !== SITE.name ).map( ( p ) => `<li><a href="${ p.url }" title="${ esc( p.text ) }">${ esc( p.name ) }</a></li>` ).join( '' ) }
					<li><a href="${ SITE.authorUrl }#projects">All projects</a></li>
					<li><a href="https://george-stathopoulos.github.io/blog/" title="The story behind every project">Blog</a></li>
				</ul>
			</div>
			<div>
				<h2>Trust</h2>
				<ul>
					<li><a href="${ root }docs/privacy-and-security/">Privacy and security</a></li>
					<li><a href="${ root }docs/privacy-and-security/#your-data-stays-on-your-computer">Your data stays with you</a></li>
					<li><a href="${ SITE.repo }/issues">Feedback and ideas</a></li>
				</ul>
			</div>
		</div>
		<div class="foot-bottom">
			<span>Made with <span class="heart" role="img" aria-label="love">♥</span> by <a href="${ SITE.authorUrl }">${ SITE.author }</a></span>
			<span>SheetPilot ${ VERSION } · This website uses no cookies. Visits are counted anonymously, with no personal data.</span>
		</div>
	</div>
</footer>
<script src="${ root }assets/site.js?v=${ ASSET_V }" defer></script>
${ home ? `<script src="${ root }assets/home.js?v=${ ASSET_V }" defer></script>` : '' }
</body>
</html>
`;
}

function write( path, html ) {
	const file = join( OUT, path );
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, html );
}

/* ------------------------------------------------------------------ Help center (docs) */

const GROUPS = [
	{ label: 'Start here', pages: [ 'getting-started', 'how-it-reads-your-sheet' ] },
	{ label: 'Using SheetPilot', pages: [ 'the-dashboard', 'export-and-share', 'reminders-and-table' ] },
	{ label: 'Reference', pages: [ 'messy-sheets', 'privacy-and-security', 'faq' ] },
];
const ORDER = GROUPS.flatMap( ( g ) => g.pages );
const BLURB = {
	'getting-started': 'Import a sheet and find your way around the dashboard.',
	'how-it-reads-your-sheet': 'The choices SheetPilot makes, the formulas it finds, and how to change them.',
	'the-dashboard': 'Sections, filters, comparisons, and the fourteen templates.',
	'export-and-share': 'Export a web page, PDF or CSV, and share a link.',
	'reminders-and-table': 'Date reminders, editing rows, and notes.',
	'messy-sheets': 'Supported files, awkward headers and dates, side-by-side tables, and limits.',
	'privacy-and-security': 'What stays on your computer, and how sharing works.',
	faq: 'Quick answers to the most common questions.',
};
const ICON = {
	'getting-started': I.play,
	'how-it-reads-your-sheet': I.brain,
	'the-dashboard': I.chart,
	'export-and-share': I.share,
	'reminders-and-table': I.grid,
	'messy-sheets': I.grid,
	'privacy-and-security': I.shield,
	faq: I.help,
};

const docs = {};
const searchIndex = [];

for ( const name of ORDER ) {
	const md = new MarkdownIt( { html: false, linkify: false, typographer: false } );
	const headings = [];
	const used = {};
	let title = name;
	md.core.ruler.push( 'sp', ( state ) => {
		state.tokens.forEach( ( tok, i ) => {
			if ( tok.type === 'heading_open' ) {
				const text = state.tokens[ i + 1 ].content;
				let id = slug( text );
				used[ id ] = ( used[ id ] || 0 ) + 1;
				if ( used[ id ] > 1 ) id += '-' + ( used[ id ] - 1 );
				tok.attrSet( 'id', id );
				if ( tok.tag === 'h1' ) title = text;
				else headings.push( { level: tok.tag, id, text: text.replace( /[`*]/g, '' ) } );
			}
			( state.tokens[ i ].children || [] ).forEach( ( c ) => {
				if ( c.type === 'image' ) {
					const src = c.attrGet( 'src' );
					const m = /images\/([a-z0-9-]+)\.png$/.exec( src );
					if ( ! m || ! IMG[ m[ 1 ] ] ) throw new Error( `docs/${ name }.md: missing image ${ src }` );
					c.attrSet( 'src', `../../assets/img/${ m[ 1 ] }.jpg` );
					c.attrSet( 'width', String( IMG[ m[ 1 ] ].w ) );
					c.attrSet( 'height', String( IMG[ m[ 1 ] ].h ) );
					c.attrSet( 'loading', 'lazy' );
					c.attrSet( 'decoding', 'async' );
				}
				if ( c.type === 'link_open' ) {
					// The docs use GitHub-friendly links (other-guide.md#section); on the site they're pages.
					const href = c.attrGet( 'href' );
					const m = /^([a-z0-9-]+)\.md(#.+)?$/i.exec( href );
					if ( m ) c.attrSet( 'href', m[ 1 ] === 'README' ? `../${ m[ 2 ] || '' }` : `../${ m[ 1 ] }/${ m[ 2 ] || '' }` );
					else if ( /^\.\.\//.test( href ) ) c.attrSet( 'href', `${ SITE.repo }/blob/main/${ href.slice( 3 ) }` );
					else if ( /^https?:/.test( href ) ) c.attrSet( 'rel', 'noopener' );
				}
			} );
		} );
	} );
	const src = readFileSync( join( ROOT, 'docs', name + '.md' ), 'utf8' );
	let html = md.render( src );
	html = html
		.replace( /<p>(<img [^>]*alt="([^"]*)"[^>]*>)<\/p>/g, '<figure data-zoom>$1<figcaption>$2</figcaption></figure>' )
		.replace( /<pre>/g, '<pre tabindex="0">' )
		.replace( /<table>/g, '<table tabindex="0">' )
		.replace( /<(h[23]) id="([^"]+)">(.*?)<\/\1>/g, '<$1 id="$2">$3<a class="anchor" href="#$2" aria-label="Link to this section">#</a></$1>' );
	docs[ name ] = { title, html, headings, src };

	// Search entries: the page itself and each section.
	const plain = ( s ) => s.replace( /\[([^\]]+)\]\([^)]*\)/g, '$1' ).replace( /!\[[^\]]*\]\([^)]*\)/g, ' ' ).replace( /[`*_>#|]/g, ' ' ).replace( /:?-{3,}:?/g, ' ' ).replace( /\s+/g, ' ' ).trim();
	src.split( /\n(?=#{2,3} )/ ).forEach( ( part, i ) => {
		const m = /^(#{1,3}) (.+)\n/.exec( part.startsWith( '#' ) ? part : '# ' + title + '\n' + part );
		const heading = i === 0 ? '' : m ? m[ 2 ] : '';
		const id = heading ? headings.find( ( h ) => h.text === heading.replace( /[`*]/g, '' ) )?.id || '' : '';
		searchIndex.push( { t: title, s: heading.replace( /[`*]/g, '' ), u: `docs/${ name }/${ id ? '#' + id : '' }`, x: plain( part.replace( /^#{1,3} .+\n/, '' ) ).slice( 0, 600 ) } );
	} );
}

// site.js reads the search index from this global (shared with the other project sites).
writeFileSync( join( OUT, 'assets/search-index.js' ), 'window.HDH_SEARCH=' + JSON.stringify( searchIndex ) + ';' );

function searchBox( id, placeholder ) {
	return `<div class="search" data-search role="search">
	<label class="sr" for="${ id }">Search the help center</label>
	<input id="${ id }" type="search" placeholder="${ esc( placeholder ) }" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${ id }-results">
	<ul class="search-results" id="${ id }-results" role="listbox" aria-label="Search results" hidden></ul>
	<p class="sr" role="status" aria-live="polite"></p>
</div>`;
}

const SEARCH_SCRIPT = ( root ) => `<script src="${ root }assets/search-index.js?v=${ ASSET_V }" defer></script>`;

function docsNav( current ) {
	return `<aside class="docs-nav" aria-label="Help center">
	${ searchBox( 'side-search', 'Search help…' ) }
	<details open>
		<summary class="docs-nav-toggle">Browse all guides</summary>
		<ul><li><a href="../"${ current === '' ? ' aria-current="page"' : '' }>Help center home</a></li></ul>
		${ GROUPS.map( ( g ) => `<h2>${ g.label }</h2><ul>${ g.pages.map( ( p ) => `<li><a href="../${ p }/"${ current === p ? ' aria-current="page"' : '' }>${ esc( docs[ p ].title ) }</a></li>` ).join( '' ) }</ul>` ).join( '\n\t\t' ) }
	</details>
</aside>`;
}

ORDER.forEach( ( name, i ) => {
	const d = docs[ name ];
	const prev = ORDER[ i - 1 ];
	const next = ORDER[ i + 1 ];
	const toc = d.headings.filter( ( h ) => h.level === 'h2' );
	const body = `<div class="wrap docs-layout">
${ docsNav( name ) }
<article class="doc">
	<nav class="crumbs" aria-label="Breadcrumb"><a href="../">Help center</a> › ${ esc( d.title ) }</nav>
	${ d.html }
	<div class="help-strip"><p><strong>Still stuck?</strong> Check the <a href="../faq/">FAQ</a>, or <a href="${ SITE.repo }/issues">ask on GitHub</a>.</p></div>
	<nav class="pager" aria-label="Previous and next guide">
		${ prev ? `<a class="prev" href="../${ prev }/"><small>Previous</small>${ esc( docs[ prev ].title ) }</a>` : '' }
		${ next ? `<a class="next" href="../${ next }/"><small>Next</small>${ esc( docs[ next ].title ) }</a>` : '' }
	</nav>
</article>
${ toc.length > 1 ? `<nav class="on-page" aria-label="On this page" data-spy><h2>On this page</h2><ul>${ toc.map( ( h ) => `<li><a href="#${ h.id }">${ esc( h.text ) }</a></li>` ).join( '' ) }</ul></nav>` : '<div></div>' }
</div>`;
	write( `docs/${ name }/index.html`, layout( { title: d.title, description: BLURB[ name ] + ' SheetPilot help center.', root: '../../', current: 'docs', canonical: `docs/${ name }/`, body, extraHead: SEARCH_SCRIPT( '../../' ) } ) );
} );

// Help center home.
{
	const popular = [
		[ 'getting-started', 'open-your-first-sheet', 'Open your first sheet' ],
		[ 'how-it-reads-your-sheet', 'changing-the-choices', 'Fix a wrong guess' ],
		[ 'the-dashboard', 'choose-a-style', 'Choose a style' ],
		[ 'export-and-share', 'how-sharing-works', 'How sharing works' ],
		[ 'messy-sheets', 'dates', 'Day-first or month-first dates' ],
		[ 'privacy-and-security', 'your-data-stays-on-your-computer', 'Where your data goes' ],
	];
	const body = `<section class="docs-hero">
	<div class="wrap">
		<h1>How can we help?</h1>
		<p>Guides and answers for SheetPilot: opening sheets, how they are read, styles, export and sharing.</p>
		${ searchBox( 'hero-search', 'Search, e.g. “share link”, “formulas”, “dates”' ) }
	</div>
</section>
<div class="wrap docs-groups">
	<h2>Popular</h2>
	<div class="grid-3">
		${ popular.map( ( [ p, a, label ] ) => `<a class="card" href="${ p }/${ a ? '#' + a : '' }"><h3>${ esc( label ) }</h3><p>${ esc( docs[ p ].title ) }</p><span class="more">Read the guide →</span></a>` ).join( '\n\t\t' ) }
	</div>
	${ GROUPS.map( ( g ) => `<h2>${ g.label }</h2>
	<div class="grid-3">
		${ g.pages.map( ( p ) => `<a class="card" href="${ p }/"><span class="ic">${ ICON[ p ] }</span><h3>${ esc( docs[ p ].title ) }</h3><p>${ esc( BLURB[ p ] ) }</p></a>` ).join( '\n\t\t' ) }
	</div>` ).join( '\n\t' ) }
</div>`;
	write( 'docs/index.html', layout( { title: 'Help center', description: 'Guides and answers for SheetPilot: opening sheets, how they are read, styles, export and sharing.', root: '../', current: 'docs', canonical: 'docs/', body, extraHead: SEARCH_SCRIPT( '../' ) } ) );
}

/* ------------------------------------------------------------------ Home */

// The scrolling strip of templates: every item twice, so the loop is seamless.
const STRIP = [
	[ 'dashboard', 'Executive', 'the default' ], [ 'theme-graphite', 'Graphite', 'neutral, formal' ], [ 'theme-slate', 'Slate', 'calm dark mode' ], [ 'theme-analyst', 'Analyst', 'compact, navy' ],
	[ 'theme-sheet', 'Sheet', 'green with grid lines' ], [ 'theme-boardroom', 'Boardroom', 'navy, serif headings' ], [ 'theme-minimal', 'Minimal', 'hairlines, light type' ],
	[ 'theme-editorial', 'Editorial', 'serif, double rules' ], [ 'theme-midnight', 'Midnight', 'dark, soft glow' ], [ 'theme-soft', 'Soft', 'frosted, pastel' ],
	[ 'theme-blueprint', 'Blueprint', 'dashed, graph paper' ], [ 'theme-notebook', 'Notebook', 'dotted, ruled paper' ], [ 'theme-playful', 'Playful', 'thick outlines' ], [ 'theme-terminal', 'Terminal', 'green on black' ],
];
const strip = () => [ ...STRIP, ...STRIP ].map( ( [ n, t, d ], i ) => `<figure${ i >= STRIP.length ? ' aria-hidden="true"' : '' }>${ img( n, i >= STRIP.length ? '' : `The ${ t } template`, '' ) }<figcaption>${ t } <small>· ${ d }</small></figcaption></figure>` ).join( '' );


{
	const body = readFileSync( join( SRC, 'home.html' ), 'utf8' )
		.replace( /\{\{shot:([a-z0-9-]+)\|([^}]+)\}\}/g, ( m, name, caption ) => `<figure class="shot reveal" data-zoom>${ img( name, caption, '' ) }<figcaption>${ caption }</figcaption></figure>` )
		.replace( /\{\{img:([a-z0-9-]+)\|([^}]+)\}\}/g, ( m, name, alt ) => img( name, alt, '' ) )
		.replace( /\{\{strip\}\}/g, () => strip() )
		.replace( /\{\{repo\}\}/g, SITE.repo )
		.replace( /\{\{version\}\}/g, VERSION );
	write( 'index.html', layout( { title: SITE.name, description: 'SheetPilot turns any Excel or CSV file into an interactive dashboard in your browser. It works out what is in your sheet, how it is calculated and what stands out. Free, with nothing uploaded.', root: '', current: '', body, home: true } ) );
}

/* ------------------------------------------------------------------ 404, sitemap, robots */

{
	const body = `<section class="page-head" style="border:0;text-align:center;padding:120px 0"><div class="wrap"><span class="kicker">404</span><h1>This sheet has no such row</h1><p style="margin:0 auto 28px">This page may have moved. Try the help center, or start from the home page.</p><div class="cta-row"><a class="btn btn-primary" href="${ SITE.base }">Home</a><a class="btn btn-ghost" href="${ SITE.base }docs/">Help center</a></div></div></section>`;
	write( '404.html', layout( { title: 'Page not found', description: 'Page not found.', root: SITE.base, body } ) );
	const urls = [ '', 'app/', 'docs/', ...ORDER.map( ( p ) => `docs/${ p }/` ) ];
	write( 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ urls.map( ( u ) => `<url><loc>${ SITE.url }${ u }</loc></url>` ).join( '\n' ) }\n</urlset>\n` );
	write( 'robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ SITE.url }sitemap.xml\n` );
}

console.log( `website/dist built: ${ ORDER.length } help pages, ${ searchIndex.length } search entries, version ${ VERSION }` );
