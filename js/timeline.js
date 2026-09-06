/**
 * timeline.js
 * Hochpräzise, voll interaktive Darstellung der Entfaltung des Bahá'í-Glaubens.
 * Exakte Umsetzung des historischen Strukturplans ("Unfoldment of the Bahá'í Faith"):
 * - Bahá'í-Zyklus (500.000 Jahre)
 * - Bahá'í-Ära & Jahrhunderte (1. Jhdt 1844–1944, 2. Jhdt 1944–2044)
 * - Die Zeitalter (Heroisches Zeitalter, Gestaltendes Zeitalter, Goldenes Zeitalter)
 * - Epochen des Gestaltenden Zeitalters (1. & 2., 3., 4., 5., 6. Epoche)
 * - Tafeln des Göttlichen Plans (1., 2., 3. Epoche)
 * - Chronologische globale Lehrpläne (1963 bis 2031)
 */

window.TimelineModule = (function() {
    let currentSelectedPlanId = '9yp_22'; // Standard: Aktueller Neunjahresplan
    let currentRecipientFilter = 'all';
    let currentSearchQuery = '';

    const PLANS = [
        {
            id: '1963_founding',
            code: '1963',
            name: 'Wahl des Universalen Hauses der Gerechtigkeit',
            shortName: 'Wahl des Hauses (1963)',
            period: '1963',
            startDate: '1963-04-21',
            endDate: '1964-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Die historische Wahl der ersten Mitglieder des Universalen Hauses der Gerechtigkeit durch die Mitglieder von 56 Nationalen Geistigen Räten in Haifa, die den erfolgreichen Abschluss des Zehnjährigen Kreuzzugs von Shoghi Effendi krönte.',
            colorCategory: 'formative'
        },
        {
            id: '9yp_64',
            code: '9YP',
            name: 'Neunjahresplan (1964–1973)',
            shortName: 'Neunjahresplan (1964–1973)',
            period: '1964–1973',
            startDate: '1964-04-21',
            endDate: '1974-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Der erste globale Lehrplan unter Führung des Universalen Hauses der Gerechtigkeit. Weltweite Vervielfachung Nationaler Räte, Kauf von Tempelgrundstücken und weltweite Konsolidierung.',
            colorCategory: 'formative'
        },
        {
            id: '5yp_74',
            code: '5YP',
            name: 'Fünfjahresplan (1974–1979)',
            shortName: 'Fünfjahresplan (1974–1979)',
            period: '1974–1979',
            startDate: '1974-04-21',
            endDate: '1979-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Stärkung des Gemeindelebens, Errichtung des Internationalen Lehrzentrums (ITC) und Baubeginn des ständigen Sitzes des Universalen Hauses der Gerechtigkeit auf dem Berg Karmel.',
            colorCategory: 'formative'
        },
        {
            id: '7yp_79',
            code: '7YP',
            name: 'Siebenjahresplan (1979–1986)',
            shortName: 'Siebenjahresplan (1979–1986)',
            period: '1979–1986',
            startDate: '1979-04-21',
            endDate: '1986-04-20',
            epochId: 'epoch_3',
            epochName: '3. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Hervortreten der Bahá’í-Gemeinde aus der Verborgenheit angesichts der Verfolgungen im Iran und Veröffentlichung der Friedenserklärung „Die Verheißung des Weltfriedens“ (1985).',
            colorCategory: 'formative'
        },
        {
            id: '6yp_86',
            code: '6YP',
            name: 'Sechsjahresplan (1986–1992)',
            shortName: 'Sechsjahresplan (1986–1992)',
            period: '1986–1992',
            startDate: '1986-04-21',
            endDate: '1992-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Beginn der 4. Epoche. Voranschreiten des Prozesses des massenhaften Eintritts in den Glauben und weltweite Ausbreitung sozial-ökonomischer Entwicklungsprojekte.',
            colorCategory: 'formative'
        },
        {
            id: 'holy_year',
            code: 'HY',
            name: 'Heiliges Jahr (1992–1993)',
            shortName: 'Heiliges Jahr (1992–1993)',
            period: '1992–1993',
            startDate: '1992-04-21',
            endDate: '1993-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Hundertjahrfeier des Hinscheidens Bahá’u’lláhs und des Beginns Seines Bündnisses. Zweiter Bahá’í-Weltkongress in New York mit fast 30.000 Gläubigen.',
            colorCategory: 'formative'
        },
        {
            id: '3yp_93',
            code: '3YP',
            name: 'Dreijahresplan (1993–1996)',
            shortName: 'Dreijahresplan (1993–1996)',
            period: '1993–1996',
            startDate: '1993-04-21',
            endDate: '1996-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Reifung der Gläubigen, Festigung lokaler und nationaler Institutionen und Vorbereitung der systematischen Errichtung von Trainingsinstituten weltweit.',
            colorCategory: 'formative'
        },
        {
            id: '4yp_96',
            code: '4YP',
            name: 'Vierjahresplan (1996–2000)',
            shortName: 'Vierjahresplan (1996–2000)',
            period: '1996–2000',
            startDate: '1996-04-21',
            endDate: '2000-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Historischer Wendepunkt: Institutionalisierung regionaler Trainingsinstitute und Erschaffung des weltweiten Netzwerks zur systematischen Bildung.',
            colorCategory: 'formative'
        },
        {
            id: '12mp_00',
            code: '12MP',
            name: 'Zwölfmonatsplan (2000–2001)',
            shortName: 'Zwölfmonatsplan (2000–2001)',
            period: '2000–2001',
            startDate: '2000-04-21',
            endDate: '2001-04-20',
            epochId: 'epoch_4',
            epochName: '4. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Brückenplan zur Jahrtausendwende und Vorbereitung auf die Einweihung der Terrassen auf dem Berg Karmel und den Auftakt der 5. Epoche.',
            colorCategory: 'formative'
        },
        {
            id: '5yp_01',
            code: '5YP',
            name: 'Fünfjahresplan (2001–2006)',
            shortName: 'Fünfjahresplan I (2001–2006)',
            period: '2001–2006',
            startDate: '2001-04-21',
            endDate: '2006-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Beginn der 5. Epoche. Etablierung des Cluster-Konzepts, der vier Kernaktivitäten (Andachten, Kinderklassen, Vorjugendgruppen, Studienkreise) und der Ruhi-Kursreihe.',
            colorCategory: 'formative'
        },
        {
            id: '5yp_06',
            code: '5YP',
            name: 'Fünfjahresplan (2006–2011)',
            shortName: 'Fünfjahresplan II (2006–2011)',
            period: '2006–2011',
            startDate: '2006-04-21',
            endDate: '2011-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Intensive Programme des Wachstums (IPG) in Hunderten von Clustern; institutionalisierte Reflexionsversammlungen und Drei-Monats-Zyklen des Wachstums.',
            colorCategory: 'formative'
        },
        {
            id: '5yp_11',
            code: '5YP',
            name: 'Fünfjahresplan (2011–2016)',
            shortName: 'Fünfjahresplan III (2011–2016)',
            period: '2011–2016',
            startDate: '2011-04-21',
            endDate: '2016-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: '114 weltweite Jugendkonferenzen 2013; weltweite Ausweitung des Vorjugendprogramms und Baubeginn erster nationaler und örtlicher Häuser der Andacht.',
            colorCategory: 'formative'
        },
        {
            id: '5yp_16',
            code: '5YP',
            name: 'Fünfjahresplan (2016–2021)',
            shortName: 'Fünfjahresplan IV (2016–2021)',
            period: '2016–2021',
            startDate: '2016-04-21',
            endDate: '2021-04-20',
            epochId: 'epoch_5',
            epochName: '5. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_2',
            divineEpochName: '2. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Zweihundertjahrfeiern der Geburt Bahá’u’lláhs (2017) und des Báb (2019). Vollendung der 25-jährigen Phase (1996–2021) und Abschluss des 1. Jahrhunderts des Gestaltenden Zeitalters.',
            colorCategory: 'formative'
        },
        {
            id: '1yp_21',
            code: '1YP',
            name: 'Einjahresplan (2021–2022)',
            shortName: 'Einjahresplan (2021–2022)',
            period: '2021–2022',
            startDate: '2021-04-21',
            endDate: '2022-04-20',
            epochId: 'epoch_6',
            epochName: '6. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_3',
            divineEpochName: '3. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Hundertjahrfeier des Hinscheidens ‘Abdu’l-Bahás (November 2021). Markiert den Beginn des 2. Jahrhunderts des Gestaltenden Zeitalters und der 3. Epoche des Göttlichen Plans.',
            colorCategory: 'transition'
        },
        {
            id: '9yp_22',
            code: '9YP',
            name: 'Neunjahresplan (2022–2031)',
            shortName: 'Neunjahresplan (2022–2031)',
            period: '2022–2031',
            startDate: '2022-04-21',
            endDate: '2031-12-31',
            epochId: 'epoch_6',
            epochName: '6. Epoche des Gestaltenden Zeitalters',
            divineEpoch: 'epoch_divine_3',
            divineEpochName: '3. Epoche der Tafeln des Göttlichen Plans',
            century: 'century_2',
            description: 'Erster Plan einer neuen 25-jährigen Serie bis 2046. Freisetzung gesellschaftsverändernder Kräfte, Voranschreiten von Clustern jenseits des 3. Meilensteins und aktiver Beitrag zu gesellschaftlichen Diskursen.',
            colorCategory: 'current'
        }
    ];

    const EPOCHS = [
        {
            id: 'epoch_1_2',
            name: '1. & 2. Epoche',
            years: '1921–1963',
            century: 'century_2',
            isStatic: true,
            desc: 'Shoghi Effendi // Administrative Ordnung & Zehnjähriger Kreuzzug'
        },
        {
            id: 'epoch_3',
            name: '3. Epoche',
            years: '1963–1986',
            century: 'century_2',
            desc: 'Wahl des Hauses, 9YP, 5YP, 7YP // Hervortreten aus der Verborgenheit'
        },
        {
            id: 'epoch_4',
            name: '4. Epoche',
            years: '1986–2001',
            century: 'century_2',
            desc: '6YP, Heiliges Jahr, 3YP, 4YP, 12MP // Massenhafter Eintritt'
        },
        {
            id: 'epoch_5',
            name: '5. Epoche',
            years: '2001–2021',
            century: 'century_2',
            desc: 'Vier Fünfjahrespläne // Kernaktivitäten & Trainingsinstitut'
        },
        {
            id: 'epoch_6',
            name: '6. Epoche',
            years: 'ab 2021',
            century: 'century_2',
            isCurrent: true,
            desc: '1YP & 9YP // Beginn 2. Jahrhundert des Gestaltenden Zeitalters'
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

            <!-- Interaktives Mehrebenen-Diagramm -->
            <div class="timeline-diagram-card">
                
                <!-- Ebene 1: Bahá'í-Zyklus -->
                <div class="t-layer t-layer-cycle">
                    <div class="t-bar t-bar-cycle">
                        <span class="t-bar-title">Bahá'í-Zyklus</span>
                        <span class="t-bar-sub">(Vorgesehen für mindestens 500.000 Jahre)</span>
                    </div>
                </div>

                <!-- Ebene 2: Bahá'í-Ära & Jahrhunderte -->
                <div class="t-layer t-layer-era">
                    <div class="t-bar t-bar-era">
                        <div class="t-bar-left">
                            <span class="t-bar-title">Bahá'í-Ära</span>
                            <span class="t-bar-sub">(Sendungen des Báb und Bahá'u'lláhs)</span>
                        </div>
                        <div class="t-era-centuries">
                            <button class="t-century-btn" id="btn-century-1" onclick="window.TimelineModule.selectCentury('century_1')">
                                1. Jahrhundert (1844–1944)
                            </button>
                            <button class="t-century-btn active-century" id="btn-century-2" onclick="window.TimelineModule.selectCentury('century_2')">
                                2. Jahrhundert (1944–2044)
                            </button>
                            <button class="t-century-btn t-century-future" id="btn-century-3" disabled>
                                3. Jahrhundert…
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Ebene 3: Zeitalter (Heroic, Formative, Golden) -->
                <div class="t-layer t-layer-ages">
                    <div class="t-age-card t-age-heroic" onclick="window.TimelineModule.selectAge('heroic')">
                        <div class="t-age-content">
                            <span class="t-age-title">Heroisches Zeitalter</span>
                            <span class="t-age-sub">1844 – 1921 (Der Báb, Bahá'u'lláh, ‘Abdu’l-Bahá)</span>
                        </div>
                    </div>
                    <div class="t-age-card t-age-formative active-age" onclick="window.TimelineModule.selectAge('formative')">
                        <div class="t-age-content">
                            <span class="t-age-title">Gestaltendes Zeitalter (Formative Age)</span>
                            <span class="t-age-sub">1921 – Gegenwart (Aufbau der Weltordnung)</span>
                        </div>
                    </div>
                    <div class="t-age-card t-age-golden">
                        <div class="t-age-content">
                            <span class="t-age-title">Goldenes Zeitalter</span>
                            <span class="t-age-sub">Zukunft der Menschheit</span>
                        </div>
                    </div>
                </div>

                <!-- Ebene 4: Epochen des Gestaltenden Zeitalters -->
                <div class="t-layer t-layer-epochs">
                    ${EPOCHS.map(ep => `
                        <button class="t-epoch-pill ${ep.isStatic ? 't-epoch-static' : ''} ${ep.isCurrent ? 'epoch-current-badge' : ''}" 
                                id="epoch-btn-${ep.id}" 
                                onclick="window.TimelineModule.selectEpoch('${ep.id}')">
                            <span class="epoch-pill-title">${ep.name}</span>
                            <span class="epoch-pill-years">${ep.years}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Ebene 5: Tafeln des Göttlichen Plans -->
                <div class="t-layer t-layer-divine">
                    <div class="t-divine-bar">
                        <span class="t-divine-label">Tafeln des Göttlichen Plans (‘Abdu’l-Bahá):</span>
                        <div class="t-divine-segments">
                            <button class="t-divine-pill" id="divine-epoch_divine_1" onclick="window.TimelineModule.selectDivineEpoch('epoch_divine_1')">
                                1. Epoche (1937–1953)
                            </button>
                            <button class="t-divine-pill active-divine" id="divine-epoch_divine_2" onclick="window.TimelineModule.selectDivineEpoch('epoch_divine_2')">
                                2. Epoche (1953–2021)
                            </button>
                            <button class="t-divine-pill active-red" id="divine-epoch_divine_3" onclick="window.TimelineModule.selectDivineEpoch('epoch_divine_3')">
                                3. Epoche (ab 2021)
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Ebene 6: Die chronologische Kette aller globalen Pläne -->
                <div class="t-plans-carousel-container">
                    <div class="t-plans-chain">
                        ${PLANS.map(p => {
                            const count = planCounts[p.id] || 0;
                            const isCurrent = p.colorCategory === 'current';
                            const isTransition = p.colorCategory === 'transition';
                            let planClass = '';
                            if (isCurrent) planClass = 'plan-current';
                            else if (isTransition) planClass = 'plan-transition';

                            return `
                                <button class="t-plan-card ${planClass}" id="plan-seg-${p.id}" onclick="window.TimelineModule.selectPlan('${p.id}')">
                                    <div class="plan-card-top">
                                        <span class="plan-code-badge">${p.code}</span>
                                        ${isCurrent ? '<span class="plan-current-tag">AKTUELL</span>' : ''}
                                    </div>
                                    <div class="plan-years-text">${p.period}</div>
                                    <div class="plan-count-chip">${count} Botschaften</div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="t-strip-legend">
                    <span class="legend-item"><span class="legend-dot dot-formative"></span> 1. Jahrhundert Formative Age (1963–2021)</span>
                    <span class="legend-item"><span class="legend-dot dot-transition"></span> Übergang (1YP 2021–2022)</span>
                    <span class="legend-item"><span class="legend-dot dot-current"></span> Neue 25-Jahres-Serie (9YP ab 2022)</span>
                </div>
            </div>

            <!-- Detail-Panel des ausgewählten Zeitabschnitts -->
            <div id="timeline-detail-panel" class="timeline-detail-container"></div>

            <!-- Dokumenten-Raster des gewählten Zeitraums -->
            <div id="timeline-docs-container" style="margin-top: 2.5rem;">
                <div id="timeline-results-grid" class="results-grid"></div>
            </div>
        `;
    }

    function selectEpoch(epochId) {
        if (epochId === 'epoch_1_2') {
            selectPlan('1963_founding');
            return;
        }
        const firstPlan = PLANS.find(p => p.epochId === epochId);
        if (firstPlan) selectPlan(firstPlan.id);
    }

    function selectDivineEpoch(divineId) {
        const firstPlan = PLANS.find(p => p.divineEpoch === divineId);
        if (firstPlan) selectPlan(firstPlan.id);
    }

    function selectCentury(centuryId) {
        if (centuryId === 'century_2') {
            selectPlan('9yp_22');
        }
    }

    function selectAge(age) {
        if (age === 'heroic') {
            // Zeige Schriften der Zentralgestalten in Bücher-Ansicht
            if (window.switchView) window.switchView('books');
        } else {
            selectPlan('9yp_22');
        }
    }

    function selectPlan(planId) {
        currentSelectedPlanId = planId;
        const plan = PLANS.find(p => p.id === planId) || PLANS[PLANS.length - 1];

        // 1. Plan-Segment hervorheben
        document.querySelectorAll('.t-plan-card').forEach(el => el.classList.remove('active-plan'));
        const activeSeg = document.getElementById(`plan-seg-${plan.id}`);
        if (activeSeg) {
            activeSeg.classList.add('active-plan');
            activeSeg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // 2. Epochen-Button hervorheben
        document.querySelectorAll('.t-epoch-pill').forEach(btn => {
            btn.classList.toggle('active-epoch', btn.id === `epoch-btn-${plan.epochId}`);
        });

        // 3. Tafeln des Göttlichen Plans hervorheben
        document.querySelectorAll('.t-divine-pill').forEach(btn => {
            btn.classList.toggle('active-selected-divine', btn.id === `divine-${plan.divineEpoch}`);
        });

        // 4. Dokumente filtern
        const allDocs = window.state ? (window.state.documents || []) : [];
        const planDocs = allDocs.filter(d => {
            const date = d.date || '';
            return date >= plan.startDate && date <= plan.endDate;
        }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // Statistiken berechnen
        const ridvanCount = planDocs.filter(d => (d.type || '').toLowerCase().includes('riḍván') || (d.type || '').toLowerCase().includes('ridvan')).length;
        const counsellorsCount = planDocs.filter(d => (d.type || '').toLowerCase().includes('berater') || (d.recipient || '') === 'counsellors').length;
        const worldCount = planDocs.filter(d => (d.recipient || '') === 'world').length;

        // Detail-Panel rendern
        const detailEl = document.getElementById('timeline-detail-panel');
        if (detailEl) {
            detailEl.innerHTML = `
                <div class="period-detail-card">
                    <div class="period-detail-header">
                        <div class="period-title-group">
                            <span class="period-epoch-tag">${plan.epochName} &bull; ${plan.divineEpochName}</span>
                            <h3 class="period-headline">${plan.name}</h3>
                            <div class="period-meta-line">
                                <span class="period-dates"><strong>Laufzeit:</strong> ${plan.period}</span>
                                <span class="period-divine"><strong>Status:</strong> ${plan.colorCategory === 'current' ? 'Laufender Weltplan' : 'Historischer Plan'}</span>
                            </div>
                        </div>
                        <div class="period-stat-box">
                            <div class="stat-number">${planDocs.length}</div>
                            <div class="stat-label">Botschaften im Archiv</div>
                        </div>
                    </div>

                    <p class="period-desc-text">${plan.description}</p>

                    <div class="period-quick-stats">
                        <span class="quick-stat-badge">🏛️ ${worldCount} an die Weltgemeinde</span>
                        <span class="quick-stat-badge">📜 ${ridvanCount} Riḍván-Botschaften</span>
                        <span class="quick-stat-badge">🤝 ${counsellorsCount} an Berater / Institutionen</span>
                    </div>

                    <!-- Such- & Filtersteuerung innerhalb des Zeitabschnitts -->
                    <div class="period-controls-bar">
                        <div class="period-recipient-filter">
                            <button class="filter-pill ${currentRecipientFilter === 'all' ? 'active' : ''}" onclick="window.TimelineModule.filterRecipient('all')">Alle (${planDocs.length})</button>
                            <button class="filter-pill ${currentRecipientFilter === 'world' ? 'active' : ''}" onclick="window.TimelineModule.filterRecipient('world')">Weltweit</button>
                            <button class="filter-pill ${currentRecipientFilter === 'counsellors' ? 'active' : ''}" onclick="window.TimelineModule.filterRecipient('counsellors')">Berater</button>
                            <button class="filter-pill ${currentRecipientFilter === 'nsa' ? 'active' : ''}" onclick="window.TimelineModule.filterRecipient('nsa')">Nationale Räte</button>
                        </div>
                        <div class="period-search-input-wrapper">
                            <input type="text" id="timeline-search-input" placeholder="In ${plan.code} suchen..." value="${escapeDocHtml(currentSearchQuery)}">
                        </div>
                    </div>
                </div>
            `;

            const searchInput = detailEl.querySelector('#timeline-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    currentSearchQuery = e.target.value.trim().toLowerCase();
                    renderPlanDocs(planDocs);
                });
            }
        }

        renderPlanDocs(planDocs);
    }

    function filterRecipient(recipient) {
        currentRecipientFilter = recipient;
        selectPlan(currentSelectedPlanId);
    }

    function renderPlanDocs(docsList) {
        const grid = document.getElementById('timeline-results-grid');
        if (!grid) return;

        let filtered = docsList;
        if (currentRecipientFilter !== 'all') {
            if (currentRecipientFilter === 'counsellors') {
                filtered = filtered.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors');
            } else {
                filtered = filtered.filter(d => d.recipient === currentRecipientFilter);
            }
        }

        if (currentSearchQuery) {
            filtered = filtered.filter(d => {
                const title = (d.title || '').toLowerCase();
                const text = (d.text || '').substring(0, 500).toLowerCase();
                const topics = (d.topics || []).join(' ').toLowerCase();
                return title.includes(currentSearchQuery) || text.includes(currentSearchQuery) || topics.includes(currentSearchQuery);
            });
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-paper); border-radius: var(--radius-md); border: 1px dashed var(--border-hairline);">
                    <p style="color: var(--text-muted); font-size: 0.95rem;">Keine Dokumente für diese Filterkombination gefunden.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map((doc, idx) => {
            return window.createDocCard ? window.createDocCard(doc, '', idx) : '';
        }).join('');
    }

    function escapeDocHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        init: init,
        selectPlan: selectPlan,
        selectEpoch: selectEpoch,
        selectDivineEpoch: selectDivineEpoch,
        selectCentury: selectCentury,
        selectAge: selectAge,
        filterRecipient: filterRecipient
    };
})();
