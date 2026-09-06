/**
 * sources.js
 * Ausführliche Quellenübersicht & Dokumentenverzeichnis
 * Strukturierte Listen mit Drop-Down-Menüs zu:
 * 1. Büchern & Heiligen Schriften (277 Werke)
 * 2. Botschaften des Universalen Hauses der Gerechtigkeit (1.549 Dokumente)
 * 3. Thematischen Kompilationen (115 Sammlungen)
 * 4. Ruhi-Büchern & Curricula (31 Bände)
 * 5. Offiziellen Webseiten & Portalen weltweit (18 Repositorien)
 */

window.SourcesModule = (function() {
    const OFFICIAL_WEBSITES = [
        {
            id: 'reference-library',
            name: "Bahá'í Reference Library",
            subtitle: "Autorisierte Schriften & Dokumente der Bahá'í-Weltgemeinde",
            category: "libraries",
            categoryLabel: "Primärschriften & Bibliotheken",
            url: "https://www.bahai.org/library/",
            badge: "Weltzentrum",
            description: "Die maßgebliche weltweite Online-Schatzkammer für die Heiligen Schriften Bahá'u'lláhs, des Báb, ‘Abdu’l-Bahás, Shoghi Effendis sowie der Botschaften des Universalen Hauses der Gerechtigkeit.",
            formats: ["PDF", "Word (DOCX)", "Web / Reader"],
            languages: ["English", "Persisch (فارسی)", "Arabisch (العربية)"],
            features: ["Volltext-Download", "Volltextsuche", "Thematische Kompilationen"]
        },
        {
            id: 'bih-bibliothek',
            name: "Bahá'í-Bibliothek Deutschland",
            subtitle: "Autorisierte deutschsprachige Schriftenbibliothek",
            category: "libraries",
            categoryLabel: "Primärschriften & Bibliotheken",
            url: "https://bibliothek.bahai.de",
            badge: "Deutschland",
            description: "Die offizielle Online-Bibliothek für alle ins Deutsche übersetzten und autorisierten Schriften der Zentralgestalten, Shoghi Effendis und des Universalen Hauses der Gerechtigkeit. Gepflegt vom Bahá'í-Verlag.",
            formats: ["Web / Reader", "PDF", "Gebetsformate"],
            languages: ["Deutsch"],
            features: ["Absatz-Nummerierung", "Online-Lesemodus", "Offizielle Übersetzungen"]
        },
        {
            id: 'ruhi-institute',
            name: "Ruhi Institute",
            subtitle: "Entwicklungsinstitut für Studienkreise & Handlungskompetenz",
            category: "study",
            categoryLabel: "Studien & Handlungsfelder",
            url: "https://www.ruhi.org",
            badge: "Curriculum",
            description: "Offizielle Plattform des Ruhi-Instituts zur weltweiten Entwicklung des systematischen Lehrplans für Studienkreise (Bücher 1 bis 14), Vorjugendgruppen, Kinderklassen und Andachtsversammlungen.",
            formats: ["PDF", "Vorabdrucke", "Bücher"],
            languages: ["Deutsch", "English", "Spanisch", "Französisch"],
            features: ["Volltext-PDFs", "Vorabdrucke", "Geschichtshefte", "Mehrsprachig"]
        },
        {
            id: 'bic-un',
            name: "Bahá'í International Community (BIC)",
            subtitle: "Vertretung der Bahá'í-Weltgemeinde bei den Vereinten Nationen",
            category: "discourse",
            categoryLabel: "Gesellschaftlicher Diskurs & UNO",
            url: "https://www.bic.org",
            badge: "UN-Vertretung",
            description: "Offizielle Repräsentanz der Bahá'í-Gemeinde bei den Vereinten Nationen in Genf, New York, Addis Abeba, Brüssel und Jakarta. Beinhaltet Erklärungen zu Menschenrechten, Klimagerechtigkeit, Gleichberechtigung und Weltfrieden.",
            formats: ["Web", "PDF-Stellungnahmen", "Arbeitspapiere"],
            languages: ["English", "Französisch", "Spanisch"],
            features: ["Offizielle UN-Erklärungen", "Stellungnahmen", "Nachrichten & Berichte"]
        },
        {
            id: 'bwns',
            name: "Bahá'í World News Service (BWNS)",
            subtitle: "Offizielle globale Nachrichtenagentur",
            category: "media",
            categoryLabel: "Nachrichten & Medien",
            url: "https://news.bahai.org",
            badge: "Nachrichten",
            description: "Der offizielle Nachrichtendienst der weltweiten Bahá'í-Gemeinde. Berichtet über den weltweiten Tempelbau, internationale Konferenzen, soziale Entwicklungsprojekte und die Entfaltung der Gemeinde.",
            formats: ["Web", "Audio-Podcasts", "Dokumentarfilme", "Fotos"],
            languages: ["English", "Spanisch", "Französisch", "Persisch"],
            features: ["Podcast", "Videodokumentationen", "E-Mail-Abonnement"]
        },
        {
            id: 'bahai-world',
            name: "The Bahá'í World",
            subtitle: "Publikation des Universalen Hauses der Gerechtigkeit",
            category: "discourse",
            categoryLabel: "Gesellschaftlicher Diskurs & UNO",
            url: "https://bahaiworld.bahai.org",
            badge: "Essays & Diskurs",
            description: "Das Publikationsorgan für fundierte Aufsätze, wissenschaftliche Essays und historische Rückblicke zu geistigen Prinzipien, Zivilisationsaufbau und globaler Einheit.",
            formats: ["Web", "Langform-Essays", "Historische Bände (ab 1925)"],
            languages: ["English"],
            features: ["Tiefgehende Essays", "Peer-Reviewed Beiträge", "Historisches Archiv"]
        },
        {
            id: 'media-bank',
            name: "Bahá'í Media Bank",
            subtitle: "Offizielles hochauflösendes Bild- und Fotoarchiv",
            category: "media",
            categoryLabel: "Nachrichten & Medien",
            url: "https://media.bahai.org",
            badge: "Bildarchiv",
            description: "Zentrales Medienarchiv des Bahá'í-Weltzentrums mit Tausenden lizenzfreien, hochauflösenden Fotografien der Heiligen Stätten in Haifa und Akka, historischer Monumente und weltweiter Gemeindeaktivitäten.",
            formats: ["High-Res JPEG", "Historische Fotografien"],
            languages: ["English"],
            features: ["Druckfähige Auflösung", "Redaktionelle Nutzung", "Historische Aufnahmen"]
        },
        {
            id: 'bahai-de',
            name: "Bahá'í-Gemeinde in Deutschland (K.d.ö.R.)",
            subtitle: "Offizielles Portal des Nationalen Geistigen Rates",
            category: "national",
            categoryLabel: "Nationale Gremien & Verlage",
            url: "https://www.bahai.de",
            badge: "Nationaler Rat",
            description: "Offizielle Website der Bahá'í-Gemeinde in Deutschland mit Informationen über Glaubenslehre, Gemeindeentwicklung, Rechtsstatus, Pressemitteilungen und Aktivitäten vor Ort.",
            formats: ["Web", "PDF-Broschüren"],
            languages: ["Deutsch"],
            features: ["Gemeinde-Finder", "Presseerklärungen", "Veranstaltungen"]
        },
        {
            id: 'bahai-verlag',
            name: "Bahá'í-Verlag Deutschland",
            subtitle: "Offizieller Verlag für autorisierte Literatur",
            category: "national",
            categoryLabel: "Nationale Gremien & Verlage",
            url: "https://www.bahai-verlag.de",
            badge: "Verlag",
            description: "Herausgeber und Vertriebsstelle für gedruckte und digitale Bahá'í-Bücher, Kinder- und Jugendliteratur, Gebetsbücher sowie Studienhilfen im deutschsprachigen Raum.",
            formats: ["Buchdruck", "E-Books", "Onlineshop"],
            languages: ["Deutsch"],
            features: ["Buchbestellungen", "Neuerscheinungen", "Leseproben"]
        },
        {
            id: 'afnan-library',
            name: "Afnan Library Trust",
            subtitle: "Forschungsbibliothek für seltene historische Dokumente",
            category: "libraries",
            categoryLabel: "Primärschriften & Bibliotheken",
            url: "https://afnanlibrary.org",
            badge: "Forschung",
            description: "Gegründet auf der Sammlung der Hand der Sache Gottes Hasan Balyuzi. Beherbergt über 12.000 seltene Manuskripte, frühe Handschriften und historische Quellen zur Bahá'í-Geschichte.",
            formats: ["Digitalisierte Manuskripte", "Katalog", "PDF"],
            languages: ["English", "Persisch", "Arabisch"],
            features: ["Seltene Handschriften", "Historische Briefe", "Akademische Forschung"]
        },
        {
            id: 'wilmette-institute',
            name: "Wilmette Institute",
            subtitle: "Akademische Online-Bildungsstätte für Bahá'í-Studien",
            category: "study",
            categoryLabel: "Studien & Handlungsfelder",
            url: "https://wilmetteinstitute.org",
            badge: "Akademie",
            description: "Führendes akademisches Institut mit strukturierten Online-Kursen zu Bahá'í-Geschichte, Theologie, Philosophie, Umweltethik und sozialer Gerechtigkeit.",
            formats: ["Online-Kurse", "Forschungsarbeiten", "Webinare"],
            languages: ["English"],
            features: ["Zertifizierte Kurse", "Akademische Dozenten", "Forschungspapiere"]
        },
        {
            id: 'abs-studies',
            name: "Association for Bahá'í Studies (ABS)",
            subtitle: "Vereinigung zur Förderung des wissenschaftlichen Diskurses",
            category: "discourse",
            categoryLabel: "Gesellschaftlicher Diskurs & UNO",
            url: "https://bahai-studies.ca",
            badge: "Wissenschaft",
            description: "Akademische Vereinigung zur Untersuchung des Beitrags der Bahá'í-Lehren zu den Wissenschaften, Geisteswissenschaften und Berufsfeldern. Herausgeber des Journal of Bahá'í Studies.",
            formats: ["Akademische Journals (PDF)", "Konferenzbände"],
            languages: ["English", "Französisch"],
            features: ["Journal of Bahá'í Studies", "Jahreskonferenzen", "Working Groups"]
        },
        {
            id: 'persian-library',
            name: "Persian Bahá'í Digital Library (کتابخانه بهائی)",
            subtitle: "Maßgebliches Archiv für persische und arabische Originaltexte",
            category: "libraries",
            categoryLabel: "Primärschriften & Bibliotheken",
            url: "https://www.bahailib.com",
            badge: "Persisch & Arabisch",
            description: "Umfangreiche wissenschaftliche Digitalbibliothek für Originalschriften Bahá'u'lláhs, des Báb und 'Abdu'l-Bahás in Originalsprache mit Faksimiles, Volltextsuche und typografischen Ausgaben.",
            formats: ["PDF", "Volltext", "Faksimiles"],
            languages: ["Persisch (فارسی)", "Arabisch (العربية)"],
            features: ["Original-Kalligrafie", "Faksimile-Ausgaben", "Wissenschaftlicher Index"]
        },
        {
            id: 'bahaibookstore-us',
            name: "Bahá'í Publishing Trust (Vereinigte Staaten)",
            subtitle: "Nationaler Verlag & Buchhandelsportal der USA",
            category: "national",
            categoryLabel: "Nationale Gremien & Verlage",
            url: "https://www.bahaibookstore.com",
            badge: "USA Verlag",
            description: "Der traditionsreiche Verlag des Nationalen Geistigen Rates der Bahá'í der USA. Veröffentlicht maßgebliche wissenschaftliche Editionen, Studienausgaben, Nachschlagewerke und Einführungen.",
            formats: ["Buchdruck", "E-Books", "Hörbücher"],
            languages: ["English", "Spanisch"],
            features: ["Autorisierte Buchausgaben", "Wissenschaftliche Kommentare", "Kindermaterial"]
        },
        {
            id: 'itc-centre',
            name: "International Teaching Centre (ITC)",
            subtitle: "Leitungsorgan am Bahá'í-Weltzentrum für Lehrwerk & Institute",
            category: "study",
            categoryLabel: "Studien & Handlungsfelder",
            url: "https://www.bahai.org/action/community-building/continental-counsellors/",
            badge: "Weltzentrum",
            description: "Das Internationale Lehrzentrum koordiniert weltweit das Netzwerk der Kontinentalen Beraterräte, Hilfsämter und Trainingsinstitute und publiziert grundlegende Orientierungsdokumente für systematisches Wachstum.",
            formats: ["Briefe & Mitteilungen", "Studienpapiere", "PDF"],
            languages: ["English", "Deutsch", "Spanisch", "Französisch"],
            features: ["Dokumente zum Institutsprozess", "Beraterkonferenz-Papiere", "Weltweite Orientierung"]
        },
        {
            id: 'bahai-uk',
            name: "Bahá'í Community of the United Kingdom",
            subtitle: "Nationales Portal & Bahá'í Publishing Trust UK",
            category: "national",
            categoryLabel: "Nationale Gremien & Verlage",
            url: "https://www.bahai.org.uk",
            badge: "Großbritannien",
            description: "Offizielle Präsenz des Nationalen Geistigen Rates des Vereinigten Königreichs. Beinhaltet historische Archive, Presseerklärungen, nationale Publikationen und lokale Initiativen.",
            formats: ["Web", "Publikationen", "Pressepapiere"],
            languages: ["English"],
            features: ["Historisches Archiv", "Öffentlicher Diskurs", "Gemeindearbeit"]
        },
        {
            id: 'bic-regional-offices',
            name: "BIC Regional Liaison Offices (Genf, Brüssel, Addis Abeba, Jakarta)",
            subtitle: "Regionale Diskursbüros bei der Afrikanischen Union, EU & ASEAN",
            category: "discourse",
            categoryLabel: "Gesellschaftlicher Diskurs & UNO",
            url: "https://www.bic.org/offices",
            badge: "Diplomatie",
            description: "Internationale Vertretungen der Bahá'í International Community bei regionalen zwischenstaatlichen Organisationen mit Fokus auf Friedensförderung, Frauenrechte und nachhaltige Entwicklung.",
            formats: ["Grundsatzpapiere", "Erklärungen", "Konferenzberichte"],
            languages: ["English", "Französisch"],
            features: ["Regionalberichte", "Stellungnahmen zur EU/AU-Politik", "Diskursbeiträge"]
        },
        {
            id: 'mediatheque-france',
            name: "Médiathèque Bahá'íe de France",
            subtitle: "Offizielle französischsprachige Medien- & Schriftenbibliothek",
            category: "libraries",
            categoryLabel: "Primärschriften & Bibliotheken",
            url: "https://www.bahai.fr",
            badge: "Frankreich",
            description: "Umfassendes offizielles digitales Repositorium französischsprachiger Übersetzungen der Heiligen Schriften, Botschaften des Hauses und Studienmaterialien für den französischsprachigen Raum.",
            formats: ["Web / Reader", "PDF", "Audio"],
            languages: ["Französisch"],
            features: ["Offizielle französische Texte", "Schriften der Zentralgestalten", "Audiolesungen"]
        }
    ];

    let cachedDocs = null;
    let searchQuery = '';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function init() {
        const container = document.getElementById('view-sources');
        if (!container) return;
        if (container.dataset.rendered === 'true') return;

        if (window.state && window.state.documents && window.state.documents.length > 0) {
            cachedDocs = window.state.documents;
        } else if (!cachedDocs) {
            try {
                let res = await fetch('data/index.json').catch(() => null);
                if (!res || !res.ok) res = await fetch('/data/index.json').catch(() => null);
                if (res && res.ok) cachedDocs = await res.json();
            } catch (err) {
                console.error('Fehler beim Laden von data/index.json in SourcesModule:', err);
                cachedDocs = [];
            }
        }

        container.dataset.rendered = 'true';
        render(container);
    }

    function render(container) {
        const docs = cachedDocs || [];

        // 1. Bücher
        const books = docs.filter(d => d.tier === 'books');

        // 2. Botschaften des Hauses
        const messages = docs.filter(d => d.tier === 'house' || d.tier === 'institutions' || d.tier === 'study');

        // 3. Kompilationen
        const compilations = docs.filter(d => d.tier === 'compilations');

        // 4. Ruhi-Institut
        const ruhi = docs.filter(d => d.tier === 'ruhi');

        // 5. Webseiten
        const websites = OFFICIAL_WEBSITES;

        container.innerHTML = `
            <div class="sources-master-container">
                <!-- Header -->
                <div class="view-header" style="max-width: 960px; margin: 0 auto 2rem; text-align: center;">
                    <div class="editorial-eyebrow">Vollständiges Dokumenten- &amp; Quellenverzeichnis // Autorisierter Kanon</div>
                    <h2 class="editorial-headline">Quellen &amp; Dokumente</h2>
                    <p class="editorial-lead">
                        Ausführliche Gesamtschau aller autorisierten Bücher, Botschaften, Kompilationen, Ruhi-Studienbände und offiziellen Webportale. Gegliedert in aufklappbare Verzeichnisse mit direkten Original-Verlinkungen, Leseansicht im Reader und Mehrformat-Downloads.
                    </p>
                </div>

                <!-- Steuerungsleiste: Suche, Schnellnavigation & Aufklapp-Aktionen -->
                <div class="sources-controls-card">
                    <div class="sources-search-row">
                        <div class="sources-search-box">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="sources-search-input" placeholder="In allen Titeln, Autoren, Botschaften, Themen oder Webseiten suchen..." value="${escapeHtml(searchQuery)}">
                            ${searchQuery ? `<button class="search-clear-btn" onclick="window.SourcesModule.clearSearch()" title="Suche leeren"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
                        </div>
                        <div class="sources-expand-collapse-group">
                            <button class="sources-tool-btn" onclick="window.SourcesModule.setAllAccordions(true)" title="Alle Verzeichnisse öffnen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                                <span>Alle aufklappen</span>
                            </button>
                            <button class="sources-tool-btn" onclick="window.SourcesModule.setAllAccordions(false)" title="Alle Verzeichnisse schließen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
                                <span>Alle zuklappen</span>
                            </button>
                        </div>
                    </div>

                    <!-- Schnell-Sprung-Pills mit Zählern -->
                    <div class="sources-jump-pills">
                        <span class="jump-label">Direktsprung:</span>
                        <button class="jump-pill" onclick="window.SourcesModule.jumpToSection('sec-books')">
                            <span>Bücher</span>
                            <span class="jump-count">${books.length}</span>
                        </button>
                        <button class="jump-pill" onclick="window.SourcesModule.jumpToSection('sec-messages')">
                            <span>Botschaften</span>
                            <span class="jump-count">${messages.length}</span>
                        </button>
                        <button class="jump-pill" onclick="window.SourcesModule.jumpToSection('sec-compilations')">
                            <span>Kompilationen</span>
                            <span class="jump-count">${compilations.length}</span>
                        </button>
                        <button class="jump-pill" onclick="window.SourcesModule.jumpToSection('sec-ruhi')">
                            <span>Ruhi-Bücher</span>
                            <span class="jump-count">${ruhi.length}</span>
                        </button>
                        <button class="jump-pill" onclick="window.SourcesModule.jumpToSection('sec-websites')">
                            <span>Webseiten</span>
                            <span class="jump-count">${websites.length}</span>
                        </button>
                    </div>
                </div>

                <!-- 1. BÜCHER & HEILIGE SCHRIFTEN -->
                ${renderBooksAccordion(books)}

                <!-- 2. BOTSCHAFTEN DES UNIVERSALEN HAUSES DER GERECHTIGKEIT -->
                ${renderMessagesAccordion(messages)}

                <!-- 3. THEMATISCHE KOMPILATIONEN -->
                ${renderCompilationsAccordion(compilations)}

                <!-- 4. RUHI-INSTITUT & STUDIENREIHEN -->
                ${renderRuhiAccordion(ruhi)}

                <!-- 5. OFFIZIELLE WEBSEITEN & PORTALE -->
                ${renderWebsitesAccordion(websites)}
            </div>
        `;

        // Event-Listener für Live-Suche
        const input = container.querySelector('#sources-search-input');
        if (input) {
            input.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                applyFilter(searchQuery);
            });
        }
    }

    // --- ACCORDION-BUILDER ---

    // 1. Bücher Accordion (Gruppiert nach Verfassern)
    function renderBooksAccordion(books) {
        const authors = [
            { id: 'bahaullah', name: "Bahá'u'lláh", match: d => d.author === "Bahá'u'lláh" },
            { id: 'the-bab', name: "Der Báb", match: d => d.author === "Der Báb" },
            { id: 'abdul-baha', name: "‘Abdu’l-Bahá", match: d => d.author === "‘Abdu’l-Bahá" },
            { id: 'shoghi-effendi', name: "Shoghi Effendi", match: d => d.author === "Shoghi Effendi" },
            { id: 'uhj', name: "Universales Haus der Gerechtigkeit", match: d => d.author === "Universales Haus der Gerechtigkeit" },
            { id: 'prayers', name: "Gebete & Andacht", match: d => d.author === "Gebete & Andacht" },
            { id: 'compilations-books', name: "Textzusammenstellungen", match: d => d.author === "Textzusammenstellungen" }
        ];

        const authorGroups = authors.map(a => {
            const items = books.filter(a.match);
            return { ...a, items };
        }).filter(g => g.items.length > 0);

        return `
            <details class="sources-accordion" id="sec-books" open>
                <summary class="sources-accordion-summary">
                    <div class="summary-left">
                        <div class="summary-icon-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        </div>
                        <div class="summary-title-wrap">
                            <h3 class="summary-title">Bücher &amp; Heilige Schriften</h3>
                            <span class="summary-desc">Schriften der Zentralgestalten, Shoghi Effendis und autorisierte Werke</span>
                        </div>
                    </div>
                    <div class="summary-right">
                        <span class="summary-counter-badge" id="counter-books">${books.length} Werke</span>
                        <svg class="summary-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </summary>
                <div class="sources-accordion-body">
                    ${authorGroups.map(group => `
                        <details class="source-sub-accordion" open>
                            <summary class="source-sub-summary">
                                <span class="source-sub-title">${group.name}</span>
                                <div class="source-sub-meta">
                                    <span class="source-sub-counter">${group.items.length} Schriften</span>
                                    <svg class="source-sub-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </summary>
                            <div class="source-sub-content">
                                ${group.items.map(renderDocRow).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // 2. Botschaften Accordion (Gruppiert nach Dekaden)
    function renderMessagesAccordion(messages) {
        const getYear = (m) => {
            if (m.year) return parseInt(m.year, 10);
            const parts = (m.date || '').split('.');
            if (parts.length >= 3) {
                const parsed = parseInt(parts[parts.length - 1].trim(), 10);
                if (!isNaN(parsed)) return parsed;
            }
            return 2000;
        };

        const decadeRanges = [
            { key: 2020, label: "2020er Jahre (ab 2020)", desc: "Aktuelle Botschaften, 9-Jahres-Plan, globale Konferenzen & Riḍván" },
            { key: 2010, label: "2010–2019", desc: "Riḍván, Zweihundertjahrfeiern der Geburt Bahá'u'lláhs und des Báb" },
            { key: 2000, label: "2000–2009", desc: "Sequenz der Fünfjahrespläne, Entwicklung des Trainingsinstituts" },
            { key: 1990, label: "1990–1999", desc: "Heiliges Jahr 1992, Vierjahresplan, Botschaften an die Menschheit" },
            { key: 1980, label: "1980–1989", desc: "Die Verheißung des Weltfriedens (1985), Siebenjahresplan" },
            { key: 1970, label: "1970–1979", desc: "Verfassung des Universalen Hauses (1972), Fünfjahresplan" },
            { key: 1960, label: "1963–1969", desc: "Erste Wahl des Universalen Hauses der Gerechtigkeit, Neunjahresplan" }
        ];

        const grouped = decadeRanges.map(range => {
            const items = messages.filter(m => {
                const y = getYear(m);
                return Math.floor(y / 10) * 10 === range.key;
            });
            return { ...range, items };
        }).filter(g => g.items.length > 0);

        return `
            <details class="sources-accordion" id="sec-messages">
                <summary class="sources-accordion-summary">
                    <div class="summary-left">
                        <div class="summary-icon-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                        </div>
                        <div class="summary-title-wrap">
                            <h3 class="summary-title">Botschaften des Universalen Hauses der Gerechtigkeit</h3>
                            <span class="summary-desc">Chronologische Gesamtsammlung von 1963 bis heute mit Primärverlinkung</span>
                        </div>
                    </div>
                    <div class="summary-right">
                        <span class="summary-counter-badge" id="counter-messages">${messages.length} Dokumente</span>
                        <svg class="summary-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </summary>
                <div class="sources-accordion-body">
                    ${grouped.map(group => `
                        <details class="source-sub-accordion" ${group.key === 2020 ? 'open' : ''}>
                            <summary class="source-sub-summary">
                                <div>
                                    <span class="source-sub-title">${group.label}</span>
                                    <span class="source-sub-tagline">${group.desc}</span>
                                </div>
                                <div class="source-sub-meta">
                                    <span class="source-sub-counter">${group.items.length} Botschaften</span>
                                    <svg class="source-sub-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </summary>
                            <div class="source-sub-content">
                                ${group.items.map(renderDocRow).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // 3. Kompilationen Accordion
    function renderCompilationsAccordion(compilations) {
        // Sort alphabetically by title
        const sorted = [...compilations].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));

        return `
            <details class="sources-accordion" id="sec-compilations">
                <summary class="sources-accordion-summary">
                    <div class="summary-left">
                        <div class="summary-icon-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </div>
                        <div class="summary-title-wrap">
                            <h3 class="summary-title">Thematische Kompilationen</h3>
                            <span class="summary-desc">Autorisierte Textzusammenstellungen der Forschungsabteilung des Weltzentrums</span>
                        </div>
                    </div>
                    <div class="summary-right">
                        <span class="summary-counter-badge" id="counter-compilations">${compilations.length} Sammlungen</span>
                        <svg class="summary-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </summary>
                <div class="sources-accordion-body">
                    <div class="source-sub-content" style="border-top: none;">
                        ${sorted.map(renderDocRow).join('')}
                    </div>
                </div>
            </details>
        `;
    }

    // 4. Ruhi-Institut Accordion
    function renderRuhiAccordion(ruhi) {
        const isMain = r => {
            const t = (r.title || '').toLowerCase();
            return (t.includes('buch 0') || t.includes('book ') || t.includes('buch 1') || t.includes('buch 2') || t.includes('buch 3') || t.includes('buch 4') || t.includes('buch 5') || t.includes('buch 6') || t.includes('buch 7') || t.includes('buch 8')) && !t.includes('zweig');
        };
        const isBranch = r => {
            const t = (r.title || '').toLowerCase();
            return t.includes('zweig') || t.includes('branch');
        };

        const mainBooks = ruhi.filter(isMain);
        const branchBooks = ruhi.filter(isBranch);
        const youthAndOther = ruhi.filter(r => !isMain(r) && !isBranch(r));

        const groups = [
            { name: "Hauptcurriculum für Studienkreise (Bücher 1–8)", desc: "Grundkurs-Sequenz des Ruhi-Instituts in deutscher und englischer Fassung", items: mainBooks },
            { name: "Zweigkurse für Kinderklassen-Lehrende", desc: "Spezialisierte Vertiefungskurse für Stufe 2 und Stufe 3", items: branchBooks },
            { name: "Vorjugendprogramm & Ergänzungsbände", desc: "Texte zur geistigen Befähigung von Jugendlichen und Begleitmaterialien", items: youthAndOther }
        ].filter(g => g.items.length > 0);

        return `
            <details class="sources-accordion" id="sec-ruhi">
                <summary class="sources-accordion-summary">
                    <div class="summary-left">
                        <div class="summary-icon-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div class="summary-title-wrap">
                            <h3 class="summary-title">Ruhi-Institut &amp; Studienreihen</h3>
                            <span class="summary-desc">Systematisches Curriculum für Studienkreise, Kinderklassen und Vorjugend</span>
                        </div>
                    </div>
                    <div class="summary-right">
                        <span class="summary-counter-badge" id="counter-ruhi">${ruhi.length} Bände</span>
                        <svg class="summary-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </summary>
                <div class="sources-accordion-body">
                    ${groups.map(group => `
                        <details class="source-sub-accordion" open>
                            <summary class="source-sub-summary">
                                <div>
                                    <span class="source-sub-title">${group.name}</span>
                                    <span class="source-sub-tagline">${group.desc}</span>
                                </div>
                                <div class="source-sub-meta">
                                    <span class="source-sub-counter">${group.items.length} Hefte</span>
                                    <svg class="source-sub-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </summary>
                            <div class="source-sub-content">
                                ${group.items.map(renderDocRow).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // 5. Webseiten Accordion
    function renderWebsitesAccordion(websites) {
        const categories = [
            { id: 'libraries', label: "Primärschriften & Digitale Bibliotheken", desc: "Zentrale Repositorien für autorisierte Texte in allen Sprachen" },
            { id: 'study', label: "Studien, Curricula & Lehrzentrum", desc: "Portale für Studienkreise, Lehrwerk und akademische Ausbildung" },
            { id: 'discourse', label: "Gesellschaftlicher Diskurs, UNO & Wissenschaft", desc: "Repräsentanzen bei internationalen Organisationen und wissenschaftliche Foren" },
            { id: 'media', label: "Nachrichtenagenturen & Medienbank", desc: "Offizielle globale Berichterstattung und professionelles Bildarchiv" },
            { id: 'national', label: "Nationale Gremien & Autorisierte Verlage", desc: "Nationale Räte und offizielle Verlage im deutsch- und englischsprachigen Raum" }
        ];

        const grouped = categories.map(cat => {
            const items = websites.filter(w => w.category === cat.id);
            return { ...cat, items };
        }).filter(g => g.items.length > 0);

        return `
            <details class="sources-accordion" id="sec-websites" open>
                <summary class="sources-accordion-summary">
                    <div class="summary-left">
                        <div class="summary-icon-box">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        </div>
                        <div class="summary-title-wrap">
                            <h3 class="summary-title">Offizielle Webseiten &amp; Portale</h3>
                            <span class="summary-desc">Maßgebliche Webpräsenzen, Repositorien und Vertretungen weltweit</span>
                        </div>
                    </div>
                    <div class="summary-right">
                        <span class="summary-counter-badge" id="counter-websites">${websites.length} Portale</span>
                        <svg class="summary-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </summary>
                <div class="sources-accordion-body">
                    ${grouped.map(group => `
                        <details class="source-sub-accordion" open>
                            <summary class="source-sub-summary">
                                <div>
                                    <span class="source-sub-title">${group.label}</span>
                                    <span class="source-sub-tagline">${group.desc}</span>
                                </div>
                                <div class="source-sub-meta">
                                    <span class="source-sub-counter">${group.items.length} Portale</span>
                                    <svg class="source-sub-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </summary>
                            <div class="source-sub-content">
                                ${group.items.map(renderWebsiteRow).join('')}
                            </div>
                        </details>
                    `).join('')}
                </div>
            </details>
        `;
    }

    // --- REIHE FÜR EIN EINZELNES DOKUMENT ---
    function renderDocRow(doc) {
        const isEn = (doc.language || '').toLowerCase() === 'english';
        const langBadge = isEn
            ? '<span class="source-lang-badge en">EN</span>'
            : '<span class="source-lang-badge de">DE</span>';

        const sourceUrl = doc.sourceUrl || 'https://www.bahai.org/library/';
        let sourcePlatform = doc.sourcePlatform;
        if (!sourcePlatform) {
            if (sourceUrl.includes('ruhi.org')) sourcePlatform = 'Ruhi Institute';
            else if (sourceUrl.includes('bibliothek.bahai.de')) sourcePlatform = 'Bahá’í-Bibliothek';
            else sourcePlatform = 'Bahá’í Reference Library';
        }

        const files = doc.formatFiles || {};
        const formatPills = [];
        if (files.pdf || doc.filePath) {
            formatPills.push(`<a href="${files.pdf || doc.filePath}" download class="source-pill-dl" title="PDF herunterladen">PDF</a>`);
        }
        if (files.docx) {
            formatPills.push(`<a href="${files.docx}" download class="source-pill-dl" title="Word (.docx) herunterladen">DOCX</a>`);
        }
        if (files.epub) {
            formatPills.push(`<a href="${files.epub}" download class="source-pill-dl" title="E-Book (.epub) herunterladen">EPUB</a>`);
        }
        if (files.txt) {
            formatPills.push(`<a href="${files.txt}" download class="source-pill-dl" title="Volltext (.txt) herunterladen">TXT</a>`);
        }

        const words = doc.wordCount ? `<span>• ca. ${doc.wordCount.toLocaleString('de-DE')} Wörter</span>` : '';
        const dateStr = doc.date ? `<span class="source-doc-date">${escapeHtml(doc.date)}</span> • ` : '';

        return `
            <div class="source-list-row" data-id="${doc.id}">
                <div class="source-row-info">
                    <div class="source-row-title-bar">
                        <a href="javascript:void(0)" onclick="window.openDocument('${doc.id}')" class="source-row-title" title="Im Reader öffnen">
                            ${escapeHtml(doc.title)}
                        </a>
                        ${langBadge}
                    </div>
                    <div class="source-row-meta">
                        ${dateStr}
                        ${doc.author ? `<span class="source-meta-author">${escapeHtml(doc.author)}</span>` : ''}
                        ${doc.category ? `<span>• ${escapeHtml(doc.category)}</span>` : ''}
                        ${words}
                    </div>
                    ${doc.subtitle ? `<div class="source-row-subtitle">${escapeHtml(doc.subtitle)}</div>` : ''}
                </div>
                <div class="source-row-actions">
                    <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="source-origin-link" title="Original auf ${escapeHtml(sourcePlatform)} aufrufen">
                        <span>${escapeHtml(sourcePlatform)}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <button class="source-read-btn" onclick="window.openDocument('${doc.id}')" title="Im Volltext-Reader öffnen">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        <span>Lesen</span>
                    </button>
                    <div class="source-row-formats">
                        ${formatPills.join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // --- REIHE FÜR EINE WEBSEITE ---
    function renderWebsiteRow(src) {
        return `
            <div class="source-web-row" data-id="${src.id}">
                <div class="source-web-info">
                    <div class="source-web-title-bar">
                        <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-web-name">
                            ${escapeHtml(src.name)}
                        </a>
                        <span class="source-badge">${escapeHtml(src.badge)}</span>
                    </div>
                    <div class="source-web-subtitle">${escapeHtml(src.subtitle)}</div>
                    <p class="source-web-desc">${escapeHtml(src.description)}</p>
                    <div class="source-web-tags">
                        <div class="source-tags-group">
                            <span class="source-tags-label">Formate:</span>
                            ${src.formats.map(f => `<span class="source-tag">${escapeHtml(f)}</span>`).join('')}
                        </div>
                        <div class="source-tags-group">
                            <span class="source-tags-label">Sprachen:</span>
                            ${src.languages.map(l => `<span class="source-tag lang-tag">${escapeHtml(l)}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="source-web-actions">
                    <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-web-visit-btn" title="Offizielle Website aufrufen">
                        <span>Website öffnen</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                </div>
            </div>
        `;
    }

    // --- INTERAKTIVE METHODEN ---

    function setAllAccordions(openState) {
        const accordions = document.querySelectorAll('.sources-accordion, .source-sub-accordion');
        accordions.forEach(acc => {
            acc.open = openState;
        });
    }

    function jumpToSection(sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
            el.open = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function clearSearch() {
        searchQuery = '';
        const input = document.getElementById('sources-search-input');
        if (input) input.value = '';
        applyFilter('');
    }

    function applyFilter(query) {
        const q = (query || '').trim().toLowerCase();
        const rows = document.querySelectorAll('.source-list-row, .source-web-row');
        const mainAccordions = document.querySelectorAll('.sources-accordion');
        const subAccordions = document.querySelectorAll('.source-sub-accordion');

        if (!q) {
            rows.forEach(r => r.style.display = '');
            return;
        }

        // Zeilen filtern
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(q);
            row.style.display = matches ? '' : 'none';
        });

        // Alle Sub-Accordions und Haupt-Accordions mit Treffern öffnen
        subAccordions.forEach(sub => {
            const visibleRows = sub.querySelectorAll('.source-list-row:not([style*="display: none"]), .source-web-row:not([style*="display: none"])');
            if (visibleRows.length > 0) {
                sub.open = true;
            }
        });

        mainAccordions.forEach(main => {
            const visibleRows = main.querySelectorAll('.source-list-row:not([style*="display: none"]), .source-web-row:not([style*="display: none"])');
            if (visibleRows.length > 0) {
                main.open = true;
            }
        });
    }

    return {
        init: init,
        setAllAccordions: setAllAccordions,
        jumpToSection: jumpToSection,
        clearSearch: clearSearch
    };
})();
