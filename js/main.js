document.addEventListener('DOMContentLoaded', () => {
	const el = document.getElementById('home-heading');
	if (!el) return;
	const spanNodes = Array.from(el.querySelectorAll('span'));
	const segments = [];

	if (spanNodes.length > 0) {
		spanNodes.forEach(s => segments.push({ node: s, full: s.textContent }));
	} else {
		segments.push({ node: el, full: el.textContent });
	}
	segments.forEach(seg => { seg.node.textContent = ''; });
	const typingSpeed = 120;
	const initialDelay = 300;

	const fullText = segments.map(s => s.full).join('');
	let globalIndex = 0;

	let prevSegNode = null;
	function typeNext() {
		if (globalIndex < fullText.length) {
			let running = 0;
			for (const seg of segments) {
				if (globalIndex < running + seg.full.length) {
					const charIndex = globalIndex - running;
					if (prevSegNode && prevSegNode !== seg.node) {
						prevSegNode.classList.remove('typing-caret');
					}
					if (!seg.node.classList.contains('typing-caret')) {
						seg.node.classList.add('typing-caret');
					}
					prevSegNode = seg.node;

					seg.node.textContent += seg.full.charAt(charIndex);
					break;
				}
				running += seg.full.length;
			}
			globalIndex += 1;
			setTimeout(typeNext, typingSpeed);
		} else {
			if (prevSegNode) prevSegNode.classList.remove('typing-caret');
		}
	}

	setTimeout(typeNext, initialDelay);
});

// Carousel removed: using a responsive grid layout instead of 3D carousel.

// LIGHTBOX
const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightboxContent");
const closeBtn = document.getElementById("closeBtn");

function openLightbox(sectionNode) {
	if (!lightbox || !lightboxContent) return;
	lightboxContent.innerHTML = '';
	lightboxContent.appendChild(sectionNode.cloneNode(true));
	lightbox.classList.add("active");
}

function closeLightbox() {
	if (!lightbox) return;
	lightbox.classList.remove("active");
	setTimeout(() => {
		if (lightboxContent) lightboxContent.innerHTML = '';
	}, 300);
}

if (lightbox) {
	lightbox.addEventListener("click", (e) => {
		if (e.target === lightbox || e.target === closeBtn) {
			closeLightbox();
		}
	});
}

// Mobile nav toggle behavior
function setupMobileNav() {
	const hambs = document.querySelectorAll('.hamburger');
	hambs.forEach(h => {
		h.addEventListener('click', () => {
			const nav = h.closest('.navbar');
			h.classList.toggle('open');
			nav.classList.toggle('nav-open');
		});
	});

	// Dropdown toggle on mobile
	const dropBtns = document.querySelectorAll('.nav-dropdown .dropbtn');
	dropBtns.forEach(btn => {
		btn.addEventListener('click', (e) => {
			if (window.matchMedia('(max-width: 768px)').matches) {
				e.preventDefault();
				btn.parentElement.classList.toggle('open');
			}
		});
	});

	// Close nav when clicking outside on mobile
	document.addEventListener('click', (e) => {
		if (window.matchMedia('(max-width: 768px)').matches) {
			const nav = document.querySelector('.navbar.nav-open');
			if (!nav) return;
			if (!nav.contains(e.target)) {
				nav.classList.remove('nav-open');
				const openHamb = nav.querySelector('.hamburger.open');
				if (openHamb) openHamb.classList.remove('open');
			}
		}
	});
}

if (document.readyState !== 'loading') setupMobileNav(); else document.addEventListener('DOMContentLoaded', setupMobileNav);
