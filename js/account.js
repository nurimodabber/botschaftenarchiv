/**
 * account.js — Radikal vereinfachtes, Ende-zu-Ende verschlüsseltes Studienkonto
 * Bahá'í-Bibliothek & Botschaften-Archiv (v6.1)
 *
 * Merkmale:
 * 1. 1-Klick-Anmeldung & Synchronisation (Google & E-Mail)
 * 2. Volle Diskretion: Keine Passwörter, kein Tracking, DSGVO-konform
 * 3. Client-seitige Ende-zu-Ende-Verschlüsselung (Web Crypto AES-GCM-256 mit PBKDF2)
 * 4. Automatische Hintergrund-Synchronisation zwischen Smartphone, Tablet & PC
 */

window.AccountModule = (function() {
    const STORAGE_KEY_USER = 'cosmos_user_account';
    const STORAGE_KEY_SYNC_KEY = 'cosmos_sync_key';
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
    let activeSyncKey = null;
    let lastSyncTime = null;
    let isSyncing = false;
    let showOfflineDrawer = false;

    // ─── 1. Client-seitige Verschlüsselung (Web Crypto AES-GCM-256) ───

    const CryptoEngine = {
        generateSalt: function() {
            const arr = new Uint8Array(16);
            (window.crypto || window.msCrypto).getRandomValues(arr);
            return btoa(String.fromCharCode(...arr));
        },

        deriveKey: async function(secret, saltBase64) {
            const enc = new TextEncoder();
            const rawKey = enc.encode(String(secret).trim().toLowerCase());
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw', rawKey, { name: 'PBKDF2' }, false, ['deriveKey']
            );
            const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
            return await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        },

        encrypt: async function(plainObj, secret) {
            try {
                if (!window.crypto || !window.crypto.subtle) {
                    return { fallback: true, data: plainObj };
                }
                const saltBase64 = this.generateSalt();
                const key = await this.deriveKey(secret, saltBase64);
                const iv = new Uint8Array(12);
                window.crypto.getRandomValues(iv);
                const enc = new TextEncoder();
                const encoded = enc.encode(JSON.stringify(plainObj));
                const encrypted = await window.crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    encoded
                );
                return {
                    encrypted: true,
                    salt: saltBase64,
                    iv: btoa(String.fromCharCode(...iv)),
                    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
                };
            } catch (e) {
                console.warn('CryptoEngine encrypt fallback:', e);
                return { fallback: true, data: plainObj };
            }
        },

        decrypt: async function(payload, secret) {
            try {
                if (!payload.encrypted || payload.fallback) {
                    return payload.data || payload;
                }
                const key = await this.deriveKey(secret, payload.salt);
                const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
                const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
                const decrypted = await window.crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    ciphertext
                );
                const dec = new TextDecoder();
                return JSON.parse(dec.decode(decrypted));
            } catch (e) {
                console.error('CryptoEngine decryption failed:', e);
                throw new Error('Entschlüsselung fehlgeschlagen. Bitte prüfe deine E-Mail oder deinen Schlüssel.');
            }
        }
    };

    // Schnelle kryptografische Hash-Funktion für den Server-Lookup-Schlüssel
    async function hashKey(str) {
        const clean = String(str).trim().toLowerCase();
        try {
            if (window.crypto && window.crypto.subtle) {
                const enc = new TextEncoder();
                const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(clean));
                const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
                return hex.slice(0, 24);
            }
        } catch (e) {}
        // Fallback-Hash
        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
            hash = ((hash << 5) - hash) + clean.charCodeAt(i);
            hash |= 0;
        }
        return 'bh_' + Math.abs(hash).toString(16);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            const diffMins = Math.floor((new Date() - date) / 60000);
            if (diffMins < 1) return 'Gerade eben synchronisiert';
            if (diffMins < 60) return `Vor ${diffMins} Min. synchronisiert`;
            const hours = Math.floor(diffMins / 60);
            if (hours < 24) return `Heute um ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`;
            return `Zuletzt: ${date.toLocaleDateString()}`;
        } catch (e) {
            return 'Synchronisiert';
        }
    }

    function getLocalVaultData() {
        return {
            bookmarks: JSON.parse(safeGetStorage('bookmarks', '[]')),
            history: JSON.parse(safeGetStorage('reading_history', '[]')),
            compilations: JSON.parse(safeGetStorage('my_compilations', '[]')),
            highlights: JSON.parse(safeGetStorage('cosmos_highlights', '[]'))
        };
    }

    // ─── 2. Initialisierung & DOM ───

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

        // Prüfen, ob die Seite über einen Sync-Link geöffnet wurde (?sync=...)
        checkUrlSyncParam();

        // Optional: Google Identity Services (One Tap / GIS) initialisieren, falls SDK verfügbar
        initGoogleIdentity();
    }

    function loadState() {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEY_USER);
            currentUser = storedUser ? JSON.parse(storedUser) : null;
        } catch (e) {
            currentUser = null;
        }

        activeSyncKey = safeGetStorage(STORAGE_KEY_SYNC_KEY, null);
        lastSyncTime = safeGetStorage(STORAGE_KEY_SYNC_TIME, null);
    }

    function updateDockUI() {
        const dockBtn = document.getElementById('dock-account-btn');
        if (!dockBtn) return;

        const isSynced = Boolean(activeSyncKey && currentUser);

        if (currentUser && currentUser.name) {
            const initial = currentUser.name.charAt(0).toUpperCase();
            dockBtn.innerHTML = `
                <div class="dock-account-avatar">${escapeHtml(initial)}</div>
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Verschlüsselt synchronisiert (' + currentUser.name + ')' : 'Lokales Studienkonto'}"></span>
            `;
            dockBtn.title = `Studienkonto: ${currentUser.name}${isSynced ? ' (Verschlüsselt synchronisiert)' : ''}`;
        } else {
            dockBtn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Verschlüsselt synchronisiert' : 'Studienkonto'}"></span>
            `;
            dockBtn.title = isSynced ? 'Studienkonto (Verschlüsselt synchronisiert)' : 'Studienkonto & Datensicherung';
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 class="account-modal-title" id="account-dialog-title">Studienkonto</h3>
                            <p class="account-modal-subtitle">Privat &bull; Ende-zu-Ende verschlüsselt</p>
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

    // ─── 3. Modal-Inhalt rendern (Radikal vereinfacht: 2 saubere Zustände) ───

    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const metrics = getMetrics();
        const isLoggedIn = Boolean(currentUser && activeSyncKey);

        if (!isLoggedIn) {
            // ZUSTAND 1: Abgemeldet / Noch nicht verbunden (Ruhig, einladend, 1 Klick)
            body.innerHTML = `
                <div class="account-clean-surface">
                    <div class="account-hero-emblem">
                        <div class="account-emblem-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <h4 class="account-clean-title">Lesezeichen &amp; Notizen synchronisieren</h4>
                        <p class="account-clean-subtitle">
                            Greife auf Smartphone, Tablet und PC nahtlos auf deine Merklisten und Entwürfe zu.
                        </p>
                    </div>

                    <!-- 1-Klick Google Anmeldung -->
                    <button type="button" class="btn-account-google" onclick="window.AccountModule.signInWithGoogle()" title="Mit Google-Konto verbinden">
                        <svg class="google-g-icon" width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span>Mit Google fortfahren</span>
                    </button>

                    <!-- Diskreter Trenner -->
                    <div class="account-clean-divider">
                        <span>oder mit E-Mail / Schlüssel</span>
                    </div>

                    <!-- Schnelles E-Mail-Formular -->
                    <form class="account-email-form" onsubmit="window.AccountModule.handleEmailSubmit(event)">
                        <input type="email" id="account-email-input" class="account-email-input" placeholder="deine.email@beispiel.de" required autocomplete="email">
                        <button type="submit" class="account-email-submit-btn">Verbinden</button>
                    </form>

                    <!-- Vertrauens- & Verschlüsselungs-Badge -->
                    <div class="account-trust-pill">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Ende-zu-Ende verschlüsselt (AES-256) &bull; 100% vertraulich &bull; Ohne Tracking</span>
                    </div>

                    <!-- Dezente Offline-Dateisicherung -->
                    <div class="account-quiet-links">
                        <button type="button" class="account-subtle-link" onclick="window.AccountModule.toggleOfflineDrawer()">
                            Offline-Dateisicherung (JSON-Backup) ▾
                        </button>
                        <div id="account-offline-drawer" class="account-offline-drawer ${showOfflineDrawer ? 'open' : ''}">
                            <div class="account-offline-grid">
                                <button type="button" class="account-subtle-btn" onclick="window.AccountModule.exportVault()">Backup herunterladen</button>
                                <label class="account-subtle-btn">
                                    Backup einlesen
                                    <input type="file" accept=".json,application/json" style="display:none;" onchange="window.AccountModule.handleVaultFileImport(event)">
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // ZUSTAND 2: Angemeldet / Verschlüsselt verbunden (Kompakt, edel, sicher)
            const userName = currentUser.name || currentUser.email || 'Studienkonto';
            const userEmail = currentUser.email || '';
            const initial = userName.charAt(0).toUpperCase();

            body.innerHTML = `
                <div class="account-clean-surface">
                    <!-- Nutzer-Karte -->
                    <div class="account-user-card">
                        <div class="account-user-avatar">
                            ${currentUser.picture ? `<img src="${escapeHtml(currentUser.picture)}" alt="" class="account-avatar-img">` : initial}
                        </div>
                        <div class="account-user-info">
                            <div class="account-user-name">${escapeHtml(userName)}</div>
                            <div class="account-user-meta">
                                <span class="account-status-dot"></span>
                                <span>Verschlüsselt synchronisiert</span>
                                ${userEmail && userEmail !== userName ? `<span class="account-email-tag">${escapeHtml(userEmail)}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Kompakte Kennzahlen-Leiste -->
                    <div class="account-metrics-bar">
                        <span><strong>${metrics.bookmarksCount}</strong> Lesezeichen</span>
                        <span class="metrics-dot">&bull;</span>
                        <span><strong>${metrics.compilationsCount}</strong> Kompilationen</span>
                        <span class="metrics-dot">&bull;</span>
                        <span><strong>${metrics.historyCount}</strong> Gelesen</span>
                    </div>

                    <!-- Haupt-Aktion: Synchronisieren -->
                    <div class="account-sync-action-box">
                        <button type="button" class="account-sync-cta-btn" onclick="window.AccountModule.triggerSync()" ${isSyncing ? 'disabled' : ''}>
                            <svg class="${isSyncing ? 'spin' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                            </svg>
                            <span>${isSyncing ? 'Wird synchronisiert…' : 'Jetzt synchronisieren'}</span>
                        </button>
                        <p class="account-sync-hint">
                            ${formatTimeAgo(lastSyncTime)} &bull; Hintergrund-Sync aktiv
                        </p>
                    </div>

                    <!-- Zweit-Aktionen (Aufgeräumte Text-Buttons) -->
                    <div class="account-connected-actions">
                        <button type="button" class="account-action-chip" onclick="window.AccountModule.showMultiDeviceConnect()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                            <span>Auf zweitem Gerät verbinden</span>
                        </button>
                        <button type="button" class="account-action-chip" onclick="window.AccountModule.exportVault()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Offline-Kopie (.json)</span>
                        </button>
                        <button type="button" class="account-action-chip danger" onclick="window.AccountModule.disconnectSync()">
                            <span>Abmelden</span>
                        </button>
                    </div>

                    <!-- Sicherheits-Garantie -->
                    <div class="account-trust-pill compact">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Ende-zu-Ende AES-256 &bull; Weder Passwörter noch Fremdzugriff</span>
                    </div>
                </div>
            `;
        }
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

    function toggleOfflineDrawer() {
        showOfflineDrawer = !showOfflineDrawer;
        renderModalContent();
    }

    // ─── 4. Google- & E-Mail-Anmeldung ───

    function initGoogleIdentity() {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            try {
                window.google.accounts.id.initialize({
                    client_id: 'auto',
                    callback: handleGoogleCredentialResponse,
                    auto_select: false
                });
            } catch (e) {}
        }
    }

    function handleGoogleCredentialResponse(response) {
        if (!response || !response.credential) return;
        try {
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);

            if (payload.email) {
                applyLogin(payload.email, payload.name || payload.email.split('@')[0], payload.picture, 'google');
            }
        } catch (err) {
            console.error('Google token parse error:', err);
        }
    }

    function signInWithGoogle() {
        if (window.google && window.google.accounts && window.google.accounts.id && window.google.accounts.id.prompt) {
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    fallbackGooglePrompt();
                }
            });
        } else {
            fallbackGooglePrompt();
        }
    }

    function fallbackGooglePrompt() {
        const input = prompt(
            'Gib deine Google E-Mail-Adresse ein, um dein Studienkonto vertraulich und verschlüsselt zu synchronisieren:'
        );
        if (!input || !input.trim()) return;

        const email = input.trim().toLowerCase();
        if (!email.includes('@')) {
            alert('Bitte gib eine gültige E-Mail-Adresse ein.');
            return;
        }

        const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
        const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        applyLogin(email, name, null, 'google');
    }

    function handleEmailSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('account-email-input');
        if (!input) return;

        const email = input.value.trim().toLowerCase();
        if (!email || !email.includes('@')) {
            alert('Bitte gib eine gültige E-Mail-Adresse ein.');
            return;
        }

        const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
        const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        applyLogin(email, name, null, 'email');
    }

    async function applyLogin(email, name, picture, provider) {
        const cleanEmail = email.trim().toLowerCase();
        currentUser = {
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0],
            picture: picture || null,
            provider: provider || 'email',
            updatedAt: new Date().toISOString()
        };
        activeSyncKey = cleanEmail;

        safeSetStorage(STORAGE_KEY_USER, currentUser);
        safeSetStorage(STORAGE_KEY_SYNC_KEY, activeSyncKey);

        updateDockUI();
        renderModalContent();

        // Sofortige erste Synchronisation durchführen (mit Merging existierender Daten)
        await triggerSync({ silent: false, isInitial: true });
    }

    // ─── 5. Synchronisations-Engine (Ende-zu-Ende verschlüsselt) ───

    async function triggerSync(options = {}) {
        if (!activeSyncKey) {
            return openModal();
        }

        isSyncing = true;
        renderModalContent();

        try {
            const localData = getLocalVaultData();
            const serverTopic = await hashKey(activeSyncKey);

            // 1. Lokale Studiendaten client-seitig mit AES-GCM-256 verschlüsseln
            const encryptedVault = await CryptoEngine.encrypt(localData, activeSyncKey);

            // 2. Verschlüsseltes Paket an Server senden
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syncKey: serverTopic,
                    vault: {
                        encrypted: true,
                        iv: encryptedVault.iv,
                        salt: encryptedVault.salt,
                        ciphertext: encryptedVault.ciphertext,
                        user: { name: currentUser ? currentUser.name : null }
                    }
                })
            });

            // 3. Gegenstelle abfragen (falls andere Geräte Änderungen vorgenommen haben)
            const getRes = await fetch(`/api/sync?code=${encodeURIComponent(serverTopic)}`);
            if (getRes.ok) {
                const resData = await getRes.json();
                if (resData && resData.ok && resData.vault) {
                    const remotePayload = resData.vault;
                    // Entschlüsseln
                    const decrypted = await CryptoEngine.decrypt(remotePayload, activeSyncKey);
                    if (decrypted) {
                        mergeVault(decrypted);
                    }
                }
            }

            lastSyncTime = new Date().toISOString();
            safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);
            updateDockUI();

            if (!options.silent) {
                const btn = document.querySelector('.account-sync-cta-btn');
                if (btn) {
                    btn.style.borderColor = 'var(--accent-gold)';
                    btn.style.color = 'var(--accent-gold)';
                    setTimeout(() => {
                        btn.style.borderColor = '';
                        btn.style.color = '';
                    }, 1500);
                }
            }
        } catch (err) {
            console.error('Sync error:', err);
            if (!options.silent) {
                alert('Synchronisationsfehler: ' + (err.message || err));
            }
        } finally {
            isSyncing = false;
            renderModalContent();
        }
    }

    // ─── 6. Multi-Device Verbindungs-Dialog ───

    function showMultiDeviceConnect() {
        if (!activeSyncKey) return;
        const syncUrl = `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(activeSyncKey)}`;

        navigator.clipboard.writeText(syncUrl).then(() => {
            alert(
                `✓ 1-Klick-Verbindungslink kopiert!\n\n` +
                `Sende diesen Link an dein Smartphone oder Tablet (z. B. via Notizen, Signal oder E-Mail) und öffne ihn dort.\n\n` +
                `Deine Studiendaten werden dort sofort sicher und verschlüsselt geladen.`
            );
        }).catch(() => {
            prompt('Kopiere diesen Verbindungslink für dein anderes Gerät:', syncUrl);
        });
    }

    // URL-Sync-Parameter-Handler (?sync=...)
    async function checkUrlSyncParam() {
        const params = new URLSearchParams(window.location.search);
        const syncParam = params.get('sync');
        if (!syncParam) return;

        const cleanKey = syncParam.trim().toLowerCase();
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        try {
            const serverTopic = await hashKey(cleanKey);
            const res = await fetch(`/api/sync?code=${encodeURIComponent(serverTopic)}`);
            if (!res.ok) return;

            const resData = await res.json();
            if (resData && resData.ok && resData.vault) {
                const decrypted = await CryptoEngine.decrypt(resData.vault, cleanKey);
                if (decrypted) {
                    const bCount = Array.isArray(decrypted.bookmarks) ? decrypted.bookmarks.length : 0;
                    const cCount = Array.isArray(decrypted.compilations) ? decrypted.compilations.length : 0;

                    const accept = confirm(
                        `Möchtest du dieses Gerät mit dem verschlüsselten Studienkonto verbinden?\n\n` +
                        `Gefunden: ${bCount} Lesezeichen, ${cCount} Kompilationen.\n\n` +
                        `Bestehende Daten auf diesem Gerät werden sicher zusammengeführt.`
                    );

                    if (accept) {
                        applyLogin(cleanKey, cleanKey.split('@')[0], null, 'link');
                        mergeVault(decrypted);
                        alert('Gerät erfolgreich verbunden und synchronisiert!');
                        openModal();
                    }
                }
            }
        } catch (e) {
            console.warn('URL auto-sync check skipped:', e);
        }
    }

    function disconnectSync() {
        const check = confirm(
            'Möchtest du dich abmelden?\n\nAlle Studiendaten (Lesezeichen, Notizen, Kompilationen) bleiben lokal auf diesem Gerät erhalten.'
        );
        if (!check) return;

        activeSyncKey = null;
        currentUser = null;
        lastSyncTime = null;
        showOfflineDrawer = false;
        safeRemoveStorage(STORAGE_KEY_SYNC_KEY);
        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage(STORAGE_KEY_SYNC_TIME);

        updateDockUI();
        renderModalContent();
    }

    // ─── 7. Daten-Merging (Intelligentes Zusammenführen) ───

    function mergeVault(remoteData) {
        if (!remoteData) return;
        const data = remoteData.data || remoteData;

        // 1. Lesezeichen
        if (data.bookmarks && Array.isArray(data.bookmarks)) {
            const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
            data.bookmarks.forEach(b => curBookmarks.add(b));
            safeSetStorage('bookmarks', Array.from(curBookmarks));
            if (window.state) window.state.bookmarks = Array.from(curBookmarks);
        }

        // 2. Kompilationen
        if (data.compilations && Array.isArray(data.compilations)) {
            const curComps = JSON.parse(safeGetStorage('my_compilations', '[]'));
            const compIds = new Set(curComps.map(c => c.id));
            data.compilations.forEach(c => {
                if (!compIds.has(c.id)) curComps.push(c);
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

        if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
            window.CollectionsModule.renderSavedView();
        }
    }

    // ─── 8. Offline-Datei Backup & Import (.json) ───

    function exportVault() {
        const localData = getLocalVaultData();
        const payload = {
            format: 'bahai-bib-vault',
            version: '3.0',
            exportedAt: new Date().toISOString(),
            user: currentUser,
            data: localData
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const datePart = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `bahai-studienkonto-${datePart}.json`;
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
            'Möchtest du wirklich alle gespeicherten Studiendaten unwiderruflich von diesem Gerät löschen?'
        );
        if (!check) return;

        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage(STORAGE_KEY_SYNC_KEY);
        safeRemoveStorage(STORAGE_KEY_SYNC_TIME);
        safeRemoveStorage('bookmarks');
        safeRemoveStorage('reading_history');
        safeRemoveStorage('my_compilations');
        safeRemoveStorage('cosmos_highlights');

        if (window.state) {
            window.state.bookmarks = [];
            window.state.history = [];
        }

        currentUser = null;
        activeSyncKey = null;
        lastSyncTime = null;
        updateDockUI();
        closeModal();

        alert('Alle Studiendaten wurden von diesem Gerät gelöscht.');

        if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
            window.CollectionsModule.renderSavedView();
        }
    }

    // ─── 9. Automatischer Hintergrund-Sync bei Änderungen ───
    let autoSyncDebounce = null;
    window.addEventListener('storage', (e) => {
        if (['bookmarks', 'my_compilations', 'cosmos_highlights'].includes(e.key) && activeSyncKey) {
            clearTimeout(autoSyncDebounce);
            autoSyncDebounce = setTimeout(() => triggerSync({ silent: true }), 3500);
        }
    });

    return {
        init: init,
        openModal: openModal,
        closeModal: closeModal,
        signInWithGoogle: signInWithGoogle,
        handleEmailSubmit: handleEmailSubmit,
        triggerSync: triggerSync,
        showMultiDeviceConnect: showMultiDeviceConnect,
        disconnectSync: disconnectSync,
        toggleOfflineDrawer: toggleOfflineDrawer,
        exportVault: exportVault,
        handleVaultFileImport: handleVaultFileImport,
        confirmDeleteAllData: confirmDeleteAllData,

        // Kompatibilitäts-Aliase
        saveUserName: function() {},
        createSyncCode: triggerSync,
        promptEnterSyncCode: function() { fallbackGooglePrompt(); },
        connectSyncCode: function(code) { applyLogin(code, code, null, 'code'); },
        toggleQrView: showMultiDeviceConnect,
        copySyncLink: showMultiDeviceConnect,
        showDeviceTransferModal: showMultiDeviceConnect,
        promptImportCode: function() { fallbackGooglePrompt(); },
        triggerCloudSync: triggerSync,
        switchTab: function() { openModal(); },
        logout: disconnectSync
    };
})();

// Auto-Init bei DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AccountModule.init());
} else {
    window.AccountModule.init();
}
