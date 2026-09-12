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

function getStoredDefaultViewerMode() {
    try {
        if (typeof window.safeGetStorage === 'function') {
            return window.safeGetStorage('cosmos_default_viewer_mode', 'pdf');
        }
        const val = localStorage.getItem('cosmos_default_viewer_mode');
        return val !== null ? val : 'pdf';
    } catch (e) {
        return 'pdf';
    }
}

window.initViewer = function() {
    const modal = document.getElementById('document-viewer');
    const headerEl = document.getElementById('viewer-header');
    const bodyEl = document.getElementById('viewer-body');
    const topTrigger = document.getElementById('viewer-top-trigger');
    const closeBtn = document.getElementById('viewer-close');
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    const copyBtn = document.getElementById('viewer-copy');
    const btnModePdf = document.getElementById('btn-mode-pdf');
    const btnModeWeb = document.getElementById('btn-mode-web');
    const btnModeText = document.getElementById('btn-mode-text');
    const btnLangDe = document.getElementById('btn-viewer-lang-de');
    const btnLangEn = document.getElementById('btn-viewer-lang-en');
    const exportBtn = document.getElementById('viewer-export-btn');
    const exportMenu = document.getElementById('viewer-export-menu');
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
            if (!currentViewerDoc) return;
            const textToCopy = currentViewerDoc.text;
            if (!textToCopy) return;
            navigator.clipboard.writeText(textToCopy).then(() => {
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

    // 4. Modus-Umschaltung: Fließtext vs. Original-PDF
    if (btnModePdf) {
        btnModePdf.addEventListener('click', () => setViewerMode('pdf'));
    }
    if (btnModeWeb) {
        btnModeWeb.addEventListener('click', () => setViewerMode('web'));
    }
    if (btnModeText) {
        btnModeText.addEventListener('click', () => setViewerMode('text'));
    }

    // 5. Download- & Export-Dropdown öffnen/schließen
    const exportWrapper = document.getElementById('viewer-export-dropdown-wrapper');

    if (exportBtn && exportMenu) {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = exportBtn.getAttribute('aria-expanded') === 'true';
            exportMenu.hidden = isExpanded;
            exportBtn.setAttribute('aria-expanded', !isExpanded);
        });

        document.addEventListener('click', (e) => {
            if (exportWrapper && !exportWrapper.contains(e.target)) {
                exportMenu.hidden = true;
                exportBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 6. Sprach-Umschaltung: DE vs. EN
    if (btnLangDe) {
        btnLangDe.addEventListener('click', () => {
            if (!currentViewerDoc) return;
            const isDe = (currentViewerDoc.language || '').toLowerCase() === 'deutsch' || (currentViewerDoc.language || '').toLowerCase() === 'german';
            if (isDe) return;
            const deId = getCounterpartDocId(currentViewerDoc, 'de');
            if (deId) {
                const curPara = getCurrentVisibleParagraph();
                window.openDocument(deId, curPara, currentViewerMode, 'de');
            }
        });
    }
    if (btnLangEn) {
        btnLangEn.addEventListener('click', () => {
            if (!currentViewerDoc) return;
            const isDe = (currentViewerDoc.language || '').toLowerCase() === 'deutsch' || (currentViewerDoc.language || '').toLowerCase() === 'german';
            if (!isDe) return;
            const enId = getCounterpartDocId(currentViewerDoc, 'en');
            if (enId) {
                const curPara = getCurrentVisibleParagraph();
                window.openDocument(enId, curPara, currentViewerMode, 'en');
            }
        });
    }

    // 7. Wegklappender Header beim Hinabscrollen & Lese-Fortschritt
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

    // 8. Unsichtbare Trigger-Zone am oberen Rand: Mausberuehrung blendet Header sofort wieder ein
    if (topTrigger && headerEl) {
        topTrigger.addEventListener('mouseenter', () => {
            headerEl.classList.remove('header-hidden');
        });
        topTrigger.addEventListener('click', () => {
            headerEl.classList.remove('header-hidden');
        });
    }

    // 9. Klick auf Hintergrund schliesst Modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeViewer();
            }
        });
    }

    // 10. Tastatur-Kuerzel Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (exportMenu && !exportMenu.hidden) {
                exportMenu.hidden = true;
                if (exportBtn) exportBtn.setAttribute('aria-expanded', 'false');
                e.stopPropagation();
                return;
            }
            if (modal && modal.classList.contains('active')) {
                closeViewer();
            }
        }
    });

    // 11. Mobile Bottom Sheet Touch-Gesten (Apple Fluid Swipe-to-Dismiss)
    setupMobileSheetGestures();
};

