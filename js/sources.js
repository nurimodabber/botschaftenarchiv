/**
 * sources.js
 * Offizielle Bahá'í-Quellen & Repositorien weltweit.
 * Kuratiertes Verzeichnis aller maßgeblichen autorisierten Quellen des
 * Bahá'í-Weltzentrums, der internationalen Vertretungen und nationalen Institutionen.
 */

window.SourcesModule = (function() {
    const OFFICIAL_SOURCES = [
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
            languages: ["Deutsch", "English", "Spanisch", "Französisch", "uvm."],
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
            description: "Das prestigeträchtige Publikationsorgan für fundierte Aufsätze, wissenschaftliche Essays und historische Rückblicke zu geistigen Prinzipien, Zivilisationsaufbau und globaler Einheit.",
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

    let currentCategory = 'all';
    let searchQuery = '';

    function init() {
        const container = document.getElementById('view-sources');
        if (!container) return;
        render(container);
    }

    function render(container) {
        const filtered = OFFICIAL_SOURCES.filter(src => {
            const matchesCat = (currentCategory === 'all' || src.category === currentCategory);
            const matchesSearch = !searchQuery || 
                src.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                src.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                src.description.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });

        container.innerHTML = `
            <div class="sources-container">
                <div class="view-header" style="max-width: 960px; margin: 0 auto 2.5rem; text-align: center;">
                    <div class="editorial-eyebrow">Offizielles Ökosystem der Bahá'í-Weltgemeinde</div>
                    <h2 class="editorial-headline">Offizielle Quellen &amp; Repositorien</h2>
                    <p class="editorial-lead">
                        Ein kuratiertes Verzeichnis aller maßgeblichen autorisierten Webportale, Bibliotheken, Forschungsinstitute, Nachrichtenagenturen und Vertretungen weltweit. Alle Quellen sind direkt mit ihren originalen Online-Angeboten verlinkt.
                    </p>
                </div>

                <!-- Such- und Filterleiste -->
                <div class="sources-filter-bar">
                    <div class="sources-search-box">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="sources-search-input" placeholder="Offizielle Quellen durchsuchen..." value="${escape(searchQuery)}">
                    </div>
                    <div class="sources-categories">
                        <button class="source-cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Alle Quellen (${OFFICIAL_SOURCES.length})</button>
                        <button class="source-cat-btn ${currentCategory === 'libraries' ? 'active' : ''}" data-cat="libraries">Schriften &amp; Bibliotheken</button>
                        <button class="source-cat-btn ${currentCategory === 'study' ? 'active' : ''}" data-cat="study">Studien &amp; Ruhi</button>
                        <button class="source-cat-btn ${currentCategory === 'discourse' ? 'active' : ''}" data-cat="discourse">UNO &amp; Diskurs</button>
                        <button class="source-cat-btn ${currentCategory === 'media' ? 'active' : ''}" data-cat="media">Nachrichten &amp; Medien</button>
                        <button class="source-cat-btn ${currentCategory === 'national' ? 'active' : ''}" data-cat="national">Nationale Institutionen</button>
                    </div>
                </div>

                <!-- Quellen-Grid -->
                <div class="sources-grid">
                    ${filtered.map((src, i) => `
                        <div class="source-card" style="--i: ${i};">
                            <div class="source-card-header">
                                <div class="source-header-meta">
                                    <span class="source-category-tag">${src.categoryLabel}</span>
                                    <span class="source-badge">${src.badge}</span>
                                </div>
                                <h3 class="source-title">${src.name}</h3>
                                <div class="source-subtitle">${src.subtitle}</div>
                            </div>
                            <div class="source-card-body">
                                <p class="source-desc">${src.description}</p>
                                <div class="source-meta-row">
                                    <div class="source-meta-group">
                                        <span class="source-meta-label">Formate:</span>
                                        <div class="source-tags">
                                            ${src.formats.map(f => `<span class="source-tag">${f}</span>`).join('')}
                                        </div>
                                    </div>
                                    <div class="source-meta-group">
                                        <span class="source-meta-label">Sprachen:</span>
                                        <div class="source-tags">
                                            ${src.languages.map(l => `<span class="source-tag lang-tag">${l}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="source-card-footer">
                                <div class="source-features">
                                    ${src.features.map(feat => `<span>✓ ${feat}</span>`).join('')}
                                </div>
                                <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-link-btn" title="Offizielle Website aufrufen">
                                    <span>Originalquelle öffnen</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Event-Listener
        const searchInput = container.querySelector('#sources-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                render(container);
            });
        }

        container.querySelectorAll('.source-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentCategory = btn.dataset.cat;
                render(container);
            });
        });
    }

    return {
        init: init
    };
})();
