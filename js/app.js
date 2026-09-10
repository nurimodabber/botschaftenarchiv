// Safe LocalStorage helpers
function safeGetStorage(key, defaultVal) {
    try {
        const val = localStorage.getItem(key);
        return val !== null ? val : defaultVal;
    } catch (e) {
        return defaultVal;
    }
}
function safeSetStorage(key, val) {
    try {
        localStorage.setItem(key, val);
    } catch (e) {}
}
window.safeGetStorage = safeGetStorage;
window.safeSetStorage = safeSetStorage;

// Analytics Helper (Vercel Web Analytics)
window.trackEvent = function(name, data = {}) {
    if (typeof window.va === 'function') {
        try {
            window.va('event', { name, ...data });
        } catch (e) {}
    }
};

// Global Application State
window.state = {
    documents: [],
    bookmarks: (() => {
        try { return JSON.parse(safeGetStorage('bookmarks', '[]')); }
        catch (e) { return []; }
    })(),
    theme: safeGetStorage('theme', 'light'),
    currentView: 'library',
    library: {
        segment: 'all',
        author: 'all',
        compTopic: 'all',
        ruhiGroup: 'all',
        advancedFiltersOpen: false,
        recipient: 'all',
        epoch: '',
        type: '',
        lang: '',
        format: 'all',
        sort: 'date-desc',
        query: '',
        results: [],
        renderedCount: 0
    },
    savedTab: 'bookmarks',
    collectionsSubView: 'compilations'
};
const state = window.state;
const APP_PAGE_SIZE = 30;

// Initialize Application
async function initApp() {
    setupAppearance();
    setupNavigation();
    setupKeyboardShortcuts();
    
    // 1. Load Document Index
    try {
        let response = await fetch('data/index.json').catch(() => null);
        if (!response || !response.ok) {
            response = await fetch('/data/index.json').catch(() => null);
        }
        if (!response || !response.ok) {
            throw new Error(`HTTP ${response ? response.status : 'Network Error'}`);
        }
        state.documents = await response.json();
        try {
            let aliasResp = await fetch('data/id_aliases.json').catch(() => null);
            if (!aliasResp || !aliasResp.ok) {
                aliasResp = await fetch('/data/id_aliases.json').catch(() => null);
            }
            if (aliasResp && aliasResp.ok) {
                state.idAliases = await aliasResp.json();
            }
        } catch (e) {}

        // Volltext-Suchindex im Hintergrund laden fuer blitzschnelle Auszug- und Volltextsuche
        setTimeout(() => {
            if (typeof window.loadFullTextSearchIndex === 'function') {
                window.loadFullTextSearchIndex();
            }
        }, 120);
    } catch (error) {
        console.error('Error loading documents:', error);
        const resultsEl = document.getElementById('library-results');
        if (resultsEl) {
            resultsEl.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 3rem;">Fehler beim Laden der Daten. Bitte stellen Sie sicher, dass data/index.json existiert.</p>';
        }
        return;
    }
    
    // 2. Safely initialize modules
    try {
        if (window.initSearch) window.initSearch(state.documents);
    } catch (e) { console.warn('Search init:', e); }

    try {
        if (window.initViewer) window.initViewer();
    } catch (e) { console.warn('Viewer init:', e); }

    try {
        initLibraryView();
    } catch (e) { console.error('Library init:', e); }

    try {
        if (window.BooksModule) window.BooksModule.init();
    } catch (e) { console.warn('Books init:', e); }

    try {
        initCollectionsView();
    } catch (e) { console.warn('Collections init:', e); }

    try {
        updateYearFilter();
    } catch (e) { console.warn('Year filter:', e); }

    // 3. Default to Library view
    try {
        window.switchView('library');
    } catch (e) { console.warn('SwitchView:', e); }

    // 4. Deep linking support (#doc=ID&p=N or ?doc=ID&p=N or #view)
    try {
        handleDeepLink();
        window.addEventListener('hashchange', handleDeepLink);
    } catch (e) { console.warn('DeepLink:', e); }
}

