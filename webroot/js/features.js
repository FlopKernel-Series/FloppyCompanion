// features.js - Feature Loading, Rendering, and Backend Logic

let currentFeatures = {}; // Loaded from kernel
let pendingChanges = {};  // User edits
let showExperimental = false; // Experimental features toggle
let allowReadonlyPatch = false; // Allow patching read-only (info) features
let currentSchema = null; // Current feature schema
let currentProcCmdline = null; // Current /proc/cmdline
let currentFamily = null; // Current device family key for translation
let currentPatchMode = 'kernel'; // Current patch mode (kernel/header)
let isTrinketMi = false; // State for schema selection (set during init)

// --- Backend Communication ---

async function runBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/features_backend.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Live log polling for backend operations
let logPollInterval = null;
const LOG_FILE = '/data/adb/modules/floppy_companion/.patch_log';

async function startLogPolling() {
    let lastContent = '';
    // Clear log file first
    await exec(`echo "" > "${LOG_FILE}"`);

    const terminalOutput = document.getElementById('terminal-output');
    logPollInterval = setInterval(async () => {
        try {
            const content = await exec(`cat "${LOG_FILE}" 2>/dev/null || echo ""`);
            if (content && content !== lastContent) {
                // Only show new lines
                const newLines = content.substring(lastContent.length);
                if (newLines.trim() && terminalOutput) {
                    terminalOutput.textContent += newLines;
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                }
                lastContent = content;
            }
        } catch (e) {
            // Ignore polling errors
        }
    }, 200); // Poll every 200ms
}

function stopLogPolling() {
    if (logPollInterval) {
        clearInterval(logPollInterval);
        logPollInterval = null;
    }
}

// --- Feature Logic ---

// Set device type for schema selection (called from main.js)
function setDeviceContext(isTrinket) {
    isTrinketMi = isTrinket;
}

// Helper to expose to UI
window.loadFeaturesIfNeeded = function () {
    const featuresContainer = document.getElementById('features-container');
    // Refresh if empty or minimal content, but avoid loops
    if (featuresContainer && featuresContainer.childElementCount <= 1) {
        loadFeatures();
    }
}

async function loadFeatures() {
    const featuresContainer = document.getElementById('features-container');
    const fabApply = document.getElementById('fab-apply');

    if (!featuresContainer) return;

    featuresContainer.innerHTML = '<div class="loading-spinner"></div>';
    if (fabApply) {
        fabApply.style.display = 'none';
        if (window.updateBottomPadding) window.updateBottomPadding(false);
    }
    pendingChanges = {};

    try {
        // Load Feature Definitions
        const response = await fetch('features.json');
        if (!response.ok) throw new Error("Failed to load features.json");
        const featureData = await response.json();

        // Get device family data
        const familyKey = isTrinketMi ? 'trinket' : '1280';
        const deviceFamily = featureData.device_families[familyKey];
        if (!deviceFamily) {
            throw new Error(`Unknown device family: ${familyKey}`);
        }

        const schema = deviceFamily.features;
        currentPatchMode = deviceFamily.patch_mode || 'kernel';

        // Set global family for translation lookups
        currentFamily = familyKey;

        // Retrieve cmdline
        const procCmdline = await exec('cat /proc/cmdline');

        // Unpack
        const rawFeatures = await runBackend('unpack');

        if (!rawFeatures || !rawFeatures.includes('Unpack successful')) {
            featuresContainer.innerHTML = `<div class="p-4 text-center">Failed to unpack.<br><small>${rawFeatures || 'No output'}</small></div>`;
            return;
        }

        // Read features (pass patch mode)
        const featureOutput = await runBackend('read_features', currentPatchMode);

        const startMarker = '---FEATURES_START---';
        const endMarker = '---FEATURES_END---';

        if (!featureOutput.includes(startMarker)) {
            featuresContainer.innerHTML = `<div class="p-4 text-center">Failed to read features.<br><small>${featureOutput}</small></div>`;
            return;
        }

        const content = featureOutput.split(startMarker)[1].split(endMarker)[0].trim();

        currentFeatures = {};
        const tokens = content.split(/\s+/);
        tokens.forEach(token => {
            if (token.includes('=')) {
                const [k, v] = token.split('=');
                currentFeatures[k] = v;
            }
        });

        // Expose Unlocked Mode (superfloppy) for Tweaks gating
        if (currentFeatures.superfloppy !== undefined) {
            window.currentSuperfloppyMode = String(currentFeatures.superfloppy);
            document.dispatchEvent(new CustomEvent('superfloppyModeChanged', {
                detail: { mode: window.currentSuperfloppyMode, source: 'load' }
            }));
        }

        renderFeatures(schema, procCmdline);

        // Visibility check for Read-Only Patch Toggle
        const readonlyContainer = document.getElementById('readonly-patch-container');
        if (readonlyContainer) {
            const hasInfoFeatures = schema.some(f => f.type === 'info' || f.readOnly);
            readonlyContainer.style.display = hasInfoFeatures ? 'block' : 'none';
            const roToggle = document.getElementById('readonly-patch-toggle');
            if (roToggle) roToggle.disabled = !hasInfoFeatures;
        }

    } catch (e) {
        featuresContainer.innerHTML = `<div class="p-4 text-center">Error: ${e.message}</div>`;
    }
}

