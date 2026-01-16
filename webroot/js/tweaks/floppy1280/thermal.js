// Thermal Tweak

let thermalCurrentState = {};
let thermalSavedState = {};
let thermalPendingState = {};
let thermalAvailable = false;

// Mode descriptions for display
const THERMAL_MODE_NAMES = {
    '0': 'Disabled',
    '1': 'Stock',
    '2': 'Custom',
    '3': 'Performance'
};

// Run Thermal backend
async function runThermalBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/tweaks/thermal.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Check if thermal control is available (Floppy1280)
async function checkThermalAvailable() {
    const output = await runThermalBackend('is_available');
    const parsed = parseKeyValue(output);
    return parsed.available === '1';
}

// Load Thermal state
async function loadThermalState() {
    try {
        thermalAvailable = await checkThermalAvailable();

        if (!thermalAvailable) {
            return;
        }

        const currentOutput = await runThermalBackend('get_current');
        const savedOutput = await runThermalBackend('get_saved');

        thermalCurrentState = parseKeyValue(currentOutput);
        thermalSavedState = parseKeyValue(savedOutput);

        // Sanitize saved state
        Object.keys(thermalSavedState).forEach(key => {
            if (thermalSavedState[key] === '') delete thermalSavedState[key];
        });

        // Initialize pending state
        thermalPendingState = {
            mode: thermalSavedState.mode || thermalCurrentState.mode || '1',
            custom_freq: thermalSavedState.custom_freq || thermalCurrentState.custom_freq || ''
        };

        // Show thermal card
        const thermalCard = document.getElementById('thermal-card');
        if (thermalCard) thermalCard.classList.remove('hidden');

        renderThermalCard();
    } catch (e) {
        console.error('Failed to load thermal state:', e);
    }
}

// Render Thermal card UI
function renderThermalCard() {
    const modeVal = document.getElementById('thermal-val-mode');
    const customFreqVal = document.getElementById('thermal-val-custom_freq');
    const modeOptions = document.getElementById('thermal-mode-options');
    const customFreqRow = document.getElementById('thermal-custom-freq-row');
    const customFreqInput = document.getElementById('thermal-custom_freq');

    // Update current value display
    if (modeVal) {
        const modeName = THERMAL_MODE_NAMES[thermalCurrentState.mode] || thermalCurrentState.mode || '--';
        const modeNum = thermalCurrentState.mode;
        modeVal.textContent = modeNum !== undefined && modeNum !== '' ? `${modeName} - ${modeNum}` : modeName;
    }

    if (customFreqVal && thermalCurrentState.custom_freq) {
        customFreqVal.textContent = thermalCurrentState.custom_freq;
    }

    // Update mode selection buttons
    if (modeOptions) {
        modeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.mode === thermalPendingState.mode) {
                btn.classList.add('selected');
            }
        });
    }

    // Show/hide custom frequency row based on mode
    if (customFreqRow) {
        if (thermalPendingState.mode === '2') {
            customFreqRow.classList.remove('hidden');
        } else {
            customFreqRow.classList.add('hidden');
        }
    }

    // Update custom frequency input
    if (customFreqInput && thermalPendingState.custom_freq) {
        customFreqInput.value = thermalPendingState.custom_freq;
    }

    // Update mode description
    const descEl = document.getElementById('thermal-mode-description');
    if (descEl) {
        const descKey = `tweaks.thermal.desc${thermalPendingState.mode}`;
        const descText = window.t ? window.t(descKey) : '';

        if (thermalPendingState.mode === '0') {
            // Mode 0 gets warning icon and bold DANGEROUS text
            const warnText = window.t ? window.t('tweaks.thermal.desc0Warn') : 'DANGEROUS!';
            const warnIcon = (window.FC && window.FC.icons && window.FC.icons.svgString)
                ? window.FC.icons.svgString('warning_triangle', { className: 'warning-icon', fill: 'currentColor' })
                : '<svg class="warning-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
            descEl.innerHTML = `<span class="warning-text">${warnIcon}<strong>${warnText}</strong></span> ${descText}`;
        } else {
            descEl.textContent = descText;
        }
    }

    updateThermalPendingIndicator();
}

// Update pending indicator
function updateThermalPendingIndicator() {
    const indicator = document.getElementById('thermal-pending-indicator');
    if (!indicator) return;

    // If no saved config exists yet, compare against current kernel state (no "unsaved" on first load)
    const hasSavedConfig = thermalSavedState.mode !== undefined && thermalSavedState.mode !== '';
    const referenceMode = hasSavedConfig ? thermalSavedState.mode : thermalCurrentState.mode;
    const referenceFreq = hasSavedConfig ? (thermalSavedState.custom_freq || '') : (thermalCurrentState.custom_freq || '');

    const hasChanges = thermalPendingState.mode !== referenceMode ||
        (thermalPendingState.mode === '2' && thermalPendingState.custom_freq !== referenceFreq);

    if (hasChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Select thermal mode
function selectThermalMode(mode) {
    thermalPendingState.mode = mode;
    renderThermalCard();
}

// Save thermal config
async function saveThermal() {
    const mode = thermalPendingState.mode;
    const customFreq = thermalPendingState.custom_freq || '';

    await runThermalBackend('save', mode, customFreq);

    // Update saved state
    thermalSavedState.mode = mode;
    thermalSavedState.custom_freq = customFreq;

    updateThermalPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

// Apply thermal config
async function applyThermal() {
    const mode = thermalPendingState.mode;
    const customFreq = thermalPendingState.custom_freq || '';

    try {
        await runThermalBackend('apply', mode, customFreq);

        // Reload only the *current* state so active values update,
        // but do NOT reset pending state back to saved/current.
        const currentOutput = await runThermalBackend('get_current');
        thermalCurrentState = parseKeyValue(currentOutput);

        renderThermalCard();
        showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
    } catch (e) {
        console.error('Failed to apply thermal settings:', e);
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
    }
}

// Initialize Thermal tweak UI
function initThermalTweak() {
    loadThermalState();

    // Wire up mode option buttons
    const modeOptions = document.getElementById('thermal-mode-options');
    if (modeOptions) {
        modeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectThermalMode(btn.dataset.mode);
            });
        });
    }

    // Wire up custom frequency input
    const customFreqInput = document.getElementById('thermal-custom_freq');
    if (customFreqInput) {
        customFreqInput.addEventListener('input', (e) => {
            thermalPendingState.custom_freq = e.target.value;
            updateThermalPendingIndicator();
        });
    }

    // Wire up action buttons
    const saveBtn = document.getElementById('thermal-btn-save');
    const applyBtn = document.getElementById('thermal-btn-apply');
    const saveApplyBtn = document.getElementById('thermal-btn-save-apply');

    if (saveBtn) saveBtn.addEventListener('click', saveThermal);
    if (applyBtn) applyBtn.addEventListener('click', applyThermal);
    if (saveApplyBtn) saveApplyBtn.addEventListener('click', async () => {
        await saveThermal();
        await applyThermal();
    });

    // Re-render on language change to update description text
    document.addEventListener('languageChanged', () => {
        if (thermalAvailable) {
            renderThermalCard();
        }
    });

    // Register with preset system
    if (typeof registerTweak === 'function') {
        registerTweak('thermal', {
            getState: () => ({ ...thermalPendingState }),
            setState: (config) => {
                thermalPendingState = { ...config };
                renderThermalCard();
            },
            render: renderThermalCard,
            save: saveThermal,
            apply: applyThermal
        });
    }
}