// ─── Unified Appearance & Visual Customizations ────────────────────────────
function setupAppearance() {
    const html = document.documentElement;

    // 0. Default Viewer Format Setting (pdf / text / web / auto)
    const savedViewerFormat = safeGetStorage('cosmos_default_viewer_mode', 'pdf');

    function applyDefaultViewerFormat(fmt) {
        const validFormat = (fmt === 'text' || fmt === 'web' || fmt === 'auto' || fmt === 'pdf') ? fmt : 'pdf';
        safeSetStorage('cosmos_default_viewer_mode', validFormat);

        document.querySelectorAll('#appearance-format-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.formatVal === validFormat);
        });
    }

    // 0b. Master-Language Setting (Deutsch 'de' / English 'en')
    // Steuert die Sprache der gesamten Benutzeroberflaeche sowie die Standard-Lesesprache
    let storedLang = safeGetStorage('cosmos_master_lang', safeGetStorage('cosmos_preferred_lang_v2', safeGetStorage('cosmos_preferred_lang', 'de')));
    if (storedLang === 'english') storedLang = 'en';
    if (storedLang === 'deutsch' || storedLang === 'all' || !storedLang) storedLang = 'de';
    const savedLanguage = (storedLang === 'en') ? 'en' : 'de';

    function applyLanguage(langVal) {
        const validLang = (langVal === 'en' || langVal === 'english') ? 'en' : 'de';
        safeSetStorage('cosmos_master_lang', validLang);
        safeSetStorage('cosmos_preferred_lang', validLang === 'en' ? 'english' : 'deutsch');
        safeSetStorage('cosmos_preferred_lang_v2', validLang);

        if (window.I18n && window.I18n.setLanguage) {
            window.I18n.setLanguage(validLang);
        }

        document.querySelectorAll('#appearance-language-group .appearance-opt-btn').forEach(btn => {
            const val = btn.dataset.langVal;
            const isActive = (val === validLang) || (val === 'english' && validLang === 'en') || (val === 'deutsch' && validLang === 'de');
            btn.classList.toggle('active', isActive);
        });

        // Synchronize with library state and filter select
        state.library.lang = (validLang === 'en' ? 'english' : 'deutsch');
        const langSelect = document.getElementById('library-lang-select');
        if (langSelect) {
            langSelect.value = state.library.lang;
        }

        // Synchronize with timeline if available
        if (window.TimelineModule && window.TimelineModule.setLanguage) {
            window.TimelineModule.setLanguage(validLang);
        }

        // Synchronize with books if available
        if (window.BooksModule && window.BooksModule.setLang) {
            window.BooksModule.setLang(validLang === 'en' ? 'english' : 'deutsch');
        }

        if (typeof updateDrawerFilterOptions === 'function') {
            updateDrawerFilterOptions(state.library ? (state.library.segment || 'house') : 'house');
        }

        if (typeof applyLibraryFilters === 'function' && window.state && window.state.documents && window.state.documents.length > 0) {
            applyLibraryFilters();
        }
    }

    // 1. Theme Setting (light / sepia / dark / oled)
    const savedTheme = safeGetStorage('cosmos_theme', safeGetStorage('theme', 'light'));
    
    function applyTheme(theme) {
        const validTheme = (theme === 'dark' || theme === 'sepia' || theme === 'oled') ? theme : 'light';
        html.setAttribute('data-theme', validTheme);
        safeSetStorage('cosmos_theme', validTheme);
        safeSetStorage('theme', validTheme);
        state.theme = validTheme;

        // Update Theme Tab Buttons
        document.querySelectorAll('#appearance-theme-tabs .theme-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeVal === validTheme);
        });

        // Update Dock Pill Icon
        const dockThemeIcon = document.getElementById('dock-theme-icon');
        if (dockThemeIcon) {
            if (validTheme === 'light') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`;
            } else if (validTheme === 'sepia') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>`;
            } else if (validTheme === 'dark') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
            } else if (validTheme === 'oled') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>`;
            }
        }
    }

    // 2. Accent Color Setting
    const defaultColor = '#C5A059';
    const savedColor = safeGetStorage('cosmos_accent_color', defaultColor);

    function applyAccentColor(hex) {
        if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return;
        
        let fullHex = hex;
        if (hex.length === 4) {
            fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        const r = parseInt(fullHex.slice(1, 3), 16) || 197;
        const g = parseInt(fullHex.slice(3, 5), 16) || 160;
        const b = parseInt(fullHex.slice(5, 7), 16) || 89;

        const rH = Math.max(0, Math.min(255, Math.round(r * 1.12)));
        const gH = Math.max(0, Math.min(255, Math.round(g * 1.12)));
        const bH = Math.max(0, Math.min(255, Math.round(b * 1.12)));
        const hexHover = `rgb(${rH}, ${gH}, ${bH})`;

        html.style.setProperty('--accent-gold', fullHex);
        html.style.setProperty('--accent-gold-hover', hexHover);
        html.style.setProperty('--accent-gold-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
        html.style.setProperty('--accent-gold-glow', `rgba(${r}, ${g}, ${b}, 0.28)`);
        html.style.setProperty('--border-focus', `rgba(${r}, ${g}, ${b}, 0.55)`);

        safeSetStorage('cosmos_accent_color', fullHex);

        const hexInput = document.getElementById('accent-hex-input');
        if (hexInput && document.activeElement !== hexInput && hexInput.value.toLowerCase() !== fullHex.toLowerCase()) {
            hexInput.value = fullHex.toUpperCase();
        }

        const previewBadge = document.getElementById('accent-current-preview-badge');
        if (previewBadge) {
            previewBadge.style.backgroundColor = fullHex;
            previewBadge.style.boxShadow = `0 0 5px ${fullHex}`;
        }

        const wheelBox = document.getElementById('wheel-color-preview-box');
        if (wheelBox) {
            wheelBox.style.backgroundColor = fullHex;
        }

        const standardColors = ['#c5a059', '#2b4c7e', '#c86432'];
        const isStandard = standardColors.includes(fullHex.toLowerCase());

        document.querySelectorAll('.accent-swatch').forEach(sw => {
            if (sw.classList.contains('accent-swatch-custom')) {
                sw.classList.toggle('active', !isStandard);
                if (!isStandard) {
                    sw.style.background = fullHex;
                } else {
                    sw.style.background = 'conic-gradient(from 180deg at 50% 50%, #E53935, #FB8C00, #FDD835, #43A047, #1E88E5, #8E24AA, #E53935)';
                }
            } else {
                sw.classList.toggle('active', (sw.dataset.color || '').toLowerCase() === fullHex.toLowerCase());
            }
        });
    }

    // 3. Reader Font Setting (serif / sans / classic)
    const savedFont = safeGetStorage('cosmos_reader_font', 'serif');

    function applyReaderFont(font) {
        const validFont = (font === 'sans' || font === 'classic') ? font : 'serif';
        html.setAttribute('data-reader-font', validFont);
        safeSetStorage('cosmos_reader_font', validFont);

        document.querySelectorAll('#appearance-font-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.fontVal === validFont);
        });
    }

    // 4. Reader Line Height (compact / normal / relaxed)
    const savedLh = safeGetStorage('cosmos_reader_lh', 'normal');

    function applyLineHeight(lh) {
        const validLh = (lh === 'compact' || lh === 'relaxed') ? lh : 'normal';
        html.setAttribute('data-reader-lh', validLh);
        safeSetStorage('cosmos_reader_lh', validLh);

        document.querySelectorAll('#appearance-line-height-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lhVal === validLh);
        });
    }

    // 5. Reader Text Alignment (justify / left)
    const savedAlign = safeGetStorage('cosmos_reader_align', 'justify');

    function applyTextAlign(align) {
        const validAlign = (align === 'left') ? 'left' : 'justify';
        html.setAttribute('data-reader-align', validAlign);
        safeSetStorage('cosmos_reader_align', validAlign);

        document.querySelectorAll('#appearance-align-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.alignVal === validAlign);
        });
    }

    // 6. Reader Width Setting (normal / wide / full)
    const savedWidth = safeGetStorage('cosmos_reader_width', 'normal');

    function applyReaderWidth(width) {
        const validWidth = (width === 'wide' || width === 'full') ? width : 'normal';
        html.setAttribute('data-reader-width', validWidth);
        safeSetStorage('cosmos_reader_width', validWidth);

        document.querySelectorAll('#appearance-width-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.widthVal === validWidth);
        });
    }

    // 7. Font Scale Setting (85% to 135%)
    const savedScale = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;

    function applyFontScale(scaleVal) {
        const clamped = Math.max(85, Math.min(135, scaleVal));
        html.style.setProperty('--reader-font-scale', (clamped / 100).toString());
        safeSetStorage('cosmos_reader_font_scale', clamped.toString());

        const display = document.getElementById('appearance-size-display');
        if (display) display.textContent = `${clamped}%`;

        const slider = document.getElementById('appearance-size-slider');
        if (slider && parseInt(slider.value, 10) !== clamped) slider.value = clamped;
    }

    // 8. Library View Mode (cards / list)
    const savedLibView = (() => {
        const raw = safeGetStorage('cosmos_library_view', safeGetStorage('cosmos_library_view_mode', 'cards'));
        return raw === 'list' ? 'list' : 'cards';
    })();

    function applyLibraryView(viewMode) {
        const validView = (viewMode === 'list') ? 'list' : 'cards';
        html.setAttribute('data-library-view', validView);
        safeSetStorage('cosmos_library_view', validView);
        if (window.state && window.state.library) {
            window.state.library.viewMode = (validView === 'list' ? 'list' : 'grid');
        }
        safeSetStorage('cosmos_library_view_mode', validView === 'list' ? 'list' : 'grid');

        const resultsGrid = document.getElementById('library-results');
        if (resultsGrid) {
            resultsGrid.classList.toggle('list-view', validView === 'list');
        }

        const cardsBtn = document.getElementById('view-mode-cards-btn');
        const listBtn = document.getElementById('view-mode-list-btn');
        if (cardsBtn) cardsBtn.classList.toggle('active', validView === 'cards');
        if (listBtn) listBtn.classList.toggle('active', validView === 'list');

        document.querySelectorAll('#appearance-library-view-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.libView === validView);
        });
    }
    window.applyLibraryView = applyLibraryView;

    // Initialize all settings
    applyDefaultViewerFormat(savedViewerFormat);
    applyLanguage(savedLanguage);
    applyTheme(savedTheme);
    applyAccentColor(savedColor);
    applyReaderFont(savedFont);
    applyLineHeight(savedLh);
    applyTextAlign(savedAlign);
    applyReaderWidth(savedWidth);
    applyFontScale(savedScale);
    applyLibraryView(savedLibView);

    // Wire up Popover Toggle & Events
    const toggleBtn = document.getElementById('appearance-btn');
    const popover = document.getElementById('appearance-popover');
    const resetBtn = document.getElementById('appearance-reset-btn');

    function syncSettingsContainer() {
        const isMobile = window.innerWidth <= 768;
        const panel = document.getElementById('settings-panel-content');
        const pop = document.getElementById('appearance-popover');
        const pageMount = document.getElementById('settings-page-mount');
        if (!panel || !pop || !pageMount) return;

        if (isMobile) {
            if (panel.parentElement !== pageMount) {
                pageMount.appendChild(panel);
            }
            pop.hidden = true;
        } else {
            if (panel.parentElement !== pop) {
                pop.appendChild(panel);
            }
            if (state.currentView === 'settings') {
                window.switchView('library');
            }
        }
    }

    syncSettingsContainer();
    window.addEventListener('resize', syncSettingsContainer);

    if (toggleBtn && popover) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                window.switchView('settings');
            } else {
                const isHidden = popover.hidden;
                popover.hidden = !isHidden;
                toggleBtn.classList.toggle('active', !popover.hidden);
            }
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768 && !popover.hidden && !popover.contains(e.target) && !toggleBtn.contains(e.target)) {
                popover.hidden = true;
                toggleBtn.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !popover.hidden) {
                popover.hidden = true;
                toggleBtn.classList.remove('active');
            }
        });
    }

    // Theme Button Clicks
    document.querySelectorAll('#appearance-theme-tabs .theme-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.themeVal);
        });
    });

    // Swatches (3 Standardempfehlungen)
    document.querySelectorAll('.accent-swatch:not(.accent-swatch-custom)').forEach(sw => {
        sw.addEventListener('click', () => {
            if (sw.dataset.color) applyAccentColor(sw.dataset.color);
        });
    });

    // Color conversion helpers for Pop-up Farbrad
    function hslToRgb(h, s, l) {
        s = Math.max(0, Math.min(1, s));
        l = Math.max(0, Math.min(1, l));
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else if (300 <= h && h <= 360) { r = c; g = 0; b = x; }
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    }

    function hslToHex(h, s, l) {
        const rgb = hslToRgb(h, s, l);
        const toHex = val => val.toString(16).padStart(2, '0');
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }

    function hexToHsl(hex) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        const r = ((num >> 16) & 255) / 255;
        const g = ((num >> 8) & 255) / 255;
        const b = (num & 255) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
                case g: h = ((b - r) / d + 2) * 60; break;
                case b: h = ((r - g) / d + 4) * 60; break;
            }
        }
        return { h: Math.round(h), s: Math.round(s * 100) / 100, l: Math.round(l * 100) / 100 };
    }

    // 4. Interaktives Pop-up Farbrad für Akzentfarbe
    function initColorWheel() {
        const canvas = document.getElementById('color-wheel-canvas');
        const popover = document.getElementById('accent-color-wheel-popover');
        const customSwatch = document.getElementById('accent-swatch-custom');
        const crosshair = document.getElementById('wheel-crosshair');
        const slider = document.getElementById('wheel-lightness-slider');
        const previewBox = document.getElementById('wheel-color-preview-box');
        const hexInput = document.getElementById('accent-hex-input');
        const applyBtn = document.getElementById('wheel-apply-btn');
        const closeBtn = document.getElementById('wheel-close-btn');

        if (!canvas || !popover || !customSwatch) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = cx - 4;

        // Farbrad einmalig auf das Canvas zeichnen
        const imgData = ctx.createImageData(width, height);
        const d = imgData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idx = (y * width + x) * 4;

                if (dist <= radius) {
                    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    if (angle < 0) angle += 360;
                    const sat = dist / radius;
                    const rgb = hslToRgb(angle, sat, 0.5);
                    d[idx] = rgb[0];
                    d[idx + 1] = rgb[1];
                    d[idx + 2] = rgb[2];
                    d[idx + 3] = (radius - dist < 1.2) ? Math.round((radius - dist) * 255) : 255;
                } else {
                    d[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        let currentHue = 42;
        let currentSat = 0.55;
        let currentLightness = 0.56;
        let isDragging = false;

        function updateCrosshair(h, s) {
            if (!crosshair) return;
            const angleRad = h * (Math.PI / 180);
            const dist = s * radius;
            const px = cx + Math.cos(angleRad) * dist;
            const py = cy + Math.sin(angleRad) * dist;
            crosshair.style.left = `${px}px`;
            crosshair.style.top = `${py}px`;
        }

        function syncFromHex(hex) {
            const hsl = hexToHsl(hex);
            currentHue = hsl.h;
            currentSat = hsl.s;
            currentLightness = Math.max(0.18, Math.min(0.82, hsl.l));
            updateCrosshair(currentHue, currentSat);
            if (slider) slider.value = Math.round(currentLightness * 100);
            if (previewBox) previewBox.style.backgroundColor = hex;
            if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
        }

        function handlePointer(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = width / rect.width;
            const scaleY = height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            const dx = px - cx;
            const dy = py - cy;
            const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;

            currentHue = angle;
            currentSat = dist / radius;
            updateCrosshair(currentHue, currentSat);

            const hex = hslToHex(currentHue, currentSat, currentLightness);
            if (previewBox) previewBox.style.backgroundColor = hex;
            if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
            applyAccentColor(hex);
        }

        canvas.addEventListener('pointerdown', (e) => {
            isDragging = true;
            canvas.setPointerCapture(e.pointerId);
            handlePointer(e);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            handlePointer(e);
        });

        canvas.addEventListener('pointerup', (e) => {
            isDragging = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        });

        canvas.addEventListener('pointercancel', () => {
            isDragging = false;
        });

        if (slider) {
            slider.addEventListener('input', (e) => {
                currentLightness = parseInt(e.target.value, 10) / 100;
                const hex = hslToHex(currentHue, currentSat, currentLightness);
                if (previewBox) previewBox.style.backgroundColor = hex;
                if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
                applyAccentColor(hex);
            });
        }

        if (hexInput) {
            hexInput.addEventListener('input', (e) => {
                let val = e.target.value.trim();
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    syncFromHex(val);
                    applyAccentColor(val);
                }
            });
        }

        document.querySelectorAll('.wheel-preset-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const col = dot.dataset.presetColor;
                if (col) {
                    syncFromHex(col);
                    applyAccentColor(col);
                }
            });
        });

        customSwatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !popover.hidden;
            popover.hidden = isOpen;
            customSwatch.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                const cur = safeGetStorage('cosmos_accent_color', defaultColor);
                syncFromHex(cur);
            }
        });

        popover.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            });
        }

        document.addEventListener('click', (e) => {
            if (!popover.hidden && !popover.contains(e.target) && !customSwatch.contains(e.target)) {
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            }
        });

        // Initialize state with current accent color
        const initialCol = safeGetStorage('cosmos_accent_color', defaultColor);
        syncFromHex(initialCol);
    }

    initColorWheel();

    // Default Viewer Format selection
    document.querySelectorAll('#appearance-format-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyDefaultViewerFormat(btn.dataset.formatVal);
        });
    });

    // Language selection
    document.querySelectorAll('#appearance-language-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLanguage(btn.dataset.langVal);
        });
    });

    // Font selection
    document.querySelectorAll('#appearance-font-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyReaderFont(btn.dataset.fontVal);
        });
    });

    // Line Height selection
    document.querySelectorAll('#appearance-line-height-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLineHeight(btn.dataset.lhVal);
        });
    });

    // Text Alignment selection
    document.querySelectorAll('#appearance-align-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTextAlign(btn.dataset.alignVal);
        });
    });

    // Width selection
    document.querySelectorAll('#appearance-width-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyReaderWidth(btn.dataset.widthVal);
        });
    });

    // Size Stepper & Slider
    const sizeSlider = document.getElementById('appearance-size-slider');
    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            applyFontScale(parseInt(e.target.value, 10));
        });
    }

    const sizeDecBtn = document.getElementById('appearance-size-dec');
    if (sizeDecBtn) {
        sizeDecBtn.addEventListener('click', () => {
            const cur = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;
            applyFontScale(cur - 5);
        });
    }

    const sizeIncBtn = document.getElementById('appearance-size-inc');
    if (sizeIncBtn) {
        sizeIncBtn.addEventListener('click', () => {
            const cur = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;
            applyFontScale(cur + 5);
        });
    }

    // Library View Mode (cards / list)
    document.querySelectorAll('#appearance-library-view-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLibraryView(btn.dataset.libView);
        });
    });

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            applyDefaultViewerFormat('pdf');
            applyLanguage('de');
            applyTheme('light');
            applyAccentColor(defaultColor);
            applyReaderFont('serif');
            applyLineHeight('normal');
            applyTextAlign('justify');
            applyReaderWidth('normal');
            applyFontScale(100);
            applyLibraryView('cards');
        });
    }
}

function updateDrawerFilterOptions(segment) {
    const isEn = (window.I18n && typeof window.I18n.getLanguage === 'function' ? window.I18n.getLanguage() === 'en' : false) || (safeGetStorage('cosmos_master_lang', 'de') === 'en');
    const recipLabel = document.getElementById('filter-label-recipient');
    const recipSelect = document.getElementById('library-recipient-select');
    const epochLabel = document.getElementById('filter-label-epoch');
    const epochSelect = document.getElementById('library-epoch-select');
    const typeLabel = document.getElementById('filter-label-type');
    const typeSelect = document.getElementById('library-type-select');

    if (!recipSelect || !epochSelect || !typeSelect) return;

    if (segment === 'books') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Author' : 'Autor / Verfasser';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Authors' : 'Alle Verfasser'}</option>
            <option value="bahaullah">Bahá’u’lláh</option>
            <option value="the-bab">Der Báb</option>
            <option value="abdul-baha">‘Abdu’l-Bahá</option>
            <option value="shoghi-effendi">Shoghi Effendi</option>
        `;
        recipSelect.value = state.library.author || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Historical Era' : 'Historische Epoche';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Epochs' : 'Alle Epochen'}</option>
            <option value="bab">${isEn ? 'Era of the Báb (1844–1853)' : 'Epoche des Báb (1844–1853)'}</option>
            <option value="bahaullah">${isEn ? 'Revelation of Bahá’u’lláh (1853–1892)' : 'Offenbarung Bahá’u’lláhs (1853–1892)'}</option>
            <option value="abdulbaha">${isEn ? 'Ministry of ‘Abdu’l-Bahá (1892–1921)' : 'Dienstzeit ‘Abdu’l-Bahás (1892–1921)'}</option>
            <option value="shoghi">${isEn ? 'Guardianship of Shoghi Effendi (1921–1957)' : 'Hüterschaft Shoghi Effendis (1921–1957)'}</option>
        `;
        epochSelect.value = state.library.timelineEpoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Category' : 'Werk-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Categories' : 'Alle Werk-Typen'}</option>
            <option value="scripture">${isEn ? 'Sacred Scripture' : 'Heilige Schriften'}</option>
            <option value="prayers">${isEn ? 'Prayers & Meditations' : 'Gebete & Andachten'}</option>
            <option value="letters">${isEn ? 'Letters & Tablets' : 'Briefe & Sendschreiben'}</option>
        `;
        typeSelect.value = state.library.type || '';
    } else if (segment === 'compilations') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Topic' : 'Themenbereich';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Topics' : 'Alle Themen'}</option>
            <option value="prayer">${isEn ? 'Prayer & Worship' : 'Gebet & Andacht'}</option>
            <option value="marriage">${isEn ? 'Marriage & Family' : 'Ehe & Familie'}</option>
            <option value="huquq">Ḥuqúqu’lláh</option>
            <option value="consultation">${isEn ? 'Consultation & Assemblies' : 'Beratung & Geistige Räte'}</option>
            <option value="women">${isEn ? 'Equality & Women' : 'Gleichberechtigung & Frauen'}</option>
            <option value="virtues">${isEn ? 'Spiritual Virtues' : 'Geistige Eigenschaften & Tugenden'}</option>
        `;
        recipSelect.value = state.library.compTopic || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Era' : 'Zeitraum';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Eras' : 'Alle Epochen'}</option>
            <option value="plans-00">${isEn ? '2000 to Present' : 'Ab 2000 bis heute'}</option>
            <option value="era-90s">${isEn ? '1980–1999' : '1980er & 1990er Jahre'}</option>
            <option value="era-early">${isEn ? 'Before 1980' : 'Vor 1980'}</option>
        `;
        epochSelect.value = state.library.epoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Collection Type' : 'Sammlungs-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Collections' : 'Alle Sammlungen'}</option>
            <option value="Kompilation">${isEn ? 'Thematic Compilations' : 'Thematische Kompilationen'}</option>
        `;
        typeSelect.value = state.library.type || '';
    } else if (segment === 'ruhi') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Course Level' : 'Kursstufe';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Books' : 'Alle Bände'}</option>
            <option value="b1-4">${isEn ? 'Books 1–4 (Foundations)' : 'Bücher 1–4 (Grundkursfolge)'}</option>
            <option value="b5-8">${isEn ? 'Books 5–8 (Youth & Mentors)' : 'Bücher 5–8 (Jugend & Mentoren)'}</option>
            <option value="b9plus">${isEn ? 'Books 9–14 (Advanced)' : 'Bücher 9–14 (Höhere Vertiefung)'}</option>
            <option value="branch">${isEn ? 'Branch Courses' : 'Zweigkurse & Vorjugend'}</option>
        `;
        recipSelect.value = state.library.ruhiGroup || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Program' : 'Programm';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Programs' : 'Alle Studienzweige'}</option>
        `;
        epochSelect.value = '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Material Type' : 'Material-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Materials' : 'Alle Studienmaterialien'}</option>
            <option value="Ruhi-Buch">${isEn ? 'Main Sequence' : 'Hauptkursbücher'}</option>
        `;
        typeSelect.value = state.library.type || '';
    } else {
        // 'house' or 'all'
        if (recipLabel) recipLabel.textContent = isEn ? 'Recipient' : 'Empfänger';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Recipients' : 'Alle Empfänger'}</option>
            <option value="world">${isEn ? 'Worldwide Community' : 'Weltweite Gemeinde'}</option>
            <option value="nsa">${isEn ? 'National Spiritual Assemblies' : 'Nationale Geistige Räte'}</option>
            <option value="counsellors">${isEn ? 'Continental Counsellors' : 'Berater & Hilfsamt'}</option>
            <option value="youth">${isEn ? 'Youth' : 'Jugend'}</option>
            <option value="iran">${isEn ? 'Friends in Iran' : 'Freunde im Iran'}</option>
            <option value="institutes">${isEn ? 'Training Institutes' : 'Trainingsinstitute'}</option>
            <option value="individual">${isEn ? 'Individual Believers' : 'Einzelne Gläubige'}</option>
        `;
        recipSelect.value = state.library.recipient || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Epoch & Plan' : 'Epoche & Plan';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Plans & Epochs' : 'Alle Pläne & Epochen'}</option>
            <option value="nine-year">${isEn ? 'Nine Year Plan (2022–2031)' : 'Neunjahresplan (2022–2031)'}</option>
            <option value="one-year">${isEn ? 'One Year Plan (2021–2022)' : 'Einjahresplan (2021–2022)'}</option>
            <option value="five-year-16">${isEn ? 'Five Year Plan (2016–2021)' : 'Fünfjahresplan (2016–2021)'}</option>
            <option value="plans-00">${isEn ? 'Plans 2001–2015' : 'Pläne 2001–2015'}</option>
            <option value="era-90s">${isEn ? '1990s' : '1990er Jahre'}</option>
            <option value="era-80s">${isEn ? '1980s' : '1980er Jahre'}</option>
            <option value="era-early">${isEn ? '1963–1979' : '1963–1979'}</option>
        `;
        epochSelect.value = state.library.epoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Occasion & Type' : 'Anlass & Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Occasions & Types' : 'Alle Anlässe & Typen'}</option>
            <option value="Riḍván-Botschaft">${isEn ? 'Riḍván Messages' : 'Riḍván-Botschaften'}</option>
            <option value="Naw-Rúz-Botschaft">${isEn ? 'Naw-Rúz Messages' : 'Naw-Rúz-Botschaften'}</option>
            <option value="Beraterkonferenz-Botschaft">${isEn ? 'Counsellor Conferences' : 'Beraterkonferenzen'}</option>
            <option value="Friedensbotschaft">${isEn ? 'Peace Messages' : 'Friedensbotschaften'}</option>
            <option value="Jugendkonferenz-Botschaft">${isEn ? 'Youth Conferences' : 'Jugendkonferenzen'}</option>
            <option value="Botschaft">${isEn ? 'General Messages' : 'Allgemeine Botschaften'}</option>
        `;
        typeSelect.value = state.library.type || '';
    }
}

// Navigation & View Switching
window.switchLibrarySegment = function(segment) {
    if (!state.library) return;
    state.library.segment = segment;
    
    // 0. Thema der gesamten Seite dem aktiven Realm anpassen
    document.documentElement.setAttribute('data-active-pillar', segment);

    // 1. Die vier Hauptsäulen (Pillar Cards) aktualisieren
    const pillarCards = document.querySelectorAll('#pillar-cards-grid .pillar-card');
    pillarCards.forEach(card => {
        const isActive = (segment !== 'all') && (card.dataset.pillar === segment);
        card.classList.toggle('active', isActive);
        card.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Aktive Karte sanft ins Blickfeld gleiten lassen
    if (segment !== 'all') {
        const activeCard = document.querySelector(`#pillar-cards-grid .pillar-card[data-pillar="${segment}"]`);
        if (activeCard && typeof activeCard.scrollIntoView === 'function') {
            try {
                activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            } catch (e) {}
        }
    }

    // 2. Dynamisches Realm-Banner oben aktualisieren (ohne Mengenangaben)
    const realmTitle = document.getElementById('realm-lead-title');
    const realmSub = document.getElementById('realm-lead-subtitle');
    if (realmTitle && realmSub) {
        if (segment === 'house') {
            realmTitle.textContent = 'Botschaften des Hauses';
            realmSub.textContent = 'Botschaften des Universalen Hauses der Gerechtigkeit (1963–2026)';
        } else if (segment === 'compilations') {
            realmTitle.textContent = 'Compilations des Hauses';
            realmSub.textContent = 'Autorisierte thematische Sammlungen der Forschungsabteilung';
        } else if (segment === 'books') {
            realmTitle.textContent = 'Heilige Schriften & Bücher';
            realmSub.textContent = 'Autorisierte Schriften der Zentralen Gestalten & Shoghi Effendis';
        } else if (segment === 'ruhi') {
            realmTitle.textContent = 'Ruhi-Bücher';
            realmSub.textContent = 'Studienmaterialien des Ruhi-Instituts (Hauptkurse & Zweigkurse)';
        } else {
            realmTitle.textContent = 'Gesamtes Archiv';
            realmSub.textContent = 'Dokumente, Schriften, Bücher und thematische Sammlungen';
        }
    }

    // 3. Platzhalter der Master-Suchleiste an den aktiven Bereich anpassen (ohne Mengenangaben)
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
        if (segment === 'house') {
            searchInput.placeholder = 'In Botschaften des Hauses (1963–2026) suchen...';
        } else if (segment === 'compilations') {
            searchInput.placeholder = 'In thematischen Compilations & Sammlungen suchen...';
        } else if (segment === 'books') {
            searchInput.placeholder = 'In Heiligen Schriften & Standardwerken suchen...';
        } else if (segment === 'ruhi') {
            searchInput.placeholder = 'In Ruhi-Büchern & Kursmaterialien suchen...';
        } else {
            searchInput.placeholder = 'In allen Dokumenten, Schriften & Volltexten suchen...';
        }
    }

    // 4. Kontextuelle Filteroptionen im Detail-Drawer aktualisieren
    updateDrawerFilterOptions(segment);

    // 5. Filter anwenden & Ergebnisse rendern
    if (typeof applyLibraryFilters === 'function') {
        applyLibraryFilters();
    }
};

