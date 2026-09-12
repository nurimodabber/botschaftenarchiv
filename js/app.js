/**
 * app.js
 * Haupt-Controller fuer Bibliothek, Filterung, Routing und Volltextsuche.
 */
(function() {
    const state = window.state;
    const safeGetStorage = window.safeGetStorage;
    const safeSetStorage = window.safeSetStorage;

// State & Storage Helpers aus modularer state.js
const APP_PAGE_SIZE = 30;


// Initialize Application
async function initApp() {
    setupAppearance();
    setupNavigation();
    setupKeyboardShortcuts();

    // Ensure pristine filter state on application start (guarantees NO sticky filters on launch)
    if (state.library) {
        state.library.segment = 'all';
        state.library.lang = '';
        state.library.query = '';
        state.library.recipient = 'all';
        state.library.epoch = '';
        state.library.type = '';
        state.library.author = 'all';
        state.library.compTopic = 'all';
        state.library.ruhiGroup = 'all';
        state.library.format = 'all';
        state.library.sort = 'date-desc';
        state.library.timelineEpoch = '';
    }
    
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

        // Dokumente mit Meilenstein-Informationen anreichern (falls Timeline-Modul geladen)
        if (typeof window.getMilestoneInfo === 'function' && Array.isArray(state.documents)) {
            state.documents.forEach(doc => {
                const ms = window.getMilestoneInfo(doc);
                if (ms) {
                    doc._isMilestone = true;
                    doc.milestoneReasonDe = ms.reasonDe;
                    doc.milestoneReasonEn = ms.reasonEn;
                }
            });
        }

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
// ─── Ausgelagerte Module: Settings, Filters & Snippets ──────────────────
function setupAppearance() {
    if (window.SettingsModule && typeof window.SettingsModule.setupAppearance === 'function') {
        window.SettingsModule.setupAppearance();
    }
}
function updateDrawerFilterOptions(seg) {
    if (window.FiltersModule && typeof window.FiltersModule.updateDrawerFilterOptions === 'function') {
        window.FiltersModule.updateDrawerFilterOptions(seg);
    }
}


// Navigation & View Switching
window.switchLibrarySegment = function(segment) {
    if (!state.library) return;
    state.library.segment = segment;
    
    // 0. Thema der gesamten Seite dem aktiven Realm anpassen
    if (segment === 'all') {
        document.documentElement.removeAttribute('data-active-pillar');
    } else {
        document.documentElement.setAttribute('data-active-pillar', segment);
    }

    // 1. Segment-Pills der Hauptleiste aktualisieren
    const segPills = document.querySelectorAll('#library-segmented-bar .seg-pill');
    segPills.forEach(pill => {
        const isActive = (pill.dataset.pillar === segment);
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Aktiven Pill sanft ins Sichtfeld scrollen (für Mobilgeräte mit horizontalem Scroll)
    const activePill = document.querySelector(`#library-segmented-bar .seg-pill[data-pillar="${segment}"]`);
    if (activePill && typeof activePill.scrollIntoView === 'function') {
        try {
            activePill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } catch (e) {}
    }

    // 2. Progressive Disclosure Sub-Filter (Autoren, Themen, Kurse) rendern
    renderSubfilters(segment);

    // 3. Dynamisches Realm-Banner oben aktualisieren
    const realmTitle = document.getElementById('realm-lead-title');
    const realmSub = document.getElementById('realm-lead-subtitle');
    if (realmTitle && realmSub) {
        if (segment === 'house') {
            realmTitle.setAttribute('data-i18n', 'library.realm_house');
            realmSub.setAttribute('data-i18n', 'library.realm_house_sub');
            realmTitle.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.realm_house') : 'Botschaften des Hauses';
            realmSub.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.realm_house_sub') : 'Botschaften des Universalen Hauses der Gerechtigkeit (1963–2026)';
        } else if (segment === 'compilations') {
            realmTitle.setAttribute('data-i18n', 'pillar.comp_title');
            realmSub.setAttribute('data-i18n', 'pillar.comp_sub');
            realmTitle.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.comp_title') : 'Compilations des Hauses';
            realmSub.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.comp_sub') : 'Autorisierte thematische Sammlungen der Forschungsabteilung';
        } else if (segment === 'books') {
            realmTitle.setAttribute('data-i18n', 'pillar.books_title');
            realmSub.setAttribute('data-i18n', 'pillar.books_sub');
            realmTitle.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.books_title') : 'Heilige Schriften & Bücher';
            realmSub.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.books_sub') : 'Autorisierte Schriften der Zentralen Gestalten & Shoghi Effendis';
        } else if (segment === 'ruhi') {
            realmTitle.setAttribute('data-i18n', 'pillar.ruhi_title');
            realmSub.setAttribute('data-i18n', 'pillar.ruhi_sub');
            realmTitle.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.ruhi_title') : 'Ruhi-Bücher';
            realmSub.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('pillar.ruhi_sub') : 'Studienmaterialien des Ruhi-Instituts (Hauptkurse & Zweigkurse)';
        } else {
            realmTitle.setAttribute('data-i18n', 'library.realm_all');
            realmSub.setAttribute('data-i18n', 'library.realm_all_sub');
            realmTitle.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.realm_all') : 'Gesamtes Archiv';
            realmSub.textContent = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.realm_all_sub') : 'Dokumente, Schriften, Bücher und thematische Sammlungen';
        }
    }

    // 4. Platzhalter der Master-Suchleiste anpassen
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
        if (segment === 'house') {
            searchInput.setAttribute('data-i18n-placeholder', 'library.search_placeholder');
            searchInput.placeholder = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.search_placeholder') : 'In Botschaften des Hauses (1963–2026) suchen...';
        } else if (segment === 'compilations') {
            searchInput.setAttribute('data-i18n-placeholder', 'library.search_placeholder_comp');
            searchInput.placeholder = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.search_placeholder_comp') : 'In thematischen Compilations & Sammlungen suchen...';
        } else if (segment === 'books') {
            searchInput.setAttribute('data-i18n-placeholder', 'library.search_placeholder_books');
            searchInput.placeholder = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.search_placeholder_books') : 'In Heiligen Schriften & Standardwerken suchen...';
        } else if (segment === 'ruhi') {
            searchInput.setAttribute('data-i18n-placeholder', 'library.search_placeholder_ruhi');
            searchInput.placeholder = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.search_placeholder_ruhi') : 'In Ruhi-Büchern & Kursmaterialien suchen...';
        } else {
            searchInput.setAttribute('data-i18n-placeholder', 'library.search_placeholder_all');
            searchInput.placeholder = (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t('library.search_placeholder_all') : 'In allen Dokumenten, Schriften & Volltexten suchen...';
        }
    }

    // 5. Kontextuelle Filteroptionen im Detail-Drawer aktualisieren
    updateDrawerFilterOptions(segment);

    // 6. Filter anwenden & Ergebnisse rendern
    if (typeof applyLibraryFilters === 'function') {
        applyLibraryFilters();
    }
};

function renderSubfilters(segment) {
    const container = document.getElementById('pillar-subfilters-container');
    if (!container) return;

    if (segment === 'books') {
        const cur = state.library.author || 'all';
        const items = [
            { id: 'all', label: 'Alle Autoren' },
            { id: 'bahaullah', label: "Bahá'u'lláh" },
            { id: 'the-bab', label: 'Der Báb' },
            { id: 'abdul-baha', label: "‘Abdu’l-Bahá" },
            { id: 'shoghi-effendi', label: 'Shoghi Effendi' }
        ];
        container.innerHTML = `
            <div class="subfilter-chips-scroll" role="group" aria-label="Autorinnen & Autoren">
                <span class="subfilter-lead-label">Autoren:</span>
                ${items.map(it => `
                    <button type="button" class="subfilter-chip ${cur === it.id ? 'active' : ''}" data-key="author" data-val="${it.id}">
                        ${it.label}
                    </button>
                `).join('')}
            </div>
        `;
        container.hidden = false;
    } else if (segment === 'compilations') {
        const cur = state.library.compTopic || 'all';
        const items = [
            { id: 'all', label: 'Alle Themen' },
            { id: 'prayer', label: 'Gebet & Andacht' },
            { id: 'marriage', label: 'Ehe & Familie' },
            { id: 'huquq', label: 'Ḥuqúqu’lláh' },
            { id: 'consultation', label: 'Beratung' },
            { id: 'virtues', label: 'Tugenden' },
            { id: 'women', label: 'Frauen' }
        ];
        container.innerHTML = `
            <div class="subfilter-chips-scroll" role="group" aria-label="Kompilationsthemen">
                <span class="subfilter-lead-label">Themen:</span>
                ${items.map(it => `
                    <button type="button" class="subfilter-chip ${cur === it.id ? 'active' : ''}" data-key="compTopic" data-val="${it.id}">
                        ${it.label}
                    </button>
                `).join('')}
            </div>
        `;
        container.hidden = false;
    } else if (segment === 'ruhi') {
        const cur = state.library.ruhiGroup || 'all';
        const items = [
            { id: 'all', label: 'Alle Bände' },
            { id: 'b1-4', label: 'Bücher 1–4' },
            { id: 'b5-8', label: 'Bücher 5–8' },
            { id: 'b9plus', label: 'Bücher 9–14' },
            { id: 'branch', label: 'Zweigkurse' }
        ];
        container.innerHTML = `
            <div class="subfilter-chips-scroll" role="group" aria-label="Ruhi-Institut Bände">
                <span class="subfilter-lead-label">Kurse:</span>
                ${items.map(it => `
                    <button type="button" class="subfilter-chip ${cur === it.id ? 'active' : ''}" data-key="ruhiGroup" data-val="${it.id}">
                        ${it.label}
                    </button>
                `).join('')}
            </div>
        `;
        container.hidden = false;
    } else if (segment === 'house') {
        const cur = state.library.recipient || 'all';
        const items = [
            { id: 'all', label: 'Alle Botschaften' },
            { id: 'all-believers', label: 'Weltweite Gemeinde' },
            { id: 'counsellors', label: 'Beraterkonferenz' },
            { id: 'nsa', label: 'Geistige Räte (NSAs)' }
        ];
        container.innerHTML = `
            <div class="subfilter-chips-scroll" role="group" aria-label="Empfängerkreis">
                <span class="subfilter-lead-label">Anlass:</span>
                ${items.map(it => `
                    <button type="button" class="subfilter-chip ${cur === it.id ? 'active' : ''}" data-key="recipient" data-val="${it.id}">
                        ${it.label}
                    </button>
                `).join('')}
            </div>
        `;
        container.hidden = false;
    } else {
        container.hidden = true;
        container.innerHTML = '';
    }

    container.querySelectorAll('.subfilter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            const val = btn.dataset.val;
            if (key && val) {
                state.library[key] = val;
                const recipSelect = document.getElementById('library-recipient-select');
                if (recipSelect) recipSelect.value = val;
                renderSubfilters(segment);
                applyLibraryFilters();
            }
        });
    });
}

window.switchView = function(targetView) {
    // Redirection shortcuts to keep interface unified
    if (targetView === 'books') {
        window.switchView('library');
        window.switchLibrarySegment('books');
        return;
    }
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
        let resolvedId = docId;
        if (state.idAliases && state.idAliases[docId]) {
            resolvedId = state.idAliases[docId];
        }
        const exists = state.documents && state.documents.some(d => d.id === resolvedId || d.id === docId);
        if (exists) {
            window.openDocument(resolvedId, pInt);
        } else if (state.documents && state.documents.length > 0) {
            // Fallback: decode URI component if URL-encoded
            try {
                const dec = decodeURIComponent(docId);
                const decResolved = (state.idAliases && state.idAliases[dec]) ? state.idAliases[dec] : dec;
                if (state.documents.some(d => d.id === decResolved || d.id === dec)) {
                    window.openDocument(decResolved, pInt);
                }
            } catch (e) {}
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
    // 1. Die Hauptbereichs-Segmentleiste (Segmented Bar) mit Toggle-Funktion
    const segPills = document.querySelectorAll('#library-segmented-bar .seg-pill');
    segPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const pillar = pill.dataset.pillar;
            if (state.library && state.library.segment === pillar && pillar !== 'all') {
                window.switchLibrarySegment('all');
            } else {
                window.switchLibrarySegment(pillar);
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
            const seg = state.library.segment || 'all';
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
            const seg = state.library.segment || 'all';
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
    const suggestionsBox = document.getElementById('search-suggestions-dropdown');

    // Helper: Dropdown für Suchvorschläge aktualisieren
    function updateSearchSuggestions(val) {
        if (!suggestionsBox) return;
        if (!val || val.trim().length < 2 || !window.SearchEngine || !state.documents) {
            suggestionsBox.hidden = true;
            suggestionsBox.innerHTML = '';
            return;
        }

        const suggestions = window.SearchEngine.suggest(val, state.documents, 6);
        if (suggestions.length === 0) {
            suggestionsBox.hidden = true;
            suggestionsBox.innerHTML = '';
            return;
        }

        const isEn = window.I18n && window.I18n.getCurrentLanguage() === 'en';
        suggestionsBox.innerHTML = suggestions.map((s, idx) => {
            let badgeText = isEn ? 'Message' : 'Botschaft';
            if (s.tier === 'books') badgeText = isEn ? 'Book' : 'Buch';
            else if (s.tier === 'compilations') badgeText = isEn ? 'Compilation' : 'Kompilation';
            else if (s.tier === 'ruhi') badgeText = isEn ? 'Ruhi' : 'Ruhi';

            return `
                <div class="search-suggestion-item" data-id="${s.id}" data-idx="${idx}" role="option">
                    <div class="suggestion-main">
                        <span class="suggestion-title">${escapeDocHtml(s.title)}</span>
                        ${s.sub ? `<span class="suggestion-sub">${escapeDocHtml(s.sub)}</span>` : ''}
                    </div>
                    <span class="suggestion-badge">${badgeText}</span>
                </div>
            `;
        }).join('');

        suggestionsBox.hidden = false;

        // Klick auf Vorschlag öffnet das Dokument direkt im Reader
        suggestionsBox.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const docId = item.dataset.id;
                suggestionsBox.hidden = true;
                if (docId && window.openDocument) {
                    window.openDocument(docId);
                }
            });
        });
    }

    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('focus', () => {
            if (!window._fullTextLoaded && !window._fullTextLoading && typeof window.loadFullTextSearchIndex === 'function') {
                window.loadFullTextSearchIndex();
            }
            if (searchInput.value.trim().length >= 2) {
                updateSearchSuggestions(searchInput.value.trim());
            }
        });

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (searchClearBtn) {
                searchClearBtn.style.display = val.length > 0 ? 'inline-flex' : 'none';
            }
            updateSearchSuggestions(val);
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.library.query = val;
                applyLibraryFilters();
            }, 180);
        });

        // Schließen bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (suggestionsBox && !suggestionsBox.hidden && !searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.hidden = true;
            }
        });

        // Tastaturnavigation in den Vorschlägen (Pfeil runter / Pfeil hoch / Enter)
        searchInput.addEventListener('keydown', (e) => {
            if (!suggestionsBox || suggestionsBox.hidden) return;
            const items = suggestionsBox.querySelectorAll('.search-suggestion-item');
            if (items.length === 0) return;

            let selected = suggestionsBox.querySelector('.search-suggestion-item.selected');
            let idx = selected ? parseInt(selected.dataset.idx, 10) : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                idx = (idx + 1) % items.length;
                items.forEach(it => it.classList.remove('selected'));
                items[idx].classList.add('selected');
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                idx = (idx - 1 + items.length) % items.length;
                items.forEach(it => it.classList.remove('selected'));
                items[idx].classList.add('selected');
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (selected) {
                    e.preventDefault();
                    selected.click();
                } else {
                    suggestionsBox.hidden = true;
                }
            } else if (e.key === 'Escape') {
                suggestionsBox.hidden = true;
            }
        });
    }

    if (searchClearBtn && searchInput) {
        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            if (suggestionsBox) suggestionsBox.hidden = true;
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

    // Reset Filters & Individual Tag Clear
    window.resetAllLibraryFilters = function() {
        state.library.recipient = 'all';
        state.library.epoch = '';
        state.library.type = '';
        state.library.segment = 'all';
        state.library.lang = '';
        state.library.format = 'all';
        state.library.query = '';
        state.library.author = 'all';
        state.library.compTopic = 'all';
        state.library.ruhiGroup = 'all';
        state.library.sort = 'date-desc';
        state.library.timelineEpoch = '';
        state.library.searchPillarFilter = null;

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

        renderSubfilters(state.library.segment);
        applyLibraryFilters();
    };

    window.removeFilterByKey = function(key) {
        if (key === 'query') {
            state.library.query = '';
            if (searchInput) searchInput.value = '';
            if (searchClearBtn) searchClearBtn.style.display = 'none';
        } else if (key === 'recipient') {
            state.library.recipient = 'all';
            const recipSelect = document.getElementById('library-recipient-select');
            if (recipSelect) recipSelect.value = 'all';
        } else if (key === 'epoch') {
            state.library.epoch = '';
            const epochSelect = document.getElementById('library-epoch-select');
            if (epochSelect) epochSelect.value = '';
        } else if (key === 'type') {
            state.library.type = '';
            const typeSelect = document.getElementById('library-type-select');
            if (typeSelect) typeSelect.value = '';
        } else if (key === 'lang') {
            state.library.lang = '';
        } else if (key === 'format') {
            state.library.format = 'all';
            document.querySelectorAll('.format-chip-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.fmt === 'all');
            });
        } else if (key === 'author') {
            state.library.author = 'all';
            const recipSelect = document.getElementById('library-recipient-select');
            if (recipSelect && state.library.segment === 'books') recipSelect.value = 'all';
        } else if (key === 'compTopic') {
            state.library.compTopic = 'all';
            const recipSelect = document.getElementById('library-recipient-select');
            if (recipSelect && state.library.segment === 'compilations') recipSelect.value = 'all';
        } else if (key === 'ruhiGroup') {
            state.library.ruhiGroup = 'all';
            const recipSelect = document.getElementById('library-recipient-select');
            if (recipSelect && state.library.segment === 'ruhi') recipSelect.value = 'all';
        } else if (key === 'timelineEpoch') {
            state.library.timelineEpoch = '';
            const epochSelect = document.getElementById('library-epoch-select');
            if (epochSelect && state.library.segment === 'books') epochSelect.value = '';
            document.querySelectorAll('.inline-epoch-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.epochFilter === 'all');
            });
        }
        renderSubfilters(state.library.segment);
        applyLibraryFilters();
    };

    const resetBtn = document.getElementById('library-reset-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.resetAllLibraryFilters();
        });
    }

    // Robuste Event-Delegation fuer alle Dokumentenkarten
    const resultsContainer = document.getElementById('library-results');
    if (resultsContainer) {
        resultsContainer.addEventListener('click', (e) => {
            // Ignoriere Klicks auf interaktive Kind-Elemente falls vorhanden
            if (e.target.closest('button, a, input, select')) return;
            const card = e.target.closest('.doc-card');
            if (card && card.dataset.docId && typeof window.openDocument === 'function') {
                window.openDocument(card.dataset.docId);
            }
        });
    }

    // Mehr Botschaften anzeigen Button
    const loadMoreBtn = document.getElementById('library-load-more-btn');
    if (loadMoreBtn && !loadMoreBtn._hasLoadMoreListener) {
        loadMoreBtn._hasLoadMoreListener = true;
        loadMoreBtn.addEventListener('click', () => {
            renderMoreLibraryResults();
        });
    }

    updateLibrarySegmentBadges();
    window.switchLibrarySegment(state.library.segment || 'all');
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

