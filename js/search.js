let fuse;
let searchDocuments = [];
let currentSearchResults = [];
let renderedCount = 0;
const SEARCH_PAGE_SIZE = 30;

window.initSearch = function(documents) {
    searchDocuments = documents;
    
    // Configure Fuse.js for fuzzy search
    const options = {
        includeMatches: true,
        includeScore: true,
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
        keys: [
            { name: 'title', weight: 3 },
            { name: 'topics', weight: 2 },
            { name: 'type', weight: 1.5 },
            { name: 'tierName', weight: 1.2 },
            { name: 'subTierName', weight: 1.2 },
            { name: 'source', weight: 1 },
            { name: 'language', weight: 0.8 },
            { name: 'text', weight: 0.7 }
        ]
    };
    
    if (typeof Fuse !== 'undefined') {
        fuse = new Fuse(searchDocuments, options);
    } else {
        console.warn('Fuse.js nicht verfügbar — verwende integrierte Suche');
        fuse = {
            search: function(q) {
                const lower = q.toLowerCase();
                return searchDocuments.filter(d => 
                    (d.title || '').toLowerCase().includes(lower) ||
                    (d.topics || []).some(t => t.toLowerCase().includes(lower)) ||
                    (d.type || '').toLowerCase().includes(lower) ||
                    (d.source || '').toLowerCase().includes(lower)
                ).map(d => ({ item: d }));
            }
        };
    }
    
    // Populate topic filter dynamically
    populateTopicFilter();
    
    // Event Listeners
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const filterTier = document.getElementById('filter-tier');
    const filterSubTier = document.getElementById('filter-subtier');
    const filterLang = document.getElementById('filter-lang');
    const filterYear = document.getElementById('filter-year');
    const filterType = document.getElementById('filter-type');
    const filterTopic = document.getElementById('filter-topic');
    const sortBy = document.getElementById('sort-by');
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(window.performSearch, 250);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.performSearch();
            }
        });
    }
    
    if (searchBtn) searchBtn.addEventListener('click', window.performSearch);
    
    if (filterTier) {
        filterTier.addEventListener('change', () => {
            const groupSubTier = document.getElementById('group-filter-subtier');
            if (groupSubTier) {
                if (filterTier.value === 'institutions' || filterTier.value === '') {
                    groupSubTier.style.display = 'flex';
                } else {
                    groupSubTier.style.display = 'none';
                    if (filterSubTier) filterSubTier.value = '';
                }
            }
            window.performSearch();
        });
    }
    
    if (filterSubTier) filterSubTier.addEventListener('change', window.performSearch);
    if (filterLang) filterLang.addEventListener('change', window.performSearch);
    if (filterYear) filterYear.addEventListener('change', window.performSearch);
    if (filterType) filterType.addEventListener('change', window.performSearch);
    if (filterTopic) filterTopic.addEventListener('change', window.performSearch);
    if (sortBy) sortBy.addEventListener('change', window.performSearch);
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            renderMoreResults();
        });
    }
    
    // Initial search render
    window.performSearch();
};

function populateTopicFilter() {
    const select = document.getElementById('filter-topic');
    if (!select) return;
    
    const topicCounts = {};
    searchDocuments.forEach(doc => {
        if (doc.topics && Array.isArray(doc.topics)) {
            doc.topics.forEach(topic => {
                topicCounts[topic] = (topicCounts[topic] || 0) + 1;
            });
        }
    });
    
    const sortedTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1]);
    
    select.innerHTML = '<option value="">Alle</option>';
    
    sortedTopics.forEach(([topic, count]) => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = `${topic} (${count})`;
        select.appendChild(option);
    });
}

