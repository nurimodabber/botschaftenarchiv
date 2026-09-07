/**
 * compilation_builder.js
 * Interaktive Kompilations-Werkstatt für das Bahá'í-Botschaften-Archiv.
 * Ermöglicht das Filtern zielgruppenorientierter Absätze, Zusammenstellen eigener
 * Kompilationen, Ergänzen von Notizen sowie Export nach Druck/PDF, TXT und Zwischenablage.
 */

window.CompilationBuilder = (function() {
    let passagesData = null;
    let filteredPassages = [];
    let currentCategory = 'all';
    let currentRecipient = 'all';
    let currentQuery = '';
    let renderedPassageCount = 0;
    const PASSAGE_PAGE_SIZE = 25;

    // Active Draft State
    let draft = {
        id: Date.now().toString(),
        title: 'Thematische Kompilation',
        description: '',
        passages: [] // array of { id, docId, title, date, paraIndex, text, userNote }
    };

    // Load saved drafts from localStorage
    function getSavedCompilations() {
        try {
            return JSON.parse(localStorage.getItem('my_compilations') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveCompilationsList(list) {
        try {
            localStorage.setItem('my_compilations', JSON.stringify(list));
        } catch (e) {}
    }

    let currentWorkshopTab = 'catalog';

    function isPortraitMode() {
        return window.matchMedia('(orientation: portrait), (max-width: 860px)').matches;
    }

    function switchWorkshopTab(tab) {
        currentWorkshopTab = tab;
        const catBtn = document.getElementById('wtab-catalog');
        const draftBtn = document.getElementById('wtab-draft');
        const catPane = document.querySelector('.workshop-catalog-pane');
        const draftPane = document.querySelector('.workshop-draft-pane');
        const jumpEl = document.getElementById('workshop-floating-jump');

        if (catBtn && draftBtn) {
            catBtn.classList.toggle('active', tab === 'catalog');
            draftBtn.classList.toggle('active', tab === 'draft');
        }

        if (isPortraitMode()) {
            if (catPane && draftPane) {
                if (tab === 'catalog') {
                    catPane.style.display = 'block';
                    draftPane.style.display = 'none';
                    if (jumpEl) {
                        jumpEl.style.display = draft.passages.length > 0 ? 'flex' : 'none';
                    }
                } else {
                    catPane.style.display = 'none';
                    draftPane.style.display = 'block';
                    if (jumpEl) {
                        jumpEl.style.display = 'none';
                    }
                }
            }
        } else {
            if (catPane) catPane.style.display = '';
            if (draftPane) draftPane.style.display = '';
            if (jumpEl) jumpEl.style.display = 'none';
        }
    }

    // Initialize module
    async function init() {
        const container = document.getElementById('compilation-workshop');
        if (!container) return;

        // Render skeleton UI if not already rendered
        if (!document.getElementById('workshop-passages-list')) {
            renderWorkshopUI(container);
        }

        switchWorkshopTab(currentWorkshopTab);

        // Lazy-load curated_passages.json
        if (!passagesData) {
            const listEl = document.getElementById('workshop-passages-list');
            if (listEl) {
                listEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Lade zielgruppenspezifische Absätze aller Botschaften…</div>';
            }
            try {
                const res = await fetch('data/curated_passages.json');
                if (!res.ok) throw new Error('Failed to load passages');
                passagesData = await res.json();
                applyFilters();
            } catch (err) {
                console.error('Error loading curated passages:', err);
                if (listEl) {
                    listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Absätze konnten nicht geladen werden. Bitte stellen Sie sicher, dass data/curated_passages.json existiert.</p>';
                }
            }
        } else {
            applyFilters();
        }

        updateDraftUI();
    }

    function renderWorkshopUI(container) {
        container.innerHTML = `
            <!-- Sub-Tab Leiste für Hochformat & Mobile -->
            <div class="workshop-mobile-tabs" id="workshop-mobile-tabs">
                <button type="button" class="workshop-tab-btn active" data-tab="catalog" id="wtab-catalog">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                    <span>Absatz-Katalog</span>
                </button>
                <button type="button" class="workshop-tab-btn" data-tab="draft" id="wtab-draft">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span>Manuskript</span>
                    <span id="workshop-mobile-badge" class="workshop-tab-badge">0</span>
                </button>
            </div>

            <div class="workshop-layout">
                <!-- Linke Spalte: Absatz-Katalog & Filter -->
                <div class="workshop-catalog-pane">
                    <div class="workshop-filters">
                        <h3 class="workshop-filter-heading">Thema &amp; Zielgruppe</h3>
                        <div class="target-pills" id="workshop-target-pills">
                            <button class="filter-pill active" data-cat="all">Alle Zielgruppen</button>
                            <button class="filter-pill" data-cat="jugend">Jugend &amp; Nachwuchs</button>
                            <button class="filter-pill" data-cat="raete_institutionen">Geistige Räte</button>
                            <button class="filter-pill" data-cat="institute_tutors">Institute &amp; Tutoren</button>
                            <button class="filter-pill" data-cat="familie_kinder">Familie &amp; Kinder</button>
                            <button class="filter-pill" data-cat="gesellschaft">Gesellschaftl. Handeln</button>
                            <button class="filter-pill" data-cat="lehren_pioniere">Lehren &amp; Pionierdienst</button>
                            <button class="filter-pill" data-cat="gebet_vertiefung">Gebet &amp; Charakter</button>
                        </div>
                        
                        <div class="workshop-search-row">
                            <input type="text" id="workshop-search-input" class="workshop-search-input" placeholder="Absätze durchsuchen (z. B. Mut, Andacht, Konsultation)...">
                            <select id="workshop-rec-select" class="workshop-rec-select">
                                <option value="all">Alle Empfänger</option>
                                <option value="world">Weltweite Gemeinde</option>
                                <option value="nsa">Nationale Geistige Räte</option>
                                <option value="counsellors">Berater &amp; Hilfsamt</option>
                                <option value="youth">Jugend</option>
                                <option value="institutes">Trainingsinstitute</option>
                                <option value="iran">Freunde in Iran</option>
                            </select>
                        </div>
                    </div>

                    <div id="workshop-passages-info" class="workshop-passages-info">
                        <span id="workshop-passages-count">0 Absätze gefunden</span>
                    </div>

                    <div id="workshop-passages-list" class="passages-grid">
                        <!-- Dynamically populated -->
                    </div>

                    <div id="workshop-load-more" style="text-align: center; margin: 1.5rem 0; display: none;">
                        <button id="workshop-load-more-btn" class="btn-secondary">Mehr Absätze laden</button>
                    </div>
                </div>

                <!-- Rechte Spalte: Kompilations-Editor & Export -->
                <div class="workshop-draft-pane">
                    <div class="draft-header">
                        <h3 class="draft-title-head">Kompilations-Manuskript</h3>
                        <span id="draft-stats-badge" class="draft-stats-badge">0 Absätze</span>
                    </div>

                    <div class="draft-field-group">
                        <label class="draft-field-label">Titel der Kompilation:</label>
                        <input type="text" id="draft-title" class="draft-title-input" value="${escapeHtml(draft.title)}">
                    </div>

                    <div class="draft-field-group">
                        <label class="draft-field-label">Einleitung / Thema (optional):</label>
                        <textarea id="draft-description" class="draft-desc-textarea" placeholder="Kurze Einführung oder Leitfrage für die Andacht / Ratssitzung..." rows="2">${escapeHtml(draft.description || '')}</textarea>
                    </div>

                    <!-- Selected Passages Container -->
                    <div id="draft-passages-container" class="draft-passages-container">
                        <p class="draft-empty-placeholder">
                            Noch keine Absätze ausgewählt.<br>Klicken Sie links bei einem Absatz auf <strong>„+ In Kompilation“</strong>.
                        </p>
                    </div>

                    <!-- Actions & Export Bar -->
                    <div class="draft-action-buttons">
                        <div class="draft-actions-primary">
                            <button id="btn-export-print" class="btn-primary btn-draft-action">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                <span>Drucken / PDF</span>
                            </button>
                            <button id="btn-export-copy" class="btn-secondary btn-draft-action">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                <span>Text kopieren</span>
                            </button>
                        </div>
                        <div class="draft-actions-secondary">
                            <button id="btn-save-draft" class="btn-secondary btn-draft-subaction">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                <span>Sichern</span>
                            </button>
                            <button id="btn-load-drafts" class="btn-secondary btn-draft-subaction">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                <span>Öffnen</span>
                            </button>
                            <button id="btn-clear-draft" class="btn-secondary btn-draft-clear" title="Kompilation leeren">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>

                    <button type="button" id="workshop-back-to-catalog" class="btn-secondary workshop-back-catalog-btn">
                        ← Weitere Absätze im Katalog suchen
                    </button>
                </div>
            </div>

            <!-- Floating Action Pill im Hochformat -->
            <div id="workshop-floating-jump" class="workshop-floating-jump">
                <button type="button" id="workshop-jump-to-draft" class="workshop-jump-btn">
                    <span class="workshop-jump-text">Manuskript anzeigen</span>
                    <span class="workshop-jump-badge" id="workshop-jump-count">0</span>
                    <span class="workshop-jump-arrow">→</span>
                </button>
            </div>

            <!-- Print Preview Container (Hidden during normal browsing) -->
            <div id="print-compilation-view" class="print-only"></div>
        `;

        setupEventListeners();
    }

    function setupEventListeners() {
        const pills = document.querySelectorAll('#workshop-target-pills .filter-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                currentCategory = pill.dataset.cat;
                applyFilters();
            });
        });

        const recSelect = document.getElementById('workshop-rec-select');
        if (recSelect) {
            recSelect.addEventListener('change', (e) => {
                currentRecipient = e.target.value;
                applyFilters();
            });
        }

        const searchInput = document.getElementById('workshop-search-input');
        if (searchInput) {
            let timeout = null;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    currentQuery = e.target.value.trim().toLowerCase();
                    applyFilters();
                }, 250);
            });
        }

        const loadMoreBtn = document.getElementById('workshop-load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', renderMorePassages);
        }

        const titleInput = document.getElementById('draft-title');
        if (titleInput) {
            titleInput.addEventListener('input', (e) => {
                draft.title = e.target.value;
            });
        }
        const descInput = document.getElementById('draft-description');
        if (descInput) {
            descInput.addEventListener('input', (e) => {
                draft.description = e.target.value;
            });
        }

        // Subtabs for Mobile / Portrait
        document.getElementById('wtab-catalog')?.addEventListener('click', () => {
            switchWorkshopTab('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.getElementById('wtab-draft')?.addEventListener('click', () => {
            switchWorkshopTab('draft');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.getElementById('workshop-jump-to-draft')?.addEventListener('click', () => {
            switchWorkshopTab('draft');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.getElementById('workshop-back-to-catalog')?.addEventListener('click', () => {
            switchWorkshopTab('catalog');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Responsive orientation & resize sync
        window.addEventListener('resize', () => {
            switchWorkshopTab(currentWorkshopTab);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => switchWorkshopTab(currentWorkshopTab), 150);
        });

        document.getElementById('btn-export-print')?.addEventListener('click', exportToPrint);
        document.getElementById('btn-export-copy')?.addEventListener('click', exportToClipboard);
        document.getElementById('btn-save-draft')?.addEventListener('click', saveCurrentDraft);
        document.getElementById('btn-load-drafts')?.addEventListener('click', showSavedDraftsModal);
        document.getElementById('btn-clear-draft')?.addEventListener('click', clearDraft);
    }

    function applyFilters() {
        if (!passagesData || !passagesData.passages) return;

        filteredPassages = passagesData.passages.filter(p => {
            if (currentCategory !== 'all' && (!p.categories || !p.categories.includes(currentCategory))) {
                return false;
            }
            if (currentRecipient !== 'all' && p.recipient !== currentRecipient) {
                return false;
            }
            if (currentQuery) {
                const txt = (p.text || '').toLowerCase();
                const title = (p.title || '').toLowerCase();
                if (!txt.includes(currentQuery) && !title.includes(currentQuery)) {
                    return false;
                }
            }
            return true;
        });

        renderedPassageCount = 0;
        const listEl = document.getElementById('workshop-passages-list');
        if (listEl) listEl.innerHTML = '';

        const countEl = document.getElementById('workshop-passages-count');
        if (countEl) {
            countEl.textContent = `${filteredPassages.length} relevante Absätze gefunden`;
        }

        renderMorePassages();
    }

    function renderMorePassages() {
        const listEl = document.getElementById('workshop-passages-list');
        const loadMoreBox = document.getElementById('workshop-load-more');
        if (!listEl) return;

        const batch = filteredPassages.slice(renderedPassageCount, renderedPassageCount + PASSAGE_PAGE_SIZE);
        if (batch.length === 0 && renderedPassageCount === 0) {
            listEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Keine Absätze für die gewählten Filter gefunden.</p>';
            if (loadMoreBox) loadMoreBox.style.display = 'none';
            return;
        }

        const draftIds = new Set(draft.passages.map(p => p.id));

        const html = batch.map(p => {
            const isAdded = draftIds.has(p.id);
            const catBadges = (p.categories || []).map(cid => {
                const cat = passagesData.categories[cid];
                return cat ? `<span class="passage-cat-tag">${cat.label}</span>` : '';
            }).join(' ');

            return `
                <div class="passage-card" id="card-${p.id}">
                    <div class="passage-card-header-row">
                        <div class="passage-meta-info">
                            <span class="passage-date-badge">${p.date || '—'}</span>
                            <strong class="passage-title">${escapeHtml(p.title)}</strong>
                            <span class="passage-para-num">(Absatz ${p.paraIndex})</span>
                        </div>
                        <div class="passage-badges">
                            ${catBadges}
                        </div>
                    </div>

                    <div class="passage-quote">
                        „${escapeHtml(p.text)}“
                    </div>

                    <div class="passage-actions-row">
                        <button type="button" class="passage-context-btn" onclick="window.openDocument('${p.docId}')">
                            Im Kontext lesen →
                        </button>
                        <button type="button" id="btn-add-${p.id}" onclick="window.CompilationBuilder.togglePassage('${p.id}')" class="passage-toggle-btn ${isAdded ? 'btn-secondary is-added' : 'btn-primary'}">
                            ${isAdded ? 'Im Entwurf' : '+ In Kompilation'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        renderedPassageCount += batch.length;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        while (tempDiv.firstChild) {
            listEl.appendChild(tempDiv.firstChild);
        }

        if (loadMoreBox) {
            loadMoreBox.style.display = renderedPassageCount < filteredPassages.length ? 'block' : 'none';
        }
    }

    function togglePassage(passageId) {
        const existingIdx = draft.passages.findIndex(p => p.id === passageId);
        if (existingIdx > -1) {
            draft.passages.splice(existingIdx, 1);
        } else {
            const p = passagesData.passages.find(x => x.id === passageId);
            if (p) {
                draft.passages.push({
                    id: p.id,
                    docId: p.docId,
                    title: p.title,
                    date: p.date,
                    paraIndex: p.paraIndex,
                    text: p.text,
                    userNote: ''
                });
            }
        }

        const btn = document.getElementById(`btn-add-${passageId}`);
        if (btn) {
            const isAdded = draft.passages.some(p => p.id === passageId);
            btn.className = `passage-toggle-btn ${isAdded ? 'btn-secondary is-added' : 'btn-primary'}`;
            btn.textContent = isAdded ? 'Im Entwurf' : '+ In Kompilation';
        }

        updateDraftUI();
    }

    function addPassageFromViewer(doc, paraText, paraIdx) {
        const passageId = `${doc.id}_p${paraIdx || 1}`;
        if (!draft.passages.some(p => p.id === passageId)) {
            draft.passages.push({
                id: passageId,
                docId: doc.id,
                title: doc.title,
                date: doc.date,
                paraIndex: paraIdx || 1,
                text: paraText,
                userNote: ''
            });
            updateDraftUI();
            alert(`Absatz aus „${doc.title}“ wurde zur Kompilation hinzugefügt.`);
        } else {
            alert(`Dieser Absatz befindet sich bereits in der Kompilation.`);
        }
    }

    function updateDraftUI() {
        const container = document.getElementById('draft-passages-container');
        const badge = document.getElementById('draft-stats-badge');
        const mobileBadge = document.getElementById('workshop-mobile-badge');
        const jumpCount = document.getElementById('workshop-jump-count');
        const jumpEl = document.getElementById('workshop-floating-jump');

        if (badge) {
            badge.textContent = `${draft.passages.length} ${draft.passages.length === 1 ? 'Absatz' : 'Absätze'}`;
        }
        if (mobileBadge) {
            mobileBadge.textContent = draft.passages.length;
        }
        if (jumpCount) {
            jumpCount.textContent = draft.passages.length;
        }
        if (jumpEl && isPortraitMode()) {
            jumpEl.style.display = (currentWorkshopTab === 'catalog' && draft.passages.length > 0) ? 'flex' : 'none';
        }

        if (!container) return;

        if (draft.passages.length === 0) {
            container.innerHTML = `
                <p class="draft-empty-placeholder">
                    Noch keine Absätze ausgewählt.<br>Klicken Sie links bei einem Absatz auf <strong>„+ In Kompilation“</strong>.
                </p>
            `;
            return;
        }

        container.innerHTML = draft.passages.map((p, idx) => `
            <div class="draft-item">
                <div class="draft-item-header">
                    <span class="draft-item-meta"><strong>#${idx + 1}</strong> • ${p.date || '—'} — ${escapeHtml(p.title)} (Abs. ${p.paraIndex})</span>
                    <div class="draft-item-reorder">
                        ${idx > 0 ? `<button type="button" onclick="window.CompilationBuilder.movePassage(${idx}, -1)" class="draft-step-btn" title="Nach oben"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg></button>` : ''}
                        ${idx < draft.passages.length - 1 ? `<button type="button" onclick="window.CompilationBuilder.movePassage(${idx}, 1)" class="draft-step-btn" title="Nach unten"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` : ''}
                        <button type="button" onclick="window.CompilationBuilder.removePassage(${idx})" class="draft-step-btn draft-delete-btn" title="Entfernen"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                </div>

                <div class="draft-item-quote">
                    „${escapeHtml(p.text)}“
                </div>

                <div class="draft-item-note-row">
                    <input type="text" class="draft-item-note-input" value="${escapeHtml(p.userNote || '')}" onchange="window.CompilationBuilder.updateNote(${idx}, this.value)" placeholder="Notiz / Leitfrage zu diesem Absatz hinzufügen...">
                </div>
            </div>
        `).join('');
    }

    function movePassage(idx, delta) {
        const target = idx + delta;
        if (target < 0 || target >= draft.passages.length) return;
        const temp = draft.passages[idx];
        draft.passages[idx] = draft.passages[target];
        draft.passages[target] = temp;
        updateDraftUI();
    }

    function removePassage(idx) {
        const removed = draft.passages.splice(idx, 1)[0];
        if (removed) {
            const btn = document.getElementById(`btn-add-${removed.id}`);
            if (btn) {
                btn.className = 'passage-toggle-btn btn-primary';
                btn.textContent = '+ In Kompilation';
            }
        }
        updateDraftUI();
    }

    function updateNote(idx, note) {
        if (draft.passages[idx]) {
            draft.passages[idx].userNote = note;
        }
    }

    function clearDraft() {
        if (draft.passages.length === 0) return;
        if (confirm('Möchten Sie die aktuelle Kompilation wirklich leeren?')) {
            draft.passages = [];
            updateDraftUI();
            applyFilters();
        }
    }

    function exportToPrint() {
        if (draft.passages.length === 0) {
            alert('Bitte fügen Sie zuerst Absätze zur Kompilation hinzu.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Popup-Fenster wurde blockiert. Bitte Popups für diese Seite erlauben.');
            return;
        }

        const passagesHtml = draft.passages.map((p, idx) => `
            <div style="margin-bottom: 2rem; page-break-inside: avoid;">
                <div style="font-size: 0.95rem; font-weight: bold; color: #1b365d; margin-bottom: 0.4rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem;">
                    [${idx + 1}] ${escapeHtml(p.title)} — ${p.date || '—'} (Absatz ${p.paraIndex})
                </div>
                ${p.userNote ? `<div style="font-style: italic; color: #555; margin-bottom: 0.5rem; font-size: 0.95rem;">Leitgedanke: ${escapeHtml(p.userNote)}</div>` : ''}
                <div style="text-align: justify; line-height: 1.6; font-size: 11pt;">
                    ${escapeHtml(p.text)}
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <title>${escapeHtml(draft.title)}</title>
                <style>
                    @page { size: A4; margin: 3.0cm; }
                    body {
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 11pt;
                        line-height: 1.5;
                        color: #111;
                        background: #fff;
                        padding: 2cm;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    h1 {
                        text-align: center;
                        font-size: 18pt;
                        color: #1b365d;
                        margin-bottom: 0.5rem;
                    }
                    .subtitle {
                        text-align: center;
                        font-size: 11pt;
                        font-style: italic;
                        color: #555;
                        margin-bottom: 2rem;
                    }
                    .description {
                        background: #f9f9f9;
                        border-left: 3px solid #1b365d;
                        padding: 0.75rem 1rem;
                        font-style: italic;
                        margin-bottom: 2rem;
                    }
                    .footer {
                        text-align: center;
                        font-size: 9pt;
                        color: #777;
                        border-top: 1px solid #ccc;
                        padding-top: 1rem;
                        margin-top: 3rem;
                    }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(draft.title)}</h1>
                <div class="subtitle">Inspirierte Zitatesammlung zur persönlichen Vertiefung und Reflexion (aus den Botschaften des Universalen Hauses der Gerechtigkeit)</div>
                ${draft.description ? `<div class="description">${escapeHtml(draft.description)}</div>` : ''}
                
                ${passagesHtml}

                <div class="footer">
                    Botschaften-Archiv (Inspirierte private Studieninitiative) • Erstellt am ${new Date().toLocaleDateString('de-DE')} • ${draft.passages.length} Absätze • Keine offizielle Publikation
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    function exportToClipboard() {
        if (draft.passages.length === 0) {
            alert('Bitte fügen Sie zuerst Absätze zur Kompilation hinzu.');
            return;
        }

        let out = `# ${draft.title}\n`;
        if (draft.description) out += `*${draft.description}*\n\n`;
        out += `Inspirierte Zitatesammlung zur Textarbeit (aus den Botschaften des Universalen Hauses der Gerechtigkeit)\n\n---\n\n`;

        draft.passages.forEach((p, idx) => {
            out += `### [${idx + 1}] ${p.title} (${p.date}, Absatz ${p.paraIndex})\n\n`;
            if (p.userNote) out += `*Leitgedanke: ${p.userNote}*\n\n`;
            out += `„${p.text}“\n\n`;
        });

        out += `---\n*Botschaften-Archiv — Inspirierte private Studieninitiative (Keine offizielle Publikation) • ${new Date().toLocaleDateString('de-DE')}*\n`;

        navigator.clipboard.writeText(out).then(() => {
            alert('Kompilation wurde formatiert in die Zwischenablage kopiert!');
        }).catch(() => {
            alert('Kopieren fehlgeschlagen. Bitte manuell markieren.');
        });
    }

    function saveCurrentDraft() {
        if (draft.passages.length === 0) {
            alert('Bitte fügen Sie zuerst Absätze hinzu, bevor Sie speichern.');
            return;
        }

        const list = getSavedCompilations();
        const existingIdx = list.findIndex(c => c.id === draft.id);
        const copy = JSON.parse(JSON.stringify(draft));
        copy.updatedAt = new Date().toISOString();

        if (existingIdx > -1) {
            list[existingIdx] = copy;
        } else {
            list.unshift(copy);
        }

        saveCompilationsList(list);
        alert(`Kompilation „${draft.title}“ wurde im Browser gespeichert!`);
    }

    function showSavedDraftsModal() {
        const list = getSavedCompilations();
        if (list.length === 0) {
            alert('Es wurden noch keine Kompilationen im Browser gespeichert.');
            return;
        }

        const choice = prompt(
            'Gespeicherte Kompilationen:\n' +
            list.map((c, i) => `[${i + 1}] ${c.title} (${c.passages.length} Absätze)`).join('\n') +
            '\n\nBitte Nummer der gewünschten Kompilation eingeben:'
        );

        if (choice) {
            const idx = parseInt(choice, 10) - 1;
            if (list[idx]) {
                draft = JSON.parse(JSON.stringify(list[idx]));
                const titleEl = document.getElementById('draft-title');
                const descEl = document.getElementById('draft-description');
                if (titleEl) titleEl.value = draft.title;
                if (descEl) descEl.value = draft.description || '';
                updateDraftUI();
                applyFilters();
                alert(`Kompilation „${draft.title}“ geladen!`);
            }
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    return {
        init: init,
        togglePassage: togglePassage,
        addPassageFromViewer: addPassageFromViewer,
        movePassage: movePassage,
        removePassage: removePassage,
        updateNote: updateNote,
        switchTab: switchWorkshopTab
    };
})();
