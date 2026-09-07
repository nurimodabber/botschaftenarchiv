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

        const wheelInput = document.getElementById('accent-color-input');
        const hexInput = document.getElementById('accent-hex-input');
        if (wheelInput && wheelInput.value !== fullHex) wheelInput.value = fullHex;
        if (hexInput && hexInput.value.toLowerCase() !== fullHex.toLowerCase()) hexInput.value = fullHex.toUpperCase();

        // Update Dock Pill Color Dot
        const dockDot = document.getElementById('dock-accent-dot');
        if (dockDot) {
            dockDot.style.backgroundColor = fullHex;
            dockDot.style.boxShadow = `0 0 6px ${fullHex}`;
        }

        document.querySelectorAll('.accent-swatch').forEach(sw => {
            sw.classList.toggle('active', (sw.dataset.color || '').toLowerCase() === fullHex.toLowerCase());
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
    const savedLibView = safeGetStorage('cosmos_library_view', 'cards');

    function applyLibraryView(viewMode) {
        const validView = (viewMode === 'list') ? 'list' : 'cards';
        html.setAttribute('data-library-view', validView);
        safeSetStorage('cosmos_library_view', validView);

        document.querySelectorAll('#appearance-library-view-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.libView === validView);
        });
    }

    // Initialize all settings
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

    if (toggleBtn && popover) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = popover.hidden;
            popover.hidden = !isHidden;
            toggleBtn.classList.toggle('active', !popover.hidden);
        });

        document.addEventListener('click', (e) => {
            if (!popover.hidden && !popover.contains(e.target) && !toggleBtn.contains(e.target)) {
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

    // Swatches
    document.querySelectorAll('.accent-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            if (sw.dataset.color) applyAccentColor(sw.dataset.color);
        });
    });

    // Color Wheel & Hex
    const colorInput = document.getElementById('accent-color-input');
    if (colorInput) {
        colorInput.addEventListener('input', (e) => applyAccentColor(e.target.value));
    }

    const hexInput = document.getElementById('accent-hex-input');
    if (hexInput) {
        hexInput.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) applyAccentColor(val);
        });
    }

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

