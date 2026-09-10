/**
 * i18n.js
 * Zentrales Internationalisierungs- und Sprachmanagement für das Bahá'í-Botschaften-Archiv.
 * Steuert die Master-Sprachauswahl der gesamten Webseite (Navigation, Suche, Filter,
 * Einstellungsmenü, Dokumenten-Viewer, Bücher, Merkliste) sowie die Standard-Lesesprache.
 */

window.I18n = (function() {
    const STORAGE_KEY = 'cosmos_master_lang';
    const PREF_LANG_KEY = 'cosmos_preferred_lang';

    const TRANSLATIONS = {
        de: {
            // Navigation & Dock
            'nav.brand_title': 'Zurück zur Bibliothek',
            'nav.library': 'Bibliothek',
            'nav.library_title': 'Bibliothek (Botschaften des Hauses)',
            'nav.timeline': 'Zeitstrahl',
            'nav.timeline_title': 'Historischer Zeitstrahl & Epochen-Explorer (1844–2044)',
            'nav.workshop': 'Werkstatt',
            'nav.workshop_title': 'Kompilations-Werkstatt',
            'nav.sources': 'Quellen',
            'nav.sources_title': 'Offizielle Bahá\'í-Quellen & Repositorien',
            'nav.saved': 'Merkliste',
            'nav.saved_title': 'Merkliste & Gespeichertes',
            'nav.settings': 'Einstellungen',
            'nav.settings_title': 'Einstellungen',

            // Einstellungs-Menü
            'settings.title': 'Einstellungen',
            'settings.subtitle': 'Passen Sie Anzeige, Typografie und Leseoptionen an Ihre Vorlieben an.',
            'settings.reset': 'Zurücksetzen',
            'settings.reset_title': 'Auf Standard zurücksetzen',
            'settings.format_label': 'Standard-Leseformat',
            'settings.format_pdf': 'Original-PDF',
            'settings.format_pdf_title': 'Original-Dokument im offiziellen PDF-Layout betrachten',
            'settings.format_text': 'Fließtext',
            'settings.format_text_title': 'Als Fließtext im Web-Reader lesen',
            'settings.format_web': 'Webseite',
            'settings.format_web_title': 'Autorisierte Original-Webseite aufrufen',
            'settings.format_auto': 'Automatisch',
            'settings.format_auto_title': 'Automatisch je nach Originalquelle auswählen',
            'settings.language_label': 'Sprache (Webseite & Leser)',
            'settings.lang_de': 'Deutsch',
            'settings.lang_de_title': 'Deutsche Benutzeroberfläche & Lesetexte bevorzugen',
            'settings.lang_en': 'English',
            'settings.lang_en_title': 'English user interface & original texts preferred',
            'settings.appearance_label': 'Erscheinungsbild',
            'settings.theme_light': 'Hell',
            'settings.theme_light_title': 'Helles, klares Bibliotheksweiß',
            'settings.theme_sepia': 'Sepia',
            'settings.theme_sepia_title': 'Warmes Buchpapier (schont die Augen)',
            'settings.theme_dark': 'Dunkel',
            'settings.theme_dark_title': 'Augenschonendes dunkles Design',
            'settings.theme_oled': 'OLED',
            'settings.theme_oled_title': 'Reines OLED-Tiefschwarz für Nachtlesen',
            'settings.accent_label': 'Akzentfarbe',
            'settings.accent_gold_title': 'Klassisches Gold',
            'settings.accent_blue_title': 'Persischblau',
            'settings.accent_terra_title': 'Terracotta',
            'settings.accent_custom_title': 'Eigene Farbe wählen (Farbrad & Palette)',
            'settings.font_label': 'Leseschrift',
            'settings.font_serif': 'Serif',
            'settings.font_serif_title': 'Klassische Buch-Antiqua',
            'settings.font_sans': 'Sans',
            'settings.font_sans_title': 'Moderne Grotesk',
            'settings.font_mono': 'Mono',
            'settings.font_mono_title': 'Schreibmaschinen-Schrift',
            'settings.line_height_label': 'Zeilenabstand',
            'settings.lh_compact': 'Kompakt',
            'settings.lh_normal': 'Normal',
            'settings.lh_spacious': 'Großzügig',
            'settings.text_size_label': 'Textgröße',
            'settings.layout_label': 'Darstellung',
            'settings.layout_compact': 'Kompakt',
            'settings.layout_spacious': 'Geräumig',

            // Bibliothek & Suche
            'library.title': 'Bibliothek',
            'library.realm_house': 'Botschaften des Hauses',
            'library.realm_house_sub': 'Botschaften des Universalen Hauses der Gerechtigkeit (1963–2026)',
            'library.search_placeholder': 'In Botschaften des Hauses (1963–2026) suchen...',
            'library.search_placeholder_all': 'In allen Werken suchen...',
            'library.clear_search': 'Suche leeren',
            'library.filter_btn': 'Filter',
            'library.filter_btn_title': 'Detail-Filter ein- oder ausblenden',
            'library.reset_filters': 'Filter zurücksetzen',
            'library.reset_filters_title': 'Alle Filter zurücksetzen',
            'library.active_badge': 'Aktiv',

            // Säulen
            'pillar.house_title': 'Botschaften des Hauses',
            'pillar.house_sub': 'Universales Haus der Gerechtigkeit',
            'pillar.comp_title': 'Compilations des Hauses',
            'pillar.comp_sub': 'Thematische Textsammlungen',
            'pillar.books_title': 'Heilige Schriften & Bücher',
            'pillar.books_sub': 'Zentrale Gestalten & Shoghi Effendi',
            'pillar.ruhi_title': 'Ruhi-Bücher',
            'pillar.ruhi_sub': 'Institut & Kursmaterialien',

            // Drawer Schnellfilter
            'drawer.topics_recipients': 'Themen & Empfänger',
            'drawer.chip_all_messages': 'Alle Botschaften',
            'drawer.chip_ridvan': 'Riḍván',
            'drawer.chip_world': 'An die Bahá’í-Welt',
            'drawer.chip_counsellors': 'Berater & Hilfsamt',
            'drawer.chip_youth': 'Jugend',
            'drawer.chip_iran': 'Iran',
            'drawer.chip_peace': 'Frieden',

            'drawer.chip_all_authors': 'Alle Verfasser',
            'drawer.chip_the_bab': 'Der Báb',
            'drawer.chip_bahaullah': 'Bahá\'u\'lláh',
            'drawer.chip_abdulbaha': '‘Abdu’l-Bahá',
            'drawer.chip_shoghi': 'Shoghi Effendi',

            'drawer.chip_all_topics': 'Alle Themen',
            'drawer.chip_marriage': 'Ehe & Familie',
            'drawer.chip_prayer': 'Gebet & Andacht',
            'drawer.chip_huquq': 'Ḥuqúqu’lláh',
            'drawer.chip_consultation': 'Beratung',
            'drawer.chip_women': 'Frauen',
            'drawer.chip_virtues': 'Geistige Tugenden',

            'drawer.chip_all_ruhi': 'Alle Bände',
            'drawer.chip_ruhi_1_4': 'Bücher 1–4 (Grundlagen)',
            'drawer.chip_ruhi_5_8': 'Bücher 5–8 (Befähigung)',
            'drawer.chip_ruhi_9_plus': 'Bücher 9–14 (Vertiefung)',
            'drawer.chip_ruhi_branch': 'Zweigkurse',

            // Filter Dropdowns
            'drawer.field_recipient': 'Empfänger',
            'drawer.opt_all_recipients': 'Alle Empfänger',
            'drawer.opt_world': 'Weltweite Gemeinde',
            'drawer.opt_nsa': 'Nationale Geistige Räte',
            'drawer.opt_counsellors': 'Berater & Hilfsamt',
            'drawer.opt_youth': 'Jugend',
            'drawer.opt_institutes': 'Trainingsinstitute',
            'drawer.opt_iran': 'Freunde im Iran',
            'drawer.opt_individual': 'Einzelne Gläubige',

            'drawer.field_epoch': 'Epoche & Plan',
            'drawer.opt_all_epochs': 'Alle Pläne & Epochen',
            'drawer.opt_nine_year': 'Neunjahresplan (2022–2031)',
            'drawer.opt_one_year': 'Einjahresplan (2021–2022)',
            'drawer.opt_five_year_16': 'Fünfjahresplan (2016–2021)',
            'drawer.opt_plans_00': 'Pläne 2001–2015',
            'drawer.opt_era_90s': '1990er Jahre',
            'drawer.opt_era_80s': '1980er Jahre',
            'drawer.opt_era_early': '1963–1979',

            'drawer.field_type': 'Anlass & Typus',
            'drawer.opt_all_types': 'Alle Anlässe & Typen',
            'drawer.opt_ridvan_msg': 'Riḍván-Botschaften',
            'drawer.opt_nawruz_msg': 'Naw-Rúz-Botschaften',
            'drawer.opt_counsellor_msg': 'Beraterkonferenzen',
            'drawer.opt_peace_msg': 'Friedensbotschaften',
            'drawer.opt_youth_msg': 'Jugendkonferenzen',
            'drawer.opt_general_msg': 'Allgemeine Botschaften',

            'drawer.field_lang': 'Sprachfilter (Archiv)',
            'drawer.opt_all_langs': 'Alle Sprachen',
            'drawer.opt_de_lang': 'Deutsch',
            'drawer.opt_en_lang': 'English (Original)',

            // Ergebnis-Statuszeile
            'results.count_suffix': 'Werke',
            'results.sort_label': 'Sortierung:',
            'results.sort_date_desc': 'Neueste zuerst',
            'results.sort_date_asc': 'Älteste zuerst',
            'results.sort_title': 'Titel A–Z',
            'results.load_more': 'Mehr Botschaften anzeigen',
            'results.empty_title': 'Keine Dokumente gefunden',
            'results.empty_desc': 'Bitte versuchen Sie andere Suchbegriffe oder setzen Sie die Filter zurück.',

            // Reader / Document Viewer
            'viewer.meta_type_message': 'Botschaft',
            'viewer.meta_type_book': 'Buch',
            'viewer.meta_type_comp': 'Kompilation',
            'viewer.meta_undated': 'Undatiert',
            'viewer.orig_pdf': 'Original: PDF',
            'viewer.orig_web': 'Original: Webseite',
            'viewer.btn_bookmark': 'Lesezeichen setzen',
            'viewer.btn_close': 'Schließen (Esc)',
            'viewer.btn_mode_text': 'Fließtext',
            'viewer.btn_mode_text_title': 'Als lesefreundlichen Fließtext anzeigen',
            'viewer.btn_mode_pdf': 'Original-PDF',
            'viewer.btn_mode_pdf_title': 'Im Original-PDF-Layout betrachten',
            'viewer.btn_mode_web': 'Webseite',
            'viewer.btn_mode_web_title': 'Original-Webseite aufrufen',
            'viewer.btn_download': 'Download',
            'viewer.btn_download_title': 'Dokument herunterladen oder im Web öffnen',
            'viewer.btn_copy': 'Gesamten Text kopieren',
            'viewer.copied_toast': 'In die Zwischenablage kopiert',
            'viewer.lang_de_title': 'Deutsche Fassung',
            'viewer.lang_en_title': 'English version',

            // Sammlungen & Subtabs
            'collections.title': 'Thematische Sammlungen',
            'collections.tab_compilations': 'Thematische Kompilationen (115)',
            'collections.tab_ruhi': 'Ruhi-Institut (Bücher 1–12 & Zweigkurse)',
            'collections.tab_study': 'Studienhilfen & Meilensteine',

            // Werkstatt
            'workshop.title': 'Kompilations-Werkstatt',
            'workshop.subtitle': 'Thematische Sammlungen und eigene Manuskripte aus autorisierten Botschaften zusammenstellen, mit Leitgedanken versehen und exportieren.',

            // Merkliste & Verlauf
            'saved.title': 'Merkliste & Manuskripte',
            'saved.tab_bookmarks': 'Lesezeichen',
            'saved.tab_history': 'Zuletzt gelesen',
            'saved.tab_compilations': 'Meine Kompilationen',
            'saved.empty_bookmarks': 'Keine Lesezeichen vorhanden.',
            'saved.empty_history': 'Noch kein Leseverlauf vorhanden.',
            'saved.empty_compilations': 'Keine eigenen Kompilationen erstellt.',

            // Bücher-Modul
            'books.title': 'Schriften & Bücher',
            'books.search_placeholder': 'Buchtitel, Begriff oder Verfasser suchen...',
            'books.sort_author': 'Nach Verfasser sortieren',
            'books.sort_chronological': 'Nach Entstehungsjahr / Chronologie',
            'books.sort_title': 'Titel A–Z',
            'books.sort_length': 'Nach Umfang (Wortanzahl)',

            // Footer
            'footer.notice': 'Unabhängiges, privates Arbeits- und Studienarchiv. Kein offizieller Webauftritt einer Bahá\'í-Institution.',
            'footer.official_sources': 'Offizielle Quellen:'
        },

        en: {
            // Navigation & Dock
            'nav.brand_title': 'Back to Library',
            'nav.library': 'Library',
            'nav.library_title': 'Library (Messages of the Universal House of Justice)',
            'nav.timeline': 'Timeline',
            'nav.timeline_title': 'Historical Timeline & Epoch Explorer (1844–2044)',
            'nav.workshop': 'Workshop',
            'nav.workshop_title': 'Compilation Workshop',
            'nav.sources': 'Sources',
            'nav.sources_title': 'Official Bahá\'í Sources & Repositories',
            'nav.saved': 'Saved',
            'nav.saved_title': 'Saved & Bookmarks',
            'nav.settings': 'Settings',
            'nav.settings_title': 'Settings',

            // Settings Menu
            'settings.title': 'Settings',
            'settings.subtitle': 'Customize appearance, typography and reading preferences to your liking.',
            'settings.reset': 'Reset',
            'settings.reset_title': 'Reset to defaults',
            'settings.format_label': 'Default Reading Format',
            'settings.format_pdf': 'Original PDF',
            'settings.format_pdf_title': 'View original document in official PDF layout',
            'settings.format_text': 'Flowing Text',
            'settings.format_text_title': 'Read as responsive text in web reader',
            'settings.format_web': 'Webpage',
            'settings.format_web_title': 'Open authorized original webpage',
            'settings.format_auto': 'Auto',
            'settings.format_auto_title': 'Automatically select best available source format',
            'settings.language_label': 'Language (Website & Reader)',
            'settings.lang_de': 'Deutsch',
            'settings.lang_de_title': 'German user interface & reading texts preferred',
            'settings.lang_en': 'English',
            'settings.lang_en_title': 'English user interface & reading texts preferred',
            'settings.appearance_label': 'Appearance',
            'settings.theme_light': 'Light',
            'settings.theme_light_title': 'Crisp, bright library white',
            'settings.theme_sepia': 'Sepia',
            'settings.theme_sepia_title': 'Warm book paper (gentle on the eyes)',
            'settings.theme_dark': 'Dark',
            'settings.theme_dark_title': 'Eye-friendly dark theme',
            'settings.theme_oled': 'OLED',
            'settings.theme_oled_title': 'Pure OLED deep black for night reading',
            'settings.accent_label': 'Accent Color',
            'settings.accent_gold_title': 'Classic Gold',
            'settings.accent_blue_title': 'Persian Blue',
            'settings.accent_terra_title': 'Terracotta',
            'settings.accent_custom_title': 'Pick custom color (color wheel & palette)',
            'settings.font_label': 'Reading Font',
            'settings.font_serif': 'Serif',
            'settings.font_serif_title': 'Classic Book Antiqua',
            'settings.font_sans': 'Sans',
            'settings.font_sans_title': 'Modern Sans-Serif',
            'settings.font_mono': 'Mono',
            'settings.font_mono_title': 'Typewriter Monospace',
            'settings.line_height_label': 'Line Spacing',
            'settings.lh_compact': 'Compact',
            'settings.lh_normal': 'Normal',
            'settings.lh_spacious': 'Spacious',
            'settings.text_size_label': 'Text Size',
            'settings.layout_label': 'Layout',
            'settings.layout_compact': 'Compact',
            'settings.layout_spacious': 'Spacious',

            // Library & Search
            'library.title': 'Library',
            'library.realm_house': 'Messages of the House',
            'library.realm_house_sub': 'Messages of the Universal House of Justice (1963–2026)',
            'library.search_placeholder': 'Search messages of the House (1963–2026)...',
            'library.search_placeholder_all': 'Search all works...',
            'library.clear_search': 'Clear search',
            'library.filter_btn': 'Filter',
            'library.filter_btn_title': 'Show or hide detailed filters',
            'library.reset_filters': 'Reset filters',
            'library.reset_filters_title': 'Reset all filters',
            'library.active_badge': 'Active',

            // Pillars
            'pillar.house_title': 'Messages of the House',
            'pillar.house_sub': 'Universal House of Justice',
            'pillar.comp_title': 'Compilations of the House',
            'pillar.comp_sub': 'Thematic Collections',
            'pillar.books_title': 'Holy Writings & Books',
            'pillar.books_sub': 'Central Figures & Shoghi Effendi',
            'pillar.ruhi_title': 'Ruhi Books',
            'pillar.ruhi_sub': 'Institute & Course Materials',

            // Drawer Quick Filters
            'drawer.topics_recipients': 'Topics & Recipients',
            'drawer.chip_all_messages': 'All Messages',
            'drawer.chip_ridvan': 'Riḍván',
            'drawer.chip_world': 'To the Bahá’í World',
            'drawer.chip_counsellors': 'Counsellors & Board',
            'drawer.chip_youth': 'Youth',
            'drawer.chip_iran': 'Iran',
            'drawer.chip_peace': 'Peace',

            'drawer.chip_all_authors': 'All Authors',
            'drawer.chip_the_bab': 'The Báb',
            'drawer.chip_bahaullah': 'Bahá\'u\'lláh',
            'drawer.chip_abdulbaha': '‘Abdu’l-Bahá',
            'drawer.chip_shoghi': 'Shoghi Effendi',

            'drawer.chip_all_topics': 'All Topics',
            'drawer.chip_marriage': 'Marriage & Family',
            'drawer.chip_prayer': 'Prayer & Devotion',
            'drawer.chip_huquq': 'Ḥuqúqu’lláh',
            'drawer.chip_consultation': 'Consultation',
            'drawer.chip_women': 'Women',
            'drawer.chip_virtues': 'Spiritual Virtues',

            'drawer.chip_all_ruhi': 'All Volumes',
            'drawer.chip_ruhi_1_4': 'Books 1–4 (Foundations)',
            'drawer.chip_ruhi_5_8': 'Books 5–8 (Empowerment)',
            'drawer.chip_ruhi_9_plus': 'Books 9–14 (Deepening)',
            'drawer.chip_ruhi_branch': 'Branch Courses',

            // Filter Dropdowns
            'drawer.field_recipient': 'Recipient',
            'drawer.opt_all_recipients': 'All Recipients',
            'drawer.opt_world': 'Worldwide Community',
            'drawer.opt_nsa': 'National Spiritual Assemblies',
            'drawer.opt_counsellors': 'Counsellors & Board',
            'drawer.opt_youth': 'Youth',
            'drawer.opt_institutes': 'Training Institutes',
            'drawer.opt_iran': 'Friends in Iran',
            'drawer.opt_individual': 'Individual Believers',

            'drawer.field_epoch': 'Epoch & Plan',
            'drawer.opt_all_epochs': 'All Plans & Epochs',
            'drawer.opt_nine_year': 'Nine Year Plan (2022–2031)',
            'drawer.opt_one_year': 'One Year Plan (2021–2022)',
            'drawer.opt_five_year_16': 'Five Year Plan (2016–2021)',
            'drawer.opt_plans_00': 'Plans 2001–2015',
            'drawer.opt_era_90s': '1990s',
            'drawer.opt_era_80s': '1980s',
            'drawer.opt_era_early': '1963–1979',

            'drawer.field_type': 'Occasion & Type',
            'drawer.opt_all_types': 'All Occasions & Types',
            'drawer.opt_ridvan_msg': 'Riḍván Messages',
            'drawer.opt_nawruz_msg': 'Naw-Rúz Messages',
            'drawer.opt_counsellor_msg': 'Counsellor Conferences',
            'drawer.opt_peace_msg': 'Peace Messages',
            'drawer.opt_youth_msg': 'Youth Conferences',
            'drawer.opt_general_msg': 'General Messages',

            'drawer.field_lang': 'Language Filter (Archive)',
            'drawer.opt_all_langs': 'All Languages',
            'drawer.opt_de_lang': 'Deutsch',
            'drawer.opt_en_lang': 'English (Original)',

            // Results Bar
            'results.count_suffix': 'documents',
            'results.sort_label': 'Sort by:',
            'results.sort_date_desc': 'Newest first',
            'results.sort_date_asc': 'Oldest first',
            'results.sort_title': 'Title A–Z',
            'results.load_more': 'Show more messages',
            'results.empty_title': 'No documents found',
            'results.empty_desc': 'Try other search terms or clear active filters.',

            // Reader / Document Viewer
            'viewer.meta_type_message': 'Message',
            'viewer.meta_type_book': 'Book',
            'viewer.meta_type_comp': 'Compilation',
            'viewer.meta_undated': 'Undated',
            'viewer.orig_pdf': 'Original: PDF',
            'viewer.orig_web': 'Original: Webpage',
            'viewer.btn_bookmark': 'Bookmark',
            'viewer.btn_close': 'Close (Esc)',
            'viewer.btn_mode_text': 'Flowing Text',
            'viewer.btn_mode_text_title': 'View as responsive readable text',
            'viewer.btn_mode_pdf': 'Original PDF',
            'viewer.btn_mode_pdf_title': 'View in official PDF layout',
            'viewer.btn_mode_web': 'Webpage',
            'viewer.btn_mode_web_title': 'Open original webpage',
            'viewer.btn_download': 'Download',
            'viewer.btn_download_title': 'Download document or view web source',
            'viewer.btn_copy': 'Copy entire text',
            'viewer.copied_toast': 'Copied to clipboard',
            'viewer.lang_de_title': 'German version',
            'viewer.lang_en_title': 'English version',

            // Collections & Subtabs
            'collections.title': 'Thematic Collections',
            'collections.tab_compilations': 'Thematic Compilations (115)',
            'collections.tab_ruhi': 'Ruhi Institute (Books 1–12 & Branch Courses)',
            'collections.tab_study': 'Study Materials & Milestones',

            // Workshop
            'workshop.title': 'Compilation Workshop',
            'workshop.subtitle': 'Compile thematic collections and personal manuscripts from authorized messages, add notes and export.',

            // Saved & History
            'saved.title': 'Saved & Manuscripts',
            'saved.tab_bookmarks': 'Bookmarks',
            'saved.tab_history': 'Recently Read',
            'saved.tab_compilations': 'My Compilations',
            'saved.empty_bookmarks': 'No saved bookmarks yet.',
            'saved.empty_history': 'No reading history yet.',
            'saved.empty_compilations': 'No personal compilations created yet.',

            // Books Module
            'books.title': 'Holy Writings & Books',
            'books.search_placeholder': 'Search book title, term or author...',
            'books.sort_author': 'Sort by author',
            'books.sort_chronological': 'Chronological (by publication year)',
            'books.sort_title': 'Title A–Z',
            'books.sort_length': 'By length (word count)',

            // Footer
            'footer.notice': 'Independent, private study archive. Not an official website of any Bahá\'í institution.',
            'footer.official_sources': 'Official sources:'
        }
    };

    let currentLang = 'de';
    const subscribers = [];

    function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREF_LANG_KEY);
            if (saved === 'en' || saved === 'english') {
                currentLang = 'en';
            } else {
                currentLang = 'de';
            }
        } catch (e) {
            currentLang = 'de';
        }

        document.documentElement.lang = currentLang;
        applyToDOM();
    }

    function t(key, fallback = '') {
        const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['de'];
        if (dict && dict[key] !== undefined) {
            return dict[key];
        }
        const fallbackDict = TRANSLATIONS['de'];
        if (fallbackDict && fallbackDict[key] !== undefined) {
            return fallbackDict[key];
        }
        return fallback || key;
    }

    function setLanguage(lang) {
        const valid = (lang === 'en' || lang === 'english') ? 'en' : 'de';
        currentLang = valid;

        try {
            localStorage.setItem(STORAGE_KEY, valid);
            localStorage.setItem(PREF_LANG_KEY, valid === 'en' ? 'english' : 'deutsch');
        } catch (e) {}

        document.documentElement.lang = valid;
        applyToDOM();

        // Notify all registered listener functions
        subscribers.forEach(fn => {
            try { fn(valid); } catch (err) { console.error('i18n subscriber error:', err); }
        });
    }

    function onLanguageChange(fn) {
        if (typeof fn === 'function') {
            subscribers.push(fn);
        }
    }

    function applyToDOM() {
        // Translate text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const trans = t(key);
            if (trans) el.textContent = trans;
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const trans = t(key);
            if (trans) el.placeholder = trans;
        });

        // Translate titles / tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            const trans = t(key);
            if (trans) el.title = trans;
        });

        // Translate aria-labels
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.dataset.i18nAria;
            const trans = t(key);
            if (trans) el.setAttribute('aria-label', trans);
        });

        // Update active class on language buttons in Settings
        document.querySelectorAll('#appearance-language-group .appearance-opt-btn').forEach(btn => {
            const val = btn.dataset.langVal;
            const isActive = (val === currentLang) || (val === 'english' && currentLang === 'en') || (val === 'deutsch' && currentLang === 'de');
            btn.classList.toggle('active', isActive);
        });
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        t: t,
        getLanguage: () => currentLang,
        setLanguage: setLanguage,
        onLanguageChange: onLanguageChange,
        applyToDOM: applyToDOM,
        init: init
    };
})();
