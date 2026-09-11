/**
 * state.js
 * Globaler Anwendungs-Status & LocalStorage-Hilfsfunktionen.
 * Wird als erste Script-Datei geladen, damit alle nachfolgenden Module
 * sofort auf einen definierten State und Storage-Helper zugreifen koennen.
 */
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

window.trackEvent = function(name, data = {}) {
    if (typeof window.va === 'function') {
        try {
            window.va('event', { name, ...data });
        } catch (e) {}
    }
};

window.state = {
    documents: [],
    idAliases: {},
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

function escapeDocHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeDocHtml = escapeDocHtml;
window.escapeHtml = escapeDocHtml;
