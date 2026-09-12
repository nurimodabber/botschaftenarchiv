/**
 * account.js
 * Studienkonto & Multi-Device / Multi-Account Synchronisation
 * Bahá'í-Bibliothek & Botschaften-Archiv
 *
 * Ermöglicht:
 * 1. Synchronisation zwischen verschiedenen Geräten (Smartphone, Tablet, PC)
 * 2. Synchronisation zwischen verschiedenen Accounts über 1-Klick-Sync-Codes & QR-Code
 * 3. 1-Klick-URL-Synchronisation (?sync=BHA-XXXXXX)
 * 4. 100% Offline-Sicherung (.json Vault)
 */

window.AccountModule = (function() {
    const STORAGE_KEY_USER = 'cosmos_user_account';
    const STORAGE_KEY_SYNC_CODE = 'cosmos_sync_code';
    const STORAGE_KEY_SYNC_TIME = 'cosmos_sync_time';

    const safeGetStorage = window.safeGetStorage || function(k, d) {
        try {
            const v = localStorage.getItem(k);
            return v !== null ? v : d;
        } catch (e) {
            return d;
        }
    };

    const safeSetStorage = window.safeSetStorage || function(k, v) {
        try {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        } catch (e) {}
    };

    const safeRemoveStorage = function(k) {
        try {
            localStorage.removeItem(k);
        } catch (e) {}
    };

    let currentUser = null;
    let activeSyncCode = null;
    let lastSyncTime = null;
    let isSyncing = false;
    let showQr = false;

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
        loadState();
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

        // Prüfen, ob die Seite über einen Sync-Link geöffnet wurde (?sync=BHA-...)
        checkUrlSyncParam();
    }

    function loadState() {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEY_USER);
            currentUser = storedUser ? JSON.parse(storedUser) : null;
        } catch (e) {
            currentUser = null;
        }

        activeSyncCode = safeGetStorage(STORAGE_KEY_SYNC_CODE, null);
        lastSyncTime = safeGetStorage(STORAGE_KEY_SYNC_TIME, null);
    }

    function updateDockUI() {
        const dockBtn = document.getElementById('dock-account-btn');
        if (!dockBtn) return;

        const isSynced = Boolean(activeSyncCode);

        if (currentUser && currentUser.name) {
            const initial = currentUser.name.charAt(0).toUpperCase();
            dockBtn.innerHTML = `
                <div class="dock-account-avatar">${escapeHtml(initial)}</div>
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Synchronisiert (' + activeSyncCode + ')' : 'Lokales Studienkonto'}"></span>
            `;
            dockBtn.title = `Studienkonto: ${currentUser.name}${isSynced ? ' (Synchronisiert)' : ''}`;
        } else {
            dockBtn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Synchronisiert (' + activeSyncCode + ')' : 'Studienkonto'}"></span>
            `;
            dockBtn.title = isSynced ? `Studienkonto (${activeSyncCode})` : 'Studienkonto & Datensicherung';
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
                            <p class="account-modal-subtitle">Synchronisation, Lesezeichen &amp; Sicherung</p>
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

    function formatTimeAgo(isoString) {
        if (!isoString) return 'Noch nicht synchronisiert';
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return 'Gerade eben synchronisiert';
            if (diffMins < 60) return `Vor ${diffMins} Min. synchronisiert`;
            const hours = Math.floor(diffMins / 60);
            if (hours < 24) return `Heute um ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
            return `Zuletzt: ${date.toLocaleDateString()}`;
        } catch (e) {
            return 'Synchronisiert';
        }
    }

    function getFullVaultPayload() {
        const bookmarks = JSON.parse(safeGetStorage('bookmarks', '[]'));
        const history = JSON.parse(safeGetStorage('reading_history', '[]'));
        const compilations = JSON.parse(safeGetStorage('my_compilations', '[]'));
        const highlights = JSON.parse(safeGetStorage('cosmos_highlights', '[]'));

        return {
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
    }

    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const metrics = getMetrics();
        const userName = currentUser ? (currentUser.name || '') : '';
        const syncUrl = activeSyncCode ? `https://bahaibibliothek.vercel.app/?sync=${encodeURIComponent(activeSyncCode)}` : '';

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

            <!-- 3. Cloud-Synchronisation (Geräte & Accounts) -->
            <div class="account-card-section">
                <span class="account-section-label">Geräte- &amp; Account-Synchronisation</span>
                
                ${activeSyncCode ? `
                    <div class="account-sync-card active">
                        <div class="account-sync-card-header">
                            <div class="account-sync-badge-wrap">
                                <span class="account-sync-badge active">
                                    <span class="sync-dot-pulse"></span>
                                    Verbunden
                                </span>
                                <strong class="account-sync-code-display">${escapeHtml(activeSyncCode)}</strong>
                            </div>
                            <span class="account-sync-time">${escapeHtml(formatTimeAgo(lastSyncTime))}</span>
                        </div>

                        <div class="account-sync-btn-group">
                            <button type="button" class="account-sync-main-btn" onclick="window.AccountModule.triggerSync()" ${isSyncing ? 'disabled' : ''}>
                                <svg class="${isSyncing ? 'spin' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                <span>${isSyncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}</span>
                            </button>
                            <button type="button" class="account-action-btn" onclick="window.AccountModule.toggleQrView()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>
                                <span>QR &amp; Link</span>
                            </button>
                        </div>

                        <div class="account-qr-dropdown ${showQr ? 'open' : ''}">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(syncUrl)}" alt="QR-Code zum Scannen" class="account-qr-img" width="140" height="140" loading="lazy">
                            <p class="account-qr-help">Mit Smartphone scannen, um dieses Studienkonto direkt dort zu öffnen.</p>
                            <div class="account-sync-link-box">
                                <input type="text" readonly value="${escapeHtml(syncUrl)}" class="account-sync-url-input" id="account-sync-url-input">
                                <button type="button" class="account-copy-btn" id="account-copy-link-btn" onclick="window.AccountModule.copySyncLink()">Kopieren</button>
                            </div>
                        </div>

                        <div class="account-sync-sub-actions">
                            <button type="button" class="account-link-btn" onclick="window.AccountModule.promptEnterSyncCode()">Anderen Account verbinden</button>
                            <span class="account-link-sep">•</span>
                            <button type="button" class="account-link-btn" onclick="window.AccountModule.disconnectSync()">Trennen</button>
                        </div>
                    </div>
                ` : `
                    <div class="account-sync-card">
                        <div class="account-sync-card-header">
                            <span class="account-sync-badge">⚪ Noch nicht synchronisiert</span>
                        </div>
                        <p class="account-sync-desc">
                            Synchronisiere deine Lesezeichen, Kompilationen und Lesestände nahtlos zwischen Smartphone, Tablet und PC.
                        </p>
                        <div class="account-actions-grid">
                            <button type="button" class="account-action-btn primary" onclick="window.AccountModule.createSyncCode()" ${isSyncing ? 'disabled' : ''}>
                                <svg class="${isSyncing ? 'spin' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M2 12h20"/></svg>
                                <span>${isSyncing ? 'Wird erstellt…' : 'Sync-Code erzeugen'}</span>
                            </button>
                            <button type="button" class="account-action-btn" onclick="window.AccountModule.promptEnterSyncCode()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                <span>Code einlösen</span>
                            </button>
                        </div>
                    </div>
                `}
            </div>

            <!-- 4. Offline-Datensicherung (JSON-Datei) -->
            <div class="account-card-section">
                <span class="account-section-label">Offline-Sicherung (Datei)</span>
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
            </div>

            <!-- 5. Privatsphäre-Garantie -->
            <div class="account-privacy-banner">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span><strong>Privat &amp; datensparsam:</strong> Die Synchronisation erfolgt über deinen persönlichen Sync-Code ohne Passwörter oder Tracking.</span>
            </div>

            <!-- 6. Löschen / Zurücksetzen -->
            <div class="account-footer-row">
                <button type="button" class="account-danger-link" onclick="window.AccountModule.confirmDeleteAllData()">
                    Alle Studiendaten löschen
                </button>
            </div>
        `;
    }

    function openModal() {
        ensureModalDOM();
        loadState();
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

        // Wenn Sync aktiv, im Hintergrund aktualisieren
        if (activeSyncCode) {
            triggerSync({ silent: true });
        }
    }

    // ─── Cloud-Synchronisation Logik ───

    async function createSyncCode() {
        isSyncing = true;
        renderModalContent();

        try {
            const vault = getFullVaultPayload();
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vault: vault })
            });

            const data = await res.json();
            if (data && data.ok && data.syncCode) {
                activeSyncCode = data.syncCode;
                lastSyncTime = data.updatedAt || new Date().toISOString();
                safeSetStorage(STORAGE_KEY_SYNC_CODE, activeSyncCode);
                safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);
                showQr = true;
                updateDockUI();
            } else {
                throw new Error(data.error || 'Serverfehler beim Erzeugen des Sync-Codes.');
            }
        } catch (err) {
            alert('Fehler bei der Cloud-Synchronisation: ' + err.message);
        } finally {
            isSyncing = false;
            renderModalContent();
        }
    }

    async function triggerSync(options = {}) {
        if (!activeSyncCode) {
            return createSyncCode();
        }

        isSyncing = true;
        renderModalContent();

        try {
            // 1. Zuerst lokalen Stand in die Cloud hochladen
            const vault = getFullVaultPayload();
            const postRes = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syncKey: activeSyncCode,
                    vault: vault
                })
            });
            const postData = await postRes.json();

            // 2. Gegenstelle abfragen und eventuelle Änderungen mergen
            const getRes = await fetch(`/api/sync?code=${encodeURIComponent(activeSyncCode)}`);
            if (getRes.ok) {
                const getData = await getRes.json();
                if (getData.ok && getData.vault) {
                    mergeVault(getData.vault);
                }
            }

            lastSyncTime = new Date().toISOString();
            safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);
            updateDockUI();

            if (!options.silent) {
                alert('Synchronisation erfolgreich abgeschlossen!');
            }
        } catch (err) {
            if (!options.silent) {
                alert('Fehler beim Synchronisieren: ' + err.message);
            }
        } finally {
            isSyncing = false;
            renderModalContent();
        }
    }

    function promptEnterSyncCode() {
        const input = prompt('Gib den Sync-Code deines anderen Geräts oder Accounts ein (z. B. BHA-CS3ZBD5TN):');
        if (!input || !input.trim()) return;
        connectSyncCode(input.trim());
    }

    async function connectSyncCode(code) {
        const cleanCode = code.trim();
        isSyncing = true;
        renderModalContent();

        try {
            const res = await fetch(`/api/sync?code=${encodeURIComponent(cleanCode)}`);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Sync-Code nicht gefunden oder abgelaufen.');
            }

            const data = await res.json();
            if (data.ok && data.vault) {
                const result = mergeVault(data.vault);
                activeSyncCode = cleanCode;
                lastSyncTime = new Date().toISOString();
                safeSetStorage(STORAGE_KEY_SYNC_CODE, activeSyncCode);
                safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);

                updateDockUI();
                alert(`Erfolgreich synchronisiert! Vorhandene Daten wurden zusammengeführt.`);
            } else {
                throw new Error('Ungültige Antwort vom Sync-Server.');
            }
        } catch (err) {
            alert('Fehler beim Verbinden: ' + err.message);
        } finally {
            isSyncing = false;
            renderModalContent();
        }
    }

    function disconnectSync() {
        const check = confirm(
            'Möchtest du die Synchronisation trennen? Alle Studiendaten bleiben lokal auf diesem Gerät erhalten.'
        );
        if (!check) return;

        activeSyncCode = null;
        lastSyncTime = null;
        showQr = false;
        safeRemoveStorage(STORAGE_KEY_SYNC_CODE);
        safeRemoveStorage(STORAGE_KEY_SYNC_TIME);
        updateDockUI();
        renderModalContent();
    }

    function toggleQrView() {
        showQr = !showQr;
        renderModalContent();
    }

    function copySyncLink() {
        const input = document.getElementById('account-sync-url-input');
        const btn = document.getElementById('account-copy-link-btn');
        if (!input) return;

        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Kopiert! ✓';
                setTimeout(() => { btn.textContent = orig; }, 2000);
            }
        }).catch(() => {
            prompt('Kopiere den Link:', input.value);
        });
    }

    // ─── URL-Sync-Parameter-Handler (?sync=BHA-...) ───
    async function checkUrlSyncParam() {
        const params = new URLSearchParams(window.location.search);
        const syncParam = params.get('sync');
        if (!syncParam) return;

        const cleanCode = syncParam.trim();

        // Parameter sauber aus URL entfernen, ohne Seite neu zu laden
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        try {
            const res = await fetch(`/api/sync?code=${encodeURIComponent(cleanCode)}`);
            if (!res.ok) return;

            const data = await res.json();
            if (data && data.ok && data.vault) {
                const vaultData = data.vault.data || data.vault;
                const bCount = Array.isArray(vaultData.bookmarks) ? vaultData.bookmarks.length : 0;
                const cCount = Array.isArray(vaultData.compilations) ? vaultData.compilations.length : 0;

                const accept = confirm(
                    `Möchtest du dieses Gerät mit dem Studienkonto (${cleanCode}) verbinden?\n\n` +
                    `Gefunden: ${bCount} Lesezeichen, ${cCount} Kompilationen.\n` +
                    `Bestehende Daten auf diesem Gerät werden zusammengeführt.`
                );

                if (accept) {
                    mergeVault(data.vault);
                    activeSyncCode = cleanCode;
                    lastSyncTime = new Date().toISOString();
                    safeSetStorage(STORAGE_KEY_SYNC_CODE, activeSyncCode);
                    safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);
                    updateDockUI();
                    openModal();
                }
            }
        } catch (e) {
            console.warn('URL auto-sync skipped:', e);
        }
    }

    // ─── Merge-Hilfsfunktion (Intelligentes Zusammenführen zweier Accounts) ───
    function mergeVault(remoteVault) {
        if (!remoteVault) return { bookmarksAdded: 0, compsAdded: 0 };

        const data = remoteVault.data || remoteVault;
        let bookmarksAdded = 0;
        let compsAdded = 0;

        // 1. Lesezeichen (Set-Union)
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
            const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
            const beforeSize = curBookmarks.size;
            data.bookmarks.forEach(b => curBookmarks.add(b));
            bookmarksAdded = curBookmarks.size - beforeSize;
            safeSetStorage('bookmarks', Array.from(curBookmarks));
            if (window.state) window.state.bookmarks = Array.from(curBookmarks);
        }

        // 2. Kompilationen
        if (data.compilations && Array.isArray(data.compilations)) {
            const curComps = JSON.parse(safeGetStorage('my_compilations', '[]'));
            const compIds = new Set(curComps.map(c => c.id));
            data.compilations.forEach(c => {
                if (!compIds.has(c.id)) {
                    curComps.push(c);
                    compsAdded++;
                }
            });
            safeSetStorage('my_compilations', curComps);
        }

        // 3. Leseverlauf
        if (data.history && Array.isArray(data.history)) {
            const curHistory = JSON.parse(safeGetStorage('reading_history', '[]'));
            const histIds = new Set(curHistory.map(h => h.id));
            data.history.forEach(h => {
                if (!histIds.has(h.id)) curHistory.push(h);
            });
            safeSetStorage('reading_history', curHistory);
            if (window.state) window.state.history = curHistory;
        }

        // 4. Markierungen (Highlights)
        if (data.highlights && Array.isArray(data.highlights)) {
            const curHighlights = JSON.parse(safeGetStorage('cosmos_highlights', '[]'));
            const highIds = new Set(curHighlights.map(h => h.id || (h.docId + '-' + h.paraId)));
            data.highlights.forEach(h => {
                const id = h.id || (h.docId + '-' + h.paraId);
                if (!highIds.has(id)) curHighlights.push(h);
            });
            safeSetStorage('cosmos_highlights', curHighlights);
        }

        // 5. Profilname
        if (remoteVault.user && remoteVault.user.name && (!currentUser || !currentUser.name)) {
            currentUser = remoteVault.user;
            safeSetStorage(STORAGE_KEY_USER, currentUser);
        }

        if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
            window.CollectionsModule.renderSavedView();
        }

        return { bookmarksAdded, compsAdded };
    }

    // ─── Offline Vault Export & Import (.json) ───

    function exportVault() {
        const vault = getFullVaultPayload();
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
                if (!parsed || (!parsed.data && !parsed.bookmarks)) {
                    throw new Error('Ungültiges Vault-Format.');
                }

                if (confirm('Backup wiederherstellen? Vorhandene Lesezeichen und Kompilationen werden zusammengeführt.')) {
                    mergeVault(parsed);
                    alert('Studiendaten erfolgreich wiederhergestellt!');
                    renderModalContent();
                    updateDockUI();
                }
            } catch (err) {
                alert('Fehler beim Einlesen des Backups: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    function confirmDeleteAllData() {
        const check = confirm(
            'Möchtest du wirklich alle gespeicherten Studiendaten (Lesezeichen, Notizen, Kompilationen) unwiderruflich von diesem Gerät löschen?'
        );
        if (!check) return;

        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage(STORAGE_KEY_SYNC_CODE);
        safeRemoveStorage(STORAGE_KEY_SYNC_TIME);
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
        activeSyncCode = null;
        lastSyncTime = null;
        showQr = false;
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
        createSyncCode: createSyncCode,
        triggerSync: triggerSync,
        promptEnterSyncCode: promptEnterSyncCode,
        connectSyncCode: connectSyncCode,
        disconnectSync: disconnectSync,
        toggleQrView: toggleQrView,
        copySyncLink: copySyncLink,
        exportVault: exportVault,
        handleVaultFileImport: handleVaultFileImport,
        confirmDeleteAllData: confirmDeleteAllData,
        // Kompatibilitäts-Aliase
        showDeviceTransferModal: createSyncCode,
        promptImportCode: promptEnterSyncCode,
        triggerCloudSync: triggerSync,
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
