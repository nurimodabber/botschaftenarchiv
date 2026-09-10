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
    let currentSelectedId = 'plan_9yp_22'; // Standard: Aktueller Neunjahresplan
    let currentLang = 'de'; // 'de' oder 'en'
    let currentDocFilter = 'all'; // 'all', 'ridvan', 'institutions', 'books'
    let scrubberYear = 2026;

    // Horizontale X-Koordinaten für die Schlüsseljahre im SVG (viewBox: 0 0 1480 610)
    const X = {
        1844: 50,
        1853: 125,
        1892: 235,
        1921: 345,
        1937: 420,
        1944: 455,
        1946: 470,
        1953: 525,
        1963: 600,
        1974: 675,
        1979: 715,
        1986: 775,
        1993: 835,
        1996: 870,
        2000: 905,
        2001: 920,
        2006: 975,
        2011: 1030,
        2016: 1085,
        2021: 1140,
        2022: 1155,
        2031: 1250,
        2044: 1350,
        goldenStart: 1365,
        goldenEnd: 1455
    };

    // Entitäten-Datenbank mit deutschen und englischen Texten, Zitaten und Daten
    const ENTITIES = {
        'cycle': {
            id: 'cycle',
            nameDe: "Bahá'í-Zyklus",
            nameEn: "Bahá’í Cycle",
            subDe: "Vorgesehen für mindestens 500.000 Jahre",
            subEn: "Destined to last for 500,000 years",
            categoryDe: "Universaler Zyklus",
            categoryEn: "Universal Cycle",
            periodDe: "500.000 Jahre",
            periodEn: "500,000 years",
            startYear: 1844,
            endYear: 501844,
            color: "#1B2A58",
            descDe: "Der universale Zyklus der Erfüllung der gesamten Religionsgeschichte der Menschheit. Er umfasst zahllose zukünftige Offenbarungen unter dem Schatten der Offenbarung Bahá'u'lláhs.",
            descEn: "The universal cycle fulfilling humanity's religious history, destined to unfold over hundreds of thousands of years under the shadow of Bahá'u'lláh's Revelation.",
            quote: "„Dieser gewaltige Zyklus, der die Sendungen aller vergangenen Propheten krönt und vollendet, ist für eine Dauer von einer halben Million Jahren bestimmt.“",
            quoteSource: "Shoghi Effendi, Die Weltordnung Bahá'u'lláhs"
        },
        'era_c1': {
            id: 'era_c1',
            nameDe: "1. Jahrhundert der Bahá'í-Ära",
            nameEn: "1st Century of the Bahá’í Era",
            subDe: "1844–1944 (Sendung des Báb & Bahá'u'lláhs, Wirken 'Abdu'l-Bahás)",
            subEn: "1844–1944 (Ministry of the Báb, Bahá'u'lláh & 'Abdu'l-Bahá)",
            categoryDe: "Bahá'í-Ära",
            categoryEn: "Bahá’í Era",
            periodDe: "1844–1944",
            periodEn: "1844–1944",
            startYear: 1844,
            endYear: 1944,
            color: "#1F6FA8",
            descDe: "Das erste Jahrhundert der neuen Ära umfasste die heroische Anfangsphase des Glaubens, das Märtyrertum des Báb, das weltweite Exil und die Schriften Bahá'u'lláhs, die weltweite Reise 'Abdu'l-Bahás sowie den Beginn des Baus der Administrativen Ordnung unter Shoghi Effendi.",
            descEn: "The first century witnessed the Heroic Age, the martyrdom of the Báb, the revelation of Bahá'u'lláh, the ministry of 'Abdu'l-Bahá, and the establishment of the Administrative Order under Shoghi Effendi.",
            quote: "„Ein Jahrhundert voll unaussprechlicher Prüfungen, heroischer Taten und unvergleichlicher geistiger Triumphe ging zu Ende.“",
            quoteSource: "Shoghi Effendi, Gott geht vorüber"
        },
        'era_c2': {
            id: 'era_c2',
            nameDe: "2. Jahrhundert der Bahá'í-Ära",
            nameEn: "2nd Century of the Bahá’í Era",
            subDe: "1944–2044 (Weltweite Ausbreitung & Reifung der Gemeinde)",
            subEn: "1944–2044 (Global Expansion & Maturity)",
            categoryDe: "Bahá'í-Ära",
            categoryEn: "Bahá’í Era",
            periodDe: "1944–2044",
            periodEn: "1944–2044",
            startYear: 1944,
            endYear: 2044,
            color: "#1F6FA8",
            descDe: "Das gegenwärtige Jahrhundert der Bahá'í-Ära ist geprägt von der weltweiten Verbreitung des Glaubens auf alle Kontinente, der Errichtung des Universalen Hauses der Gerechtigkeit (1963), der Entfaltung des Trainingsinstituts und der Freisetzung der gesellschaftsbildenden Kraft der Lehren.",
            descEn: "The current century marks the global consolidation, election of the Universal House of Justice (1963), institute process, and release of society-building powers.",
            quote: "„Das zweite Jahrhundert der Bahá'í-Ära ist die Arena, in der die Verheißungen der Zwillingsmanifestationen ihre weltumspannende Reife erlangen.“",
            quoteSource: "Universales Haus der Gerechtigkeit"
        },
        'dispensation': {
            id: 'dispensation',
            nameDe: "Dispensation Bahá'u'lláhs",
            nameEn: "Dispensation of Bahá’u’lláh",
            subDe: "Vorgesehen für mindestens 1000 Jahre (ab 1853)",
            subEn: "Destined to last at least 1000 years (from 1853)",
            categoryDe: "Göttliche Offenbarung",
            categoryEn: "Divine Revelation",
            periodDe: "mindestens 1000 Jahre",
            periodEn: "at least 1000 years",
            startYear: 1853,
            endYear: 2853,
            color: "#00A3E0",
            descDe: "Die göttliche Sendung Bahá'u'lláhs, die im Síyáh-Chál zu Teheran im Herbst 1853 ihren Ursprung nahm. Ihre Gesetze, Grundsätze und Institutionen leiten die Menschheit in das Zeitalter des Weltfriedens und der weltweiten Einheit.",
            descEn: "The Dispensation of Bahá'u'lláh, born in the Síyáh-Chál of Tehran in 1853, ordained to last no less than a full thousand years to guide humanity into global peace.",
            quote: "„Die Offenbarung, die von jeher das Ziel und das Versprechen aller Propheten Gottes und die Sehnsucht aller Völker der Erde war, ist nun den Menschen kundgetan worden.“",
            quoteSource: "Bahá'u'lláh, Ährenlese"
        },
        'heroic_age': {
            id: 'heroic_age',
            nameDe: "Heroisches Zeitalter",
            nameEn: "Heroic Age",
            subDe: "1844–1921 (Apostolisches Zeitalter)",
            subEn: "1844–1921 (Apostolic Age)",
            categoryDe: "Zeitalter des Glaubens",
            categoryEn: "Age of the Faith",
            periodDe: "1844–1921",
            periodEn: "1844–1921",
            startYear: 1844,
            endYear: 1921,
            color: "#4A6D32",
            descDe: "Die Urphase des Glaubens, begründet durch das Wirken der drei Zentralgestalten: der Báb (Vorläufer), Bahá'u'lláh (Offenbarer) und 'Abdu'l-Bahá (Mittelpunkt des Bündnisses).",
            descEn: "The foundational Apostolic Age consecrated by the blood of thousands of martyrs and the presence of the three Central Figures.",
            quote: "„Das Heroische, das Apostolische Zeitalter unseres Glaubens, die Zeitspanne Seiner drei Zentralgestalten, hat Sein Fundament auf ewig gelegt.“",
            quoteSource: "Shoghi Effendi"
        },
        'ministry_bab': {
            id: 'ministry_bab',
            nameDe: "Sendung des Báb",
            nameEn: "Ministry of the Báb",
            subDe: "1844–1853 (1. Epoche des Heroischen Zeitalters)",
            subEn: "1844–1853 (1st Epoch of Heroic Age)",
            categoryDe: "Heroisches Zeitalter",
            categoryEn: "Heroic Age",
            periodDe: "1844–1853",
            periodEn: "1844–1853",
            startYear: 1844,
            endYear: 1853,
            color: "#6B8E23",
            descDe: "Von der Erklärung des Báb in Shiraz am 23. Mai 1844 bis zu Seinem Märtyrertum in Tabriz (1850) und dem Wirken Seiner Gefährten. Er bereitete die Menschheit auf das Kommen Bahá'u'lláhs vor.",
            descEn: "From the Declaration in Shiraz on 23 May 1844 to His Martyrdom in Tabriz (1850), preparing the way for the Promised One of all ages.",
            quote: "„O Volk der Erde! Wahrlich, das strahlende Licht Gottes ist unter euch aufgegangen...“",
            quoteSource: "Der Báb, Qayyúmu'l-Asmá'"
        },
        'ministry_bahaullah': {
            id: 'ministry_bahaullah',
            nameDe: "Sendung Bahá'u'lláhs",
            nameEn: "Ministry of Bahá’u’lláh",
            subDe: "1853–1892 (2. Epoche des Heroischen Zeitalters)",
            subEn: "1853–1892 (2nd Epoch of Heroic Age)",
            categoryDe: "Heroisches Zeitalter",
            categoryEn: "Heroic Age",
            periodDe: "1853–1892",
            periodEn: "1853–1892",
            startYear: 1853,
            endYear: 1892,
            color: "#556B2F",
            descDe: "Von den ersten Offenbarungen im Kerker des Síyáh-Chál (1853), über das Exil in Bagdad, Konstantinopel und Adrianopel, bis zur Verkündigung in Akka und Bahjí (Hinscheiden 1892). Entstehung des Kitáb-i-Aqdas und unzähliger Heiliger Schriften.",
            descEn: "From the Síyáh-Chál dungeon to Baghdad, Constantinople, Adrianople, and the Most Great Prison in Akka, bestowing the Kitáb-i-Aqdas and universal peace teachings.",
            quote: "„Die Erde ist nur ein Land, und alle Menschen sind seine Bürger.“",
            quoteSource: "Bahá'u'lláh"
        },
        'ministry_abdulbaha': {
            id: 'ministry_abdulbaha',
            nameDe: "Wirken 'Abdu'l-Bahás",
            nameEn: "Ministry of ‘Abdu’l-Bahá",
            subDe: "1892–1921 (3. Epoche des Heroischen Zeitalters)",
            subEn: "1892–1921 (3rd Epoch of Heroic Age)",
            categoryDe: "Heroisches Zeitalter",
            categoryEn: "Heroic Age",
            periodDe: "1892–1921",
            periodEn: "1892–1921",
            startYear: 1892,
            endYear: 1921,
            color: "#6B8E23",
            descDe: "Der Mittelpunkt des Bündnisses und Ausleger der Schriften. Seine historischen Reisen nach Europa und Amerika machten die Lehren im Westen bekannt; durch Sein Testament rief Er die Administrative Ordnung und das Hütertum ins Leben.",
            descEn: "The Center of the Covenant and perfect Exemplar. His historic journeys to the West and His Will and Testament established the foundation of the Administrative Order.",
            quote: "„Errichtet das Zelt der Einheit; betrachtet einander nicht als Fremde. Ihr seid die Früchte eines Baumes und die Blätter eines Zweiges.“",
            quoteSource: "'Abdu'l-Bahá"
        },
        'formative_age': {
            id: 'formative_age',
            nameDe: "Gestaltendes Zeitalter",
            nameEn: "Formative Age",
            subDe: "1921 bis zur Errichtung des Goldenen Zeitalters",
            subEn: "1921 until the dawn of the Golden Age",
            categoryDe: "Zeitalter des Glaubens",
            categoryEn: "Age of the Faith",
            periodDe: "ab 1921",
            periodEn: "from 1921",
            startYear: 1921,
            endYear: 2044,
            color: "#3B6E32",
            descDe: "Die Periode des weltweiten Aufbaus der Bahá'í-Gemeindeordnung, der weltweiten Verbreitung durch Lehrpläne und der fortschreitenden gesellschaftsbildenden Wirksamkeit.",
            descEn: "The age dedicated to forging and perfecting the administrative machinery of the Faith and executing the Divine Plan.",
            quote: "„Dieses Gestaltende Zeitalter, in dem die Keime der zukünftigen Weltordnung heranreifen, wird durch die Errichtung des Goldenen Zeitalters gekrönt werden.“",
            quoteSource: "Shoghi Effendi"
        },
        'epoch_1': {
            id: 'epoch_1',
            nameDe: "1. Epoche des Gestaltenden Zeitalters",
            nameEn: "1st Epoch of the Formative Age",
            subDe: "1921–1946 (Aufbau der örtlichen und nationalen Räte)",
            subEn: "1921–1946 (Building local & national assemblies)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "1921–1946",
            periodEn: "1921–1946",
            startYear: 1921,
            endYear: 1946,
            color: "#5B8E32",
            descDe: "Shoghi Effendi leitet den weltweiten Aufbau örtlicher und nationaler Institutionen und setzt die ersten nationalen Lehrpläne in Kraft.",
            descEn: "Establishment of the administrative apparatus under Shoghi Effendi, training communities in consultation, elections, and systematic plans."
        },
        'epoch_2': {
            id: 'epoch_2',
            nameDe: "2. Epoche des Gestaltenden Zeitalters",
            nameEn: "2nd Epoch of the Formative Age",
            subDe: "1946–1963 (Zehnjähriger Kreuzzug & weltweite Ausbreitung)",
            subEn: "1946–1963 (Ten Year Crusade & global expansion)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "1946–1963",
            periodEn: "1946–1963",
            startYear: 1946,
            endYear: 1963,
            color: "#5B8E32",
            descDe: "Höhepunkt war der weltumspannende Zehnjährige Kreuzzug (1953–1963), der den Glauben in über 250 Länder und Territorien trug und in der Wahl des Universalen Hauses der Gerechtigkeit mündete.",
            descEn: "Characterized by the Ten Year Crusade, carrying the banner of the Faith across continents and islands, culminated in the election of the Universal House of Justice."
        },
        'epoch_3': {
            id: 'epoch_3',
            nameDe: "3. Epoche des Gestaltenden Zeitalters",
            nameEn: "3rd Epoch of the Formative Age",
            subDe: "1963–1986 (Hervortreten aus der Verborgenheit)",
            subEn: "1963–1986 (Emergence from obscurity)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "1963–1986",
            periodEn: "1963–1986",
            startYear: 1963,
            endYear: 1986,
            color: "#4A7C28",
            descDe: "Erste globale Pläne unter Führung des Hauses (9YP, 5YP, 7YP), weltweites Eintreten für verfolgte Bahá'í im Iran und Veröffentlichung der Friedenserklärung (1985).",
            descEn: "Leadership passed to the Universal House of Justice; early global plans, rise of external affairs, and publication of 'The Promise of World Peace'."
        },
        'epoch_4': {
            id: 'epoch_4',
            nameDe: "4. Epoche des Gestaltenden Zeitalters",
            nameEn: "4th Epoch of the Formative Age",
            subDe: "1986–2001 (Prozess des massenhaften Eintritts)",
            subEn: "1986–2001 (Process of entry by troops)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "1986–2001",
            periodEn: "1986–2001",
            startYear: 1986,
            endYear: 2001,
            color: "#4A7C28",
            descDe: "Vorbereitung auf den Wendepunkt 1996: Einführung der Trainingsinstitute, des Cluster-Konzepts und des systematischen Lernens im Vierjahresplan.",
            descEn: "1996 marked the historic shift to systematic community building through training institutes and cluster milestones."
        },
        'epoch_5': {
            id: 'epoch_5',
            nameDe: "5. Epoche des Gestaltenden Zeitalters",
            nameEn: "5th Epoch of the Formative Age",
            subDe: "2001–2021 (Vier Fünfjahrespläne: Kernaktivitäten & Kulturwandel)",
            subEn: "2001–2021 (Four 5-Year Plans: Core activities & culture shift)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "2001–2021",
            periodEn: "2001–2021",
            startYear: 2001,
            endYear: 2021,
            color: "#3B6E32",
            descDe: "20 Jahre systematischer Kapazitätsaufbau durch die Ruhi-Kurse, Kinderklassen, Vorjugendgruppen und Andachtstreffen in Tausenden von Clustern weltweit.",
            descEn: "Two decades of intensive cluster growth, core activities, and grassroots human resource capacity development worldwide."
        },
        'epoch_6': {
            id: 'epoch_6',
            nameDe: "2. Jahrhundert / 6. Epoche",
            nameEn: "2nd Century / 6th Epoch",
            subDe: "ab 2021 (Beginn 2. Jahrhundert des Gestaltenden Zeitalters)",
            subEn: "from 2021 (Dawn of the 2nd Century of Formative Age)",
            categoryDe: "Epochen des Gestaltenden Zeitalters",
            categoryEn: "Formative Age Epochs",
            periodDe: "ab 2021",
            periodEn: "from 2021",
            startYear: 2021,
            endYear: 2046,
            color: "#2E5D28",
            descDe: "Eingeläutet durch das Gedenken an das Hinscheiden 'Abdu'l-Bahás (1921–2021). Start einer Serie von Plänen bis 2046 zur Freisetzung gesellschaftsverändernder Kräfte.",
            descEn: "The 100th anniversary of the ascension of 'Abdu'l-Bahá marked the threshold of a new series of plans aimed at releasing society-building power."
        },
        'tdp': {
            id: 'tdp',
            nameDe: "Tafeln des Göttlichen Plans",
            nameEn: "Tablets of the Divine Plan",
            subDe: "Verfasst von 'Abdu'l-Bahá (1916–1917), Ausführung ab 1937",
            subEn: "Revealed by ‘Abdu’l-Bahá (1916–1917), launched in 1937",
            categoryDe: "Göttlicher Lehrplan",
            categoryEn: "Divine Plan",
            periodDe: "ab 1937",
            periodEn: "from 1937",
            startYear: 1937,
            endYear: 2044,
            color: "#7A4C1E",
            descDe: "Die Charta zur weltweiten geistigen Eroberung des Planeten. Enthält die Anweisungen 'Abdu'l-Bahás zur Verbreitung der göttlichen Botschaft in alle Regionen der Erde.",
            descEn: "The grand charter for teaching the Cause of God revealed by 'Abdu'l-Bahá during World War I, put into action under Shoghi Effendi."
        },
        'tdp_1': {
            id: 'tdp_1',
            nameDe: "1. Epoche der Tafeln des Göttlichen Plans",
            nameEn: "1st Epoch of the Tablets of the Divine Plan",
            subDe: "1937–1963 (Zwei Siebenjahrespläne & Zehnjähriger Kreuzzug)",
            subEn: "1937–1963 (Two Seven Year Plans & Ten Year Crusade)",
            categoryDe: "Tafeln des Göttlichen Plans",
            categoryEn: "Tablets of the Divine Plan",
            periodDe: "1937–1963",
            periodEn: "1937–1963",
            startYear: 1937,
            endYear: 1963,
            color: "#D48817",
            descDe: "Unter Leitung des Hüters Shoghi Effendi entfaltete sich die erste Epoche des Göttlichen Plans in drei Stufen: den beiden Siebenjahresplänen (1937–1944 und 1946–1953) sowie dem weltumspannenden Zehnjährigen Kreuzzug (1953–1963), der den Glauben auf alle Kontinente trug und in der Wahl des Universalen Hauses der Gerechtigkeit mündete.",
            descEn: "Under the leadership of Shoghi Effendi, the first epoch of the Divine Plan unfolded in three stages: the two Seven Year Plans (1937–1944 and 1946–1953) and the global Ten Year Crusade (1953–1963), culminating in the election of the Universal House of Justice."
        },
        'tdp_2': {
            id: 'tdp_2',
            nameDe: "2. Epoche der Tafeln des Göttlichen Plans",
            nameEn: "2nd Epoch of the Tablets of the Divine Plan",
            subDe: "1963–2021 (Globale Pläne unter Führung des Universalen Hauses der Gerechtigkeit)",
            subEn: "1963–2021 (Global plans under the Universal House of Justice)",
            categoryDe: "Tafeln des Göttlichen Plans",
            categoryEn: "Tablets of the Divine Plan",
            periodDe: "1963–2021",
            periodEn: "1963–2021",
            startYear: 1963,
            endYear: 2021,
            color: "#D48817",
            descDe: "Eingeläutet mit der Wahl des Universalen Hauses der Gerechtigkeit 1963. Umfasste alle weltweiten Lehrpläne des Hauses vom Neunjahresplan (1964–1973) bis zum feierlichen Abschluss des Fünfjahresplans zu Riḍván 2021.",
            descEn: "Inaugurated with the election of the Universal House of Justice in 1963, encompassing all global teaching plans from the Nine Year Plan (1964–1973) to the close of the Five Year Plan at Riḍván 2021."
        },
        'tdp_3': {
            id: 'tdp_3',
            nameDe: "3. Epoche der Tafeln des Göttlichen Plans",
            nameEn: "3rd Epoch of the Tablets of the Divine Plan",
            subDe: "ab 2021 (Schwelle zum 2. Jahrhundert des Gestaltenden Zeitalters)",
            subEn: "from 2021 (Threshold of the 2nd Century of Formative Age)",
            categoryDe: "Tafeln des Göttlichen Plans",
            categoryEn: "Tablets of the Divine Plan",
            periodDe: "ab 2021",
            periodEn: "from 2021",
            startYear: 2021,
            endYear: 2046,
            color: "#B36B00",
            descDe: "Die aktuelle dritte Epoche des Göttlichen Plans, begonnen zu Riḍván 2021 mit dem Einjahresplan und dem aktuellen Neunjahresplan bis 2031 als erstem Schritt einer 25-jährigen Serie bis 2046.",
            descEn: "The current third epoch of the Divine Plan, launched at Riḍván 2021 with the One Year Plan and the current Nine Year Plan through 2031, part of a 25-year series to 2046."
        },
        'golden_age': {
            id: 'golden_age',
            nameDe: "Goldenes Zeitalter",
            nameEn: "Golden Age",
            subDe: "Zukunft der menschlichen Zivilisation",
            subEn: "Future of human civilization",
            categoryDe: "Zeitalter des Glaubens",
            categoryEn: "Age of the Faith",
            periodDe: "Zukunft",
            periodEn: "Future",
            startYear: 2044,
            endYear: 2100,
            color: "#3B6E32",
            descDe: "Die Verwirklichung des Größten Friedens, der geistigen Einigung aller Völker und der Etablierung des Reiches Gottes auf Erden.",
            descEn: "The consummation of the Golden Age of the Cause of God, the Great Peace, and the spiritual unification of humanity."
        },
        'series_prev': {
            id: 'series_prev',
            nameDe: "Vorherige Serie globaler Pläne",
            nameEn: "Previous Series of Global Plans",
            subDe: "1996–2021 (Vierteljahrhundert des Lernens)",
            subEn: "1996–2021 (Quarter century of learning)",
            categoryDe: "Serie globaler Pläne",
            categoryEn: "Series of Global Plans",
            periodDe: "1996–2021",
            periodEn: "1996–2021",
            startYear: 1996,
            endYear: 2021,
            color: "#C5A059",
            descDe: "Eine 25-jährige geschlossene Kette von Plänen (4YP, 12MP, vier 5YPs), die das Trainingsinstitut als weltweites Rückgrat des Wachstums etablierte."
        },
        'series_new': {
            id: 'series_new',
            nameDe: "Neue Serie globaler Pläne",
            nameEn: "New Series of Global Plans",
            subDe: "2021–2046 (25-jährige Epoche bis zur Hundertjahrfeier 2044/2046)",
            subEn: "2021–2046 (25-year series through to the 2nd Century centenary)",
            categoryDe: "Serie globaler Pläne",
            categoryEn: "Series of Global Plans",
            periodDe: "ab 2021",
            periodEn: "from 2021",
            startYear: 2021,
            endYear: 2046,
            color: "#E53935",
            descDe: "Die aktuelle Serie globaler Pläne zur Freisetzung der gesellschaftsbildenden Kraft des Glaubens in Tausenden von fortgeschrittenen Clustern weltweit."
        },

        // DIE LEHRPLÄNE
        'plan_7yp_37': {
            id: 'plan_7yp_37', code: '7YP',
            nameDe: "Erster Siebenjahresplan (1937–1944)",
            nameEn: "First Seven Year Plan (1937–1944)",
            subDe: "1937–1944 (1. Stufe der 1. Epoche des Göttlichen Plans)",
            subEn: "1937–1944 (Stage 1 of the 1st Epoch of Divine Plan)",
            categoryDe: "1. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "1st Epoch of the Tablets of the Divine Plan",
            periodDe: "1937–1944", periodEn: "1937–1944",
            startYear: 1937, endYear: 1944, startDate: "1937-04-21", endDate: "1944-04-20",
            descDe: "Der erste systematische Lehrplan der Bahá'í-Geschichte, initiiert von Shoghi Effendi für die nordamerikanische Gemeinde zur Ausbreitung nach Lateinamerika.",
            descEn: "Initiated by Shoghi Effendi for the North American community to spread the Faith across Latin America."
        },
        'plan_7yp_46': {
            id: 'plan_7yp_46', code: '7YP',
            nameDe: "Zweiter Siebenjahresplan (1946–1953)",
            nameEn: "Second Seven Year Plan (1946–1953)",
            subDe: "1946–1953 (2. Stufe der 1. Epoche des Göttlichen Plans)",
            subEn: "1946–1953 (Stage 2 of the 1st Epoch of Divine Plan)",
            categoryDe: "1. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "1st Epoch of the Tablets of the Divine Plan",
            periodDe: "1946–1953", periodEn: "1946–1953",
            startYear: 1946, endYear: 1953, startDate: "1946-04-21", endDate: "1953-04-20",
            descDe: "Wiederaufbau der im Zweiten Weltkrieg verwüsteten europäischen Bahá'í-Gemeinden und Vorbereitung auf den globalen Kreuzzug.",
            descEn: "Rebuilding European communities post-WWII and preparing the global stage for the Ten Year Crusade."
        },
        'plan_10yc_53': {
            id: 'plan_10yc_53', code: '10YC',
            nameDe: "Zehnjähriger Kreuzzug (1953–1963)",
            nameEn: "Ten Year Crusade (1953–1963)",
            subDe: "1953–1963 (3. Stufe der 1. Epoche des Göttlichen Plans)",
            subEn: "1953–1963 (Stage 3 of the 1st Epoch of Divine Plan)",
            categoryDe: "1. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "1st Epoch of the Tablets of the Divine Plan",
            periodDe: "1953–1963", periodEn: "1953–1963",
            startYear: 1953, endYear: 1963, startDate: "1953-04-21", endDate: "1963-04-20",
            descDe: "Der weltweite Kreuzzug des Hüters Shoghi Effendi als krönender Abschluss der 1. Epoche des Göttlichen Plans. Er trug den Glauben auf alle Kontinente und führte 1963 zur Wahl des Universalen Hauses der Gerechtigkeit.",
            descEn: "Shoghi Effendi's global crusade concluding the 1st Epoch of the Divine Plan, planting the banner of Bahá'u'lláh worldwide and culminating in the election of the Universal House of Justice in 1963."
        },
        'plan_9yp_64': {
            id: 'plan_9yp_64', code: '9YP',
            nameDe: "Neunjahresplan (1964–1973)",
            nameEn: "Nine Year Plan (1964–1973)",
            subDe: "1964–1973 (2. Epoche des Göttlichen Plans)",
            subEn: "1964–1973 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1964–1973", periodEn: "1964–1973",
            startYear: 1964, endYear: 1973, startDate: "1964-04-21", endDate: "1974-04-20",
            descDe: "Erster globaler Plan der 2. Epoche des Göttlichen Plans unter Führung des Universalen Hauses der Gerechtigkeit. Erhöhung der Nationalen Räte von 56 auf 113.",
            descEn: "First global plan of the 2nd Epoch of the Divine Plan under the Universal House of Justice, doubling the number of National Assemblies."
        },
        'plan_5yp_74': {
            id: 'plan_5yp_74', code: '5YP',
            nameDe: "Fünfjahresplan (1974–1979)",
            nameEn: "Five Year Plan (1974–1979)",
            subDe: "1974–1979 (2. Epoche des Göttlichen Plans)",
            subEn: "1974–1979 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1974–1979", periodEn: "1974–1979",
            startYear: 1974, endYear: 1979, startDate: "1974-04-21", endDate: "1979-04-20",
            descDe: "Stärkung des Gemeindelebens, Gründung des Internationalen Lehrzentrums (ITC) und Baubeginn des Sitzes des Hauses auf dem Berg Karmel.",
            descEn: "Deepening local life, establishing the International Teaching Centre (ITC), and commencing the Seat of the Universal House of Justice."
        },
        'plan_7yp_79': {
            id: 'plan_7yp_79', code: '7YP',
            nameDe: "Siebenjahresplan (1979–1986)",
            nameEn: "Seven Year Plan (1979–1986)",
            subDe: "1979–1986 (2. Epoche des Göttlichen Plans)",
            subEn: "1979–1986 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1979–1986", periodEn: "1979–1986",
            startYear: 1979, endYear: 1986, startDate: "1979-04-21", endDate: "1986-04-20",
            descDe: "Hervortreten aus der Verborgenheit angesichts der Verfolgungen im Iran und Veröffentlichung der Friedenserklärung (1985).",
            descEn: "Emergence from obscurity in the crucible of persecution in Iran; release of 'The Promise of World Peace'."
        },
        'plan_6yp_86': {
            id: 'plan_6yp_86', code: '6YP',
            nameDe: "Sechsjahresplan (1986–1992)",
            nameEn: "Six Year Plan (1986–1992)",
            subDe: "1986–1992 (2. Epoche des Göttlichen Plans)",
            subEn: "1986–1992 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1986–1992", periodEn: "1986–1992",
            startYear: 1986, endYear: 1992, startDate: "1986-04-21", endDate: "1992-04-20",
            descDe: "Voranschreiten des Prozesses des massenhaften Eintritts und Ausbau sozial-ökonomischer Entwicklungsprojekte.",
            descEn: "Accelerating entry by troops and social and economic development initiatives globally."
        },
        'plan_3yp_93': {
            id: 'plan_3yp_93', code: '3YP',
            nameDe: "Dreijahresplan (1993–1996)",
            nameEn: "Three Year Plan (1993–1996)",
            subDe: "1993–1996 (2. Epoche des Göttlichen Plans)",
            subEn: "1993–1996 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1993–1996", periodEn: "1993–1996",
            startYear: 1993, endYear: 1996, startDate: "1993-04-21", endDate: "1996-04-20",
            descDe: "Reifung der Institutionen und Vorbereitung des weltweiten Netzwerks regionaler Trainingsinstitute.",
            descEn: "Focus on deepening individual and collective life, preparing for the institute process."
        },
        'plan_4yp_96': {
            id: 'plan_4yp_96', code: '4YP',
            nameDe: "Vierjahresplan (1996–2000)",
            nameEn: "Four Year Plan (1996–2000)",
            subDe: "1996–2000 (2. Epoche des Göttlichen Plans)",
            subEn: "1996–2000 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "1996–2000", periodEn: "1996–2000",
            startYear: 1996, endYear: 2000, startDate: "1996-04-21", endDate: "2000-04-20",
            descDe: "Der historische Wendepunkt: Etablierung des Trainingsinstituts als primäres Instrument zur Entfaltung menschlicher Ressourcen.",
            descEn: "A watershed moment establishing training institutes as the engine of systematic growth."
        },
        'plan_12mp_00': {
            id: 'plan_12mp_00', code: '12MP',
            nameDe: "Zwölfmonatsplan (2000–2001)",
            nameEn: "Twelve Month Plan (2000–2001)",
            subDe: "2000–2001 (2. Epoche des Göttlichen Plans)",
            subEn: "2000–2001 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "2000–2001", periodEn: "2000–2001",
            startYear: 2000, endYear: 2001, startDate: "2000-04-21", endDate: "2001-04-20",
            descDe: "Übergangsplan an der Schwelle des neuen Jahrtausends zur Vorbereitung der Serie von Fünfjahresplänen.",
            descEn: "Transition plan bridging into the 21st century and the four Five Year Plans."
        },
        'plan_5yp_01': {
            id: 'plan_5yp_01', code: '5YP',
            nameDe: "Fünfjahresplan I (2001–2006)",
            nameEn: "Five Year Plan I (2001–2006)",
            subDe: "2001–2006 (2. Epoche des Göttlichen Plans)",
            subEn: "2001–2006 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "2001–2006", periodEn: "2001–2006",
            startYear: 2001, endYear: 2006, startDate: "2001-04-21", endDate: "2006-04-20",
            descDe: "Einführung des Cluster-Konzepts und der Kernaktivitäten (Studienkreise, Andachten, Kinderklassen).",
            descEn: "Introduction of clusters and core activities as the standard framework of growth."
        },
        'plan_5yp_06': {
            id: 'plan_5yp_06', code: '5YP',
            nameDe: "Fünfjahresplan II (2006–2011)",
            nameEn: "Five Year Plan II (2006–2011)",
            subDe: "2006–2011 (2. Epoche des Göttlichen Plans)",
            subEn: "2006–2011 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "2006–2011", periodEn: "2006–2011",
            startYear: 2006, endYear: 2011, startDate: "2006-04-21", endDate: "2011-04-20",
            descDe: "Etablierung des Vorjugendprogramms und intensive Programme des Wachstums in hunderten Clustern.",
            descEn: "Emergence of the Junior Youth Spiritual Empowerment Programme and intensive programmes of growth."
        },
        'plan_5yp_11': {
            id: 'plan_5yp_11', code: '5YP',
            nameDe: "Fünfjahresplan III (2011–2016)",
            nameEn: "Five Year Plan III (2011–2016)",
            subDe: "2011–2016 (2. Epoche des Göttlichen Plans)",
            subEn: "2011–2016 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "2011–2016", periodEn: "2011–2016",
            startYear: 2011, endYear: 2016, startDate: "2011-04-21", endDate: "2016-04-20",
            descDe: "Weltweite Jugendkonferenzen 2013 und Entstehung von Zentren intensiver Aktivität in Nachbarschaften.",
            descEn: "Historic 2013 youth conferences and neighborhood-level community building."
        },
        'plan_5yp_16': {
            id: 'plan_5yp_16', code: '5YP',
            nameDe: "Fünfjahresplan IV (2016–2021)",
            nameEn: "Five Year Plan IV (2016–2021)",
            subDe: "2016–2021 (2. Epoche des Göttlichen Plans)",
            subEn: "2016–2021 (2nd Epoch of the Divine Plan)",
            categoryDe: "2. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "2nd Epoch of the Tablets of the Divine Plan",
            periodDe: "2016–2021", periodEn: "2016–2021",
            startYear: 2016, endYear: 2021, startDate: "2016-04-21", endDate: "2021-04-20",
            descDe: "Zweihundertjahrfeiern der Geburt Bahá'u'lláhs (2017) und des Báb (2019). Über 5.000 Cluster mit Wachstumsprogrammen.",
            descEn: "Twin Bicentenary celebrations of Bahá'u'lláh and the Báb; surpassing 5,000 intensive growth clusters."
        },
        'plan_1yp_21': {
            id: 'plan_1yp_21', code: '1YP',
            nameDe: "Einjahresplan (2021–2022)",
            nameEn: "One Year Plan (2021–2022)",
            subDe: "2021–2022 (3. Epoche des Göttlichen Plans)",
            subEn: "2021–2022 (3rd Epoch of the Divine Plan)",
            categoryDe: "3. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "3rd Epoch of the Tablets of the Divine Plan",
            periodDe: "2021–2022", periodEn: "2021–2022",
            startYear: 2021, endYear: 2022, startDate: "2021-04-21", endDate: "2022-04-20",
            descDe: "Eröffnung der 3. Epoche des Göttlichen Plans, Hundertjahrfeier des Hinscheidens 'Abdu'l-Bahás und Start in das 2. Jahrhundert des Gestaltenden Zeitalters.",
            descEn: "Opening the 3rd Epoch of the Divine Plan, centenary of the Ascension of 'Abdu'l-Bahá, and inauguration of the 2nd Century of the Formative Age."
        },
        'plan_9yp_22': {
            id: 'plan_9yp_22', code: '9YP',
            nameDe: "Neunjahresplan (2022–2031)",
            nameEn: "Nine Year Plan (2022–2031)",
            subDe: "2022–2031 (3. Epoche des Göttlichen Plans)",
            subEn: "2022–2031 (3rd Epoch of the Divine Plan)",
            categoryDe: "3. Epoche der Tafeln des Göttlichen Plans",
            categoryEn: "3rd Epoch of the Tablets of the Divine Plan",
            periodDe: "2022–2031", periodEn: "2022–2031",
            startYear: 2022, endYear: 2031, startDate: "2022-04-21", endDate: "2031-12-31",
            descDe: "Der aktuelle globale Lehrplan der 3. Epoche des Göttlichen Plans. Erster Plan einer neuen 25-jährigen Serie bis 2046 zur Freisetzung gesellschaftsbildender Kraft.",
            descEn: "The current active global plan in the 3rd Epoch of the Divine Plan, first in a 25-year series through 2046 to release society-building power."
        }
    };

    function init() {
        if (window.I18n && window.I18n.getCurrentLanguage) {
            currentLang = window.I18n.getCurrentLanguage() || 'de';
        } else if (localStorage.getItem('cosmos_master_lang')) {
            currentLang = localStorage.getItem('cosmos_master_lang');
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
                const y = d.year || (date ? parseInt(date.substring(0, 4), 10) : 0);
                if (date && date >= entity.startDate && date <= entity.endDate) return true;
                if (y && y >= entity.startYear && y <= entity.endYear) return true;
                return false;
            });
        } else if (entity.startYear && entity.endYear) {
            // By year range
            results = allDocs.filter(d => d.year >= entity.startYear && d.year <= Math.min(2026, entity.endYear));
        }

        // Chronologische Sortierung (aufsteigend nach Jahr und Datum)
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
                <line x1="${X[1844]}" y1="105" x2="${X[1944]}" y2="105" stroke="currentColor" stroke-width="1.2" />
                <line x1="${X[1844]}" y1="101" x2="${X[1844]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                <line x1="${X[1944]}" y1="101" x2="${X[1944]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                <text x="${(X[1844] + X[1944])/2}" y="117" text-anchor="middle" class="svg-ruler-text">
                    ${isDe ? "1. Jahrhundert (1844–1944)" : "1st Century (1844–1944)"}
                </text>

                <line x1="${X[1944]}" y1="105" x2="${X[2044]}" y2="105" stroke="currentColor" stroke-width="1.2" />
                <line x1="${X[2044]}" y1="101" x2="${X[2044]}" y2="109" stroke="currentColor" stroke-width="1.2" />
                <text x="${(X[1944] + X[2044])/2}" y="117" text-anchor="middle" class="svg-ruler-text">
                    ${isDe ? "2. Jahrhundert (1944–2044)" : "2nd Century (1944–2044)"}
                </text>

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
            <g class="unfold-node" data-id="plan_9yp_22" style="cursor: pointer;">
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
                <path d="M ${X[1996]} 388 Q ${midPrev} 410 ${X[2021]} 388" fill="none" stroke="currentColor" stroke-width="1.2" />
                <line x1="${midPrev}" y1="399" x2="${midPrev}" y2="415" stroke="currentColor" stroke-width="1.2" />
                <text x="${midPrev}" y="429" text-anchor="middle" class="svg-bracket-text">
                    ${isDe ? "Vorherige Serie globaler Pläne" : "Previous Series of Global Plans"}
                    <tspan x="${midPrev}" dy="14" font-size="9" fill="var(--text-muted)">
                        ${isDe ? "(1996–2021: 25 Jahre systematisches Lernen)" : "(1996–2021: 25 years of systematic learning)"}
                    </tspan>
                </text>

                <!-- 2021 to 2044 Bracket (Neue Serie, RED - tiefere vertikale Position für perfekte Lesbarkeit!) -->
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
                <g class="unfold-node ${p.isCurrent ? 'active-node' : ''}" data-id="${p.id}" style="cursor: pointer;">
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

    function renderInspector(id) {
        const inspector = document.getElementById('unfold-inspector');
        if (!inspector) return;

        const entity = ENTITIES[id] || ENTITIES['plan_9yp_22'];
        const isDe = currentLang === 'de';
        const docs = getDocumentsForEntity(entity);

        const title = isDe ? entity.nameDe : entity.nameEn;
        const sub = isDe ? entity.subDe : entity.subEn;
        const category = isDe ? entity.categoryDe : entity.categoryEn;
        const desc = isDe ? entity.descDe : entity.descEn;

        // Count categories
        const ridvanCount = docs.filter(d => (d.type || '').includes('Riḍván') || (d.title || '').includes('Riḍván')).length;
        const counsellorCount = docs.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors' || (d.title || '').includes('Berater')).length;
        const bookCount = docs.filter(d => d.tier === 'books' || d.type === 'Heiliges Buch / Schrift').length;

        inspector.innerHTML = `
            <div class="inspector-header">
                <div class="inspector-meta-left">
                    <span class="inspector-category-badge">${category}</span>
                    <span class="inspector-period-tag">${sub}</span>
                </div>
                <div class="inspector-stats">
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

            <!-- Filter & Document List -->
            <div class="inspector-docs-section">
                <div class="inspector-docs-header">
                    <h4 class="inspector-docs-heading">
                        ${isDe ? "Dokumente & Schriften dieses Zeitraums" : "Documents & Writings of this Era"}
                    </h4>
                    <div class="inspector-subfilters">
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
                    ${renderDocumentCards(docs)}
                </div>
            </div>
        `;
    }

    function filterDocs(type) {
        currentDocFilter = type;
        const entity = ENTITIES[currentSelectedId] || ENTITIES['plan_9yp_22'];
        let docs = getDocumentsForEntity(entity);

        if (type === 'ridvan') {
            docs = docs.filter(d => (d.type || '').includes('Riḍván') || (d.title || '').includes('Riḍván'));
        } else if (type === 'institutions') {
            docs = docs.filter(d => d.recipient === 'counsellors' || d.subTier === 'counsellors' || (d.title || '').includes('Berater'));
        } else if (type === 'books') {
            docs = docs.filter(d => d.tier === 'books' || d.type === 'Heiliges Buch / Schrift');
        }

        const grid = document.getElementById('inspector-docs-grid');
        if (grid) grid.innerHTML = renderDocumentCards(docs);

        document.querySelectorAll('.subfilter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type));
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
            unifiedList.push(Object.assign({}, primaryDoc, {
                formatFiles: mergedFiles,
                availableFormats: Array.from(mergedFormats),
                siblingCount: docsInGroup.length
            }));
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

    return {
        init: init,
        selectEntity: selectEntity,
        setLanguage: setLanguage,
        scrubToYear: scrubToYear,
        filterDocs: filterDocs
    };
})();
