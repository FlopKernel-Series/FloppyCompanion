// Display Tweak

const DISPLAY_HBM_NODE = '/sys/devices/platform/soc/soc:qcom,dsi-display/hbm';
const DISPLAY_CABC_NODE = '/sys/devices/platform/soc/soc:qcom,dsi-display/cabc';

let displayCurrentState = { hbm: '0', cabc: '0' };
let displaySavedState = { hbm: '0', cabc: '0' };
let displayPendingState = { hbm: '0', cabc: '0' };
let displayReferenceState = { hbm: '0', cabc: '0' };

const runDisplayBackend = (...args) => window.runTweakBackend('display', ...args);

function getDisplayHbmText(val) {
    switch (String(val)) {
        case '1': return window.t ? window.t('tweaks.display.hbmLow') : 'Low';
        case '2': return window.t ? window.t('tweaks.display.hbmMedium') : 'Medium';
        case '3': return window.t ? window.t('tweaks.display.hbmHigh') : 'High';
        default: return window.t ? window.t('tweaks.display.hbmDisabled') : 'Disabled';
    }
}

function getDisplayCabcText(val) {
    switch (String(val)) {
        case '1': return window.t ? window.t('tweaks.display.cabcLow') : 'Low (UI)';
        case '2': return window.t ? window.t('tweaks.display.cabcMedium') : 'Medium (Videos)';
        case '3': return window.t ? window.t('tweaks.display.cabcHigh') : 'High (Images)';
        default: return window.t ? window.t('tweaks.display.cabcDisabled') : 'Disabled';
    }
}

function updateDisplayOptions(containerId, selectedValue) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === String(selectedValue));
    });
}

function updateDisplayPendingIndicator() {
    const hasChanges =
        displayPendingState.hbm !== displayReferenceState.hbm ||
        displayPendingState.cabc !== displayReferenceState.cabc;

    window.setPendingIndicator('display-pending-indicator', hasChanges);
}

function renderDisplayCard() {
    updateDisplayOptions('display-hbm-options', displayPendingState.hbm);
    updateDisplayOptions('display-cabc-options', displayPendingState.cabc);

    const currentHbm = document.getElementById('display-current-hbm');
    const currentCabc = document.getElementById('display-current-cabc');
    if (currentHbm) currentHbm.textContent = getDisplayHbmText(displayCurrentState.hbm);
    if (currentCabc) currentCabc.textContent = getDisplayCabcText(displayCurrentState.cabc);

    updateDisplayPendingIndicator();
}

async function loadDisplayState() {
    const { current, saved } = await window.loadTweakState('display');
    displayCurrentState = {
        hbm: current.hbm || '0',
        cabc: current.cabc || '0'
    };

    displaySavedState = {
        hbm: saved.hbm || displayCurrentState.hbm || '0',
        cabc: saved.cabc || displayCurrentState.cabc || '0'
    };

    const defDisplay = window.getDefaultTweakPreset('display');
    displayPendingState = window.initPendingState(displayCurrentState, displaySavedState, defDisplay);

    const { reference } = window.resolveTweakReference(displayCurrentState, displaySavedState, defDisplay);
    displayReferenceState = {
        hbm: reference.hbm || '0',
        cabc: reference.cabc || '0'
    };
    renderDisplayCard();
}

async function saveDisplay() {
    await runDisplayBackend('save', displayPendingState.hbm, displayPendingState.cabc);
    displaySavedState = { ...displayPendingState };
    displayReferenceState = { ...displaySavedState };
    updateDisplayPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyDisplay() {
    await runDisplayBackend('apply', displayPendingState.hbm, displayPendingState.cabc);

    const currentOutput = await runDisplayBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    displayCurrentState = {
        hbm: current.hbm || '0',
        cabc: current.cabc || '0'
    };

    renderDisplayCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

function initDisplayTweak() {
    const card = document.getElementById('display-card');
    if (!card) return;

    // Only show on FloppyTrinketMi
    if (window.KERNEL_NAME !== 'FloppyTrinketMi') {
        card.classList.add('hidden');
        return;
    }

    // Register tweak immediately (Early Registration)
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('display', {
            getState: () => ({ ...displayPendingState }),
            setState: (config) => {
                displayPendingState = { ...displayPendingState, ...config };
                renderDisplayCard();
            },
            render: renderDisplayCard,
            save: saveDisplay,
            apply: applyDisplay
        });
    }

    // Check availability via backend
    runDisplayBackend('is_available').then((availability) => {
        const available = parseKeyValue(availability).available === '1';
        if (!available) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');

        // Wire up option buttons
        const hbmOptions = document.getElementById('display-hbm-options');
        if (hbmOptions) {
            hbmOptions.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    displayPendingState.hbm = String(btn.dataset.value || '0');
                    renderDisplayCard();
                });
            });
        }

        const cabcOptions = document.getElementById('display-cabc-options');
        if (cabcOptions) {
            cabcOptions.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    displayPendingState.cabc = String(btn.dataset.value || '0');
                    renderDisplayCard();
                });
            });
        }

        window.bindSaveApplyButtons('display', saveDisplay, applyDisplay);

        document.addEventListener('languageChanged', () => {
            renderDisplayCard();
        });

                loadDisplayState();

            });

        }