window.switchView = function(targetView) {
    // Redirection shortcuts to keep interface unified
    if (targetView === 'search') {
        window.switchView('library');
        const s = document.getElementById('library-search-input');
        if (s) { s.focus(); s.select(); }
        return;
    }
    if (targetView === 'collections') {
        window.switchView('library');
        window.switchLibrarySegment('compilations');
        return;
    }
    if (targetView === 'books') {
        window.switchView('library');
        window.switchLibrarySegment('books');
        return;
    }

    if (targetView === 'settings' && window.innerWidth > 768) {
        targetView = 'library';
        const pop = document.getElementById('appearance-popover');
        const toggleBtn = document.getElementById('appearance-btn');
        if (pop) pop.hidden = false;
        if (toggleBtn) toggleBtn.classList.add('active');
    }

    const navBtns = document.querySelectorAll('.cosmos-nav .nav-btn, .dock-actions .nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === targetView);
    });

    views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${targetView}`);
    });

    state.currentView = targetView;
    document.body.setAttribute('data-active-view', targetView);
    const pop = document.getElementById('appearance-popover');
    if (pop && !pop.hidden && (window.innerWidth <= 768 || targetView !== 'library')) {
        pop.hidden = true;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window.trackEvent === 'function') {
        window.trackEvent('switch_view', { view: targetView });
    }

    if (targetView === 'books' && window.BooksModule) {
        window.BooksModule.init();
    } else if (targetView === 'workshop' && window.CompilationBuilder) {
        window.CompilationBuilder.init();
    } else if (targetView === 'saved') {
        renderSavedView();
    } else if (targetView === 'timeline' && window.TimelineModule) {
        window.TimelineModule.init();
    } else if (targetView === 'sources' && window.SourcesModule) {
        window.SourcesModule.init();
    }
};

function setupNavigation() {
    const navBtns = document.querySelectorAll('.cosmos-nav .nav-btn, .dock-actions .nav-btn:not(#appearance-btn)');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            window.switchView(btn.dataset.view);
        });
    });
}

// Deep Linking Handler for documents, paragraphs & views
function handleDeepLink() {
    let docId = null;
    let paraNum = null;

    // 1. Check URL Search Parameters (e.g. ?doc=...&p=...)
    try {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has('doc') || searchParams.has('document')) {
            docId = searchParams.get('doc') || searchParams.get('document');
            paraNum = searchParams.get('p') || searchParams.get('paragraph');
        }
    } catch (e) {}

    // 2. Check URL Hash (e.g. #doc=...&p=... or #timeline)
    try {
        const rawHash = (window.location.hash || '').replace(/^#\/?/, '');
        if (rawHash) {
            if (rawHash.includes('doc=') || rawHash.includes('document=')) {
                const hashParams = new URLSearchParams(rawHash);
                docId = hashParams.get('doc') || hashParams.get('document') || docId;
                paraNum = hashParams.get('p') || hashParams.get('paragraph') || paraNum;
            } else if (['library', 'search', 'collections', 'timeline', 'books', 'sources', 'workshop', 'saved', 'settings'].includes(rawHash)) {
                window.switchView(rawHash);
            }
        }
    } catch (e) {}

    // 3. If docId specified, open document and scroll to paragraph
    if (docId && typeof window.openDocument === 'function') {
        const pInt = paraNum ? parseInt(paraNum, 10) : null;
        const exists = state.documents && state.documents.some(d => d.id === docId);
        if (exists) {
            window.openDocument(docId, pInt);
        }
    }
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ⌘K or '/' focuses Search
        if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
            e.preventDefault();
            window.switchView('library');
            const searchInput = document.getElementById('library-search-input');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    searchInput.select();
                }, 50);
            }
        }
        
        // 'Escape' closes modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('document-viewer');
            if (modal && modal.classList.contains('active')) {
                if (typeof window.closeViewer === 'function') {
                    window.closeViewer();
                } else {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                    document.body.classList.remove('viewer-open');
                }
            } else if (document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
            }
        }
    });
}

/* ──────────────────────────────────────────────────────────────────────────
   1. BEREICH: BOTSCHAFTEN-BIBLIOTHEK (view-library)
   ────────────────────────────────────────────────────────────────────────── */

function initLibraryView() {
    // 1. Die vier Hauptsäulen (Pillar Cards) mit Toggle-Funktion
    const pillarCards = document.querySelectorAll('#pillar-cards-grid .pillar-card');
    pillarCards.forEach(card => {
        card.addEventListener('click', () => {
            if (state.library && state.library.segment === card.dataset.pillar) {
                window.switchLibrarySegment('all');
            } else {
                window.switchLibrarySegment(card.dataset.pillar);
            }
        });
    });

    // Inline-Zeitstrahl initialisieren
    initInlineTimeline();

    // Autoren-Filter für Bücher
    // Detail-Filter Drawer Toggle (Progressive Disclosure)
    const toggleFiltersBtn = document.getElementById('library-toggle-filters-btn');
    const advancedDrawer = document.getElementById('library-advanced-drawer');
    if (toggleFiltersBtn && advancedDrawer) {
        toggleFiltersBtn.addEventListener('click', () => {
            const isHidden = advancedDrawer.style.display === 'none' || !advancedDrawer.style.display;
            advancedDrawer.style.display = isHidden ? 'block' : 'none';
            toggleFiltersBtn.classList.toggle('active', isHidden);
            toggleFiltersBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
            state.library.advancedFiltersOpen = isHidden;
        });
    }

    // 1. Recipient / Author / Topic Select
    const recipSelect = document.getElementById('library-recipient-select');
    if (recipSelect) {
        recipSelect.addEventListener('change', (e) => {
            const seg = state.library.segment || 'house';
            const val = e.target.value;
            if (seg === 'books') {
                state.library.author = val;
            } else if (seg === 'compilations') {
                state.library.compTopic = val;
            } else if (seg === 'ruhi') {
                state.library.ruhiGroup = val;
            } else {
                state.library.recipient = val;
            }
            applyLibraryFilters();
        });
    }

    // 2. Epoch / Plan Select
    const epochSelect = document.getElementById('library-epoch-select');
    if (epochSelect) {
        epochSelect.addEventListener('change', (e) => {
            const seg = state.library.segment || 'house';
            const val = e.target.value;
            if (seg === 'books') {
                state.library.timelineEpoch = val;
            } else {
                state.library.epoch = val;
            }
            applyLibraryFilters();
        });
    }

    // 3. Type / Category Select
    const typeSelect = document.getElementById('library-type-select');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            state.library.type = e.target.value;
            applyLibraryFilters();
        });
    }

    // Sort Select (now inside Results Bar)
    const sortSelect = document.getElementById('library-sort-select');
    if (sortSelect) {
        sortSelect.value = state.library.sort || 'date-desc';
        sortSelect.addEventListener('change', (e) => {
            state.library.sort = e.target.value;
            applyLibraryFilters();
        });
    }

    // View Mode Handling (delegates to applyLibraryView)
    const viewGridBtn = document.getElementById('view-mode-grid');
    const viewListBtn = document.getElementById('view-mode-list');

    function applyViewMode(mode) {
        if (typeof window.applyLibraryView === 'function') {
            window.applyLibraryView(mode === 'list' ? 'list' : 'cards');
        }
        if (viewGridBtn) viewGridBtn.classList.toggle('active', mode === 'grid');
        if (viewListBtn) viewListBtn.classList.toggle('active', mode === 'list');
    }

    if (viewGridBtn) viewGridBtn.addEventListener('click', () => applyViewMode('grid'));
    if (viewListBtn) viewListBtn.addEventListener('click', () => applyViewMode('list'));
    applyViewMode(safeGetStorage('cosmos_library_view', 'cards') === 'list' ? 'list' : 'grid');

    // Search Input & Clear Button
    const searchInput = document.getElementById('library-search-input');
    const searchClearBtn = document.getElementById('library-search-clear');

    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('focus', () => {
            if (!window._fullTextLoaded && !window._fullTextLoading && typeof window.loadFullTextSearchIndex === 'function') {
                window.loadFullTextSearchIndex();
            }
        });
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (searchClearBtn) {
                searchClearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
            }
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.library.query = val.toLowerCase();
                applyLibraryFilters();
            }, 180);
        });
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            state.library.query = '';
            searchInput.focus();
            applyLibraryFilters();
        });
    }

    // Global Keyboard Shortcut: ⌘K or / to focus search
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        } else if (e.key === '/' && document.activeElement !== searchInput && 
                   document.activeElement.tagName !== 'INPUT' && 
                   document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
            }
        }
    });

    // Reset Filters Button
    const resetBtn = document.getElementById('library-reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            state.library.recipient = 'all';
            state.library.epoch = '';
            state.library.type = '';
            state.library.lang = '';
            state.library.format = 'all';
            state.library.query = '';
            state.library.author = 'all';
            state.library.compTopic = 'all';
            state.library.ruhiGroup = 'all';
            state.library.sort = 'date-desc';
            state.library.timelineEpoch = '';

            // Reset select dropdowns & search
            const recipSelect = document.getElementById('library-recipient-select');
            const epochSelect = document.getElementById('library-epoch-select');
            const typeSelect = document.getElementById('library-type-select');
            const sortSelect = document.getElementById('library-sort-select');

            if (recipSelect) recipSelect.value = 'all';
            if (epochSelect) epochSelect.value = '';
            if (typeSelect) typeSelect.value = '';
            if (sortSelect) sortSelect.value = 'date-desc';
            if (searchInput) searchInput.value = '';
            if (searchClearBtn) searchClearBtn.style.display = 'none';

            const inlineEpochBtns = document.querySelectorAll('.inline-epoch-btn');
            inlineEpochBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.epochFilter === 'all');
            });

            applyLibraryFilters();
        });
    }

    // Load More Button
    const loadMoreBtn = document.getElementById('library-load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', renderMoreLibraryResults);
    }

    updateLibrarySegmentBadges();
    window.switchLibrarySegment(state.library.segment || 'house');
}

function updateLibrarySegmentBadges() {
    // Mengenangaben entfernt gemäss Benutzervorgabe
}

// Kontextuelle Quellen & Werkzeuge (in Hauptnavigation ausgelagert)
function updatePillarEcosystem(segment) {
    // Duplikatfunktionen entfernt gemäss Benutzervorgabe
}

// Inline-Zeitstrahl für Heilige Schriften & Bücher
function initInlineTimeline() {
    const closeBtn = document.getElementById('inline-timeline-close-btn');
    const timelinePanel = document.getElementById('inline-timeline-panel');
    if (closeBtn && timelinePanel) {
        closeBtn.addEventListener('click', () => {
            timelinePanel.style.display = 'none';
        });
    }

    const epochBtns = document.querySelectorAll('.inline-epoch-btn');
    epochBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            epochBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const epoch = btn.dataset.epochFilter;
            state.library.timelineEpoch = (epoch === 'all') ? '' : epoch;
            applyLibraryFilters();
        });
    });
}



window.loadFullTextSearchIndex = async function() {
    if (window._fullTextLoaded || window._fullTextLoading) return;
    window._fullTextLoading = true;

    try {
        let cache = null;
        let response = null;
        if ('caches' in window) {
            try {
                cache = await caches.open('cosmos-fulltext-v1');
                response = await cache.match('data/search_texts.json');
            } catch (e) {}
        }

        if (!response) {
            response = await fetch('data/search_texts.json').catch(() => null);
            if (!response || !response.ok) {
                response = await fetch('/data/search_texts.json').catch(() => null);
            }
            if (response && response.ok && cache) {
                try {
                    cache.put('data/search_texts.json', response.clone());
                } catch (e) {}
            }
        }

        if (response && response.ok) {
            const data = await response.json();
            window.state.fullTexts = data;
            window.state.normalizedFullTexts = {};
            for (const id in data) {
                window.state.normalizedFullTexts[id] = normalizeSearchText(data[id]);
            }
            window._fullTextLoaded = true;
            window._fullTextLoading = false;

            // Falls während des Ladens bereits eine Suche aktiv ist, sofort reaktiv aktualisieren
            if (state.library && state.library.query && typeof applyLibraryFilters === 'function') {
                applyLibraryFilters();
            }
        }
    } catch (err) {
        console.warn('Volltext-Index Ladefehler:', err);
        window._fullTextLoading = false;
    }
};

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSearchSnippet(rawText, normText, queryNorm, tokens) {
    if (!rawText) return '';
    let matchIdx = -1;
    let matchLen = queryNorm ? queryNorm.length : 0;

    // 1. Zuerst prüfen, ob die exakte Phrase im Volltext vorkommt (z.B. bei Auszügen)
    if (normText && queryNorm) {
        matchIdx = normText.indexOf(queryNorm);
    }
    // 2. Falls kein Phrasen-Treffer, nimm den ersten Token-Treffer
    if (matchIdx === -1 && normText && tokens.length > 0) {
        for (const tok of tokens) {
            const idx = normText.indexOf(tok);
            if (idx !== -1) {
                matchIdx = idx;
                matchLen = tok.length;
                break;
            }
        }
    }

    if (matchIdx === -1) {
        return escapeDocHtml(rawText.slice(0, 160).replace(/\s+/g, ' ')) + '…';
    }

    const start = Math.max(0, matchIdx - 70);
    const end = Math.min(rawText.length, matchIdx + matchLen + 90);
    let slice = rawText.slice(start, end).replace(/\s+/g, ' ');
    let escaped = escapeDocHtml(slice);

    // Hervorhebung für alle Suchbegriffe
    for (const tok of tokens) {
        if (tok.length < 2) continue;
        const re = new RegExp('(' + escapeRegex(escapeDocHtml(tok)) + ')', 'gi');
        escaped = escaped.replace(re, '<mark class="search-highlight">$1</mark>');
    }

    return (start > 0 ? '…' : '') + escaped.trim() + (end < rawText.length ? '…' : '');
}

function normalizeSearchText(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’`ʻ‘"“”„«»]/g, '')
        .toLowerCase()
        .trim();
}
window.normalizeSearchText = normalizeSearchText;