function setupMobileSheetGestures() {
    const modal = document.getElementById('document-viewer');
    if (!modal) return;
    const modalContent = modal.querySelector('.modal-content');
    const dragHandle = document.getElementById('viewer-drag-handle');
    const header = document.getElementById('viewer-header');
    const body = document.getElementById('viewer-body');
    if (!modalContent) return;

    let startY = 0;
    let startX = 0;
    let currentDeltaY = 0;
    let isDragging = false;
    let canDrag = false;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;

    function onTouchStart(e) {
        if (!modal.classList.contains('active')) return;
        if (window.innerWidth > 768) return;

        const touch = e.touches[0];
        startY = touch.clientY;
        startX = touch.clientX;
        lastY = startY;
        lastTime = Date.now();
        velocityY = 0;
        currentDeltaY = 0;
        isDragging = false;

        const isHandle = dragHandle && (e.target === dragHandle || dragHandle.contains(e.target));
        const isHeader = header && (e.target === header || header.contains(e.target)) && !e.target.closest('button, a, input, select');
        const isBodyAtTop = body && (e.target === body || body.contains(e.target)) && body.scrollTop <= 2;

        canDrag = isHandle || isHeader || isBodyAtTop;
    }

    function onTouchMove(e) {
        if (!canDrag) return;
        const touch = e.touches[0];
        const dy = touch.clientY - startY;
        const dx = touch.clientX - startX;

        if (!isDragging) {
            if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
                if (dy > 0 || (dragHandle && dragHandle.contains(e.target))) {
                    isDragging = true;
                    modalContent.style.transition = 'none';
                }
            }
        }

        if (isDragging) {
            if (e.cancelable && dy > 0) {
                e.preventDefault();
            }
            const now = Date.now();
            const dt = now - lastTime;
            if (dt > 10) {
                velocityY = (touch.clientY - lastY) / dt;
                lastY = touch.clientY;
                lastTime = now;
            }

            currentDeltaY = dy;
            if (dy > 0) {
                modalContent.style.transform = `translateY(${dy}px)`;
            } else {
                const damped = dy * 0.22;
                modalContent.style.transform = `translateY(${damped}px)`;
            }
        }
    }

    function onTouchEnd() {
        if (!canDrag && !isDragging) return;
        canDrag = false;

        if (isDragging) {
            isDragging = false;
            const shouldDismiss = currentDeltaY > 120 || (currentDeltaY > 45 && velocityY > 0.38);

            if (shouldDismiss) {
                modalContent.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out';
                modalContent.style.transform = 'translateY(100%)';
                modal.style.transition = 'background-color 0.25s ease-out';
                modal.style.backgroundColor = 'transparent';

                setTimeout(() => {
                    closeViewer();
                    modalContent.style.transition = '';
                    modalContent.style.transform = '';
                    modal.style.transition = '';
                    modal.style.backgroundColor = '';
                }, 260);
            } else {
                modalContent.style.transition = 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
                modalContent.style.transform = 'translateY(0)';
                setTimeout(() => {
                    modalContent.style.transition = '';
                    modalContent.style.transform = '';
                }, 300);
            }
        }
    }

    modal.addEventListener('touchstart', onTouchStart, { passive: true });
    modal.addEventListener('touchmove', onTouchMove, { passive: false });
    modal.addEventListener('touchend', onTouchEnd, { passive: true });
    modal.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