function renderFeatures(schema, procCmdline) {
    const featuresContainer = document.getElementById('features-container');
    const fabApply = document.getElementById('fab-apply');

    // Store for re-render when experimental toggle changes
    currentSchema = schema;
    currentProcCmdline = procCmdline;

    featuresContainer.innerHTML = '';

    const getIconData = function (name, fallback) {
        const def = window.FC && window.FC.icons && window.FC.icons.get ? window.FC.icons.get(name) : null;
        const p = def && def.paths && def.paths[0] ? def.paths[0] : null;
        const d = typeof p === 'string' ? p : (p && p.d ? p.d : '');

        return {
            viewBox: (def && def.viewBox) || (fallback && fallback.viewBox) || '0 0 24 24',
            d: d || (fallback && fallback.d) || ''
        };
    };

    const rebootIcon = getIconData('restart_alt', {
        viewBox: '0 0 24 24',
        d: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'
    });
    const infoIcon = getIconData('info', {
        viewBox: '0 0 24 24',
        d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
    });
    const warningIcon = getIconData('warning', {
        viewBox: '0 0 24 24',
        d: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'
    });

    if (!schema || schema.length === 0) {
        featuresContainer.innerHTML = '<p class="text-center p-4">No features defined for this device.</p>';
        return;
    }

    schema.forEach(item => {
        // Skip entirely if experimental and toggle off, UNLESS enabled
        const currentVal = currentFeatures[item.key] || '0';
        const isEnabled = currentVal !== '0';
        if (item.experimental && !showExperimental && !isEnabled) {
            return;
        }

        const el = document.createElement('div');
        el.className = 'feature-card';

        // Int Toggle Logic: ON if currentVal is not '0'
        const isOn = isEnabled;

        // Default Value Logic for toggle ON
        let defaultVal = '1';
        if (item.type === 'select' && item.options && item.options.length > 0) {
            defaultVal = item.options[0].val;
        }

        let liveVal = null;
        if (procCmdline && item.key) {
            const match = procCmdline.match(new RegExp(`${item.key}=(\\d+)`));
            if (match) liveVal = match[1];
        }

        // --- Status Icons Logic ---
        let statusIconsHtml = '';

        // 1. Reboot Warning
        if (liveVal !== null && liveVal !== currentVal) {
            const bubbleId = `bubble-reboot-${item.key}`;
            statusIconsHtml += `
                <div class="status-icon-wrapper" style="position:relative;">
                    <svg class="status-icon reboot" onclick="toggleBubble('${bubbleId}', event)" viewBox="${rebootIcon.viewBox}">
                        <path fill="currentColor" d="${rebootIcon.d}"/>
                    </svg>
                    <div id="${bubbleId}" class="status-bubble hidden">
                        ${t('features.tooltipReboot')}
                    </div>
                </div>
            `;
        }

        // 2. Read-Only Warning
        if (item.type === 'info' || item.readOnly) {
            const bubbleId = `bubble-readonly-${item.key}`;
            const bubbleText = allowReadonlyPatch
                ? t('features.tooltipReadOnlyAllowed')
                : t('features.tooltipReadOnlyBlocked');
            statusIconsHtml += `
                <div class="status-icon-wrapper" style="position:relative;">
                    <svg class="status-icon warning" onclick="toggleBubble('${bubbleId}', event)" viewBox="${infoIcon.viewBox}">
                        <path fill="currentColor" d="${infoIcon.d}"/>
                    </svg>
                    <div id="${bubbleId}" class="status-bubble hidden">
                        ${bubbleText}
                    </div>
                </div>
            `;
        }

        // --- Switch Construction ---
        let headerControl = '';
        // Allow switch for all types, but treat explicit readOnly flag same as type 'info'
        const isInfo = item.type === 'info' || item.readOnly;
        const isReadOnly = isInfo && !allowReadonlyPatch;

        headerControl = `
            <label class="m3-switch" style="display:inline-block; margin:0; ${isReadOnly ? 'opacity: 0.5; pointer-events: none;' : ''}">
                <input type="checkbox" id="switch-${item.key}" ${isOn ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}
                    onchange="updateFeature('${item.key}', this.checked ? '${defaultVal}' : '0', this)">
                <span class="m3-switch-track">
                     <span class="m3-switch-thumb"></span>
                </span>
            </label>
        `;

        let bodyControls = '';

        if (item.type === 'select') {
            // Add "Disabled" option with translated strings
            const disabledLabel = t('features.optionDisabled');
            const disabledDesc = t('features.disabledDesc');
            const optionsWithDisabled = [
                { val: '0', label: disabledLabel, desc: disabledDesc, experimental: false, isDisabledOption: true },
                ...item.options
            ];

            // Filter options
            const visibleOptions = optionsWithDisabled.filter(opt =>
                showExperimental || !opt.experimental || (opt.val === currentVal)
            );

            const optionsHtml = visibleOptions.map(opt => {
                const isSelected = (currentVal === opt.val);
                const selectedClass = isSelected ? 'selected' : '';
                const expBadge = opt.experimental ? `<span class="experimental-badge" title="${t('features.tooltipExperimental')}"><svg viewBox="${warningIcon.viewBox}" width="16" height="16"><path fill="#F44336" d="${warningIcon.d}"/></svg></span>` : '';

                return `
                <div class="option-item ${selectedClass} ${isReadOnly ? 'readonly' : ''}"
                     data-val="${opt.val}"
                     ${isReadOnly ? 'aria-disabled="true"' : `onclick="updateFeature('${item.key}', '${opt.val}', this)"`}>
                    ${expBadge}
                    <div class="option-header">
                        <span class="option-title">${tf(item.key, 'label', opt.val, currentFamily) || opt.label}</span>
                    </div>
                    <div class="option-body">
                        <div class="option-desc">${tf(item.key, 'desc', opt.val, currentFamily) || opt.desc || ''}</div>
                        <span class="option-val">${opt.val}</span>
                    </div>
                </div>
                `;
            }).join('');

            bodyControls = `<div class="option-list" id="ctrl-${item.key}">${optionsHtml}</div>`;
        }

        // Current Value Display
        let displayValText = currentVal;
        if (currentVal === '0') {
            displayValText += ' (' + (t('features.optionDisabled')) + ')';
        }
        const currentValueHtml = `<div class="current-value-display">${t('features.currentLabel')} ${displayValText}</div>`;

        // Feature-level experimental badge
        const featureExpBadge = item.experimental ? `<span class="experimental-badge" title="${t('features.tooltipExperimental')}"><svg viewBox="${warningIcon.viewBox}" width="18" height="18"><path fill="#F44336" d="${warningIcon.d}"/></svg></span>` : '';

        // Render
        el.innerHTML = `
            ${featureExpBadge}
            <div class="feature-header">
                <div class="feature-info">
                    <h3 class="feature-title">${tf(item.key, 'title', null, currentFamily) || item.title}</h3>
                    <div class="feature-key">${item.key || ''}</div>
                    <div class="feature-desc">${tf(item.key, 'desc', null, currentFamily) || item.desc || ''}</div>
                </div>
                <div class="feature-action">
                    ${headerControl}
                </div>
            </div>
            ${bodyControls}
            
            <div class="feature-footer">
                 ${currentValueHtml}
                 <div class="status-icon-container">
                     ${statusIconsHtml}
                 </div>
            </div>
        `;

        featuresContainer.appendChild(el);
    });
}