const GERMAN_SEARCH_MONTHS = ['Januar', 'Februar', 'März', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const ENGLISH_SEARCH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDocumentSearchBundle(d) {
    if (d._searchBundle) return d._searchBundle;
    let dateVariations = '';
    if (d.date) {
        dateVariations += ' ' + d.date;
        const parts = String(d.date).split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (m >= 0 && m < 12) {
                dateVariations += ` ${GERMAN_SEARCH_MONTHS[m]} ${ENGLISH_SEARCH_MONTHS[m]} ${day}. ${GERMAN_SEARCH_MONTHS[m]} ${y} ${day}.${m+1}.${y}`;
            }
        }
    }
    if (d.year) dateVariations += ' ' + d.year;

    const topicsStr = Array.isArray(d.topics) ? d.topics.join(' ') : '';
    const rawBundle = [
        d.title || '',
        d.deTitle || '',
        d.enTitle || '',
        d.subTitle || '',
        d.author || '',
        topicsStr,
        d.recipient || '',
        d.recipientLabel || '',
        d.type || '',
        d.compilationTopic || '',
        d.excerpt || '',
        (d.text ? d.text.slice(0, 800) : ''),
        dateVariations
    ].join(' ');

    d._searchBundle = normalizeSearchText(rawBundle);
    return d._searchBundle;
}

