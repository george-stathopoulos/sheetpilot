/**
 * SheetPilot home page: the sheet-to-dashboard animation, the "How it works" sheet tabs and
 * reveal on scroll. Everything is still for people who prefer reduced motion.
 */
( function () {
	'use strict';
	var still = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	// Reveal sections as they come into view.
	var io = new IntersectionObserver( function ( entries ) {
		entries.forEach( function ( e ) {
			if ( e.isIntersecting ) { e.target.classList.add( 'is-on' ); io.unobserve( e.target ); }
		} );
	}, { threshold: 0.15 } );
	document.querySelectorAll( '.reveal' ).forEach( function ( el, i ) { el.style.transitionDelay = ( i % 3 ) * 70 + 'ms'; io.observe( el ); } );

	// ---- The hero animation: a plain sheet is selected, read, and turned into a dashboard.
	var demo = document.querySelector( '[data-demo]' );
	if ( demo ) {
		var formula = demo.querySelector( '[data-formula]' );
		var counters = demo.querySelectorAll( '[data-count]' );
		var text = '=SHEETPILOT(A1:G10)';
		var timers = [];
		var later = function ( fn, ms ) { timers.push( window.setTimeout( fn, ms ) ); };
		var setPhase = function ( p ) { demo.setAttribute( 'data-phase', p ); };
		var typeFormula = function () {
			formula.textContent = '';
			for ( var i = 1; i <= text.length; i++ ) { ( function ( n ) { later( function () { formula.textContent = text.slice( 0, n ); }, n * 55 ); } )( i ); }
		};
		var countUp = function () {
			counters.forEach( function ( el ) {
				var to = parseFloat( el.dataset.count ), pre = el.dataset.prefix || '', t0 = performance.now(), dur = 1100;
				var step = function ( t ) {
					var k = Math.min( 1, ( t - t0 ) / dur ), v = Math.round( to * ( 1 - Math.pow( 1 - k, 3 ) ) );
					el.textContent = pre + v.toLocaleString( 'en-US' );
					if ( k < 1 ) window.requestAnimationFrame( step );
				};
				window.requestAnimationFrame( step );
			} );
		};
		var cycle = function () {
			timers.forEach( window.clearTimeout ); timers = [];
			setPhase( 'sheet' ); formula.textContent = '';
			counters.forEach( function ( el ) { el.textContent = ( el.dataset.prefix || '' ) + '0'; } );
			later( function () { setPhase( 'select' ); typeFormula(); }, 1800 );
			later( function () { setPhase( 'read' ); }, 3900 );
			later( function () { setPhase( 'build' ); }, 6200 );
			later( function () { setPhase( 'dash' ); countUp(); }, 6800 );
			later( cycle, 14200 );
		};
		if ( still ) {
			setPhase( 'dash' );
			counters.forEach( function ( el ) { el.textContent = ( el.dataset.prefix || '' ) + parseFloat( el.dataset.count ).toLocaleString( 'en-US' ); } );
			formula.textContent = text;
		} else {
			// Only run while it is on screen.
			var running = false;
			new IntersectionObserver( function ( entries ) {
				if ( entries[ 0 ].isIntersecting && ! running ) { running = true; cycle(); }
				else if ( ! entries[ 0 ].isIntersecting && running ) { running = false; timers.forEach( window.clearTimeout ); timers = []; }
			}, { threshold: 0.25 } ).observe( demo );
		}
	}

	// ---- "How it works": sheet tabs, advancing by themselves until the visitor takes over.
	var box = document.querySelector( '[data-tabs]' );
	if ( box ) {
		var tabs = box.querySelectorAll( '.sp-tab' ), panes = box.querySelectorAll( '.sp-pane' ), cur = 0, auto = null, taken = false;
		var show = function ( n ) {
			cur = n;
			tabs.forEach( function ( t, i ) { t.setAttribute( 'aria-selected', i === n ? 'true' : 'false' ); } );
			panes.forEach( function ( p, i ) { p.classList.toggle( 'is-on', i === n ); } );
		};
		tabs.forEach( function ( t, i ) { t.addEventListener( 'click', function () { taken = true; window.clearInterval( auto ); show( i ); } ); } );
		if ( ! still ) {
			new IntersectionObserver( function ( entries ) {
				window.clearInterval( auto );
				if ( entries[ 0 ].isIntersecting && ! taken ) { auto = window.setInterval( function () { show( ( cur + 1 ) % tabs.length ); }, 6500 ); }
			}, { threshold: 0.5 } ).observe( box );
		}
	}
} )();
