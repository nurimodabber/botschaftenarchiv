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
        recipient: 'all',
        epoch: '',
        type: '',
        lang: '',
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
    setupTheme();
    setupNavigation();
    setupKeyboardShortcuts();
    
    try {
        const response = await fetch('data/index.json');
        if (!response.ok) throw new Error('Failed to load data');
        state.documents = await response.json();
        
        // Initialize Search & Viewer modules
        if (window.initSearch) window.initSearch(state.documents);
        if (window.initViewer) window.initViewer();
        
        // Initialize Views
        initLibraryView();
        initCollectionsView();
        updateYearFilter();
        
        // Default to Library
        window.switchView('library');
        
    } catch (error) {
        console.error('Error loading documents:', error);
        const resultsEl = document.getElementById('library-results');
        if (resultsEl) {
            resultsEl.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 3rem;">Fehler beim Laden der Daten. Bitte stellen Sie sicher, dass data/index.json existiert.</p>';
        }
    }
}

// Theme Handling
function setupTheme() {
    const html = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const sun = btn.querySelector('.sun-icon');
    const moon = btn.querySelector('.moon-icon');

    const updateTheme = (newTheme) => {
        html.setAttribute('data-theme', newTheme);
        safeSetStorage('theme', newTheme);
        state.theme = newTheme;
        
        if (newTheme === 'dark') {
            if (sun) sun.style.display = 'none';
            if (moon) moon.style.display = 'block';
        } else {
            if (sun) sun.style.display = 'block';
            if (moon) moon.style.display = 'none';
        }
    };

    updateTheme(state.theme);

    btn.addEventListener('click', () => {
        updateTheme(state.theme === 'light' ? 'dark' : 'light');
    });
}

// Navigation & View Switching
window.switchView = function(targetView) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');

    navBtns.forEach(btn => {
        if (btn.dataset.view === targetView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    views.forEach(v => {
        if (v.id === `view-${targetView}`) {
            v.classList.add('active');
        } else {
            v.classList.remove('active');
        }
    });

    state.currentView = targetView;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window.trackEvent === 'function') {
        window.trackEvent('switch_view', { view: targetView });
    }

    if (targetView === 'workshop' && window.CompilationBuilder) {
        window.CompilationBuilder.init();
    } else if (targetView === 'collections') {
        switchCollectionsSubview(state.collectionsSubView || 'compilations');
    } else if (targetView === 'saved') {
        renderSavedView();
    } else if (targetView === 'timeline' && window.TimelineModule) {
        window.TimelineModule.init();
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

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // '/' focuses Search
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            window.switchView('search');
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 50);
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
    const libDocs = state.documents.filter(d => d.tier === 'house' || d.tier === 'institutions');
    
    // Recipient Select
    const recipSelect = document.getElementById('library-recipient-select');
    if (recipSelect) {
        recipSelect.value = state.library.recipient || 'all';
        recipSelect.addEventListener('change', (e) => {
            state.library.recipient = e.target.value;
            applyLibraryFilters();
        });
    }

    // Epoch Select
    const epochSelect = document.getElementById('library-epoch-select');
    if (epochSelect) {
        epochSelect.addEventListener('change', (e) => {
            state.library.epoch = e.target.value;
            applyLibraryFilters();
        });
    }

    // Type Select
    const typeSelect = document.getElementById('library-type-select');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            state.library.type = e.target.value;
            applyLibraryFilters();
        });
    }

    // Language Select
    const langSelect = document.getElementById('library-lang-select');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            state.library.lang = e.target.value;
            applyLibraryFilters();
        });
    }

    // Sort Select
    const sortSelect = document.getElementById('library-sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.library.sort = e.target.value;
            applyLibraryFilters();
        });
    }

    // Search Input
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                state.library.query = e.target.value.trim().toLowerCase();
                applyLibraryFilters();
            }, 200);
        });
    }

    // Load More Button
    const loadMoreBtn = document.getElementById('library-load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', renderMoreLibraryResults);
    }

    applyLibraryFilters();
}

function applyLibraryFilters() {
    let list = state.documents.filter(d => d.tier === 'house' || d.tier === 'institutions');
    const { recipient, epoch, type, lang, sort, query } = state.library;

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
        list = list.filter(d => (d.language || '').toLowerCase() === lang.toLowerCase());
    }

    // 5. Text-Suche
    if (query) {
        list = list.filter(d => {
            const title = (d.title || '').toLowerCase();
            const text = (d.text || '').substring(0, 500).toLowerCase();
            const topics = (d.topics || []).join(' ').toLowerCase();
            const rec = (d.recipientLabel || '').toLowerCase();
            return title.includes(query) || text.includes(query) || topics.includes(query) || rec.includes(query);
        });
    }

    // 6. Sortierung
    if (sort === 'date-desc') {
        list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else if (sort === 'date-asc') {
        list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (sort === 'title') {
        list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
    }

    state.library.results = list;
    state.library.renderedCount = 0;

    const container = document.getElementById('library-results');
    const infoEl = document.getElementById('library-results-info');
    if (container) container.innerHTML = '';
    
    if (infoEl) {
        infoEl.innerHTML = `<p><strong>${list.length}</strong> ${list.length === 1 ? 'Botschaft' : 'Botschaften'} gefunden</p>`;
    }

    if (list.length === 0) {
        if (container) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 3rem;">Keine Botschaften gefunden, die den gewählten Kriterien entsprechen.</p>';
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
                <div class="editorial-eyebrow" style="margin-bottom: 0.5rem;">Keine Manuskripte</div>
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
    const formatBadge = doc.format ? doc.format.toUpperCase() : '';
    const langBadge = (doc.language || '').toLowerCase() === 'english' ? 'EN' : 'DE';
    
    // Recipient chip (clean, calm typography)
    let recipientBadge = '';
    if (doc.recipientLabel) {
        let label = doc.recipientLabel;
        if (label === "Weltweite Bahá'í-Gemeinde") label = "Weltweite Gemeinde";
        if (label === "Kontinentale Berater & Hilfsamt") label = "Berater & Hilfsamt";
        recipientBadge = `<span class="recipient-chip" title="Empfänger">${escapeDocHtml(label)}</span>`;
    }

    // Curated passages indicator
    let passagesBadge = '';
    if (doc.keyPassagesCount > 0) {
        passagesBadge = `<span class="passages-chip" title="${doc.keyPassagesCount} thematische Kernabsätze">${doc.keyPassagesCount} Abs.</span>`;
    }

    const staggerIndex = typeof index === 'number' ? (index % 30) : 0;
    const previewText = snippet ? `…${snippet}…` : (doc.excerpt ? `${escapeDocHtml(doc.excerpt)}…` : '');

    return `
        <div class="doc-card" style="--i: ${staggerIndex};" onclick="window.openDocument('${doc.id}')">
            <div>
                <div class="doc-meta">
                    <span class="doc-date">${formatDate(doc.date)}</span>
                    <div class="meta-badges">
                        ${recipientBadge}
                        ${passagesBadge}
                        <span class="lang-chip">${langBadge}</span>
                    </div>
                </div>
                <h3 class="doc-title">${escapeDocHtml(doc.title)}</h3>
                ${previewText ? `<p class="doc-excerpt">${previewText}</p>` : ''}
            </div>
            <div class="doc-footer">
                <div class="doc-tags">
                    ${(doc.topics || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
                    ${(doc.topics || []).length > 3 ? `<span class="tag">+${doc.topics.length - 3}</span>` : ''}
                </div>
                <span class="format-chip">${formatBadge}</span>
            </div>
        </div>
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
