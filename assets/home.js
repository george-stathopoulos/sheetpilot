/**
 * Fixpass home page: rotating headline, pointer spotlight, parallax, sideways "How it works",
 * reveal on scroll. Everything stays still for people who prefer reduced motion.
 */
( function () {
	'use strict';

	var still = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	// Reveal sections (and the chat) as they come into view.
	var io = new IntersectionObserver(
		function ( entries ) {
			entries.forEach( function ( e ) {
				if ( e.isIntersecting ) {
					e.target.classList.add( 'is-on' );
					io.unobserve( e.target );
				}
			} );
		},
		{ threshold: 0.18 }
	);
	document.querySelectorAll( '.reveal' ).forEach( function ( el, i ) {
		el.style.transitionDelay = ( i % 3 ) * 80 + 'ms';
		io.observe( el );
	} );

	// The chat appears one message at a time.
	var chat = document.querySelector( '[data-chat]' );
	if ( chat ) {
		var parts = chat.querySelectorAll( '.fx-msg, .fx-fix' );
		parts.forEach( function ( p, i ) {
			p.style.transitionDelay = i * ( still ? 0 : 380 ) + 'ms';
		} );
		// Only once most of it is in view, so the conversation plays while you're watching.
		var chatIo = new IntersectionObserver(
			function ( entries ) {
				if ( entries[ 0 ].isIntersecting ) {
					chat.classList.add( 'is-on' );
					chatIo.disconnect();
				}
			},
			{ threshold: 0.6 }
		);
		chatIo.observe( chat );
	}

	if ( still ) {
		return;
	}

	// Headline: the word that gets crossed out keeps changing.
	var rotator = document.querySelector( '[data-rotator]' );
	if ( rotator ) {
		var words = rotator.querySelectorAll( '.fx-rotator__word' );
		var n = 0;
		// The space resizes to the word showing, so "it." always follows closely.
		var fit = function () {
			rotator.style.width = words[ n ].offsetWidth + 'px';
		};
		fit();
		window.addEventListener( 'resize', fit );
		window.setInterval( function () {
			var cur = words[ n ];
			n = ( n + 1 ) % words.length;
			cur.classList.remove( 'is-in' );
			cur.classList.add( 'is-out' );
			words[ n ].classList.remove( 'is-out' );
			words[ n ].classList.add( 'is-in' );
			fit();
			window.setTimeout( function () {
				cur.classList.remove( 'is-out' );
			}, 600 );
		}, 2200 );
	}

	// A soft spotlight follows the pointer across the hero.
	var hero = document.querySelector( '[data-hero]' );
	var cone = document.querySelector( '[data-cone]' );
	if ( hero && cone ) {
		hero.addEventListener( 'pointermove', function ( e ) {
			var r = hero.getBoundingClientRect();
			cone.style.setProperty( '--x', ( e.clientX - r.left ) + 'px' );
			cone.style.setProperty( '--y', ( e.clientY - r.top ) + 'px' );
		} );
	}

	var speedEls = document.querySelectorAll( '[data-speed]' );
	var driftEls = document.querySelectorAll( '[data-drift]' );
	var hs = document.querySelector( '[data-hscroll]' );
	var track = document.querySelector( '[data-track]' );
	var bar = document.querySelector( '[data-progress]' );
	var wide = window.matchMedia( '(min-width: 761px)' );
	var ticking = false;

	function frame() {
		ticking = false;
		var y = window.scrollY;
		var vh = window.innerHeight;

		// Parallax: hero layers move at their own speed.
		speedEls.forEach( function ( el ) {
			el.style.transform = 'translate3d(0,' + ( y * parseFloat( el.dataset.speed ) ) + 'px,0)';
		} );

		// The band's two rows drift in opposite directions.
		driftEls.forEach( function ( el ) {
			var r = el.getBoundingClientRect();
			var off = ( r.top - vh / 2 ) * parseFloat( el.dataset.drift );
			el.style.transform = 'translate3d(' + off + 'px,0,0)';
		} );

		// "How it works": vertical scrolling moves the panels sideways.
		if ( hs && track ) {
			if ( ! wide.matches ) {
				track.style.transform = '';
				return;
			}
			var top = hs.getBoundingClientRect().top;
			var total = hs.offsetHeight - vh;
			var p = Math.min( 1, Math.max( 0, -top / total ) );
			var max = track.scrollWidth - window.innerWidth;
			track.style.transform = 'translate3d(' + -p * Math.max( 0, max ) + 'px,0,0)';
			if ( bar ) {
				bar.style.setProperty( '--p', p );
			}
		}
	}

	function onScroll() {
		if ( ! ticking ) {
			ticking = true;
			window.requestAnimationFrame( frame );
		}
	}
	window.addEventListener( 'scroll', onScroll, { passive: true } );
	window.addEventListener( 'resize', onScroll );
	frame();
} )();
