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

    // Initialize module
    async function init() {
        const container = document.getElementById('compilation-workshop');
        if (!container) return;

        // Render skeleton UI if not already rendered
        if (!document.getElementById('workshop-passages-list')) {
            renderWorkshopUI(container);
        }

        // Lazy-load curated_passages.json
        if (!passagesData) {
            const listEl = document.getElementById('workshop-passages-list');
            if (listEl) {
                listEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--color-text-muted);">Lade zielgruppenspezifische Absätze aller Botschaften…</div>';
            }
            try {
                const res = await fetch('data/curated_passages.json');
                if (!res.ok) throw new Error('Failed to load passages');
                passagesData = await res.json();
                applyFilters();
            } catch (err) {
                console.error('Error loading curated passages:', err);
                if (listEl) {
                    listEl.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem;">Absätze konnten nicht geladen werden. Bitte stellen Sie sicher, dass data/curated_passages.json existiert.</p>';
                }
            }
        } else {
            applyFilters();
        }

        updateDraftUI();
    }

    function renderWorkshopUI(container) {
        container.innerHTML = `
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

                    <div style="margin-bottom: 1rem;">
                        <label style="font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); display: block; margin-bottom: 0.25rem;">Titel der Kompilation:</label>
                        <input type="text" id="draft-title" value="${draft.title}" style="width: 100%; padding: 0.55rem 0.85rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-serif); font-size: 1.05rem; font-weight: bold; color: var(--color-primary); background: var(--color-surface-alt);">
                    </div>

                    <div style="margin-bottom: 1.25rem;">
                        <label style="font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); display: block; margin-bottom: 0.25rem;">Einleitung / Thema (optional):</label>
                        <textarea id="draft-description" placeholder="Kurze Einführung oder Leitfrage für die Andacht / Ratssitzung..." rows="2" style="width: 100%; padding: 0.5rem 0.85rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-sans); font-size: 0.88rem; color: var(--color-text); background: var(--color-surface-alt); resize: vertical;"></textarea>
                    </div>

                    <!-- Selected Passages Container -->
                    <div id="draft-passages-container" style="max-height: 480px; overflow-y: auto; padding-right: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">
                        <p style="text-align: center; color: var(--color-text-muted); padding: 2rem 1rem; font-style: italic; font-size: 0.95rem;">
                            Noch keine Absätze ausgewählt.<br>Klicken Sie links bei einem Absatz auf <strong>„+ In Kompilation“</strong>.
                        </p>
                    </div>

                    <!-- Actions & Export Bar -->
                    <div class="draft-action-buttons" style="display: flex; flex-direction: column; gap: 0.6rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <button id="btn-export-print" class="btn-primary" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Drucken / PDF
                            </button>
                            <button id="btn-export-copy" class="btn-secondary" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Text kopieren
                            </button>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button id="btn-save-draft" class="btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 0.5rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                Sichern
                            </button>
                            <button id="btn-load-drafts" class="btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 0.5rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                Öffnen
                            </button>
                            <button id="btn-clear-draft" class="btn-secondary" style="padding: 0.5rem 0.75rem; color: #d93025; display: inline-flex; align-items: center; justify-content: center;" title="Kompilation leeren">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
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
            listEl.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:3rem;">Keine Absätze für die gewählten Filter gefunden.</p>';
            if (loadMoreBox) loadMoreBox.style.display = 'none';
            return;
        }

        const draftIds = new Set(draft.passages.map(p => p.id));

        const html = batch.map(p => {
            const isAdded = draftIds.has(p.id);
            const catBadges = (p.categories || []).map(cid => {
                const cat = passagesData.categories[cid];
                return cat ? `<span style="font-size:0.75rem;padding:0.15rem 0.5rem;border-radius:12px;background:var(--color-surface-alt);border:1px solid var(--color-border);color:var(--color-text-muted);font-weight:500;">${cat.label}</span>` : '';
            }).join(' ');

            return `
                <div class="passage-card" id="card-${p.id}" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:1.25rem;transition:var(--transition);display:flex;flex-direction:column;gap:0.75rem;box-shadow:var(--shadow-sm);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;flex-wrap:wrap;">
                        <div>
                            <span style="font-size:0.78rem;font-weight:600;color:var(--color-accent);background:var(--color-accent-light);padding:0.15rem 0.5rem;border-radius:12px;">${p.date || '—'}</span>
                            <strong style="font-size:0.95rem;color:var(--color-primary);margin-left:0.4rem;">${escapeHtml(p.title)}</strong>
                            <span style="font-size:0.8rem;color:var(--color-text-muted);margin-left:0.3rem;">(Absatz ${p.paraIndex})</span>
                        </div>
                        <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                            ${catBadges}
                        </div>
                    </div>

                    <div style="font-family:var(--font-serif);font-size:1.02rem;line-height:1.7;color:var(--color-text);text-align:justify;background:var(--color-surface-alt);padding:1rem 1.25rem;border-left:3px solid var(--color-primary-light);border-radius:4px;">
                        „${escapeHtml(p.text)}“
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--color-border);padding-top:0.6rem;">
                        <button onclick="window.openDocument('${p.docId}')" style="background:none;border:none;color:var(--color-primary);font-size:0.82rem;cursor:pointer;font-weight:500;padding:0;display:inline-flex;align-items:center;gap:0.25rem;">
                            Im Kontext lesen →
                        </button>
                        <button id="btn-add-${p.id}" onclick="window.CompilationBuilder.togglePassage('${p.id}')" class="${isAdded ? 'btn-secondary' : 'btn-primary'}" style="font-size:0.82rem;padding:0.35rem 0.8rem;font-weight:600;">
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
            btn.className = isAdded ? 'btn-secondary' : 'btn-primary';
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
        if (!container) return;

        if (badge) {
            badge.textContent = `${draft.passages.length} ${draft.passages.length === 1 ? 'Absatz' : 'Absätze'}`;
        }

        if (draft.passages.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: var(--color-text-muted); padding: 2.5rem 1rem; font-style: italic; font-size: 0.95rem;">
                    Noch keine Absätze ausgewählt.<br>Klicken Sie links bei einem Absatz auf <strong>„+ In Kompilation“</strong>.
                </p>
            `;
            return;
        }

        container.innerHTML = draft.passages.map((p, idx) => `
            <div class="draft-item" style="background:var(--color-surface-alt);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:0.85rem;display:flex;flex-direction:column;gap:0.4rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:var(--color-text-muted);">
                    <span><strong>#${idx + 1}</strong> • ${p.date || '—'} — ${escapeHtml(p.title)} (Abs. ${p.paraIndex})</span>
                    <div style="display:flex;gap:0.25rem;">
                        ${idx > 0 ? `<button onclick="window.CompilationBuilder.movePassage(${idx}, -1)" class="icon-btn" style="padding:0.2rem 0.4rem;" title="Nach oben"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg></button>` : ''}
                        ${idx < draft.passages.length - 1 ? `<button onclick="window.CompilationBuilder.movePassage(${idx}, 1)" class="icon-btn" style="padding:0.2rem 0.4rem;" title="Nach unten"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` : ''}
                        <button onclick="window.CompilationBuilder.removePassage(${idx})" class="icon-btn" style="padding:0.2rem 0.4rem;color:#d93025;" title="Entfernen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                </div>

                <div style="font-family:var(--font-serif);font-size:0.92rem;line-height:1.45;color:var(--color-text);max-height:80px;overflow:hidden;text-overflow:ellipsis;">
                    „${escapeHtml(p.text)}“
                </div>

                <div style="margin-top:0.35rem;">
                    <input type="text" value="${escapeHtml(p.userNote || '')}" onchange="window.CompilationBuilder.updateNote(${idx}, this.value)" placeholder="Notiz / Leitfrage zu diesem Absatz hinzufügen..." style="width:100%;font-size:0.78rem;padding:0.3rem 0.5rem;border:1px dashed var(--color-border);border-radius:3px;background:var(--color-surface);color:var(--color-text);">
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
                btn.className = 'btn-primary';
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
        updateNote: updateNote
    };
})();
