/**
 * collections.js
 */
(function() {
/**
 * collections.js
 * Verwaltet Sammlungen, Kompilationen, Ruhi-Buecher, Merkliste und Leseverlauf.
 */

const safeGetStorage = window.safeGetStorage || function(k, d) { try { const v = localStorage.getItem(k); return v !== null ? v : d; } catch(e) { return d; } };
const escapeDocHtml = window.escapeDocHtml || function(s){ return String(s||"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); };
    const safeSetStorage = window.safeSetStorage || function(k, v) { try { localStorage.setItem(k, v); } catch(e) {} };

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

    const comps = (window.state ? window.state.documents : []).filter(d => 
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

        const safeCompId = (mainDoc.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
            <div class="doc-card compilation-card" style="--i: ${idx % 30}; cursor: pointer;" data-doc-id="${escapeDocHtml(mainDoc.id)}" onclick="window.openDocument('${safeCompId}')">
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

    const ruhiDocs = (window.state ? window.state.documents : []).filter(d => 
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
        const safeRuhiId = (doc.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
            <div class="ruhi-card" style="--i: ${idx % 30};" data-doc-id="${escapeDocHtml(doc.id)}" onclick="window.openDocument('${safeRuhiId}')">
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

    const studyDocs = (window.state ? window.state.documents : []).filter(d => 
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
    
    if (countBookmarks) countBookmarks.textContent = (window.state ? window.state.bookmarks : []).length;
    
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
    (window.state ? window.state.documents : []).forEach(d => docMap.set(d.id, d));

    const htmlCards = history.map((item, idx) => {
        const fullDoc = docMap.get(item.id);
        if (fullDoc) {
            return window.createDocCard(fullDoc, '', idx);
        }
        const safeItemId = (item.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
            <article class="doc-card" style="--i: ${idx % 30}; cursor: pointer;" data-doc-id="${escapeDocHtml(item.id)}" onclick="window.openDocument('${safeItemId}')">
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

    const bookmarkedDocs = (window.state ? window.state.documents : []).filter(doc => (window.state ? window.state.bookmarks : []).includes(doc.id));

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
    const index = (window.state ? window.state.bookmarks : []).indexOf(id);
    if (index > -1) {
        (window.state ? window.state.bookmarks : []).splice(index, 1);
    } else {
        (window.state ? window.state.bookmarks : []).push(id);
    }
    safeSetStorage('bookmarks', JSON.stringify((window.state ? window.state.bookmarks : [])));
    
    // Update viewer icon if open
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    if (bookmarkBtn) {
        if ((window.state ? window.state.bookmarks : []).includes(id)) {
            bookmarkBtn.style.color = 'var(--color-primary)';
            bookmarkBtn.querySelector('svg')?.setAttribute('fill', 'currentColor');
        } else {
            bookmarkBtn.style.color = '';
            bookmarkBtn.querySelector('svg')?.setAttribute('fill', 'none');
        }
    }
    
    if ((window.state ? window.state.currentView : "") === 'saved') {
        renderSavedView();
    }
};

window.CollectionsModule = {
    initCollectionsView,
    switchCollectionsSubview,
    renderCompilations,
    renderRuhiBooks,
    renderStudyMaterial,
    renderSavedView,
    renderReadingHistory,
    renderBookmarks,
    renderSavedCompilationsList
};
window.renderSavedView = renderSavedView;
window.initCollectionsView = initCollectionsView;
window.switchCollectionsSubview = switchCollectionsSubview;
window.renderCompilations = renderCompilations;
window.renderRuhiBooks = renderRuhiBooks;
window.renderStudyMaterial = renderStudyMaterial;
window.renderReadingHistory = renderReadingHistory;
window.renderBookmarks = renderBookmarks;
window.renderSavedCompilationsList = renderSavedCompilationsList;

})();
