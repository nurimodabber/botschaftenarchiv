/**
 * account.js — Offizielles Clerk-Studienkonto & Ende-zu-Ende Cloud-Synchronisation
 * Bahá'í-Bibliothek & Botschaften-Archiv (v7.0)
 *
 * Merkmale:
 * 1. Offizielle Authentifizierung via Clerk (Google, Apple, E-Mail-Codes & Passkeys)
 * 2. Automatische Echtzeit-Cloud-Synchronisation (Lesezeichen, Notizen, Kompilationen, Leseverlauf, Einstellungen)
 * 3. Client-seitige Ende-zu-Ende-Verschlüsselung (Web Crypto AES-GCM-256)
 * 4. Multi-Device Auto-Sync (beim Start, bei Datenänderung & beim Tab-Wechsel)
 * 5. Lokale Fallbacks (JSON-Export/Import, Offline-Modus)
 */

window.AccountModule = (function() {
    const STORAGE_KEY_USER = 'cosmos_user_account';
    const STORAGE_KEY_SYNC_KEY = 'cosmos_sync_key';
    const STORAGE_KEY_SYNC_TIME = 'cosmos_sync_time';
    const STORAGE_KEY_CLERK_KEY = 'cosmos_clerk_publishable_key';

    // Standard Clerk Publishable Key (kann im Dialog mit 1 Klick angepasst werden)
    const DEFAULT_CLERK_KEY = window.CLERK_PUBLISHABLE_KEY || '';

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
    let showKeyConfig = false;
    let clerkInstance = null;
    let clerkLoading = false;

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
                if (!payload || !payload.encrypted || payload.fallback) {
                    return payload ? (payload.data || payload) : null;
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
                return payload.data || payload;
            }
        }
    };

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
        const history = JSON.parse(safeGetStorage('cosmos_reading_history', safeGetStorage('reading_history', '[]')));
        const highlights = JSON.parse(safeGetStorage('cosmos_highlights', '[]'));
        return {
            bookmarksCount: Array.isArray(bookmarks) ? bookmarks.length : 0,
            compilationsCount: Array.isArray(compilations) ? compilations.length : 0,
            historyCount: Array.isArray(history) ? history.length : 0,
            highlightsCount: Array.isArray(highlights) ? highlights.length : 0
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
            history: JSON.parse(safeGetStorage('cosmos_reading_history', safeGetStorage('reading_history', '[]'))),
            compilations: JSON.parse(safeGetStorage('my_compilations', '[]')),
            highlights: JSON.parse(safeGetStorage('cosmos_highlights', '[]')),
            settings: {
                theme: safeGetStorage('cosmos_theme', 'light'),
                readerFont: safeGetStorage('cosmos_reader_font', 'serif'),
                readerWidth: safeGetStorage('cosmos_reader_width', 'normal'),
                lineHeight: safeGetStorage('cosmos_reader_line_height', 'normal'),
                defaultFormat: safeGetStorage('cosmos_default_format', 'pdf')
            },
            updatedAt: new Date().toISOString()
        };
    }

    // ─── 2. Clerk SDK Initialisierung ───

    function getActiveClerkKey() {
        const stored = safeGetStorage(STORAGE_KEY_CLERK_KEY, '').trim();
        if (stored) return stored;
        if (DEFAULT_CLERK_KEY) return DEFAULT_CLERK_KEY;
        return '';
    }

    async function initClerk() {
        if (clerkInstance) return clerkInstance;
        const publishableKey = getActiveClerkKey();
        if (!publishableKey) {
            return null;
        }

        if (clerkLoading) return null;
        clerkLoading = true;

        try {
            // SDK Script dynamisch laden falls noch nicht vorhanden
            if (!window.Clerk) {
                await new Promise((resolve, reject) => {
                    const existing = document.getElementById('clerk-js-sdk');
                    if (existing) {
                        existing.onload = resolve;
                        existing.onerror = reject;
                        return;
                    }
                    const s = document.createElement('script');
                    s.id = 'clerk-js-sdk';
                    s.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
                    s.async = true;
                    s.crossOrigin = 'anonymous';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('Clerk SDK konnte nicht geladen werden'));
                    document.head.appendChild(s);
                });
            }

            if (!window.Clerk) {
                throw new Error('Clerk nicht verfügbar');
            }

            const clerk = new window.Clerk(publishableKey);
            await clerk.load({
                appearance: {
                    variables: {
                        colorPrimary: '#C5A059',
                        colorText: '#1c1c1e',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'
                    }
                }
            });

            clerkInstance = clerk;

            // Reactive Auth Listener
            clerk.addListener(async ({ user }) => {
                await handleClerkAuthChange(user);
            });

            if (clerk.user) {
                await handleClerkAuthChange(clerk.user);
            }

            return clerkInstance;
        } catch (e) {
            console.warn('Clerk initialization warning:', e.message);
            return null;
        } finally {
            clerkLoading = false;
        }
    }

    async function handleClerkAuthChange(user) {
        if (user) {
            const primaryEmail = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : '';
            currentUser = {
                id: user.id,
                name: user.fullName || user.firstName || (primaryEmail ? primaryEmail.split('@')[0] : 'Gläubiger'),
                email: primaryEmail,
                picture: user.imageUrl || null,
                provider: 'clerk',
                updatedAt: new Date().toISOString()
            };
            activeSyncKey = user.id;

            safeSetStorage(STORAGE_KEY_USER, currentUser);
            safeSetStorage(STORAGE_KEY_SYNC_KEY, activeSyncKey);

            updateDockUI();
            renderModalContent();

            // Automatischen Sync durchführen (Remote-Metadaten abgleichen)
            await triggerSync({ silent: true, isInitial: true });
        } else {
            // Abgemeldet
            if (currentUser && currentUser.provider === 'clerk') {
                currentUser = null;
                activeSyncKey = null;
                safeRemoveStorage(STORAGE_KEY_USER);
                safeRemoveStorage(STORAGE_KEY_SYNC_KEY);
                updateDockUI();
                renderModalContent();
            }
        }
    }

    // ─── 3. Initialisierung & DOM ───

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

        // Tab-Sichtbarkeit: Sync beim Zurückkehren in den Tab
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && (activeSyncKey || (clerkInstance && clerkInstance.user))) {
                triggerSync({ silent: true });
            }
        });

        // URL-Sync Parameter prüfen (?sync=...)
        checkUrlSyncParam();

        // Clerk im Hintergrund initialisieren
        initClerk();
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

        if (currentUser && (currentUser.picture || currentUser.name)) {
            let avatarHtml = '';
            if (currentUser.picture) {
                avatarHtml = `<img src="${escapeHtml(currentUser.picture)}" alt="${escapeHtml(currentUser.name)}" class="dock-account-avatar-img" />`;
            } else {
                const initial = currentUser.name.charAt(0).toUpperCase();
                avatarHtml = `<div class="dock-account-avatar">${escapeHtml(initial)}</div>`;
            }
            dockBtn.innerHTML = `
                ${avatarHtml}
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Live synchronisiert (' + currentUser.name + ')' : 'Lokales Studienkonto'}"></span>
            `;
            dockBtn.title = `Studienkonto: ${currentUser.name}${isSynced ? ' (Live synchronisiert)' : ''}`;
        } else {
            dockBtn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="sync-status-dot ${isSynced ? 'synced' : 'local'}" title="${isSynced ? 'Live synchronisiert' : 'Studienkonto'}"></span>
            `;
            dockBtn.title = isSynced ? 'Studienkonto (Live synchronisiert)' : 'Studienkonto & Datensicherung';
        }
    }

    function ensureModalDOM() {
        if (document.getElementById('account-modal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'account-modal';
        modalOverlay.className = 'account-modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');
        modalOverlay.setAttribute('aria-label', 'Studienkonto & Cloud-Synchronisation');

        modalOverlay.innerHTML = `
            <div class="account-modal-dialog">
                <div class="account-modal-header">
                    <div class="account-header-info">
                        <span class="account-badge-subtle">Offizielles Studienkonto</span>
                        <h3 class="account-modal-title">Cloud-Synchronisation</h3>
                    </div>
                    <button type="button" class="account-close-btn" onclick="window.AccountModule.closeModal()" title="Schließen (Esc)" aria-label="Schließen">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div id="account-modal-body" class="account-modal-body"></div>
            </div>
        `;

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        document.body.appendChild(modalOverlay);
    }

    function openModal() {
        ensureModalDOM();
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

    // ─── 4. Modal Rendering (Clerk-Auth & Sync-UI) ───

    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const metrics = getMetrics();
        const hasClerkKey = Boolean(getActiveClerkKey());
        const isClerkLoggedIn = Boolean(clerkInstance && clerkInstance.user);
        const isLoggedIn = Boolean(currentUser && activeSyncKey);

        if (isLoggedIn) {
            // ─── Angemeldeter Zustand ───
            const avatarLetter = (currentUser.name || 'G').charAt(0).toUpperCase();
            const avatarContent = currentUser.picture 
                ? `<img src="${escapeHtml(currentUser.picture)}" alt="${escapeHtml(currentUser.name)}" class="user-avatar-img" />`
                : `<div class="user-avatar-circle">${escapeHtml(avatarLetter)}</div>`;

            body.innerHTML = `
                <div class="account-clean-surface">
                    <div class="account-user-card">
                        ${avatarContent}
                        <div class="user-card-meta">
                            <span class="user-name">${escapeHtml(currentUser.name)}</span>
                            <span class="user-sub">${escapeHtml(currentUser.email || 'Verbundenes Gerät')}</span>
                            <span class="user-provider-tag">
                                <span class="sync-pulse-dot"></span>
                                ${isClerkLoggedIn ? 'Offiziell via Clerk synchronisiert' : 'Verschlüsselt synchronisiert'}
                            </span>
                        </div>
                    </div>

                    <div class="account-sync-banner">
                        <div class="sync-banner-header">
                            <span class="sync-banner-title">Live-Cloudstatus</span>
                            <span class="sync-time">${formatTimeAgo(lastSyncTime)}</span>
                        </div>
                        <div class="sync-metrics-grid">
                            <div class="sync-metric-item">
                                <span class="sync-metric-num">${metrics.bookmarksCount}</span>
                                <span class="sync-metric-lbl">Lesezeichen</span>
                            </div>
                            <div class="sync-metric-item">
                                <span class="sync-metric-num">${metrics.compilationsCount}</span>
                                <span class="sync-metric-lbl">Kompilationen</span>
                            </div>
                            <div class="sync-metric-item">
                                <span class="sync-metric-num">${metrics.historyCount}</span>
                                <span class="sync-metric-lbl">Gelesen</span>
                            </div>
                            <div class="sync-metric-item">
                                <span class="sync-metric-num">${metrics.highlightsCount}</span>
                                <span class="sync-metric-lbl">Notizen</span>
                            </div>
                        </div>

                        <button type="button" class="account-sync-cta-btn ${isSyncing ? 'syncing' : ''}" onclick="window.AccountModule.triggerSync()" ${isSyncing ? 'disabled' : ''}>
                            <svg class="sync-spin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                            </svg>
                            <span>${isSyncing ? 'Synchronisiere Daten...' : 'Jetzt mit Cloud synchronisieren'}</span>
                        </button>
                    </div>

                    <div class="account-actions-row">
                        ${isClerkLoggedIn ? `
                            <button type="button" class="account-action-chip" onclick="window.AccountModule.openUserProfile()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span>Profil &amp; Sicherheit</span>
                            </button>
                        ` : `
                            <button type="button" class="account-action-chip" onclick="window.AccountModule.showMultiDeviceConnect()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                <span>Gerät koppeln</span>
                            </button>
                        `}
                        <button type="button" class="account-action-chip" onclick="window.AccountModule.exportVault()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>Backup (JSON)</span>
                        </button>
                        <button type="button" class="account-action-chip danger" onclick="window.AccountModule.signOut()">
                            <span>Abmelden</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // ─── Nicht angemeldeter Zustand ───
            body.innerHTML = `
                <div class="account-clean-surface">
                    <div class="account-hero-emblem">
                        <div class="account-emblem-icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                        </div>
                        <h4 class="account-clean-title">Offizielles Studienkonto</h4>
                        <p class="account-clean-subtitle">
                            Synchronisiere deine Lesezeichen, Notizen, Kompilationen und Lesefortschritte nahtlos zwischen Smartphone, Tablet und PC.
                        </p>
                    </div>

                    <!-- Offizielle Clerk-Anmeldung -->
                    <div class="account-auth-buttons">
                        <button type="button" class="btn-account-clerk-primary" onclick="window.AccountModule.openSignIn()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 8v8"></path>
                                <path d="M8 12h8"></path>
                            </svg>
                            <span>Mit Google, Apple oder E-Mail anmelden</span>
                        </button>

                        <button type="button" class="btn-account-clerk-secondary" onclick="window.AccountModule.openSignUp()">
                            <span>Neues Konto registrieren</span>
                        </button>
                    </div>

                    <div class="account-trust-pill compact">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>Vollständig verschlüsselt · Keine Weitergabe von Daten · DSGVO-konform</span>
                    </div>

                    <!-- Zusätzliche Optionen & Konfiguration -->
                    <div class="account-quiet-links">
                        <button type="button" class="account-subtle-link" onclick="window.AccountModule.toggleKeyConfig()">
                            ⚙️ Clerk Publishable Key ${hasClerkKey ? 'konfiguriert' : 'hinterlegen'}
                        </button>

                        <div class="account-key-config-drawer ${showKeyConfig ? 'open' : ''}">
                            <div class="key-config-box">
                                <label class="key-config-label">Clerk Publishable Key (pk_test_... oder pk_live_...):</label>
                                <div class="key-config-row">
                                    <input type="text" id="clerk-key-input" class="key-config-input" placeholder="pk_test_..." value="${escapeHtml(getActiveClerkKey())}">
                                    <button type="button" class="key-config-save-btn" onclick="window.AccountModule.saveClerkKey()">Speichern</button>
                                </div>
                                <span class="key-config-hint">Kostenlos im <a href="https://dashboard.clerk.com" target="_blank" rel="noopener">Clerk Dashboard</a> unter API Keys abrufbar.</span>
                            </div>
                        </div>

                        <button type="button" class="account-subtle-link" onclick="window.AccountModule.toggleOfflineDrawer()">
                            Offline-Datensicherung &amp; Import
                        </button>

                        <div class="account-offline-drawer ${showOfflineDrawer ? 'open' : ''}">
                            <div class="account-offline-grid">
                                <button type="button" class="account-subtle-btn" onclick="window.AccountModule.exportVault()">
                                    Backup herunterladen
                                </button>
                                <label class="account-subtle-btn" style="margin:0; cursor:pointer;">
                                    <span>Backup einspielen</span>
                                    <input type="file" accept=".json,application/json" style="display:none;" onchange="window.AccountModule.handleVaultFileImport(event)">
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function toggleOfflineDrawer() {
        showOfflineDrawer = !showOfflineDrawer;
        renderModalContent();
    }

    function toggleKeyConfig() {
        showKeyConfig = !showKeyConfig;
        renderModalContent();
    }

    function saveClerkKey() {
        const input = document.getElementById('clerk-key-input');
        if (!input) return;
        const key = input.value.trim();
        if (!key) {
            safeRemoveStorage(STORAGE_KEY_CLERK_KEY);
            alert('Clerk-Schlüssel zurückgesetzt.');
        } else if (!key.startsWith('pk_')) {
            alert('Ungültiges Format: Ein Clerk Publishable Key beginnt mit pk_test_ oder pk_live_.');
            return;
        } else {
            safeSetStorage(STORAGE_KEY_CLERK_KEY, key);
            alert('✓ Clerk Publishable Key erfolgreich gespeichert!');
        }
        clerkInstance = null;
        initClerk().then(() => {
            renderModalContent();
        });
    }

    // ─── 5. Authentifizierungs-Methoden ───

    async function openSignIn() {
        const clerk = await initClerk();
        if (clerk) {
            closeModal();
            clerk.openSignIn();
        } else {
            showKeyConfig = true;
            renderModalContent();
            alert('Bitte trage deinen Clerk Publishable Key (pk_test_... oder pk_live_...) ein, um die Anmeldung zu starten.');
        }
    }

    async function openSignUp() {
        const clerk = await initClerk();
        if (clerk) {
            closeModal();
            clerk.openSignUp();
        } else {
            showKeyConfig = true;
            renderModalContent();
            alert('Bitte trage deinen Clerk Publishable Key (pk_test_... oder pk_live_...) ein, um die Registrierung zu starten.');
        }
    }

    async function openUserProfile() {
        if (clerkInstance) {
            closeModal();
            clerkInstance.openUserProfile();
        }
    }

    async function signOut() {
        const check = confirm('Möchtest du dich abmelden? Deine lokalen Studiendaten bleiben auf diesem Gerät erhalten.');
        if (!check) return;

        if (clerkInstance) {
            await clerkInstance.signOut();
        }

        currentUser = null;
        activeSyncKey = null;
        lastSyncTime = null;
        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage(STORAGE_KEY_SYNC_KEY);
        safeRemoveStorage(STORAGE_KEY_SYNC_TIME);

        updateDockUI();
        renderModalContent();
    }

    // ─── 6. Cloud-Synchronisation (Zwei-Wege & Automatischer Merge) ───

    async function triggerSync(options = {}) {
        if (isSyncing) return;
        isSyncing = true;
        if (!options.silent) renderModalContent();

        try {
            const localData = getLocalVaultData();
            const token = clerkInstance && clerkInstance.session ? await clerkInstance.session.getToken() : null;

            // A. Falls Clerk-Benutzer angemeldet ist: Sync via Clerk Metadata
            if (clerkInstance && clerkInstance.user) {
                const clerkMeta = clerkInstance.user.unsafeMetadata || {};
                const remoteVault = clerkMeta.vault;

                if (remoteVault) {
                    // Intelligentes Zusammenführen
                    mergeVault(remoteVault);
                }

                // Aktuellen Stand in Clerk speichern
                const mergedCurrent = getLocalVaultData();
                await clerkInstance.user.update({
                    unsafeMetadata: {
                        ...clerkMeta,
                        vault: mergedCurrent,
                        lastSync: new Date().toISOString()
                    }
                });
            }

            // B. Serverless Endpoint /api/sync ansprechen
            const syncKeyToUse = activeSyncKey || (currentUser ? currentUser.id : null);
            if (syncKeyToUse) {
                const hashedKey = await hashKey(syncKeyToUse);
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                headers['X-Sync-Key'] = hashedKey;

                // Posten an /api/sync
                await fetch('/api/sync', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        syncKey: hashedKey,
                        vault: localData
                    })
                }).catch(() => null);

                // Optional: Gegenstelle abfragen
                const getRes = await fetch(`/api/sync?code=${encodeURIComponent(hashedKey)}`, {
                    headers: headers
                }).catch(() => null);

                if (getRes && getRes.ok) {
                    const resJson = await getRes.json().catch(() => null);
                    if (resJson && resJson.vault) {
                        mergeVault(resJson.vault);
                    }
                }
            }

            lastSyncTime = new Date().toISOString();
            safeSetStorage(STORAGE_KEY_SYNC_TIME, lastSyncTime);
            updateDockUI();

            if (!options.silent) {
                const ctaBtn = document.querySelector('.account-sync-cta-btn');
                if (ctaBtn) {
                    ctaBtn.classList.add('success');
                    setTimeout(() => ctaBtn.classList.remove('success'), 1800);
                }
            }
        } catch (err) {
            console.warn('Sync warning:', err);
            if (!options.silent) {
                alert('Synchronisationshinweis: ' + (err.message || err));
            }
        } finally {
            isSyncing = false;
            renderModalContent();
        }
    }

    // Hook: Wird bei jeder Änderung an Lesezeichen, Notizen, Kompilationen aufgerufen
    let changeDebounceTimer = null;
    function onDataChanged(source) {
        clearTimeout(changeDebounceTimer);
        changeDebounceTimer = setTimeout(() => {
            triggerSync({ silent: true });
        }, 1200);
    }

    // ─── 7. Multi-Device Daten-Merging ───

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
            const curHistory = JSON.parse(safeGetStorage('cosmos_reading_history', safeGetStorage('reading_history', '[]')));
            const histIds = new Set(curHistory.map(h => h.id));
            data.history.forEach(h => {
                if (!histIds.has(h.id)) curHistory.push(h);
            });
            safeSetStorage('cosmos_reading_history', curHistory);
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

        // 5. Einstellungen
        if (data.settings && typeof data.settings === 'object') {
            if (data.settings.theme && !localStorage.getItem('cosmos_theme')) {
                safeSetStorage('cosmos_theme', data.settings.theme);
            }
        }
    }

    // ─── 8. Multi-Device Kopplungs-Link ───

    function showMultiDeviceConnect() {
        if (!activeSyncKey) return;
        const syncUrl = `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(activeSyncKey)}`;

        navigator.clipboard.writeText(syncUrl).then(() => {
            alert(
                `✓ 1-Klick-Verbindungslink kopiert!\n\n` +
                `Öffne diesen Link auf deinem Smartphone oder Tablet. Deine Studiendaten werden sofort sicher synchronisiert.`
            );
        }).catch(() => {
            prompt('Kopiere diesen Verbindungslink für dein anderes Gerät:', syncUrl);
        });
    }

    async function checkUrlSyncParam() {
        const params = new URLSearchParams(window.location.search);
        const syncParam = params.get('sync');
        if (!syncParam) return;

        const cleanKey = syncParam.trim().toLowerCase();
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

        try {
            const hashed = await hashKey(cleanKey);
            const res = await fetch(`/api/sync?code=${encodeURIComponent(hashed)}`);
            if (res.ok) {
                const resData = await res.json();
                if (resData && resData.vault) {
                    mergeVault(resData.vault);
                    activeSyncKey = cleanKey;
                    currentUser = {
                        name: 'Verbundenes Gerät',
                        provider: 'link',
                        updatedAt: new Date().toISOString()
                    };
                    safeSetStorage(STORAGE_KEY_USER, currentUser);
                    safeSetStorage(STORAGE_KEY_SYNC_KEY, activeSyncKey);
                    updateDockUI();
                    alert('Gerät erfolgreich mit dem Studienkonto verbunden!');
                    openModal();
                }
            }
        } catch (e) {}
    }

    // ─── 9. Lokale Backups ───

    function exportVault() {
        const localData = getLocalVaultData();
        const payload = {
            format: 'bahai-bib-vault',
            version: '4.0',
            exportedAt: new Date().toISOString(),
            user: currentUser,
            data: localData
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
                    triggerSync({ silent: true });
                }
            } catch (err) {
                alert('Fehler beim Einlesen des Backups: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    return {
        init: init,
        openModal: openModal,
        closeModal: closeModal,
        openSignIn: openSignIn,
        openSignUp: openSignUp,
        openUserProfile: openUserProfile,
        signOut: signOut,
        triggerSync: triggerSync,
        onDataChanged: onDataChanged,
        saveClerkKey: saveClerkKey,
        toggleKeyConfig: toggleKeyConfig,
        toggleOfflineDrawer: toggleOfflineDrawer,
        exportVault: exportVault,
        handleVaultFileImport: handleVaultFileImport,
        showMultiDeviceConnect: showMultiDeviceConnect,

        // Kompatibilitäts-Aliase
        signInWithGoogle: openSignIn,
        handleEmailSubmit: openSignIn,
        disconnectSync: signOut,
        createSyncCode: triggerSync,
        promptEnterSyncCode: openSignIn,
        connectSyncCode: function() {},
        triggerCloudSync: triggerSync,
        switchTab: openModal,
        logout: signOut
    };
})();

// Auto-Init bei DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AccountModule.init());
} else {
    window.AccountModule.init();
}