window.performSearch = function() {
    if (!searchDocuments || searchDocuments.length === 0) return;
    
    const query = (document.getElementById('search-input') ? document.getElementById('search-input').value : '').trim();
    const tierFilter = document.getElementById('filter-tier') ? document.getElementById('filter-tier').value : '';
    const subTierFilter = document.getElementById('filter-subtier') ? document.getElementById('filter-subtier').value : '';
    const langFilter = document.getElementById('filter-lang') ? document.getElementById('filter-lang').value : '';
    const yearFilter = document.getElementById('filter-year') ? document.getElementById('filter-year').value : '';
    const typeFilter = document.getElementById('filter-type') ? document.getElementById('filter-type').value : '';
    const topicFilter = document.getElementById('filter-topic') ? document.getElementById('filter-topic').value : '';
    const sortValue = document.getElementById('sort-by') ? document.getElementById('sort-by').value : 'relevance';
    
    let results = [];
    
    if (query === '') {
        results = searchDocuments.map(doc => ({ item: doc, matches: [] }));
    } else {
        results = fuse.search(query);
        if (typeof window.trackEvent === 'function') {
            window.trackEvent('search', { query: query.slice(0, 60), count: results.length });
        }
    }
    
    // Apply filters
    results = results.filter(result => {
        const doc = result.item;
        if (tierFilter && doc.tier !== tierFilter) return false;
        if (subTierFilter && doc.subTier !== subTierFilter) return false;
        if (langFilter && (doc.language || 'deutsch').toLowerCase() !== langFilter.toLowerCase()) return false;
        if (yearFilter && doc.year != yearFilter) return false;
        if (typeFilter && doc.type !== typeFilter) return false;
        if (topicFilter && (!doc.topics || !doc.topics.includes(topicFilter))) return false;
        return true;
    });
    
    // Apply sorting
    if (sortValue === 'date-desc') {
        results.sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
    } else if (sortValue === 'date-asc') {
        results.sort((a, b) => (a.item.date || '').localeCompare(b.item.date || ''));
    } else if (sortValue === 'relevance' && query !== '') {
        results.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else if (query === '') {
        results.sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''));
    }

    // Zweisprachige Zusammenfuehrung in der Suche: ein Werk als eine Karte darstellen
    if (!langFilter) {
        const unifiedSearchMap = new Map();
        results.forEach(res => {
            const d = res.item;
            const key = d.groupId || d.id;
            if (!unifiedSearchMap.has(key)) {
                unifiedSearchMap.set(key, res);
            } else {
                const existing = unifiedSearchMap.get(key);
                // Deutsches Dokument bevorzugen, falls verfuegbar
                if ((d.language || '').toLowerCase() === 'deutsch' && (existing.item.language || '').toLowerCase() !== 'deutsch') {
                    d.formatFiles = Object.assign({}, existing.item.formatFiles, d.formatFiles);
                    d.availableFormats = Array.from(new Set([...(existing.item.availableFormats || []), ...(d.availableFormats || [])]));
                    res.matches = (res.matches && res.matches.length > 0) ? res.matches : existing.matches;
                    unifiedSearchMap.set(key, res);
                } else {
                    existing.item.formatFiles = Object.assign({}, existing.item.formatFiles, d.formatFiles);
                    existing.item.availableFormats = Array.from(new Set([...(existing.item.availableFormats || []), ...(d.availableFormats || [])]));
                }
            }
        });
        results = Array.from(unifiedSearchMap.values());
    }
    
    currentSearchResults = results;
    renderedCount = 0;
    
    const container = document.getElementById('search-results');
    const infoContainer = document.getElementById('results-info');
    if (container) container.innerHTML = '';
    
    if (infoContainer) {
        infoContainer.innerHTML = `<p><strong>${results.length}</strong> ${results.length === 1 ? 'Dokument' : 'Dokumente'} gefunden</p>`;
    }
    
    if (results.length === 0) {
        if (container) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 2rem;">Keine Dokumente gefunden, die den Kriterien entsprechen.</p>';
        }
        updateLoadMoreButton();
        return;
    }
    
    renderMoreResults();
};

function renderMoreResults() {
    const container = document.getElementById('search-results');
    if (!container || currentSearchResults.length === 0) return;
    
    const nextBatch = currentSearchResults.slice(renderedCount, renderedCount + SEARCH_PAGE_SIZE);
    
    let html = '';
    nextBatch.forEach((result, idx) => {
        const doc = result.item;
        let snippet = '';
        
        // Generate highlighted snippet from search matches
        if (result.matches && result.matches.length > 0) {
            const textMatch = result.matches.find(m => m.key === 'text');
            if (textMatch && textMatch.indices && textMatch.indices.length > 0) {
                let bestMatch = textMatch.indices.reduce((best, curr) => 
                    (curr[1] - curr[0]) > (best[1] - best[0]) ? curr : best
                , textMatch.indices[0]);
                
                const [start, end] = bestMatch;
                const contextLen = 90;
                const snippetStart = Math.max(0, start - contextLen);
                const snippetEnd = Math.min((doc.text || '').length, end + contextLen);
                
                let rawSnippet = (doc.text || '').substring(snippetStart, snippetEnd);
                const relativeStart = Math.max(0, start - snippetStart);
                const relativeEnd = Math.min(rawSnippet.length, end - snippetStart);
                
                snippet = escapeHtml(rawSnippet.substring(0, relativeStart)) + 
                          '<mark>' + escapeHtml(rawSnippet.substring(relativeStart, relativeEnd + 1)) + '</mark>' +
                          escapeHtml(rawSnippet.substring(relativeEnd + 1));
            }
        }
        
        html += window.createDocCard ? window.createDocCard(doc, snippet, idx) : '';
    });
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
    }
    
    renderedCount += nextBatch.length;
    updateLoadMoreButton();
}

function updateLoadMoreButton() {
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!loadMoreContainer) return;
    
    if (renderedCount < currentSearchResults.length) {
        loadMoreContainer.style.display = 'block';
        if (loadMoreBtn) {
            loadMoreBtn.textContent = `Mehr anzeigen (${renderedCount} von ${currentSearchResults.length})`;
        }
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