// Navigation & View Switching
window.switchLibrarySegment = function(segment) {
    if (!state.library) return;
    state.library.segment = segment;
    
    const segmentBtns = document.querySelectorAll('#library-segment-bar .segment-btn');
    segmentBtns.forEach(b => {
        const isActive = b.dataset.segment === segment;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const quickChips = document.getElementById('library-quick-chips');
    const authorChips = document.getElementById('library-author-chips');
    const compChips = document.getElementById('library-comp-chips');
    const ruhiChips = document.getElementById('library-ruhi-chips');

    if (quickChips) quickChips.style.display = (segment === 'house' || segment === 'all') ? 'flex' : 'none';
    if (authorChips) authorChips.style.display = (segment === 'books') ? 'flex' : 'none';
    if (compChips) compChips.style.display = (segment === 'compilations') ? 'flex' : 'none';
    if (ruhiChips) ruhiChips.style.display = (segment === 'ruhi') ? 'flex' : 'none';

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

    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === targetView);
    });

    views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${targetView}`);
    });

    state.currentView = targetView;
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
    const navBtns = document.querySelectorAll('.nav-btn');
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
            } else if (['library', 'search', 'collections', 'timeline', 'books', 'sources', 'workshop', 'saved'].includes(rawHash)) {
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
                modal.classList.remove('active');
                document.body.style.overflow = '';
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
    // Segment-Auswahl (Alle | Botschaften | Bücher | Ruhi)
    const segmentBtns = document.querySelectorAll('#library-segment-bar .segment-btn');
    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            window.switchLibrarySegment(btn.dataset.segment);
        });
    });

    // Autoren-Filter für Bücher
    const authorChips = document.querySelectorAll('#library-author-chips .author-chip-btn');
    authorChips.forEach(btn => {
        btn.addEventListener('click', () => {
            authorChips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.library.author = btn.dataset.author || 'all';
            applyLibraryFilters();
        });
    });

    // Themen-Filter für Kompilationen
    const compChips = document.querySelectorAll('#library-comp-chips .comp-chip-btn');
    compChips.forEach(btn => {
        btn.addEventListener('click', () => {
            compChips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.library.compTopic = btn.dataset.comp || 'all';
            applyLibraryFilters();
        });
    });

    // Band-Filter für Ruhi-Bücher
    const ruhiChips = document.querySelectorAll('#library-ruhi-chips .ruhi-chip-btn');
    ruhiChips.forEach(btn => {
        btn.addEventListener('click', () => {
            ruhiChips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.library.ruhiGroup = btn.dataset.ruhi || 'all';
            applyLibraryFilters();
        });
    });

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

    // Recipient Select
    const recipSelect = document.getElementById('library-recipient-select');
    if (recipSelect) {
        recipSelect.value = state.library.recipient || 'all';
        recipSelect.addEventListener('change', (e) => {
            state.library.recipient = e.target.value;
            syncQuickChipsWithFilters();
            applyLibraryFilters();
        });
    }

    // Epoch Select
    const epochSelect = document.getElementById('library-epoch-select');
    if (epochSelect) {
        epochSelect.value = state.library.epoch || '';
        epochSelect.addEventListener('change', (e) => {
            state.library.epoch = e.target.value;
            syncQuickChipsWithFilters();
            applyLibraryFilters();
        });
    }

    // Type Select
    const typeSelect = document.getElementById('library-type-select');
    if (typeSelect) {
        typeSelect.value = state.library.type || '';
        typeSelect.addEventListener('change', (e) => {
            state.library.type = e.target.value;
            syncQuickChipsWithFilters();
            applyLibraryFilters();
        });
    }

    // Language Select
    const langSelect = document.getElementById('library-lang-select');
    if (langSelect) {
        langSelect.value = state.library.lang || '';
        langSelect.addEventListener('change', (e) => {
            state.library.lang = e.target.value;
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

    // 1-Klick Smart Quick-Chips
    const quickChips = document.querySelectorAll('.quick-chip-btn');
    quickChips.forEach(btn => {
        btn.addEventListener('click', () => {
            quickChips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const chip = btn.dataset.chip;
            if (chip === 'all') {
                state.library.recipient = 'all';
                state.library.type = '';
                if (recipSelect) recipSelect.value = 'all';
                if (typeSelect) typeSelect.value = '';
            } else if (chip === 'ridvan') {
                state.library.type = 'Riḍván-Botschaft';
                if (typeSelect) typeSelect.value = 'Riḍván-Botschaft';
            } else if (chip === 'world') {
                state.library.recipient = 'world';
                if (recipSelect) recipSelect.value = 'world';
            } else if (chip === 'counsellors') {
                state.library.recipient = 'counsellors';
                if (recipSelect) recipSelect.value = 'counsellors';
            } else if (chip === 'youth') {
                state.library.recipient = 'youth';
                if (recipSelect) recipSelect.value = 'youth';
            } else if (chip === 'iran') {
                state.library.recipient = 'iran';
                if (recipSelect) recipSelect.value = 'iran';
            } else if (chip === 'peace') {
                state.library.type = 'Friedensbotschaft';
                if (typeSelect) typeSelect.value = 'Friedensbotschaft';
            }

            applyLibraryFilters();
        });
    });

    // Format Chips Leiste
    const formatChips = document.querySelectorAll('.format-chip-btn');
    formatChips.forEach(btn => {
        btn.addEventListener('click', () => {
            formatChips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.library.format = btn.dataset.fmt || 'all';
            applyLibraryFilters();
        });
    });

    // View Mode Toggle (Grid vs. List)
    const viewGridBtn = document.getElementById('view-mode-grid');
    const viewListBtn = document.getElementById('view-mode-list');
    const resultsGrid = document.getElementById('library-results');

    function applyViewMode(mode) {
        state.library.viewMode = mode;
        safeSetStorage('cosmos_library_view_mode', mode);

        if (viewGridBtn) viewGridBtn.classList.toggle('active', mode === 'grid');
        if (viewListBtn) viewListBtn.classList.toggle('active', mode === 'list');
        if (resultsGrid) resultsGrid.classList.toggle('list-view', mode === 'list');
    }

    if (viewGridBtn) viewGridBtn.addEventListener('click', () => applyViewMode('grid'));
    if (viewListBtn) viewListBtn.addEventListener('click', () => applyViewMode('list'));
    applyViewMode(state.library.viewMode || 'grid');

    // Search Input & Clear Button
    const searchInput = document.getElementById('library-search-input');
    const searchClearBtn = document.getElementById('library-search-clear');

    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (searchClearBtn) {
                searchClearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
            }
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.library.query = val.toLowerCase();
                applyLibraryFilters();
            }, 200);
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

            if (recipSelect) recipSelect.value = 'all';
            if (epochSelect) epochSelect.value = '';
            if (typeSelect) typeSelect.value = '';
            if (langSelect) langSelect.value = '';
            if (sortSelect) sortSelect.value = 'date-desc';
            if (searchInput) searchInput.value = '';
            if (searchClearBtn) searchClearBtn.style.display = 'none';

            // Reset quick chips to 'all'
            quickChips.forEach(b => {
                b.classList.toggle('active', b.dataset.chip === 'all');
            });
            
            authorChips.forEach(b => {
                b.classList.toggle('active', b.dataset.author === 'all');
            });

            const compChips = document.querySelectorAll('#library-comp-chips .comp-chip-btn');
            compChips.forEach(b => {
                b.classList.toggle('active', b.dataset.comp === 'all');
            });

            const ruhiChips = document.querySelectorAll('#library-ruhi-chips .ruhi-chip-btn');
            ruhiChips.forEach(b => {
                b.classList.toggle('active', b.dataset.ruhi === 'all');
            });

            formatChips.forEach(b => {
                b.classList.toggle('active', b.dataset.fmt === 'all');
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
    applyLibraryFilters();
}

function updateLibrarySegmentBadges() {
    if (!state.documents || !state.documents.length) return;
    const allCount = state.documents.length;
    const houseCount = state.documents.filter(d => d.tier === 'house' || d.tier === 'institutions').length;
    const booksCount = state.documents.filter(d => d.tier === 'books').length;
    const compsCount = state.documents.filter(d => d.tier === 'compilations').length;
    const ruhiCount = state.documents.filter(d => d.tier === 'ruhi').length;

    const setBadge = (seg, count) => {
        const badge = document.querySelector(`#library-segment-bar .segment-btn[data-segment="${seg}"] .segment-badge`);
        if (badge) badge.textContent = count >= 1000 ? count.toLocaleString('de-DE') : count;
    };

    setBadge('all', allCount);
    setBadge('house', houseCount);
    setBadge('books', booksCount);
    setBadge('compilations', compsCount);
    setBadge('ruhi', ruhiCount);
}

