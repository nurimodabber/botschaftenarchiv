/**
 * timeline.js
 * 100% akkurate, interaktive Vektordarstellung des Referenzdiagramms
 * "Unfoldment of the Bahá'í Faith" (Die Entfaltung des Bahá'í-Glaubens).
 * 
 * Features:
 * - Vollständige Schichten: Zyklus, Ära & Jahrhunderte, Dispensation Bahá'u'lláhs,
 *   Heroisches Zeitalter (3 Epochen & Sendungen), Gestaltendes Zeitalter (1. & 2. Jhdt., 6 Epochen),
 *   Tafeln des Göttlichen Plans (3 Epochen), Kette der 16 globalen Lehrpläne.
 * - Brackets: Vorherige Serie (1996–2021) & Neue Serie (ab 2021).
 * - Detaillierter interaktiver Inspektor mit theologischem Kontext, Statistiken & Dokumenten.
 * - Interaktiver Zeitschieberegler (1844–2044) mit Live-Cursor.
 * - Zweisprachig umschaltbar (Deutsch / English Original).
 */

window.TimelineModule = (function() {
    let currentSelectedId = 'tdp_3'; // Standard: 3. Epoche der Tafeln des Göttlichen Plans
    let currentLang = 'de'; // 'de' oder 'en'
    let currentDocFilter = 'all'; // 'all', 'ridvan', 'institutions', 'books'
    let scrubberYear = 2026;

    // Horizontale X-Koordinaten für die Schlüsseljahre im SVG (viewBox: 0 0 1480 610)
    // X-Geometrie aus modularer timeline_data.js
    const X = (window.TimelineData && window.TimelineData.X) || {};

    // Entitäten-Datenbank mit deutschen und englischen Texten, Zitaten und Daten
    // ENTITIES-Datenbank aus modularer timeline_data.js
    const ENTITIES = (window.TimelineData && window.TimelineData.ENTITIES) || {};

    function init() {
        currentSelectedId = 'tdp_3';
        if (window.I18n && window.I18n.getCurrentLanguage) {
            currentLang = window.I18n.getCurrentLanguage() || 'de';
        } else {
            try {
                if (typeof localStorage !== 'undefined' && localStorage.getItem('cosmos_master_lang')) {
                    currentLang = localStorage.getItem('cosmos_master_lang');
                }
            } catch (e) {}
        }
        if (window.I18n && window.I18n.onLanguageChange) {
            window.I18n.onLanguageChange(function(lang) {
                setLanguage(lang);
            });
        }
        renderTimelineView();
        selectEntity(currentSelectedId);
    }

    function selectEntity(id) {
        if (!ENTITIES[id]) return;
        currentSelectedId = id;
        
        // Update SVG Active Nodes
        document.querySelectorAll('.unfold-node').forEach(node => {
            if (node.dataset.id === id) {
                node.classList.add('active-node');
            } else {
                node.classList.remove('active-node');
            }
        });

        // Update Inspector
        renderInspector(id);
    }

    function setLanguage(lang) {
        currentLang = lang;
        renderTimelineView();
        selectEntity(currentSelectedId);
    }

    function scrubToYear(year) {
        scrubberYear = parseInt(year, 10);
        const scrubberVal = document.getElementById('timeline-scrubber-val');
        if (scrubberVal) scrubberVal.textContent = scrubberYear;

        // Position vertical cursor in SVG
        const cursor = document.getElementById('svg-year-cursor');
        const cursorLabel = document.getElementById('svg-year-cursor-text');
        const cursorLine = document.getElementById('svg-year-line');
        const cursorBadge = document.getElementById('svg-year-badge');
        const xPos = mapYearToX(scrubberYear);

        if (cursor) cursor.style.display = 'block';
        if (cursorLine) {
            cursorLine.setAttribute('x1', xPos);
            cursorLine.setAttribute('x2', xPos);
        }
        if (cursorBadge) cursorBadge.setAttribute('x', xPos - 22);
        if (cursorLabel) {
            cursorLabel.setAttribute('x', xPos);
            cursorLabel.textContent = scrubberYear;
        }

        // Find active entity at this year
        let matchId = 'plan_9yp_22';
        if (scrubberYear <= 1853) matchId = 'ministry_bab';
        else if (scrubberYear <= 1892) matchId = 'ministry_bahaullah';
        else if (scrubberYear <= 1921) matchId = 'ministry_abdulbaha';
        else if (scrubberYear < 1937) matchId = 'epoch_1';
        else if (scrubberYear < 1944) matchId = 'plan_7yp_37';
        else if (scrubberYear < 1953) matchId = 'plan_7yp_46';
        else if (scrubberYear < 1963) matchId = 'plan_10yc_53';
        else if (scrubberYear < 1974) matchId = 'plan_9yp_64';
        else if (scrubberYear < 1979) matchId = 'plan_5yp_74';
        else if (scrubberYear < 1986) matchId = 'plan_7yp_79';
        else if (scrubberYear < 1993) matchId = 'plan_6yp_86';
        else if (scrubberYear < 1996) matchId = 'plan_3yp_93';
        else if (scrubberYear < 2000) matchId = 'plan_4yp_96';
        else if (scrubberYear <= 2001) matchId = 'plan_12mp_00';
        else if (scrubberYear < 2006) matchId = 'plan_5yp_01';
        else if (scrubberYear < 2011) matchId = 'plan_5yp_06';
        else if (scrubberYear < 2016) matchId = 'plan_5yp_11';
        else if (scrubberYear < 2021) matchId = 'plan_5yp_16';
        else if (scrubberYear <= 2022) matchId = 'plan_1yp_21';
        else if (scrubberYear <= 2031) matchId = 'plan_9yp_22';
        else matchId = 'era_c2';

        selectEntity(matchId);
    }

    function mapYearToX(yr) {
        if (yr <= 1844) return X[1844];
        if (yr >= 2044) return X[2044];
        const milestones = [1844, 1853, 1892, 1921, 1937, 1944, 1946, 1953, 1963, 1974, 1979, 1986, 1993, 1996, 2000, 2001, 2006, 2011, 2016, 2021, 2022, 2031, 2044];
        for (let i = 0; i < milestones.length - 1; i++) {
            const y1 = milestones[i];
            const y2 = milestones[i+1];
            if (yr >= y1 && yr <= y2) {
                const ratio = (yr - y1) / (y2 - y1);
                return X[y1] + ratio * (X[y2] - X[y1]);
            }
        }
        return X[2021];
    }

    function getDocumentsForEntity(entity) {
        const allDocs = window.state ? (window.state.documents || []) : [];
        const id = entity.id;
        let results = [];

        if (id === 'ministry_bab') {
            results = allDocs.filter(d => (d.authorCode || '').toLowerCase() === 'bab' || (d.authorCode || '').toLowerCase() === 'the-bab' || d.subTier === 'the-bab' || d.author === 'Der Báb');
        } else if (id === 'ministry_bahaullah') {
            results = allDocs.filter(d => (d.authorCode || '').toLowerCase() === 'bahaullah' || d.subTier === 'bahaullah' || d.author === "Bahá'u'lláh");
        } else if (id === 'ministry_abdulbaha') {
            results = allDocs.filter(d => (d.authorCode || '').toLowerCase() === 'abdulbaha' || (d.authorCode || '').toLowerCase() === 'abdul-baha' || d.subTier === 'abdul-baha' || d.author === "‘Abdu’l-Bahá");
        } else if (id === 'epoch_1' || id === 'epoch_2') {
            results = allDocs.filter(d => (d.authorCode || '').toLowerCase() === 'shoghieffendi' || (d.authorCode || '').toLowerCase() === 'shoghi-effendi' || d.subTier === 'shoghi-effendi' || d.author === 'Shoghi Effendi' || (d.year >= entity.startYear && d.year <= entity.endYear));
        } else if (id === 'tdp') {
            results = allDocs.filter(d => (d.id && d.id.includes('tdp')) || (d.year >= entity.startYear && d.year <= Math.min(2026, entity.endYear)));
        } else if (entity.startDate && entity.endDate) {
            // For plans (e.g. 7-Year Plan 1937–1944)
            results = allDocs.filter(d => {
                const date = d.date || '';
                if (date) {
                    return date >= entity.startDate && date <= entity.endDate;
                }
                const y = d.year || 0;
                return y >= entity.startYear && y <= entity.endYear;
            });
        } else if (entity.startYear && entity.endYear) {
            // By year range
            results = allDocs.filter(d => d.year >= entity.startYear && d.year <= Math.min(2026, entity.endYear));
        }

        // Mit Meilenstein-Metadaten autorisierter Quellen anreichern
        results.forEach(d => {
            const ms = getMilestoneInfo(d);
            if (ms) {
                d.isMilestone = true;
                d.milestonePriority = ms.priority || 5;
                d.milestoneBadgeDe = ms.badgeDe || 'Schlüssel-Botschaft';
                d.milestoneBadgeEn = ms.badgeEn || 'Key Message';
                d.milestoneReasonDe = ms.reasonDe;
                d.milestoneReasonEn = ms.reasonEn;
                d.milestonePlanId = ms.planId || '';
            } else {
                d.isMilestone = false;
            }
        });

        // Chronologische Basissortierung (aufsteigend nach Jahr und Datum)
        results.sort((a, b) => {
            const ya = a.year || 0;
            const yb = b.year || 0;
            if (ya !== yb) return ya - yb;
            const da = a.date || '';
            const db = b.date || '';
            if (da !== db) return da.localeCompare(db);
            return (a.title || '').localeCompare(b.title || '', 'de');
        });

        return results;
    }

    function renderTimelineView() {
        const container = document.getElementById('view-timeline');
        if (!container) return;

        const isDe = currentLang === 'de';

        container.innerHTML = `
            <div class="view-header" style="max-width: 1150px; margin: 0 auto 1.25rem; text-align: center;">
                <h2 class="editorial-headline" style="font-size: 2.25rem; margin-bottom: 0.75rem;">
                    ${isDe ? "Entfaltung des Bahá’í-Glaubens" : "Unfoldment of the Bahá’í Faith"}
                </h2>

                <!-- Toolbar: Sprache & Scrubber -->
                <div class="unfold-toolbar">
                    <div class="unfold-lang-switch">
                        <span class="unfold-tool-label">${isDe ? "Sprache:" : "Language:"}</span>
                        <button class="unfold-lang-btn ${currentLang === 'de' ? 'active' : ''}" onclick="window.TimelineModule.setLanguage('de')">Deutsch</button>
                        <button class="unfold-lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="window.TimelineModule.setLanguage('en')">English (Original)</button>
                    </div>

                    <div class="unfold-scrubber-box">
                        <label for="timeline-scrubber-input" class="unfold-tool-label">
                            ${isDe ? "Zeitreise (1844–2044):" : "Time Scrubber (1844–2044):"}
                            <strong id="timeline-scrubber-val" style="color: var(--accent-gold); font-family: var(--font-sans); font-variant-numeric: tabular-nums;">${scrubberYear}</strong>
                        </label>
                        <input type="range" id="timeline-scrubber-input" min="1844" max="2044" value="${scrubberYear}" 
                               oninput="window.TimelineModule.scrubToYear(this.value)" class="unfold-slider">
                    </div>
                </div>
            </div>

            <!-- Haupt-Diagrammkarte (SVG Canvas) -->
            <div class="unfold-svg-container">
                ${buildVectorSvg(isDe)}
            </div>

            <!-- Interaktiver Detail- & Dokumenten-Inspektor -->
            <div id="unfold-inspector" class="unfold-inspector-card"></div>
        `;

        // Wire SVG Clicks
        document.querySelectorAll('.unfold-node').forEach(elem => {
            elem.addEventListener('click', () => {
                const id = elem.dataset.id;
                if (id) selectEntity(id);
            });
        });
    }

    function buildVectorSvg(isDe) {
        const milestoneYears = [1844, 1853, 1892, 1921, 1937, 1946, 1953, 1963, 1974, 1979, 1986, 1993, 1996, 2001, 2006, 2011, 2016, 2021, 2044];
        const gridLines = milestoneYears.map(y => {
            const x = X[y];
            return `<line x1="${x}" y1="28" x2="${x}" y2="550" stroke="rgba(150,160,175,0.18)" stroke-dasharray="3 4" stroke-width="1" />`;
        }).join('\n');

        const axisLabels = milestoneYears.map(y => {
            const x = X[y];
            return `
                <line x1="${x}" y1="535" x2="${x}" y2="545" stroke="currentColor" stroke-width="1.5" />
                <text x="${x}" y="565" text-anchor="middle" class="svg-axis-label">${y}</text>
            `;
        }).join('\n');

        const midPrev = (X[1996] + X[2021]) / 2;
        const midNew = (X[2021] + X[2044]) / 2;

        return `
        <svg id="unfoldment-svg" class="unfold-svg" viewBox="0 0 1480 600" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="var(--accent-gold)" flood-opacity="0.6"/>
                </filter>
                <marker id="arrow-navy" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#1B2A58" />
                </marker>
                <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#1E75B8" />
                </marker>
                <marker id="arrow-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#00A3E0" />
                </marker>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#E53935" />
                </marker>
            </defs>

            <!-- Hintergrund-Gitterlinien -->
            <g class="svg-grid">${gridLines}</g>

            <!-- 1. LAYER: Bahá'í Cycle -->
            <g class="unfold-node" data-id="cycle" style="cursor: pointer;">
                <path d="M ${X[1844]} 28 L 1425 28 L 1445 41 L 1425 54 L ${X[1844]} 54 Z" fill="#1B2A58" class="svg-bar" />
                <text x="${X[1844] + 15}" y="45" fill="#FFFFFF" class="svg-text-bold">
                    ${isDe ? "Bahá'í-Zyklus" : "Bahá’í Cycle"}
                    <tspan fill="rgba(255,255,255,0.8)" font-weight="normal" font-size="11">
                        ${isDe ? " (Vorgesehen für 500.000 Jahre)" : " (destined to last for 500,000 years)"}
                    </tspan>
                </text>
            </g>

            <!-- 2. LAYER: Bahá'í Era -->
            <g class="unfold-node" data-id="era_c1" style="cursor: pointer;">
                <path d="M ${X[1844]} 66 L 1425 66 L 1445 79 L 1425 92 L ${X[1844]} 92 Z" fill="#1F6FA8" class="svg-bar" />
                <text x="${X[1844] + 15}" y="83" fill="#FFFFFF" class="svg-text-bold">
                    ${isDe ? "Bahá'í-Ära" : "Bahá’í Era"}
                    <tspan fill="rgba(255,255,255,0.8)" font-weight="normal" font-size="11">
                        ${isDe ? " (Umfasst die Sendungen des Báb und Bahá'u'lláhs)" : " (comprising the Dispensations of the Báb and Bahá’u’lláh)"}
                    </tspan>
                </text>
            </g>
            <!-- Era Century Rulers -->
            <g class="svg-ruler">
                <g class="unfold-node" data-id="era_c1" style="cursor: pointer;">
                    <line x1="${X[1844]}" y1="105" x2="${X[1944]}" y2="105" stroke="currentColor" stroke-width="1.2" />
                    <line x1="${X[1844]}" y1="101" x2="${X[1844]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                    <line x1="${X[1944]}" y1="101" x2="${X[1944]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                    <text x="${(X[1844] + X[1944])/2}" y="117" text-anchor="middle" class="svg-ruler-text">
                        ${isDe ? "1. Jahrhundert (1844–1944)" : "1st Century (1844–1944)"}
                    </text>
                </g>

                <g class="unfold-node" data-id="era_c2" style="cursor: pointer;">
                    <line x1="${X[1944]}" y1="105" x2="${X[2044]}" y2="105" stroke="currentColor" stroke-width="1.2" />
                    <line x1="${X[2044]}" y1="101" x2="${X[2044]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                    <text x="${(X[1944] + X[2044])/2}" y="117" text-anchor="middle" class="svg-ruler-text">
                        ${isDe ? "2. Jahrhundert (1944–2044)" : "2nd Century (1944–2044)"}
                    </text>
                </g>

                <line x1="${X[2044]}" y1="105" x2="1420" y2="105" stroke="currentColor" stroke-dasharray="3 3" stroke-width="1.2" />
                <text x="1395" y="117" class="svg-ruler-text">
                    ${isDe ? "3. Jhdt. …" : "3rd Century …"}
                </text>
            </g>

            <!-- 3. LAYER: Dispensation of Bahá'u'lláh (Starts at 1853!) -->
            <g class="unfold-node" data-id="dispensation" style="cursor: pointer;">
                <path d="M ${X[1853]} 128 L 1425 128 L 1445 141 L 1425 154 L ${X[1853]} 154 Z" fill="#00A3E0" class="svg-bar" />
                <text x="${X[1853] + 15}" y="145" fill="#FFFFFF" class="svg-text-bold">
                    ${isDe ? "Dispensation Bahá'u'lláhs" : "Dispensation of Bahá’u’lláh"}
                    <tspan fill="rgba(255,255,255,0.85)" font-weight="normal" font-size="11">
                        ${isDe ? " (Vorgesehen für mindestens 1.000 Jahre)" : " (destined to last at least 1000 years)"}
                    </tspan>
                </text>
            </g>

            <!-- 4. LAYER: Ages (Heroic Age -> Formative Age -> Golden Age) -->
            <!-- Heroic Age Header -->
            <g class="unfold-node" data-id="heroic_age" style="cursor: pointer;">
                <rect x="${X[1844]}" y="168" width="${X[1921] - X[1844]}" height="26" rx="4" fill="#557637" class="svg-bar" />
                <text x="${(X[1844] + X[1921])/2}" y="185" fill="#FFFFFF" text-anchor="middle" class="svg-text-bold">
                    ${isDe ? "Heroisches Zeitalter (1844–1921)" : "Heroic Age (1844–1921)"}
                </text>
            </g>
            <!-- Formative Age Header -->
            <g class="unfold-node" data-id="formative_age" style="cursor: pointer;">
                <path d="M ${X[1921]} 168 L 1305 168 L 1320 181 L 1305 194 L ${X[1921]} 194 Z" fill="#3D6E34" class="svg-bar" />
                <text x="${(X[1921] + 1305)/2}" y="185" fill="#FFFFFF" text-anchor="middle" class="svg-text-bold">
                    ${isDe ? "Gestaltendes Zeitalter (Formative Age, ab 1921)" : "Formative Age (from 1921)"}
                </text>
            </g>
            <!-- Golden Age Header -->
            <g class="unfold-node" data-id="golden_age" style="cursor: pointer;">
                <path d="M 1330 168 L 1435 168 L 1455 181 L 1435 194 L 1330 194 L 1345 181 Z" fill="#3D6E34" class="svg-bar" />
                <text x="1390" y="185" fill="#FFFFFF" text-anchor="middle" class="svg-text-bold" font-size="10">
                    ${isDe ? "Goldenes Zeitalter" : "Golden Age"}
                </text>
            </g>

            <!-- Formative Age Century Line: sauber platziert über den Epochen mit voller Beinfreiheit -->
            <g class="svg-ruler">
                <line x1="${X[1921]}" y1="205" x2="${X[2021]}" y2="205" stroke="currentColor" stroke-width="1.2" />
                <line x1="${X[1921]}" y1="201" x2="${X[1921]}" y2="209" stroke="currentColor" stroke-width="1.2" />
                <line x1="${X[2021]}" y1="201" x2="${X[2021]}" y2="209" stroke="currentColor" stroke-width="1.2" />
                <text x="${(X[1921] + X[2021])/2}" y="217" text-anchor="middle" class="svg-ruler-text">
                    ${isDe ? "1. Jahrhundert des Gestaltenden Zeitalters (1921–2021)" : "1st Century of the Formative Age (1921–2021)"}
                </text>
                <line x1="${X[2021]}" y1="205" x2="1305" y2="205" stroke="currentColor" stroke-dasharray="3 3" stroke-width="1.2" />
                <text x="${(X[2021] + 1305)/2}" y="217" text-anchor="middle" class="svg-ruler-text">
                    ${isDe ? "2. Jhdt. …" : "2nd Century …"}
                </text>
            </g>

            <!-- 4b. Epochen auf exakt einheitlicher Zeile: y: 226..250 (Heroic 1-3 & Formative 1-6) -->
            <!-- Heroic Age 3 Epochs -->
            <g class="unfold-node" data-id="ministry_bab" style="cursor: pointer;">
                <rect x="${X[1844]}" y="226" width="${X[1853] - X[1844]}" height="24" rx="3" fill="#7E9F4F" class="svg-bar" />
                <text x="${(X[1844] + X[1853])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "1. Epoche" : "1st Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="ministry_bahaullah" style="cursor: pointer;">
                <rect x="${X[1853]}" y="226" width="${X[1892] - X[1853]}" height="24" rx="3" fill="#7E9F4F" class="svg-bar" />
                <text x="${(X[1853] + X[1892])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "2. Epoche" : "2nd Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="ministry_abdulbaha" style="cursor: pointer;">
                <rect x="${X[1892]}" y="226" width="${X[1921] - X[1892]}" height="24" rx="3" fill="#7E9F4F" class="svg-bar" />
                <text x="${(X[1892] + X[1921])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "3. Epoche" : "3rd Epoch"}
                </text>
            </g>

            <!-- Formative Age Epochs (1 to 5 + 6. ab 2021) -->
            <g class="unfold-node" data-id="epoch_1" style="cursor: pointer;">
                <rect x="${X[1921]}" y="226" width="${X[1946] - X[1921]}" height="24" rx="3" fill="#86AC41" class="svg-bar" />
                <text x="${(X[1921] + X[1946])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "1. Epoche" : "1st Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="epoch_2" style="cursor: pointer;">
                <rect x="${X[1946]}" y="226" width="${X[1963] - X[1946]}" height="24" rx="3" fill="#86AC41" class="svg-bar" />
                <text x="${(X[1946] + X[1963])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "2. Epoche" : "2nd Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="epoch_3" style="cursor: pointer;">
                <rect x="${X[1963]}" y="226" width="${X[1986] - X[1963]}" height="24" rx="3" fill="#86AC41" class="svg-bar" />
                <text x="${(X[1963] + X[1986])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "3. Epoche" : "3rd Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="epoch_4" style="cursor: pointer;">
                <rect x="${X[1986]}" y="226" width="${X[2001] - X[1986]}" height="24" rx="3" fill="#86AC41" class="svg-bar" />
                <text x="${(X[1986] + X[2001])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "4. Epoche" : "4th Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="epoch_5" style="cursor: pointer;">
                <rect x="${X[2001]}" y="226" width="${X[2021] - X[2001]}" height="24" rx="3" fill="#86AC41" class="svg-bar" />
                <text x="${(X[2001] + X[2021])/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "5. Epoche" : "5th Epoch"}
                </text>
            </g>
            <g class="unfold-node" data-id="epoch_6" style="cursor: pointer;">
                <path d="M ${X[2021]} 226 L 1305 226 L 1320 238 L 1305 250 L ${X[2021]} 250 Z" fill="#86AC41" class="svg-bar" />
                <text x="${(X[2021] + 1305)/2}" y="242" fill="#FFFFFF" text-anchor="middle" font-size="10" font-weight="bold">
                    ${isDe ? "6. Epoche" : "6th Epoch"}
                </text>
            </g>

            <!-- Vertikale Beschriftungen der Sendungen (Links unten im Heroic Age) -->
            <g class="unfold-node" data-id="ministry_bab" style="cursor: pointer;">
                <text x="87.5" y="400" transform="rotate(-90 87.5,400)" class="svg-vertical-text">
                    ${isDe ? "Sendung des Báb" : "Ministry of the Báb"}
                </text>
            </g>
            <g class="unfold-node" data-id="ministry_bahaullah" style="cursor: pointer;">
                <text x="180" y="400" transform="rotate(-90 180,400)" class="svg-vertical-text">
                    ${isDe ? "Sendung Bahá'u'lláhs" : "Ministry of Bahá’u’lláh"}
                </text>
            </g>
            <g class="unfold-node" data-id="ministry_abdulbaha" style="cursor: pointer;">
                <text x="290" y="400" transform="rotate(-90 290,400)" class="svg-vertical-text">
                    ${isDe ? "Wirken 'Abdu'l-Bahás" : "Ministry of ‘Abdu’l-Bahá"}
                </text>
            </g>

            <!-- 5. LAYER: Tablets of the Divine Plan (Starts in 1937!) -->
            <g class="unfold-node" data-id="tdp" style="cursor: pointer;">
                <path d="M ${X[1937]} 268 L 1305 268 L 1320 280 L 1305 292 L ${X[1937]} 292 Z" fill="#855723" class="svg-bar" />
                <text x="${(X[1937] + 1305)/2}" y="284" fill="#FFFFFF" text-anchor="middle" class="svg-text-bold">
                    ${isDe ? "Tafeln des Göttlichen Plans (Tablets of the Divine Plan)" : "Tablets of the Divine Plan"}
                </text>
            </g>
            <!-- TDP 3 Epochs -->
            <g class="unfold-node" data-id="tdp_1" style="cursor: pointer;">
                <rect x="${X[1937]}" y="300" width="${X[1963] - X[1937]}" height="26" rx="3" fill="#D98A1E" class="svg-bar" />
                <text x="${(X[1937] + X[1963])/2}" y="317" fill="#FFFFFF" text-anchor="middle" font-size="10.5" font-weight="bold">
                    ${isDe ? "1. Epoche (1937–1963)" : "1st Epoch (1937–1963)"}
                </text>
            </g>
            <g class="unfold-node" data-id="tdp_2" style="cursor: pointer;">
                <rect x="${X[1963]}" y="300" width="${X[2021] - X[1963]}" height="26" rx="3" fill="#D98A1E" class="svg-bar" />
                <text x="${(X[1963] + X[2021])/2}" y="317" fill="#FFFFFF" text-anchor="middle" font-size="10.5" font-weight="bold">
                    ${isDe ? "2. Epoche der Tafeln des Göttlichen Plans (1963–2021)" : "2nd Epoch of the Tablets of the Divine Plan (1963–2021)"}
                </text>
            </g>
            <g class="unfold-node" data-id="tdp_3" style="cursor: pointer;">
                <path d="M ${X[2021]} 300 L 1305 300 L 1320 313 L 1305 326 L ${X[2021]} 326 Z" fill="#D98A1E" class="svg-bar" />
                <text x="${(X[2021] + 1305)/2}" y="317" fill="#FFFFFF" text-anchor="middle" font-size="10.5" font-weight="bold">
                    ${isDe ? "3. Epoche (ab 2021)" : "3rd Epoch (from 2021)"}
                </text>
            </g>

            <!-- 6. LAYER: Global Plans (Capsules from 1937 to 2031) -->
            ${renderPlanCapsules(isDe)}

            <!-- Brackets: Previous Series & New Series of Global Plans (Vertikal gestaffelt, 100% kollisionsfrei!) -->
            <g class="svg-series-brackets">
                <!-- 1996 to 2021 Bracket (Vorherige Serie) -->
                <g class="unfold-node" data-id="series_prev" style="cursor: pointer;">
                    <path d="M ${X[1996]} 388 Q ${midPrev} 410 ${X[2021]} 388" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <line x1="${midPrev}" y1="399" x2="${midPrev}" y2="415" stroke="currentColor" stroke-width="1.2" />
                    <text x="${midPrev}" y="429" text-anchor="middle" class="svg-bracket-text">
                        ${isDe ? "Vorherige Serie globaler Pläne" : "Previous Series of Global Plans"}
                        <tspan x="${midPrev}" dy="14" font-size="9" fill="var(--text-muted)">
                            ${isDe ? "(1996–2021: 25 Jahre systematisches Lernen)" : "(1996–2021: 25 years of systematic learning)"}
                        </tspan>
                    </text>
                </g>

                <!-- 2021 to 2044 Bracket (Neue Serie, RED - tiefere vertikale Position für perfekte Lesbarkeit!) -->
                <g class="unfold-node" data-id="series_new" style="cursor: pointer;">
                    <path d="M ${X[2021]} 388 Q ${midNew} 440 ${X[2044]} 388" fill="none" stroke="#E53935" stroke-width="1.5" />
                    <line x1="${midNew}" y1="414" x2="${midNew}" y2="456" stroke="#E53935" stroke-width="1.5" />
                    <path d="M ${midNew + 75} 472 L ${midNew + 110} 472" stroke="#E53935" stroke-width="1.5" marker-end="url(#arrow-red)" />
                    <text x="${midNew}" y="472" text-anchor="middle" class="svg-bracket-text-red">
                        ${isDe ? "Neue Serie globaler Pläne" : "New Series of Global Plans"}
                        <tspan x="${midNew}" dy="14" font-size="9.5" fill="#E53935">
                            ${isDe ? "(2021–2046: Gesellschaftsbildende Kraft)" : "(2021–2046: Society-building power)"}
                        </tspan>
                    </text>
                </g>
            </g>

            <!-- Bottom Time Axis (Black Solid Arrow Bar) -->
            <g class="svg-axis">
                <path d="M ${X[1844]} 530 L 1340 530 L 1360 540 L 1340 550 L ${X[1844]} 550 Z" fill="#11151A" />
                ${axisLabels}
            </g>

            <!-- Interaktiver Scrubber Cursor (wird per JS bewegt) -->
            <g id="svg-year-cursor" style="display: none;">
                <line id="svg-year-line" x1="${X[2026]}" y1="20" x2="${X[2026]}" y2="550" stroke="var(--accent-gold)" stroke-width="2.5" stroke-dasharray="4 2" />
                <rect id="svg-year-badge" x="${X[2026] - 22}" y="6" width="44" height="18" rx="4" fill="var(--accent-gold)" />
                <text id="svg-year-cursor-text" x="${X[2026]}" y="19" fill="#FFFFFF" font-family="var(--font-sans)" font-size="10" font-weight="bold" text-anchor="middle">2026</text>
            </g>
        </svg>
        `;
    }

    function renderPlanCapsules(isDe) {
        const planList = [
            { id: 'plan_7yp_37', label: '7YP', x1: X[1937], x2: X[1944], years: '1937–1944' },
            { id: 'plan_7yp_46', label: '7YP', x1: X[1946], x2: X[1953], years: '1946–1953' },
            { id: 'plan_10yc_53', label: '10YC', x1: X[1953], x2: X[1963], years: '1953–1963' },
            { id: 'plan_9yp_64', label: '9YP', x1: X[1963] + 2, x2: X[1974] - 2, years: '1964–1973' },
            { id: 'plan_5yp_74', label: '5YP', x1: X[1974], x2: X[1979] - 2, years: '1974–1979' },
            { id: 'plan_7yp_79', label: '7YP', x1: X[1979], x2: X[1986] - 2, years: '1979–1986' },
            { id: 'plan_6yp_86', label: '6YP', x1: X[1986], x2: X[1993] - 2, years: '1986–1992' },
            { id: 'plan_3yp_93', label: '3YP', x1: X[1993], x2: X[1996] - 2, years: '1993–1996' },
            { id: 'plan_4yp_96', label: '4YP', x1: X[1996], x2: X[2000] - 2, years: '1996–2000' },
            { id: 'plan_12mp_00', label: '12MP', x1: X[2000], x2: X[2001] - 2, isArrow: true, years: '2000–2001' },
            { id: 'plan_5yp_01', label: '5YP', x1: X[2001], x2: X[2006] - 2, years: '2001–2006' },
            { id: 'plan_5yp_06', label: '5YP', x1: X[2006], x2: X[2011] - 2, years: '2006–2011' },
            { id: 'plan_5yp_11', label: '5YP', x1: X[2011], x2: X[2016] - 2, years: '2011–2016' },
            { id: 'plan_5yp_16', label: '5YP', x1: X[2016], x2: X[2021] - 2, years: '2016–2021' },
            { id: 'plan_1yp_21', label: '1YP', x1: X[2021], x2: X[2022] - 2, isRedArrow: true, years: '2021–2022' },
            { id: 'plan_9yp_22', label: '9YP', x1: X[2022], x2: X[2031], isCurrent: true, years: '2022–2031' }
        ];

        return planList.map(p => {
            const w = p.x2 - p.x1;
            const cx = p.x1 + w / 2;

            if (p.isArrow) {
                return `
                    <g class="unfold-node" data-id="${p.id}" style="cursor: pointer;">
                        <text x="${cx}" y="339" font-size="9" font-family="var(--font-sans)" font-weight="bold" fill="currentColor" text-anchor="middle">12MP</text>
                        <path d="M ${cx} 342 L ${cx} 369" stroke="currentColor" stroke-width="1.8" marker-end="url(#arrow-navy)" />
                    </g>
                `;
            }

            if (p.isRedArrow) {
                return `
                    <g class="unfold-node" data-id="${p.id}" style="cursor: pointer;">
                        <text x="${cx}" y="339" font-size="10" font-family="var(--font-sans)" font-weight="bold" fill="#E53935" text-anchor="middle">1YP</text>
                        <path d="M ${cx} 342 L ${cx} 369" stroke="#E53935" stroke-width="2" marker-end="url(#arrow-red)" />
                    </g>
                `;
            }

            const fill = p.isCurrent ? '#E53935' : '#181B1F';
            const stroke = p.isCurrent ? '#FF5252' : 'rgba(255,255,255,0.18)';

            return `
                <g class="unfold-node" data-id="${p.id}" style="cursor: pointer;">
                    <rect x="${p.x1}" y="346" width="${w}" height="28" rx="5" 
                          fill="${fill}" stroke="${stroke}" stroke-width="1.2" class="svg-plan-rect" />
                    <text x="${cx}" y="364" font-size="11" font-family="var(--font-sans)" font-weight="bold" 
                          fill="#FFFFFF" text-anchor="middle">
                        ${p.label}
                    </text>
                </g>
            `;
        }).join('\n');
    }

    function getMilestoneInfo(doc) {
        if (!doc) return null;
        const y = doc.year || 0;
        const date = doc.date || '';
        const title = (doc.title || '').toLowerCase();
        const type = doc.type || '';
        const tier = doc.tier || '';
        const author = (doc.author || '').toLowerCase();
        const recipient = doc.recipient || '';
        const id = doc.id || '';

        // ==========================================
        // 1. PRIORITÄTSSTUFE 1: Plan-Chartas & Strategische Rahmenbotschaften
        // an die Konferenz der Kontinentalen Beraterräte
        // ==========================================
        // 2021-12-30: Charta des Neunjahresplans (2022–2031) & 25-Jahre-Perspektive
        if (date === '2021-12-30') {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta (Fundament)',
                badgeEn: 'Plan Charter (Foundation)',
                planId: 'plan_9yp_22',
                reasonDe: 'Charta und Gesamtfundament des Neunjahresplans (2022–2031) und der 25-jährigen Perspektive bis 2046 an die Beraterkonferenz (Dezember 2021)',
                reasonEn: 'The comprehensive charter and foundation of the Nine Year Plan (2022–2031) to the Counsellors Conference (December 2021)'
            };
        }
        // 2025-12-31: Halbzeit-Rahmenbotschaft des Neunjahresplans
        if (date === '2025-12-31') {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Strategischer Rahmen (Halbzeit)',
                badgeEn: 'Mid-term Strategic Framework',
                planId: 'plan_9yp_22',
                reasonDe: 'Monumentale Halbzeit-Rahmenbotschaft des Neunjahresplans an die Konferenz der Kontinentalen Beraterräte (Dezember 2025)',
                reasonEn: 'Major Mid-term Strategic Framework of the Nine Year Plan to the Counsellors Conference (December 2025)'
            };
        }
        // 2015-12-29: Strategischer Rahmen für den 2016–2021 Plan (Abschluss der 25-jährigen Serie)
        if (date === '2015-12-29') {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta',
                badgeEn: 'Plan Charter',
                planId: 'plan_5yp_16',
                reasonDe: 'Strategischer Rahmen für den Abschluss der 25-jährigen Plan-Serie an die Beraterkonferenz (Dezember 2015)',
                reasonEn: 'Strategic framework concluding the 25-year series of global plans to the Counsellors (December 2015)'
            };
        }
        // 2010-12-28: Die Architektur des Gemeindeaufbaus (2011–2016)
        if (date === '2010-12-28') {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta',
                badgeEn: 'Plan Charter',
                planId: 'plan_5yp_11',
                reasonDe: 'Monumentale Synthese über den Wachstumsprozess und die Architektur des Gemeindeaufbaus an die Berater (Dezember 2010)',
                reasonEn: 'Comprehensive synthesis on cluster growth and the architecture of community building to the Counsellors (December 2010)'
            };
        }
        // 2005-12-27: Rahmen des Fünfjahresplans 2006–2011 & Vorjugendprogramm
        if (date === '2005-12-27') {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta',
                badgeEn: 'Plan Charter',
                planId: 'plan_5yp_06',
                reasonDe: 'Strategischer Rahmen für 2006–2011: Einführung des Vorjugendprogramms & Intensivierung an die Berater (Dezember 2005)',
                reasonEn: 'Strategic framework 2006–2011 establishing the junior youth programme and intensive growth to the Counsellors (December 2005)'
            };
        }
        // 2001-01-09: Einführung des Cluster-Systems & Kernaktivitäten (2001–2006)
        if (date === '2001-01-09' || (y === 2001 && date.startsWith('2001-01') && (title.includes('continental boards') || recipient === 'counsellors'))) {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta',
                badgeEn: 'Plan Charter',
                planId: 'plan_5yp_01',
                reasonDe: 'Grundsteinlegung des Cluster-Systems und der Kernaktivitäten an die Beraterkonferenz (Januar 2001)',
                reasonEn: 'Foundational framework establishing the cluster system to the Counsellors (January 2001)'
            };
        }
        // 1995-12-26: Grundsteinlegung der weltweiten Institutskultur (Vierjahresplan)
        if (date === '1995-12-26' || (y === 1995 && date.startsWith('1995-12') && (recipient === 'counsellors' || title.includes('counsellors')))) {
            return {
                isMilestone: true,
                priority: 1,
                badgeDe: 'Plan-Charta (Epochenwende)',
                badgeEn: 'Plan Charter (Turning Point)',
                planId: 'plan_4yp_96',
                reasonDe: 'Epochenwende: Grundsteinlegung der weltweiten Institutskultur an die Beraterkonferenz (Dezember 1995)',
                reasonEn: 'Historical turning point launching the systematic training institute process (December 1995)'
            };
        }

        // ==========================================
        // 2. PRIORITÄTSSTUFE 2: Plan-Auftaktbotschaften (Riḍván des Startjahres jedes Plans)
        // ==========================================
        // 2022: Start des Neunjahresplans
        if (y === 2022 && (date === '2022-04-21' || type === 'Riḍván-Botschaft') && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_9yp_22',
                reasonDe: 'Offizieller weltweiter Auftakt des Neunjahresplans (2022–2031) an die Bahá’í der Welt',
                reasonEn: 'Official worldwide launch of the Nine Year Plan (2022–2031) to the Bahá’ís of the World'
            };
        }
        // 2021: Start des Einjahresplans
        if (y === 2021 && (date === '2021-04-21' || date === '2021-04-20' || type === 'Riḍván-Botschaft') && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_1yp_21',
                reasonDe: 'Riḍván 2021: Lancierung des Einjahresplans (2021–2022) als Brücke der Epochen',
                reasonEn: 'Riḍván 2021: Launch of the One Year Plan (2021–2022) bridging the epochs'
            };
        }
        // 2016: Start des Fünfjahresplans IV
        if (y === 2016 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_5yp_16',
                reasonDe: 'Riḍván 2016: Lancierung des letzten Fünfjahresplans der 25-jährigen Serie',
                reasonEn: 'Riḍván 2016: Launch of the concluding Five Year Plan of the 25-year series'
            };
        }
        // 2011: Start des Fünfjahresplans III
        if (y === 2011 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_5yp_11',
                reasonDe: 'Riḍván 2011: Lancierung des Fünfjahresplans (2011–2016) mit Ziel von 5.000 Clustern',
                reasonEn: 'Launch of the Five Year Plan (2011–2016) targeting 5,000 clusters'
            };
        }
        // 2006: Start des Fünfjahresplans II
        if (y === 2006 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_5yp_06',
                reasonDe: 'Riḍván 2006: Lancierung des Fünfjahresplans (2006–2011) mit Ziel von 1.500 Clustern',
                reasonEn: 'Launch of the Five Year Plan (2006–2011) targeting 1,500 clusters'
            };
        }
        // 2001: Start des Fünfjahresplans I
        if (y === 2001 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_5yp_01',
                reasonDe: 'Riḍván 2001: Beginn der Serie von Fünfjahresplänen & Verankerung der Kernaktivitäten',
                reasonEn: 'Beginning of the series of Five Year Plans establishing core activities'
            };
        }
        // 2000: Start des Zwölfmonatsplans
        if (y === 2000 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_12mp_00',
                reasonDe: 'Riḍván 2000: Lancierung des Zwölfmonatsplans zur Vorbereitung der Jahrhundertwende',
                reasonEn: 'Launch of the Twelve Month Plan preparing the turn of the century'
            };
        }
        // 1996: Start des Vierjahresplans & Institutskultur
        if (y === 1996 && type === 'Riḍván-Botschaft' && !title.includes('europa') && !title.includes('europe') && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_4yp_96',
                reasonDe: 'Meilenstein Riḍván 1996: Start des Vierjahresplans & Verankerung des Trainingsinstituts',
                reasonEn: 'Milestone Riḍván 1996 launching the Four Year Plan & training institute process'
            };
        }
        // 1993: Start des Dreijahresplans
        if (y === 1993 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_3yp_93',
                reasonDe: 'Riḍván 1993: Lancierung des Dreijahresplans (1993–1996)',
                reasonEn: 'Launch of the Three Year Plan (1993–1996)'
            };
        }
        // 1986: Start des Sechsjahresplans
        if (y === 1986 && type === 'Riḍván-Botschaft' && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_6yp_86',
                reasonDe: 'Riḍván 1986: Lancierung des Sechsjahresplans (1986–1992)',
                reasonEn: 'Launch of the Six Year Plan (1986–1992)'
            };
        }
        // 1979: Start des Siebenjahresplans
        if (y === 1979 && (date === '1979-03-21' || date === '1979-05-23' || type === 'Riḍván-Botschaft')) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_7yp_79',
                reasonDe: 'Lancierung des Siebenjahresplans (1979–1986) unter weltweiten Herausforderungen',
                reasonEn: 'Launch of the Seven Year Plan (1979–1986) amid global upheavals'
            };
        }
        // 1974: Start des Fünfjahresplans
        if (y === 1974 && (date === '1974-03-21' || type === 'Riḍván-Botschaft' || (title.includes('naw-rúz') && recipient === 'world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_5yp_74',
                reasonDe: 'Lancierung des Fünfjahresplans (1974–1979) zur Festigung der weltweiten Basis',
                reasonEn: 'Launch of the Five Year Plan (1974–1979) consolidating the global base'
            };
        }
        // 1964: Start des Neunjahresplans
        if (y === 1964 && (date === '1964-04-21' || (date.startsWith('1964-04') && recipient === 'world'))) {
            return {
                isMilestone: true,
                priority: 2,
                badgeDe: 'Plan-Auftakt',
                badgeEn: 'Plan Launch',
                planId: 'plan_9yp_64',
                reasonDe: 'Lancierung des Neunjahresplans (1964–1973) — Erster globaler Plan des Hauses',
                reasonEn: 'Launch of the Nine Year Plan (1964–1973) — First global plan of the House of Justice'
            };
        }

        // ==========================================
        // 3. PRIORITÄTSSTUFE 3: Welthistorische Erklärungen & Globale Konferenzaufrufe
        // ==========================================
        // 1985-10-01: Die Verheißung des Weltfriedens (The Promise of World Peace)
        if (y === 1985 && (title.includes('verheißung') || title.includes('promise of world peace') || (date === '1985-10-01' && (recipient === 'world' || title.includes('peoples of the world'))))) {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Welterklärung',
                badgeEn: 'World Statement',
                reasonDe: 'Welthistorische Friedensbotschaft des Universalen Hauses der Gerechtigkeit an die Völker der Welt (Oktober 1985)',
                reasonEn: 'Landmark peace statement to the peoples of the world on universal peace (October 1985)'
            };
        }
        // 2002-04-01: Schreiben an die religiösen Führer der Welt
        if (y === 2002 && (title.includes('religiöse') || title.includes('religious leaders') || date === '2002-04-01')) {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Welterklärung',
                badgeEn: 'World Statement',
                reasonDe: 'Aufruf an die religiösen Führer der Welt zur Überwindung des religiösen Fanatismus (April 2002)',
                reasonEn: 'Historic appeal to the world’s religious leaders regarding religious fanaticism (April 2002)'
            };
        }
        // 2005: Ein gemeinsamer Glaube (One Common Faith)
        if (y === 2005 && (id === 'd2bbb1dcb282' || (title.includes('one common faith') && !title.includes('publication')) || title.includes('gemeinsamer glaube'))) {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Welterklärung',
                badgeEn: 'Major Work',
                reasonDe: 'Grundlegendes Werk über die Einheit aller Religionen und die Reifung der Menschheit (2005)',
                reasonEn: 'Major work on the unity of religions and the spiritual maturity of humanity (2005)'
            };
        }
        // 2022-01-04: Einberufung der weltweiten Konferenzserie
        if (date === '2022-01-04') {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Konferenz-Aufruf',
                badgeEn: 'Conference Convocation',
                planId: 'plan_9yp_22',
                reasonDe: 'Einberufung der weltweiten Konferenzserie zur Freisetzung der gesellschaftsbildenden Kräfte (Januar 2022)',
                reasonEn: 'Convocation of the global wave of conferences releasing society-building powers (January 2022)'
            };
        }
        // 2026-01-04: Abschluss der Beraterkonferenz 2025/2026 an die Bahá'í der Welt
        if (date === '2026-01-04') {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Beraterkonferenz-Abschluss',
                badgeEn: 'Counsellors Conference Close',
                planId: 'plan_9yp_22',
                reasonDe: 'Botschaft an die weltweite Gemeinde zum Abschluss der Beraterkonferenz 2025/2026 (Januar 2026)',
                reasonEn: 'Message to the worldwide community concluding the 2025/2026 Counsellors Conference (January 2026)'
            };
        }
        // 2016-01-02: Abschluss der Beraterkonferenz 2015/2016
        if (date === '2016-01-02') {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Beraterkonferenz-Abschluss',
                badgeEn: 'Counsellors Conference Close',
                planId: 'plan_5yp_16',
                reasonDe: 'Botschaft an die Bahá’í der Welt zum Abschluss der Beraterkonferenz 2015/2016 (Januar 2016)',
                reasonEn: 'Message to the Bahá’ís of the World concluding the 2015/2016 Counsellors Conference (January 2016)'
            };
        }
        // 2013-02-08: Einberufung der 114 Jugendkonferenzen
        if (date === '2013-02-08') {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Konferenz-Aufruf',
                badgeEn: 'Conference Convocation',
                planId: 'plan_5yp_11',
                reasonDe: 'Aufruf an die Jugend der Welt zu den 114 weltweiten Jugendkonferenzen (Februar 2013)',
                reasonEn: 'Historic call convening 114 worldwide youth conferences (February 2013)'
            };
        }
        // 2008-10-20: Einberufung der 41 regionalen Konferenzen
        if (date === '2008-10-20') {
            return {
                isMilestone: true,
                priority: 3,
                badgeDe: 'Konferenz-Aufruf',
                badgeEn: 'Conference Convocation',
                planId: 'plan_5yp_06',
                reasonDe: 'Historischer Aufruf zur Einberufung der 41 regionalen Konferenzen weltweit (Oktober 2008)',
                reasonEn: 'Historic convocation of 41 regional conferences worldwide (October 2008)'
            };
        }

        // ==========================================
        // 4. PRIORITÄTSSTUFE 4: Zentenar- & Epochen-Gedenkbotschaften
        // ==========================================
        // 2023-11-28: Reflexionen über 100 Jahre Gestaltendes Zeitalter & Grabmal
        if (date === '2023-11-28') {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Epochen-Zentenar',
                badgeEn: 'Epochal Centenary',
                planId: 'plan_9yp_22',
                reasonDe: 'Reflexion über die ersten 100 Jahre des Gestaltenden Zeitalters und das Grabmal ‘Abdu’l-Bahás',
                reasonEn: 'Reflections on the first centenary of the Formative Age and the Shrine of ‘Abdu’l-Bahá'
            };
        }
        // 2021-11-27: 100. Jahrestag des Hinscheidens ‘Abdu’l-Bahás
        if (date === '2021-11-27' || (y === 2021 && title.includes('tribute') && title.includes('abdu'))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Zentenar-Huldigung',
                badgeEn: 'Centenary Tribute',
                planId: 'plan_1yp_21',
                reasonDe: 'Huldigung zum 100. Jahrestag des Hinscheidens ‘Abdu’l-Bahás und Seines Bündnisses (November 2021)',
                reasonEn: 'Tribute to ‘Abdu’l-Bahá on the Centenary of His Passing and Covenant (November 2021)'
            };
        }
        // 2020-11-25: 100 Jahre Einsetzung des Bündnisses Bahá’u’lláhs
        if (date === '2020-11-25') {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Zentenar-Gedenken',
                badgeEn: 'Centenary Tribute',
                planId: 'plan_5yp_16',
                reasonDe: 'Gedenken zum 100. Jahrestag der Einsetzung des Bündnisses Bahá’u’lláhs (November 2020)',
                reasonEn: 'Centenary of the institution of the Day of the Covenant (November 2020)'
            };
        }
        // 2019-10: 200. Jahrestag der Geburt des Báb
        if (y === 2019 && date === '2019-10-01') {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Zweihundertjahrfeier',
                badgeEn: 'Bicentenary',
                planId: 'plan_5yp_16',
                reasonDe: 'Zweihundertjahrfeier der Geburt des Báb (Bicentenary Oktober 2019)',
                reasonEn: 'Bicentenary of the Birth of the Báb (October 2019)'
            };
        }
        // 2017-10: 200. Jahrestag der Geburt Bahá’u’lláhs
        if (y === 2017 && (date === '2017-10-31' || title.includes('200') || title.includes('bicentenary')) && (recipient === 'world' || title.includes('der welt') || title.includes('world'))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Zweihundertjahrfeier',
                badgeEn: 'Bicentenary',
                planId: 'plan_5yp_16',
                reasonDe: 'Zweihundertjahrfeier der Geburt Bahá’u’lláhs (Bicentenary Oktober 2017)',
                reasonEn: 'Bicentenary of the Birth of Bahá’u’lláh (October 2017)'
            };
        }
        // 2001-05-24: Einweihung der Terrassen auf dem Berg Karmel
        if (date === '2001-05-24' || date === '2001-05-22' || (y === 2001 && title.includes('terraces'))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Einweihung Terrassen',
                badgeEn: 'Terraces Inauguration',
                planId: 'plan_5yp_01',
                reasonDe: 'Vollendung der Bauten des Bogens und Einweihung der Terrassen auf dem Berg Karmel (Mai 2001)',
                reasonEn: 'Inauguration of the Terraces and completion of the Arc buildings on Mount Carmel (May 2001)'
            };
        }
        // 1992: Botschaft zum Zweiten Bahá'í-Weltkongress in New York
        if (y === 1992 && (date === '1992-11-23' || title.includes('second bahá’í world congress') || (type === 'Riḍván-Botschaft' && recipient === 'world'))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Weltkongress & Heiliges Jahr',
                badgeEn: 'World Congress & Holy Year',
                planId: 'plan_6yp_86',
                reasonDe: 'Botschaft zum Heiligen Jahr 1992 & Zweiten Bahá’í-Weltkongress in New York',
                reasonEn: 'Message for the Holy Year 1992 & Second Bahá’í World Congress in New York'
            };
        }
        // 1972: Verfassung des Universalen Hauses der Gerechtigkeit
        if (y === 1972 && type === 'Riḍván-Botschaft') {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Verfassung des Hauses',
                badgeEn: 'Constitution of the House',
                planId: 'plan_9yp_64',
                reasonDe: 'Riḍván 1972: Vollendung der Verfassung des Universalen Hauses der Gerechtigkeit',
                reasonEn: 'Riḍván 1972: Finalization of the Constitution of the Universal House of Justice'
            };
        }
        // 1968: Riḍván 1968
        if (y === 1968 && type === 'Riḍván-Botschaft') {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Zentenarfeier',
                badgeEn: 'Centenary Commemoration',
                planId: 'plan_9yp_64',
                reasonDe: 'Riḍván 1968: Zentenarfeier der Ankunft Bahá’u’lláhs im Heiligen Land',
                reasonEn: 'Riḍván 1968: Centenary of Bahá’u’lláh’s Arrival in the Holy Land'
            };
        }
        // 1963-04-30: Erste Botschaft an den Ersten Bahá'í-Weltkongress in London
        if (date === '1963-04-30' || (y === 1963 && title.includes('first bahá’í world congress'))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Erster Weltkongress',
                badgeEn: 'First World Congress',
                planId: 'plan_10yc_53',
                reasonDe: 'Erste historische Botschaft des neu gewählten Universalen Hauses der Gerechtigkeit (London, April 1963)',
                reasonEn: 'First historic message of the newly elected Universal House of Justice (London, April 1963)'
            };
        }
        // 1963-10-01: Erste Botschaft an die Bahá'í der Welt
        if (date === '1963-10-01' || (y === 1963 && date.startsWith('1963-10') && (recipient === 'world' || title.includes('followers')))) {
            return {
                isMilestone: true,
                priority: 4,
                badgeDe: 'Erste Grundsatzbotschaft',
                badgeEn: 'First Global Message',
                planId: 'plan_10yc_53',
                reasonDe: 'Erste weltweite Grundsatzbotschaft des Universalen Hauses der Gerechtigkeit (Oktober 1963)',
                reasonEn: 'First global message to the followers of Bahá’u’lláh following the election (October 1963)'
            };
        }

        // ==========================================
        // 5. PRIORITÄTSSTUFE 5: Kanonische Werke (Heroisches & Gestaltendes Zeitalter)
        // ==========================================
        if (tier === 'books') {
            if (author.includes('báb') || author.includes('bab') || id.includes('bab')) {
                return {
                    isMilestone: true,
                    priority: 5,
                    badgeDe: 'Kanonisches Werk',
                    badgeEn: 'Canonical Work',
                    reasonDe: 'Kanonisches Hauptwerk des Báb (Auswahl aus Seinen Schriften)',
                    reasonEn: 'Canonical masterwork of the Báb (Selections from the Writings of the Báb)'
                };
            }
            if (author.includes('bahá') || author.includes('baha') || id.includes('bahaullah')) {
                if (id.includes('aqdas') || id.includes('iqan') || id.includes('hw') || id.includes('hidden') || id.includes('esw') || id.includes('wolf') ||
                    title.includes('aqdas') || title.includes('íqán') || title.includes('iqan') || title.includes('verborgene') || title.includes('hidden words') ||
                    title.includes('sohn des wolfes') || title.includes('son of the wolf') || title.includes('ährenlese') || title.includes('gleanings')) {
                    return {
                        isMilestone: true,
                        priority: 5,
                        badgeDe: 'Kanonisches Werk',
                        badgeEn: 'Canonical Work',
                        reasonDe: 'Kanonisches Hauptwerk der Offenbarung Bahá’u’lláhs',
                        reasonEn: 'Canonical central work of Bahá’u’lláh’s Revelation'
                    };
                }
            }
            if (author.includes('abdu') || id.includes('abdul_baha')) {
                if (id.includes('wt') || id.includes('testament') || id.includes('saq') || id.includes('answered') ||
                    title.includes('wille und testament') || title.includes('will and testament') ||
                    title.includes('beantwortete fragen') || title.includes('some answered questions') ||
                    title.includes('göttlichen plans') || title.includes('divine plan') ||
                    title.includes('geheimnis') || title.includes('civilization')) {
                    return {
                        isMilestone: true,
                        priority: 5,
                        badgeDe: 'Kanonisches Werk',
                        badgeEn: 'Canonical Work',
                        reasonDe: 'Grundlegendes Werk von ‘Abdu’l-Bahá (Charta der Ordnung & weltweiten Ausbreitung)',
                        reasonEn: 'Foundational work of ‘Abdu’l-Bahá (Charter of Order & Global Expansion)'
                    };
                }
            }
            if (author.includes('shoghi') || id.includes('shoghi_effendi')) {
                if (id.includes('wob') || id.includes('world_order') || id.includes('pdc') || id.includes('promised') || id.includes('gpb') || id.includes('god_passes') ||
                    title.includes('weltordnung') || title.includes('world order') ||
                    title.includes('advent') || title.includes('gerechtigkeit') ||
                    title.includes('verheißene tag') || title.includes('promised day') ||
                    title.includes('gott geht vorüber') || title.includes('god passes by')) {
                    return {
                        isMilestone: true,
                        priority: 5,
                        badgeDe: 'Epochen-Standardwerk',
                        badgeEn: 'Epochal Work',
                        reasonDe: 'Epochen-Standardwerk Shoghi Effendis zur Weltordnung und Glaubensgeschichte',
                        reasonEn: 'Epochal masterwork of Shoghi Effendi on the World Order and Faith history'
                    };
                }
            }
        }

        return null;
    }

    function renderMilestonesSpotlight(docs, isDe) {
        const uniqueMilestones = [];
        const seen = new Set();
        const milestones = docs.filter(d => d.isMilestone);

        milestones.forEach(d => {
            const isRidvan = (d.type || '').includes('Riḍván') || (d.title || '').toLowerCase().includes('riḍván') || (d.title || '').toLowerCase().includes('ridvan');
            const key = isRidvan 
                ? ('ridvan-' + (d.year || (d.date ? d.date.slice(0, 4) : '')))
                : (d.groupId || d.date || d.id);

            if (!seen.has(key)) {
                seen.add(key);
                const matchLang = milestones.find(other => {
                    const otherIsRidvan = (other.type || '').includes('Riḍván') || (other.title || '').toLowerCase().includes('riḍván') || (other.title || '').toLowerCase().includes('ridvan');
                    const otherKey = otherIsRidvan 
                        ? ('ridvan-' + (other.year || (other.date ? other.date.slice(0, 4) : '')))
                        : (other.groupId || other.date || other.id);
                    return otherKey === key && (isDe ? other.language === 'deutsch' : other.language === 'english');
                });
                uniqueMilestones.push(matchLang || d);
            }
        });

        if (uniqueMilestones.length === 0) return '';

        // Priorisierte Sortierung:
        // 1. Bei Epochen (tdp_3, epoch_6): Aktiver Neunjahresplan vor Einjahresplan
        // 2. Primär nach autorisierter Prioritätsstufe (1: Plan-Charta -> 2: Plan-Auftakt -> 3: Welterklärung/Konferenz -> 4: Zentenar -> 5: Kanonisch)
        // 3. Innerhalb derselben Stufe nach Datum (chronologisch, Start vor Halbzeit)
        uniqueMilestones.sort((a, b) => {
            const planWeight = (doc) => {
                if (doc.milestonePlanId === 'plan_9yp_22') return 1;
                if (doc.milestonePlanId === 'plan_1yp_21') return 2;
                return 3;
            };
            const pwA = planWeight(a);
            const pwB = planWeight(b);
            if (pwA !== pwB) return pwA - pwB;

            const pA = a.milestonePriority || 99;
            const pB = b.milestonePriority || 99;
            if (pA !== pB) return pA - pB;

            const da = a.date || '';
            const db = b.date || '';
            if (da !== db) return da.localeCompare(db);
            return (a.year || 0) - (b.year || 0);
        });

        const cardsHtml = uniqueMilestones.map(d => {
            const title = (isDe ? (d.deTitle || d.title) : (d.enTitle || d.title)) || d.title;
            const reason = isDe ? (d.milestoneReasonDe || '') : (d.milestoneReasonEn || '');
            const badge = isDe ? (d.milestoneBadgeDe || 'Schlüssel-Botschaft') : (d.milestoneBadgeEn || 'Key Message');
            const dateStr = d.date ? d.date : (d.year || '');
            const safeDocId = (d.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const isCharta = d.milestonePriority === 1;

            return `
                <div class="spotlight-card ${isCharta ? 'is-charta' : ''}" data-doc-id="${escapeHtml(d.id)}" onclick="window.openDocument('${safeDocId}')" title="${escapeHtml(title)}">
                    <div class="spotlight-card-top">
                        <span class="spotlight-date">${escapeHtml(dateStr)}</span>
                        <span class="doc-milestone-tag ${isCharta ? 'tag-charta' : ''}">${escapeHtml(badge)}</span>
                    </div>
                    <h5 class="spotlight-card-title">${escapeHtml(title)}</h5>
                    ${reason ? `<p class="spotlight-reason">${escapeHtml(reason)}</p>` : ''}
                    <span class="spotlight-action">${isDe ? 'Jetzt lesen →' : 'Read Now →'}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="inspector-milestones-spotlight">
                <div class="spotlight-header">
                    <h4 class="spotlight-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ${isDe ? "Historische Schlüssel-Botschaften dieser Epoche" : "Key Milestone Messages of this Era"}
                    </h4>
                    <span class="spotlight-sub">${isDe ? "Laut autorisierten historischen Quellen der Bahá’í-Gemeinde priorisiert" : "Prioritized according to authorized Bahá’í historical sources"}</span>
                </div>
                <div class="spotlight-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    function renderInspector(id) {
        const inspector = document.getElementById('unfold-inspector');
        if (!inspector) return;

        const entity = ENTITIES[id] || ENTITIES['tdp_3'];
        const isDe = currentLang === 'de';
        const docs = getDocumentsForEntity(entity);

        const title = isDe ? entity.nameDe : entity.nameEn;
        const sub = isDe ? entity.subDe : entity.subEn;
        const category = isDe ? entity.categoryDe : entity.categoryEn;
        const desc = isDe ? entity.descDe : entity.descEn;

        // Count categories
        const milestoneCount = docs.filter(d => d.isMilestone).length;
        const ridvanCount = docs.filter(d => (d.type || '').includes('Riḍván') || (d.title || '').includes('Riḍván')).length;
        const counsellorCount = docs.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors' || (d.title || '').includes('Berater')).length;
        const bookCount = docs.filter(d => d.tier === 'books' || d.type === 'Heiliges Buch / Schrift').length;

        // Reset filter if milestones filter is active but no milestones exist
        if (currentDocFilter === 'milestones' && milestoneCount === 0) {
            currentDocFilter = 'all';
        }

        let displayedDocs = docs;
        if (currentDocFilter === 'milestones' && milestoneCount > 0) {
            displayedDocs = docs.filter(d => d.isMilestone);
        } else if (currentDocFilter === 'ridvan') {
            displayedDocs = docs.filter(d => (d.type || '').includes('Riḍván') || (d.title || '').includes('Riḍván'));
        } else if (currentDocFilter === 'institutions') {
            displayedDocs = docs.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors' || (d.title || '').includes('Berater'));
        } else if (currentDocFilter === 'books') {
            displayedDocs = docs.filter(d => d.tier === 'books' || d.type === 'Heiliges Buch / Schrift');
        }

        inspector.innerHTML = `
            <div class="inspector-header">
                <div class="inspector-meta-left">
                    <span class="inspector-category-badge">${category}</span>
                    <span class="inspector-period-tag">${sub}</span>
                </div>
                <div class="inspector-stats">
                    ${milestoneCount > 0 ? `<span class="stat-pill stat-pill-milestone"><strong>${milestoneCount}</strong> ${isDe ? (milestoneCount === 1 ? 'Schlüssel-Botschaft' : 'Schlüssel-Botschaften') : 'Key Messages'}</span>` : ''}
                    <span class="stat-pill"><strong>${docs.length}</strong> ${isDe ? (docs.length === 1 ? 'Dokument' : 'Dokumente') : 'Documents'}</span>
                    ${ridvanCount > 0 ? `<span class="stat-pill"><strong>${ridvanCount}</strong> Riḍván</span>` : ''}
                    ${counsellorCount > 0 ? `<span class="stat-pill"><strong>${counsellorCount}</strong> ${isDe ? 'Berateramt' : 'Counsellors'}</span>` : ''}
                    ${bookCount > 0 ? `<span class="stat-pill"><strong>${bookCount}</strong> ${isDe ? 'Bücher' : 'Books'}</span>` : ''}
                </div>
            </div>

            <h3 class="inspector-title">${escapeHtml(title)}</h3>

            ${desc ? `<p class="inspector-desc">${escapeHtml(desc)}</p>` : ''}

            ${entity.quote ? `
                <blockquote class="inspector-quote">
                    ${escapeHtml(entity.quote)}
                    ${entity.quoteSource ? `<cite>— ${escapeHtml(entity.quoteSource)}</cite>` : ''}
                </blockquote>
            ` : ''}

            <!-- Schlüssel-Botschaften Spotlight -->
            ${renderMilestonesSpotlight(docs, isDe)}

            <!-- Filter & Document List -->
            <div class="inspector-docs-section">
                <div class="inspector-docs-header">
                    <h4 class="inspector-docs-heading">
                        ${isDe ? "Dokumente & Schriften dieses Zeitraums" : "Documents & Writings of this Era"}
                    </h4>
                    <div class="inspector-subfilters">
                        ${milestoneCount > 0 ? `
                        <button class="subfilter-btn subfilter-milestones ${currentDocFilter === 'milestones' ? 'active' : ''}" onclick="window.TimelineModule.filterDocs('milestones')">
                            ${isDe ? 'Schlüssel-Botschaften' : 'Key Messages'} (${milestoneCount})
                        </button>` : ''}
                        <button class="subfilter-btn ${currentDocFilter === 'all' ? 'active' : ''}" onclick="window.TimelineModule.filterDocs('all')">
                            ${isDe ? 'Alle' : 'All'} (${docs.length})
                        </button>
                        ${ridvanCount > 0 ? `
                        <button class="subfilter-btn ${currentDocFilter === 'ridvan' ? 'active' : ''}" onclick="window.TimelineModule.filterDocs('ridvan')">
                            Riḍván (${ridvanCount})
                        </button>` : ''}
                        ${counsellorCount > 0 ? `
                        <button class="subfilter-btn ${currentDocFilter === 'institutions' ? 'active' : ''}" onclick="window.TimelineModule.filterDocs('institutions')">
                            ${isDe ? 'Berater & Räte' : 'Institutions'} (${counsellorCount})
                        </button>` : ''}
                        ${bookCount > 0 ? `
                        <button class="subfilter-btn ${currentDocFilter === 'books' ? 'active' : ''}" onclick="window.TimelineModule.filterDocs('books')">
                            ${isDe ? 'Bücher' : 'Books'} (${bookCount})
                        </button>` : ''}
                    </div>
                </div>

                <div class="inspector-docs-grid" id="inspector-docs-grid">
                    ${renderDocumentCards(displayedDocs)}
                </div>
            </div>
        `;
    }

    function filterDocs(type) {
        currentDocFilter = type;
        const entity = ENTITIES[currentSelectedId] || ENTITIES['tdp_3'];
        let docs = getDocumentsForEntity(entity);

        if (type === 'milestones') {
            docs = docs.filter(d => d.isMilestone);
        } else if (type === 'ridvan') {
            docs = docs.filter(d => (d.type || '').includes('Riḍván') || (d.title || '').includes('Riḍván'));
        } else if (type === 'institutions') {
            docs = docs.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors' || (d.title || '').includes('Berater'));
        } else if (type === 'books') {
            docs = docs.filter(d => d.tier === 'books' || d.type === 'Heiliges Buch / Schrift');
        }

        const grid = document.getElementById('inspector-docs-grid');
        if (grid) grid.innerHTML = renderDocumentCards(docs);

        document.querySelectorAll('.subfilter-btn').forEach(btn => {
            const t = btn.textContent.toLowerCase();
            let active = false;
            if (type === 'milestones' && (t.includes('schlüssel') || t.includes('key'))) active = true;
            else if (type === 'all' && (t.includes('alle') || t.includes('all'))) active = true;
            else if (type === 'ridvan' && t.includes('riḍván')) active = true;
            else if (type === 'institutions' && (t.includes('berater') || t.includes('institutions'))) active = true;
            else if (type === 'books' && (t.includes('bücher') || t.includes('books'))) active = true;
            btn.classList.toggle('active', active);
        });
    }

    function renderDocumentCards(docs) {
        if (docs.length === 0) {
            return `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
                ${currentLang === 'de' ? 'Keine Dokumente in dieser Auswahl vorhanden.' : 'No documents found for this selection.'}
            </p>`;
        }

        const unifiedMap = new Map();
        docs.forEach(d => {
            const key = d.groupId || d.id;
            if (!unifiedMap.has(key)) {
                unifiedMap.set(key, []);
            }
            unifiedMap.get(key).push(d);
        });

        const unifiedList = [];
        unifiedMap.forEach(docsInGroup => {
            let primaryDoc;
            if (currentLang === 'en') {
                primaryDoc = docsInGroup.find(d => (d.language || '').toLowerCase() === 'english') || docsInGroup[0];
            } else {
                primaryDoc = docsInGroup.find(d => (d.language || '').toLowerCase() === 'deutsch') || docsInGroup[0];
            }
            const mergedFiles = Object.assign({}, primaryDoc.formatFiles);
            const mergedFormats = new Set(primaryDoc.availableFormats || []);
            docsInGroup.forEach(item => {
                if (item.formatFiles) Object.assign(mergedFiles, item.formatFiles);
                if (item.availableFormats) item.availableFormats.forEach(f => mergedFormats.add(f));
            });

            const hasMilestone = docsInGroup.some(item => item.isMilestone);
            const milestoneItem = docsInGroup.find(item => item.milestoneReasonDe || item.milestoneReasonEn) || docsInGroup.find(item => item.isMilestone);

            unifiedList.push(Object.assign({}, primaryDoc, {
                formatFiles: mergedFiles,
                availableFormats: Array.from(mergedFormats),
                siblingCount: docsInGroup.length,
                isMilestone: hasMilestone,
                milestoneReasonDe: primaryDoc.milestoneReasonDe || (milestoneItem ? milestoneItem.milestoneReasonDe : undefined),
                milestoneReasonEn: primaryDoc.milestoneReasonEn || (milestoneItem ? milestoneItem.milestoneReasonEn : undefined)
            }));
        });

        // Priorisiere Schlüssel-Botschaften an oberster Stelle, gefolgt von chronologischer Sortierung
        unifiedList.sort((a, b) => {
            const aM = a.isMilestone ? 1 : 0;
            const bM = b.isMilestone ? 1 : 0;
            if (aM !== bM) return bM - aM;
            const ya = a.year || (a.date ? parseInt(a.date.substring(0, 4), 10) : 0);
            const yb = b.year || (b.date ? parseInt(b.date.substring(0, 4), 10) : 0);
            if (ya !== yb) return ya - yb;
            return (a.date || '').localeCompare(b.date || '');
        });

        const sample = unifiedList.slice(0, 48);
        return sample.map((doc, idx) => {
            return window.createDocCard ? window.createDocCard(doc, '', idx) : '';
        }).join('');
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

    window.getMilestoneInfo = getMilestoneInfo;

    return {
        init: init,
        selectEntity: selectEntity,
        setLanguage: setLanguage,
        scrubToYear: scrubToYear,
        filterDocs: filterDocs,
        getMilestoneInfo: getMilestoneInfo
    };
})();