function applyLibraryFilters() {
    let list = state.documents;
    const { segment, author, compTopic, ruhiGroup, recipient, epoch, type, lang, format, sort, query } = state.library;

    // 0. Segment-Filter
    // Wenn eine Suche aktiv ist (query vorhanden), durchsuchen wir ALLE Texte des gesamten Archivs
    // (Botschaften, Bücher, Kompilationen, Ruhi-Kurse), genau wie vom Benutzer gewünscht!
    if (!query) {
        if (segment === 'house') {
            list = list.filter(d => d.tier === 'house' || d.tier === 'institutions');
        } else if (segment === 'books') {
            list = list.filter(d => d.tier === 'books');
        } else if (segment === 'compilations') {
            list = list.filter(d => d.tier === 'compilations');
        } else if (segment === 'ruhi') {
            list = list.filter(d => d.tier === 'ruhi');
        } else if (segment === 'collections') {
            list = list.filter(d => d.tier === 'compilations' || d.tier === 'ruhi' || d.tier === 'study');
        }
    }

    // 0b. Autoren-Filter (für Bücher)
    if (author && author !== 'all') {
        list = list.filter(d => {
            const auth = ((d.author || '') + ' ' + (d.title || '')).toLowerCase();
            if (author === 'bahaullah') return auth.includes("bahá'u'lláh") || auth.includes("baha'u'llah") || auth.includes("bahaullah");
            if (author === 'the-bab') return auth.includes("báb") || auth.includes("bab");
            if (author === 'abdul-baha') return auth.includes("abdu'l-bahá") || auth.includes("abdul-baha") || auth.includes("abdu'l-baha");
            if (author === 'shoghi-effendi') return auth.includes("shoghi");
            return true;
        });
    }

    // 0c. Themen-Filter (für Kompilationen)
    if (compTopic && compTopic !== 'all') {
        list = list.filter(d => {
            const str = ((d.title || '') + ' ' + (d.compilationTopic || '')).toLowerCase();
            if (compTopic === 'marriage') return str.includes('ehe') || str.includes('marriage');
            if (compTopic === 'prayer') return str.includes('gebet') || str.includes('andacht') || str.includes('prayer');
            if (compTopic === 'huquq') return str.includes('huquq') || str.includes('ḥuqúq') || str.includes('recht gottes');
            if (compTopic === 'consultation') return str.includes('beratung') || str.includes('konsultation') || str.includes('consultation');
            if (compTopic === 'women') return str.includes('frau') || str.includes('women');
            if (compTopic === 'virtues') return str.includes('tugend') || str.includes('vertrauen') || str.includes('charakter') || str.includes('trust');
            return true;
        });
    }

    // 0d. Band-Filter (für Ruhi-Bücher)
    if (ruhiGroup && ruhiGroup !== 'all') {
        list = list.filter(d => {
            const t = (d.title || '').toLowerCase();
            if (ruhiGroup === 'b1-4') return /buch 0?[1-4]\b|book 0?[1-4]\b/i.test(t);
            if (ruhiGroup === 'b5-8') return /buch 0?[5-8]\b|book 0?[5-8]\b/i.test(t);
            if (ruhiGroup === 'b9plus') return /buch (?:0?9|1[0-2])\b|book (?:9|1[0-2])\b/i.test(t);
            if (ruhiGroup === 'branch') return t.includes('zweigkurs') || t.includes('branch');
            return true;
        });
    }

    // 1. Empfänger-Filter
    if (recipient && recipient !== 'all') {
        if (recipient === 'counsellors') {
            list = list.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors');
        } else {
            list = list.filter(d => d.recipient === recipient);
        }
    }

    // 2. Epochen-Filter
    if (epoch) {
        if (epoch === 'nine-year') {
            list = list.filter(d => d.year >= 2022 && d.year <= 2026);
        } else if (epoch === 'one-year') {
            list = list.filter(d => d.year >= 2021 && d.year <= 2022);
        } else if (epoch === 'five-year-16') {
            list = list.filter(d => d.year >= 2016 && d.year <= 2021);
        } else if (epoch === 'plans-00') {
            list = list.filter(d => d.year >= 2001 && d.year <= 2015);
        } else if (epoch === 'era-90s') {
            list = list.filter(d => d.year >= 1990 && d.year <= 2000);
        } else if (epoch === 'era-80s') {
            list = list.filter(d => d.year >= 1980 && d.year <= 1989);
        } else if (epoch === 'era-early') {
            list = list.filter(d => d.year >= 1963 && d.year <= 1979);
        }
    }

    // 2b. Historischer Zeitstrahl Epochen-Filter (Heilige Schriften & Bücher)
    const tEpoch = state.library.timelineEpoch;
    if (tEpoch && tEpoch !== 'all') {
        if (tEpoch === 'bab') {
            list = list.filter(d => (d.year >= 1844 && d.year <= 1853) || ((d.author || '').toLowerCase().includes('báb') || (d.author || '').toLowerCase().includes('bab')));
        } else if (tEpoch === 'bahaullah') {
            list = list.filter(d => (d.year >= 1853 && d.year <= 1892) || ((d.author || '').toLowerCase().includes('bahá') || (d.author || '').toLowerCase().includes('baha')));
        } else if (tEpoch === 'abdulbaha') {
            list = list.filter(d => (d.year >= 1892 && d.year <= 1921) || ((d.author || '').toLowerCase().includes('abdu')));
        } else if (tEpoch === 'shoghi') {
            list = list.filter(d => (d.year >= 1921 && d.year <= 1957) || ((d.author || '').toLowerCase().includes('shoghi')));
        }
    }

    // 3. Typ-Filter
    if (type) {
        if (type === 'Botschaft') {
            list = list.filter(d => !['Riḍván-Botschaft', 'Naw-Rúz-Botschaft', 'Beraterkonferenz-Botschaft', 'Friedensbotschaft', 'Jugendkonferenz-Botschaft'].includes(d.type));
        } else {
            list = list.filter(d => d.type === type);
        }
    }

    // 4. Sprach-Filter
    if (lang) {
        list = list.filter(d => {
            const l = (d.language || '').toLowerCase();
            if (lang.toLowerCase() === 'deutsch') return l === 'deutsch' || l === 'german';
            if (lang.toLowerCase() === 'english') return l === 'english';
            return l === lang.toLowerCase();
        });
    }

    // 5. Format-Filter
    if (format && format !== 'all') {
        const targetFmt = format.toLowerCase();
        list = list.filter(d => {
            if (Array.isArray(d.availableFormats) && d.availableFormats.includes(targetFmt)) {
                return true;
            }
            if (d.formatFiles && d.formatFiles[targetFmt]) {
                return true;
            }
            if (d.format) {
                const f = d.format.toLowerCase();
                if (targetFmt === 'docx' && (f === 'docx' || f === 'doc')) return true;
                return f === targetFmt;
            }
            return false;
        });
    }

    // 6. Universelle Multi-Feld- & Volltext-Suche (Begriffe, Auszüge, Tags, Daten, Empfänger, Thema)
    if (query) {
        const queryNorm = normalizeSearchText(query);
        const queryTokens = queryNorm.split(/\s+/).filter(Boolean);
        const isPhrase = queryTokens.length > 1;
        const fullTexts = window.state.fullTexts;
        const normTexts = window.state.normalizedFullTexts;

        if (queryTokens.length > 0) {
            const matchedList = [];

            for (const d of list) {
                const rawText = (fullTexts && fullTexts[d.id]) || d.text || '';
                const normText = (normTexts && normTexts[d.id]) || (d.text ? normalizeSearchText(d.text) : '');
                const titleNorm = normalizeSearchText(d.title || '');
                const deTitleNorm = normalizeSearchText(d.deTitle || '');
                const enTitleNorm = normalizeSearchText(d.enTitle || '');
                const authorNorm = normalizeSearchText(d.author || '');
                const recNorm = normalizeSearchText(d.recipientLabel || d.recipient || '');
                const topicsNorm = normalizeSearchText(Array.isArray(d.topics) ? d.topics.join(' ') : '');
                const dateStr = String(d.date || '') + ' ' + String(d.year || '');
                const excerptNorm = normalizeSearchText(d.excerpt || '');

                let score = 0;
                let matchedInText = false;

                // 1. Exakter Phrasentreffer im Titel / Alternativtitel (höchste Relevanz)
                if (titleNorm.includes(queryNorm) || deTitleNorm.includes(queryNorm) || enTitleNorm.includes(queryNorm)) {
                    score += 200;
                }

                // 2. Exakter Phrasentreffer im Volltext (für Auszüge, Zitate oder Redewendungen)
                if (normText && isPhrase && normText.includes(queryNorm)) {
                    score += 150;
                    matchedInText = true;
                }

                // 3. Multi-Wort Token-Matching
                if (isPhrase) {
                    const allInMeta = queryTokens.every(t => 
                        titleNorm.includes(t) || authorNorm.includes(t) || 
                        topicsNorm.includes(t) || recNorm.includes(t) || 
                        dateStr.includes(t) || excerptNorm.includes(t)
                    );
                    if (allInMeta) {
                        score += 80;
                    } else if (normText) {
                        let textTokensCount = 0;
                        for (const t of queryTokens) {
                            if (normText.includes(t)) textTokensCount++;
                        }
                        if (textTokensCount === queryTokens.length) {
                            score += 70;
                            matchedInText = true;
                        } else if (queryTokens.length >= 4 && (textTokensCount / queryTokens.length) >= 0.75) {
                            score += 35;
                            matchedInText = true;
                        }
                    }
                } else {
                    // Einzelner Suchbegriff (z.B. "Gerechtigkeit", "Klimawandel", "Seele")
                    const tok = queryTokens[0];
                    if (titleNorm.includes(tok) || deTitleNorm.includes(tok) || enTitleNorm.includes(tok)) {
                        score += 120;
                    }
                    if (authorNorm.includes(tok) || recNorm.includes(tok) || topicsNorm.includes(tok) || dateStr.includes(tok)) {
                        score += 60;
                    }
                    if (excerptNorm.includes(tok)) {
                        score += 40;
                    }
                    if (normText && normText.includes(tok)) {
                        score += 50;
                        matchedInText = true;
                    }
                }

                // Fallback: Wenn Volltext noch lädt, mit Bundle suchen
                if (!fullTexts && score === 0) {
                    const bundle = getDocumentSearchBundle(d);
                    if (queryTokens.every(tok => bundle.includes(tok))) {
                        score = 20;
                    }
                }

                if (score > 0) {
                    d._searchScore = score;
                    d._searchSnippet = matchedInText ? extractSearchSnippet(rawText, normText, queryNorm, queryTokens) : (d.excerpt ? escapeDocHtml(d.excerpt) : '');
                    matchedList.push(d);
                } else {
                    d._searchScore = 0;
                    d._searchSnippet = '';
                }
            }

            list = matchedList;
        }
    }

    // 7. Sortierung
    if (query) {
        if (sort === 'date-desc') {
            // Standard bei Suche: Nach Relevanz sortieren (höchster Relevanz-Score zuerst), sekundär nach Datum
            list.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0) || (b.date || '').localeCompare(a.date || ''));
        } else if (sort === 'date-asc') {
            list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } else if (sort === 'title') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        }
    } else {
        if (sort === 'date-desc') {
            list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        } else if (sort === 'date-asc') {
            list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        } else if (sort === 'title') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        }
    }

    // 8. Zweisprachige Zusammenführung (gleiche Dokumente als ein Werk darstellen)
    const unifiedMap = new Map();
    list.forEach(d => {
        const key = d.groupId || d.id;
        if (!unifiedMap.has(key)) {
            unifiedMap.set(key, []);
        }
        unifiedMap.get(key).push(d);
    });

    const unifiedList = [];
    unifiedMap.forEach(docsInGroup => {
        let primaryDoc;
        // Wenn ein Dokument in der Gruppe einen konkreten Volltext-Snippet-Treffer hat, dieses bevorzugen!
        const hitDoc = docsInGroup.find(d => (d._searchScore || 0) > 0 && d._searchSnippet);
        if (hitDoc) {
            primaryDoc = hitDoc;
        } else if (lang && lang.toLowerCase() === 'english') {
            primaryDoc = docsInGroup.find(d => (d.language || '').toLowerCase() === 'english') || docsInGroup[0];
        } else {
            primaryDoc = docsInGroup.find(d => (d.language || '').toLowerCase() === 'deutsch') || docsInGroup[0];
        }

        const mergedFiles = Object.assign({}, primaryDoc.formatFiles);
        const mergedFormats = new Set(primaryDoc.availableFormats || []);
        docsInGroup.forEach(item => {
            if (item.formatFiles) Object.assign(mergedFiles, item.formatFiles);
            if (item.availableFormats) item.availableFormats.forEach(f => mergedFormats.add(f));
        });

        const maxScore = Math.max(...docsInGroup.map(d => d._searchScore || 0));
        const unifiedDoc = Object.assign({}, primaryDoc, {
            formatFiles: mergedFiles,
            availableFormats: Array.from(mergedFormats),
            siblingCount: docsInGroup.length,
            _searchScore: maxScore,
            _searchSnippet: primaryDoc._searchSnippet || (hitDoc ? hitDoc._searchSnippet : '')
        });

        unifiedList.push(unifiedDoc);
    });

    if (query && sort === 'date-desc') {
        unifiedList.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0) || (b.date || '').localeCompare(a.date || ''));
    }

    list = unifiedList;

    // Aktive Filter ermitteln & Reset-Button / Counter aktualisieren
    let activeFilterCount = 0;
    const activeTags = [];

    if (recipient && recipient !== 'all') {
        activeFilterCount++;
        const recNameMap = {
            world: 'Weltweite Gemeinde', nsa: 'Nationale Räte',
            counsellors: 'Berater & Räte', youth: 'Jugend',
            institutes: 'Institute', iran: 'Iran', individual: 'Einzelne'
        };
        activeTags.push({ label: recNameMap[recipient] || recipient, key: 'recipient' });
    }
    if (epoch) {
        activeFilterCount++;
        activeTags.push({ label: 'Epoche/Plan', key: 'epoch' });
    }
    if (type) {
        activeFilterCount++;
        activeTags.push({ label: type.replace('-Botschaft', ''), key: 'type' });
    }
    if (lang) {
        activeFilterCount++;
        activeTags.push({ label: lang === 'deutsch' ? 'Deutsch' : 'English', key: 'lang' });
    }
    if (format && format !== 'all') {
        activeFilterCount++;
        activeTags.push({ label: format.toUpperCase(), key: 'format' });
    }
    if (segment === 'books' && author && author !== 'all') {
        activeFilterCount++;
        const authNameMap = {
            bahaullah: "Bahá'u'lláh", 'the-bab': 'Der Báb',
            'abdul-baha': '‘Abdu’l-Bahá', 'shoghi-effendi': 'Shoghi Effendi'
        };
        activeTags.push({ label: authNameMap[author] || author, key: 'author' });
    }
    if (segment === 'compilations' && compTopic && compTopic !== 'all') {
        activeFilterCount++;
        const topicMap = {
            marriage: 'Ehe & Familie', prayer: 'Gebet & Andacht',
            huquq: 'Ḥuqúqu’lláh', consultation: 'Beratung',
            women: 'Frauen', virtues: 'Geistige Tugenden'
        };
        activeTags.push({ label: topicMap[compTopic] || compTopic, key: 'compTopic' });
    }
    if (segment === 'ruhi' && ruhiGroup && ruhiGroup !== 'all') {
        activeFilterCount++;
        const ruhiMap = {
            'b1-4': 'Bücher 1–4', 'b5-8': 'Bücher 5–8',
            'b9plus': 'Bücher 9–12', 'branch': 'Zweigkurse'
        };
        activeTags.push({ label: ruhiMap[ruhiGroup] || ruhiGroup, key: 'ruhiGroup' });
    }
    if (tEpoch && tEpoch !== 'all') {
        activeFilterCount++;
        const epochMap = {
            bab: 'Sendung des Báb (1844–1853)',
            bahaullah: "Sendung Bahá'u'lláhs (1853–1892)",
            abdulbaha: "Wirken ‘Abdu’l-Bahás (1892–1921)",
            shoghi: "Wirken Shoghi Effendis (1921–1957)"
        };
        activeTags.push({ label: epochMap[tEpoch] || tEpoch, key: 'timelineEpoch' });
    }
    if (query) {
        activeFilterCount++;
        activeTags.push({ label: `"${query}"`, key: 'query' });
    }

    const resetBtnEl = document.getElementById('library-reset-filters-btn');
    const filterBadge = document.getElementById('library-filter-badge');
    if (filterBadge) {
        filterBadge.style.display = activeFilterCount > 0 ? 'inline-block' : 'none';
        filterBadge.textContent = activeFilterCount;
    }
    if (resetBtnEl) {
        resetBtnEl.style.display = activeFilterCount > 0 ? 'inline-flex' : 'none';
    }

    // Ergebnisse-Statuszeile aktualisieren
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    const countNumEl = document.getElementById('library-count-num');
    if (countNumEl) countNumEl.textContent = list.length.toLocaleString(isEn ? 'en-US' : 'de-DE');

    const tagsContainer = document.getElementById('library-active-tags');
    if (tagsContainer) {
        tagsContainer.innerHTML = activeTags.map(tag => `
            <span class="active-tag-pill">
                ${tag.label}
            </span>
        `).join('');
    }

    state.library.results = list;
    state.library.renderedCount = 0;

    const container = document.getElementById('library-results');
    if (container) container.innerHTML = '';

    if (list.length === 0) {
        if (container) {
            const emptyMsg = window.I18n ? window.I18n.t('results.empty_desc') : 'Keine Werke oder Dokumente gefunden, die den gewählten Kriterien entsprechen.';
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">${emptyMsg}</p>`;
        }
        updateLibraryLoadMore();
        if (window.I18n && window.I18n.applyToDOM) window.I18n.applyToDOM();
        return;
    }

    renderMoreLibraryResults();
}

