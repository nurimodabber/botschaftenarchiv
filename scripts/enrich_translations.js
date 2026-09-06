/**
 * enrich_translations.js
 * Enriches data/index.json by linking German and English versions of the same document.
 * Adds:
 * - groupId (canonical group identifier)
 * - translations: { de: id, en: id }
 * - availableLanguages: ['de', 'en']
 * - deTitle, enTitle (for bilingual items)
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../data/index.json');
const docs = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

function normalizeText(s) {
    return (s || '')
        .toLowerCase()
        .replace(/[–—\-\(\)\/\,\.\:\'’‘\"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getGroupKey(d) {
    // 1. Ruhi-Institut
    if (d.tier === 'ruhi' || (d.title && d.title.toLowerCase().startsWith('ruhi'))) {
        const branchMatch = d.title.match(/Zweigkurs\s*0?(\d+)/i);
        const numMatch = d.title.match(/(?:Buch|Book)\s*0?(\d+(?:\.\d+)?)/i);
        if (branchMatch) return 'ruhi-book-3-branch-' + branchMatch[1];
        if (numMatch) return 'ruhi-book-' + parseFloat(numMatch[1]);
        return 'ruhi-' + d.id;
    }

    // 2. Thematische Kompilationen
    if (d.tier === 'compilations' || d.type === 'Kompilation' || d.source === 'Forschungsabteilung') {
        let key = d.compilationTopic;
        if (!key) {
            key = (d.title || '').replace(/\s*\([^)]*\)$/, '').trim();
        }
        const clean = normalizeText(key).slice(0, 30).replace(/\s+/g, '-');
        return 'comp-' + clean;
    }

    // 3. Bücher & Heilige Schriften
    if (d.tier === 'books') {
        const t = normalizeText(d.title).replace(/^(the|die|der|das|ein|eine)\s+/, '');

        if (t.includes('iqan') || t.includes('íqán')) return 'book-iqan';
        if (t.includes('aqdas')) return 'book-aqdas';
        if (t.includes('hidden words') || t.includes('verborgenen worte')) return 'book-hidden-words';
        if (t.includes('gleanings') || t.includes('ährenlese')) return 'book-gleanings';
        if (t.includes('son of the wolf') || t.includes('sohn des wolfes')) return 'book-son-of-wolf';
        if (t.includes('paris talks') || t.includes('ansprachen in paris')) return 'book-paris-talks';
        if (t.includes('some answered questions') || t.includes('beantwortete fragen')) return 'book-some-answered-questions';
        if (t.includes('god passes by') || t.includes('gott geht vorüber')) return 'book-god-passes-by';
        if (t.includes('secret divine civilization') || t.includes('geheimnis göttlicher kultur')) return 'book-secret-civilization';
        if (t.includes('tablets divine plan') || t.includes('göttlichen plan') || t.includes('göttlichen heilsplan')) return 'book-divine-plan';
        if (t.includes('world order') || t.includes('weltordnung')) return 'book-world-order';
        if (t.includes('advent divine justice') || t.includes('kommen göttlicher gerechtigkeit')) return 'book-advent-justice';
        if (t.includes('promised day') || t.includes('verheißene tag')) return 'book-promised-day';
        if (t.includes('prayers and meditations') || t.includes('gebete und meditationen')) return 'book-prayers-meditations';
        if (t.includes('seven valleys') || t.includes('sieben täler')) return 'book-seven-valleys';
        if (t.includes('gems of divine') || t.includes('edelsteine göttlicher')) return 'book-gems';
        if (t.includes('summons') || t.includes('ruf des herrn')) return 'book-summons';
        if (t.includes('days of remembrance') || t.includes('tage des gedenkens')) return 'book-days-remembrance';
        if (t.includes('tabernacle of unity') || t.includes('zelt der einheit')) return 'book-tabernacle';
        if (t.includes('call of the divine') || t.includes('ruf des göttlichen')) return 'book-call-beloved';
        if (t.includes('memorials faithful') || t.includes('vorbilder der treue')) return 'book-memorials-faithful';
        if (t.includes('will and testament') || t.includes('wille und testament')) return 'book-will-testament';
        if (t.includes('citadel faith') || t.includes('feste des glaubens')) return 'book-citadel-faith';
        if (t.includes('bahai administration') || t.includes('bahá’í verwaltung') || t.includes('bahai verwaltung')) return 'book-bahai-admin';
        if (t.includes('promulgation universal peace') || t.includes('verkündigung des weltfriedens')) return 'book-promulgation';
        if (t.includes('light of the world') || t.includes('licht der welt')) return 'book-light-world';
        if (t.includes('selections') && (t.includes('bab') || t.includes('báb'))) return 'book-selections-bab';
        if (t.includes('selections') && (t.includes('abdul') || t.includes('‘abdu'))) return 'book-selections-abdul-baha';
        if (t.includes('auguste forel')) return 'book-tablet-auguste-forel';

        const auth = (d.author || 'book').toLowerCase().replace(/[^a-z0-9]/g, '');
        return 'book-' + auth + '-' + t.slice(0, 25).replace(/\s+/g, '-');
    }

    // 4. Botschaften des Hauses & Institutionen
    if (d.date) {
        const t = normalizeText(d.title);
        let sub = '';
        if (t.includes('europa') || t.includes('europe')) sub = '-europe';
        else if (t.includes('counsellor') || t.includes('berater') || d.recipient === 'counsellors') sub = '-counsellors';
        else if (t.includes('national') || t.includes('nsa') || d.recipient === 'nsa') sub = '-nsa';
        else if (t.includes('youth') || t.includes('jugend') || d.recipient === 'youth') sub = '-youth';
        else if (t.includes('iran') || d.recipient === 'iran') sub = '-iran';
        else if (d.type === 'Riḍván-Botschaft' || t.includes('ridvan') || t.includes('riḍván')) sub = '-ridvan';
        else if (t.includes('family') || t.includes('familienleben')) sub = '-family';
        else if (t.includes('kinshasa') || t.includes('congo') || t.includes('kongo')) sub = '-congo';
        else if (t.includes('port moresby') || t.includes('papua')) sub = '-png';
        else if (t.includes('conflict') || t.includes('konflikt') || t.includes('isgp')) sub = '-isgp';

        return 'msg-' + d.date + sub;
    }

    return 'doc-' + d.id;
}

const groupMap = {};
docs.forEach(d => {
    const gk = getGroupKey(d);
    d.groupId = gk;
    if (!groupMap[gk]) groupMap[gk] = [];
    groupMap[gk].push(d);
});

let bilingualGroupsCount = 0;

Object.values(groupMap).forEach(list => {
    // Prefer docx / full document as primary if multiple in same language exist
    const deDocs = list.filter(d => d.language === 'deutsch');
    const enDocs = list.filter(d => d.language === 'english');

    const deDoc = deDocs.find(d => d.hasText && d.format === 'docx') || deDocs.find(d => d.hasText) || deDocs[0] || null;
    const enDoc = enDocs.find(d => d.hasText && d.format === 'docx') || enDocs.find(d => d.hasText) || enDocs[0] || null;

    const availableLangs = [];
    if (deDoc) availableLangs.push('de');
    if (enDoc) availableLangs.push('en');
    if (availableLangs.length > 1) bilingualGroupsCount++;

    list.forEach(d => {
        d.translations = {
            de: deDoc ? deDoc.id : null,
            en: enDoc ? enDoc.id : null
        };
        d.availableLanguages = availableLangs;
        if (deDoc && enDoc) {
            d.deTitle = deDoc.title;
            d.enTitle = enDoc.title;
        }
    });
});

console.log(`Enriched ${docs.length} documents into ${Object.keys(groupMap).length} groups.`);
console.log(`Identified ${bilingualGroupsCount} bilingual groups with DE and EN editions.`);

fs.writeFileSync(indexPath, JSON.stringify(docs, null, 2), 'utf8');
console.log(`Saved enriched data to ${indexPath}`);
