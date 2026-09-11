/**
 * filters.js
 */
(function() {
/**
 * filters.js
 * Kontextuelle Filter-Optionen, Drawer-Steuerung und Such-Snippet-Extraktion.
 */
const safeGetStorage = window.safeGetStorage || function(k, d) { try { const v = localStorage.getItem(k); return v !== null ? v : d; } catch(e) { return d; } };


function updateDrawerFilterOptions(segment) {
    const isEn = (window.I18n && typeof window.I18n.getLanguage === 'function' ? window.I18n.getLanguage() === 'en' : false) || (safeGetStorage('cosmos_master_lang', 'de') === 'en');
    const recipLabel = document.getElementById('filter-label-recipient');
    const recipSelect = document.getElementById('library-recipient-select');
    const epochLabel = document.getElementById('filter-label-epoch');
    const epochSelect = document.getElementById('library-epoch-select');
    const typeLabel = document.getElementById('filter-label-type');
    const typeSelect = document.getElementById('library-type-select');

    if (!recipSelect || !epochSelect || !typeSelect) return;

    if (segment === 'books') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Author' : 'Autor / Verfasser';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Authors' : 'Alle Verfasser'}</option>
            <option value="bahaullah">Bahá’u’lláh</option>
            <option value="the-bab">Der Báb</option>
            <option value="abdul-baha">‘Abdu’l-Bahá</option>
            <option value="shoghi-effendi">Shoghi Effendi</option>
        `;
        recipSelect.value = (window.state && window.state.library).author || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Historical Era' : 'Historische Epoche';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Epochs' : 'Alle Epochen'}</option>
            <option value="bab">${isEn ? 'Era of the Báb (1844–1853)' : 'Epoche des Báb (1844–1853)'}</option>
            <option value="bahaullah">${isEn ? 'Revelation of Bahá’u’lláh (1853–1892)' : 'Offenbarung Bahá’u’lláhs (1853–1892)'}</option>
            <option value="abdulbaha">${isEn ? 'Ministry of ‘Abdu’l-Bahá (1892–1921)' : 'Dienstzeit ‘Abdu’l-Bahás (1892–1921)'}</option>
            <option value="shoghi">${isEn ? 'Guardianship of Shoghi Effendi (1921–1957)' : 'Hüterschaft Shoghi Effendis (1921–1957)'}</option>
        `;
        epochSelect.value = (window.state && window.state.library).timelineEpoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Category' : 'Werk-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Categories' : 'Alle Werk-Typen'}</option>
            <option value="scripture">${isEn ? 'Sacred Scripture' : 'Heilige Schriften'}</option>
            <option value="prayers">${isEn ? 'Prayers & Meditations' : 'Gebete & Andachten'}</option>
            <option value="letters">${isEn ? 'Letters & Tablets' : 'Briefe & Sendschreiben'}</option>
        `;
        typeSelect.value = (window.state && window.state.library).type || '';
    } else if (segment === 'compilations') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Topic' : 'Themenbereich';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Topics' : 'Alle Themen'}</option>
            <option value="prayer">${isEn ? 'Prayer & Worship' : 'Gebet & Andacht'}</option>
            <option value="marriage">${isEn ? 'Marriage & Family' : 'Ehe & Familie'}</option>
            <option value="huquq">Ḥuqúqu’lláh</option>
            <option value="consultation">${isEn ? 'Consultation & Assemblies' : 'Beratung & Geistige Räte'}</option>
            <option value="women">${isEn ? 'Equality & Women' : 'Gleichberechtigung & Frauen'}</option>
            <option value="virtues">${isEn ? 'Spiritual Virtues' : 'Geistige Eigenschaften & Tugenden'}</option>
        `;
        recipSelect.value = (window.state && window.state.library).compTopic || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Era' : 'Zeitraum';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Eras' : 'Alle Epochen'}</option>
            <option value="plans-00">${isEn ? '2000 to Present' : 'Ab 2000 bis heute'}</option>
            <option value="era-90s">${isEn ? '1980–1999' : '1980er & 1990er Jahre'}</option>
            <option value="era-early">${isEn ? 'Before 1980' : 'Vor 1980'}</option>
        `;
        epochSelect.value = (window.state && window.state.library).epoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Collection Type' : 'Sammlungs-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Collections' : 'Alle Sammlungen'}</option>
            <option value="Kompilation">${isEn ? 'Thematic Compilations' : 'Thematische Kompilationen'}</option>
        `;
        typeSelect.value = (window.state && window.state.library).type || '';
    } else if (segment === 'ruhi') {
        if (recipLabel) recipLabel.textContent = isEn ? 'Course Level' : 'Kursstufe';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Books' : 'Alle Bände'}</option>
            <option value="b1-4">${isEn ? 'Books 1–4 (Foundations)' : 'Bücher 1–4 (Grundkursfolge)'}</option>
            <option value="b5-8">${isEn ? 'Books 5–8 (Youth & Mentors)' : 'Bücher 5–8 (Jugend & Mentoren)'}</option>
            <option value="b9plus">${isEn ? 'Books 9–14 (Advanced)' : 'Bücher 9–14 (Höhere Vertiefung)'}</option>
            <option value="branch">${isEn ? 'Branch Courses' : 'Zweigkurse & Vorjugend'}</option>
        `;
        recipSelect.value = (window.state && window.state.library).ruhiGroup || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Program' : 'Programm';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Programs' : 'Alle Studienzweige'}</option>
        `;
        epochSelect.value = '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Material Type' : 'Material-Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Materials' : 'Alle Studienmaterialien'}</option>
            <option value="Ruhi-Buch">${isEn ? 'Main Sequence' : 'Hauptkursbücher'}</option>
        `;
        typeSelect.value = (window.state && window.state.library).type || '';
    } else {
        // 'house' or 'all'
        if (recipLabel) recipLabel.textContent = isEn ? 'Recipient' : 'Empfänger';
        recipSelect.innerHTML = `
            <option value="all">${isEn ? 'All Recipients' : 'Alle Empfänger'}</option>
            <option value="world">${isEn ? 'Worldwide Community' : 'Weltweite Gemeinde'}</option>
            <option value="nsa">${isEn ? 'National Spiritual Assemblies' : 'Nationale Geistige Räte'}</option>
            <option value="counsellors">${isEn ? 'Continental Counsellors' : 'Berater & Hilfsamt'}</option>
            <option value="youth">${isEn ? 'Youth' : 'Jugend'}</option>
            <option value="iran">${isEn ? 'Friends in Iran' : 'Freunde im Iran'}</option>
            <option value="institutes">${isEn ? 'Training Institutes' : 'Trainingsinstitute'}</option>
            <option value="individual">${isEn ? 'Individual Believers' : 'Einzelne Gläubige'}</option>
        `;
        recipSelect.value = (window.state && window.state.library).recipient || 'all';

        if (epochLabel) epochLabel.textContent = isEn ? 'Epoch & Plan' : 'Epoche & Plan';
        epochSelect.innerHTML = `
            <option value="">${isEn ? 'All Plans & Epochs' : 'Alle Pläne & Epochen'}</option>
            <option value="nine-year">${isEn ? 'Nine Year Plan (2022–2031)' : 'Neunjahresplan (2022–2031)'}</option>
            <option value="one-year">${isEn ? 'One Year Plan (2021–2022)' : 'Einjahresplan (2021–2022)'}</option>
            <option value="five-year-16">${isEn ? 'Five Year Plan (2016–2021)' : 'Fünfjahresplan (2016–2021)'}</option>
            <option value="plans-00">${isEn ? 'Plans 2001–2015' : 'Pläne 2001–2015'}</option>
            <option value="era-90s">${isEn ? '1990s' : '1990er Jahre'}</option>
            <option value="era-80s">${isEn ? '1980s' : '1980er Jahre'}</option>
            <option value="era-early">${isEn ? '1963–1979' : '1963–1979'}</option>
        `;
        epochSelect.value = (window.state && window.state.library).epoch || '';

        if (typeLabel) typeLabel.textContent = isEn ? 'Occasion & Type' : 'Anlass & Typus';
        typeSelect.innerHTML = `
            <option value="">${isEn ? 'All Occasions & Types' : 'Alle Anlässe & Typen'}</option>
            <option value="Riḍván-Botschaft">${isEn ? 'Riḍván Messages' : 'Riḍván-Botschaften'}</option>
            <option value="Naw-Rúz-Botschaft">${isEn ? 'Naw-Rúz Messages' : 'Naw-Rúz-Botschaften'}</option>
            <option value="Beraterkonferenz-Botschaft">${isEn ? 'Counsellor Conferences' : 'Beraterkonferenzen'}</option>
            <option value="Friedensbotschaft">${isEn ? 'Peace Messages' : 'Friedensbotschaften'}</option>
            <option value="Jugendkonferenz-Botschaft">${isEn ? 'Youth Conferences' : 'Jugendkonferenzen'}</option>
            <option value="Botschaft">${isEn ? 'General Messages' : 'Allgemeine Botschaften'}</option>
        `;
        typeSelect.value = (window.state && window.state.library).type || '';
    }
}


function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSearchSnippet(rawText, normText, queryNorm, tokens) {
    if (!rawText) return '';
    let matchIdx = -1;
    let matchLen = queryNorm ? queryNorm.length : 0;

    // 1. Zuerst prüfen, ob die exakte Phrase im Volltext vorkommt (z.B. bei Auszügen)
    if (normText && queryNorm) {
        matchIdx = normText.indexOf(queryNorm);
    }
    // 2. Falls kein Phrasen-Treffer, nimm den ersten Token-Treffer
    if (matchIdx === -1 && normText && tokens.length > 0) {
        for (const tok of tokens) {
            const idx = normText.indexOf(tok);
            if (idx !== -1) {
                matchIdx = idx;
                matchLen = tok.length;
                break;
            }
        }
    }

    if (matchIdx === -1) {
        return escapeDocHtml(rawText.slice(0, 160).replace(/\s+/g, ' ')) + '…';
    }

    const start = Math.max(0, matchIdx - 70);
    const end = Math.min(rawText.length, matchIdx + matchLen + 90);
    let slice = rawText.slice(start, end).replace(/\s+/g, ' ');
    let escaped = escapeDocHtml(slice);

    // Hervorhebung für alle Suchbegriffe
    for (const tok of tokens) {
        if (tok.length < 2) continue;
        const re = new RegExp('(' + escapeRegex(escapeDocHtml(tok)) + ')', 'gi');
        escaped = escaped.replace(re, '<mark class="search-highlight">$1</mark>');
    }

    return (start > 0 ? '…' : '') + escaped.trim() + (end < rawText.length ? '…' : '');
}

function normalizeSearchText(str) {
    if (!str) return '';
    if (window.SearchEngine && typeof window.SearchEngine.normalize === 'function') {
        return window.SearchEngine.normalize(str);
    }
    return String(str)
        .replace(/ä|Ä/g, 'ae')
        .replace(/ö|Ö/g, 'oe')
        .replace(/ü|Ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’`ʻ‘"“”„«»]/g, '')
        .replace(/schoghi/g, 'shoghi')
        .replace(/\s+/g, ' ')
        .trim();
}
window.normalizeSearchText = normalizeSearchText;

