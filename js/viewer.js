let currentViewerDoc = null;
let currentFontSize = 1.05; // rem

window.initViewer = function() {
    const closeBtn = document.getElementById('viewer-close');
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    const copyBtn = document.getElementById('viewer-copy');
    const fontIncBtn = document.getElementById('viewer-font-inc');
    const fontDecBtn = document.getElementById('viewer-font-dec');
    const modal = document.getElementById('document-viewer');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeViewer);
    }
    
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            if (id && window.toggleBookmark) {
                window.toggleBookmark(id);
            }
        });
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!currentViewerDoc || !currentViewerDoc.text) return;
            navigator.clipboard.writeText(currentViewerDoc.text).then(() => {
                const origHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span style="font-size:0.75rem; color:var(--color-primary); font-weight:bold;">✓ Kopiert</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = origHtml;
                }, 2000);
            }).catch(err => {
                console.error('Kopieren fehlgeschlagen:', err);
            });
        });
    }
    
    if (fontIncBtn) {
        fontIncBtn.addEventListener('click', () => {
            currentFontSize = Math.min(1.6, currentFontSize + 0.1);
            const bodyEl = document.getElementById('viewer-body');
            if (bodyEl) bodyEl.style.fontSize = `${currentFontSize}rem`;
        });
    }
    
    if (fontDecBtn) {
        fontDecBtn.addEventListener('click', () => {
            currentFontSize = Math.max(0.85, currentFontSize - 0.1);
            const bodyEl = document.getElementById('viewer-body');
            if (bodyEl) bodyEl.style.fontSize = `${currentFontSize}rem`;
        });
    }
    
    // Close modal when clicking outside content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeViewer();
            }
        });
    }
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

