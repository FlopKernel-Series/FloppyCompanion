// Misc Trinket Tweaks

let miscTrinketCurrentState = { touchboost: '0' };
let miscTrinketSavedState = { touchboost: '0' };
let miscTrinketPendingState = { touchboost: '0' };

async function runMiscTrinketBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/misc_trinket.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Misc Trinket backend error (${action}):`, error);
        return '';
    }
}

function getEnabledDisabledText(val) {
    if (val === '1') {
        return window.t ? window.t('tweaks.miscTrinket.enabled') : 'Enabled';
    }
    return window.t ? window.t('tweaks.miscTrinket.disabled') : 'Disabled';
}

function renderMiscTrinketCard() {
    const valTouchboost = document.getElementById('misc-trinket-val-touchboost');
    if (valTouchboost) valTouchboost.textContent = getEnabledDisabledText(miscTrinketCurrentState.touchboost);

    const touchboostSwitch = document.getElementById('misc-trinket-touchboost-switch');
    if (touchboostSwitch) touchboostSwitch.checked = (miscTrinketPendingState.touchboost === '1');

    updateMiscTrinketPendingIndicator();
}

function updateMiscTrinketPendingIndicator() {
    const indicator = document.getElementById('misc-trinket-pending-indicator');
    if (!indicator) return;

    const hasChanges = miscTrinketPendingState.touchboost !== miscTrinketSavedState.touchboost;

    if (hasChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

async function loadMiscTrinketState() {
    const currentOutput = await runMiscTrinketBackend('get_current');
    const current = parseKeyValue(currentOutput);
    miscTrinketCurrentState = {
        touchboost: current.touchboost || '0'
    };

    const savedOutput = await runMiscTrinketBackend('get_saved');
    const saved = parseKeyValue(savedOutput);

    // Normalize saved values (use defaults if empty)
    const savedNormalized = {
        touchboost: saved.touchboost || '0'
    };

    // Check if saved values are the defaults (which backend returns when no config file exists)
    const isDefaultSaved = savedNormalized.touchboost === '0';

    // If saved is defaults and differs from current, there's no saved config file - use current
    // Otherwise, use saved (either it's not defaults, or it matches current)
    const savedDiffersFromCurrent = savedNormalized.touchboost !== miscTrinketCurrentState.touchboost;

    const hasActualSavedConfig = !isDefaultSaved || !savedDiffersFromCurrent;

    // If no saved config exists, set saved state to current so pending indicator works correctly
    if (hasActualSavedConfig) {
        miscTrinketSavedState = savedNormalized;
    } else {
        miscTrinketSavedState = { ...miscTrinketCurrentState };
    }

    // Initialize pending state from current if no saved config, otherwise from saved
    miscTrinketPendingState = hasActualSavedConfig ? { ...miscTrinketSavedState } : { ...miscTrinketCurrentState };

    renderMiscTrinketCard();
}

async function saveMiscTrinket() {
    await runMiscTrinketBackend('save', 'touchboost', miscTrinketPendingState.touchboost);
    miscTrinketSavedState = { ...miscTrinketPendingState };
    updateMiscTrinketPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyMiscTrinket() {
    await runMiscTrinketBackend('apply', 'touchboost', miscTrinketPendingState.touchboost);

    const currentOutput = await runMiscTrinketBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    miscTrinketCurrentState = {
        touchboost: current.touchboost || '0'
    };

    renderMiscTrinketCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

function initMiscTrinketTweak() {
    const card = document.getElementById('misc-trinket-card');
    if (!card) return;

    if (window.KERNEL_NAME !== 'FloppyTrinketMi') {
        card.classList.add('hidden');
        return;
    }

    runMiscTrinketBackend('is_available').then((availability) => {
        const available = parseKeyValue(availability).available === '1';
        if (!available) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');

        const touchboostSwitch = document.getElementById('misc-trinket-touchboost-switch');
        if (touchboostSwitch) {
            touchboostSwitch.addEventListener('change', (e) => {
                miscTrinketPendingState.touchboost = e.target.checked ? '1' : '0';
                updateMiscTrinketPendingIndicator();
            });
        }

        document.getElementById('misc-trinket-btn-save')?.addEventListener('click', saveMiscTrinket);
        document.getElementById('misc-trinket-btn-apply')?.addEventListener('click', applyMiscTrinket);
        document.getElementById('misc-trinket-btn-save-apply')?.addEventListener('click', async () => {
            await saveMiscTrinket();
            await applyMiscTrinket();
        });

        document.addEventListener('languageChanged', () => {
            renderMiscTrinketCard();
        });

        loadMiscTrinketState();

        if (typeof window.registerTweak === 'function') {
            window.registerTweak('misc_trinket', {
                getState: () => ({ ...miscTrinketPendingState }),
                            setState: (config) => {
                                miscTrinketPendingState = { ...miscTrinketPendingState, ...config };
                                renderMiscTrinketCard();
                            },                render: renderMiscTrinketCard,
                save: saveMiscTrinket,
                apply: applyMiscTrinket
            });
        }
    });
}
