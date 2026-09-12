/**
 * account.js
 * Vereinfachtes Studienkonto & persönliche Datensicherung
 * 100% lokal, privat und geräteübergreifend über 1-Klick-Backup & Transfer-Code
 */

window.AccountModule = (function() {
    const STORAGE_KEY_USER = 'cosmos_user_account';

    const safeGetStorage = window.safeGetStorage || function(k, d) {
        try {
            const v = localStorage.getItem(k);
            return v !== null ? v : d;
        } catch(e) {
            return d;
        }
    };

    const safeSetStorage = window.safeSetStorage || function(k, v) {
        try {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        } catch(e) {}
    };

    const safeRemoveStorage = function(k) {
        try {
            localStorage.removeItem(k);
        } catch(e) {}
    };

    let currentUser = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        loadUser();
        ensureModalDOM();
        updateDockUI();

        // Dock-Button Listener
        const dockBtn = document.getElementById('dock-account-btn');
        if (dockBtn) {
            dockBtn.addEventListener('click', () => openModal());
        }

        // Globaler Esc-Listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('account-modal');
                if (modal && modal.classList.contains('open')) {
                    closeModal();
                }
            }
        });
    }

    function loadUser() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_USER);
            currentUser = stored ? JSON.parse(stored) : null;
        } catch(e) {
            currentUser = null;
        }
    }

    function updateDockUI() {
        const dockBtn = document.getElementById('dock-account-btn');
        if (!dockBtn) return;

        if (currentUser && currentUser.name) {
            const initial = currentUser.name.charAt(0).toUpperCase();
            dockBtn.innerHTML = `
                <div class="dock-account-avatar">${escapeHtml(initial)}</div>
                <span class="sync-status-dot synced" title="Studienkonto: ${escapeHtml(currentUser.name)}"></span>
            `;
            dockBtn.title = `Studienkonto: ${currentUser.name}`;
        } else {
            dockBtn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="sync-status-dot local" title="Studienkonto & Datensicherung"></span>
            `;
            dockBtn.title = 'Studienkonto & Datensicherung';
        }
    }

    function ensureModalDOM() {
        if (document.getElementById('account-modal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'account-modal';
        modalOverlay.className = 'account-modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');
        modalOverlay.setAttribute('aria-labelledby', 'account-dialog-title');

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        modalOverlay.innerHTML = `
            <div class="account-modal-dialog" onclick="event.stopPropagation()">
                <div class="account-modal-header">
                    <div class="account-header-left">
                        <div class="account-avatar-badge">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                            <h3 class="account-modal-title" id="account-dialog-title">Studienkonto</h3>
                            <p class="account-modal-subtitle">Deine Lesezeichen, Notizen &amp; Sicherung</p>
                        </div>
                    </div>
                    <button type="button" class="account-close-btn" onclick="window.AccountModule.closeModal()" title="Schließen (Esc)" aria-label="Schließen">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="account-modal-body" id="account-modal-body"></div>
            </div>
        `;

        document.body.appendChild(modalOverlay);
    }

    function getMetrics() {
        const bookmarks = JSON.parse(safeGetStorage('bookmarks', '[]'));
        const compilations = JSON.parse(safeGetStorage('my_compilations', '[]'));
        const history = JSON.parse(safeGetStorage('reading_history', '[]'));
        return {
            bookmarksCount: Array.isArray(bookmarks) ? bookmarks.length : 0,
            compilationsCount: Array.isArray(compilations) ? compilations.length : 0,
            historyCount: Array.isArray(history) ? history.length : 0
        };
    }

    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const metrics = getMetrics();
        const userName = currentUser ? (currentUser.name || '') : '';

        body.innerHTML = `
            <!-- 1. Statistik-Karten -->
            <div class="account-stats-strip">
                <div class="account-stat-card">
                    <span class="account-stat-num">${metrics.bookmarksCount}</span>
                    <span class="account-stat-label">Lesezeichen</span>
                </div>
                <div class="account-stat-card">
                    <span class="account-stat-num">${metrics.compilationsCount}</span>
                    <span class="account-stat-label">Kompilationen</span>
                </div>
                <div class="account-stat-card">
                    <span class="account-stat-num">${metrics.historyCount}</span>
                    <span class="account-stat-label">Gelesen</span>
                </div>
            </div>

            <!-- 2. Profil / Name (Optional) -->
            <div class="account-card-section">
                <label class="account-section-label" for="account-user-name">Profilname (optional)</label>
                <div class="account-name-row">
                    <input type="text" id="account-user-name" class="account-input" placeholder="z. B. Milan" value="${escapeHtml(userName)}" maxlength="40">
                    <button type="button" class="account-action-btn primary" onclick="window.AccountModule.saveUserName()">
                        Speichern
                    </button>
                </div>
            </div>

            <!-- 3. Datensicherung & Backup -->
            <div class="account-card-section">
                <span class="account-section-label">Datensicherung</span>
                <div class="account-actions-grid">
                    <button type="button" class="account-action-btn" onclick="window.AccountModule.exportVault()" title="Sichert alle Lesezeichen und Kompilationen als Datei">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Backup sichern</span>
                    </button>
                    <label class="account-action-btn" title="Stellt Daten aus einer gesicherten Datei wieder her">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Backup laden</span>
                        <input type="file" id="vault-import-input" accept=".json,application/json" style="display: none;" onchange="window.AccountModule.handleVaultFileImport(event)">
                    </label>
                </div>
                <div class="account-transfer-link-row">
                    <button type="button" class="account-link-btn" onclick="window.AccountModule.showDeviceTransferModal()">
                        📲 Auf anderes Gerät übertragen
                    </button>
                    <span class="account-link-sep">•</span>
                    <button type="button" class="account-link-btn" onclick="window.AccountModule.promptImportCode()">
                        Code einlösen
                    </button>
                </div>
            </div>

            <!-- 4. Privatsphäre-Garantie -->
            <div class="account-privacy-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span><strong>100% lokal &amp; privat:</strong> Alle Notizen und Lesezeichen bleiben ausschließlich in deinem Browser gespeichert. Es werden keine Daten an Dritte übermittelt.</span>
            </div>

            <!-- 5. Löschen / Zurücksetzen -->
            <div class="account-footer-row">
                <button type="button" class="account-danger-link" onclick="window.AccountModule.confirmDeleteAllData()">
                    Alle Studiendaten löschen
                </button>
            </div>
        `;
    }

    function openModal() {
        ensureModalDOM();
        loadUser();
        renderModalContent();
        const modal = document.getElementById('account-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal() {
        const modal = document.getElementById('account-modal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function saveUserName() {
        const input = document.getElementById('account-user-name');
        if (!input) return;
        const name = input.value.trim();
        currentUser = name ? { name: name, updatedAt: new Date().toISOString() } : null;
        if (currentUser) {
            safeSetStorage(STORAGE_KEY_USER, currentUser);
        } else {
            safeRemoveStorage(STORAGE_KEY_USER);
        }
        updateDockUI();
        renderModalContent();
    }

    function exportVault() {
        const bookmarks = JSON.parse(safeGetStorage('bookmarks', '[]'));
        const history = JSON.parse(safeGetStorage('reading_history', '[]'));
        const compilations = JSON.parse(safeGetStorage('my_compilations', '[]'));
        const highlights = JSON.parse(safeGetStorage('cosmos_highlights', '[]'));

        const vault = {
            format: 'bahai-bib-vault',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            user: currentUser,
            data: {
                bookmarks: bookmarks,
                history: history,
                compilations: compilations,
                highlights: highlights
            }
        };

        const jsonStr = JSON.stringify(vault, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const datePart = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `bahai-studien-backup-${datePart}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleVaultFileImport(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed || !parsed.data) {
                    throw new Error('Ungültiges Vault-Format.');
                }

                if (confirm('Backup wiederherstellen? Vorhandene Lesezeichen und Kompilationen werden zusammengeführt.')) {
                    // 1. Lesezeichen mergen
                    const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
                    (parsed.data.bookmarks || []).forEach(b => curBookmarks.add(b));
                    safeSetStorage('bookmarks', Array.from(curBookmarks));
                    if (window.state) window.state.bookmarks = Array.from(curBookmarks);

                    // 2. Kompilationen mergen
                    const curComps = JSON.parse(safeGetStorage('my_compilations', '[]'));
                    const compIds = new Set(curComps.map(c => c.id));
                    (parsed.data.compilations || []).forEach(c => {
                        if (!compIds.has(c.id)) curComps.push(c);
                    });
                    safeSetStorage('my_compilations', curComps);

                    // 3. Leseverlauf mergen
                    const curHistory = JSON.parse(safeGetStorage('reading_history', '[]'));
                    const histIds = new Set(curHistory.map(h => h.id));
                    (parsed.data.history || []).forEach(h => {
                        if (!histIds.has(h.id)) curHistory.push(h);
                    });
                    safeSetStorage('reading_history', curHistory);
                    if (window.state) window.state.history = curHistory;

                    if (parsed.user && parsed.user.name) {
                        currentUser = parsed.user;
                        safeSetStorage(STORAGE_KEY_USER, currentUser);
                    }

                    alert('Studiendaten erfolgreich wiederhergestellt!');
                    renderModalContent();
                    updateDockUI();

                    if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
                        window.CollectionsModule.renderSavedView();
                    }
                }
            } catch(err) {
                alert('Fehler beim Einlesen des Backups: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function showDeviceTransferModal() {
        const bookmarks = JSON.parse(safeGetStorage('bookmarks', '[]'));
        const compilations = JSON.parse(safeGetStorage('my_compilations', '[]'));

        const payload = {
            t: 'transfer',
            b: bookmarks,
            c: compilations.map(x => ({ id: x.id, title: x.title, quoteCount: (x.quotes || []).length })),
            ts: Date.now()
        };

        const jsonStr = JSON.stringify(payload);
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        prompt('Kopiere diesen Transfer-Code und füge ihn auf deinem anderen Gerät ein:', encoded);
    }

    function promptImportCode() {
        const code = prompt('Füge den Transfer-Code deines anderen Geräts hier ein:');
        if (!code || !code.trim()) return;

        try {
            const jsonStr = decodeURIComponent(escape(atob(code.trim())));
            const parsed = JSON.parse(jsonStr);
            if (parsed.b && Array.isArray(parsed.b)) {
                const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
                parsed.b.forEach(id => curBookmarks.add(id));
                safeSetStorage('bookmarks', Array.from(curBookmarks));
                if (window.state) window.state.bookmarks = Array.from(curBookmarks);

                alert(`${parsed.b.length} Lesezeichen erfolgreich übertragen!`);
                renderModalContent();
                updateDockUI();
            } else {
                throw new Error('Ungültiger Transfer-Code');
            }
        } catch(e) {
            alert('Fehler beim Einlösen des Transfer-Codes: ' + e.message);
        }
    }

    function confirmDeleteAllData() {
        const check = confirm(
            'Möchtest du wirklich alle gespeicherten Studiendaten (Lesezeichen, Notizen, Kompilationen) unwiderruflich von diesem Gerät löschen?'
        );
        if (!check) return;

        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage('cosmos_gdpr_consent_art9');
        safeRemoveStorage('bookmarks');
        safeRemoveStorage('reading_history');
        safeRemoveStorage('my_compilations');
        safeRemoveStorage('cosmos_highlights');

        if (window.state) {
            window.state.bookmarks = [];
            window.state.history = [];
        }

        currentUser = null;
        updateDockUI();
        closeModal();

        alert('Alle Studiendaten wurden von diesem Gerät gelöscht.');

        if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
            window.CollectionsModule.renderSavedView();
        }
    }

    return {
        init: init,
        openModal: openModal,
        closeModal: closeModal,
        saveUserName: saveUserName,
        exportVault: exportVault,
        handleVaultFileImport: handleVaultFileImport,
        showDeviceTransferModal: showDeviceTransferModal,
        promptImportCode: promptImportCode,
        confirmDeleteAllData: confirmDeleteAllData,
        // Kompatibilitäts-Aliase
        switchTab: function() { openModal(); },
        logout: function() { confirmDeleteAllData(); }
    };
})();

// Auto-Init bei DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AccountModule.init());
} else {
    window.AccountModule.init();
}