// User Interaction
window.updateFeature = function (key, val, target) {
    if (Object.keys(pendingChanges).length === 0) {
        // First change
    }

    pendingChanges[key] = val; // Store change

    // Live-update Unlocked Mode for Tweaks availability (even before Apply)
    if (key === 'superfloppy') {
        window.currentSuperfloppyMode = String(val);
        document.dispatchEvent(new CustomEvent('superfloppyModeChanged', {
            detail: { mode: window.currentSuperfloppyMode, source: 'pending' }
        }));
    }

    const switchInput = document.getElementById(`switch-${key}`);
    const fabApply = document.getElementById('fab-apply');

    if (target.type === 'checkbox') {
        // Handle Switch Toggle
        const controls = document.getElementById(`ctrl-${key}`);
        if (controls) {
            if (val === '0') {
                // Turned OFF: Select Disabled option (val 0)
                Array.from(controls.children).forEach(c => {
                    if (c.dataset.val === '0') c.classList.add('selected');
                    else c.classList.remove('selected');
                });
            } else {
                // Turned ON: Select chip matching val
                Array.from(controls.children).forEach(c => {
                    if (c.dataset.val === val) c.classList.add('selected');
                    else c.classList.remove('selected');
                });
            }
        }
    } else {
        // Handle Chip Click
        const container = target.parentElement;
        Array.from(container.children).forEach(c => c.classList.remove('selected'));
        target.classList.add('selected');

        // Sync Switch
        if (switchInput) {
            switchInput.checked = (val !== '0');
        }
    }

    if (fabApply) fabApply.style.display = 'flex';
    if (window.updateBottomPadding) window.updateBottomPadding(true);
};