window.openDocument = function(id, targetParagraph) {
    if (!window.state || !window.state.documents) return;
    
    const doc = window.state.documents.find(d => d.id === id);
    if (!doc) return;
    
    currentViewerDoc = doc;

    // Synchronize URL hash for direct bookmarking/sharing
    try {
        const pHash = targetParagraph ? `&p=${targetParagraph}` : '';
        const newHash = `#doc=${encodeURIComponent(id)}${pHash}`;
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
    const titleEl = document.getElementById('viewer-title');
    const metaEl = document.getElementById('viewer-meta');
    const bodyEl = document.getElementById('viewer-body');
    const downloadBtn = document.getElementById('viewer-download');
    const bookmarkBtn = document.getElementById('viewer-bookmark');
    
    // Set title
    if (titleEl) titleEl.textContent = doc.title;
    
    // Meta information builder (called again after text loads for word count)
    const langLabel = doc.language === 'english' ? 'English' : 'Deutsch';
    
    function buildMetaHtml(wc) {
        let html = `
            <div><strong>Datum:</strong> ${formatViewerDate(doc.date)}</div>
            <div><strong>Quelle:</strong> <span class="source-badge source-${(doc.source || '').toLowerCase().replace(/[^a-z0-9]/g, '')}">${doc.source || 'UHG'}</span></div>
            <div><strong>Typ:</strong> ${doc.type || 'Botschaft'}</div>
            <div><strong>Bereich:</strong> ${doc.tierName || 'Botschaften des Hauses'}</div>
            ${doc.subTierName ? `<div><strong>Institution:</strong> ${doc.subTierName}</div>` : ''}
            <div><strong>Sprache:</strong> ${langLabel}</div>
            ${wc > 0 ? `<div><strong>Umfang:</strong> ~${wc.toLocaleString('de-DE')} Wörter</div>` : ''}
        `;
        if (doc.topics && doc.topics.length > 0) {
            html += `<div style="width: 100%; display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">
                <strong>Themen:</strong> ${doc.topics.map(t => `<span class="tag">${t}</span>`).join('')}
            </div>`;
        }
        return html;
    }
    
    if (metaEl) metaEl.innerHTML = buildMetaHtml(doc.wordCount || 0);

    // Export openViewer as alias for openDocument
    window.openViewer = window.openDocument;

    // Progress bar tracking
    const progressBar = document.getElementById('viewer-progress-bar');
    if (bodyEl && progressBar) {
        bodyEl.addEventListener('scroll', () => {
            const maxScroll = bodyEl.scrollHeight - bodyEl.clientHeight;
            if (maxScroll > 0) {
                const pct = Math.min(100, Math.max(0, (bodyEl.scrollTop / maxScroll) * 100));
                progressBar.style.width = `${pct}%`;
            } else {
                progressBar.style.width = '0%';
            }
        });
    }

    // Ruhi & Books: check if PDF and text are both available
    const isRuhi = doc.tier === 'ruhi' || doc.type === 'Ruhi-Buch' || 
                   (doc.title && (doc.title.startsWith('Ruhi Buch') || doc.title.startsWith('Ruhi Book')));
    const isBook = doc.tier === 'books';
    const pdfPath = doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf') ? doc.filePath.replace(/^\.\.\//, '') : null;
    
    // Default viewer mode: Ruhi defaults to PDF, Books and Messages default to text
    let currentMode = preferredMode || (isRuhi && !targetParagraph ? 'pdf' : 'text');

    if (modal) modal.classList.toggle('modal-wide', currentMode === 'pdf');

    const fontControls = document.querySelector('.reader-font-controls');
    if (fontControls) fontControls.style.display = currentMode === 'pdf' ? 'none' : 'flex';
    const copyBtn = document.getElementById('viewer-copy');
    if (copyBtn) copyBtn.style.display = currentMode === 'pdf' ? 'none' : '';
    const typeBadge = document.getElementById('viewer-type-badge');
    if (typeBadge) typeBadge.textContent = isRuhi ? 'Ruhi-Institut (Studienbuch)' : (doc.type || 'Botschaft');

    // Dual-mode Text/PDF Switcher for documents with PDF
    const oldModeSwitch = document.getElementById('viewer-mode-switch');
    if (oldModeSwitch) oldModeSwitch.remove();

    if (pdfPath) {
        const modeSwitch = document.createElement('div');
        modeSwitch.id = 'viewer-mode-switch';
        modeSwitch.className = 'viewer-mode-switch';
        modeSwitch.innerHTML = `
            <button id="btn-mode-text" class="viewer-mode-tab ${currentMode === 'text' ? 'active' : ''}" title="Strukturiertes Textlese-Erlebnis mit Absätzen und Zitaten">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
                <span>Fließtext</span>
            </button>
            <button id="btn-mode-pdf" class="viewer-mode-tab ${currentMode === 'pdf' ? 'active' : ''}" title="Original-Faksimile und Druckausgabe im PDF-Betrachter">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <span>Original-PDF</span>
            </button>
        `;
        const modalActions = document.querySelector('.modal-actions');
        if (modalActions) {
            modalActions.insertBefore(modeSwitch, modalActions.firstChild);
        }

        const btnText = modeSwitch.querySelector('#btn-mode-text');
        const btnPdf = modeSwitch.querySelector('#btn-mode-pdf');
        if (btnText) {
            btnText.addEventListener('click', () => {
                window.openDocument(doc.id, targetParagraph, 'text');
            });
        }
        if (btnPdf) {
            btnPdf.addEventListener('click', () => {
                window.openDocument(doc.id, null, 'pdf');
            });
        }
    }

    if (currentMode === 'pdf' && pdfPath) {
        if (bodyEl) {
            bodyEl.style.fontSize = '';
            bodyEl.scrollTop = 0;
            bodyEl.innerHTML = `
                <div class="ruhi-pdf-view-wrapper" style="width: 100%; display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.5rem;">
                    <!-- Autorisierte Quelle Banner -->
                    <div class="viewer-source-banner">
                        <div class="viewer-source-info">
                            <span class="source-verified-badge">✓ Autorisierte Quelle</span>
                            <span class="source-platform-name">${escapeHtml(doc.sourcePlatform || 'Bahá’í-Veröffentlichung')}</span>
                        </div>
                        <a href="${escapeHtml(doc.sourceUrl || 'https://www.bahai.org/library/')}" target="_blank" rel="noopener noreferrer" class="viewer-source-link-btn" title="Offizielle Seite aufrufen">
                            <span>Original auf ${doc.sourceUrl && doc.sourceUrl.includes('ruhi.org') ? 'ruhi.org' : doc.sourceUrl && doc.sourceUrl.includes('bibliothek.bahai.de') ? 'bibliothek.bahai.de' : 'bahai.org'} öffnen</span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>
                    </div>
                    <div style="width: 100%; height: 75vh; min-height: 540px; border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); overflow: hidden; background: #1a1d24;">
                        <iframe src="${pdfPath}#toolbar=1&navpanes=0" style="width: 100%; height: 100%; border: none;" title="${escapeHtml(doc.title)}"></iframe>
                    </div>
                </div>
            `;
        }
    } else {
        // Reset body for standard text documents
        if (bodyEl) {
            bodyEl.style.fontSize = `${currentFontSize}rem`;
            bodyEl.scrollTop = 0;
            bodyEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;text-align:center;">⏳ Volltext wird geladen…</p>';
        }
        
        // Lazy-load full text from individual file
        if (doc.hasText !== false && doc.id) {
            fetch(`data/texts/${doc.id}.txt`)
                .then(r => r.ok ? r.text() : Promise.reject('not found'))
                .then(text => {
                    currentViewerDoc.text = text;
                    if (bodyEl) {
                        const structure = parseDocumentStructure(text);
                        currentViewerDoc.paragraphs = structure.body;
                        let fullHtml = '';

                        // 0. Autorisierte Originalquelle Banner (Ganz oben im Dokument)
                        const sourceName = doc.sourcePlatform || (doc.sourceUrl && doc.sourceUrl.includes('bibliothek.bahai.de') ? 'Bahá’í-Bibliothek Deutschland' : 'Bahá’í Reference Library');
                        const sourceUrl = doc.sourceUrl || 'https://www.bahai.org/library/';

                        fullHtml += `
                            <div class="viewer-source-banner">
                                <div class="viewer-source-info">
                                    <span class="source-verified-badge">✓ Autorisierte Originalquelle</span>
                                    <span class="source-platform-name">${escapeHtml(sourceName)}</span>
                                </div>
                                <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="viewer-source-link-btn" title="Dieses Dokument auf der autorisierten Originalwebsite öffnen">
                                    <span>Originaldokument auf ${sourceUrl.includes('bibliothek.bahai.de') ? 'bibliothek.bahai.de' : 'bahai.org'} öffnen</span>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                            </div>
                        `;

                        // 1. Briefkopf / Document Letterhead (Institution, Date, Addressee, Salutation)
                        if (structure.headers.length > 0 || structure.salutation) {
                            fullHtml += `
                                <div class="viewer-letterhead">
                                    ${structure.headers.map(h => {
                                        if (h.kind === 'institution') {
                                            return `<div style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600; color: var(--accent-gold); letter-spacing: 0.08em; text-align: center; margin-bottom: 0.85rem; text-transform: uppercase;">${escapeHtml(h.text)}</div>`;
                                        }
                                        if (h.kind === 'date') {
                                            return `<div style="font-family: var(--font-sans); font-size: 0.85rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.35rem;">${escapeHtml(h.text)}</div>`;
                                        }
                                        if (h.kind === 'addressee') {
                                            return `<div style="font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600; color: var(--text-ink); margin-bottom: 0.35rem;">${escapeHtml(h.text)}</div>`;
                                        }
                                        return `<div style="font-size: 0.85rem; color: var(--text-subtle); font-style: italic; margin-bottom: 0.3rem;">${escapeHtml(h.text)}</div>`;
                                    }).join('')}
                                    ${structure.salutation ? `
                                        <div style="font-family: var(--font-serif); font-size: 1.08rem; font-style: italic; font-weight: 500; color: var(--accent-gold); margin-top: 0.85rem; padding-top: 0.6rem; border-top: 1px dashed var(--border-hairline);">
                                            ${escapeHtml(structure.salutation)}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }

                        // 2. Echte Textabsätze mit direkten Absatz-Aktionen & Original-Quell-Links
                        fullHtml += structure.body.map((rawP, idx) => {
                            const pNum = idx + 1;
                            // Clean database paragraph identifiers (e.g. "1:1 ", "f.1:1 ", "0_1 ")
                            const p = rawP.replace(/^(\d+(?:\.\d+)?:\d+(?:_\d+)?|f\.(?:\w+:)?\d+(?:_\d+)?|0_\d+)\s+/, '').trim();
                            const originalParaUrl = getOriginalParagraphUrl(doc, pNum, p);
                            return `
                                <div class="viewer-paragraph" id="viewer-para-${pNum}" data-pnum="${pNum}">
                                    <div class="para-header">
                                        <div class="para-meta-left">
                                            <span class="para-num" title="Absatz ${pNum}">Abs. ${pNum}</span>
                                            <a href="${escapeHtml(originalParaUrl)}" target="_blank" rel="noopener noreferrer" class="para-action-btn btn-original-link" title="Diesen Absatz in der autorisierten Originalquelle öffnen">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                <span>Original-Absatz ↗</span>
                                            </a>
                                            <button class="para-action-btn" onclick="window.copyParagraphCitation(${pNum})" title="Absatz samt formaler Quellenangabe & Link kopieren">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                                                <span id="para-copy-label-${pNum}">Zitieren &amp; Link</span>
                                            </button>
                                            <button class="para-action-btn" onclick="window.copyParagraphDeepLink(${pNum})" title="Direktlink zu diesem Absatz im Archiv kopieren">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                <span id="para-link-label-${pNum}">Link</span>
                                            </button>
                                        </div>
                                        <button id="viewer-para-btn-${pNum}" onclick="window.addViewerParagraphToWorkshop(${pNum})" class="para-add-btn" title="Diesen Absatz zur Kompilations-Werkstatt hinzufügen">
                                            + In Kompilation
                                        </button>
                                    </div>
                                    <p class="para-text" style="margin: 0; line-height: 1.76; text-align: justify;">${escapeHtml(p)}</p>
                                </div>
                            `;
                        }).join('');

                        // 3. Schlussformel & Unterschrift
                        if (structure.closings.length > 0) {
                            fullHtml += `
                                <div class="viewer-closing" style="margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-hairline); text-align: right;">
                                    ${structure.closings.map(c => `
                                        <div style="font-family: var(--font-serif); font-style: italic; color: var(--text-muted); margin-bottom: 0.4rem; font-size: 0.95rem;">${escapeHtml(c)}</div>
                                    `).join('')}
                                </div>
                            `;
                        }

                        // 4. Transparenzhinweis am Textende
                        fullHtml += `
                            <div class="viewer-disclaimer-footnote">
                                Privates Studienarchiv &bull; Autorisierte Schriften &amp; offizielle Publikationen: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(sourceName)}</a>
                            </div>
                        `;

                        bodyEl.innerHTML = fullHtml;

                        // Wenn ein Zielabsatz übergeben wurde, sanft hinscrollen & hervorheben
                        if (targetParagraph) {
                            setTimeout(() => {
                                const targetEl = document.getElementById(`viewer-para-${targetParagraph}`);
                                if (targetEl) {
                                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    targetEl.classList.add('highlight-target');
                                    setTimeout(() => targetEl.classList.remove('highlight-target'), 3500);
                                }
                            }, 350);
                        }
                    }
                    const wc = text.split(/\s+/).length;
                    if (metaEl) metaEl.innerHTML = buildMetaHtml(wc);
                })
                .catch(() => {
                    if (bodyEl) bodyEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;padding:2rem;text-align:center;">Kein Volltext verfügbar.</p>';
                });
        } else {
            if (bodyEl) bodyEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;padding:2rem;text-align:center;">Kein Volltext vorhanden.</p>';
        }
    }
    
    // Multi-format download buttons & official source link
    const oldBar = document.getElementById('viewer-dl-bar');
    if (oldBar) oldBar.remove();
    if (downloadBtn) downloadBtn.style.display = 'none';

    const formats = [];
    const fmts = doc.availableFormats || [];
    const files = doc.formatFiles || {};

    ['pdf', 'docx', 'epub', 'txt'].forEach(fmt => {
        if (files[fmt]) {
            const label = fmt === 'docx' ? 'Word (DOCX)' : fmt === 'epub' ? 'E-Book (EPUB)' : fmt === 'pdf' ? 'PDF' : 'Volltext (TXT)';
            formats.push({ label, href: files[fmt] });
        } else if (fmts.includes(fmt)) {
            let path = '';
            if (fmt === 'txt') path = `data/texts/${doc.id}.txt`;
            else if (fmt === 'docx') path = doc.docxPath || doc.filePath;
            else if (fmt === 'pdf') path = doc.filePath;
            if (path) formats.push({ label: fmt.toUpperCase(), href: path });
        }
    });

    if (formats.length === 0) {
        if (doc.filePath) {
            const ext = doc.filePath.split('.').pop().toUpperCase();
            formats.push({ label: ext, href: doc.filePath });
        }
        if (doc.docxPath && doc.docxPath !== doc.filePath) formats.push({ label: 'DOCX', href: doc.docxPath });
    }

    const dlParent = downloadBtn ? downloadBtn.parentElement : null;
    if (dlParent) {
        const bar = document.createElement('div');
        bar.id = 'viewer-dl-bar';
        bar.style.cssText = 'display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;';
        
        let barHtml = formats.map(f =>
            `<a href="${f.href}" download class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.65rem;text-decoration:none;border-radius:var(--radius-full);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${f.label}</a>`
        ).join('');

        if (doc.sourceUrl) {
            barHtml += `<a href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.65rem;text-decoration:none;border-radius:var(--radius-full);color:var(--accent-gold);border-color:rgba(197,160,89,0.4);" title="Originale Quelle online öffnen"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Web-Quelle</a>`;
        }
        
        bar.innerHTML = barHtml;
        dlParent.appendChild(bar);
    }
    
    // Bookmark button state
    if (bookmarkBtn) {
        bookmarkBtn.dataset.id = doc.id;
        if (window.state.bookmarks.includes(doc.id)) {
            bookmarkBtn.style.color = 'var(--color-primary)';
            const svg = bookmarkBtn.querySelector('svg');
            if (svg) svg.setAttribute('fill', 'currentColor');
        } else {
            bookmarkBtn.style.color = '';
            const svg = bookmarkBtn.querySelector('svg');
            if (svg) svg.setAttribute('fill', 'none');
        }
    }
    
    // Show modal
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
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

window.addViewerParagraphToWorkshop = function(paraIdx) {
    if (!currentViewerDoc || !currentViewerDoc.text) return;
    const structure = parseDocumentStructure(currentViewerDoc.text);
    const pText = structure.body[paraIdx - 1];
    if (!pText) return;

    if (window.CompilationBuilder && window.CompilationBuilder.addPassageFromViewer) {
        window.CompilationBuilder.addPassageFromViewer(currentViewerDoc, pText.trim(), paraIdx);
        const btn = document.getElementById(`viewer-para-btn-${paraIdx}`);
        if (btn) {
            btn.innerHTML = '✓ Im Entwurf';
            btn.style.background = 'var(--color-accent-light)';
            btn.style.color = 'var(--color-primary)';
            btn.style.borderColor = 'var(--color-accent)';
        }
    } else {
        alert('Kompilations-Werkstatt ist noch nicht bereit.');
    }
};

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
    
    // 2. Date
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
    
    // 3. Addressee
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
    
    // 4. Salutation (Anrede)
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
    
    // 5. Metadata / translation / subject header
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
    // Clean first 6-8 words
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
            label.innerHTML = '✓ Kopiert!';
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
            label.innerHTML = '✓ Kopiert!';
            setTimeout(() => { label.innerHTML = orig; }, 2000);
        }
    }).catch(err => {
        console.error('Link-Kopieren fehlgeschlagen:', err);
    });
};



