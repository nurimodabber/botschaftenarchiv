/**
 * settings.js
 * Modulares Einstellungs-, Theme- und Farbrad-System
 */
(function() {
    const safeGetStorage = window.safeGetStorage || function(k, d) { try { const v = localStorage.getItem(k); return v !== null ? v : d; } catch(e) { return d; } };
    const safeSetStorage = window.safeSetStorage || function(k, v) { try { localStorage.setItem(k, v); } catch(e) {} };


function setupAppearance() {
    const html = document.documentElement;

    // 0. Default Viewer Format Setting (pdf / text / web / auto)
    const savedViewerFormat = safeGetStorage('cosmos_default_viewer_mode', 'pdf');

    function applyDefaultViewerFormat(fmt) {
        const validFormat = (fmt === 'text' || fmt === 'web' || fmt === 'auto' || fmt === 'pdf') ? fmt : 'pdf';
        safeSetStorage('cosmos_default_viewer_mode', validFormat);

        document.querySelectorAll('#appearance-format-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.formatVal === validFormat);
        });
    }

    // 0b. Master-Language Setting (Deutsch 'de' / English 'en')
    // Steuert die Sprache der gesamten Benutzeroberflaeche sowie die Standard-Lesesprache
    let storedLang = safeGetStorage('cosmos_master_lang', safeGetStorage('cosmos_preferred_lang_v2', safeGetStorage('cosmos_preferred_lang', 'de')));
    if (storedLang === 'english') storedLang = 'en';
    if (storedLang === 'deutsch' || storedLang === 'all' || !storedLang) storedLang = 'de';
    const savedLanguage = (storedLang === 'en') ? 'en' : 'de';

    function applyLanguage(langVal) {
        const validLang = (langVal === 'en' || langVal === 'english') ? 'en' : 'de';
        safeSetStorage('cosmos_master_lang', validLang);
        safeSetStorage('cosmos_preferred_lang', validLang === 'en' ? 'english' : 'deutsch');
        safeSetStorage('cosmos_preferred_lang_v2', validLang);

        if (window.I18n && window.I18n.setLanguage) {
            window.I18n.setLanguage(validLang);
        }

        document.querySelectorAll('#appearance-language-group .appearance-opt-btn').forEach(btn => {
            const val = btn.dataset.langVal;
            const isActive = (val === validLang) || (val === 'english' && validLang === 'en') || (val === 'deutsch' && validLang === 'de');
            btn.classList.toggle('active', isActive);
        });

        // Synchronize timeline and books if available (library filter remains clean/unfiltered on startup)
        if (window.TimelineModule && window.TimelineModule.setLanguage) {
            window.TimelineModule.setLanguage(validLang);
        }

        // Synchronize with books if available
        if (window.BooksModule && window.BooksModule.setLang) {
            window.BooksModule.setLang(validLang === 'en' ? 'english' : 'deutsch');
        }

        if (typeof updateDrawerFilterOptions === 'function') {
            (window.updateDrawerFilterOptions || window.FiltersModule?.updateDrawerFilterOptions || function(){})((window.state ? window.state.library : null) ? ((window.state ? window.state.library : null).segment || 'all') : 'all');
        }

        if (typeof applyLibraryFilters === 'function' && window.state && window.state.documents && window.state.documents.length > 0) {
            applyLibraryFilters();
        }
    }

    // 1. Theme Setting (light / sepia / dark / oled)
    const savedTheme = safeGetStorage('cosmos_theme', safeGetStorage('theme', 'light'));
    
    function applyTheme(theme) {
        const validTheme = (theme === 'dark' || theme === 'sepia' || theme === 'oled') ? theme : 'light';
        html.setAttribute('data-theme', validTheme);
        safeSetStorage('cosmos_theme', validTheme);
        safeSetStorage('theme', validTheme);
        state.theme = validTheme;

        // Update Theme Tab Buttons
        document.querySelectorAll('#appearance-theme-tabs .theme-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeVal === validTheme);
        });

        // Update Dock Pill Icon
        const dockThemeIcon = document.getElementById('dock-theme-icon');
        if (dockThemeIcon) {
            if (validTheme === 'light') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>`;
            } else if (validTheme === 'sepia') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>`;
            } else if (validTheme === 'dark') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
            } else if (validTheme === 'oled') {
                dockThemeIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>`;
            }
        }
    }

    // 2. Accent Color Setting
    const defaultColor = '#C5A059';
    const savedColor = safeGetStorage('cosmos_accent_color', defaultColor);

    function applyAccentColor(hex) {
        if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return;
        
        let fullHex = hex;
        if (hex.length === 4) {
            fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        const r = parseInt(fullHex.slice(1, 3), 16) || 197;
        const g = parseInt(fullHex.slice(3, 5), 16) || 160;
        const b = parseInt(fullHex.slice(5, 7), 16) || 89;

        const rH = Math.max(0, Math.min(255, Math.round(r * 1.12)));
        const gH = Math.max(0, Math.min(255, Math.round(g * 1.12)));
        const bH = Math.max(0, Math.min(255, Math.round(b * 1.12)));
        const hexHover = `rgb(${rH}, ${gH}, ${bH})`;

        html.style.setProperty('--accent-gold', fullHex);
        html.style.setProperty('--accent-gold-hover', hexHover);
        html.style.setProperty('--accent-gold-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
        html.style.setProperty('--accent-gold-glow', `rgba(${r}, ${g}, ${b}, 0.28)`);
        html.style.setProperty('--border-focus', `rgba(${r}, ${g}, ${b}, 0.55)`);

        safeSetStorage('cosmos_accent_color', fullHex);

        const hexInput = document.getElementById('accent-hex-input');
        if (hexInput && document.activeElement !== hexInput && hexInput.value.toLowerCase() !== fullHex.toLowerCase()) {
            hexInput.value = fullHex.toUpperCase();
        }

        const previewBadge = document.getElementById('accent-current-preview-badge');
        if (previewBadge) {
            previewBadge.style.backgroundColor = fullHex;
            previewBadge.style.boxShadow = `0 0 5px ${fullHex}`;
        }

        const wheelBox = document.getElementById('wheel-color-preview-box');
        if (wheelBox) {
            wheelBox.style.backgroundColor = fullHex;
        }

        const standardColors = ['#c5a059', '#2b4c7e', '#c86432'];
        const isStandard = standardColors.includes(fullHex.toLowerCase());

        document.querySelectorAll('.accent-swatch').forEach(sw => {
            if (sw.classList.contains('accent-swatch-custom')) {
                sw.classList.toggle('active', !isStandard);
                if (!isStandard) {
                    sw.style.background = fullHex;
                } else {
                    sw.style.background = 'conic-gradient(from 180deg at 50% 50%, #E53935, #FB8C00, #FDD835, #43A047, #1E88E5, #8E24AA, #E53935)';
                }
            } else {
                sw.classList.toggle('active', (sw.dataset.color || '').toLowerCase() === fullHex.toLowerCase());
            }
        });
    }

    // 3. Reader Font Setting (serif / sans / classic)
    const savedFont = safeGetStorage('cosmos_reader_font', 'serif');

    function applyReaderFont(font) {
        const validFont = (font === 'sans' || font === 'classic') ? font : 'serif';
        html.setAttribute('data-reader-font', validFont);
        safeSetStorage('cosmos_reader_font', validFont);

        document.querySelectorAll('#appearance-font-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.fontVal === validFont);
        });
    }

    // 4. Reader Line Height (compact / normal / relaxed)
    const savedLh = safeGetStorage('cosmos_reader_lh', 'normal');

    function applyLineHeight(lh) {
        const validLh = (lh === 'compact' || lh === 'relaxed') ? lh : 'normal';
        html.setAttribute('data-reader-lh', validLh);
        safeSetStorage('cosmos_reader_lh', validLh);

        document.querySelectorAll('#appearance-line-height-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lhVal === validLh);
        });
    }

    // 5. Reader Text Alignment (justify / left)
    const savedAlign = safeGetStorage('cosmos_reader_align', 'justify');

    function applyTextAlign(align) {
        const validAlign = (align === 'left') ? 'left' : 'justify';
        html.setAttribute('data-reader-align', validAlign);
        safeSetStorage('cosmos_reader_align', validAlign);

        document.querySelectorAll('#appearance-align-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.alignVal === validAlign);
        });
    }

    // 6. Reader Width Setting (normal / wide / full)
    const savedWidth = safeGetStorage('cosmos_reader_width', 'normal');

    function applyReaderWidth(width) {
        const validWidth = (width === 'wide' || width === 'full') ? width : 'normal';
        html.setAttribute('data-reader-width', validWidth);
        safeSetStorage('cosmos_reader_width', validWidth);

        document.querySelectorAll('#appearance-width-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.widthVal === validWidth);
        });
    }

    // 7. Font Scale Setting (85% to 135%)
    const savedScale = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;

    function applyFontScale(scaleVal) {
        const clamped = Math.max(85, Math.min(135, scaleVal));
        html.style.setProperty('--reader-font-scale', (clamped / 100).toString());
        safeSetStorage('cosmos_reader_font_scale', clamped.toString());

        const display = document.getElementById('appearance-size-display');
        if (display) display.textContent = `${clamped}%`;

        const slider = document.getElementById('appearance-size-slider');
        if (slider && parseInt(slider.value, 10) !== clamped) slider.value = clamped;
    }

    // 8. Library View Mode (cards / list)
    const savedLibView = (() => {
        const raw = safeGetStorage('cosmos_library_view', safeGetStorage('cosmos_library_view_mode', 'cards'));
        return raw === 'list' ? 'list' : 'cards';
    })();

    function applyLibraryView(viewMode) {
        const validView = (viewMode === 'list') ? 'list' : 'cards';
        html.setAttribute('data-library-view', validView);
        safeSetStorage('cosmos_library_view', validView);
        if (window.state ? window.state.library : null) {
            (window.state ? window.state.library : null).viewMode = (validView === 'list' ? 'list' : 'grid');
        }
        safeSetStorage('cosmos_library_view_mode', validView === 'list' ? 'list' : 'grid');

        const resultsGrid = document.getElementById('library-results');
        if (resultsGrid) {
            resultsGrid.classList.toggle('list-view', validView === 'list');
        }

        const cardsBtn = document.getElementById('view-mode-cards-btn');
        const listBtn = document.getElementById('view-mode-list-btn');
        if (cardsBtn) cardsBtn.classList.toggle('active', validView === 'cards');
        if (listBtn) listBtn.classList.toggle('active', validView === 'list');

        document.querySelectorAll('#appearance-library-view-group .appearance-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.libView === validView);
        });
    }
    window.applyLibraryView = applyLibraryView;

    // Initialize all settings
    applyDefaultViewerFormat(savedViewerFormat);
    applyLanguage(savedLanguage);
    applyTheme(savedTheme);
    applyAccentColor(savedColor);
    applyReaderFont(savedFont);
    applyLineHeight(savedLh);
    applyTextAlign(savedAlign);
    applyReaderWidth(savedWidth);
    applyFontScale(savedScale);
    applyLibraryView(savedLibView);

    // Wire up Popover Toggle & Events
    const toggleBtn = document.getElementById('appearance-btn');
    const popover = document.getElementById('appearance-popover');
    const resetBtn = document.getElementById('appearance-reset-btn');

    function syncSettingsContainer() {
        const isMobile = window.innerWidth <= 768;
        const panel = document.getElementById('settings-panel-content');
        const pop = document.getElementById('appearance-popover');
        const pageMount = document.getElementById('settings-page-mount');
        if (!panel || !pop || !pageMount) return;

        if (isMobile) {
            if (panel.parentElement !== pageMount) {
                pageMount.appendChild(panel);
            }
            pop.hidden = true;
        } else {
            if (panel.parentElement !== pop) {
                pop.appendChild(panel);
            }
            if (state.currentView === 'settings') {
                window.switchView('library');
            }
        }
    }

    syncSettingsContainer();
    window.addEventListener('resize', syncSettingsContainer);

    if (toggleBtn && popover) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                window.switchView('settings');
            } else {
                const isHidden = popover.hidden;
                popover.hidden = !isHidden;
                toggleBtn.classList.toggle('active', !popover.hidden);
            }
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth > 768 && !popover.hidden && !popover.contains(e.target) && !toggleBtn.contains(e.target)) {
                popover.hidden = true;
                toggleBtn.classList.remove('active');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !popover.hidden) {
                popover.hidden = true;
                toggleBtn.classList.remove('active');
            }
        });
    }

    // Theme Button Clicks
    document.querySelectorAll('#appearance-theme-tabs .theme-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.themeVal);
        });
    });

    // Swatches (3 Standardempfehlungen)
    document.querySelectorAll('.accent-swatch:not(.accent-swatch-custom)').forEach(sw => {
        sw.addEventListener('click', () => {
            if (sw.dataset.color) applyAccentColor(sw.dataset.color);
        });
    });

    // Color conversion helpers for Pop-up Farbrad
    function hslToRgb(h, s, l) {
        s = Math.max(0, Math.min(1, s));
        l = Math.max(0, Math.min(1, l));
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else if (300 <= h && h <= 360) { r = c; g = 0; b = x; }
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    }

    function hslToHex(h, s, l) {
        const rgb = hslToRgb(h, s, l);
        const toHex = val => val.toString(16).padStart(2, '0');
        return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
    }

    function hexToHsl(hex) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        const r = ((num >> 16) & 255) / 255;
        const g = ((num >> 8) & 255) / 255;
        const b = (num & 255) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
                case g: h = ((b - r) / d + 2) * 60; break;
                case b: h = ((r - g) / d + 4) * 60; break;
            }
        }
        return { h: Math.round(h), s: Math.round(s * 100) / 100, l: Math.round(l * 100) / 100 };
    }

    // 4. Interaktives Pop-up Farbrad für Akzentfarbe
    function initColorWheel() {
        const canvas = document.getElementById('color-wheel-canvas');
        const popover = document.getElementById('accent-color-wheel-popover');
        const customSwatch = document.getElementById('accent-swatch-custom');
        const crosshair = document.getElementById('wheel-crosshair');
        const slider = document.getElementById('wheel-lightness-slider');
        const previewBox = document.getElementById('wheel-color-preview-box');
        const hexInput = document.getElementById('accent-hex-input');
        const applyBtn = document.getElementById('wheel-apply-btn');
        const closeBtn = document.getElementById('wheel-close-btn');

        if (!canvas || !popover || !customSwatch) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = cx - 4;

        // Farbrad einmalig auf das Canvas zeichnen
        const imgData = ctx.createImageData(width, height);
        const d = imgData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idx = (y * width + x) * 4;

                if (dist <= radius) {
                    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    if (angle < 0) angle += 360;
                    const sat = dist / radius;
                    const rgb = hslToRgb(angle, sat, 0.5);
                    d[idx] = rgb[0];
                    d[idx + 1] = rgb[1];
                    d[idx + 2] = rgb[2];
                    d[idx + 3] = (radius - dist < 1.2) ? Math.round((radius - dist) * 255) : 255;
                } else {
                    d[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        let currentHue = 42;
        let currentSat = 0.55;
        let currentLightness = 0.56;
        let isDragging = false;

        function updateCrosshair(h, s) {
            if (!crosshair) return;
            const angleRad = h * (Math.PI / 180);
            const dist = s * radius;
            const px = cx + Math.cos(angleRad) * dist;
            const py = cy + Math.sin(angleRad) * dist;
            crosshair.style.left = `${px}px`;
            crosshair.style.top = `${py}px`;
        }

        function syncFromHex(hex) {
            const hsl = hexToHsl(hex);
            currentHue = hsl.h;
            currentSat = hsl.s;
            currentLightness = Math.max(0.18, Math.min(0.82, hsl.l));
            updateCrosshair(currentHue, currentSat);
            if (slider) slider.value = Math.round(currentLightness * 100);
            if (previewBox) previewBox.style.backgroundColor = hex;
            if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
        }

        function handlePointer(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = width / rect.width;
            const scaleY = height / rect.height;
            const px = (e.clientX - rect.left) * scaleX;
            const py = (e.clientY - rect.top) * scaleY;
            const dx = px - cx;
            const dy = py - cy;
            const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            if (angle < 0) angle += 360;

            currentHue = angle;
            currentSat = dist / radius;
            updateCrosshair(currentHue, currentSat);

            const hex = hslToHex(currentHue, currentSat, currentLightness);
            if (previewBox) previewBox.style.backgroundColor = hex;
            if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
            applyAccentColor(hex);
        }

        canvas.addEventListener('pointerdown', (e) => {
            isDragging = true;
            canvas.setPointerCapture(e.pointerId);
            handlePointer(e);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            handlePointer(e);
        });

        canvas.addEventListener('pointerup', (e) => {
            isDragging = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
        });

        canvas.addEventListener('pointercancel', () => {
            isDragging = false;
        });

        if (slider) {
            slider.addEventListener('input', (e) => {
                currentLightness = parseInt(e.target.value, 10) / 100;
                const hex = hslToHex(currentHue, currentSat, currentLightness);
                if (previewBox) previewBox.style.backgroundColor = hex;
                if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
                applyAccentColor(hex);
            });
        }

        if (hexInput) {
            hexInput.addEventListener('input', (e) => {
                let val = e.target.value.trim();
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    syncFromHex(val);
                    applyAccentColor(val);
                }
            });
        }

        document.querySelectorAll('.wheel-preset-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const col = dot.dataset.presetColor;
                if (col) {
                    syncFromHex(col);
                    applyAccentColor(col);
                }
            });
        });

        customSwatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !popover.hidden;
            popover.hidden = isOpen;
            customSwatch.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                const cur = safeGetStorage('cosmos_accent_color', defaultColor);
                syncFromHex(cur);
            }
        });

        popover.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            });
        }

        document.addEventListener('click', (e) => {
            if (!popover.hidden && !popover.contains(e.target) && !customSwatch.contains(e.target)) {
                popover.hidden = true;
                customSwatch.setAttribute('aria-expanded', 'false');
            }
        });

        // Initialize state with current accent color
        const initialCol = safeGetStorage('cosmos_accent_color', defaultColor);
        syncFromHex(initialCol);
    }

    initColorWheel();

    // Default Viewer Format selection
    document.querySelectorAll('#appearance-format-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyDefaultViewerFormat(btn.dataset.formatVal);
        });
    });

    // Language selection
    document.querySelectorAll('#appearance-language-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLanguage(btn.dataset.langVal);
        });
    });

    // Font selection
    document.querySelectorAll('#appearance-font-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyReaderFont(btn.dataset.fontVal);
        });
    });

    // Line Height selection
    document.querySelectorAll('#appearance-line-height-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLineHeight(btn.dataset.lhVal);
        });
    });

    // Text Alignment selection
    document.querySelectorAll('#appearance-align-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTextAlign(btn.dataset.alignVal);
        });
    });

    // Width selection
    document.querySelectorAll('#appearance-width-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyReaderWidth(btn.dataset.widthVal);
        });
    });

    // Size Stepper & Slider
    const sizeSlider = document.getElementById('appearance-size-slider');
    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            applyFontScale(parseInt(e.target.value, 10));
        });
    }

    const sizeDecBtn = document.getElementById('appearance-size-dec');
    if (sizeDecBtn) {
        sizeDecBtn.addEventListener('click', () => {
            const cur = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;
            applyFontScale(cur - 5);
        });
    }

    const sizeIncBtn = document.getElementById('appearance-size-inc');
    if (sizeIncBtn) {
        sizeIncBtn.addEventListener('click', () => {
            const cur = parseInt(safeGetStorage('cosmos_reader_font_scale', '100'), 10) || 100;
            applyFontScale(cur + 5);
        });
    }

    // Library View Mode (cards / list)
    document.querySelectorAll('#appearance-library-view-group .appearance-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyLibraryView(btn.dataset.libView);
        });
    });

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            applyDefaultViewerFormat('pdf');
            applyLanguage('de');
            applyTheme('light');
            applyAccentColor(defaultColor);
            applyReaderFont('serif');
            applyLineHeight('normal');
            applyTextAlign('justify');
            applyReaderWidth('normal');
            applyFontScale(100);
            applyLibraryView('cards');
        });
    }
}

window.setupAppearance = setupAppearance;
window.SettingsModule = { setupAppearance };
})();