const GERMAN_SEARCH_MONTHS = ['Januar', 'Februar', 'März', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const ENGLISH_SEARCH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDocumentSearchBundle(d) {
    if (d._searchBundle) return d._searchBundle;
    let dateVariations = '';
    if (d.date) {
        dateVariations += ' ' + d.date;
        const parts = String(d.date).split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            if (m >= 0 && m < 12) {
                dateVariations += ` ${GERMAN_SEARCH_MONTHS[m]} ${ENGLISH_SEARCH_MONTHS[m]} ${day}. ${GERMAN_SEARCH_MONTHS[m]} ${y} ${day}.${m+1}.${y}`;
            }
        }
    }
    if (d.year) dateVariations += ' ' + d.year;

    const topicsStr = Array.isArray(d.topics) ? d.topics.join(' ') : '';
    const rawBundle = [
        d.title || '',
        d.deTitle || '',
        d.enTitle || '',
        d.subTitle || '',
        d.author || '',
        topicsStr,
        d.recipient || '',
        d.recipientLabel || '',
        d.type || '',
        d.compilationTopic || '',
        d.excerpt || '',
        (d.text ? d.text.slice(0, 800) : ''),
        dateVariations
    ].join(' ');

    d._searchBundle = normalizeSearchText(rawBundle);
    return d._searchBundle;
}


window.FiltersModule = {
    updateDrawerFilterOptions,
    extractSearchSnippet,
    normalizeSearchText,
    getDocumentSearchBundle,
    escapeRegex
};
window.updateDrawerFilterOptions = updateDrawerFilterOptions;
window.extractSearchSnippet = extractSearchSnippet;
window.normalizeSearchText = normalizeSearchText;
window.getDocumentSearchBundle = getDocumentSearchBundle;
window.escapeRegex = escapeRegex;

})();
