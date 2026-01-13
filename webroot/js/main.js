// main.js - Initialization and Event Wiring

async function init() {
    // --- Initialize i18n ---
    if (window.I18N) {
        await I18N.init();
    }

    // --- Language Dropdown Logic ---
    const langBtn = document.getElementById('lang-btn');
    const langMenu = document.getElementById('lang-menu');

    if (langBtn && langMenu) {
        langBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = langMenu.classList.contains('visible');
            if (isVisible) {
                langMenu.classList.remove('visible');
                setTimeout(() => langMenu.classList.add('hidden'), 200);
            } else {
                langMenu.classList.remove('hidden');
                setTimeout(() => langMenu.classList.add('visible'), 10);
            }
        });

        document.addEventListener('click', () => {
            if (langMenu.classList.contains('visible')) {
                langMenu.classList.remove('visible');
                setTimeout(() => langMenu.classList.add('hidden'), 200);
            }
        });

        langMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const lang = item.dataset.lang;
                if (lang && window.I18N) {
                    await I18N.setLanguage(lang);
                }
                langMenu.classList.remove('visible');
                setTimeout(() => langMenu.classList.add('hidden'), 200);
            });
        });
    }

    // --- Theme Logic ---
    let currentThemeMode = localStorage.getItem('theme_mode') || 'auto';
    const themeBtn = document.getElementById('theme-toggle');

    function applyTheme(mode) {
        document.body.classList.remove('theme-light', 'theme-dark');
        if (mode === 'light') document.body.classList.add('theme-light');
        if (mode === 'dark') document.body.classList.add('theme-dark');
        // 'auto' does nothing (uses media query)

        updateThemeIcon(mode);
    }

    function updateThemeIcon(mode) {
        if (!themeBtn) return;
        let iconPath = '';
        /* 
           Auto: Computer/System icon
           Light: Sun
           Dark: Moon
        */
        if (mode === 'auto') {
            // Custom Auto Icon: Sun Rays + Bold Sans-Serif 'A'
            // Outer: M11 9 H13 L15.2 15.5 H13.2 L12.7 14 H11.3 L10.8 15.5 H8.8 Z
            // Hole: M12 10.5 L12.3 12.5 H11.7 Z
            // Rays Path: Copied from Light icon (segments 2+)
            iconPath = 'M11 9 H13 L15.2 15.5 H13.2 L12.7 14 H11.3 L10.8 15.5 H8.8 Z M12 10.5 L12.3 12.5 H11.7 Z M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z';
        } else if (mode === 'light') {
            // Sun Icon
            iconPath = 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z';
        } else {
            // Moon Icon (Feather Icons - Clean C-Shape)
            iconPath = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
        }

        themeBtn.querySelector('path').setAttribute('d', iconPath);
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            if (currentThemeMode === 'auto') currentThemeMode = 'light';
            else if (currentThemeMode === 'light') currentThemeMode = 'dark';
            else currentThemeMode = 'auto';

            localStorage.setItem('theme_mode', currentThemeMode);

            // Fade out icon
            themeBtn.style.opacity = '0.5';
            setTimeout(() => {
                applyTheme(currentThemeMode);
                themeBtn.style.opacity = '1';
            }, 150);
        });
    }

    // Init Theme
    applyTheme(currentThemeMode);

    // --- Reboot Dropdown Logic ---
    const rebootBtn = document.getElementById('reboot-btn');
    const rebootMenu = document.getElementById('reboot-menu');

    if (rebootBtn && rebootMenu) {
        // Toggle dropdown on button click
        rebootBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = rebootMenu.classList.contains('visible');
            if (isVisible) {
                rebootMenu.classList.remove('visible');
                setTimeout(() => rebootMenu.classList.add('hidden'), 200);
            } else {
                rebootMenu.classList.remove('hidden');
                setTimeout(() => rebootMenu.classList.add('visible'), 10);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            if (rebootMenu.classList.contains('visible')) {
                rebootMenu.classList.remove('visible');
                setTimeout(() => rebootMenu.classList.add('hidden'), 200);
            }
        });

        // Handle reboot menu item clicks
        rebootMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = item.dataset.action;

                // Map action to command
                const rebootCommands = {
                    'system': 'svc power reboot',
                    'recovery': 'reboot recovery',
                    'fastboot': 'reboot bootloader',
                    'download': 'reboot download',
                    'bootloader': 'reboot bootloader'
                };

                const command = rebootCommands[action];
                if (!command) return;

                // Close dropdown
                rebootMenu.classList.remove('visible');
                setTimeout(() => rebootMenu.classList.add('hidden'), 200);

                // Only confirm if there are pending changes
                const actionName = item.textContent;
                if (window.hasPendingChanges && window.hasPendingChanges()) {
                    const confirmed = await showConfirmModal({
                        title: actionName,
                        body: t('modal.rebootPendingBody', { action: actionName.toLowerCase() }),
                        iconClass: 'warning',
                        confirmText: t('modal.reboot')
                    });

                    if (!confirmed) return;
                }

                await exec(command);
            });
        });
    }

    // 1. Initialize UI Navigation
    initNavigation();

    // Elements
    const statusCard = document.getElementById('status-card');
    const errorCard = document.getElementById('error-card');
    const deviceEl = document.getElementById('device-name');
    const linuxVerEl = document.getElementById('linux-version');
    const versionEl = document.getElementById('kernel-version');
    const variantEl = document.getElementById('kernel-variant');
    const buildTypeEl = document.getElementById('build-type');


    const fabRefresh = document.getElementById('fab-refresh');
    const fabApply = document.getElementById('fab-apply');
    const modalClose = document.getElementById('modal-close');
    const experimentalToggle = document.getElementById('experimental-toggle');
    const readonlyPatchToggle = document.getElementById('readonly-patch-toggle');
    const exitBtn = document.getElementById('exit-btn');
    const ghLink = document.getElementById('github-link');

    // 2. Detection & Status
    const deviceNameEl = document.getElementById('managed-device-name');

    const tHome = (key, fallback) => {
        try {
            if (window.I18N && typeof window.I18N.t === 'function') {
                const val = window.I18N.t(`home.${key}`);
                if (val && !String(val).startsWith('home.')) return String(val);
            }
        } catch {
            // ignore
        }
        return fallback;
    };

    const detectingText = () => tHome('detecting', 'Detecting...');
    const unknownText = () => tHome('unknown', 'Unknown');

    const applyDeviceValueI18nKey = (keyOrNull) => {
        if (!deviceEl) return;
        if (keyOrNull) deviceEl.setAttribute('data-i18n', `home.${keyOrNull}`);
        else deviceEl.removeAttribute('data-i18n');
    };

    const applyManagedNameI18nKey = (keyOrNull) => {
        if (!deviceNameEl) return;
        if (keyOrNull) deviceNameEl.setAttribute('data-i18n', `home.${keyOrNull}`);
        else deviceNameEl.removeAttribute('data-i18n');
    };

    const swapManagedDeviceName = (nextText, opts = {}) => {
        if (!deviceNameEl) return;
        const next = String(nextText);
        if (deviceNameEl.textContent === next) return;

        if (Object.prototype.hasOwnProperty.call(opts, 'i18nKey')) {
            applyManagedNameI18nKey(opts.i18nKey);
        }

        deviceNameEl.classList.add('text-fade');

        let swapped = false;
        const doSwap = () => {
            if (swapped) return;
            swapped = true;
            deviceNameEl.textContent = next;
            requestAnimationFrame(() => deviceNameEl.classList.remove('text-fade'));
        };

        const onEnd = (e) => {
            if (e.propertyName !== 'opacity') return;
            deviceNameEl.removeEventListener('transitionend', onEnd);
            doSwap();
        };

        deviceNameEl.addEventListener('transitionend', onEnd);
        setTimeout(() => {
            deviceNameEl.removeEventListener('transitionend', onEnd);
            doSwap();
        }, 500);
    };

    // Default UI state while detection runs
    if (deviceNameEl) {
        applyManagedNameI18nKey('detecting');
        deviceNameEl.textContent = detectingText();
    }

    if (deviceEl) {
        applyDeviceValueI18nKey('unknown');
        deviceEl.textContent = unknownText();
    }

    const device = await getDevice();
    const props = await getModuleProps();
    // Pass detected uname directly to resolveDeviceInfo
    const devInfo = await resolveDeviceInfo(device ? device.uname : null);

    // Populate About Page (from module.prop, except description which is i18n)
    const aboutTitle = document.getElementById('about-title');
    const aboutVersion = document.getElementById('about-version');
    if (aboutTitle && props.name) aboutTitle.textContent = props.name;
    if (aboutVersion && props.version) aboutVersion.textContent = props.version;

    // Populate Status Page
    const uname = devInfo.uname || (await exec('uname -r'));

    if (!uname) {
        if (statusCard) statusCard.classList.add('hidden');
        if (errorCard) errorCard.classList.remove('hidden');
        swapManagedDeviceName(unknownText(), { i18nKey: 'unknown' });
        return;
    }

    // Pass device context to features module
    if (window.setDeviceContext) {
        window.setDeviceContext(devInfo.isTrinketMi);
    }

    if (deviceEl) {
        const displayName = (devInfo && devInfo.displayName != null) ? String(devInfo.displayName).trim() : '';
        if (!displayName || displayName.toLowerCase() === 'unknown') {
            applyDeviceValueI18nKey('unknown');
            deviceEl.textContent = unknownText();
        } else {
            applyDeviceValueI18nKey(null);
            deviceEl.textContent = displayName;
        }
    }

    // Theme & Device Name Chip
    const shouldAnimateDetectionTheme = devInfo.isTrinketMi || devInfo.is1280;
    if (shouldAnimateDetectionTheme) {
        document.body.classList.add('theme-detect-anim');
        setTimeout(() => document.body.classList.remove('theme-detect-anim'), 1700);
    }

    if (devInfo.isTrinketMi) {
        requestAnimationFrame(() => document.body.classList.add('theme-orange'));
        swapManagedDeviceName('FloppyTrinketMi', { i18nKey: null });
        window.KERNEL_NAME = 'FloppyTrinketMi';
    } else if (devInfo.is1280) {
        requestAnimationFrame(() => document.body.classList.add('theme-exynos-blue'));
        swapManagedDeviceName('Floppy1280', { i18nKey: null });
        window.KERNEL_NAME = 'Floppy1280';
    } else {
        swapManagedDeviceName(unknownText(), { i18nKey: 'unknown' });
        window.KERNEL_NAME = 'FloppyKernel';
    }

    // Initialize Platform Tweaks now that KERNEL_NAME is set
    if (window.initPlatformTweaks) {
        window.initPlatformTweaks();
    }

    // Platform-specific reboot options
    const samsungOptions = document.querySelectorAll('.platform-samsung');
    const trinketOptions = document.querySelectorAll('.platform-trinket');
    if (devInfo.is1280) {
        samsungOptions.forEach(el => el.classList.remove('hidden'));
    }
    if (devInfo.isTrinketMi) {
        trinketOptions.forEach(el => el.classList.remove('hidden'));
    }

    // Parse Linux Version
    const linuxVer = uname.split('-')[0];
    if (linuxVerEl) linuxVerEl.textContent = linuxVer;

    if (uname.includes('Floppy')) {
        // Parse Version
        const versionMatch = uname.match(/-v(\d+\.\d+)/);
        if (versionMatch && versionEl) {
            versionEl.textContent = `v${versionMatch[1]}`;
        } else if (versionEl) {
            versionEl.textContent = uname;
        }

        // Parse Variant
        let variantFound = 'Standard';
        if (window.VARIANTS) {
            for (const [code, name] of Object.entries(window.VARIANTS)) {
                const regex = new RegExp(`-${code}(-|$)`);
                if (regex.test(uname)) {
                    variantFound = name;
                    break;
                }
            }
        }
        if (variantEl) variantEl.textContent = variantFound;

        // Parse Release Status
        if (buildTypeEl) {
            if (uname.includes('-release')) {
                buildTypeEl.textContent = 'Release Build';
                buildTypeEl.style.color = 'var(--md-sys-color-primary)';
            } else {
                let label = 'Testing';
                const hashMatch = uname.match(/-g([0-9a-f]+)/);
                if (hashMatch) {
                    label += ` (${hashMatch[1]})`;
                } else {
                    label += ' (Git)';
                }
                if (uname.includes('dirty')) {
                    label += ' (Dirty)';
                    buildTypeEl.style.color = '#e2b349';
                }
                buildTypeEl.textContent = label;
            }
        }

        // Check for unsupported version
        const versionWarning = document.getElementById('version-warning');
        if (versionWarning && versionMatch) {
            const versionStr = versionMatch[1]; // e.g., "6.2" or "1.0"
            const [major, minor] = versionStr.split('.').map(Number);
            let isUnsupported = false;

            // Parse kernel name from uname
            const kernelNameMatch = uname.match(/Floppy[A-Za-z0-9]*/);
            const kernelName = kernelNameMatch ? kernelNameMatch[0] : '';

            // Floppy1280: minimum v6.2
            if (kernelName === 'Floppy1280') {
                if (major < 6 || (major === 6 && minor < 2)) {
                    isUnsupported = true;
                }
            }

            // FloppyTrinketMi: minimum v1.2
            if (kernelName === 'FloppyTrinketMi') {
                if (major < 1 || (major === 1 && minor < 2)) {
                    isUnsupported = true;
                }
            }

            if (isUnsupported) {
                versionWarning.classList.remove('hidden');
            }
        }

    } else {
        if (statusCard) statusCard.classList.add('hidden');
        if (errorCard) errorCard.classList.remove('hidden');
    }

    // 3. Dynamic Links in About
    const kernelLinksCard = document.getElementById('kernel-links-card');
    const kernelLinksHeader = document.getElementById('kernel-links-header');
    const kernelLinksList = document.getElementById('kernel-links-list');

    if (kernelLinksCard && kernelLinksList && device) {
        let kernelLinks = [];
        let kernelName = '';
        if (device.schemaKey === 'features_1280') {
            kernelName = 'Floppy1280';
            kernelLinks = [
                { icon: 'github', text: 'Floppy1280 repository', url: 'https://github.com/FlopKernel-Series/flop_s5e8825_kernel' },
                { icon: 'telegram', text: 'Floppy1280 channel', url: 'https://t.me/Floppy1280' },
                { icon: 'telegram', text: 'Floppy1280 group', url: 'https://t.me/Floppy1280_Chat' }
            ];
        } else if (device.schemaKey === 'features_trinket') {
            kernelName = 'FloppyTrinketMi';
            kernelLinks = [
                { icon: 'github', text: 'FloppyTrinketMi repository', url: 'https://github.com/FlopKernel-Series/flop_trinket-mi_kernel' },
                { icon: 'telegram', text: 'FloppyTrinketMi channel', url: 'https://t.me/FloppyTrinketMi' },
                { icon: 'telegram', text: 'FloppyTrinketMi group', url: 'https://t.me/FloppyTrinketMi_Chat' }
            ];
        }

        if (kernelName) {
            kernelLinksHeader.textContent = t('about.kernelLinksTemplate', { name: kernelName });
        }

        if (kernelLinks.length > 0) {
            const githubIcon = '<svg class="link-icon" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>';
            const telegramIcon = '<svg class="link-icon" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';

            kernelLinksList.innerHTML = kernelLinks.map(link => {
                const icon = link.icon === 'github' ? githubIcon : telegramIcon;
                return `<a href="#" class="link-row" data-url="${link.url}">${icon}<span>${link.text}</span></a>`;
            }).join('');

            kernelLinksCard.style.display = 'block';

            // Add click handlers
            kernelLinksList.querySelectorAll('.link-row').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = a.dataset.url;
                    if (window.exec) {
                        window.exec(`am start -a android.intent.action.VIEW -d "${url}"`);
                    } else {
                        window.open(url, '_blank');
                    }
                });
            });
        }
    }

    // 4. Global Event Listeners (Toggles)

    // Experimental Toggle
    if (experimentalToggle) {
        experimentalToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                e.target.checked = false; // Reset until confirmed

                const confirmed = await showConfirmModal({
                    title: t('modal.experimentalTitle'),
                    body: t('modal.experimentalBody'),
                    iconClass: 'warning',
                    confirmText: t('modal.enable')
                });

                if (confirmed) {
                    experimentalToggle.checked = true;
                    if (window.setExperimental) window.setExperimental(true);
                }
            } else {
                if (window.setExperimental) window.setExperimental(false);
            }
        });
    }

    // Read-only Patch Toggle
    if (readonlyPatchToggle) {
        readonlyPatchToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const confirmed = await showConfirmModal({
                    title: t('modal.readonlyTitle'),
                    body: t('modal.readonlyBody'),
                    iconClass: 'warning',
                    confirmText: t('modal.enable')
                });

                if (confirmed) {
                    readonlyPatchToggle.checked = true;
                    if (window.setReadonlyPatch) window.setReadonlyPatch(true);
                } else {
                    readonlyPatchToggle.checked = false;
                }
            } else {
                if (window.setReadonlyPatch) window.setReadonlyPatch(false);
            }
        });
    }

    // Action Buttons
    if (fabRefresh) fabRefresh.addEventListener('click', async () => {
        // TODO: detect pending changes and warn
        // For now just reload
        if (window.loadFeatures) window.loadFeatures();
    });

    if (fabApply && window.applyChanges) {
        fabApply.addEventListener('click', window.applyChanges);
    }

    if (modalClose) modalClose.addEventListener('click', () => {
        const modal = document.getElementById('processing-modal');
        if (modal) modal.classList.add('hidden');
    });

    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (typeof ksu !== 'undefined' && ksu.exit) ksu.exit();
        });
    }

    // External Link (Legacy)
    if (ghLink) {
        ghLink.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = ghLink.dataset.url;
            if (url) {
                await exec(`am start -a android.intent.action.VIEW -d "${url}"`);
            }
        });
    }

    // --- Log Export Buttons ---
    const btnSaveLastKmsg = document.getElementById('btn-save-lastkmsg');
    const btnSaveDmesg = document.getElementById('btn-save-dmesg');

    // Toast notification helper
    function showToast(message, isError = false) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast' + (isError ? ' error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('visible'), 10);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async function saveLog(type) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `/sdcard/${type}_${timestamp}.log`;
        let cmd;

        if (type === 'last_kmsg') {
            cmd = `cp /proc/last_kmsg "${filename}"`;
        } else {
            cmd = `dmesg > "${filename}"`;
        }

        const result = await exec(cmd);

        // Check if file was created
        const check = await exec(`[ -f "${filename}" ] && echo "ok"`);
        if (check && check.trim() === 'ok') {
            showToast(`Saved to ${filename}`);
        } else {
            showToast(`Failed to save ${type}`, true);
        }
    }

    if (btnSaveLastKmsg) {
        btnSaveLastKmsg.addEventListener('click', () => saveLog('last_kmsg'));
    }

    if (btnSaveDmesg) {
        btnSaveDmesg.addEventListener('click', () => saveLog('dmesg'));
    }

    // --- Translation Credits ---
    const translationCreditsList = document.getElementById('translation-credits-list');
    if (translationCreditsList) {
        try {
            const response = await fetch('credits.json');
            if (response.ok) {
                const creditsData = await response.json();

                const projectCreditsList = document.getElementById('project-credits-list');
                if (projectCreditsList) {
                    renderProjectCredits(projectCreditsList, creditsData);
                }

                if (translationCreditsList) {
                    renderTranslationCredits(translationCreditsList, creditsData);
                }
            }
        } catch (e) {
            console.error('Failed to load credits:', e);
        }
    }
}