function syncQuickChipsWithFilters() {
    const { recipient, type } = state.library;
    const quickChips = document.querySelectorAll('.quick-chip-btn');
    quickChips.forEach(b => {
        const c = b.dataset.chip;
        let match = false;
        if (c === 'ridvan' && type === 'Riḍván-Botschaft') match = true;
        else if (c === 'world' && recipient === 'world') match = true;
        else if (c === 'counsellors' && recipient === 'counsellors') match = true;
        else if (c === 'youth' && recipient === 'youth') match = true;
        else if (c === 'iran' && recipient === 'iran') match = true;
        else if (c === 'peace' && type === 'Friedensbotschaft') match = true;
        else if (c === 'all' && recipient === 'all' && !type) match = true;

        b.classList.toggle('active', match);
    });
}

function applyLibraryFilters() {
    let list = state.documents;
    const { segment, author, compTopic, ruhiGroup, recipient, epoch, type, lang, format, sort, query } = state.library;

    // 0. Segment-Filter
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

    // 0b. Autoren-Filter (für Bücher)
    if (segment === 'books' && author && author !== 'all') {
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
    if (segment === 'compilations' && compTopic && compTopic !== 'all') {
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
    if (segment === 'ruhi' && ruhiGroup && ruhiGroup !== 'all') {
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

    // 6. Text-Suche
    if (query) {
        list = list.filter(d => {
            const title = (d.title || '').toLowerCase();
            const author = (d.author || '').toLowerCase();
            const text = (d.text || '').substring(0, 500).toLowerCase();
            const excerpt = (d.excerpt || '').toLowerCase();
            const topics = (d.topics || []).join(' ').toLowerCase();
            const rec = (d.recipientLabel || '').toLowerCase();
            return title.includes(query) || author.includes(query) || text.includes(query) || excerpt.includes(query) || topics.includes(query) || rec.includes(query);
        });
    }

    // 7. Sortierung
    if (sort === 'date-desc') {
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sort === 'date-asc') {
        list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sort === 'title') {
        list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
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
        if (lang && lang.toLowerCase() === 'english') {
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

        const unifiedDoc = Object.assign({}, primaryDoc, {
            formatFiles: mergedFiles,
            availableFormats: Array.from(mergedFormats),
            siblingCount: docsInGroup.length
        });

        unifiedList.push(unifiedDoc);
    });

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
    const countNumEl = document.getElementById('library-count-num');
    if (countNumEl) countNumEl.textContent = list.length.toLocaleString('de-DE');

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
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Keine Werke oder Dokumente gefunden, die den gewählten Kriterien entsprechen.</p>';
        }
        updateLibraryLoadMore();
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
        html += window.createDocCard(doc, '', idx);
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
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${(deWord || dePdf) ? `
                            <div style="display: flex; align-items: center; gap: 0.2rem;">
                                <span style="font-size: 0.68rem; font-weight: bold; color: var(--text-subtle);">DE:</span>
                                ${deWord ? `<a href="${deWord.filePath}" target="_blank" onclick="event.stopPropagation();" class="format-chip" style="text-decoration:none;" title="Deutsch DOCX">DOCX</a>` : ''}
                                ${dePdf ? `<a href="${dePdf.filePath}" target="_blank" onclick="event.stopPropagation();" class="format-chip" style="text-decoration:none;" title="Deutsch PDF">PDF</a>` : ''}
                            </div>` : ''}
                            ${(enWord || enPdf) ? `
                            <div style="display: flex; align-items: center; gap: 0.2rem;">
                                <span style="font-size: 0.68rem; font-weight: bold; color: var(--text-subtle);">EN:</span>
                                ${enWord ? `<a href="${enWord.filePath}" target="_blank" onclick="event.stopPropagation();" class="format-chip" style="text-decoration:none;" title="Englisch DOCX">DOCX</a>` : ''}
                                ${enPdf ? `<a href="${enPdf.filePath}" target="_blank" onclick="event.stopPropagation();" class="format-chip" style="text-decoration:none;" title="Englisch PDF">PDF</a>` : ''}
                            </div>` : ''}
                        </div>
                    </div>
                    <h3 class="doc-title">${escapeDocHtml(key)}${enSubtitle ? ` (${escapeDocHtml(enSubtitle)})` : ''}</h3>
                    <p class="doc-excerpt">${escapeDocHtml(excerpt)}…</p>
                </div>
                <div class="doc-footer">
                    <div class="doc-tags">
                        ${(mainDoc.topics || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                    ${wordsLabel ? `<span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-subtle);">${wordsLabel}</span>` : ''}
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

window.switchSavedTab = function(tab) {
    state.savedTab = tab;
    const pillBookmarks = document.getElementById('pill-saved-bookmarks');
    const pillCompilations = document.getElementById('pill-saved-compilations');
    const paneBookmarks = document.getElementById('saved-pane-bookmarks');
    const paneCompilations = document.getElementById('saved-pane-compilations');

    if (tab === 'bookmarks') {
        pillBookmarks?.classList.add('active');
        pillCompilations?.classList.remove('active');
        if (paneBookmarks) paneBookmarks.style.display = 'block';
        if (paneCompilations) paneCompilations.style.display = 'none';
        renderBookmarks();
    } else {
        pillBookmarks?.classList.remove('active');
        pillCompilations?.classList.add('active');
        if (paneBookmarks) paneBookmarks.style.display = 'none';
        if (paneCompilations) paneCompilations.style.display = 'block';
        renderSavedCompilationsList();
    }
};

function renderSavedView() {
    // Update counts
    const countBookmarks = document.getElementById('saved-bookmarks-count');
    const countComps = document.getElementById('saved-compilations-count');
    
    if (countBookmarks) countBookmarks.textContent = state.bookmarks.length;
    
    let compList = [];
    try {
        compList = JSON.parse(safeGetStorage('my_compilations', '[]'));
    } catch (e) {}
    if (countComps) countComps.textContent = compList.length;

    window.switchSavedTab(state.savedTab || 'bookmarks');
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
                <div style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: 600; color: var(--color-accent); margin-bottom: 0.5rem; text-transform: uppercase;">Keine Manuskripte</div>
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
    const langLabel = isEn ? 'EN' : 'DE';
    const hasBoth = doc.availableLanguages && doc.availableLanguages.includes('de') && doc.availableLanguages.includes('en');
    
    // Meta breadcrumb line
    const metaParts = [];
    if (doc.tier === 'books' && doc.year) {
        metaParts.push(`<span class="doc-date">${doc.year}</span>`);
    } else if (doc.date) {
        metaParts.push(`<span class="doc-date">${formatDate(doc.date)}</span>`);
    }
    
    // Origin / Category
    let categoryLabel = '';
    if (doc.tier === 'books') {
        categoryLabel = doc.author || 'Heilige Schrift';
    } else if (doc.type && doc.type !== 'Botschaft') {
        categoryLabel = doc.type.replace('-Botschaft', '');
    } else if (doc.recipientLabel) {
        let rec = doc.recipientLabel;
        if (rec === "Weltweite Bahá'í-Gemeinde") rec = "Weltweite Gemeinde";
        if (rec === "Kontinentale Berater & Hilfsamt") rec = "Berater";
        categoryLabel = rec;
    } else {
        categoryLabel = 'Botschaft';
    }
    metaParts.push(`<span class="doc-origin-tag">${escapeDocHtml(categoryLabel)}</span>`);

    if (hasBoth) {
        const deId = doc.translations && doc.translations.de ? doc.translations.de : doc.id;
        const enId = doc.translations && doc.translations.en ? doc.translations.en : doc.id;
        metaParts.push(`
            <div class="card-lang-toggle" onclick="event.stopPropagation()">
                <button class="card-lang-btn ${!isEn ? 'active' : ''}" onclick="window.openDocument('${deId}', null, null, 'de')" title="Auf Deutsch öffnen">DE</button>
                <button class="card-lang-btn ${isEn ? 'active' : ''}" onclick="window.openDocument('${enId}', null, null, 'en')" title="Open in English">EN</button>
            </div>
        `);
    } else {
        metaParts.push(`<span class="doc-lang-tag ${langLabel.toLowerCase()}">${langLabel}</span>`);
    }

    if (doc.keyPassagesCount > 0) {
        metaParts.push(`<span class="doc-passages-tag" title="${doc.keyPassagesCount} thematische Kernabsätze">${doc.keyPassagesCount} Abs.</span>`);
    }

    const staggerIndex = typeof index === 'number' ? (index % 30) : 0;
    const previewText = snippet ? `…${snippet}…` : (doc.excerpt ? `${escapeDocHtml(doc.excerpt)}…` : '');

    // Subtitle if bilingual and English/German title differs
    let subTitleHtml = '';
    if (hasBoth) {
        const otherTitle = isEn ? doc.deTitle : doc.enTitle;
        if (otherTitle && otherTitle !== doc.title) {
            subTitleHtml = `<div class="doc-sub-title">${isEn ? 'DE' : 'EN'}: ${escapeDocHtml(otherTitle)}</div>`;
        }
    }

    // Formate als zusammenhängende, typografische Download-Leiste
    const fmts = doc.availableFormats || ['pdf', 'docx', 'epub', 'txt'];
    const files = doc.formatFiles || {};
    
    let formatLinks = [];
    ['pdf', 'docx', 'epub', 'txt'].forEach(fmt => {
        if (fmts.includes(fmt) || files[fmt]) {
            const path = files[fmt] || (doc.format === fmt ? doc.filePath : '');
            if (path) {
                formatLinks.push(`<a href="${encodeURI(path)}" download class="doc-fmt-link" onclick="event.stopPropagation()" title="Als ${fmt.toUpperCase()} herunterladen">${fmt.toUpperCase()}</a>`);
            }
        }
    });

    let sourceLink = '';
    if (doc.sourceUrl) {
        sourceLink = `
            <a href="${escapeDocHtml(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="doc-source-btn" onclick="event.stopPropagation()" title="Originalquelle im Web öffnen (${escapeDocHtml(doc.sourcePlatform || doc.source || 'Offizielle Quelle')})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
        `;
    }

    // Dezent kuratierte Themen (max 1–2)
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

    return `
        <article class="doc-card" style="--i: ${staggerIndex};" onclick="window.openDocument('${doc.id}')">
            <div class="doc-card-body">
                <div class="doc-meta-editorial">
                    ${metaParts.join('<span class="meta-dot">•</span>')}
                </div>
                <h3 class="doc-title">${escapeDocHtml(doc.title)}</h3>
                ${subTitleHtml}
                ${previewText ? `<p class="doc-excerpt">${previewText}</p>` : ''}
            </div>
            <div class="doc-card-footer">
                <div class="doc-topics-cluster">
                    ${topicsHtml}
                </div>
                <div class="doc-actions-cluster" onclick="event.stopPropagation()">
                    <div class="doc-formats-strip">
                        ${formatLinks.join('<span class="fmt-sep">·</span>')}
                    </div>
                    ${sourceLink}
                </div>
            </div>
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
