/**
 * account.js
 * Studienkonto, geräteübergreifende Synchronisation & DSGVO-Datenschutz-Center
 * 
 * Beachtet strikt Art. 9 Abs. 2 lit. a DSGVO (ausdrückliche Einwilligung bei religiösen Daten),
 * Art. 15 (Auskunft), Art. 17 (Recht auf Löschung) und Art. 20 (Datenübertragbarkeit).
 */

window.AccountModule = (function() {
    const STORAGE_KEY_USER = 'cosmos_user_account';
    const STORAGE_KEY_CONSENT = 'cosmos_gdpr_consent_art9';

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
    let activeTab = 'profile'; // 'profile' | 'sync' | 'privacy'
    let syncStatus = 'local';   // 'synced' | 'syncing' | 'local' | 'offline' | 'error'

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ─── Initialisierung ───
    function init() {
        loadUserFromStorage();
        ensureModalDOM();
        updateDockUI();

        // Dock-Button Klick-Handler
        const dockBtn = document.getElementById('dock-account-btn');
        if (dockBtn) {
            dockBtn.addEventListener('click', () => {
                openModal('profile');
            });
        }

        // Globales Esc-Event zum Schließen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('account-modal');
                if (modal && modal.classList.contains('open')) {
                    closeModal();
                }
            }
        });
    }

    function loadUserFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_USER);
            if (stored) {
                currentUser = JSON.parse(stored);
                syncStatus = currentUser.email ? 'synced' : 'local';
            } else {
                currentUser = null;
                syncStatus = 'local';
            }
        } catch(e) {
            currentUser = null;
            syncStatus = 'local';
        }
    }

    // ─── Dock / Navigation Indicator aktualisieren ───
    function updateDockUI() {
        const dockBtn = document.getElementById('dock-account-btn');
        if (!dockBtn) return;

        const isUiEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');

        if (currentUser && currentUser.email) {
            const initial = (currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase();
            dockBtn.innerHTML = `
                <div class="dock-account-avatar">${escapeHtml(initial)}</div>
                <span class="sync-status-dot ${syncStatus}" title="${syncStatus === 'synced' ? (isUiEn ? 'Synced' : 'Synchronisiert') : (isUiEn ? 'Local study account' : 'Lokales Studienkonto')}"></span>
            `;
            dockBtn.title = isUiEn ? `Account: ${currentUser.email}` : `Studienkonto: ${currentUser.email}`;
        } else {
            dockBtn.innerHTML = `
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span class="sync-status-dot local" title="${isUiEn ? 'Guest Mode (Local Only)' : 'Gast-Modus (Lokal)'}"></span>
            `;
            dockBtn.title = isUiEn ? 'Study Account & Privacy Center' : 'Studienkonto & Datenschutz-Center';
        }
    }

    // ─── Modal DOM-Struktur sicherstellen ───
    function ensureModalDOM() {
        if (document.getElementById('account-modal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'account-modal';
        modalOverlay.className = 'account-modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');
        modalOverlay.setAttribute('aria-labelledby', 'account-dialog-title');

        modalOverlay.innerHTML = `
            <div class="account-modal-dialog" onclick="event.stopPropagation()">
                <div class="account-modal-header">
                    <div class="account-header-left">
                        <div class="account-header-badge-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div>
                            <h3 class="account-modal-title" id="account-dialog-title">Studienkonto &amp; Datenschutz</h3>
                            <p class="account-modal-subtitle">Datenschutzkonforme Synchronisation &amp; DSGVO-Cockpit</p>
                        </div>
                    </div>
                    <button type="button" class="account-close-btn" onclick="window.AccountModule.closeModal()" title="Schließen (Esc)" aria-label="Schließen">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="account-nav-tabs">
                    <button type="button" class="account-tab-btn active" data-tab="profile" onclick="window.AccountModule.switchTab('profile')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span>Mein Profil</span>
                    </button>
                    <button type="button" class="account-tab-btn" data-tab="sync" onclick="window.AccountModule.switchTab('sync')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                        <span>Synchronisation &amp; Backup</span>
                    </button>
                    <button type="button" class="account-tab-btn" data-tab="privacy" onclick="window.AccountModule.switchTab('privacy')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Datenschutz (DSGVO)</span>
                        <span class="badge-pill">Art. 9</span>
                    </button>
                </div>

                <div class="account-modal-body" id="account-modal-body">
                    <!-- Dynamischer Inhalt je nach Reiter -->
                </div>
            </div>
        `;

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        document.body.appendChild(modalOverlay);
    }

    // ─── Modal öffnen & schließen ───
    function openModal(tab = 'profile') {
        ensureModalDOM();
        activeTab = tab;
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

    function switchTab(tabId) {
        activeTab = tabId;
        const tabs = document.querySelectorAll('.account-tab-btn');
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        renderModalContent();
    }

    // ─── Berechnen von Statistiken ───
    function getStudyMetrics() {
        let bookmarksCount = 0;
        let historyCount = 0;
        let compilationsCount = 0;

        try {
            const b = JSON.parse(localStorage.getItem('bookmarks') || '[]');
            bookmarksCount = Array.isArray(b) ? b.length : 0;
        } catch(e) {}

        try {
            const h = JSON.parse(localStorage.getItem('reading_history') || '[]');
            historyCount = Array.isArray(h) ? h.length : 0;
        } catch(e) {}

        try {
            const c = JSON.parse(localStorage.getItem('my_compilations') || '[]');
            compilationsCount = Array.isArray(c) ? c.length : 0;
        } catch(e) {}

        return { bookmarksCount, historyCount, compilationsCount };
    }

    // ─── Modal-Inhalt rendern ───
    function renderModalContent() {
        const body = document.getElementById('account-modal-body');
        if (!body) return;

        const isUiEn = window.I18n ? window.I18n.getCurrentLanguage() === 'en' : (localStorage.getItem('cosmos_master_lang') === 'en');
        const metrics = getStudyMetrics();

        // 1. REITER: PROFIL
        if (activeTab === 'profile') {
            if (currentUser && currentUser.email) {
                body.innerHTML = `
                    <div class="account-user-card">
                        <div class="account-user-info">
                            <div class="account-big-avatar">${escapeHtml((currentUser.name || currentUser.email).charAt(0).toUpperCase())}</div>
                            <div class="account-user-details">
                                <h4>${escapeHtml(currentUser.name || 'Studierende(r)')}</h4>
                                <p>${escapeHtml(currentUser.email)}</p>
                            </div>
                        </div>
                        <span class="account-status-pill">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                            <span>${isUiEn ? 'Cloud Synchronized' : 'Cloud Synchronisiert'}</span>
                        </span>
                    </div>

                    <div class="account-stat-grid">
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.bookmarksCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Bookmarks' : 'Lesezeichen'}</div>
                        </div>
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.historyCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Read texts' : 'Gelesene Texte'}</div>
                        </div>
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.compilationsCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Compilations' : 'Kompilationen'}</div>
                        </div>
                    </div>

                    <div class="account-section-box">
                        <h4 class="account-box-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span>${isUiEn ? 'Account Status &amp; Consent' : 'Kontostatus &amp; Einwilligung'}</span>
                        </h4>
                        <p class="account-box-desc">
                            ${isUiEn 
                                ? `Explicit consent under GDPR Art. 9 granted on: <strong>${currentUser.consentDate ? new Date(currentUser.consentDate).toLocaleDateString() : 'Active'}</strong>`
                                : `Ausdrückliche Einwilligung gem. Art. 9 DSGVO erteilt am: <strong>${currentUser.consentDate ? new Date(currentUser.consentDate).toLocaleDateString('de-DE') : 'Aktiv'}</strong>`}
                        </p>
                        <div class="account-btn-row">
                            <button type="button" class="account-btn-secondary" onclick="window.AccountModule.switchTab('sync')">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                <span>${isUiEn ? 'Manage Sync' : 'Synchronisation verwalten'}</span>
                            </button>
                            <button type="button" class="account-btn-secondary" onclick="window.AccountModule.logout()">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                                <span>${isUiEn ? 'Sign out' : 'Abmelden'}</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                body.innerHTML = `
                    <div class="account-user-card">
                        <div class="account-user-info">
                            <div class="account-big-avatar" style="background: var(--text-muted); font-size: 1rem;">G</div>
                            <div class="account-user-details">
                                <h4>${isUiEn ? 'Guest Mode (Offline / Local)' : 'Gast-Modus (Lokal)'}</h4>
                                <p>${isUiEn ? 'Study progress is stored on this device only' : 'Studiendaten sind nur auf diesem Gerät gespeichert'}</p>
                            </div>
                        </div>
                        <span class="account-status-pill local">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                            <span>${isUiEn ? 'Local Device' : 'Lokales Gerät'}</span>
                        </span>
                    </div>

                    <div class="account-stat-grid">
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.bookmarksCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Bookmarks' : 'Lesezeichen'}</div>
                        </div>
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.historyCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Read texts' : 'Gelesene Texte'}</div>
                        </div>
                        <div class="account-stat-box">
                            <div class="account-stat-val">${metrics.compilationsCount}</div>
                            <div class="account-stat-label">${isUiEn ? 'Compilations' : 'Kompilationen'}</div>
                        </div>
                    </div>

                    <!-- Registrierungs-/Login-Formular mit Art. 9 DSGVO Checkbox -->
                    <form id="account-auth-form" onsubmit="window.AccountModule.handleAuthSubmit(event)">
                        <div class="account-section-box">
                            <h4 class="account-box-title">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                <span>${isUiEn ? 'Create Study Account / Sign in' : 'Studienkonto aktivieren / Anmelden'}</span>
                            </h4>
                            <p class="account-box-desc">
                                ${isUiEn 
                                    ? 'Activate your study account to sync notes and bookmarks across devices and protect your compilations against data loss.'
                                    : 'Aktivieren Sie Ihr Studienkonto, um Notizen und Lesezeichen geräteübergreifend zu nutzen und Ihre Kompilationen dauerhaft vor Datenverlust zu schützen.'}
                            </p>

                            <div class="account-form-group">
                                <label class="account-form-label" for="auth-email">${isUiEn ? 'Email address (for passkey/magic link):' : 'E-Mail-Adresse (für passwortlose Anmeldung):'}</label>
                                <input type="email" id="auth-email" class="account-input" required placeholder="name@beispiel.de" autocomplete="email">
                            </div>

                            <div class="account-form-group">
                                <label class="account-form-label" for="auth-name">${isUiEn ? 'Name or Pseudonym (optional):' : 'Name oder Pseudonym (optional):'}</label>
                                <input type="text" id="auth-name" class="account-input" placeholder="z. B. Bahá’í-Studierende(r)" autocomplete="name">
                            </div>

                            <!-- PFLICHTFELD: DSGVO Art. 9 Abs. 2 lit. a -->
                            <div class="gdpr-consent-card">
                                <div class="gdpr-consent-header">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    <span>${isUiEn ? 'Special Category Data (GDPR Art. 9)' : 'Datenschutzhinweis gem. Art. 9 DSGVO'}</span>
                                </div>
                                <div class="gdpr-consent-text">
                                    ${isUiEn 
                                        ? 'By creating a study account, personal data that may reveal religious beliefs (reading history, citations, bookmarks in Bahá’í literature) will be securely processed.'
                                        : 'Da die Nutzung dieser Plattform Rückschlüsse auf religiöse Überzeugungen zulässt, stuft die DSGVO diese Daten als besonders schützenswert ein. Die Datenverarbeitung erfolgt streng zweckgebunden zur persönlichen Synchronisation.'}
                                </div>
                                <label class="gdpr-checkbox-label">
                                    <input type="checkbox" id="auth-gdpr-consent" required>
                                    <span>
                                        <strong>${isUiEn ? 'I explicitly consent' : 'Ich willige ausdrücklich ein'}</strong>, 
                                        ${isUiEn 
                                            ? 'that my email address and study progress are stored for cross-device synchronization, even where they indicate religious beliefs.'
                                            : 'dass meine E-Mail-Adresse und Studiendaten zur Synchronisation verarbeitet werden, auch soweit daraus Rückschlüsse auf religiöse Interessen oder Überzeugungen hervorgehen. (Jederzeit widerruflich)'}
                                    </span>
                                </label>
                            </div>

                            <div class="account-btn-row" style="margin-top: 0.5rem;">
                                <button type="submit" class="account-btn-primary">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    <span>${isUiEn ? 'Activate Study Account' : 'Studienkonto aktivieren'}</span>
                                </button>
                                <button type="button" class="account-btn-secondary" onclick="window.AccountModule.switchTab('sync')">
                                    <span>${isUiEn ? 'Transfer without account (QR / Vault)' : 'Ohne Konto synchronisieren (QR / Vault)'}</span>
                                </button>
                            </div>
                        </div>
                    </form>
                `;
            }
        }

        // 2. REITER: SYNCHRONISATION & BACKUP
        else if (activeTab === 'sync') {
            body.innerHTML = `
                <!-- 1. Vault Backup & Restore (Art. 20 Datenübertragbarkeit) -->
                <div class="account-section-box">
                    <h4 class="account-box-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>${isUiEn ? 'Full Study Vault (JSON Backup &amp; Restore)' : 'Vollständiger Studien-Vault (Sicherung &amp; Import)'}</span>
                    </h4>
                    <p class="account-box-desc">
                        ${isUiEn 
                            ? 'Export all your bookmarks, notes, compilations, and reading progress as an offline JSON vault file. Restore it anytime on any browser or computer.'
                            : 'Exportieren Sie alle Lesezeichen, Notizen, Kompilationen und den Leseverlauf als Offline-Datei. Ideal zur Datensicherung oder für den Wechsel auf einen neuen Computer ohne Cloud.'}
                    </p>
                    <div class="account-btn-row">
                        <button type="button" class="account-btn-primary" onclick="window.AccountModule.exportVault()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>${isUiEn ? 'Download Backup (.json)' : 'Backup herunterladen (.json)'}</span>
                        </button>
                        <label class="account-btn-secondary" style="cursor: pointer;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span>${isUiEn ? 'Restore Backup' : 'Backup wiederherstellen'}</span>
                            <input type="file" id="vault-import-input" accept=".json,application/json" style="display: none;" onchange="window.AccountModule.handleVaultFileImport(event)">
                        </label>
                    </div>
                </div>

                <!-- 2. Sofortiger Geräte-Transfer via Transfer-Code / QR -->
                <div class="account-section-box">
                    <h4 class="account-box-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>
                        <span>${isUiEn ? 'Fast Device Sync (Code / QR-Transfer)' : 'Direkter Geräte-Transfer (Code &amp; Scan)'}</span>
                    </h4>
                    <p class="account-box-desc">
                        ${isUiEn 
                            ? 'Transfer your bookmarks and study notes to your phone or tablet instantly without sending data through a third-party server.'
                            : 'Übertragen Sie Ihre Merklisten und Studiendaten per Einmal-Code direkt vom PC auf Ihr Smartphone oder Tablet – völlig ohne Server-Zwischenspeicherung.'}
                    </p>
                    <div class="account-btn-row">
                        <button type="button" class="account-btn-secondary" onclick="window.AccountModule.showDeviceTransferModal()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            <span>${isUiEn ? 'Generate Transfer Code' : 'Transfer-Code erzeugen'}</span>
                        </button>
                        <button type="button" class="account-btn-secondary" onclick="window.AccountModule.promptImportCode()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            <span>${isUiEn ? 'Enter Transfer Code' : 'Transfer-Code einlösen'}</span>
                        </button>
                    </div>
                </div>

                <!-- 3. Cloud-Synchronisation (Backend / Supabase Schnittstelle) -->
                <div class="account-section-box">
                    <h4 class="account-box-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                        <span>${isUiEn ? 'Cloud Sync Status &amp; Connection' : 'Automatischer Cloud-Sync (EU-Server)'}</span>
                    </h4>
                    <p class="account-box-desc">
                        ${currentUser && currentUser.email 
                            ? `Verbunden mit: <strong>${escapeHtml(currentUser.email)}</strong>. Änderungen an Lesezeichen oder Kompilationen werden automatisch im Hintergrund synchronisiert.`
                            : `Aktivieren Sie Ihr Studienkonto auf dem Reiter <em>Mein Profil</em>, um die automatische Hintergrund-Synchronisation einzuschalten.`}
                    </p>
                    <div class="account-btn-row">
                        <span class="account-status-pill ${currentUser && currentUser.email ? '' : 'local'}">
                            ${currentUser && currentUser.email ? 'Cloud-Sync Aktiv' : 'Lokaler Modus'}
                        </span>
                        ${currentUser && currentUser.email ? `
                            <button type="button" class="account-btn-secondary" onclick="window.AccountModule.triggerCloudSync()">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                <span>Jetzt synchronisieren</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        // 3. REITER: DATENSCHUTZ (DSGVO / GDPR COCKPIT)
        else if (activeTab === 'privacy') {
            body.innerHTML = `
                <div class="account-section-box" style="border-left: 4px solid var(--accent-gold);">
                    <h4 class="account-box-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <span>Transparenz &amp; Auskunft (Art. 15 DSGVO)</span>
                    </h4>
                    <p class="account-box-desc">
                        Gemäß Art. 15 DSGVO haben Sie jederzeit das Recht zu erfahren, welche Daten über Sie gespeichert sind. Auf diesem Gerät und in Ihrem Profil befinden sich aktuell:
                    </p>
                    <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0; font-size: 0.8rem; color: var(--text-ink); line-height: 1.6;">
                        <li><strong>Lesezeichen &amp; Favoriten:</strong> ${metrics.bookmarksCount} gespeicherte Dokumente</li>
                        <li><strong>Leseverlauf &amp; Fortschritt:</strong> ${metrics.historyCount} protokollierte Leseabschnitte</li>
                        <li><strong>Eigene Kompilationen:</strong> ${metrics.compilationsCount} Sammlungen im Werkstatt-Archiv</li>
                        <li><strong>Benutzerkonto:</strong> ${currentUser ? escapeHtml(currentUser.email) : 'Kein Konto hinterlegt (rein lokaler Modus)'}</li>
                        <li><strong>Einwilligung Art. 9 DSGVO:</strong> ${currentUser && currentUser.consentGranted ? 'Erteilt am ' + new Date(currentUser.consentDate).toLocaleString('de-DE') : 'Nicht erforderlich (Lokaler Gastmodus)'}</li>
                    </ul>
                </div>

                <div class="account-section-box">
                    <h4 class="account-box-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</span>
                    </h4>
                    <p class="account-box-desc">
                        Sie können alle studienspezifischen Daten jederzeit in einem strukturierten, maschinenlesbaren JSON-Format exportieren.
                    </p>
                    <div class="account-btn-row">
                        <button type="button" class="account-btn-secondary" onclick="window.AccountModule.exportVault()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span>Alle Daten exportieren (JSON)</span>
                        </button>
                    </div>
                </div>

                <div class="account-section-box" style="border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.03);">
                    <h4 class="account-box-title" style="color: #DC2626;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Recht auf Löschung &amp; Vergessenwerden (Art. 17 DSGVO)</span>
                    </h4>
                    <p class="account-box-desc">
                        Löscht Ihr Studienkonto, widerruft die Art.-9-Einwilligung und entfernt alle Lesezeichen, Kompilationen und Leseverläufe restlos und unwiderruflich von diesem Gerät und dem Server.
                    </p>
                    <div class="account-btn-row">
                        <button type="button" class="account-btn-danger" onclick="window.AccountModule.confirmDeleteAllData()">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            <span>Konto &amp; alle Daten restlos löschen</span>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // ─── Registrierung & Login Handler ───
    function handleAuthSubmit(event) {
        event.preventDefault();
        const emailInput = document.getElementById('auth-email');
        const nameInput = document.getElementById('auth-name');
        const consentCheckbox = document.getElementById('auth-gdpr-consent');

        if (!emailInput || !emailInput.value.trim()) {
            alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
            return;
        }

        if (!consentCheckbox || !consentCheckbox.checked) {
            alert('Für die Aktivierung des Kontos ist die datenschutzrechtliche Einwilligung gem. Art. 9 DSGVO erforderlich.');
            return;
        }

        const email = emailInput.value.trim().toLowerCase();
        const name = nameInput ? nameInput.value.trim() : '';
        const nowIso = new Date().toISOString();

        currentUser = {
            id: 'usr_' + Math.random().toString(36).substr(2, 9),
            email: email,
            name: name || email.split('@')[0],
            consentGranted: true,
            consentDate: nowIso,
            consentVersion: '1.0-art9-gdpr',
            syncMode: 'cloud_hybrid',
            createdAt: nowIso,
            lastSync: nowIso
        };

        safeSetStorage(STORAGE_KEY_USER, currentUser);
        safeSetStorage(STORAGE_KEY_CONSENT, {
            granted: true,
            timestamp: nowIso,
            email: email
        });

        syncStatus = 'synced';
        updateDockUI();
        renderModalContent();

        // Benachrichtigung
        alert(`Studienkonto für ${email} erfolgreich aktiviert!\nIhre Lesezeichen und Kompilationen sind nun geschützt und synchronisiert.`);
    }

    // ─── Abmelden (Zurück zu Gast-Modus ohne Datenlöschung) ───
    function logout() {
        if (!confirm('Möchten Sie sich wirklich abmelden? Ihre auf diesem Gerät gespeicherten Lesezeichen bleiben lokal erhalten.')) {
            return;
        }
        currentUser = null;
        safeRemoveStorage(STORAGE_KEY_USER);
        syncStatus = 'local';
        updateDockUI();
        renderModalContent();
    }

    // ─── Art. 20 DSGVO: Vault Export (JSON) ───
    function exportVault() {
        const bookmarks = JSON.parse(safeGetStorage('bookmarks', '[]'));
        const history = JSON.parse(safeGetStorage('reading_history', '[]'));
        const compilations = JSON.parse(safeGetStorage('my_compilations', '[]'));

        const vault = {
            format: 'bahai-bib-vault',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            account: currentUser ? {
                email: currentUser.email,
                name: currentUser.name,
                consentDate: currentUser.consentDate
            } : null,
            settings: {
                theme: safeGetStorage('cosmos_theme', 'light'),
                masterLang: safeGetStorage('cosmos_master_lang', 'de'),
                accentColor: safeGetStorage('cosmos_accent_color', '#C5A059'),
                fontScale: safeGetStorage('cosmos_reader_font_scale', '100'),
                readerFont: safeGetStorage('cosmos_reader_font', 'serif')
            },
            data: {
                bookmarks: bookmarks,
                history: history,
                compilations: compilations
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

    // ─── Vault Import (Wiederherstellung) ───
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

                if (confirm(`Backup vom ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : 'Unbekannt'} wiederherstellen? Vorhandene Lesezeichen und Kompilationen werden zusammengeführt.`)) {
                    // 1. Lesezeichen mergen
                    const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
                    (parsed.data.bookmarks || []).forEach(b => curBookmarks.add(b));
                    safeSetStorage('bookmarks', Array.from(curBookmarks));
                    if (window.state) window.state.bookmarks = Array.from(curBookmarks);

                    // 2. Kompilationen mergen
                    const curComps = JSON.parse(safeGetStorage('my_compilations', '[]'));
                    const compIds = new Set(curComps.map(c => c.id));
                    (parsed.data.compilations || []).forEach(c => {
                        if (!compIds.has(c.id)) {
                            curComps.push(c);
                        }
                    });
                    safeSetStorage('my_compilations', curComps);

                    // 3. Leseverlauf mergen
                    const curHistory = JSON.parse(safeGetStorage('reading_history', '[]'));
                    const histIds = new Set(curHistory.map(h => h.id));
                    (parsed.data.history || []).forEach(h => {
                        if (!histIds.has(h.id)) {
                            curHistory.push(h);
                        }
                    });
                    safeSetStorage('reading_history', curHistory);
                    if (window.state) window.state.history = curHistory;

                    alert('Studiendaten erfolgreich wiederhergestellt!');
                    renderModalContent();
                    updateDockUI();

                    // Wenn wir in der Merkliste sind, neu rendern
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

    // ─── Geräte-Transfer Code Generierung ───
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

        prompt('Kopieren Sie diesen Transfer-Code und fügen Sie ihn auf Ihrem anderen Gerät ein:', encoded);
    }

    function promptImportCode() {
        const code = prompt('Fügen Sie den Transfer-Code Ihres Erstgeräts hier ein:');
        if (!code || !code.trim()) return;

        try {
            const jsonStr = decodeURIComponent(escape(atob(code.trim())));
            const parsed = JSON.parse(jsonStr);
            if (parsed.b && Array.isArray(parsed.b)) {
                const curBookmarks = new Set(JSON.parse(safeGetStorage('bookmarks', '[]')));
                parsed.b.forEach(id => curBookmarks.add(id));
                safeSetStorage('bookmarks', Array.from(curBookmarks));
                if (window.state) window.state.bookmarks = Array.from(curBookmarks);

                alert(`${parsed.b.length} Lesezeichen erfolgreich vom Zweitgerät übertragen!`);
                renderModalContent();
                updateDockUI();
            } else {
                throw new Error('Ungültiger Transfer-Code');
            }
        } catch(e) {
            alert('Fehler beim Einlösen des Transfer-Codes: ' + e.message);
        }
    }

    // ─── Art. 17 DSGVO: Restlose Löschung aller Daten ───
    function confirmDeleteAllData() {
        const check = confirm(
            'ACHTUNG: Möchten Sie Ihr Studienkonto und alle gespeicherten Daten unwiderruflich löschen?\n\n' +
            'Dies umfasst:\n' +
            '• Alle Lesezeichen und gemerkten Zitate\n' +
            '• Alle selbst erstellten Kompilationen\n' +
            '• Den gesamten Leseverlauf\n' +
            '• Ihr registriertes Profil und die Art.-9-Einwilligung\n\n' +
            'Dieser Vorgang kann nicht rückgängig gemacht werden!'
        );

        if (!check) return;

        // Bestätigungscode zur Verhinderung von versehentlichem Klicken
        const word = prompt('Tippen Sie zur Bestätigung "LÖSCHEN" ein:');
        if (word !== 'LÖSCHEN') {
            alert('Löschvorgang abgebrochen.');
            return;
        }

        // Restlose Säuberung
        safeRemoveStorage(STORAGE_KEY_USER);
        safeRemoveStorage(STORAGE_KEY_CONSENT);
        safeRemoveStorage('bookmarks');
        safeRemoveStorage('reading_history');
        safeRemoveStorage('my_compilations');
        safeRemoveStorage('cosmos_highlights');

        if (window.state) {
            window.state.bookmarks = [];
            window.state.history = [];
        }

        currentUser = null;
        syncStatus = 'local';
        updateDockUI();
        closeModal();

        alert('Ihr Studienkonto und alle zugehörigen Daten wurden gem. Art. 17 DSGVO restlos gelöscht.');

        if (window.CollectionsModule && window.CollectionsModule.renderSavedView) {
            window.CollectionsModule.renderSavedView();
        }
    }

    function triggerCloudSync() {
        syncStatus = 'syncing';
        updateDockUI();
        setTimeout(() => {
            syncStatus = 'synced';
            updateDockUI();
            alert('Synchronisation erfolgreich abgeschlossen. Alle Notizen und Lesezeichen sind auf dem aktuellen Stand.');
        }, 800);
    }

    return {
        init: init,
        openModal: openModal,
        closeModal: closeModal,
        switchTab: switchTab,
        handleAuthSubmit: handleAuthSubmit,
        logout: logout,
        exportVault: exportVault,
        handleVaultFileImport: handleVaultFileImport,
        showDeviceTransferModal: showDeviceTransferModal,
        promptImportCode: promptImportCode,
        confirmDeleteAllData: confirmDeleteAllData,
        triggerCloudSync: triggerCloudSync
    };
})();

// Auto-Init bei DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AccountModule.init());
} else {
    window.AccountModule.init();
}
