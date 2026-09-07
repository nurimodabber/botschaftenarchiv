/**
 * Botschaften-Archiv & Bibliothek: Grosszuegiger, unaufdringlicher Dokument-Reader
 * 
 * Features:
 * - Auto-wegklappender Header beim Hinabscrollen (sanftes Slide-Out)
 * - Sofortiges Wiedereinblenden beim Hochscrollen oder oberem Hover-Trigger
 * - Grosszuegiges Layout (bis zu 96vw / 1420px) ohne visuelle Ueberladung
 * - Unaufdringliche Randnummerierung (Gutter) und schwebende Aktions-Pille bei Hover
 * - Nahtlose Umschaltung zwischen Original-PDF und Fliesstext
 * - Zweisprachiger Umschalter (DE / EN) bei mehrsprachigen Werken
 * - Direkte Download-Pills fuer Original-Dateien (PDF, EPUB, DOCX, TXT)
 * - Null Emojis, reine typografische Eleganz
 */

let currentViewerDoc = null;
let currentViewerMode = 'text'; // 'text' | 'pdf'
let lastScrollTop = 0;

window.initViewer = function() {
    const modal = document.getElementById('document-viewer');
    const headerEl = document.getElementById('viewer-header');
    const bodyEl = document.getElementById('viewer-body');
    const topTrigger = document.getElementById('viewer-top-trigger');
    const closeBtn = document.getElementById('viewer-close');
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    const copyBtn = document.getElementById('viewer-copy');
    const btnModePdf = document.getElementById('btn-mode-pdf');
    const btnModeText = document.getElementById('btn-mode-text');
    const btnLangDe = document.getElementById('btn-viewer-lang-de');
    const btnLangEn = document.getElementById('btn-viewer-lang-en');
    const progressBar = document.getElementById('viewer-progress-bar');

    // 1. Schliessen-Schaltflaeche
    if (closeBtn) {
        closeBtn.addEventListener('click', closeViewer);
    }

    // 2. Lesezeichen umschalten
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            if (id && window.toggleBookmark) {
                window.toggleBookmark(id);
                updateBookmarkBtnState(id);
            }
        });
    }

    // 3. Gesamten Volltext kopieren
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!currentViewerDoc || !currentViewerDoc.text) return;
            navigator.clipboard.writeText(currentViewerDoc.text).then(() => {
                const origSvg = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span style="font-size:0.75rem; color:var(--accent-gold); font-weight:600; font-family:var(--font-sans);">Kopiert</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = origSvg;
                }, 2000);
            }).catch(err => {
                console.error('Kopieren fehlgeschlagen:', err);
            });
        });
    }

    // 4. Modus-Umschaltung: Original-PDF vs. Fliesstext
    if (btnModePdf) {
        btnModePdf.addEventListener('click', () => {
            if (currentViewerDoc) {
                setViewerMode('pdf');
            }
        });
    }
    if (btnModeText) {
        btnModeText.addEventListener('click', () => {
            if (currentViewerDoc) {
                setViewerMode('text');
            }
        });
    }

    // 5. Sprach-Umschaltung: DE vs. EN
    if (btnLangDe) {
        btnLangDe.addEventListener('click', () => {
            if (currentViewerDoc && currentViewerDoc.language !== 'deutsch' && currentViewerDoc.translations && currentViewerDoc.translations.de) {
                window.openDocument(currentViewerDoc.translations.de, null, currentViewerMode, 'de');
            }
        });
    }
    if (btnLangEn) {
        btnLangEn.addEventListener('click', () => {
            if (currentViewerDoc && currentViewerDoc.language === 'deutsch' && currentViewerDoc.translations && currentViewerDoc.translations.en) {
                window.openDocument(currentViewerDoc.translations.en, null, currentViewerMode, 'en');
            }
        });
    }

    // 6. Wegklappender Header beim Hinabscrollen & Lese-Fortschritt
    if (bodyEl && headerEl) {
        bodyEl.addEventListener('scroll', () => {
            const st = bodyEl.scrollTop;

            // Auto-Collapse Logik: beim Scrollen nach unten einklappen, beim Hochscrollen sanft einblenden
            if (st > lastScrollTop && st > 65) {
                headerEl.classList.add('header-hidden');
            } else if (st < lastScrollTop || st <= 25) {
                headerEl.classList.remove('header-hidden');
            }
            lastScrollTop = st <= 0 ? 0 : st;

            // Lese-Fortschrittsbalken
            if (progressBar) {
                const maxScroll = bodyEl.scrollHeight - bodyEl.clientHeight;
                if (maxScroll > 0) {
                    const pct = Math.min(100, Math.max(0, (st / maxScroll) * 100));
                    progressBar.style.width = `${pct}%`;
                } else {
                    progressBar.style.width = '0%';
                }
            }
        }, { passive: true });
    }

    // 7. Unsichtbare Trigger-Zone am oberen Rand: Mausberuehrung blendet Header sofort wieder ein
    if (topTrigger && headerEl) {
        topTrigger.addEventListener('mouseenter', () => {
            headerEl.classList.remove('header-hidden');
        });
        topTrigger.addEventListener('click', () => {
            headerEl.classList.remove('header-hidden');
        });
    }

    // 8. Klick auf Hintergrund schliesst Modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeViewer();
            }
        });
    }

    // 9. Tastatur-Kuerzel Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeViewer();
        }
    });
};

