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
}

window.openDocument = function(id) {
    if (!window.state || !window.state.documents) return;
    
    const doc = window.state.documents.find(d => d.id === id);
    if (!doc) return;
    
    currentViewerDoc = doc;

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

    // Ruhi books: exclusively viewable as official PDF
    const isRuhi = doc.tier === 'ruhi' || doc.type === 'Ruhi-Buch' || 
                   (doc.title && (doc.title.startsWith('Ruhi Buch') || doc.title.startsWith('Ruhi Book')));

    if (modal) modal.classList.toggle('modal-wide', isRuhi);

    const fontControls = document.querySelector('.reader-font-controls');
    if (fontControls) fontControls.style.display = isRuhi ? 'none' : 'flex';
    const copyBtn = document.getElementById('viewer-copy');
    if (copyBtn) copyBtn.style.display = isRuhi ? 'none' : '';
    const typeBadge = document.getElementById('viewer-type-badge');
    if (typeBadge) typeBadge.textContent = isRuhi ? 'Ruhi-Institut (Studienbuch)' : (doc.type || 'Botschaft');

    if (isRuhi) {
        const pdfPath = doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf') ? doc.filePath : null;
        if (bodyEl) {
            bodyEl.style.fontSize = '';
            bodyEl.scrollTop = 0;
            bodyEl.innerHTML = `
                <div class="ruhi-pdf-view-wrapper" style="width: 100%; display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 0.75rem 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold); background: var(--accent-gold-soft); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid rgba(154, 122, 56, 0.25);">PDF-STUDIENAUSGABE</span>
                            <span style="font-size: 0.85rem; color: var(--color-text-secondary);">Studienbuch des Ruhi-Instituts (in PDF-Form einsehbar).</span>
                        </div>
                        ${pdfPath ? `
                        <div style="display: flex; gap: 0.5rem;">
                            <a href="${pdfPath}" target="_blank" class="btn-primary" style="font-size: 0.82rem; padding: 0.4rem 0.9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                In eigenem Tab öffnen
                            </a>
                        </div>
                        ` : ''}
                    </div>
                    ${pdfPath ? `
                    <div style="width: 100%; height: 75vh; min-height: 520px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; background: #525659;">
                        <iframe src="${pdfPath}#toolbar=1&navpanes=0" style="width: 100%; height: 100%; border: none;" title="${escapeHtml(doc.title)}"></iframe>
                    </div>
                    ` : '<p style="padding: 2rem; text-align: center; color: var(--color-text-muted);">PDF-Datei nicht gefunden.</p>'}
                </div>
            `;
        }
    } else {
        // Reset body for standard text documents
        if (bodyEl) {
            bodyEl.style.fontSize = `${currentFontSize}rem`;
            bodyEl.scrollTop = 0;
            bodyEl.innerHTML = '<p style="color:var(--color-text-muted);font-style:italic;text-align:center;">⏳ Volltext wird geladen…</p>';
        }
        
        // Lazy-load full text from individual file
        if (doc.hasText !== false && doc.id) {
            fetch(`data/texts/${doc.id}.txt`)
                .then(r => r.ok ? r.text() : Promise.reject('not found'))
                .then(text => {
                    currentViewerDoc.text = text;
                if (bodyEl) {
                    const structure = parseDocumentStructure(text);
                    let fullHtml = '';

                    // 1. Briefkopf / Document Letterhead (Institution, Date, Addressee, Salutation)
                    if (structure.headers.length > 0 || structure.salutation) {
                        fullHtml += `
                            <div class="viewer-letterhead">
                                ${structure.headers.map(h => {
                                    if (h.kind === 'institution') {
                                        return `<div style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 600; color: var(--color-primary); letter-spacing: 0.08em; text-align: center; margin-bottom: 0.85rem; text-transform: uppercase;">${escapeHtml(h.text)}</div>`;
                                    }
                                    if (h.kind === 'date') {
                                        return `<div style="font-family: var(--font-sans); font-size: 0.85rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 0.35rem;">${escapeHtml(h.text)}</div>`;
                                    }
                                    if (h.kind === 'addressee') {
                                        return `<div style="font-family: var(--font-sans); font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin-bottom: 0.35rem;">${escapeHtml(h.text)}</div>`;
                                    }
                                    return `<div style="font-size: 0.85rem; color: var(--color-text-tertiary); font-style: italic; margin-bottom: 0.3rem;">${escapeHtml(h.text)}</div>`;
                                }).join('')}
                                ${structure.salutation ? `
                                    <div style="font-family: var(--font-serif); font-size: 1.08rem; font-style: italic; font-weight: 500; color: var(--color-primary); margin-top: 0.85rem; padding-top: 0.6rem; border-top: 1px dashed var(--color-border);">
                                        ${escapeHtml(structure.salutation)}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }

                    // 2. Echte Textabsätze (strikt beginnend mit Absatz 1)
                    fullHtml += structure.body.map((p, idx) => {
                        const pNum = idx + 1;
                        return `
                            <div class="viewer-paragraph" id="viewer-para-${pNum}">
                                <div class="para-header">
                                    <span class="para-num">
                                        Abs. ${pNum}
                                    </span>
                                    <button id="viewer-para-btn-${pNum}" onclick="window.addViewerParagraphToWorkshop(${pNum})" class="para-add-btn" title="Diesen Absatz zur Kompilations-Werkstatt hinzufügen">
                                        + In Kompilation
                                    </button>
                                </div>
                                <p style="margin: 0; line-height: 1.76; text-align: justify;">${escapeHtml(p)}</p>
                            </div>
                        `;
                    }).join('');

                    // 3. Schlussformel & Unterschrift
                    if (structure.closings.length > 0) {
                        fullHtml += `
                            <div class="viewer-closing" style="margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border); text-align: right;">
                                ${structure.closings.map(c => `
                                    <div style="font-family: var(--font-serif); font-style: italic; color: var(--color-text-secondary); margin-bottom: 0.4rem; font-size: 0.95rem;">${escapeHtml(c)}</div>
                                `).join('')}
                            </div>
                        `;
                    }

                    // 4. Transparenzhinweis am Textende
                    fullHtml += `
                        <div class="viewer-disclaimer-footnote">
                            Privates Studienarchiv (inspirierte Eigeninitiative) &bull; Autorisierte Schriften &amp; offizielle Publikationen: <a href="https://www.bahai.org/library/" target="_blank" rel="noopener">bahai.org/library</a>
                        </div>
                    `;

                    bodyEl.innerHTML = fullHtml;
                }
                const wc = text.split(/\s+/).length;
                if (metaEl) metaEl.innerHTML = buildMetaHtml(wc);
            })
            .catch(() => {
                if (bodyEl) bodyEl.innerHTML = '<p style="color:var(--color-text-secondary);font-style:italic;padding:2rem;text-align:center;">Kein Volltext verfügbar.</p>';
            });
    } else {
        if (bodyEl) bodyEl.innerHTML = '<p style="color:var(--color-text-secondary);font-style:italic;padding:2rem;text-align:center;">Kein Volltext vorhanden.</p>';
    }
    }
    
    // Multi-format download buttons
    const oldBar = document.getElementById('viewer-dl-bar');
    if (oldBar) oldBar.remove();
    if (downloadBtn) downloadBtn.style.display = 'none';

    const formats = [];
    if (isRuhi) {
        if (doc.filePath && doc.filePath.toLowerCase().endsWith('.pdf')) {
            formats.push({ label: 'PDF (Ruhi-Buch)', href: doc.filePath });
        }
    } else {
        if (doc.hasText !== false && doc.id) {
            formats.push({ label: 'TXT (Volltext)', href: `data/texts/${doc.id}.txt` });
        }
        if (doc.filePath) {
            const ext = doc.filePath.split('.').pop().toUpperCase();
            formats.push({ label: ext, href: doc.filePath });
        }
        if (doc.docxPath && doc.docxPath !== doc.filePath) formats.push({ label: 'DOCX', href: doc.docxPath });
    }

    const dlParent = downloadBtn ? downloadBtn.parentElement : null;
    if (formats.length > 0 && dlParent) {
        const bar = document.createElement('div');
        bar.id = 'viewer-dl-bar';
        bar.style.cssText = 'display:flex;gap:0.4rem;flex-wrap:wrap;';
        bar.innerHTML = formats.map(f =>
            `<a href="${f.href}" download class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.65rem;text-decoration:none;border-radius:var(--radius-full);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${f.label}</a>`
        ).join('');
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