function renderProjectCredits(container, data) {
    if (!data.project_credits || data.project_credits.length === 0) return;

    let html = '<ul class="credits-list">';
    for (const person of data.project_credits) {
        let content = '';
        if (person.url) {
            content = `<a href="#" class="credits-link" data-url="${person.url}"><strong>${person.name}</strong></a>`;
        } else {
            content = `<strong>${person.name}</strong>`;
        }

        if (person.role) {
            content += ` <span class="credits-role">(${person.role})</span>`;
        }

        html += `<li>${content}</li>`;
    }
    html += '</ul>';
    container.innerHTML = html;

    // Add click handlers for links
    container.querySelectorAll('.credits-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const url = a.dataset.url;
            if (window.exec) {
                window.exec(`am start -a android.intent.action.VIEW -d "${url}"`);
            } else {
                window.open(url, '_blank');
            }
        });
    });
}

function renderTranslationCredits(container, data) {
    if (!data.translations || Object.keys(data.translations).length === 0) {
        container.innerHTML = '<p class="credits-empty">No translation credits yet.</p>';
        return;
    }

    let html = '';
    for (const [langCode, langData] of Object.entries(data.translations)) {
        html += `<div class="credits-language">`;
        html += `<h4 class="credits-lang-name">${langData.name}</h4>`;
        html += `<ul class="credits-list">`;
        for (const contributor of langData.contributors) {
            if (contributor.url) {
                html += `<li><a href="#" class="credits-link" data-url="${contributor.url}">${contributor.name}</a></li>`;
            } else {
                html += `<li>${contributor.name}</li>`;
            }
        }
        html += `</ul></div>`;
    }
    container.innerHTML = html;

    // Add click handlers for links
    container.querySelectorAll('.credits-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const url = a.dataset.url;
            if (window.exec) {
                window.exec(`am start -a android.intent.action.VIEW -d "${url}"`);
            } else {
                window.open(url, '_blank');
            }
        });
    });
}

// Start
if (typeof ksu !== 'undefined') {
    init();
} else {
    window.addEventListener('load', init);
}
