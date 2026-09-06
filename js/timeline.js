/**
 * timeline.js
 * Interaktive zeitliche Übersicht aller Bahá'í-Äras, Zeitalter, Epochen und Lehrpläne.
 * Basiert auf dem historischen Zeitstrahl-Diagramm "Unfoldment of the Bahá'í Faith".
 */

window.TimelineModule = (function() {
    let currentSelectedPlanId = '9yp_22'; // Default: Aktueller Neunjahresplan
    let currentRecipientFilter = 'all';
    let currentSearchQuery = '';

    // Definition der historischen Lehrpläne und Meilensteine
    const PLANS = [
        {
            id: '1963_founding',
            code: '1963',
            name: 'Wahl des Universalen Hauses der Gerechtigkeit',
            shortName: 'Wahl des Hauses',
            period: '1963',
            startDate: '1963-04-21',
            endDate: '1964-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Die historische Wahl der ersten Mitglieder des Universalen Hauses der Gerechtigkeit durch die Mitglieder von 56 Nationalen Geistigen Räten in Haifa, die das Ende des Zehnjährigen Kreuzzugs von Shoghi Effendi markierte.',
            badgeColor: '#5C6B73'
        },
        {
            id: '9yp',
            code: '9YP',
            name: 'Neunjahresplan (1964–1973)',
            shortName: 'Neunjahresplan',
            period: '1964–1973',
            startDate: '1964-04-21',
            endDate: '1974-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Der erste globale Lehrplan des Universalen Hauses der Gerechtigkeit. Monumentale weltweite Ausbreitung, Vervielfachung Nationaler Räte und Erwerb von Tempelgrundstücken weltweit.',
            badgeColor: '#2B4C7E'
        },
        {
            id: '5yp_74',
            code: '5YP',
            name: 'Fünfjahresplan (1974–1979)',
            shortName: 'Fünfjahresplan',
            period: '1974–1979',
            startDate: '1974-04-21',
            endDate: '1979-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Konsolidierung des weltweiten Wachstums, Vertiefung des Gemeinschaftslebens und Einweihung des Sitzes des Universalen Hauses der Gerechtigkeit auf dem Berg Karmel.',
            badgeColor: '#2B4C7E'
        },
        {
            id: '7yp_79',
            code: '7YP',
            name: 'Siebenjahresplan (1979–1986)',
            shortName: 'Siebenjahresplan',
            period: '1979–1986',
            startDate: '1979-04-21',
            endDate: '1986-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Hervortreten der Bahá’í-Gemeinde aus der Verborgenheit („Emergence from Obscurity“) angesichts der Verfolgungen im Iran und Veröffentlichung der Friedensbotschaft „Die Verheißung des Weltfriedens“ (1985).',
            badgeColor: '#2B4C7E'
        },
        {
            id: '6yp',
            code: '6YP',
            name: 'Sechsjahresplan (1986–1992)',
            shortName: 'Sechsjahresplan',
            period: '1986–1992',
            startDate: '1986-04-21',
            endDate: '1992-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Beginn der 4. Epoche. Voranschreiten des Prozesses des massenhaften Eintritts in den Glauben und weltweite Verbreitung der Prinzipien für Frieden und Entwicklung.',
            badgeColor: '#4A6B35'
        },
        {
            id: 'holy_year',
            code: 'HY',
            name: 'Heiliges Jahr (1992–1993)',
            shortName: 'Heiliges Jahr',
            period: '1992–1993',
            startDate: '1992-04-21',
            endDate: '1993-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Hundertjahrfeier des Hinscheidens Bahá’u’lláhs und des Beginns Seines Bündnisses. Zweiter Bahá’í-Weltkongress in New York mit fast 30.000 Teilnehmern.',
            badgeColor: '#9A7A38'
        },
        {
            id: '3yp',
            code: '3YP',
            name: 'Dreijahresplan (1993–1996)',
            shortName: 'Dreijahresplan',
            period: '1993–1996',
            startDate: '1993-04-21',
            endDate: '1996-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Fokus auf geistige Reifung der Gläubigen, Stärkung der Institutionen und Vorbereitung der systematischen Errichtung von Trainingsinstituten.',
            badgeColor: '#4A6B35'
        },
        {
            id: '4yp',
            code: '4YP',
            name: 'Vierjahresplan (1996–2000)',
            shortName: 'Vierjahresplan',
            period: '1996–2000',
            startDate: '1996-04-21',
            endDate: '2000-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Beginn der Serie globaler Pläne mit dem institutionalisierten Trainingsinstitutsprozess zur systematischen Befähigung der menschlichen Ressourcen.',
            badgeColor: '#4A6B35'
        },
        {
            id: '12mp',
            code: '12MP',
            name: 'Zwölfmonatsplan (2000–2001)',
            shortName: 'Zwölfmonatsplan',
            period: '2000–2001',
            startDate: '2000-04-21',
            endDate: '2001-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Übergangs- und Konsolidierungsjahr zur Schwelle des neuen Jahrhunderts; Einweihung der Terrassen am Berg Karmel im Mai 2001.',
            badgeColor: '#4A6B35'
        },
        {
            id: '5yp_01',
            code: '5YP',
            name: 'Fünfjahresplan (2001–2006)',
            shortName: 'Fünfjahresplan I',
            period: '2001–2006',
            startDate: '2001-04-21',
            endDate: '2006-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Beginn der 5. Epoche. Etablierung des Cluster-Konzepts, der vier Kernaktivitäten (Andachtstreffen, Kinderklassen, Juniorjugendgruppen, Studienkreise) und der Ruhi-Kursreihe.',
            badgeColor: '#6B8E23'
        },
        {
            id: '5yp_06',
            code: '5YP',
            name: 'Fünfjahresplan (2006–2011)',
            shortName: 'Fünfjahresplan II',
            period: '2006–2011',
            startDate: '2006-04-21',
            endDate: '2011-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Intensives Wachstumsprogramm (IPG) in Hunderten von Clustern weltweit; institutionalisierte Reflexionsversammlungen und Zyklen des Wachstums.',
            badgeColor: '#6B8E23'
        },
        {
            id: '5yp_11',
            code: '5YP',
            name: 'Fünfjahresplan (2011–2016)',
            shortName: 'Fünfjahresplan III',
            period: '2011–2016',
            startDate: '2011-04-21',
            endDate: '2016-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: '114 weltweite Jugendkonferenzen 2013; Ausweitung des Juniorjugendprogramms und Bau erster nationaler und örtlicher Häuser der Andacht.',
            badgeColor: '#6B8E23'
        },
        {
            id: '5yp_16',
            code: '5YP',
            name: 'Fünfjahresplan (2016–2021)',
            shortName: 'Fünfjahresplan IV',
            period: '2016–2021',
            startDate: '2016-04-21',
            endDate: '2021-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: '2. Epoche der Tafeln des Göttlichen Plans',
            description: 'Zweihundertjahrfeiern der Geburt Bahá’u’lláhs (2017) und des Báb (2019). Vollendung der 25-jährigen Planungsphase (1996–2021) und Abschluss des 1. Jahrhunderts des Gestaltenden Zeitalters.',
            badgeColor: '#6B8E23'
        },
        {
            id: '1yp_21',
            code: '1YP',
            name: 'Einjahresplan (2021–2022)',
            shortName: 'Einjahresplan',
            period: '2021–2022',
            startDate: '2021-04-21',
            endDate: '2022-04-20',
            epochId: 'epoch_6',
            epochName: '2. Jahrhundert des Gestaltenden Zeitalters',
            divineEpoch: '3. Epoche der Tafeln des Göttlichen Plans',
            description: 'Hundertjahrfeier des Hinscheidens ‘Abdu’l-Bahás (November 2021). Markiert den Übergang in das 2. Jahrhundert des Gestaltenden Zeitalters und die 3. Epoche des Göttlichen Plans.',
            badgeColor: '#D93025' // Signalrot wie im Diagramm
        },
        {
            id: '9yp_22',
            code: '9YP',
            name: 'Neunjahresplan (2022–2031)',
            shortName: 'Neunjahresplan (Aktuell)',
            period: '2022–2031',
            startDate: '2022-04-21',
            endDate: '2031-12-31',
            epochId: 'epoch_6',
            epochName: '2. Jahrhundert des Gestaltenden Zeitalters',
            divineEpoch: '3. Epoche der Tafeln des Göttlichen Plans',
            description: 'Erster Plan einer neuen 25-jährigen Serie bis 2046. Freisetzung gesellschaftsverändernder Kräfte, Voranschreiten von Clustern jenseits des dritten Meilensteins und Vertiefung des Beitrags zu gesellschaftlichen Diskursen.',
            badgeColor: '#D93025' // Markant wie im Diagramm
        }
    ];

    // Übergeordnete Epochen des Gestaltenden Zeitalters
    const EPOCHS = [
        {
            id: 'epoch_3',
            name: '3. Epoche (1963–1986)',
            century: '1. Jahrhundert des Gestaltenden Zeitalters',
            desc: 'Wahl des Hauses, 9YP, 5YP, 7YP // Hervortreten aus der Verborgenheit'
        },
        {
            id: 'epoch_4',
            name: '4. Epoche (1986–2001)',
            century: '1. Jahrhundert des Gestaltenden Zeitalters',
            desc: '6YP, Heiliges Jahr, 3YP, 4YP, 12MP // Massenhafter Eintritt'
        },
        {
            id: 'epoch_5',
            name: '5. Epoche (2001–2021)',
            century: '1. Jahrhundert des Gestaltenden Zeitalters',
            desc: 'Vier Fünfjahrespläne // Kernaktivitäten & Trainingsinstitut'
        },
        {
            id: 'epoch_6',
            name: '2. Jahrhundert (ab 2021)',
            century: '2. Jahrhundert des Gestaltenden Zeitalters',
            desc: '1YP (2021–2022) & 9YP (2022–2031) // Neue Serie globaler Pläne'
        }
    ];

    function init() {
        renderTimelineView();
        selectPlan(currentSelectedPlanId);
    }

    function getPlanForDoc(doc) {
        const date = doc.date || '';
        if (!date) return null;
        for (const p of PLANS) {
            if (date >= p.startDate && date <= p.endDate) {
                return p;
            }
        }
        return null;
    }

    function renderTimelineView() {
        const container = document.getElementById('view-timeline');
        if (!container) return;

        // Count docs per plan
        const allDocs = window.state ? (window.state.documents || []) : [];
        const planCounts = {};
        PLANS.forEach(p => planCounts[p.id] = 0);
        allDocs.forEach(d => {
            const p = getPlanForDoc(d);
            if (p) planCounts[p.id] = (planCounts[p.id] || 0) + 1;
        });

        container.innerHTML = `
            <div class="view-header" style="max-width: 1080px; margin: 0 auto 2rem; text-align: center;">
                <div class="editorial-eyebrow">Historische Kontinuität // Zeitstrahl der Offenbarung</div>
                <h2 class="editorial-headline">Entfaltung des Bahá'í-Glaubens</h2>
                <p class="editorial-lead">
                    Interaktive zeitliche Einordnung aller Botschaften des Universalen Hauses der Gerechtigkeit in die Epochen des Gestaltenden Zeitalters und die globalen Pläne der Menschheitsgeschichte.
                </p>
            </div>

            <!-- Interaktives Mehrebenen-Diagramm (basierend auf "Unfoldment of the Bahá'í Faith") -->
            <div class="timeline-diagram-card">
                
                <!-- Tier 1: Zyklus & Ära -->
                <div class="t-layer t-layer-cycle">
                    <div class="t-bar t-bar-cycle">
                        <span class="t-bar-title">Bahá'í-Zyklus</span>
                        <span class="t-bar-sub">(Vorgesehen für 500.000 Jahre)</span>
                    </div>
                </div>

                <div class="t-layer t-layer-era">
                    <div class="t-bar t-bar-era">
                        <div class="t-bar-left">
                            <span class="t-bar-title">Bahá'í-Ära</span>
                            <span class="t-bar-sub">(Sendungen des Báb und Bahá'u'lláhs)</span>
                        </div>
                        <div class="t-era-centuries">
                            <span class="t-century">1. Jahrhundert (1844–1944)</span>
                            <span class="t-century active-century">2. Jahrhundert (1944–2044)</span>
                            <span class="t-century">3. Jahrhundert…</span>
                        </div>
                    </div>
                </div>

                <!-- Tier 2: Zeitalter (Heroic, Formative, Golden) -->
                <div class="t-layer t-layer-ages">
                    <div class="t-age t-age-heroic" title="Heroisches Zeitalter (1844–1921): Wirken des Báb, Bahá'u'lláhs und 'Abdu'l-Bahás">
                        <span class="t-age-title">Heroisches Zeitalter</span>
                        <span class="t-age-years">1844 – 1921</span>
                    </div>
                    <div class="t-age t-age-formative active-age" title="Gestaltendes Zeitalter (seit 1921): Epochen des Aufbaus der Weltordnung">
                        <div class="t-age-header">
                            <span class="t-age-title">Gestaltendes Zeitalter (Formative Age)</span>
                            <span class="t-age-years">1921 – Gegenwart</span>
                        </div>
                    </div>
                    <div class="t-age t-age-golden" title="Goldenes Zeitalter (Zukunft der Menschheit)">
                        <span class="t-age-title">Goldenes Zeitalter</span>
                    </div>
                </div>

                <!-- Tier 3: Epochen des Gestaltenden Zeitalters -->
                <div class="t-layer t-layer-epochs">
                    <div class="t-epoch-static" style="flex: 0.6;" title="1. & 2. Epoche (1921–1963): Shoghi Effendi, Administrative Ordnung & Zehnjähriger Kreuzzug">
                        <span>1. &amp; 2. Epoche (1921–1963)</span>
                    </div>
                    ${EPOCHS.map(ep => `
                        <button class="t-epoch-btn" data-epoch-id="${ep.id}" onclick="window.TimelineModule.selectEpoch('${ep.id}')">
                            <span class="t-epoch-name">${ep.name}</span>
                            <span class="t-epoch-sub">${ep.century.includes('2.') ? '2. Jhdt.' : '1. Jhdt.'}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Tier 4: Tafeln des Göttlichen Plans -->
                <div class="t-layer t-layer-divine">
                    <div class="t-divine-bar">
                        <span class="t-divine-title">Tafeln des Göttlichen Plans</span>
                        <div class="t-divine-subdivisions">
                            <span class="t-divine-ep">1. Epoche (1937–1953)</span>
                            <span class="t-divine-ep active-divine">2. Epoche (1953–2021)</span>
                            <span class="t-divine-ep active-red">3. Epoche (ab 2021)</span>
                        </div>
                    </div>
                </div>

                <!-- Tier 5: Die interaktiven Lehrpläne (Reihe der Globalen Pläne) -->
                <div class="t-plans-scroll-wrapper">
                    <div class="t-plans-strip">
                        ${PLANS.map(p => {
                            const count = planCounts[p.id] || 0;
                            const isCurrent = p.id === '9yp_22';
                            const isTransition = p.id === '1yp_21';
                            let extraClass = '';
                            if (isCurrent) extraClass = 'plan-current';
                            else if (isTransition) extraClass = 'plan-transition';

                            return `
                                <button class="t-plan-segment ${extraClass}" id="plan-seg-${p.id}" onclick="window.TimelineModule.selectPlan('${p.id}')">
                                    <span class="plan-seg-code">${p.code}</span>
                                    <span class="plan-seg-years">${p.period}</span>
                                    <span class="plan-seg-count">${count} Dok.</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="t-strip-legend">
                    <span class="legend-item"><span class="legend-dot dot-formative"></span> 1. Jahrhundert Formative Age (1963–2021)</span>
                    <span class="legend-item"><span class="legend-dot dot-transition"></span> Übergang (1YP 2021)</span>
                    <span class="legend-item"><span class="legend-dot dot-current"></span> Neue Serie globaler Pläne (9YP 2022–2031)</span>
                </div>
            </div>

            <!-- Detail-Panel des ausgewählten Zeitabschnitts -->
            <div id="timeline-detail-panel" class="timeline-detail-container"></div>

            <!-- Dokumenten-Raster des gewählten Zeitraums -->
            <div id="timeline-docs-container" style="margin-top: 2rem;">
                <div id="timeline-results-grid" class="results-grid"></div>
            </div>
        `;
    }

    function selectEpoch(epochId) {
        // Find first plan of this epoch
        const firstPlan = PLANS.find(p => p.epochId === epochId);
        if (firstPlan) {
            selectPlan(firstPlan.id);
        }
    }

    function selectPlan(planId) {
        currentSelectedPlanId = planId;
        const plan = PLANS.find(p => p.id === planId) || PLANS[PLANS.length - 1];

        // Update active class on plan segments
        document.querySelectorAll('.t-plan-segment').forEach(el => el.classList.remove('active-plan'));
        const activeSeg = document.getElementById(`plan-seg-${plan.id}`);
        if (activeSeg) {
            activeSeg.classList.add('active-plan');
            activeSeg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // Update active epoch
        document.querySelectorAll('.t-epoch-btn').forEach(btn => {
            if (btn.dataset.epochId === plan.epochId) {
                btn.classList.add('active-epoch');
            } else {
                btn.classList.remove('active-epoch');
            }
        });

        // Filter documents for this plan
        const allDocs = window.state ? (window.state.documents || []) : [];
        const planDocs = allDocs.filter(d => {
            const date = d.date || '';
            return date >= plan.startDate && date <= plan.endDate;
        }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // Calculate breakdown
        const ridvanCount = planDocs.filter(d => (d.type || '').toLowerCase().includes('riḍván') || (d.type || '').toLowerCase().includes('ridvan')).length;
        const counsellorsCount = planDocs.filter(d => (d.type || '').toLowerCase().includes('berater') || (d.recipient || '') === 'counsellors').length;
        const worldCount = planDocs.filter(d => (d.recipient || '') === 'world').length;

        // Render Detail Panel
        const detailEl = document.getElementById('timeline-detail-panel');
        if (detailEl) {
            detailEl.innerHTML = `
                <div class="period-detail-card">
                    <div class="period-detail-header">
                        <div class="period-title-group">
                            <span class="period-epoch-tag">${plan.epochName}</span>
                            <h3 class="period-headline">${plan.name}</h3>
                            <div class="period-meta-line">
                                <span class="period-dates">Zeitraum: ${plan.period}</span>
                                <span class="period-divine">${plan.divineEpoch}</span>
                            </div>
                        </div>
                        <div class="period-stat-box">
                            <div class="stat-number">${planDocs.length}</div>
                            <div class="stat-label">Botschaften im Archiv</div>
                        </div>
                    </div>

                    <p class="period-desc-text">${plan.description}</p>

                    <div class="period-quick-stats">
                        <span class="quick-stat-badge">✴ ${ridvanCount} Riḍván-Botschaften</span>
                        <span class="quick-stat-badge">🌐 ${worldCount} An die Weltgemeinde</span>
                        <span class="quick-stat-badge">🏛 ${counsellorsCount} Berater- &amp; Institutionen</span>
                    </div>

                    <div class="period-controls-bar">
                        <div class="period-recipient-filter">
                            <button class="filter-pill ${currentRecipientFilter === 'all' ? 'active' : ''}" onclick="window.TimelineModule.setRecipient('all')">Alle (${planDocs.length})</button>
                            <button class="filter-pill ${currentRecipientFilter === 'world' ? 'active' : ''}" onclick="window.TimelineModule.setRecipient('world')">Weltweite Gemeinde</button>
                            <button class="filter-pill ${currentRecipientFilter === 'nsa' ? 'active' : ''}" onclick="window.TimelineModule.setRecipient('nsa')">Nationale Räte</button>
                            <button class="filter-pill ${currentRecipientFilter === 'counsellors' ? 'active' : ''}" onclick="window.TimelineModule.setRecipient('counsellors')">Beraterämter</button>
                        </div>
                        <div class="period-search-input-wrapper">
                            <input type="text" id="timeline-period-search" placeholder="In diesem Plan filtern…" value="${currentSearchQuery}" oninput="window.TimelineModule.setQuery(this.value)">
                        </div>
                    </div>
                </div>
            `;
        }

        renderDocs(planDocs);
    }

    function renderDocs(planDocs) {
        const grid = document.getElementById('timeline-results-grid');
        if (!grid) return;

        let filtered = planDocs;

        if (currentRecipientFilter !== 'all') {
            filtered = filtered.filter(d => d.recipient === currentRecipientFilter);
        }

        if (currentSearchQuery.trim()) {
            const q = currentSearchQuery.trim().toLowerCase();
            filtered = filtered.filter(d => 
                (d.title || '').toLowerCase().includes(q) ||
                (d.excerpt || '').toLowerCase().includes(q) ||
                (d.topics || []).some(t => t.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
                    <p style="font-size: 1.05rem; font-family: var(--font-serif); margin-bottom: 0.5rem;">Keine Botschaften für die gewählten Filter in diesem Plan gefunden.</p>
                    <button onclick="window.TimelineModule.resetFilters()" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.9rem;">Filter zurücksetzen</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map((doc, idx) => {
            return window.createDocCard ? window.createDocCard(doc, '', idx) : '';
        }).join('');
    }

    function setRecipient(recip) {
        currentRecipientFilter = recip;
        selectPlan(currentSelectedPlanId);
    }

    function setQuery(q) {
        currentSearchQuery = q;
        const plan = PLANS.find(p => p.id === currentSelectedPlanId) || PLANS[PLANS.length - 1];
        const allDocs = window.state ? (window.state.documents || []) : [];
        const planDocs = allDocs.filter(d => {
            const date = d.date || '';
            return date >= plan.startDate && date <= plan.endDate;
        }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        renderDocs(planDocs);
    }

    function resetFilters() {
        currentRecipientFilter = 'all';
        currentSearchQuery = '';
        selectPlan(currentSelectedPlanId);
    }

    return {
        init,
        selectPlan,
        selectEpoch,
        setRecipient,
        setQuery,
        resetFilters,
        PLANS,
        EPOCHS
    };
})();