// Such-Snippets, Regex-Helfer & getDocumentSearchBundle wurden ausgelagert nach js/filters.js
function extractSearchSnippet(...args) {
    return (window.FiltersModule && typeof window.FiltersModule.extractSearchSnippet === 'function') ? window.FiltersModule.extractSearchSnippet(...args) : "";
}
function getDocumentSearchBundle(...args) {
    return (window.FiltersModule && typeof window.FiltersModule.getDocumentSearchBundle === 'function') ? window.FiltersModule.getDocumentSearchBundle(...args) : "";
}

function getPlanDocumentPriority(doc, activeEpoch) {
    if (!doc) return 99;
    const date = doc.date || '';
    const type = doc.type || '';

    // 1. Neunjahresplan (2022–2031)
    if (activeEpoch === 'nine-year') {
        // Rang 1: Die beiden monumentalen Rahmenbotschaften an die Konferenz der Kontinentalen Beraterräte
        if (date === '2025-12-31') return 1; // Halbzeit-Charta / Strategischer Rahmen Phase 2 (bis 2031)
        if (date === '2021-12-30') return 1; // Grundlegende Charta des Neunjahresplans (Auftakt der 25-Jahres-Reihe)
        // Rang 2: Die weltweiten Umsetzungs- und Mobilisierungsschreiben an alle NSAs
        if (date === '2026-01-04') return 2; // Umsetzungsschreiben Halbzeit Neunjahresplan
        if (date === '2022-01-04') return 2; // Begleitschreiben zu weltweiten Konferenzen & Planstart
        // Rang 3: Auftakt-Riḍván-Botschaft
        if (date.startsWith('2022-04') && type.includes('Riḍván')) return 3; // Offizieller Planstart Riḍván 2022
        // Rang 4: Historische Jahrhundert-Erklärung
        if (date === '2023-11-28') return 4; // 100 Jahre Formative Epoche & Schrein 'Abdu'l-Bahás
        // Rang 5: Jährliche Riḍván-Botschaften
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // 2. Einjahresplan (2021–2022)
    if (activeEpoch === 'one-year') {
        if (date.startsWith('2021-04') && type.includes('Riḍván')) return 1; // Auftakt-Riḍván 2021
        if (date === '2021-11-27') return 2; // 100. Jahrestag des Hinscheidens 'Abdu'l-Bahás
        if (type.includes('Riḍván')) return 3;
        return 10;
    }

    // 3. Fünfjahresplan (2016–2021)
    if (activeEpoch === 'five-year-16') {
        if (date === '2015-12-29') return 1; // Charta an die Beraterkonferenz
        if (date === '2016-01-02') return 2; // Schreiben an die Bahá'í der Welt
        if (date.startsWith('2016-04') && type.includes('Riḍván')) return 3; // Auftakt-Riḍván
        if (date === '2017-10-31' || date === '2019-10-24') return 4; // Zweihundertjahrfeiern
        if (date === '2020-11-25') return 4; // 100. Jahrestag Tag des Bündnisses
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // 4. Fünfjahresplan (2011–2016)
    if (activeEpoch === 'five-year-11') {
        if (date === '2010-12-28') return 1; // Charta an die Beraterkonferenz
        if (date === '2011-01-04') return 2; // Begleitschreiben an alle NSAs
        if (date.startsWith('2011-04') && type.includes('Riḍván')) return 3; // Auftakt-Riḍván
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // 5. Fünfjahresplan (2006–2011)
    if (activeEpoch === 'five-year-06') {
        if (date === '2005-12-27') return 1; // Charta an die Beraterkonferenz
        if (date === '2005-12-28') return 2; // Begleitschreiben an alle NSAs
        if (date.startsWith('2006-04') && type.includes('Riḍván')) return 3; // Auftakt-Riḍván
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // 6. Fünfjahresplan (2001–2006)
    if (activeEpoch === 'five-year-01' || activeEpoch === 'plans-00') {
        if (date === '2001-01-09') return 1; // Charta an die Beraterkonferenz (Cluster-System)
        if (date.startsWith('2001-04') && type.includes('Riḍván')) return 2; // Auftakt-Riḍván
        if (date === '2001-05-24') return 3; // Einweihung der Terrassen auf dem Berg Karmel
        if (date.startsWith('2002-04')) return 3; // Botschaft an die Religionsführer der Welt
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // 7. Vierjahresplan (1996–2000)
    if (activeEpoch === 'four-year-96') {
        if (date === '1995-12-26') return 1; // Charta an die Beraterkonferenz (Grundsteinlegung Institute)
        if (date === '1995-12-31') return 2; // Begleitschreiben an alle NSAs
        if (date.startsWith('1996-04') && type.includes('Riḍván')) return 3; // Auftakt-Riḍván
        if (type.includes('Riḍván')) return 5;
        return 10;
    }

    // Generisch fuer alle Plaene: Riḍván-Botschaften priorisieren
    if (activeEpoch && type.includes('Riḍván')) return 5;

    return 10;
}

window.applyLibraryFilters = applyLibraryFilters;
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

    // 2. Epochen- & Plan-Filter
    if (epoch) {
        if (epoch === 'nine-year') {
            // Neunjahresplan (2022–2031): inkl. Charta an die Berater vom 30. Dez 2021 & 4. Jan 2022
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2022 && y <= 2031) || dt === '2021-12-30';
            });
        } else if (epoch === 'one-year') {
            // Einjahresplan (2021–2022): Riḍván 2021 bis vor Riḍván 2022 (ohne 30.12.2021 Charta des Neunjahresplans)
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                if (dt === '2021-12-30' || dt === '2022-01-04') return false;
                return (dt >= '2021-04-21' && dt < '2022-04-21') || (y === 2021 && dt !== '2021-12-30');
            });
        } else if (epoch === 'five-year-16') {
            // Fünfjahresplan 2016–2021: inkl. Rahmenbotschaft vom 29. Dez 2015 bis Riḍván 2021
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2016 && y <= 2020) || (y === 2021 && dt < '2021-04-21') || dt === '2015-12-29';
            });
        } else if (epoch === 'five-year-11') {
            // Fünfjahresplan 2011–2016: inkl. Rahmenbotschaft vom 28. Dez 2010 bis Riḍván 2016
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2011 && y <= 2015) || (y === 2016 && dt < '2016-04-20') || dt === '2010-12-28';
            });
        } else if (epoch === 'five-year-06') {
            // Fünfjahresplan 2006–2011: inkl. Rahmenbotschaft vom 27. Dez 2005 bis Riḍván 2011
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2006 && y <= 2010) || (y === 2011 && dt < '2011-04-20') || dt === '2005-12-27';
            });
        } else if (epoch === 'five-year-01') {
            // Fünfjahresplan 2001–2006: 2001 bis Riḍván 2006
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2001 && y <= 2005) || (y === 2006 && dt < '2006-04-20');
            });
        } else if (epoch === 'four-year-96') {
            // Vierjahresplan 1996–2000: inkl. Rahmenbotschaft 26. Dez 1995 bis Riḍván 2000
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 1996 && y <= 1999) || (y === 2000 && dt < '2000-04-20') || dt === '1995-12-26';
            });
        } else if (epoch === 'plans-00') {
            // Rückwärtskompatibilität: 2001–2015
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return (y >= 2001 && y <= 2015) || dt === '2010-12-28' || dt === '2005-12-27';
            });
        } else if (epoch === 'plans-early' || epoch === 'era-early' || epoch === 'era-80s' || epoch === 'era-90s') {
            list = list.filter(d => {
                const dt = d.date || '';
                const y = d.year || (dt ? parseInt(dt.substring(0, 4), 10) : 0);
                return y >= 1963 && y <= 1995;
            });
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

    // 6. Omnisearch 2.0: Universelle Volltext- & Relevanz-Suche
    let lastSearchStats = null;
    if (query) {
        if (window.SearchEngine && typeof window.SearchEngine.search === 'function') {
            const searchRes = window.SearchEngine.search(
                list,
                window.state.fullTexts,
                window.state.normalizedFullTexts,
                query,
                state.library
            );
            list = searchRes.results;
            lastSearchStats = searchRes.stats;
        } else {
            // Fallback auf Basissuche
            const queryNorm = normalizeSearchText(query);
            const queryTokens = queryNorm.split(/\s+/).filter(Boolean);
            if (queryTokens.length > 0) {
                list = list.filter(d => {
                    const bundle = getDocumentSearchBundle(d);
                    return queryTokens.every(tok => bundle.includes(tok));
                });
            }
        }
    }

    // 7. Sortierung
    if (segment === 'ruhi') {
        // Ruhi-Kurse: Standardmäßig und bei Datums-Sortierung nach Kurs-Sequenz (Buch 1, 2, 3, 3.1, 4...)
        if (sort === 'title') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        } else {
            list.sort((a, b) => {
                const numA = (typeof a.bookNumber === 'number') ? a.bookNumber : parseFloat(a.bookNumber) || 999;
                const numB = (typeof b.bookNumber === 'number') ? b.bookNumber : parseFloat(b.bookNumber) || 999;
                if (numA !== numB) return numA - numB;
                return (a.title || '').localeCompare(b.title || '', 'de');
            });
        }
    } else if (segment === 'compilations') {
        // Kompilationen: Standardmäßig alphabetisch A–Z
        if (sort === 'date-asc') {
            list.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'de'));
        } else {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        }
    } else if (query) {
        if (sort === 'date-desc') {
            // Standard bei Suche: Nach Relevanz sortieren (höchster Relevanz-Score zuerst), sekundär nach Datum
            list.sort((a, b) => {
                const scoreDiff = (b._searchScore || 0) - (a._searchScore || 0);
                if (scoreDiff !== 0) return scoreDiff;
                if (!a.date && !b.date) return (a.title || '').localeCompare(b.title || '', 'de');
                if (!a.date) return 1;
                if (!b.date) return -1;
                return (b.date || '').localeCompare(a.date || '');
            });
        } else if (sort === 'date-asc') {
            list.sort((a, b) => {
                if (!a.date && !b.date) return (a.title || '').localeCompare(b.title || '', 'de');
                if (!a.date) return 1;
                if (!b.date) return -1;
                return (a.date || '').localeCompare(b.date || '');
            });
        } else if (sort === 'title') {
            list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        }
    } else {
        if (sort === 'date-desc') {
            list.sort((a, b) => {
                if (epoch) {
                    const pA = getPlanDocumentPriority(a, epoch);
                    const pB = getPlanDocumentPriority(b, epoch);
                    if (pA !== pB) return pA - pB;
                }
                if (!a.date && !b.date) return (a.title || '').localeCompare(b.title || '', 'de');
                if (!a.date) return 1;
                if (!b.date) return -1;
                return (b.date || '').localeCompare(a.date || '');
            });
        } else if (sort === 'date-asc') {
            list.sort((a, b) => {
                if (!a.date && !b.date) return (a.title || '').localeCompare(b.title || '', 'de');
                if (!a.date) return 1;
                if (!b.date) return -1;
                return (a.date || '').localeCompare(b.date || '');
            });
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

    // Ergebnisse-Statuszeile & Omnisearch 2.0 Statistikleiste aktualisieren
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    const countNumEl = document.getElementById('library-count-num');
    if (countNumEl) countNumEl.textContent = list.length.toLocaleString(isEn ? 'en-US' : 'de-DE');

    const searchStatsBar = document.getElementById('search-stats-bar');
    if (searchStatsBar) {
        if (query && lastSearchStats) {
            const timeStr = isEn ? `${lastSearchStats.tookMs} ms` : `${lastSearchStats.tookMs} ms`;
            const countStr = isEn 
                ? `${lastSearchStats.totalMatches} result${lastSearchStats.totalMatches === 1 ? '' : 's'}`
                : `${lastSearchStats.totalMatches} Treffer`;
            const counts = lastSearchStats.countByPillar || {};

            searchStatsBar.innerHTML = `
                <div class="search-stats-info">
                    <span class="search-stats-count">${countStr}</span>
                    <span class="search-stats-time">(in ${timeStr})</span>
                </div>
                <div class="search-pillar-pills">
                    <button type="button" class="search-pillar-pill ${(!state.library.searchPillarFilter || state.library.searchPillarFilter === 'all') ? 'active' : ''}" data-pillar-filter="all">
                        <span>${isEn ? 'All' : 'Alle'}</span>
                        <span class="pill-count">${counts.all || list.length}</span>
                    </button>
                    ${counts.house > 0 ? `
                    <button type="button" class="search-pillar-pill ${(state.library.searchPillarFilter === 'house') ? 'active' : ''}" data-pillar-filter="house">
                        <span>${isEn ? 'Messages' : 'Botschaften'}</span>
                        <span class="pill-count">${counts.house}</span>
                    </button>` : ''}
                    ${counts.books > 0 ? `
                    <button type="button" class="search-pillar-pill ${(state.library.searchPillarFilter === 'books') ? 'active' : ''}" data-pillar-filter="books">
                        <span>${isEn ? 'Books' : 'Bücher'}</span>
                        <span class="pill-count">${counts.books}</span>
                    </button>` : ''}
                    ${counts.compilations > 0 ? `
                    <button type="button" class="search-pillar-pill ${(state.library.searchPillarFilter === 'compilations') ? 'active' : ''}" data-pillar-filter="compilations">
                        <span>${isEn ? 'Compilations' : 'Kompilationen'}</span>
                        <span class="pill-count">${counts.compilations}</span>
                    </button>` : ''}
                    ${counts.ruhi > 0 ? `
                    <button type="button" class="search-pillar-pill ${(state.library.searchPillarFilter === 'ruhi') ? 'active' : ''}" data-pillar-filter="ruhi">
                        <span>Ruhi</span>
                        <span class="pill-count">${counts.ruhi}</span>
                    </button>` : ''}
                </div>
            `;
            searchStatsBar.style.display = 'flex';

            // Event-Listener für Pillar-Pills innerhalb der Suche
            searchStatsBar.querySelectorAll('.search-pillar-pill').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pFilter = btn.dataset.pillarFilter;
                    state.library.searchPillarFilter = pFilter;
                    applyLibraryFilters();
                });
            });
        } else {
            searchStatsBar.style.display = 'none';
            searchStatsBar.innerHTML = '';
            state.library.searchPillarFilter = null;
        }
    }

    // Wenn ein Quick-Pillar-Filter aktiv ist, wende ihn an
    if (query && state.library.searchPillarFilter && state.library.searchPillarFilter !== 'all') {
        const pf = state.library.searchPillarFilter;
        list = list.filter(d => {
            const tier = (d.tier || '').toLowerCase();
            if (pf === 'house') return tier === 'house' || tier === 'institutions';
            if (pf === 'books') return tier === 'books';
            if (pf === 'compilations') return tier === 'compilations';
            if (pf === 'ruhi') return tier === 'ruhi';
            return true;
        });
    }

    const tagsContainer = document.getElementById('library-active-tags');
    if (tagsContainer) {
        if (activeTags.length > 0) {
            tagsContainer.innerHTML = activeTags.map(tag => `
                <span class="active-tag-pill">
                    <span>${tag.label}</span>
                    <span class="active-tag-close" data-tag-key="${tag.key}" title="Filter entfernen">&times;</span>
                </span>
            `).join('') + `
                <button type="button" class="active-tags-reset-all-btn" id="active-tags-reset-btn" title="Alle Filter zurücksetzen">
                    ${isEn ? 'Reset all' : 'Alle zurücksetzen'}
                </button>
            `;

            tagsContainer.querySelectorAll('.active-tag-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof window.removeFilterByKey === 'function') {
                        window.removeFilterByKey(btn.dataset.tagKey);
                    }
                });
            });

            const allResetBtn = document.getElementById('active-tags-reset-btn');
            if (allResetBtn) {
                allResetBtn.addEventListener('click', () => {
                    if (typeof window.resetAllLibraryFilters === 'function') {
                        window.resetAllLibraryFilters();
                    }
                });
            }
        } else {
            tagsContainer.innerHTML = '';
        }
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