// Persistence Logic
async function applyChanges() {
    if (Object.keys(pendingChanges).length === 0) return;

    const proceed = await showConfirmModal({
        title: t('modal.applyChangesTitle'),
        body: t('modal.applyChangesBody'),
        iconClass: 'warning',
        confirmText: t('modal.apply'),
        cancelText: t('modal.cancel')
    });
    if (!proceed) return;

    openModal();
    logToModal("Starting patch process...");

    // Construct args: key=val
    const patches = Object.entries(pendingChanges).map(([k, v]) => `${k}=${v}`);

    try {
        logToModal(`Applying patches (${currentPatchMode} mode): ` + patches.join(", "));

        // Start live log polling
        await startLogPolling();

        const terminalOutput = document.getElementById('terminal-output');
        // Pass patch mode as first arg
        const res = await runBackend('patch', currentPatchMode, ...patches);

        // Stop polling
        stopLogPolling();

        // Show any remaining output
        if (res && terminalOutput && !terminalOutput.textContent.includes(res)) {
            logToModal(res);
        }

        if (res && res.includes("Success")) {
            logToModal("\nPersisting changes...");

            // Persist changes to /cache/fk_feat
            for (const [key, val] of Object.entries(pendingChanges)) {
                // Use currentSchema from renderFeatures scope
                const feature = currentSchema.find(f => f.key === key);

                if (feature && feature.save) {
                    try {
                        let pRes;
                        if (val === '0') {
                            // Disabled: Remove from cache entirely
                            pRes = await exec(`sh /data/adb/modules/floppy_companion/persistence.sh remove "${key}"`);
                        } else {
                            // Enabled: Save to cache
                            pRes = await exec(`sh /data/adb/modules/floppy_companion/persistence.sh save "${key}" "${val}" "${feature.type}"`);
                        }
                        logToModal(pRes.trim());
                    } catch (pe) {
                        logToModal(`Failed to persist ${key}: ${pe.message}`);
                    }
                }
            }

            // Check for incompatible Undervolt settings
            if (pendingChanges['superfloppy']) {
                const val = pendingChanges['superfloppy'];
                // Modes 1, 2, 3, 5 are overclock/unlocked modes incompatible with custom UV
                if (['1', '2', '3', '5'].includes(val)) {
                    logToModal("\nClearing incompatible undervolt settings...");
                    if (window.clearUndervoltPersistence) {
                        await window.clearUndervoltPersistence();
                        logToModal("Undervolt settings cleared.");
                    }
                }
            }

            logToModal("\nAll done! Please reboot.");
            const modalClose = document.getElementById('modal-close');
            if (modalClose) modalClose.classList.remove('hidden');

            const fabApply = document.getElementById('fab-apply');
            if (fabApply) fabApply.style.display = 'none';
            if (window.updateBottomPadding) window.updateBottomPadding(false);

            loadFeatures(); // Reload to sync
        } else {
            logToModal("\nFailed!");
            const modalClose = document.getElementById('modal-close');
            if (modalClose) modalClose.classList.remove('hidden');
        }
    } catch (e) {
        logToModal("Error: " + e.message);
        const modalClose = document.getElementById('modal-close');
        if (modalClose) modalClose.classList.remove('hidden');
    }
}

// Global Toggles
window.setExperimental = function (val) {
    showExperimental = val;
    if (currentSchema && currentProcCmdline !== null) {
        renderFeatures(currentSchema, currentProcCmdline);
    }
}

window.setReadonlyPatch = function (val) {
    allowReadonlyPatch = val;
    if (currentSchema && currentProcCmdline !== null) {
        renderFeatures(currentSchema, currentProcCmdline);
    }
}

// --- Bubble Logic ---
window.toggleBubble = function (id, event) {
    if (event) event.stopPropagation();
    const bubble = document.getElementById(id);
    if (bubble) {
        // Hide all other bubbles first
        document.querySelectorAll('.status-bubble').forEach(b => {
            if (b.id !== id) b.classList.add('hidden');
        });
        bubble.classList.toggle('hidden');
    }
}

// Hide bubbles when clicking anywhere else
document.addEventListener('click', () => {
    document.querySelectorAll('.status-bubble').forEach(b => {
        b.classList.add('hidden');
    });
});

// --- Expose pending changes check ---
window.hasPendingChanges = function () {
    return Object.keys(pendingChanges).length > 0;
};

// Listen for language changes to re-render features
document.addEventListener('languageChanged', (e) => {
    if (currentSchema && currentProcCmdline !== null) {
        renderFeatures(currentSchema, currentProcCmdline);
    }
});