function closeViewer() {
    const modal = document.getElementById('document-viewer');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.body.classList.remove('viewer-open');
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transition = '';
            modalContent.style.transform = '';
        }
        modal.style.transition = '';
        modal.style.backgroundColor = '';
    }
    if (window.location.hash && window.location.hash.includes('doc=')) {
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
}
window.closeViewer = closeViewer;
window.closeDocumentViewer = closeViewer;

function updateBookmarkBtnState(id) {
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    if (!bookmarkBtn) return;
    if (bookmarkBtn.dataset) {
        bookmarkBtn.dataset.id = id;
    } else {
        bookmarkBtn.setAttribute('data-id', id);
    }
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
    const clean = (p) => p ? String(p).replace(/^\.\.\//, '') : null;
    if (doc.formatFiles && doc.formatFiles.pdf) {
        return clean(doc.formatFiles.pdf);
    }
    if (doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf')) {
        return clean(doc.filePath);
    }
    if (doc.tier === 'books' || doc.tier === 'ruhi') {
        return null;
    }
    if (doc.id) {
        return `documents/formats/pdf/${doc.id}.pdf`;
    }
    return null;
}
window.resolvePdfPath = resolvePdfPath;

function resolveEpubPath(doc) {
    if (!doc) return null;
    if (doc.filePath && doc.filePath.toLowerCase().endsWith('.epub')) {
        return doc.filePath.replace(/^\.\.\//, '');
    }
    if (doc.formatFiles && doc.formatFiles.epub) {
        return doc.formatFiles.epub.replace(/^\.\.\//, '');
    }
    if (doc.id) {
        return `documents/formats/epub/${doc.id}.epub`;
    }
    return null;
}
window.resolveEpubPath = resolveEpubPath;

function getDocOriginalFormat(doc) {
    if (!doc) return 'PDF';
    const fp = (doc.filePath || '').toLowerCase();
    const ofn = (doc.originalFilename || '').toLowerCase();
    
    if (doc.tier === 'books' || doc.tier === 'ruhi') {
        return 'PDF';
    }
    if (fp.endsWith('.pdf') || ofn.endsWith('.pdf')) {
        return 'PDF';
    }
    if (fp.endsWith('.epub') || ofn.endsWith('.epub')) {
        return 'EPUB';
    }
    if (doc.sourceUrl) {
        return 'Webseite';
    }
    return 'PDF';
}
window.getDocOriginalFormat = getDocOriginalFormat;

function getCounterpartDocId(doc, targetLang) {
    if (!doc) return null;
    if (doc.translations && doc.translations[targetLang]) {
        return doc.translations[targetLang];
    }
    if (doc.groupId && window.state && Array.isArray(window.state.documents)) {
        const counterpart = window.state.documents.find(d => {
            if (d.groupId !== doc.groupId) return false;
            const l = (d.language || '').toLowerCase();
            return targetLang === 'de' ? (l === 'deutsch' || l === 'german') : (l === 'english');
        });
        if (counterpart) return counterpart.id;
    }
    return null;
}
window.getCounterpartDocId = getCounterpartDocId;

function getCurrentVisibleParagraph() {
    const bodyEl = document.getElementById('viewer-body');
    if (!bodyEl) return null;
    const paras = bodyEl.querySelectorAll('.viewer-paragraph[data-pnum]');
    const bodyTop = bodyEl.getBoundingClientRect().top;
    for (const p of paras) {
        const rect = p.getBoundingClientRect();
        if (rect.bottom > bodyTop + 60) {
            const pNum = parseInt(p.getAttribute('data-pnum'), 10);
            if (!isNaN(pNum)) return pNum;
        }
    }
    return null;
}
window.getCurrentVisibleParagraph = getCurrentVisibleParagraph;

window.openDocument = function(id, targetParagraph, preferredMode, preferredLang) {
    if (!id) return;
    if (!window.state || !window.state.documents || window.state.documents.length === 0) {
        setTimeout(() => {
            if (typeof window.openDocument === 'function') {
                window.openDocument(id, targetParagraph, preferredMode, preferredLang);
            }
        }, 120);
        return;
    }

    if (window.state.idAliases && window.state.idAliases[id]) {
        id = window.state.idAliases[id];
    }

    let targetId = id;
    const initialDoc = window.state.documents.find(d => d.id === id);
    if (preferredLang && initialDoc && initialDoc.translations && initialDoc.translations[preferredLang]) {
        targetId = initialDoc.translations[preferredLang];
    }
    const doc = window.state.documents.find(d => d.id === targetId) || initialDoc;
    if (!doc) return;

    currentViewerDoc = doc;

    try {
        if (typeof window.recordReadingHistory === 'function') {
            window.recordReadingHistory(doc);
        }
    } catch (e) {}

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
    const isEn = (window.I18n && typeof window.I18n.getCurrentLanguage === 'function')
        ? window.I18n.getCurrentLanguage() === 'en'
        : ((window.I18n && typeof window.I18n.getLanguage === 'function')
            ? window.I18n.getLanguage() === 'en'
            : (localStorage.getItem('cosmos_master_lang') === 'en'));
    const isRuhi = doc.tier === 'ruhi' || doc.type === 'Ruhi-Buch' || 
                   (doc.title && (doc.title.startsWith('Ruhi Buch') || doc.title.startsWith('Ruhi Book')));

    if (typeBadge) {
        if (isRuhi) {
            typeBadge.textContent = isEn ? 'Ruhi Institute' : 'Ruhi-Institut';
        } else if (isEn) {
            if (doc.type === 'Botschaft' || !doc.type) typeBadge.textContent = 'Message';
            else if (doc.type === 'Buch') typeBadge.textContent = 'Book';
            else if (doc.type === 'Kompilation') typeBadge.textContent = 'Compilation';
            else typeBadge.textContent = doc.type;
        } else {
            typeBadge.textContent = doc.type || 'Botschaft';
        }
    }
    if (metaDate) {
        if (isRuhi) {
            metaDate.textContent = isEn ? 'Ruhi Institute Study Material' : 'Studienmaterial des Ruhi-Instituts';
        } else if (doc.tier === 'compilations' || doc.type === 'Kompilation') {
            metaDate.textContent = isEn ? 'Thematic Compilation' : 'Thematische Textsammlung';
        } else if (doc.tier === 'books' && doc.year) {
            metaDate.textContent = doc.year;
        } else if (doc.date) {
            metaDate.textContent = formatViewerDate(doc.date);
        } else {
            metaDate.textContent = '';
        }
    }
    if (metaSource) {
        if (isRuhi) {
            metaSource.textContent = 'Ruhi-Institut';
        } else if (doc.tier === 'compilations' || doc.type === 'Kompilation') {
            metaSource.textContent = isEn ? 'Research Department' : 'Forschungsabteilung';
        } else {
            metaSource.textContent = doc.source || 'UHG';
        }
    }
    if (titleEl) {
        titleEl.textContent = doc.title || (isEn ? 'Untitled' : 'Ohne Titel');
        titleEl.title = doc.title || '';
    }

    // PDF- und EPUB-Pfade ermitteln
    const pdfPath = resolvePdfPath(doc);
    const epubPath = resolveEpubPath(doc);
    const origFmt = getDocOriginalFormat(doc);

    // Originalformat-Anzeige oben in der Metazeile
    const origTextEl = document.getElementById('viewer-meta-orig-text');
    if (origTextEl) {
        origTextEl.textContent = `Original: ${origFmt}`;
    }

    // Layout-Modus Buttons (Fließtext vs. Original-PDF)
    const btnModePdf = document.getElementById('btn-mode-pdf');
    const btnModeWeb = document.getElementById('btn-mode-web');
    const btnModeText = document.getElementById('btn-mode-text');

    if (btnModeText) btnModeText.style.display = 'inline-flex';
    if (btnModePdf) {
        btnModePdf.style.display = pdfPath ? 'inline-flex' : 'none';
    }
    if (btnModeWeb) {
        // Anzeigen, sobald eine externe Quelle (BRL oder Bahá'í-Bibliothek) hinterlegt ist
        btnModeWeb.style.display = doc.sourceUrl ? 'inline-flex' : 'none';
        if (doc.sourceUrl) {
            const isBrl = doc.sourceUrl.includes('bahai.org') || (doc.sourcePlatform && doc.sourcePlatform.includes('Reference Library'));
            if (isBrl) {
                btnModeWeb.textContent = 'Reference Library';
                btnModeWeb.title = 'In der Bahá’í Reference Library Ansicht öffnen';
            } else if (doc.sourceUrl.includes('bibliothek.bahai.de')) {
                btnModeWeb.textContent = 'Webseite';
                btnModeWeb.title = 'Original-Webseite (Bahá’í-Bibliothek) aufrufen';
            } else {
                btnModeWeb.textContent = 'Webseite';
                btnModeWeb.title = 'Original-Webseite aufrufen';
            }
        }
    }

    if (modePill) {
        modePill.style.display = 'inline-flex';
    }

    // Standard-Leseformat gemaess Benutzereinstellung (Original-PDF, Fliesstext, Webseite, Automatisch)
    let targetMode = (preferredMode === 'split') ? 'text' : preferredMode;
    const isMobile = (window.innerWidth <= 768) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!targetMode) {
        if (targetParagraph) {
            targetMode = 'text';
        } else if (isMobile) {
            // Auf Mobilgeraeten: IMMER Fliesstext als Standard, da iOS Safari & Android Chrome keine PDFs in Iframes unterstuetzen
            targetMode = 'text';
        } else {
            const defaultFmt = getStoredDefaultViewerMode();
            if (defaultFmt === 'pdf') {
                if (pdfPath) {
                    targetMode = 'pdf';
                } else if (doc.sourceUrl) {
                    targetMode = 'web';
                } else {
                    targetMode = 'text';
                }
            } else if (defaultFmt === 'text') {
                targetMode = 'text';
            } else if (defaultFmt === 'web') {
                if (doc.sourceUrl) {
                    targetMode = 'web';
                } else if (pdfPath) {
                    targetMode = 'pdf';
                } else {
                    targetMode = 'text';
                }
            } else if (defaultFmt === 'auto') {
                if (origFmt === 'PDF' && pdfPath) {
                    targetMode = 'pdf';
                } else if (origFmt === 'Webseite') {
                    if (doc.sourceUrl && doc.sourceUrl.includes('bibliothek.bahai.de')) {
                        targetMode = 'web';
                    } else if (pdfPath) {
                        targetMode = 'pdf';
                    } else {
                        targetMode = 'text';
                    }
                } else if (pdfPath) {
                    targetMode = 'pdf';
                } else {
                    targetMode = 'text';
                }
            } else {
                targetMode = pdfPath ? 'pdf' : 'text';
            }
        }
    }

    // Sprach-Pill (DE / EN)
    const hasBothLangs = (doc.availableLanguages && doc.availableLanguages.includes('de') && doc.availableLanguages.includes('en')) ||
                         (doc.translations && doc.translations.de && doc.translations.en);
    if (langPill) {
        if (hasBothLangs) {
            langPill.style.display = 'inline-flex';
            const isDe = (doc.language || '').toLowerCase() === 'deutsch' || (doc.language || '').toLowerCase() === 'german';
            if (btnLangDe) btnLangDe.classList.toggle('active', isDe);
            if (btnLangEn) btnLangEn.classList.toggle('active', !isDe);
        } else {
            langPill.style.display = 'none';
        }
    }

    // Aufgeräumtes Download- & Export-Menü befüllen
    const exportBtn = document.getElementById('viewer-export-btn');
    const exportMenu = document.getElementById('viewer-export-menu');
    if (exportMenu) {
        exportMenu.hidden = true;
        if (exportBtn) exportBtn.setAttribute('aria-expanded', 'false');

        const files = doc.formatFiles || {};
        const pdfHref = (doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf')) ? doc.filePath : (files.pdf || pdfPath);
        const epubHref = (doc.filePath && doc.filePath.toLowerCase().endsWith('.epub')) ? doc.filePath : (files.epub || epubPath);
        const docxHref = (doc.filePath && doc.filePath.toLowerCase().endsWith('.docx')) ? doc.filePath : files.docx;

        let menuHtml = '';
        menuHtml += '<div class="export-menu-header">Herunterladen &amp; Export</div>';

        if (pdfHref) {
            menuHtml += `
                <a href="${escapeHtml(pdfHref)}" download class="export-menu-item" title="Original-PDF herunterladen">
                    <div class="export-item-content">
                        <span class="export-item-title">Original-PDF (.pdf)</span>
                        <span class="export-item-sub">Offizielles Layout &amp; Druckfassung</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
            `;
        }

        if (epubHref) {
            menuHtml += `
                <a href="${escapeHtml(epubHref)}" download class="export-menu-item" title="E-Book im EPUB-Format herunterladen">
                    <div class="export-item-content">
                        <span class="export-item-title">E-Book (.epub)</span>
                        <span class="export-item-sub">Für Apple Books, Tolino, Kindle</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
            `;
        }

        if (docxHref) {
            menuHtml += `
                <a href="${escapeHtml(docxHref)}" download class="export-menu-item" title="Word-Dokument herunterladen">
                    <div class="export-item-content">
                        <span class="export-item-title">Word-Dokument (.docx)</span>
                        <span class="export-item-sub">Bearbeitbare Textdatei</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </a>
            `;
        }

        if (doc.sourceUrl) {
            menuHtml += `
                <div class="export-menu-divider"></div>
                <a href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="export-menu-item external" title="Dokument auf offizieller Quelle im Web öffnen">
                    <div class="export-item-content">
                        <span class="export-item-title">Im Web aufrufen ↗</span>
                        <span class="export-item-sub">${escapeHtml(doc.sourcePlatform || 'Autorisierte Online-Quelle')}</span>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
            `;
        }

        exportMenu.innerHTML = menuHtml;
    }

    // Lesezeichen-Zustand aktualisieren
    updateBookmarkBtnState(doc.id);

    setViewerMode(targetMode, targetParagraph);

    // Modal anzeigen & Header zuruecksetzen
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('viewer-open');
    }
    if (headerEl) {
        headerEl.classList.remove('header-hidden');
    }
    lastScrollTop = 0;
    if (window.I18n && window.I18n.applyToDOM && modal) {
        window.I18n.applyToDOM(modal);
    }
};

window.openViewer = window.openDocument;

function setViewerMode(mode, targetParagraph) {
    if (mode === 'split') mode = 'text';
    currentViewerMode = mode;
    const modal = document.getElementById('document-viewer');
    const bodyEl = document.getElementById('viewer-body');
    const headerEl = document.getElementById('viewer-header');
    const btnModePdf = document.getElementById('btn-mode-pdf');
    const btnModeWeb = document.getElementById('btn-mode-web');
    const btnModeEpub = document.getElementById('btn-mode-epub');
    const btnModeText = document.getElementById('btn-mode-text');
    const btnLangDe = document.getElementById('btn-viewer-lang-de');
    const btnLangEn = document.getElementById('btn-viewer-lang-en');
    const copyBtn = document.getElementById('viewer-copy');

    if (btnModePdf) btnModePdf.classList.toggle('active', mode === 'pdf');
    if (btnModeWeb) btnModeWeb.classList.toggle('active', mode === 'web');
    if (btnModeEpub) btnModeEpub.classList.toggle('active', mode === 'epub');
    if (btnModeText) btnModeText.classList.toggle('active', mode === 'text');

    if (btnLangDe) {
        const isDe = currentViewerDoc && ((currentViewerDoc.language || '').toLowerCase() === 'deutsch' || (currentViewerDoc.language || '').toLowerCase() === 'german');
        btnLangDe.classList.toggle('active', isDe);
    }
    if (btnLangEn) {
        const isDe = currentViewerDoc && ((currentViewerDoc.language || '').toLowerCase() === 'deutsch' || (currentViewerDoc.language || '').toLowerCase() === 'german');
        btnLangEn.classList.toggle('active', !isDe);
    }
    
    if (modal) modal.classList.toggle('modal-wide', mode === 'pdf' || mode === 'web');
    if (copyBtn) copyBtn.style.display = (mode === 'text') ? '' : 'none';

    const pdfPath = resolvePdfPath(currentViewerDoc);
    const epubPath = resolveEpubPath(currentViewerDoc);
    const isMobile = (window.innerWidth <= 768) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (mode === 'pdf' && pdfPath) {
        if (bodyEl) {
            bodyEl.classList.add('pdf-active');
            bodyEl.scrollTop = 0;
            if (headerEl) headerEl.classList.remove('header-hidden');

            if (isMobile) {
                bodyEl.innerHTML = `
                    <div class="mobile-pdf-container">
                        <div class="mobile-pdf-card">
                            <div class="mobile-pdf-icon-badge">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            </div>
                            <h3 class="mobile-pdf-title">${escapeHtml(currentViewerDoc.title || 'Original-PDF')}</h3>
                            <p class="mobile-pdf-desc">Offizielles PDF-Dokument im Bahá’í-Satzspiegel.</p>
                            <div class="mobile-pdf-actions">
                                <a href="${pdfPath}" target="_blank" rel="noopener" class="mobile-pdf-btn primary">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    In PDF-Viewer öffnen
                                </a>
                                <a href="${pdfPath}" download class="mobile-pdf-btn secondary">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    PDF herunterladen
                                </a>
                                <button onclick="setViewerMode('text')" class="mobile-pdf-btn text-fallback">
                                    Stattdessen als Fließtext lesen
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                bodyEl.innerHTML = `
                    <div class="pdf-viewer-wrapper">
                        <iframe src="${pdfPath}#toolbar=1&navpanes=0&view=FitH" class="pdf-viewer-frame" title="PDF Ansicht"></iframe>
                    </div>
                `;
            }
        }
    } else if (mode === 'web' && currentViewerDoc.sourceUrl) {
        if (bodyEl) {
            bodyEl.classList.remove('pdf-active');
            bodyEl.scrollTop = 0;
            if (headerEl) headerEl.classList.remove('header-hidden');

            const isBrl = currentViewerDoc.sourceUrl.includes('bahai.org') || (currentViewerDoc.sourcePlatform && currentViewerDoc.sourcePlatform.includes('Reference Library'));
            const sourceLabel = isBrl ? "Bahá'í Reference Library" : "Bahá'í-Bibliothek";
            const domain = (() => { try { return new URL(currentViewerDoc.sourceUrl).hostname.replace('www.', ''); } catch(e) { return ''; } })();

            bodyEl.innerHTML = `
                <div class="web-open-card">
                    <div class="web-open-card-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <div class="web-open-card-badge">Offizielle Quelle · ${escapeHtml(domain)}</div>
                    <h3 class="web-open-card-title">${escapeHtml(currentViewerDoc.title || 'Originaldokument')}</h3>
                    <p class="web-open-card-desc">Dieses Dokument ist auf <strong>${escapeHtml(sourceLabel)}</strong> veröffentlicht. Externer Inhalt kann nicht direkt eingebettet werden.</p>
                    <div class="web-open-card-actions">
                        <a href="${escapeHtml(currentViewerDoc.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="web-open-card-btn primary">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Original-Webseite öffnen
                        </a>
                        ${pdfPath ? `<button class="web-open-card-btn secondary" onclick="setViewerMode('pdf')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Als PDF lesen
                        </button>` : ''}
                        <button class="web-open-card-btn secondary" onclick="setViewerMode('text')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                            Als Fließtext lesen
                        </button>
                    </div>
                </div>
            `;
        }
    } else if (mode === 'epub') {
        if (bodyEl) {
            bodyEl.classList.remove('pdf-active');
            bodyEl.scrollTop = 0;
            if (headerEl) headerEl.classList.remove('header-hidden');
            bodyEl.innerHTML = `
                <div style="max-width: 780px; margin: 3rem auto; padding: 2.5rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; text-align: center;">
                    <span class="doc-origin-tag" style="display: inline-block; margin-bottom: 0.75rem;">Original-E-Book (EPUB)</span>
                    <h3 style="font-family: var(--font-serif-display); font-size: 1.6rem; margin-bottom: 0.75rem; color: var(--text-primary);">${escapeHtml(currentViewerDoc.title)}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.6;">
                        Offizielles E-Book im Standardformat EPUB. Kompatibel mit Apple Books, Tolino, PocketBook, Kobo und Kindle.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                        <a href="${epubPath}" download class="btn-primary" style="padding: 0.65rem 1.4rem; text-decoration: none; font-weight: 600;">
                            EPUB herunterladen
                        </a>
                        ${pdfPath ? `<button class="btn-secondary" onclick="setViewerMode('pdf')" style="padding: 0.65rem 1.2rem;">Als Original-PDF öffnen</button>` : ''}
                        <button class="btn-secondary" onclick="setViewerMode('text')" style="padding: 0.65rem 1.2rem;">Als Fließtext lesen</button>
                    </div>
                </div>
            `;
        }
    } else {
        // mode === 'text'
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

function renderSplitBilingualText(doc, targetParagraph) {
    renderDocumentText(doc, targetParagraph);
}
window.renderSplitBilingualText = renderSplitBilingualText;

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

            // Suchbegriff-Hervorhebung wenn aus Suche geöffnet
            let highlightedPara = null;
            let activeQueryTokens = [];
            const activeQuery = (window.state && window.state.library && window.state.library.query) ? window.state.library.query : '';
            if (activeQuery && window.SearchEngine && typeof window.SearchEngine.parseQuery === 'function') {
                const qObj = window.SearchEngine.parseQuery(activeQuery);
                activeQueryTokens = [...qObj.phrases, ...qObj.allTokens].filter(t => t.length >= 2);
            }

            let renderedParaText = escapeHtml(p);
            if (activeQueryTokens.length > 0) {
                for (const tok of activeQueryTokens) {
                    const re = new RegExp('(' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                    renderedParaText = renderedParaText.replace(re, '<mark class="search-highlight">$1</mark>');
                }
            }

            return `
                <div class="viewer-paragraph" id="viewer-para-${pNum}" data-pnum="${pNum}">
                    <span class="para-gutter-num">${pNum}</span>
                    <p class="para-text">${renderedParaText}</p>
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
        } else if (window.state && window.state.library && window.state.library.query) {
            // Falls aus einer Suche geöffnet: zum ersten Paragraphen mit Treffer scrollen
            setTimeout(() => {
                const firstMark = canvas.querySelector('.viewer-paragraph mark.search-highlight');
                if (firstMark) {
                    const parentPara = firstMark.closest('.viewer-paragraph');
                    if (parentPara) {
                        parentPara.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        parentPara.classList.add('highlight-target');
                        setTimeout(() => parentPara.classList.remove('highlight-target'), 3000);
                    }
                }
            }, 350);
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
    const isEn = window.I18n && window.I18n.getLanguage() === 'en';
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString(isEn ? 'en-US' : 'de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    return dateString;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}
