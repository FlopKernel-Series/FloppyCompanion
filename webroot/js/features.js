// features.js - Feature Loading, Rendering, and Backend Logic

let currentFeatures = {}; // Loaded from kernel
let pendingChanges = {};  // User edits
let showExperimental = false; // Experimental features toggle
let allowReadonlyPatch = false; // Allow patching read-only (info) features
let currentSchema = null; // Current feature schema
let currentProcCmdline = null; // Current /proc/cmdline
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

        const schema = isTrinketMi ? featureData.features_trinket : featureData.features_1280;

        // Retrieve cmdline
        const procCmdline = await exec('cat /proc/cmdline');

        // Unpack
        const rawFeatures = await runBackend('unpack');

        if (!rawFeatures || !rawFeatures.includes('Unpack successful')) {
            featuresContainer.innerHTML = `<div class="p-4 text-center">Failed to unpack.<br><small>${rawFeatures || 'No output'}</small></div>`;
            return;
        }

        // Read
        const featureOutput = await runBackend('read_features');

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

        renderFeatures(schema, procCmdline);

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
                    <svg class="status-icon reboot" onclick="toggleBubble('${bubbleId}', event)" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                    </svg>
                    <div id="${bubbleId}" class="status-bubble hidden">
                        The running kernel's value and boot partition's value are mismatched! A reboot might be pending to apply changes.
                    </div>
                </div>
            `;
        }

        // 2. Read-Only Warning
        if (item.type === 'info') {
            const bubbleId = `bubble-readonly-${item.key}`;
            const bubbleText = allowReadonlyPatch
                ? "Changing this feature's state is temporarily allowed, but will not be saved."
                : "This feature's state cannot be changed from the UI normally (read-only).";
            statusIconsHtml += `
                <div class="status-icon-wrapper" style="position:relative;">
                    <svg class="status-icon warning" onclick="toggleBubble('${bubbleId}', event)" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <div id="${bubbleId}" class="status-bubble hidden">
                        ${bubbleText}
                    </div>
                </div>
            `;
        }

        // --- Switch Construction ---
        let headerControl = '';
        if (item.type !== 'info' || allowReadonlyPatch) {
            headerControl = `
                <label class="m3-switch" style="display:inline-block; margin:0;">
                    <input type="checkbox" id="switch-${item.key}" ${isOn ? 'checked' : ''} 
                        onchange="updateFeature('${item.key}', this.checked ? '${defaultVal}' : '0', this)">
                    <span class="m3-switch-track">
                         <span class="m3-switch-thumb"></span>
                    </span>
                </label>
            `;
        }

        let bodyControls = '';

        if (item.type === 'select') {
            // Add "Disabled" option
            const optionsWithDisabled = [
                { val: '0', label: 'Disabled', desc: 'Disable this feature.', experimental: false },
                ...item.options
            ];

            // Filter options
            const visibleOptions = optionsWithDisabled.filter(opt =>
                showExperimental || !opt.experimental || (opt.val === currentVal)
            );

            const optionsHtml = visibleOptions.map(opt => {
                const isSelected = (currentVal === opt.val);
                const selectedClass = isSelected ? 'selected' : '';
                const expBadge = opt.experimental ? '<span class="experimental-badge" title="Experimental"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="#F44336" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3zM12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z"/></svg></span>' : '';

                return `
                <div class="option-item ${selectedClass}" 
                     data-val="${opt.val}"
                     onclick="updateFeature('${item.key}', '${opt.val}', this)">
                    ${expBadge}
                    <div class="option-header">
                        <span class="option-title">${opt.label}</span>
                    </div>
                    <div class="option-body">
                        <div class="option-desc">${opt.desc || ''}</div>
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
            displayValText += ' (Disabled)';
        }
        const currentValueHtml = `<div class="current-value-display">Current: ${displayValText}</div>`;

        // Feature-level experimental badge
        const featureExpBadge = item.experimental ? '<span class="experimental-badge" title="Experimental"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="#F44336" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3zM12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z"/></svg></span>' : '';

        // Render
        el.innerHTML = `
            ${featureExpBadge}
            <div class="feature-header">
                <div class="feature-info">
                    <h3 class="feature-title">${item.title}</h3>
                    <div class="feature-key">${item.key || ''}</div>
                    <div class="feature-desc">${item.desc || ''}</div>
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
        title: 'Apply changes?',
        body: '<p>This will flash the patched kernel to your device.</p><p><strong>This involves risks.</strong></p>',
        icon: '<svg viewBox="0 0 24 24" width="48" height="48"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>',
        iconClass: 'warning',
        confirmText: 'Apply',
        cancelText: 'Cancel'
    });
    if (!proceed) return;

    openModal();
    logToModal("Starting patch process...");

    // Construct args: key=val
    const patches = Object.entries(pendingChanges).map(([k, v]) => `${k}=${v}`);

    try {
        logToModal("Applying patches: " + patches.join(", "));

        // Start live log polling
        await startLogPolling();

        const terminalOutput = document.getElementById('terminal-output');
        const res = await runBackend('patch', ...patches);

        // Stop polling
        stopLogPolling();

        // Show any remaining output
        if (res && terminalOutput && !terminalOutput.textContent.includes(res)) {
            logToModal(res);
        }

        if (res.includes("Success")) {
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
