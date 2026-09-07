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

    // 4. Modus-Umschaltung: Fließtext vs. Original-PDF
    if (btnModeText) {
        btnModeText.addEventListener('click', () => {
            if (currentViewerDoc) setViewerMode('text');
        });
    }
    if (btnModePdf) {
        btnModePdf.addEventListener('click', () => {
            if (currentViewerDoc) setViewerMode('pdf');
        });
    }
    if (btnModeWeb) {
        btnModeWeb.addEventListener('click', () => {
            if (currentViewerDoc) setViewerMode('web');
        });
    }

    // 5. Download- & Export-Dropdown Umschaltung
    if (exportBtn && exportMenu) {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = exportMenu.hidden;
            exportMenu.hidden = !isCurrentlyHidden;
            exportBtn.setAttribute('aria-expanded', isCurrentlyHidden ? 'true' : 'false');
        });

        document.addEventListener('click', (e) => {
            if (!exportMenu.hidden && !exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
                exportMenu.hidden = true;
                exportBtn.setAttribute('aria-expanded', 'false');
            }
        });

        exportMenu.addEventListener('click', (e) => {
            if (e.target.closest('a')) {
                exportMenu.hidden = true;
                exportBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 6. Sprach-Umschaltung: DE vs. EN
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

window.openDocument = function(id, targetParagraph, preferredMode, preferredLang) {
    if (!window.state || !window.state.documents) return;

    if (window.state.idAliases && window.state.idAliases[id]) {
        id = window.state.idAliases[id];
    }

    let targetId = id;
    const initialDoc = window.state.documents.find(d => d.id === id);
    const effectiveLang = preferredLang || (function() {
        try {
            const saved = localStorage.getItem('cosmos_preferred_lang');
            if (saved === 'english') return 'en';
            if (saved === 'deutsch') return 'de';
        } catch (e) {}
        return null;
    })();

    if (initialDoc && effectiveLang && initialDoc.translations && initialDoc.translations[effectiveLang]) {
        targetId = initialDoc.translations[effectiveLang];
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
        // Nur anzeigen, falls kein PDF vorhanden ist (reines Web-Dokument)
        btnModeWeb.style.display = (!pdfPath && doc.sourceUrl) ? 'inline-flex' : 'none';
    }

    if (modePill) {
        modePill.style.display = 'inline-flex';
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

    // Standard-Leseformat gemaess Benutzereinstellung (Original-PDF, Fliesstext, Webseite, Automatisch)
    let targetMode = preferredMode;
    if (!targetMode) {
        if (targetParagraph) {
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
    const btnModeWeb = document.getElementById('btn-mode-web');
    const btnModeEpub = document.getElementById('btn-mode-epub');
    const btnModeText = document.getElementById('btn-mode-text');
    const copyBtn = document.getElementById('viewer-copy');

    if (btnModePdf) btnModePdf.classList.toggle('active', mode === 'pdf');
    if (btnModeWeb) btnModeWeb.classList.toggle('active', mode === 'web');
    if (btnModeEpub) btnModeEpub.classList.toggle('active', mode === 'epub');
    if (btnModeText) btnModeText.classList.toggle('active', mode === 'text');
    
    if (modal) modal.classList.toggle('modal-wide', mode === 'pdf' || mode === 'web');
    if (copyBtn) copyBtn.style.display = mode === 'text' ? '' : 'none';

    const pdfPath = resolvePdfPath(currentViewerDoc);
    const epubPath = resolveEpubPath(currentViewerDoc);

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
    } else if (mode === 'web' && currentViewerDoc && currentViewerDoc.sourceUrl) {
        if (bodyEl) {
            bodyEl.classList.add('pdf-active');
            bodyEl.scrollTop = 0;
            if (headerEl) headerEl.classList.remove('header-hidden');

            const isBibliothek = currentViewerDoc.sourceUrl.includes('bibliothek.bahai.de');
            if (isBibliothek) {
                bodyEl.innerHTML = `
                    <div style="width: 100%; height: calc(100vh - 80px); display: flex; flex-direction: column;">
                        <div style="background: var(--bg-surface); padding: 0.5rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                            <span style="color: var(--text-secondary); font-family: var(--font-sans);">Originalfassung auf <strong>${escapeHtml(currentViewerDoc.sourcePlatform || 'Bahá’í-Bibliothek Deutschland')}</strong></span>
                            <a href="${escapeHtml(currentViewerDoc.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; text-decoration: none;">Im neuen Tab öffnen ↗</a>
                        </div>
                        <iframe src="${currentViewerDoc.sourceUrl}" class="viewer-pdf-frame" style="flex: 1; border: none;" title="Autorisierte Original-Webseite"></iframe>
                    </div>
                `;
            } else {
                bodyEl.innerHTML = `
                    <div style="max-width: 820px; margin: 3rem auto; padding: 2.5rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; text-align: center;">
                        <span class="doc-origin-tag" style="display: inline-block; margin-bottom: 0.75rem;">Autorisierte Webpublikation</span>
                        <h3 style="font-family: var(--font-serif-display); font-size: 1.6rem; margin-bottom: 0.75rem; color: var(--text-primary);">${escapeHtml(currentViewerDoc.title)}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.6;">
                            Dieses Dokument wurde auf der offiziellen <strong>${escapeHtml(currentViewerDoc.sourcePlatform || 'Bahá’í Reference Library')}</strong> im Web veröffentlicht.
                        </p>
                        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                            <a href="${escapeHtml(currentViewerDoc.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="padding: 0.65rem 1.4rem; text-decoration: none; font-weight: 600;">
                                Auf ${escapeHtml(currentViewerDoc.sourcePlatform || 'Bahá’í Reference Library')} öffnen ↗
                            </a>
                            ${pdfPath ? `<button class="btn-secondary" onclick="setViewerMode('pdf')" style="padding: 0.65rem 1.2rem;">Original-PDF betrachten</button>` : ''}
                            <button class="btn-secondary" onclick="setViewerMode('text')" style="padding: 0.65rem 1.2rem;">Als Fließtext lesen</button>
                        </div>
                    </div>
                `;
            }
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