function closeViewer() {
    const modal = document.getElementById('document-viewer');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    if (window.location.hash && window.location.hash.includes('doc=')) {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
}
window.closeViewer = closeViewer;

function updateBookmarkBtnState(id) {
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    if (!bookmarkBtn) return;
    bookmarkBtn.dataset.id = id;
    const isB = (window.isBookmarked && window.isBookmarked(id)) || 
                (window.state && Array.isArray(window.state.bookmarks) && window.state.bookmarks.includes(id));
    if (isB) {
        bookmarkBtn.style.color = 'var(--color-primary)';
        const svg = bookmarkBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'currentColor');
    } else {
        bookmarkBtn.style.color = '';
        const svg = bookmarkBtn.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'none');
    }
}

function resolvePdfPath(doc) {
    if (!doc) return null;
    if (doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf')) {
        return doc.filePath.replace(/^\.\.\//, '');
    }
    if (doc.formatFiles && doc.formatFiles.pdf) {
        return doc.formatFiles.pdf.replace(/^\.\.\//, '');
    }
    if (doc.id) {
        return `documents/formats/pdf/${doc.id}.pdf`;
    }
    return null;
}

window.openDocument = function(id, targetParagraph, preferredMode, preferredLang) {
    if (!window.state || !window.state.documents) return;

    let targetId = id;
    const initialDoc = window.state.documents.find(d => d.id === id);
    if (initialDoc && preferredLang && initialDoc.translations && initialDoc.translations[preferredLang]) {
        targetId = initialDoc.translations[preferredLang];
    }
    const doc = window.state.documents.find(d => d.id === targetId) || initialDoc;
    if (!doc) return;

    currentViewerDoc = doc;

    // URL-Hash aktualisieren (fuer direktes Teilen und Bookmarken)
    try {
        const pHash = targetParagraph ? `&p=${targetParagraph}` : '';
        const newHash = `#doc=${encodeURIComponent(doc.id)}${pHash}`;
        if (window.location.hash !== newHash && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', newHash);
        }
    } catch (e) {}

    if (typeof window.trackEvent === 'function') {
        window.trackEvent('document_open', {
            id: doc.id,
            title: (doc.title || '').slice(0, 80),
            tier: doc.tier || '',
            type: doc.type || ''
        });
    }

    const modal = document.getElementById('document-viewer');
    const headerEl = document.getElementById('viewer-header');
    const titleEl = document.getElementById('viewer-title');
    const typeBadge = document.getElementById('viewer-type-badge');
    const metaDate = document.getElementById('viewer-meta-date');
    const metaSource = document.getElementById('viewer-meta-source');
    const modePill = document.getElementById('viewer-layout-mode-pill');
    const langPill = document.getElementById('viewer-lang-pill');
    const btnLangDe = document.getElementById('btn-viewer-lang-de');
    const btnLangEn = document.getElementById('btn-viewer-lang-en');
    const dlGroup = document.getElementById('viewer-download-group');

    // Header-Metadaten setzen
    const isRuhi = doc.tier === 'ruhi' || doc.type === 'Ruhi-Buch' || 
                   (doc.title && (doc.title.startsWith('Ruhi Buch') || doc.title.startsWith('Ruhi Book')));

    if (typeBadge) {
        typeBadge.textContent = isRuhi ? 'Ruhi-Institut' : (doc.type || 'Botschaft');
    }
    if (metaDate) {
        metaDate.textContent = formatViewerDate(doc.date);
    }
    if (metaSource) {
        metaSource.textContent = doc.source || 'UHG';
    }
    if (titleEl) {
        titleEl.textContent = doc.title || 'Ohne Titel';
        titleEl.title = doc.title || '';
    }

    // PDF-Pfad ermitteln
    const pdfPath = resolvePdfPath(doc);

    // Layout-Modus Pill (Original-PDF vs. Fliesstext)
    if (modePill) {
        modePill.style.display = pdfPath ? 'inline-flex' : 'none';
    }

    // Sprach-Pill (DE / EN)
    const hasBothLangs = doc.availableLanguages && doc.availableLanguages.includes('de') && doc.availableLanguages.includes('en');
    if (langPill) {
        if (hasBothLangs) {
            langPill.style.display = 'inline-flex';
            const isDe = doc.language === 'deutsch';
            if (btnLangDe) btnLangDe.classList.toggle('active', isDe);
            if (btnLangEn) btnLangEn.classList.toggle('active', !isDe);
        } else {
            langPill.style.display = 'none';
        }
    }

    // Direkte Download-Pills fuer Originalformate generieren
    if (dlGroup) {
        dlGroup.innerHTML = '';
        const formats = [];
        const files = doc.formatFiles || {};

        if (doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf')) {
            formats.push({ label: 'PDF', href: doc.filePath, title: 'Original-PDF herunterladen' });
        } else if (files.pdf || pdfPath) {
            formats.push({ label: 'PDF', href: files.pdf || pdfPath, title: 'Original-PDF herunterladen' });
        }

        if (doc.filePath && doc.filePath.toLowerCase().endsWith('.epub')) {
            formats.push({ label: 'EPUB', href: doc.filePath, title: 'Original-E-Book (EPUB) herunterladen' });
        } else if (files.epub) {
            formats.push({ label: 'EPUB', href: files.epub, title: 'Original-E-Book (EPUB) herunterladen' });
        }

        if (doc.filePath && doc.filePath.toLowerCase().endsWith('.docx')) {
            formats.push({ label: 'DOCX', href: doc.filePath, title: 'Original-Word-Dokument (DOCX) herunterladen' });
        } else if (files.docx) {
            formats.push({ label: 'DOCX', href: files.docx, title: 'Original-Word-Dokument (DOCX) herunterladen' });
        }

        formats.forEach(f => {
            const a = document.createElement('a');
            a.href = f.href;
            a.download = '';
            a.className = 'viewer-dl-pill';
            a.title = f.title;
            a.textContent = f.label;
            dlGroup.appendChild(a);
        });

        if (doc.sourceUrl) {
            const webLink = document.createElement('a');
            webLink.href = doc.sourceUrl;
            webLink.target = '_blank';
            webLink.rel = 'noopener noreferrer';
            webLink.className = 'viewer-dl-pill';
            webLink.title = `Originaldokument auf ${doc.sourcePlatform || 'autorisierter Quelle'} im Web aufrufen`;
            webLink.textContent = 'Web ↗';
            dlGroup.appendChild(webLink);
        }
    }

    // Lesezeichen-Zustand aktualisieren
    updateBookmarkBtnState(doc.id);

    // Initialen Modus festlegen: Ruhi standardmaessig als PDF; Schriften & Botschaften als Fliesstext
    let targetMode = preferredMode || (isRuhi && !targetParagraph ? 'pdf' : 'text');
    if (!pdfPath) targetMode = 'text';

    setViewerMode(targetMode, targetParagraph);

    // Modal anzeigen & Header zuruecksetzen
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    if (headerEl) {
        headerEl.classList.remove('header-hidden');
    }
    lastScrollTop = 0;
};

window.openViewer = window.openDocument;

function setViewerMode(mode, targetParagraph) {
    currentViewerMode = mode;
    const modal = document.getElementById('document-viewer');
    const bodyEl = document.getElementById('viewer-body');
    const headerEl = document.getElementById('viewer-header');
    const btnModePdf = document.getElementById('btn-mode-pdf');
    const btnModeText = document.getElementById('btn-mode-text');
    const copyBtn = document.getElementById('viewer-copy');

    if (btnModePdf) btnModePdf.classList.toggle('active', mode === 'pdf');
    if (btnModeText) btnModeText.classList.toggle('active', mode === 'text');
    if (modal) modal.classList.toggle('modal-wide', mode === 'pdf');
    if (copyBtn) copyBtn.style.display = mode === 'pdf' ? 'none' : '';

    const pdfPath = resolvePdfPath(currentViewerDoc);

    if (mode === 'pdf' && pdfPath) {
        if (bodyEl) {
            bodyEl.classList.add('pdf-active');
            bodyEl.scrollTop = 0;
            if (headerEl) headerEl.classList.remove('header-hidden');
            bodyEl.innerHTML = `
                <div class="ruhi-pdf-view-wrapper">
                    <iframe src="${pdfPath}#toolbar=1&navpanes=0" class="viewer-pdf-frame" title="${escapeHtml(currentViewerDoc.title || 'Original-PDF')}"></iframe>
                </div>
            `;
        }
    } else {
        if (bodyEl) {
            bodyEl.classList.remove('pdf-active');
            bodyEl.innerHTML = `
                <div class="viewer-reading-canvas" id="viewer-reading-canvas">
                    <p style="color:var(--text-muted);font-style:italic;text-align:center;padding:4rem 0;">Volltext wird geladen…</p>
                </div>
            `;
            renderDocumentText(currentViewerDoc, targetParagraph);
        }
    }
}

function renderDocumentText(doc, targetParagraph) {
    const canvas = document.getElementById('viewer-reading-canvas');
    if (!canvas || !doc) return;

    function render(text) {
        doc.text = text;
        const structure = parseDocumentStructure(text);
        doc.paragraphs = structure.body;

        let html = '';

        // 1. Schlanker, eleganter Vorspann (falls Institution, Datum, Empfaenger oder Anrede vorhanden)
        const instHeader = structure.headers.find(h => h.kind === 'institution');
        const dateHeader = structure.headers.find(h => h.kind === 'date');
        const addresseeHeader = structure.headers.find(h => h.kind === 'addressee');

        if (instHeader || dateHeader || addresseeHeader || structure.salutation) {
            html += '<header class="reader-prologue">';
            if (instHeader) {
                html += `<div class="reader-prologue-inst">${escapeHtml(instHeader.text)}</div>`;
            }
            if (dateHeader) {
                html += `<div class="reader-prologue-date">${escapeHtml(dateHeader.text)}</div>`;
            }
            if (addresseeHeader) {
                html += `<div class="reader-prologue-addressee">${escapeHtml(addresseeHeader.text)}</div>`;
            }
            if (structure.salutation) {
                html += `<div class="reader-prologue-salutation">${escapeHtml(structure.salutation)}</div>`;
            }
            html += '</header>';
        }

        // 2. Aufgeraeumte Absaetze mit Randnummer & unaufdringlicher Schwebepille
        html += structure.body.map((rawP, idx) => {
            const pNum = idx + 1;
            // Datenbank-Praefixe bereinigen (z.B. "1:1 ", "f.1:1 ", "0_1 ")
            const p = rawP.replace(/^(\d+(?:\.\d+)?:\d+(?:_\d+)?|f\.(?:\w+:)?\d+(?:_\d+)?|0_\d+)\s+/, '').trim();
            const originalParaUrl = getOriginalParagraphUrl(doc, pNum, p);

            return `
                <div class="viewer-paragraph" id="viewer-para-${pNum}" data-pnum="${pNum}">
                    <span class="para-gutter-num">${pNum}</span>
                    <p class="para-text">${escapeHtml(p)}</p>
                    <div class="para-hover-actions">
                        <a href="${escapeHtml(originalParaUrl)}" target="_blank" rel="noopener noreferrer" class="para-pill-btn" title="Diesen Absatz in der autorisierten Originalquelle im Web oeffnen">Original ↗</a>
                        <button class="para-pill-btn" onclick="window.copyParagraphCitation(${pNum})" title="Absatz samt formaler Quellenangabe kopieren">
                            <span id="para-copy-label-${pNum}">Zitieren</span>
                        </button>
                        <button class="para-pill-btn" onclick="window.copyParagraphDeepLink(${pNum})" title="Direktlink zu diesem Absatz im Archiv kopieren">
                            <span id="para-link-label-${pNum}">Link</span>
                        </button>
                        <button id="viewer-para-btn-${pNum}" onclick="window.addViewerParagraphToWorkshop(${pNum})" class="para-pill-btn btn-add-workshop" title="Diesen Absatz zur Kompilations-Werkstatt hinzufuegen">+ Werkstatt</button>
                    </div>
                </div>
            `;
        }).join('');

        // 3. Nachspann (Schlussformeln & Unterzeichner)
        if (structure.closings.length > 0) {
            html += `
                <footer class="reader-epilogue">
                    ${structure.closings.map(c => `<div>${escapeHtml(c)}</div>`).join('')}
                </footer>
            `;
        }

        // 4. Zurueckhaltender Herkunftshinweis
        const sourceName = doc.sourcePlatform || (doc.sourceUrl && doc.sourceUrl.includes('bibliothek.bahai.de') ? 'Bahá’í-Bibliothek Deutschland' : 'Bahá’í Reference Library');
        const sourceUrl = doc.sourceUrl || 'https://www.bahai.org/library/';
        html += `
            <div class="reader-footer-note">
                Autorisierte Publikation &bull; <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(sourceName)}</a>
            </div>
        `;

        canvas.innerHTML = html;

        // Wenn ein Zielabsatz uebergeben wurde, sanft hinscrollen & hervorheben
        if (targetParagraph) {
            setTimeout(() => {
                const targetEl = document.getElementById(`viewer-para-${targetParagraph}`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetEl.classList.add('highlight-target');
                    setTimeout(() => targetEl.classList.remove('highlight-target'), 3500);
                }
            }, 300);
        }
    }

    if (doc.text) {
        render(doc.text);
    } else if (doc.hasText !== false && doc.id) {
        const relUrl = `data/texts/${doc.id}.txt`;
        const absUrl = `/data/texts/${doc.id}.txt`;
        fetch(relUrl)
            .then(r => r.ok ? r.text() : fetch(absUrl).then(r2 => r2.ok ? r2.text() : Promise.reject('not found')))
            .then(text => render(text))
            .catch(() => {
                canvas.innerHTML = '<p style="color:var(--text-muted);font-style:italic;text-align:center;padding:4rem 0;">Kein Volltext verfuegbar.</p>';
            });
    } else {
        canvas.innerHTML = '<p style="color:var(--text-muted);font-style:italic;text-align:center;padding:4rem 0;">Kein Volltext hinterlegt.</p>';
    }
}

function detectHeaderKind(b, idx) {
    if (idx > 7) return null;
    const bl = b.toLowerCase().trim();
    
    // 1. Institution
    if (
        /universal(e|es)?\s+haus\s+der\s+gerechtigkeit/i.test(bl) ||
        /universal\s+house\s+of\s+justice/i.test(bl) ||
        /international(es)?\s+lehrzentrum/i.test(bl) ||
        /international\s+teaching\s+centre/i.test(bl) ||
        /bahá[’']í\s+world\s+centre/i.test(bl) ||
        /bahá[’']í-weltzentrum/i.test(bl) ||
        /department\s+of\s+the\s+secretariat/i.test(bl)
    ) {
        return 'institution';
    }
    
    // 2. Datum
    const months = /(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|january|february|march|april|may|june|july|august|september|october|november|december|riḍván|ridvan|naw-rúz|naw-ruz)/i;
    if (b.length < 90) {
        if (months.test(bl) && (/\d{4}/.test(bl) || /\b(1[5-9]\d|2\d\d)\b/.test(bl))) {
            return 'date';
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(b.trim())) {
            return 'date';
        }
        if (/^\d{1,2}\.?\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(bl)) {
            return 'date';
        }
    }
    
    // 3. Adressat
    if (b.length < 220) {
        if (/^(an\s+|to\s+)/i.test(bl)) {
            return 'addressee';
        }
        if (
            bl.includes('to the bahá') || bl.includes('an die bahá') ||
            bl.includes('to all national') || bl.includes('an alle nationalen') ||
            bl.includes('to national spiritual') || bl.includes('an die nationalen') ||
            bl.includes('to the continental') || bl.includes('an die kontinentalen') ||
            bl.includes('to the friends gathered') || bl.includes('an die freunde') ||
            bl.includes('to the conference') || bl.includes('an die konferenz') ||
            bl.includes('to the believers') || bl.includes('an die gläubigen') ||
            bl.includes('to an individual') || bl.includes('an einen gläubigen')
        ) {
            return 'addressee';
        }
    }
    
    // 4. Anrede
    if (b.length < 130) {
        const salutations = [
            'innig geliebte freunde', 'dearly loved friends', 'liebe bahá', 'dear bahá',
            'liebe freunde', 'dear friends', 'lieber bahá', 'dear brother', 'dear sister',
            'sehr geehrte freunde', 'wertgeschätzte freunde', 'hochgeschätzte freunde',
            'dear friend', 'lieber freund', 'liebe mitgläubige'
        ];
        if (salutations.some(s => bl.includes(s))) {
            return 'salutation';
        }
        if ((b.endsWith(',') || b.endsWith('!') || b.endsWith(':')) &&
            (bl.includes('freund') || bl.includes('friend') || bl.includes('brother') || bl.includes('sister') || bl.includes('all'))) {
            return 'salutation';
        }
    }
    
    // 5. Metadaten / Uebersetzung
    if (b.length < 180 && (
        bl.includes('[authorized translation') || bl.includes('[autorisierte übersetzung') ||
        bl.includes('[übersetzung aus dem') || bl.includes('betrifft:') ||
        bl.includes('regarding:') || bl.includes('subject:') || bl.includes('memorandum') ||
        bl.startsWith('to: ') || bl.startsWith('from: ') || bl.startsWith('date: ') || bl.startsWith('message:')
    )) {
        return 'meta';
    }
    
    return null;
}

function isClosingBlock(b) {
    if (b.length > 180) return false;
    const bl = b.toLowerCase().trim();
    if (
        bl.includes('mit herzlichen bahá') || bl.includes('with loving bahá') ||
        bl.includes('warmest bahá') || bl.includes('loving greetings') ||
        bl.includes('in herzlicher verbundenheit') || bl.includes('with warm bahá') ||
        bl.includes('mit herzlichen grüßen') || bl.includes('with warmest bahá')
    ) {
        return true;
    }
    if (
        bl.includes('[das universale haus der gerechtigkeit]') || bl.includes('[the universal house of justice]') ||
        bl.includes('das universale haus der gerechtigkeit') || bl.includes('the universal house of justice') ||
        bl.includes('[gez. universales haus') || bl.includes('[signed: the universal') ||
        bl.includes('[gez.: das universale') || bl.includes('[signed: universal')
    ) {
        return true;
    }
    return false;
}

function parseDocumentStructure(text) {
    const rawBlocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const headers = [];
    let salutation = null;
    const body = [];
    const closings = [];
    
    let inHead = true;
    for (let i = 0; i < rawBlocks.length; i++) {
        const b = rawBlocks[i];
        if (/^f\.tp:\d*\s*$/.test(b) || /^\*\s*\*\s*\*$/.test(b)) {
            continue;
        }
        if (inHead && i < 8) {
            const kind = detectHeaderKind(b, i);
            if (kind) {
                if (kind === 'salutation') {
                    salutation = b;
                    inHead = false;
                } else {
                    headers.push({ text: b, kind: kind });
                }
                continue;
            } else {
                inHead = false;
            }
        }
        body.push(b);
    }
    
    while (body.length > 0 && isClosingBlock(body[body.length - 1])) {
        closings.unshift(body.pop());
    }

    if (!salutation && body.length > 0) {
        const m = body[0].match(/^(innig\s+g?\s*eliebte\s+freunde|dearly\s+loved\s+friends|liebe\s+freunde|dear\s+friends|liebe\s+bah[áa]’?[íi]|dear\s+bah[áa]’?[íi]|dear\s+friend|lieber\s+freund|liebe\s+mitgläubige)[,:\s]+(.*)$/is);
        if (m) {
            salutation = m[1] + ',';
            body[0] = m[2].trim();
        }
    }
    
    if (body.length === 0 && rawBlocks.length > 0) {
        body.push(rawBlocks[rawBlocks.length - 1]);
    }
    
    return { headers, salutation, body, closings };
}

function getOriginalParagraphUrl(doc, pNum, paraText) {
    if (!doc || !doc.sourceUrl) return 'https://www.bahai.org/library/';
    const base = doc.sourceUrl.split('#')[0];
    
    // W3C Text Fragment Standard: #:~:text=...
    const cleanText = (paraText || '')
        .replace(/["'„“»«\(\)\.,;:!?]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 7)
        .join(' ');

    if (cleanText && cleanText.length > 5) {
        const textFrag = encodeURIComponent(cleanText);
        return `${base}#:~:text=${textFrag}`;
    }
    return `${base}#p${pNum}`;
}

window.copyParagraphCitation = function(pNum) {
    if (!currentViewerDoc || !currentViewerDoc.paragraphs) return;
    const pText = currentViewerDoc.paragraphs[pNum - 1] || '';
    if (!pText) return;

    const sourceUrl = getOriginalParagraphUrl(currentViewerDoc, pNum, pText);
    const dateFormatted = formatViewerDate(currentViewerDoc.date);
    const platform = currentViewerDoc.sourcePlatform || 'Bahá’í Reference Library';
    const author = currentViewerDoc.author || 'Universales Haus der Gerechtigkeit';
    
    const citation = `„${pText}“\n\n— ${author}\nDokument: ${currentViewerDoc.title}${dateFormatted ? ' (' + dateFormatted + ')' : ''}\nAbsatz: Abs. ${pNum}\nAutorisierte Originalquelle (${platform}): ${sourceUrl}`;

    navigator.clipboard.writeText(citation).then(() => {
        const label = document.getElementById(`para-copy-label-${pNum}`);
        if (label) {
            const orig = label.innerHTML;
            label.innerHTML = 'Kopiert!';
            setTimeout(() => { label.innerHTML = orig; }, 2000);
        }
    }).catch(err => {
        console.error('Kopieren fehlgeschlagen:', err);
    });
};

window.copyParagraphDeepLink = function(pNum) {
    if (!currentViewerDoc) return;
    const url = `${window.location.origin}${window.location.pathname}#doc=${encodeURIComponent(currentViewerDoc.id)}&p=${pNum}`;
    navigator.clipboard.writeText(url).then(() => {
        const label = document.getElementById(`para-link-label-${pNum}`);
        if (label) {
            const orig = label.innerHTML;
            label.innerHTML = 'Kopiert!';
            setTimeout(() => { label.innerHTML = orig; }, 2000);
        }
    }).catch(err => {
        console.error('Link-Kopieren fehlgeschlagen:', err);
    });
};

window.addViewerParagraphToWorkshop = function(paraIdx) {
    if (!currentViewerDoc || !currentViewerDoc.text) return;
    const structure = parseDocumentStructure(currentViewerDoc.text);
    const pText = structure.body[paraIdx - 1];
    if (!pText) return;

    if (window.CompilationBuilder && window.CompilationBuilder.addPassageFromViewer) {
        window.CompilationBuilder.addPassageFromViewer(currentViewerDoc, pText.trim(), paraIdx);
        const btn = document.getElementById(`viewer-para-btn-${paraIdx}`);
        if (btn) {
            btn.innerHTML = 'Im Entwurf';
            btn.style.background = 'var(--color-accent-light)';
            btn.style.color = 'var(--color-primary)';
            btn.style.borderColor = 'var(--color-accent)';
        }
    } else {
        alert('Kompilations-Werkstatt ist noch nicht bereit.');
    }
};

function formatViewerDate(dateString) {
    if (!dateString) return 'Undatiert';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    return dateString;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