function renderMoreLibraryResults() {
    const container = document.getElementById('library-results');
    if (!container || state.library.results.length === 0) return;

    const nextBatch = state.library.results.slice(state.library.renderedCount, state.library.renderedCount + APP_PAGE_SIZE);
    
    let html = '';
    nextBatch.forEach((doc, idx) => {
        html += window.createDocCard(doc, doc._searchSnippet || '', idx);
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
    }

    state.library.renderedCount += nextBatch.length;
    updateLibraryLoadMore();
}

function updateLibraryLoadMore() {
    const container = document.getElementById('library-load-more');
    const btn = document.getElementById('library-load-more-btn');
    if (!container) return;

    if (state.library.renderedCount < state.library.results.length) {
        container.style.display = 'block';
        if (btn) {
            btn.textContent = `Mehr Botschaften anzeigen (${state.library.renderedCount} von ${state.library.results.length})`;
        }
    } else {
        container.style.display = 'none';
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   2. BEREICH: SAMMLUNGEN & RUHI (view-collections)
   ────────────────────────────────────────────────────────────────────────── */

function initCollectionsView() {
    const subtabs = document.querySelectorAll('#collections-subtabs button');
    subtabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const subview = btn.dataset.subview;
            switchCollectionsSubview(subview);
        });
    });

    renderCompilations();
    renderRuhiBooks();
    renderStudyMaterial();
}

