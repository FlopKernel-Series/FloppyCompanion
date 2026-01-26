// Display Tweak

const DISPLAY_HBM_NODE = '/sys/devices/platform/soc/soc:qcom,dsi-display/hbm';
const DISPLAY_CABC_NODE = '/sys/devices/platform/soc/soc:qcom,dsi-display/cabc';

let displayCurrentState = { hbm: '0', cabc: '0' };
let displaySavedState = { hbm: '0', cabc: '0' };
let displayPendingState = { hbm: '0', cabc: '0' };

async function runDisplayBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/display.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Display backend error (${action}):`, error);
        return '';
    }
}

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
    const indicator = document.getElementById('display-pending-indicator');
    if (!indicator) return;

    const hasChanges =
        displayPendingState.hbm !== displaySavedState.hbm ||
        displayPendingState.cabc !== displaySavedState.cabc;

    indicator.classList.toggle('hidden', !hasChanges);
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
    const currentOutput = await runDisplayBackend('get_current');
    const current = parseKeyValue(currentOutput);
    displayCurrentState = {
        hbm: current.hbm || '0',
        cabc: current.cabc || '0'
    };

    const savedOutput = await runDisplayBackend('get_saved');
    const saved = parseKeyValue(savedOutput);
    displaySavedState = {
        hbm: saved.hbm || displayCurrentState.hbm || '0',
        cabc: saved.cabc || displayCurrentState.cabc || '0'
    };

    displayPendingState = { ...displaySavedState };
    renderDisplayCard();
}

async function saveDisplay() {
    await runDisplayBackend('save', displayPendingState.hbm, displayPendingState.cabc);
    displaySavedState = { ...displayPendingState };
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

        document.getElementById('display-btn-save')?.addEventListener('click', saveDisplay);
        document.getElementById('display-btn-apply')?.addEventListener('click', applyDisplay);
        document.getElementById('display-btn-save-apply')?.addEventListener('click', async () => {
            await saveDisplay();
            await applyDisplay();
        });

        document.addEventListener('languageChanged', () => {
            renderDisplayCard();
        });

        loadDisplayState();

        if (typeof window.registerTweak === 'function') {
            window.registerTweak('display', {
                getState: () => ({ ...displayPendingState }),
                            setState: (config) => {
                                displayPendingState = { ...displayPendingState, ...config };
                                renderDisplayCard();
                            },                render: renderDisplayCard,
                save: saveDisplay,
                apply: applyDisplay
            });
        }
    });
}
