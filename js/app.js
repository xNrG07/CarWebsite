/* W&M Autoparadies – Dynamic version (Supabase via Vercel Serverless API)
   Notes:
   - No localStorage persistence.
   - Public data (cars) is loaded from /api/cars.
   - Admin-only create/update/delete via short-lived token (Ctrl+Shift+A).
   - Contact + valuation forms are stored in Supabase via /api/messages and /api/valuations.
   - All code comments are in English.
*/

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -----------------------------
  // Small helpers
  // -----------------------------

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  };

  const formatKm = (n) => {
    const num = toNumber(n);
    if (!num && num !== 0) return '—';
    return num.toLocaleString('de-AT') + ' km';
  };

  const formatPrice = (p) => {
    const num = toNumber(p);
    if (!num && num !== 0) return '—';
    return num.toLocaleString('de-AT') + ' €';
  };

  const formatToday = () => {
    try { return new Date().toLocaleDateString('de-AT'); } catch { return new Date().toLocaleDateString(); }
  };

  const isReducedMotion = () =>
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const carSVG = () => `
    <svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 55 L30 30 Q50 18 100 16 Q150 14 170 30 L180 55 Z"/>
      <circle cx="45" cy="66" r="11"/><circle cx="155" cy="66" r="11"/>
      <path d="M8 55 L192 55"/>
    </svg>`;

  const carPlaceholder = () => `
    <div class="car-card-image-placeholder">
      ${carSVG()}
      <span style="font-family:'Barlow Condensed';font-size:0.6rem;letter-spacing:3px;text-transform:uppercase;color:rgba(201,147,42,0.4);">Kein Foto vorhanden</span>
    </div>`;

  function showToast(msg, dur = 3000) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => t.classList.remove('show'), dur);
  }

  // -----------------------------
  // API layer (Vercel serverless)
  // -----------------------------

  const API = {
    async getCars() {
      const res = await fetch('/api/cars', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('Cars load failed');
      const data = await res.json();
      return Array.isArray(data) ? data : (data.cars || []);
    },

    async createCar(payload, token) {
      const res = await fetch('/api/cars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Create failed');
      return res.json();
    },

    async updateCar(id, payload, token) {
      const res = await fetch(`/api/cars/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },

    async deleteCar(id, token) {
      const res = await fetch(`/api/cars/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },

    async submitValuation(payload) {
      const res = await fetch('/api/valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Valuation submit failed');
      return res.json();
    },

    async submitMessage(payload) {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Message submit failed');
      return res.json();
    },

    async adminLogin(password) {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) return null;
      return res.json();
    }
  };

  // -----------------------------
  // Global state
  // -----------------------------

  const state = {
    cars: [],
    adminToken: sessionStorage.getItem('wm_admin_token') || null,
    adminExp: Number(sessionStorage.getItem('wm_admin_exp') || '0') || 0,
    lastHeroVehicleCount: null
  };

  const isAdmin = () => {
    if (!state.adminToken) return false;
    if (!state.adminExp) return true;
    return Date.now() < state.adminExp;
  };

  const setAdminToken = (token, expMs) => {
    state.adminToken = token;
    state.adminExp = expMs || 0;
    sessionStorage.setItem('wm_admin_token', token);
    sessionStorage.setItem('wm_admin_exp', String(expMs || 0));
    applyAdminUI();
  };

  const clearAdminToken = () => {
    state.adminToken = null;
    state.adminExp = 0;
    sessionStorage.removeItem('wm_admin_token');
    sessionStorage.removeItem('wm_admin_exp');
    applyAdminUI();
  };

  // -----------------------------
  // UI: cursor, navbar, reveal
  // -----------------------------

  function initCursor() {
    const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;

    document.body.classList.add('use-custom-cursor');

    const cursor = $('#cursor');
    const ring = $('#cursorRing');
    if (!cursor || !ring) return;

    let cx = 0, cy = 0, rx = 0, ry = 0;

    const tick = () => {
      rx += (cx - rx) * 0.18;
      ry += (cy - ry) * 0.18;
      ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
      requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', (e) => {
      cx = e.clientX;
      cy = e.clientY;
      cursor.style.transform = `translate(${cx - 6}px, ${cy - 6}px)`;
    }, { passive: true });

    // Hover ring via event delegation (also covers dynamic elements)
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest('a,button,[data-hover]')) ring.classList.add('hovering');
    }, { passive: true });

    document.addEventListener('pointerout', (e) => {
      if (e.target.closest('a,button,[data-hover]')) ring.classList.remove('hovering');
    }, { passive: true });

    requestAnimationFrame(tick);
  }

  function initNavbar() {
    const navbar = $('#navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  function initScrollReveal() {
    const reveals = $$('.reveal');
    if (!reveals.length) return;

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(r => r.classList.add('visible'));
      return;
    }

    const ro = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          ro.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(r => ro.observe(r));
  }

  // -----------------------------
  // Hero counter (live from DB)
  // -----------------------------

  function animateNumber(el, from, to, durationMs) {
    const start = performance.now();
    const diff = to - from;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const val = Math.round(from + diff * easeOutCubic(t));
      el.textContent = String(val);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function updateHeroVehicleCounter({ animateInitial = true, animateChanges = true } = {}) {
    const countEl = document.querySelector('[data-stat="vehicle-count"]');
    const metaEl = document.querySelector('[data-stat="vehicle-count-meta"]');
    if (!countEl) return;

    const target = state.cars.length;
    if (metaEl) metaEl.textContent = `Stand: ${formatToday()}`;

    const reduced = isReducedMotion();

    if (state.lastHeroVehicleCount === null) {
      if (!reduced && animateInitial && target > 0) {
        countEl.textContent = '0';
        animateNumber(countEl, 0, target, 650);
      } else {
        countEl.textContent = String(target);
      }
      state.lastHeroVehicleCount = target;
      return;
    }

    if (!reduced && animateChanges && state.lastHeroVehicleCount !== target) {
      animateNumber(countEl, state.lastHeroVehicleCount, target, 450);
    } else {
      countEl.textContent = String(target);
    }

    state.lastHeroVehicleCount = target;
  }

  // -----------------------------
  // Admin login (Ctrl+Shift+A)
  // -----------------------------

  function applyAdminUI() {
    const addBtn = $('#addCarBtn');
    const delBtn = $('#deleteCarBtn');
    const editBtn = $('#editCarBtn');

    const admin = isAdmin();

    if (addBtn) addBtn.style.display = admin ? 'grid' : 'none';
    if (delBtn) delBtn.style.display = admin ? 'inline-flex' : 'none';
    if (editBtn) editBtn.style.display = admin ? 'inline-flex' : 'none';
  }

  function initAdminLogin() {
    const modal = $('#adminLoginModal');
    const form = $('#adminLoginForm');
    const closeBtn = $('#closeAdminModal');
    const pw = $('#adminPassword');
    const err = $('#adminLoginError');
    const logoutBtn = $('#adminLogoutBtn');

    const open = () => {
      if (!modal) return;
      if (err) { err.style.display = 'none'; err.textContent = ''; }
      if (pw) pw.value = '';
      modal.classList.add('open');
      setTimeout(() => pw?.focus(), 50);
    };

    const close = () => modal?.classList.remove('open');

    document.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isAdmin()) {
          // If already admin -> quick logout
          clearAdminToken();
          showToast('Admin abgemeldet');
        } else {
          open();
        }
      }
    });

    closeBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    logoutBtn?.addEventListener('click', () => {
      clearAdminToken();
      showToast('Admin abgemeldet');
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pw) return;

      try {
        const resp = await API.adminLogin(pw.value);
        if (!resp || !resp.token) {
          if (err) {
            err.textContent = 'Falsches Passwort.';
            err.style.display = 'block';
          }
          return;
        }
        setAdminToken(resp.token, resp.expiresAt || 0);
        close();
        showToast('✓ Admin aktiv');
      } catch {
        if (err) {
          err.textContent = 'Login fehlgeschlagen.';
          err.style.display = 'block';
        }
      }
    });

    applyAdminUI();
  }

  // -----------------------------
  // Cars module (DB-backed)
  // -----------------------------

  function carsModule() {
    const carsGrid = $('#carsGrid');
    const carsEmpty = $('#carsEmpty');
    if (!carsGrid || !carsEmpty) return;

    let activeFilter = 'all';
    let editingId = null;
    let currentCarId = null;

    const addCarModal = $('#addCarModal');
    const addCarForm = $('#addCarForm');
    const carDetailModal = $('#carDetailModal');

    const openAddModal = () => addCarModal && addCarModal.classList.add('open');
    const closeAddModal = () => addCarModal && addCarModal.classList.remove('open');
    const openDetailModal = () => carDetailModal && carDetailModal.classList.add('open');
    const closeDetailModal = () => carDetailModal && carDetailModal.classList.remove('open');

    const normalizeStatus = (v) => (String(v || '').toLowerCase() === 'reserviert') ? 'reserviert' : 'verkauf';

    function renderCars() {
      updateHeroVehicleCounter({ animateInitial: true, animateChanges: true });

      const filtered = activeFilter === 'all'
        ? state.cars
        : state.cars.filter(c => normalizeStatus(c.status || c.typ) === activeFilter);

      carsGrid.innerHTML = '';

      if (!filtered.length) {
        carsEmpty.classList.add('visible');
        return;
      }

      carsEmpty.classList.remove('visible');

      filtered.forEach((car, i) => {
        const status = normalizeStatus(car.status || car.typ);
        const badgeClass = status === 'reserviert' ? 'badge-reserviert' : 'badge-verkauf';
        const badgeText = status === 'reserviert' ? 'Reserviert' : 'Zum Verkauf';

        const card = document.createElement('div');
        card.className = 'car-card';
        card.style.animationDelay = `${i * 0.08}s`;

        const safeMarke = escapeHTML(car.make || car.marke || '—');
        const safeModell = escapeHTML(car.model || car.modell || '—');
        const safeKraftstoff = escapeHTML(car.fuel || car.kraftstoff || '—');
        const safeGetriebe = escapeHTML(car.gearbox || car.getriebe || '—');

        const imageUrl = car.image_url || car.bild || '';
        const price = car.price ?? car.preis;
        const year = car.year ?? car.jahr;
        const km = car.km;

        card.innerHTML = `
          <div class="car-card-image">
            <span class="car-badge ${badgeClass}">${badgeText}</span>
            ${imageUrl ? `<img class="car-img" src="${escapeHTML(imageUrl)}" alt="${safeMarke} ${safeModell}" loading="lazy">` : carPlaceholder()}
          </div>
          <div class="car-card-body">
            <div class="car-card-make">${safeMarke}</div>
            <div class="car-card-model">${safeModell}</div>
            <div class="car-card-specs">
              <div class="car-spec">
                <div class="car-spec-val">${escapeHTML(year || '—')}</div>
                <div class="car-spec-key">Baujahr</div>
              </div>
              <div class="car-spec">
                <div class="car-spec-val">${formatKm(km)}</div>
                <div class="car-spec-key">Kilometerstand</div>
              </div>
              <div class="car-spec">
                <div class="car-spec-val">${safeKraftstoff}</div>
                <div class="car-spec-key">Kraftstoff</div>
              </div>
              <div class="car-spec">
                <div class="car-spec-val">${safeGetriebe}</div>
                <div class="car-spec-key">Getriebe</div>
              </div>
            </div>
            <div class="car-card-footer">
              <div>
                <div class="car-price">${formatPrice(price)}</div>
                <div class="car-price-label">Preis</div>
              </div>
              <button class="car-detail-btn" data-id="${escapeHTML(String(car.id))}">Details →</button>
            </div>
          </div>`;

        // Handle broken images -> replace with placeholder (no inline onerror)
        const img = card.querySelector('img.car-img');
        if (img) {
          img.addEventListener('error', () => {
            const wrapper = img.parentElement;
            if (!wrapper) return;
            img.remove();
            wrapper.insertAdjacentHTML('beforeend', carPlaceholder());
          }, { once: true });
        }

        carsGrid.appendChild(card);
      });

      $$('.car-detail-btn', carsGrid).forEach(btn => {
        btn.addEventListener('click', () => openCarDetail(btn.dataset.id));
      });
    }

    function openCarDetail(id) {
      const car = state.cars.find(c => String(c.id) === String(id));
      if (!car) return;

      currentCarId = String(id);

      const status = normalizeStatus(car.status || car.typ);
      const badgeText = status === 'reserviert' ? 'Reserviert' : 'Zum Verkauf';

      const make = car.make || car.marke || '';
      const model = car.model || car.modell || '';
      $('#detailTitle').textContent = `${make} ${model}`.trim() || 'Fahrzeugdetails';

      const desc = car.description || car.beschreibung || '';
      const safeDesc = escapeHTML(desc).replaceAll('\n', '<br>');

      const imageUrl = car.image_url || car.bild || '';
      const willhabenUrl = car.willhaben_url || car.willhaben || '';

      const imgHtml = imageUrl
        ? `<img src="${escapeHTML(imageUrl)}" alt="" style="width:100%;border-radius:0;max-height:220px;object-fit:cover;border:1px solid var(--border);" loading="lazy">`
        : '';

      const actionHtml = willhabenUrl
        ? `<a class="btn-primary" href="${escapeHTML(willhabenUrl)}" target="_blank" rel="noopener" style="display:inline-flex;justify-content:center;align-items:center;gap:10px;margin-top:14px;width:100%;">Auf Willhaben ansehen →</a>`
        : '';

      $('#detailBody').innerHTML = `
        <div style="margin-bottom:20px;">${imgHtml}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="car-spec"><div class="car-spec-val">${escapeHTML(make || '—')}</div><div class="car-spec-key">Marke</div></div>
          <div class="car-spec"><div class="car-spec-val">${escapeHTML(model || '—')}</div><div class="car-spec-key">Modell</div></div>
          <div class="car-spec"><div class="car-spec-val">${escapeHTML(car.year ?? car.jahr ?? '—')}</div><div class="car-spec-key">Baujahr</div></div>
          <div class="car-spec"><div class="car-spec-val">${formatKm(car.km)}</div><div class="car-spec-key">Kilometerstand</div></div>
          <div class="car-spec"><div class="car-spec-val">${escapeHTML(car.fuel || car.kraftstoff || '—')}</div><div class="car-spec-key">Kraftstoff</div></div>
          <div class="car-spec"><div class="car-spec-val">${escapeHTML(car.gearbox || car.getriebe || '—')}</div><div class="car-spec-key">Getriebe</div></div>
          <div class="car-spec"><div class="car-spec-val" style="color:var(--gold)">${formatPrice(car.price ?? car.preis)}</div><div class="car-spec-key">Preis</div></div>
          <div class="car-spec"><div class="car-spec-val">${badgeText}</div><div class="car-spec-key">Status</div></div>
        </div>
        ${desc ? `<div style="padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);font-size:0.9rem;color:rgba(245,242,238,0.65);line-height:1.7;">${safeDesc}</div>` : ''}
        ${actionHtml}
      `;

      openDetailModal();
    }

    async function refreshCars() {
      try {
        const cars = await API.getCars();
        // Only show sell inventory (available/reserved). We enforce this server-side too.
        state.cars = cars.map(c => ({ ...c, status: normalizeStatus(c.status || c.typ) }));
        renderCars();
      } catch {
        state.cars = [];
        renderCars();
        showToast('⚠ Fahrzeuge konnten nicht geladen werden');
      }
    }

    // Filters
    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter || 'all';
        renderCars();
      });
    });

    // Add Car Button (admin only)
    const addCarBtn = $('#addCarBtn');
    if (addCarBtn && addCarForm) {
      addCarBtn.addEventListener('click', () => {
        if (!isAdmin()) {
          showToast('Admin Login nötig (Ctrl+Shift+A)');
          return;
        }
        editingId = null;
        addCarForm.reset();
        $('#acEditId').value = '';
        $('#modalTitle').textContent = 'Fahrzeug hinzufügen';
        $('#acSubmitBtn').textContent = 'Fahrzeug speichern →';
        openAddModal();
      });
    }

    // Close Add Modal
    $('#closeModal')?.addEventListener('click', closeAddModal);
    addCarModal?.addEventListener('click', (e) => {
      if (e.target === addCarModal) closeAddModal();
    });

    // Add/Edit form
    addCarForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!isAdmin()) {
        showToast('Admin Login nötig');
        return;
      }

      const token = state.adminToken;
      if (!token) {
        showToast('Admin Token fehlt');
        return;
      }

      const payload = {
        make: $('#acMarke').value.trim(),
        model: $('#acModell').value.trim(),
        year: toNumber($('#acJahr').value) ?? null,
        km: toNumber($('#acKm').value) ?? null,
        fuel: $('#acKraftstoff').value,
        gearbox: $('#acGetriebe').value,
        price: toNumber($('#acPreis').value) ?? null,
        status: normalizeStatus($('#acTyp').value),
        image_url: $('#acBild').value.trim() || null,
        description: $('#acBeschreibung').value.trim() || null,
        willhaben_url: ($('#acWillhaben')?.value || '').trim() || null
      };

      try {
        if (editingId) {
          await API.updateCar(editingId, payload, token);
          showToast('✓ Fahrzeug aktualisiert');
        } else {
          await API.createCar(payload, token);
          showToast('✓ Fahrzeug hinzugefügt');
        }

        closeAddModal();
        addCarForm.reset();
        editingId = null;
        await refreshCars();
      } catch {
        showToast('⚠ Speichern fehlgeschlagen');
      }
    });

    // Detail modal close
    $('#closeDetailModal')?.addEventListener('click', closeDetailModal);
    carDetailModal?.addEventListener('click', (e) => {
      if (e.target === carDetailModal) closeDetailModal();
    });

    // Delete (admin only)
    $('#deleteCarBtn')?.addEventListener('click', async () => {
      if (!isAdmin() || !state.adminToken) return;
      if (!currentCarId) return;

      try {
        await API.deleteCar(currentCarId, state.adminToken);
        closeDetailModal();
        showToast('✓ Fahrzeug gelöscht');
        await refreshCars();
      } catch {
        showToast('⚠ Löschen fehlgeschlagen');
      }
    });

    // Edit (admin only)
    $('#editCarBtn')?.addEventListener('click', () => {
      if (!isAdmin()) return;
      const car = state.cars.find(c => String(c.id) === String(currentCarId));
      if (!car) return;

      closeDetailModal();

      editingId = String(car.id);
      $('#acMarke').value = car.make || '';
      $('#acModell').value = car.model || '';
      $('#acJahr').value = car.year ?? '';
      $('#acKm').value = car.km ?? '';
      $('#acKraftstoff').value = car.fuel || 'Benzin';
      $('#acGetriebe').value = car.gearbox || 'Manuell';
      $('#acPreis').value = car.price ?? '';
      $('#acTyp').value = normalizeStatus(car.status);
      $('#acBild').value = car.image_url || '';
      $('#acWillhaben').value = car.willhaben_url || '';
      $('#acBeschreibung').value = car.description || '';
      $('#acEditId').value = String(car.id);
      $('#modalTitle').textContent = 'Fahrzeug bearbeiten';
      $('#acSubmitBtn').textContent = 'Änderungen speichern →';
      openAddModal();
    });

    // Initial
    refreshCars();
    applyAdminUI();
  }

  // -----------------------------
  // Valuation form (DB-backed)
  // -----------------------------

  function initBewertungForm() {
    const form = $('#bewertungForm');
    const success = $('#bwSuccess');
    if (!form || !success) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        marke: $('#bwMarke').value,
        modell: $('#bwModell').value,
        jahr: toNumber($('#bwJahr').value) ?? null,
        km: toNumber($('#bwKm').value) ?? null,
        kraftstoff: $('#bwKraftstoff').value,
        zustand: $('#bwZustand').value,
        kontakt: $('#bwKontakt').value,
        anmerkung: $('#bwAnmerkung').value,
        submitted_at: new Date().toISOString()
      };

      try {
        await API.submitValuation(payload);
        form.style.display = 'none';
        success.classList.add('visible');
        showToast('✓ Bewertungsanfrage eingegangen!');
      } catch {
        showToast('⚠ Senden fehlgeschlagen');
      }
    });
  }

  // -----------------------------
  // Contact form (DB-backed)
  // -----------------------------

  function initContactForm() {
    const form = $('#contactForm');
    const success = $('#cfSuccess');
    if (!form || !success) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        vorname: $('#cfVorname').value,
        nachname: $('#cfNachname').value,
        email: $('#cfEmail').value,
        telefon: $('#cfTelefon').value,
        nachricht: $('#cfNachricht').value,
        submitted_at: new Date().toISOString()
      };

      try {
        await API.submitMessage(payload);
        form.style.display = 'none';
        success.classList.add('visible');
        showToast('✓ Nachricht gesendet!');
      } catch {
        showToast('⚠ Senden fehlgeschlagen');
      }
    });
  }

  // -----------------------------
  // Boot
  // -----------------------------

  function initPointerSafety() {
    // Ensure decorative layers never block clicks
    document.querySelectorAll('.hero-bg, .hero-grid, .hero-lines').forEach(el => {
      el.style.pointerEvents = 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPointerSafety();
    initCursor();
    initNavbar();
    initScrollReveal();
    initAdminLogin();
    carsModule();
    initBewertungForm();
    initContactForm();
  });

})();