function switchCollectionsSubview(subview) {
    state.collectionsSubView = subview;
    const subtabs = document.querySelectorAll('#collections-subtabs button');
    const panes = document.querySelectorAll('.collections-pane');

    subtabs.forEach(btn => {
        if (btn.dataset.subview === subview) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    panes.forEach(p => {
        if (p.id === `subview-${subview}`) {
            p.style.display = 'block';
            p.classList.add('active');
        } else {
            p.style.display = 'none';
            p.classList.remove('active');
        }
    });
}

function renderCompilations() {
    const grid = document.getElementById('compilations-grid');
    if (!grid) return;

    const comps = state.documents.filter(d => 
        d.tier === 'compilations' || d.source === 'Forschungsabteilung' || d.type === 'Kompilation'
    );

    const topicGroups = {};
    comps.forEach(doc => {
        let key = doc.compilationTopic;
        if (!key) {
            key = (doc.title || '').replace(/\s*\([^)]*\)$/, '').trim();
        }
        if (!topicGroups[key]) topicGroups[key] = [];
        topicGroups[key].push(doc);
    });

    const sortedKeys = Object.keys(topicGroups).sort((a, b) => a.localeCompare(b, 'de'));

    grid.innerHTML = sortedKeys.map((key, idx) => {
        const docs = topicGroups[key];
        const deDocs = docs.filter(d => d.language === 'deutsch');
        const enDocs = docs.filter(d => d.language === 'english');
        const mainDoc = deDocs[0] || enDocs[0] || docs[0];
        
        const deWord = deDocs.find(d => d.format === 'docx');
        const dePdf = deDocs.find(d => d.format === 'pdf');
        const enWord = enDocs.find(d => d.format === 'docx');
        const enPdf = enDocs.find(d => d.format === 'pdf');
        
        let enSubtitle = '';
        const enSample = enDocs.find(d => d.title && d.title.includes('('));
        if (enSample) {
            const m = enSample.title.match(/\(([^)]+)\)/);
            if (m) enSubtitle = m[1];
        } else if (enDocs.length > 0 && enDocs[0].title !== key) {
            enSubtitle = enDocs[0].title;
        }

        const totalWords = mainDoc.wordCount || (mainDoc.text ? mainDoc.text.split(/\s+/).length : 0);
        const excerpt = mainDoc.excerpt || (mainDoc.text || '').replace(/\s+/g, ' ').substring(0, 160).trim();

        const wordsLabel = totalWords >= 1000 ? `~${(totalWords / 1000).toFixed(0)}k Wörter` : (totalWords > 0 ? `${totalWords} Wörter` : '');

        return `
            <div class="doc-card compilation-card" style="--i: ${idx % 30}; cursor: pointer;" onclick="window.openDocument('${mainDoc.id}')">
                <div>
                    <div class="doc-meta">
                        <span class="source-badge source-forschungsabteilung">Kompilation</span>
                        ${(dePdf && enPdf) ? `<span class="doc-bilingual-badge">DE · EN</span>` : ''}
                    </div>
                    <h3 class="doc-title">${escapeDocHtml(key)}${enSubtitle ? ` (${escapeDocHtml(enSubtitle)})` : ''}</h3>
                    <p class="doc-excerpt">${escapeDocHtml(excerpt)}…</p>
                </div>
                <div class="doc-footer">
                    <div class="doc-tags">
                        ${(mainDoc.topics || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                    ${wordsLabel ? `<span style="font-family: var(--font-sans); font-size: 0.72rem; color: var(--text-subtle);">${wordsLabel}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderRuhiBooks() {
    const grid = document.getElementById('ruhi-books-grid');
    if (!grid) return;

    const ruhiDocs = state.documents.filter(d => 
        d.tier === 'ruhi' || d.source === 'Ruhi-Institut' || d.type === 'Ruhi-Buch' || (d.title && d.title.startsWith('Ruhi Buch')) || (d.title && d.title.startsWith('Ruhi Book'))
    ).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));

    if (ruhiDocs.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">Keine Ruhi-Bücher gefunden.</p>';
        return;
    }

    grid.innerHTML = ruhiDocs.map((doc, idx) => {
        const wordCount = doc.wordCount || (doc.text ? doc.text.split(/\s+/).length : 0);
        const bookNumMatch = doc.title.match(/Ruhi (?:Buch|Book) (\d+(?:\.\d+)?)/i);
        const bookNum = bookNumMatch ? bookNumMatch[1] : '';
        const isBranch = doc.title.toLowerCase().includes('zweigkurs') || doc.title.toLowerCase().includes('branch');
        const isEnglish = doc.language === 'english';
        
        const pdfPath = doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf') ? doc.filePath : null;

        const badgeLabel = isBranch ? `Zweigkurs ${bookNum}` : (bookNum ? `Buch ${bookNum}` : 'Ruhi');
        const excerptText = doc.description || doc.excerpt || (doc.text || '').substring(0, 150);

        return `
            <div class="ruhi-card" style="--i: ${idx % 30};" onclick="window.openDocument('${doc.id}')">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem;">
                    <span style="font-family: var(--font-sans); font-weight: 700; font-size: 0.95rem; color: var(--color-accent); background: var(--color-accent-light); padding: 0.25rem 0.75rem; border-radius: 20px;">
                        ${badgeLabel}
                    </span>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <span class="badge badge-${isEnglish ? 'english' : 'deutsch'}" style="font-size: 0.72rem;">${isEnglish ? 'EN' : 'DE'}</span>
                        <span style="font-family: var(--font-sans); font-size: 0.8rem; color: var(--color-text-muted);">
                            ~${(wordCount / 1000).toFixed(0)}k Wörter
                        </span>
                    </div>
                </div>
                <h3 style="font-size: 1.2rem; color: var(--color-primary); margin-bottom: 0.6rem; line-height: 1.4;">
                    ${escapeDocHtml(doc.title)}
                </h3>
                <p style="font-size: 0.88rem; color: var(--color-text-muted); margin-bottom: 1.25rem; flex: 1; line-height: 1.5;">
                    ${escapeDocHtml(excerptText)}${excerptText.length >= 140 ? '…' : ''}
                </p>
                ${doc.units && doc.units.length > 0 ? `
                <div style="margin-bottom: 1rem; font-size: 0.8rem; color: var(--color-text-muted); background: rgba(0,0,0,0.02); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
                    <strong style="color: var(--color-text);">Einheiten / Kapitel:</strong>
                    <ul style="margin: 0.25rem 0 0 1rem; padding: 0; list-style-type: disc;">
                        ${doc.units.map(u => `<li>${u}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: auto;">
                    <span style="font-size: 0.85rem; font-family: var(--font-sans); color: var(--color-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
                        PDF einsehen →
                    </span>
                    <div style="display: flex; gap: 0.35rem;" onclick="event.stopPropagation();">
                        ${pdfPath ? `<a href="${pdfPath}" target="_blank" class="format-badge" style="text-decoration:none; background: var(--accent-gold-soft); color: var(--accent-gold); padding: 0.2rem 0.55rem; font-size: 0.75rem; border-radius: 4px; font-weight: 600; border: 1px solid rgba(154, 122, 56, 0.25);" title="PDF-Studienausgabe in neuem Tab öffnen">PDF</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudyMaterial() {
    const grid = document.getElementById('study-grid');
    if (!grid) return;

    const studyDocs = state.documents.filter(d => 
        d.tier === 'study' || d.source === 'Studienmaterial' || d.type === 'Studienmaterial' || d.type === 'Studiendokument'
    ).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));

    if (studyDocs.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 3rem;">Kein Studienmaterial gefunden.</p>';
        return;
    }

    grid.innerHTML = studyDocs.map((doc, idx) => window.createDocCard(doc, '', idx)).join('');
}

/* ──────────────────────────────────────────────────────────────────────────
   5. BEREICH: MERKLISTE & GESPEICHERTE KOMPILATIONEN (view-saved)
   ────────────────────────────────────────────────────────────────────────── */

window.recordReadingHistory = function(doc) {
    if (!doc || !doc.id) return;
    try {
        const raw = safeGetStorage('cosmos_reading_history', '[]');
        let history = JSON.parse(raw);
        if (!Array.isArray(history)) history = [];
        history = history.filter(item => item.id !== doc.id && (!doc.groupId || item.groupId !== doc.groupId));
        history.unshift({
            id: doc.id,
            groupId: doc.groupId || null,
            title: doc.title || doc.deTitle || doc.enTitle || 'Werk',
            author: doc.author || '',
            tier: doc.tier || '',
            date: doc.date || (doc.year ? String(doc.year) : ''),
            timestamp: Date.now()
        });
        if (history.length > 50) history = history.slice(0, 50);
        safeSetStorage('cosmos_reading_history', JSON.stringify(history));

        const countHistory = document.getElementById('saved-history-count');
        if (countHistory) countHistory.textContent = history.length;
    } catch (e) {}
};

window.clearReadingHistory = function() {
    safeSetStorage('cosmos_reading_history', '[]');
    renderReadingHistory();
    const countHistory = document.getElementById('saved-history-count');
    if (countHistory) countHistory.textContent = '0';
};

window.switchSavedTab = function(tab) {
    state.savedTab = tab;
    const pillBookmarks = document.getElementById('pill-saved-bookmarks');
    const pillHistory = document.getElementById('pill-saved-history');
    const pillCompilations = document.getElementById('pill-saved-compilations');
    const paneBookmarks = document.getElementById('saved-pane-bookmarks');
    const paneHistory = document.getElementById('saved-pane-history');
    const paneCompilations = document.getElementById('saved-pane-compilations');

    pillBookmarks?.classList.toggle('active', tab === 'bookmarks');
    pillHistory?.classList.toggle('active', tab === 'history');
    pillCompilations?.classList.toggle('active', tab === 'compilations');

    if (paneBookmarks) paneBookmarks.style.display = (tab === 'bookmarks') ? 'block' : 'none';
    if (paneHistory) paneHistory.style.display = (tab === 'history') ? 'block' : 'none';
    if (paneCompilations) paneCompilations.style.display = (tab === 'compilations') ? 'block' : 'none';

    if (tab === 'bookmarks') {
        renderBookmarks();
    } else if (tab === 'history') {
        renderReadingHistory();
    } else {
        renderSavedCompilationsList();
    }
};

function renderSavedView() {
    // Update counts
    const countBookmarks = document.getElementById('saved-bookmarks-count');
    const countHistory = document.getElementById('saved-history-count');
    const countComps = document.getElementById('saved-compilations-count');
    
    if (countBookmarks) countBookmarks.textContent = state.bookmarks.length;
    
    try {
        const history = JSON.parse(safeGetStorage('cosmos_reading_history', '[]'));
        if (countHistory) countHistory.textContent = history.length;
    } catch (e) {
        if (countHistory) countHistory.textContent = '0';
    }

    let compList = [];
    try {
        compList = JSON.parse(safeGetStorage('my_compilations', '[]'));
    } catch (e) {}
    if (countComps) countComps.textContent = compList.length;

    window.switchSavedTab(state.savedTab || 'bookmarks');
}

function renderReadingHistory() {
    const container = document.getElementById('reading-history-list');
    if (!container) return;

    let history = [];
    try {
        history = JSON.parse(safeGetStorage('cosmos_reading_history', '[]'));
    } catch (e) {}

    const countHistory = document.getElementById('saved-history-count');
    if (countHistory) countHistory.textContent = history.length;

    if (history.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Noch kein Leseverlauf vorhanden. Gelesene Bücher und Botschaften werden hier aufgeführt.</p>';
        return;
    }

    const docMap = new Map();
    state.documents.forEach(d => docMap.set(d.id, d));

    const htmlCards = history.map((item, idx) => {
        const fullDoc = docMap.get(item.id);
        if (fullDoc) {
            return window.createDocCard(fullDoc, '', idx);
        }
        return `
            <article class="doc-card" style="--i: ${idx % 30}; cursor: pointer;" onclick="window.openDocument('${item.id}')">
                <div class="doc-card-body">
                    <div class="doc-card-header">
                        <div class="doc-meta-editorial">${item.date ? `<span class="doc-date">${escapeDocHtml(item.date)}</span>` : ''}</div>
                    </div>
                    <h3 class="doc-title">${escapeDocHtml(item.title)}</h3>
                    ${item.author ? `<div class="doc-sub-title">${escapeDocHtml(item.author)}</div>` : ''}
                </div>
            </article>
        `;
    }).join('');

    container.innerHTML = htmlCards;
}

function renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;

    const bookmarkedDocs = state.documents.filter(doc => state.bookmarks.includes(doc.id));

    if (bookmarkedDocs.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 3rem;">Noch keine Lesezeichen gespeichert. Klicken Sie bei einem Dokument auf das Lesezeichen-Symbol, um es hier abzulegen.</p>';
        return;
    }

    container.innerHTML = bookmarkedDocs.map((doc, idx) => window.createDocCard(doc, '', idx)).join('');
}

function renderSavedCompilationsList() {
    const container = document.getElementById('saved-compilations-list');
    if (!container) return;

    let compList = [];
    try {
        compList = JSON.parse(safeGetStorage('my_compilations', '[]'));
    } catch (e) {}

    if (compList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--color-text-secondary); padding: 3.5rem 1.5rem; background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
                <div style="font-family: var(--font-sans); font-size: 0.8rem; font-weight: 600; color: var(--color-accent); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Keine Manuskripte</div>
                <p style="font-size: 1.05rem; font-family: var(--font-serif); color: var(--color-text); margin-bottom: 0.4rem;">Noch keine eigenen Kompilationen gespeichert.</p>
                <p style="font-size: 0.88rem; color: var(--color-text-secondary); max-width: 480px; margin: 0 auto 1.5rem;">In der Kompilations-Werkstatt können Sie Absätze aus allen Botschaften zusammenstellen und dauerhaft sichern.</p>
                <button onclick="window.switchView('workshop')" class="btn-primary">Zur Kompilations-Werkstatt</button>
            </div>
        `;
        return;
    }

    container.innerHTML = compList.map((comp, idx) => `
        <div class="saved-comp-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-left: 3px solid var(--color-accent); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
            <div>
                <div style="font-size: 0.78rem; color: var(--color-text-tertiary); margin-bottom: 0.3rem;">
                    Zuletzt bearbeitet: ${comp.updatedAt ? new Date(comp.updatedAt).toLocaleDateString('de-DE') : '—'} · ${comp.passages.length} ${comp.passages.length === 1 ? 'Absatz' : 'Absätze'}
                </div>
                <h3 style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--color-text); margin: 0 0 0.35rem 0; font-weight: 500;">${escapeDocHtml(comp.title)}</h3>
                ${comp.description ? `<p style="font-size: 0.88rem; color: var(--color-text-secondary); margin: 0; font-style: italic;">${escapeDocHtml(comp.description)}</p>` : ''}
            </div>
            <div style="display: flex; gap: 0.6rem; align-items: center;">
                <button onclick="window.openSavedInWorkshop(${idx})" class="btn-primary" style="font-size: 0.82rem; padding: 0.45rem 1rem;">
                    Öffnen
                </button>
                <button onclick="window.deleteSavedCompilation(${idx})" class="btn-secondary" style="font-size: 0.82rem; padding: 0.45rem 0.9rem;" title="Kompilation löschen">
                    Löschen
                </button>
            </div>
        </div>
    `).join('');
}

window.openSavedInWorkshop = function(idx) {
    try {
        const compList = JSON.parse(safeGetStorage('my_compilations', '[]'));
        if (compList[idx]) {
            safeSetStorage('workshop_active_draft', JSON.stringify(compList[idx]));
            window.switchView('workshop');
            setTimeout(() => {
                if (window.CompilationBuilder && window.CompilationBuilder.init) {
                    window.CompilationBuilder.init();
                }
            }, 100);
        }
    } catch (e) {}
};

window.deleteSavedCompilation = function(idx) {
    if (!confirm('Möchten Sie diese gespeicherte Kompilation wirklich löschen?')) return;
    try {
        const compList = JSON.parse(safeGetStorage('my_compilations', '[]'));
        compList.splice(idx, 1);
        safeSetStorage('my_compilations', JSON.stringify(compList));
        renderSavedView();
    } catch (e) {}
};

window.toggleBookmark = function(id) {
    const index = state.bookmarks.indexOf(id);
    if (index > -1) {
        state.bookmarks.splice(index, 1);
    } else {
        state.bookmarks.push(id);
    }
    safeSetStorage('bookmarks', JSON.stringify(state.bookmarks));
    
    // Update viewer icon if open
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    if (bookmarkBtn) {
        if (state.bookmarks.includes(id)) {
            bookmarkBtn.style.color = 'var(--color-primary)';
            bookmarkBtn.querySelector('svg')?.setAttribute('fill', 'currentColor');
        } else {
            bookmarkBtn.style.color = '';
            bookmarkBtn.querySelector('svg')?.setAttribute('fill', 'none');
        }
    }
    
    if (state.currentView === 'saved') {
        renderSavedView();
    }
};

/* ──────────────────────────────────────────────────────────────────────────
   GEMEINSAME ELEMENTE & CARD RENDERER
   ────────────────────────────────────────────────────────────────────────── */

function formatDate(dateString) {
    if (!dateString) return 'Undatiert';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    return dateString;
}

window.createDocCard = function(doc, snippet = '', index = 0) {
    const isEn = (doc.language || '').toLowerCase() === 'english';
    const hasBoth = doc.availableLanguages && doc.availableLanguages.includes('de') && doc.availableLanguages.includes('en');
    
    // 1. Ruhige, informative Metazeile (nur das Wesentliche: Datum & Kontext)
    const metaParts = [];

    // Säulen-Zuordnung bei Master-Gesamtsuche ("all") ODER wenn eine Suche aktiv ist
    if ((state.library && state.library.segment === 'all') || (state.library && state.library.query)) {
        let pillarTag = (window.I18n && window.I18n.getCurrentLanguage() === 'en') ? 'Message' : 'Botschaft';
        if (doc.tier === 'books') pillarTag = (window.I18n && window.I18n.getCurrentLanguage() === 'en') ? 'Holy Book' : 'Heilige Schrift';
        else if (doc.tier === 'compilations') pillarTag = (window.I18n && window.I18n.getCurrentLanguage() === 'en') ? 'Compilation' : 'Kompilation';
        else if (doc.tier === 'ruhi') pillarTag = (window.I18n && window.I18n.getCurrentLanguage() === 'en') ? 'Ruhi Course' : 'Ruhi-Buch';
        metaParts.push(`<span class="doc-pillar-text">${pillarTag}</span>`);
    }

    // Schlüssel-Botschaft / Meilenstein Tag (laut autorisierten Quellen)
    if (doc.isMilestone || doc._isMilestone) {
        const msLabel = (window.I18n && window.I18n.getCurrentLanguage() === 'en') ? 'Key Message' : 'Schlüssel-Botschaft';
        const msTitle = doc.milestoneReasonDe || doc.milestoneReasonEn || msLabel;
        metaParts.unshift(`<span class="doc-milestone-tag" title="${escapeDocHtml(msTitle)}">${msLabel}</span>`);
    }

    // Datum (unverzichtbar für chronologische Orientierung)
    if (doc.tier === 'books' && doc.year) {
        metaParts.push(`<span class="doc-date">${doc.year}</span>`);
    } else if (doc.date) {
        metaParts.push(`<span class="doc-date">${formatDate(doc.date)}</span>`);
    }
    
    // Spezifischer Anlass / Empfänger / Autor (nur falls aussagekräftig)
    let contextLabel = '';
    if (doc.tier === 'books') {
        if (doc.author) contextLabel = doc.author;
    } else if (doc.type && doc.type !== 'Botschaft' && !doc.type.includes('Botschaft')) {
        contextLabel = doc.type;
    } else if (doc.recipientLabel) {
        let rec = doc.recipientLabel;
        if (rec === "Weltweite Bahá'í-Gemeinde") rec = "Weltweite Gemeinde";
        if (rec === "Kontinentale Berater & Hilfsamt") rec = "Beraterkonferenz";
        if (rec !== "Botschaft" && rec !== "Universales Haus der Gerechtigkeit") {
            contextLabel = rec;
        }
    }
    const recipientHtml = contextLabel ? `<span class="doc-recipient-text" title="Empfänger / Kontext">${escapeDocHtml(contextLabel)}</span>` : '';

    const bilingualBadge = hasBoth ? `<span class="doc-bilingual-badge" title="Zweisprachig verfügbar (Deutsch & Englisch)">DE · EN</span>` : '';

    const staggerIndex = typeof index === 'number' ? (index % 30) : 0;
    const activeSnippet = snippet || doc._searchSnippet || '';
    const previewText = activeSnippet ? (activeSnippet.startsWith('…') ? activeSnippet : `…${activeSnippet}…`) : (doc.excerpt ? `${escapeDocHtml(doc.excerpt)}…` : '');

    // Zweitsprachiger Titel ohne redundante Datumsdoppelung
    let subTitleHtml = '';
    if (hasBoth) {
        let otherTitle = isEn ? doc.deTitle : doc.enTitle;
        if (otherTitle && otherTitle !== doc.title) {
            otherTitle = otherTitle.replace(/^\d{1,2}\s+[A-Za-zäöüßÄÖÜ]+\s+\d{4}\s*[–-]\s*/, '').trim();
            if (otherTitle) {
                subTitleHtml = `<div class="doc-sub-title">${escapeDocHtml(otherTitle)}</div>`;
            }
        }
    }

    // 2. Dezent kuratierte Themen im Footer (maximal 2)
    let topicsHtml = '';
    if (doc.topics && doc.topics.length > 0) {
        topicsHtml = `<span class="doc-topic-pill">${escapeDocHtml(doc.topics[0])}</span>`;
        if (doc.topics.length > 1) {
            topicsHtml += `<span class="doc-topic-pill">${escapeDocHtml(doc.topics[1])}</span>`;
        }
        if (doc.topics.length > 2) {
            topicsHtml += `<span class="doc-topic-more">+${doc.topics.length - 2}</span>`;
        }
    }

    const hasFooter = Boolean(topicsHtml || recipientHtml);
    const isMilestoneCard = Boolean(doc.isMilestone || doc._isMilestone);

    return `
        <article class="doc-card ${isMilestoneCard ? 'is-milestone' : ''}" style="--i: ${staggerIndex};" onclick="window.openDocument('${doc.id}')">
            <div class="doc-card-body">
                <div class="doc-card-header">
                    <div class="doc-meta-editorial">
                        ${metaParts.join('<span class="meta-dot">•</span>')}
                    </div>
                    ${bilingualBadge}
                </div>
                <h3 class="doc-title">${escapeDocHtml(doc.title)}</h3>
                ${subTitleHtml}
                ${previewText ? `<p class="doc-excerpt ${activeSnippet ? 'doc-search-snippet' : ''}">${previewText}</p>` : ''}
            </div>
            ${hasFooter ? `
            <div class="doc-card-footer">
                ${topicsHtml ? `<div class="doc-topics-cluster">${topicsHtml}</div>` : ''}
                ${recipientHtml}
            </div>` : ''}
        </article>
    `;
};

function updateYearFilter() {
    const select = document.getElementById('filter-year');
    if (!select) return;
    
    const years = [...new Set(state.documents.map(d => d.year))].filter(Boolean).sort((a, b) => b - a);
    
    select.innerHTML = '<option value="">Alle Jahre</option>';
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });
}

function escapeDocHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
