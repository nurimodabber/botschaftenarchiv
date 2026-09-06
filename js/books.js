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
        { id: 'all', name: 'Alle Werke', short: 'Alle' },
        { id: 'bahaullah', name: 'Bahá\'u\'lláh', short: 'Bahá\'u\'lláh', role: 'Offenbarer' },
        { id: 'the-bab', name: 'Der Báb', short: 'Der Báb', role: 'Herold' },
        { id: 'abdul-baha', name: '‘Abdu’l-Bahá', short: '‘Abdu’l-Bahá', role: 'Ausleger' },
        { id: 'shoghi-effendi', name: 'Shoghi Effendi', short: 'Shoghi Effendi', role: 'Hüter' },
        { id: 'uhj', name: 'Universales Haus d. G.', short: 'Haus d. Gerechtigkeit', role: 'Oberster Rat' },
        { id: 'prayers', name: 'Gebete & Andacht', short: 'Gebete', role: 'Andacht' },
        { id: 'compilations', name: 'Kompilationen', short: 'Kompilationen', role: 'Themenreihen' }
    ];

    function init() {
        renderBooksView();
        renderBooksList();
    }

    function renderBooksView() {
        const container = document.getElementById('view-books');
        if (!container) return;

        const allDocs = window.state ? (window.state.documents || []) : [];
        const booksDocs = allDocs.filter(d => d.tier === 'books');

        container.innerHTML = `
            <div class="view-header" style="max-width: 960px; margin: 0 auto 2rem; text-align: center;">
                <div class="editorial-eyebrow">Heilige Schriften &amp; Primärliteratur // Autorisierter Kanon</div>
                <h2 class="editorial-headline">Schriften &amp; Bücher</h2>
                <p class="editorial-lead">
                    Die maßgeblichen heiligen Schriften und autorisierten Werke der Zentralen Gestalten des Bahá'í-Glaubens, Shoghi Effendis und des Universalen Hauses der Gerechtigkeit aus der Bahá'í Reference Library und der Bahá'í-Bibliothek.
                </p>

                <!-- Suchfeld für Bücher -->
                <div class="library-search-box" style="margin-top: 1.5rem;">
                    <svg class="search-box-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="books-search-input" placeholder="Buchtitel, Begriff oder Verfasser suchen..." value="${currentSearchQuery}" oninput="window.BooksModule.setSearch(this.value)">
                </div>

                <!-- Autoren-Leiste -->
                <div class="books-authors-nav">
                    ${AUTHORS.map(a => `
                        <button class="author-pill ${currentAuthor === a.id ? 'active' : ''}" onclick="window.BooksModule.setAuthor('${a.id}')">
                            <span class="author-pill-title">${a.short}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Untere Filter: Sprache & Sortierung -->
                <div class="books-filter-bar">
                    <select id="books-lang-select" class="apple-select" onchange="window.BooksModule.setLang(this.value)">
                        <option value="all" ${currentLang === 'all' ? 'selected' : ''}>Alle Sprachen</option>
                        <option value="deutsch" ${currentLang === 'deutsch' ? 'selected' : ''}>Deutsch (Bahá'í-Bibliothek)</option>
                        <option value="english" ${currentLang === 'english' ? 'selected' : ''}>English (Reference Library)</option>
                    </select>

                    <select id="books-sort-select" class="apple-select" onchange="window.BooksModule.setSort(this.value)">
                        <option value="author" ${currentSort === 'author' ? 'selected' : ''}>Nach Verfasser sortieren</option>
                        <option value="title" ${currentSort === 'title' ? 'selected' : ''}>Titel A–Z</option>
                        <option value="length" ${currentSort === 'length' ? 'selected' : ''}>Nach Umfang (Wortanzahl)</option>
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
            books = books.filter(b => (b.language || '').toLowerCase() === currentLang.toLowerCase());
        }

        // Filter: Suche
        if (currentSearchQuery.trim()) {
            const q = currentSearchQuery.trim().toLowerCase();
            books = books.filter(b =>
                (b.title || '').toLowerCase().includes(q) ||
                (b.subtitle || '').toLowerCase().includes(q) ||
                (b.author || '').toLowerCase().includes(q) ||
                (b.excerpt || '').toLowerCase().includes(q)
            );
        }

        // Sortierung
        if (currentSort === 'author') {
            const order = ['bahaullah', 'the-bab', 'abdul-baha', 'shoghi-effendi', 'uhj', 'prayers', 'compilations'];
            books.sort((a, b) => {
                const idxA = order.indexOf(a.authorCode || a.subTier || '');
                const idxB = order.indexOf(b.authorCode || b.subTier || '');
                if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                return (a.title || '').localeCompare(b.title || '');
            });
        } else if (currentSort === 'title') {
            books.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (currentSort === 'length') {
            books.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
        }

        if (info) {
            info.textContent = `${books.length} Schriften und Bücher gefunden`;
        }

        if (books.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; color: var(--text-muted);">
                    <p style="font-family: var(--font-serif-display); font-size: 1.15rem; margin-bottom: 0.75rem;">Keine Bücher für die ausgewählten Kriterien gefunden.</p>
                    <button class="btn-secondary" onclick="window.BooksModule.resetFilters()">Filter zurücksetzen</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = books.map((book, idx) => createBookCard(book, idx)).join('');
    }

    function createBookCard(book, idx) {
        const isEn = (book.language || '').toLowerCase() === 'english';
        const langBadge = isEn ? '<span class="book-lang-badge en">EN</span>' : '<span class="book-lang-badge de">DE</span>';
        const authorName = book.author || 'Bahá\'í-Literatur';
        const authorRole = book.role ? `<span class="book-author-role">${book.role}</span>` : '';
        const words = book.wordCount ? `&bull; ca. ${book.wordCount.toLocaleString('de-DE')} Wörter` : '';
        const sourceLabel = book.source === 'bahai.org' ? 'Bahá\'í Reference Library' : 'Bahá\'í-Bibliothek';

        return `
            <article class="book-plate-card" data-id="${book.id}">
                <div class="book-card-spine"></div>
                <div class="book-card-content">
                    <div class="book-card-header">
                        <div class="book-author-line">
                            <span class="book-author-name">${authorName}</span>
                            ${authorRole}
                        </div>
                        ${langBadge}
                    </div>

                    <h3 class="book-card-title" onclick="window.openViewer('${book.id}')" title="${book.title}">${book.title}</h3>
                    ${book.subtitle ? `<div class="book-card-subtitle">${book.subtitle}</div>` : ''}

                    <p class="book-card-excerpt">${book.excerpt || 'Vollständiges Werk im Studienarchiv verfügbar.'}</p>

                    <div class="book-card-meta">
                        <span class="book-source-tag">${sourceLabel}</span>
                        <span class="book-words-tag">${words}</span>
                    </div>

                    <div class="book-card-actions">
                        <button class="book-read-btn" onclick="window.openViewer('${book.id}')" title="Im Reader lesen">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            <span>Lesen</span>
                        </button>
                        ${book.filePath ? `
                            <a href="${book.filePath}" download class="book-dl-btn" title="PDF herunterladen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>PDF</span>
                            </a>
                        ` : ''}
                        <button class="book-bookmark-btn ${window.isBookmarked && window.isBookmarked(book.id) ? 'bookmarked' : ''}" onclick="window.toggleBookmark('${book.id}'); this.classList.toggle('bookmarked');" title="Zur Merkliste hinzufügen">
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
