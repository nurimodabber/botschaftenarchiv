/**
 * books.js
 * Modul für Bahá'í-Schriften & Bücher (Bahá'í Reference Library & Bahá'í-Bibliothek)
 */

window.BooksModule = (function() {
    let currentAuthor = 'all';
    let currentLang = 'all';
    let currentSearchQuery = '';
    let currentSort = 'author';

    const AUTHORS = [
        { id: 'all', nameDe: 'Alle Werke', shortDe: 'Alle', nameEn: 'All Works', shortEn: 'All' },
        { id: 'bahaullah', nameDe: 'Bahá\'u\'lláh', shortDe: 'Bahá\'u\'lláh', nameEn: 'Bahá\'u\'lláh', shortEn: 'Bahá\'u\'lláh', roleDe: 'Offenbarer', roleEn: 'Manifestation' },
        { id: 'the-bab', nameDe: 'Der Báb', shortDe: 'Der Báb', nameEn: 'The Báb', shortEn: 'The Báb', roleDe: 'Herold', roleEn: 'Herald' },
        { id: 'abdul-baha', nameDe: '‘Abdu’l-Bahá', shortDe: '‘Abdu’l-Bahá', nameEn: '‘Abdu’l-Bahá', shortEn: '‘Abdu’l-Bahá', roleDe: 'Ausleger', roleEn: 'Centre of Covenant' },
        { id: 'shoghi-effendi', nameDe: 'Shoghi Effendi', shortDe: 'Shoghi Effendi', nameEn: 'Shoghi Effendi', shortEn: 'Shoghi Effendi', roleDe: 'Hüter', roleEn: 'Guardian' },
        { id: 'uhj', nameDe: 'Universales Haus d. G.', shortDe: 'Haus d. Gerechtigkeit', nameEn: 'Universal House of Justice', shortEn: 'House of Justice', roleDe: 'Oberster Rat', roleEn: 'Supreme Body' },
        { id: 'prayers', nameDe: 'Gebete & Andacht', shortDe: 'Gebete', nameEn: 'Prayers & Devotions', shortEn: 'Prayers', roleDe: 'Andacht', roleEn: 'Devotions' },
        { id: 'compilations', nameDe: 'Kompilationen', shortDe: 'Kompilationen', nameEn: 'Compilations', shortEn: 'Compilations', roleDe: 'Themenreihen', roleEn: 'Themes' }
    ];

    function init() {
        if (window.I18n && window.I18n.onLanguageChange) {
            window.I18n.onLanguageChange(function(lang) {
                renderBooksView();
                renderBooksList();
            });
        }
        renderBooksView();
        renderBooksList();
    }

    function renderBooksView() {
        const container = document.getElementById('view-books');
        if (!container) return;

        const isEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');
        const allDocs = window.state ? (window.state.documents || []) : [];
        const booksDocs = allDocs.filter(d => d.tier === 'books');

        container.innerHTML = `
            <div class="view-header" style="max-width: 960px; margin: 0 auto 1.25rem; text-align: center;">
                <h2 class="editorial-headline">${isEn ? 'Sacred Writings &amp; Books' : 'Schriften &amp; Bücher'}</h2>

                <!-- Suchfeld für Bücher -->
                <div class="library-search-box" style="margin-top: 1.5rem;">
                    <svg class="search-box-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="books-search-input" placeholder="${isEn ? 'Search book title, term or author...' : 'Buchtitel, Begriff oder Verfasser suchen...'}" value="${escapeHtml(currentSearchQuery)}" oninput="window.BooksModule.setSearch(this.value)">
                </div>

                <!-- Autoren-Leiste -->
                <div class="books-authors-nav">
                    ${AUTHORS.map(a => `
                        <button class="author-pill ${currentAuthor === a.id ? 'active' : ''}" onclick="window.BooksModule.setAuthor('${a.id}')">
                            <span class="author-pill-title">${escapeHtml(isEn ? a.shortEn : a.shortDe)}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Untere Filter: Sprache & Sortierung -->
                <div class="books-filter-bar">
                    <select id="books-lang-select" class="apple-select" onchange="window.BooksModule.setLang(this.value)">
                        <option value="all" ${currentLang === 'all' ? 'selected' : ''}>${isEn ? 'All Languages' : 'Alle Sprachen'}</option>
                        <option value="deutsch" ${currentLang === 'deutsch' ? 'selected' : ''}>${isEn ? 'German (Bahá’í-Bibliothek)' : 'Deutsch (Bahá’í-Bibliothek)'}</option>
                        <option value="english" ${currentLang === 'english' ? 'selected' : ''}>${isEn ? 'English (Reference Library)' : 'English (Reference Library)'}</option>
                    </select>

                    <select id="books-sort-select" class="apple-select" onchange="window.BooksModule.setSort(this.value)">
                        <option value="author" ${currentSort === 'author' ? 'selected' : ''}>${isEn ? 'Sort by Author' : 'Nach Verfasser sortieren'}</option>
                        <option value="chronological" ${currentSort === 'chronological' ? 'selected' : ''}>${isEn ? 'Chronological / Creation year' : 'Nach Entstehungsjahr / Chronologie'}</option>
                        <option value="title" ${currentSort === 'title' ? 'selected' : ''}>${isEn ? 'Title A–Z' : 'Titel A–Z'}</option>
                        <option value="length" ${currentSort === 'length' ? 'selected' : ''}>${isEn ? 'By length (word count)' : 'Nach Umfang (Wortanzahl)'}</option>
                    </select>
                </div>
            </div>

            <div id="books-results-info" class="search-results-info" style="text-align: center; margin-bottom: 1.5rem;"></div>
            <div id="books-grid" class="books-grid"></div>
        `;
    }

    function renderBooksList() {
        const grid = document.getElementById('books-grid');
        const info = document.getElementById('books-results-info');
        if (!grid) return;

        const allDocs = window.state ? (window.state.documents || []) : [];
        let books = allDocs.filter(d => d.tier === 'books');

        // Filter: Autor
        if (currentAuthor !== 'all') {
            books = books.filter(b => b.subTier === currentAuthor || b.authorCode === currentAuthor);
        }

        // Filter: Sprache
        if (currentLang !== 'all') {
            books = books.filter(b => {
                const l = (b.language || '').toLowerCase();
                if (currentLang === 'deutsch') return l === 'deutsch' || l === 'german';
                if (currentLang === 'english') return l === 'english';
                return l === currentLang.toLowerCase();
            });
        }

        // Filter: Suche (Titel, Untertitel, Autor, Auszug & Volltext)
        if (currentSearchQuery.trim()) {
            const q = currentSearchQuery.trim().toLowerCase();
            const qNorm = window.normalizeSearchText ? window.normalizeSearchText(q) : q;
            const fullTexts = window.state ? window.state.fullTexts : null;
            const normTexts = window.state ? window.state.normalizedFullTexts : null;

            books = books.filter(b => {
                const titleMatch = (b.title && b.title.toLowerCase().includes(q)) ||
                                   (b.subtitle && b.subtitle.toLowerCase().includes(q)) ||
                                   (b.author && b.author.toLowerCase().includes(q)) ||
                                   (b.excerpt && b.excerpt.toLowerCase().includes(q));
                if (titleMatch) return true;
                if (normTexts && normTexts[b.id] && normTexts[b.id].includes(qNorm)) return true;
                if (fullTexts && fullTexts[b.id] && fullTexts[b.id].toLowerCase().includes(q)) return true;
                return false;
            });
        }

        // Sortierung
        if (currentSort === 'title') {
            books.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
        } else if (currentSort === 'length') {
            books.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
        } else if (currentSort === 'chronological') {
            books.sort((a, b) => {
                const ya = a.year || 0;
                const yb = b.year || 0;
                if (ya !== yb) return ya - yb;
                return (a.title || '').localeCompare(b.title || '', 'de');
            });
        } else {
            // Standard: nach Autor und innerhalb des Autors chronologisch
            const authorOrder = ['bahaullah', 'the-bab', 'abdul-baha', 'shoghi-effendi', 'uhj', 'prayers', 'compilations'];
            books.sort((a, b) => {
                const iA = authorOrder.indexOf(a.authorCode || a.subTier || '');
                const iB = authorOrder.indexOf(b.authorCode || b.subTier || '');
                if (iA !== iB && iA !== -1 && iB !== -1) return iA - iB;
                const ya = a.year || 0;
                const yb = b.year || 0;
                if (ya !== yb) return ya - yb;
                return (a.title || '').localeCompare(b.title || '', 'de');
            });
        }

        // Ergebnis-Zähler
        const isMasterEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');
        info.innerHTML = `
            <span><strong>${books.length}</strong> ${isMasterEn ? 'authorized works &amp; publications found' : 'autorisierte Werke &amp; Publikationen gefunden'}</span>
            ${currentAuthor !== 'all' || currentLang !== 'all' || currentSearchQuery ? `<button class="btn-clear-filter" onclick="window.BooksModule.resetFilters()">${isMasterEn ? 'Reset filters' : 'Filter zurücksetzen'}</button>` : ''}
        `;

        if (books.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
                    <p style="font-family: var(--font-serif-display); font-size: 1.15rem; margin-bottom: 0.75rem;">${isMasterEn ? 'No books found matching the selected criteria.' : 'Keine Bücher für die ausgewählten Kriterien gefunden.'}</p>
                    <button class="btn-secondary" onclick="window.BooksModule.resetFilters()">${isMasterEn ? 'Reset filters' : 'Filter zurücksetzen'}</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = books.map((book, idx) => createBookCard(book, idx)).join('');
    }

    function createBookCard(book, idx) {
        const isMasterEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');
        const isEn = (book.language || '').toLowerCase() === 'english';
        const langBadge = isEn ? '<span class="book-lang-badge en">EN</span>' : '<span class="book-lang-badge de">DE</span>';
        const authorName = book.author || (isMasterEn ? 'Bahá\'í Literature' : 'Bahá\'í-Literatur');
        const authorRole = book.role ? `<span class="book-author-role">${book.role}</span>` : '';
        const words = book.wordCount ? `&bull; ${isMasterEn ? '~' : 'ca.'} ${book.wordCount.toLocaleString(isMasterEn ? 'en-US' : 'de-DE')} ${isMasterEn ? 'words' : 'Wörter'}` : '';
        const sourceLabel = book.sourcePlatform || (book.source === 'bahai.org' ? 'Bahá\'í Reference Library' : 'Bahá\'í-Bibliothek');

        // Multi-format buttons
        const files = book.formatFiles || {};
        const formatPills = [];
        if (files.pdf || book.filePath) formatPills.push(`<a href="${files.pdf || book.filePath}" download class="format-pill-btn" title="${isMasterEn ? 'Download PDF' : 'PDF herunterladen'}">PDF</a>`);
        if (files.docx) formatPills.push(`<a href="${files.docx}" download class="format-pill-btn" title="${isMasterEn ? 'Download Word (.docx)' : 'Word (.docx) herunterladen'}">DOCX</a>`);
        if (files.epub) formatPills.push(`<a href="${files.epub}" download class="format-pill-btn" title="${isMasterEn ? 'Download E-Book (.epub)' : 'E-Book (.epub) herunterladen'}">EPUB</a>`);
        if (files.txt) formatPills.push(`<a href="${files.txt}" download class="format-pill-btn" title="${isMasterEn ? 'Download Full Text (.txt)' : 'Volltext (.txt) herunterladen'}">TXT</a>`);

        const safeBookId = (book.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        return `
            <article class="book-plate-card" data-id="${book.id}" data-doc-id="${escapeHtml(book.id)}">
                <div class="book-card-spine"></div>
                <div class="book-card-content">
                    <div class="book-card-header">
                        <div class="book-author-line">
                            <span class="book-author-name">${authorName}</span>
                            ${authorRole}
                        </div>
                        <div style="display: flex; gap: 0.35rem; align-items: center;">
                            <span class="book-format-badge">PDF</span>
                            ${files.epub ? `<span class="book-format-badge epub">EPUB</span>` : ''}
                            ${book.year ? `<span class="book-year-badge">${book.year}</span>` : ''}
                            ${langBadge}
                        </div>
                    </div>

                    <h3 class="book-card-title" onclick="window.openDocument('${safeBookId}')" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
                    ${book.subtitle ? `<div class="book-card-subtitle">${escapeHtml(book.subtitle)}</div>` : ''}

                    ${book.excerpt && book.excerpt !== 'Vollständiges autorisiertes Werk im Studienarchiv verfügbar.' && book.excerpt.trim().length > 0 ? `
                        <p class="book-card-excerpt">${escapeHtml(book.excerpt)}</p>
                    ` : ''}

                    <div class="book-card-meta">
                        <span class="book-source-tag">${escapeHtml(sourceLabel)}</span>
                        <span class="book-words-tag">${words}</span>
                    </div>

                    ${formatPills.length > 0 ? `
                        <div class="book-card-formats-row" style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem;">
                            ${formatPills.join('')}
                        </div>
                    ` : ''}

                    <div class="book-card-actions">
                        <button class="book-read-btn" onclick="window.openDocument('${safeBookId}')" title="${isMasterEn ? 'Read in reader (full text &amp; paragraphs)' : 'Im Reader lesen (Volltext &amp; Absätze)'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            <span>${isMasterEn ? 'Read' : 'Lesen'}</span>
                        </button>
                        ${book.sourceUrl ? `
                            <a href="${escapeHtml(book.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="source-link-icon-btn" title="${isMasterEn ? `Open on official source (${escapeHtml(book.sourcePlatform || 'Official Source')})` : `Auf autorisierter Original-Website öffnen (${escapeHtml(book.sourcePlatform || 'Offizielle Quelle')})`}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>
                        ` : ''}
                        <button class="book-bookmark-btn ${window.isBookmarked && window.isBookmarked(book.id) ? 'bookmarked' : ''}" onclick="window.toggleBookmark('${safeBookId}'); this.classList.toggle('bookmarked');" title="${isMasterEn ? 'Add to bookmarks' : 'Zur Merkliste hinzufügen'}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function setAuthor(authorId) {
        currentAuthor = authorId;
        renderBooksView();
        renderBooksList();
    }

    function setLang(lang) {
        currentLang = lang;
        renderBooksList();
    }

    function setSort(sort) {
        currentSort = sort;
        renderBooksList();
    }

    function setSearch(query) {
        currentSearchQuery = query;
        renderBooksList();
    }

    function resetFilters() {
        currentAuthor = 'all';
        currentLang = 'all';
        currentSearchQuery = '';
        currentSort = 'author';
        renderBooksView();
        renderBooksList();
    }

    return {
        init,
        setAuthor,
        setLang,
        setSort,
        setSearch,
        resetFilters,
        renderBooksList
    };
})();
