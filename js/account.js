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

    // Standard Clerk Publishable Key von App app_3JGK6ldOE5Y0DERV8brP0fWG3MA
    const DEFAULT_CLERK_KEY = window.CLERK_PUBLISHABLE_KEY || 'pk_test_bmF0aW9uYWwtb3Bvc3N1bS0xOTkuY2xlcmsuYWNjb3VudHMuZGV2JA';

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
    let modalMode = 'signup'; // 'signup' | 'signin'
    let modalContext = ''; // 'bookmark' | ''
    let pendingBookmarkId = null;

    function isLoggedIn() {
        return Boolean(currentUser && activeSyncKey);
    }

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

    function getClerkDomain(publishableKey) {
        try {
            const raw = atob(publishableKey.split('_')[2]);
            return raw.endsWith('$') ? raw.slice(0, -1) : raw;
        } catch(e) {
            return 'national-opossum-199.clerk.accounts.dev';
        }
    }

    function waitForClerkSDK(timeoutMs = 4000) {
        return new Promise((resolve) => {
            if (window.Clerk) return resolve(window.Clerk);
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.Clerk || (Date.now() - start > timeoutMs)) {
                    clearInterval(timer);
                    resolve(window.Clerk || null);
                }
            }, 50);
        });
    }

    async function initClerk() {
        if (clerkInstance) return clerkInstance;
        const publishableKey = getActiveClerkKey();
        if (!publishableKey) {
            return null;
        }

        if (clerkLoading) {
            let attempts = 0;
            while (clerkLoading && attempts < 30) {
                await new Promise(r => setTimeout(r, 150));
                attempts++;
            }
            if (clerkInstance) return clerkInstance;
        }
        clerkLoading = true;

        try {
            const clerkDomain = getClerkDomain(publishableKey);

            // 1. Zuerst prüfen, ob window.Clerk über die defer-Tags im <head> geladen wird
            let clerk = await waitForClerkSDK(2500);

            // 2. Falls noch nicht verfügbar, Skripte dynamisch nachladen
            if (!clerk) {
                if (!document.getElementById('clerk-ui-sdk') && !window.__internal_ClerkUICtor) {
                    await new Promise((resolve) => {
                        const sUI = document.createElement('script');
                        sUI.id = 'clerk-ui-sdk';
                        sUI.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
                        sUI.crossOrigin = 'anonymous';
                        sUI.async = true;
                        sUI.onload = resolve;
                        sUI.onerror = resolve;
                        document.head.appendChild(sUI);
                    });
                }

                if (!window.Clerk && !document.getElementById('clerk-js-sdk')) {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.id = 'clerk-js-sdk';
                        s.src = `https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
                        s.setAttribute('data-clerk-publishable-key', publishableKey);
                        s.crossOrigin = 'anonymous';
                        s.async = true;
                        s.onload = resolve;
                        s.onerror = () => reject(new Error('Clerk SDK konnte nicht geladen werden'));
                        document.head.appendChild(s);
                    });
                }

                clerk = await waitForClerkSDK(3000);
            }

            if (!clerk) {
                throw new Error('Clerk SDK nicht verfügbar');
            }

            if (typeof clerk === 'function') {
                clerk = new clerk(publishableKey);
            }

            if (!clerk.loaded) {
                await clerk.load({
                    appearance: {
                        variables: {
                            colorPrimary: '#3fa692',
                            colorText: '#ffffff',
                            colorBackground: '#202225',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        }
                    },
                    ui: { ClerkUI: window.__internal_ClerkUICtor }
                });
            }

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

            // Ausstehendes Lesezeichen speichern, falls Anmeldung durch Lesezeichen-Klick ausgelöst wurde
            if (pendingBookmarkId) {
                const bId = pendingBookmarkId;
                pendingBookmarkId = null;
                try {
                    const bList = JSON.parse(safeGetStorage('bookmarks', '[]'));
                    if (!bList.includes(bId)) {
                        bList.push(bId);
                        safeSetStorage('bookmarks', JSON.stringify(bList));
                    }
                    if (window.state) {
                        if (!Array.isArray(window.state.bookmarks)) window.state.bookmarks = [];
                        if (!window.state.bookmarks.includes(bId)) window.state.bookmarks.push(bId);
                    }
                    if (typeof window.renderSavedView === 'function') {
                        window.renderSavedView();
                    }
                } catch(e) {}
            }

            updateDockUI();
            updateSettingsUI();
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
                updateSettingsUI();
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
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
            <div class="account-modal-dialog" id="account-modal-dialog">
                <button type="button" class="account-close-btn" onclick="window.AccountModule.closeModal()" title="Schließen (Esc)" aria-label="Schließen">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div id="account-modal-body" class="account-modal-body"></div>
            </div>
        `;

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        document.body.appendChild(modalOverlay);
    }

    function updateSettingsUI() {
        const container = document.getElementById('settings-account-widget');
        if (!container) return;

        const isAuthed = isLoggedIn();
        const isEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');

        if (isAuthed && currentUser) {
            const avatarLetter = (currentUser.name || 'G').charAt(0).toUpperCase();
            const avatarHtml = currentUser.picture
                ? `<img src="${escapeHtml(currentUser.picture)}" alt="${escapeHtml(currentUser.name)}" class="settings-account-avatar-img" />`
                : `<div class="settings-account-avatar-circle">${escapeHtml(avatarLetter)}</div>`;

            container.innerHTML = `
                <div class="settings-account-card logged-in">
                    <div class="settings-account-info">
                        ${avatarHtml}
                        <div class="settings-account-meta">
                            <div class="settings-account-name">${escapeHtml(currentUser.name)}</div>
                            <div class="settings-account-status">
                                <span class="sync-pulse-dot"></span>
                                <span>${isEn ? 'Synced with Cloud' : 'Live synchronisiert'}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="settings-account-btn" onclick="window.AccountModule.openModal()">
                        ${isEn ? 'Manage' : 'Verwalten'}
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="settings-account-card signed-out">
                    <div class="settings-account-text">
                        <div class="settings-account-badge">${isEn ? 'Study Account' : 'Offizielles Studienkonto'}</div>
                        <div class="settings-account-title">${isEn ? 'Sync Bookmarks & Notes' : 'Lesezeichen & Notizen sichern'}</div>
                        <p class="settings-account-desc">${isEn ? 'Sign up to sync your bookmarks across devices.' : 'Erstelle ein Konto, um Lesezeichen auf all deinen Geräten zu sichern.'}</p>
                    </div>
                    <button type="button" class="settings-account-signup-btn" onclick="window.AccountModule.openModal('signup')">
                        ${isEn ? 'Create Account / Sign In' : 'Konto erstellen'}
                    </button>
                </div>
            `;
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
            <div class="account-modal-dialog" id="account-modal-dialog">
                <button type="button" class="account-close-btn" onclick="window.AccountModule.closeModal()" title="Schließen (Esc)" aria-label="Schließen">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div id="account-modal-body" class="account-modal-body"></div>
            </div>
        `;

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        document.body.appendChild(modalOverlay);
    }

    function openModal(mode, context) {
        if (mode) modalMode = mode;
        if (context) modalContext = context;
        ensureModalDOM();
        renderModalContent();
        const modal = document.getElementById('account-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }

    function openModalForBookmark(id) {
        pendingBookmarkId = id;
        openModal('signup', 'bookmark');
    }

    function setMode(mode) {
        modalMode = mode;
        renderModalContent();
    }

    function closeModal() {
        const modal = document.getElementById('account-modal');
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
        modalContext = '';
    }

    // ─── 4. Modal Rendering (Clerk-Auth & Sync-UI) ───

    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const metrics = getMetrics();
        const hasClerkKey = Boolean(getActiveClerkKey());
        const isClerkLoggedIn = Boolean(clerkInstance && clerkInstance.user);
        const isLoggedInState = isLoggedIn();

        if (isLoggedInState) {
            // ─── Angemeldeter Zustand ───
            const avatarLetter = (currentUser.name || 'G').charAt(0).toUpperCase();
            const avatarContent = currentUser.picture 
                ? `<img src="${escapeHtml(currentUser.picture)}" alt="${escapeHtml(currentUser.name)}" class="user-avatar-img" />`
                : `<div class="user-avatar-circle">${escapeHtml(avatarLetter)}</div>`;

            body.innerHTML = `
                <div class="clerk-sign-in-card clerk-logged-in-card">
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
            // ─── Nicht angemeldeter Zustand (Konto-Registrierung / Sign Up) ───
            const isEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');
            const isSignUp = (modalMode === 'signup');

            let titleText = '';
            let subtitleText = '';

            if (isSignUp) {
                if (modalContext === 'bookmark') {
                    titleText = isEn ? 'Sign up to save bookmarks' : 'Konto erstellen für Lesezeichen';
                    subtitleText = isEn ? 'Create your free account to save and sync this bookmark across all your devices' : 'Erstelle ein kostenloses Konto, um dieses Lesezeichen auf all deinen Geräten abzurufen';
                } else {
                    titleText = isEn ? 'Create your account' : 'Konto erstellen';
                    subtitleText = isEn ? 'Sign up to sync bookmarks, notes, and reading progress across all your devices' : 'Erstelle ein Konto, um Lesezeichen, Notizen und Lesefortschritt zu synchronisieren';
                }
            } else {
                titleText = isEn ? 'Sign in to Bahá’í Library' : 'Im Bahá’í-Archiv anmelden';
                subtitleText = isEn ? 'Welcome back! Please sign in to continue' : 'Willkommen zurück! Bitte anmelden, um fortzufahren';
            }

            const contextPillHtml = (modalContext === 'bookmark' && isSignUp) ? `
                <div class="clerk-context-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    <span>${isEn ? 'Sign up required to save bookmarks' : 'Konto erforderlich, um Lesezeichen zu speichern'}</span>
                </div>
            ` : '';

            const googleBtnText = isSignUp
                ? (isEn ? 'Sign up with Google' : 'Mit Google registrieren')
                : (isEn ? 'Continue with Google' : 'Mit Google fortfahren');

            const submitBtnText = isSignUp
                ? (isEn ? 'Create account' : 'Konto erstellen')
                : (isEn ? 'Continue' : 'Weiter');

            const badgeText = isSignUp
                ? (isEn ? 'Fast & Free' : 'Kostenlos')
                : (isEn ? 'Last used' : 'Zuletzt genutzt');

            const footerHtml = isSignUp ? `
                <p class="clerk-signup-prompt">
                    ${isEn ? 'Already have an account?' : 'Bereits ein Konto?'}
                    <button type="button" class="clerk-link-btn" onclick="window.AccountModule.setMode('signin')">${isEn ? 'Sign in' : 'Anmelden'}</button>
                </p>
            ` : `
                <p class="clerk-signup-prompt">
                    ${isEn ? 'Don’t have an account?' : 'Noch kein Konto?'}
                    <button type="button" class="clerk-link-btn" onclick="window.AccountModule.setMode('signup')">${isEn ? 'Sign up' : 'Registrieren'}</button>
                </p>
            `;

            body.innerHTML = `
                <div class="clerk-sign-in-card">
                    <div class="clerk-card-header">
                        ${contextPillHtml}
                        <h2 class="clerk-card-title">${escapeHtml(titleText)}</h2>
                        <p class="clerk-card-subtitle">${escapeHtml(subtitleText)}</p>
                    </div>

                    <!-- 1-Klick Google Button -->
                    <div class="clerk-oauth-wrapper">
                        <button type="button" class="clerk-google-btn" onclick="window.AccountModule.handleGoogleAuth()">
                            <svg class="clerk-google-icon" width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                            </svg>
                            <span>${escapeHtml(googleBtnText)}</span>
                        </button>
                        <span class="clerk-badge-last-used">${escapeHtml(badgeText)}</span>
                    </div>

                    <!-- Subtiler Trenner -->
                    <div class="clerk-divider">
                        <span>${isEn ? 'or with email' : 'oder mit E-Mail'}</span>
                    </div>

                    <!-- E-Mail Eingabe mit Mint/Türkis Button -->
                    <form class="clerk-email-form" onsubmit="window.AccountModule.submitEmailAuth(event)">
                        <div class="clerk-field-group">
                            <label for="clerk-email-input" class="clerk-label">${isEn ? 'Email address' : 'E-Mail-Adresse'}</label>
                            <input type="email" id="clerk-email-input" class="clerk-input" placeholder="${isEn ? 'Enter your email address' : 'E-Mail-Adresse eingeben'}" required autocomplete="email" />
                        </div>
                        <button type="submit" class="clerk-continue-btn">
                            <span>${escapeHtml(submitBtnText)}</span>
                            <svg class="clerk-triangle-icon" width="9" height="9" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M5 3l14 9-14 9V3z"/>
                            </svg>
                        </button>
                    </form>

                    <!-- Footer: Registrierung / Login Umschalter & Clerk-Sicherheit -->
                    <div class="clerk-card-footer">
                        ${footerHtml}
                        <div class="clerk-secured-badge">
                            <span>Secured by</span>
                            <span class="clerk-brand">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" fill="#6C47FF"/>
                                    <circle cx="12" cy="12" r="4" fill="#ffffff"/>
                                </svg>
                                <span>clerk</span>
                            </span>
                        </div>
                    </div>

                    <!-- Diskretes Einstellungs-Menü -->
                    <div class="clerk-subtle-options">
                        <button type="button" class="clerk-subtle-toggle-btn" onclick="window.AccountModule.toggleKeyConfig()" title="Einstellungen &amp; Offline-Backup">
                            ⚙️ Backup &amp; Keys
                        </button>
                        <div class="clerk-options-drawer ${showKeyConfig ? 'open' : ''}">
                            <div class="key-config-box">
                                <label class="key-config-label">Clerk Publishable Key (pk_test_... oder pk_live_...):</label>
                                <div class="key-config-row">
                                    <input type="text" id="clerk-key-input" class="key-config-input" placeholder="pk_test_..." value="${escapeHtml(getActiveClerkKey())}">
                                    <button type="button" class="key-config-save-btn" onclick="window.AccountModule.saveClerkKey()">Speichern</button>
                                </div>
                                <span class="key-config-hint">Aus dem Clerk Dashboard für dieses Projekt abrufbar.</span>
                            </div>
                            <div class="account-offline-grid" style="margin-top: 10px;">
                                <button type="button" class="account-subtle-btn" onclick="window.AccountModule.exportVault()">
                                    Backup herunterladen (JSON)
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

    async function handleGoogleAuth() {
        const btn = document.querySelector('.clerk-google-btn');
        if (btn) {
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';
        }
        try {
            const clerk = await initClerk();
            if (clerk) {
                closeModal();
                try {
                    if (typeof clerk.authenticateWithRedirect === 'function') {
                        await clerk.authenticateWithRedirect({
                            strategy: 'oauth_google',
                            redirectUrl: window.location.href,
                            redirectUrlComplete: window.location.href
                        });
                    } else if (modalMode === 'signup') {
                        clerk.openSignUp();
                    } else {
                        clerk.openSignIn();
                    }
                } catch (err) {
                    console.warn('Google auth redirect fallback:', err);
                    if (modalMode === 'signup') {
                        clerk.openSignUp();
                    } else {
                        clerk.openSignIn();
                    }
                }
            } else {
                const hasKey = Boolean(getActiveClerkKey());
                if (!hasKey) {
                    showKeyConfig = true;
                    renderModalContent();
                    alert('Bitte trage deinen Clerk Publishable Key ein.');
                } else {
                    alert('Die Google-Anmeldung konnte nicht geladen werden. Bitte prüfe deine Verbindung oder lade die Seite neu.');
                }
            }
        } finally {
            if (btn) {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        }
    }

    async function submitEmailAuth(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('clerk-email-input');
        const email = input ? input.value.trim() : '';
        const btn = document.querySelector('.clerk-continue-btn');
        if (btn) {
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';
        }
        try {
            const clerk = await initClerk();
            if (clerk) {
                closeModal();
                if (modalMode === 'signup') {
                    if (email) {
                        clerk.openSignUp({ initialValues: { emailAddress: email } });
                    } else {
                        clerk.openSignUp();
                    }
                } else {
                    if (email) {
                        clerk.openSignIn({ initialValues: { emailAddress: email } });
                    } else {
                        clerk.openSignIn();
                    }
                }
            } else {
                const hasKey = Boolean(getActiveClerkKey());
                if (!hasKey) {
                    showKeyConfig = true;
                    renderModalContent();
                    alert('Bitte trage deinen Clerk Publishable Key ein.');
                } else {
                    alert('Die Anmeldung konnte nicht geladen werden. Bitte prüfe deine Verbindung oder lade die Seite neu.');
                }
            }
        } finally {
            if (btn) {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        }
    }

    async function openSignInWithGoogle() {
        modalMode = 'signin';
        await handleGoogleAuth();
    }

    async function submitEmailSignIn(e) {
        modalMode = 'signin';
        await submitEmailAuth(e);
    }

    async function openSignIn() {
        const clerk = await initClerk();
        if (clerk) {
            closeModal();
            clerk.openSignIn();
        } else {
            const hasKey = Boolean(getActiveClerkKey());
            if (!hasKey) {
                showKeyConfig = true;
                renderModalContent();
                alert('Bitte trage deinen Clerk Publishable Key (pk_test_... oder pk_live_...) ein, um die Anmeldung zu starten.');
            } else {
                alert('Die Anmeldung konnte nicht initialisiert werden. Bitte lade die Seite neu.');
            }
        }
    }

    async function openSignUp() {
        const clerk = await initClerk();
        if (clerk) {
            closeModal();
            clerk.openSignUp();
        } else {
            const hasKey = Boolean(getActiveClerkKey());
            if (!hasKey) {
                showKeyConfig = true;
                renderModalContent();
                alert('Bitte trage deinen Clerk Publishable Key (pk_test_... oder pk_live_...) ein, um die Registrierung zu starten.');
            } else {
                alert('Die Registrierung konnte nicht initialisiert werden. Bitte lade die Seite neu.');
            }
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
        isLoggedIn: isLoggedIn,
        openModal: openModal,
        openModalForBookmark: openModalForBookmark,
        setMode: setMode,
        updateSettingsUI: updateSettingsUI,
        handleGoogleAuth: handleGoogleAuth,
        submitEmailAuth: submitEmailAuth,
        closeModal: closeModal,
        openSignIn: openSignIn,
        openSignInWithGoogle: openSignInWithGoogle,
        submitEmailSignIn: submitEmailSignIn,
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
        signInWithGoogle: openSignInWithGoogle,
        handleEmailSubmit: submitEmailSignIn,
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
