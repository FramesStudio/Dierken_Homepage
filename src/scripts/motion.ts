/**
 * Gemeinsame Bewegung & Navigation.
 * Motion-Vertrag auf <html>: js · motion | reduced · motion-ready (erst wenn dieses Skript läuft).
 * Ohne JS oder bei reduced motion ist alles sofort sichtbar.
 */

const root = document.documentElement;
const motion = root.classList.contains('motion');

/* ---------- Navigation: Burger-Menü ---------- */
function initMenu() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!header || !toggle || !menu) return;

  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    header.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) menu.querySelector<HTMLAnchorElement>('a')?.focus();
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  // Fokus im offenen Menü halten
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [toggle, ...menu.querySelectorAll<HTMLElement>('a')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

/* ---------- Header: Fläche nach Scroll, ausblenden beim Runterscrollen ---------- */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  let lastY = scrollY;
  let ticking = false;
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const overlay = header.classList.contains('site-header--overlay') && hero;
  const update = () => {
    const y = scrollY;
    const solidAt = overlay ? hero!.offsetHeight - header.offsetHeight - 4 : 24;
    header.classList.toggle('is-scrolled', y > solidAt);
    if (motion && !header.classList.contains('menu-open')) {
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > 420) header.classList.add('is-hidden');
      else if (goingUp || y < 420) header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  // Fokus im Header holt ihn immer zurück
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();
}

/* ---------- Reveals ---------- */
function initReveals() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!motion || !('IntersectionObserver' in window)) return;
  root.classList.add('motion-ready');
  // Masken-Reveals sind per clip-path unsichtbar → IO würde nie „sichtbar“ melden; daher den Elternknoten beobachten
  const owner = new Map<Element, HTMLElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          owner.get(entry.target)?.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0 },
  );
  els.forEach((el) => {
    // Bereits sichtbare Elemente (z. B. nach Reload mitten auf der Seite) sofort zeigen
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.9 && r.bottom > 0) {
      el.classList.add('is-in');
      return;
    }
    const target = el.dataset.reveal === 'mask' && el.parentElement ? el.parentElement : el;
    owner.set(target, el);
    io.observe(target);
  });
}

/* ---------- Bild-Enthüllung (Vorhang) ---------- */
function initTiles() {
  if (!motion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  document.querySelectorAll<HTMLElement>('[data-tiles]').forEach((el) => io.observe(el));
}

/* ---------- Parallax: ein rAF-Loop, nur sichtbare Elemente ---------- */
function initParallax() {
  if (!motion) return;
  const els = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (!els.length) return;
  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target as HTMLElement) : visible.delete(e.target as HTMLElement);
  });
  els.forEach((el) => io.observe(el));
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(loop);
  });
  const loop = () => {
    if (!running) return;
    const vh = innerHeight;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      const speed = Number(el.dataset.parallax || 0.12);
      // -1 (unten) … 1 (oben)
      const t = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      el.style.setProperty('--py', `${(-t * speed * r.height * 0.5).toFixed(1)}px`);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function run(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn(`[motion] ${name} deaktiviert`, err);
  }
}

run('menu', initMenu);
run('header', initHeader);
run('reveals', initReveals);
run('tiles', initTiles);
run('parallax', initParallax);