// Sammlungen, Ruhi & Merkliste wurden ausgelagert nach js/collections.js
function renderSavedView() {
    if (window.CollectionsModule && typeof window.CollectionsModule.renderSavedView === 'function') {
        window.CollectionsModule.renderSavedView();
    }
}


/* ──────────────────────────────────────────────────────────────────────────
   GEMEINSAME ELEMENTE & CARD RENDERER
   ────────────────────────────────────────────────────────────────────────── */

function formatDate(dateString) {
    if (!dateString) return '';
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

    // Datum / Band / Editions-Kennzeichnung (unverzichtbar für Orientierung)
    if (doc.tier === 'books' && doc.year) {
        metaParts.push(`<span class="doc-date">${doc.year}</span>`);
    } else if (doc.tier === 'ruhi') {
        const ruhiBadge = doc.bookNumber ? `Buch ${doc.bookNumber}` : 'Ruhi-Kurs';
        metaParts.push(`<span class="doc-date">${ruhiBadge}</span>`);
    } else if (doc.tier === 'compilations' || doc.type === 'Kompilation') {
        metaParts.push(`<span class="doc-date">${isEn ? 'Compilation' : 'Kompilation'}</span>`);
    } else if (doc.date) {
        metaParts.push(`<span class="doc-date">${formatDate(doc.date)}</span>`);
    }

    // Auszeichnung für Plan-Rahmenbotschaften, Plan-Auftakt & historische Erklärungen (untere linke Ecke)
    const isPlanCharter = (doc.date === '2025-12-31' || doc.date === '2021-12-30' || doc.date === '2015-12-29' || doc.date === '2010-12-28' || doc.date === '2005-12-27' || doc.date === '2001-01-09' || doc.date === '1995-12-26');
    const isPlanLaunch = (doc.date === '2026-01-04' || doc.date === '2022-01-04' || doc.date === '2016-01-02' || (doc.date && (doc.date.startsWith('2022-04') || doc.date.startsWith('2021-04') || doc.date.startsWith('2016-04') || doc.date.startsWith('2011-04') || doc.date.startsWith('2006-04') || doc.date.startsWith('2001-04') || doc.date.startsWith('1996-04')) && (doc.type || '').includes('Riḍván')));

    let milestoneTagHtml = '';
    if (isPlanCharter) {
        const charterLabel = isEn ? 'Plan Framework' : 'Plan-Rahmenbotschaft';
        milestoneTagHtml = `<span class="doc-milestone-tag plan-charter" title="Grundlegende Rahmenbotschaft des Plans an die Konferenz der Kontinentalen Beraterräte">${charterLabel}</span>`;
    } else if (isPlanLaunch) {
        const launchLabel = isEn ? 'Plan Launch' : 'Plan-Auftakt';
        milestoneTagHtml = `<span class="doc-milestone-tag plan-launch" title="Offizieller weltweiter Auftakt des Plans">${launchLabel}</span>`;
    } else if (doc.isMilestone || doc._isMilestone) {
        const msLabel = isEn ? 'Historic Statement' : 'Historische Erklärung';
        const msTitle = doc.milestoneReasonDe || doc.milestoneReasonEn || msLabel;
        milestoneTagHtml = `<span class="doc-milestone-tag" title="${escapeDocHtml(msTitle)}">${msLabel}</span>`;
    }
    
    // Spezifischer Anlass / Empfänger / Autor (nur falls aussagekräftig)
    let contextLabel = '';
    if (doc.tier === 'ruhi') {
        contextLabel = 'Ruhi-Institut';
    } else if (doc.tier === 'compilations' || doc.type === 'Kompilation') {
        contextLabel = isEn ? 'Research Department' : 'Forschungsabteilung';
    } else if (doc.tier === 'books') {
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

    const hasFooter = Boolean(milestoneTagHtml || recipientHtml);
    const isMilestoneCard = Boolean(isPlanCharter || isPlanLaunch || doc.isMilestone || doc._isMilestone);

    const matchCountBadge = (doc._searchMatchCount && doc._searchMatchCount > 1)
        ? `<span class="snippet-hit-count" title="${doc._searchMatchCount} Fundstellen im Werk">${doc._searchMatchCount}×</span>`
        : '';

    const safeDocId = (doc.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return `
        <article class="doc-card ${isMilestoneCard ? 'is-milestone' : ''}" style="--i: ${staggerIndex};" data-doc-id="${escapeDocHtml(doc.id)}" onclick="window.openDocument('${safeDocId}')">
            <div class="doc-card-body">
                <div class="doc-card-header">
                    <div class="doc-meta-editorial">
                        ${metaParts.join('<span class="meta-dot">•</span>')}
                    </div>
                    ${bilingualBadge}
                </div>
                <h3 class="doc-title">${escapeDocHtml(doc.title)}</h3>
                ${subTitleHtml}
                ${previewText ? `<p class="doc-excerpt ${activeSnippet ? 'doc-search-snippet' : ''}">${previewText}${matchCountBadge}</p>` : ''}
            </div>
            ${hasFooter ? `
            <div class="doc-card-footer">
                <div class="doc-footer-left">
                    ${milestoneTagHtml}
                </div>
                ${recipientHtml ? `<div class="doc-footer-right">${recipientHtml}</div>` : ''}
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

// Universelle Klick-Delegation für alle Dokument-Karten (Bibliothek, Bücher, Kompilationen, Ruhi, Merkliste, Zeitstrahl)
document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-doc-id]');
    if (!card) return;
    if (e.target.closest('button, a, input, select, textarea, .para-pill-btn')) return;
    const docId = card.getAttribute('data-doc-id');
    if (docId && typeof window.openDocument === 'function') {
        window.openDocument(docId);
    }
});

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
})();
