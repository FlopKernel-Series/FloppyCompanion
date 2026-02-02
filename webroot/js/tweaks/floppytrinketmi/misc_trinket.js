// Misc Trinket Tweaks

let miscTrinketCurrentState = { touchboost: '0' };
let miscTrinketSavedState = { touchboost: '0' };
let miscTrinketPendingState = { touchboost: '0' };
let miscTrinketReferenceState = { touchboost: '0' };

const runMiscTrinketBackend = (...args) => window.runTweakBackend('misc_trinket', ...args);

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
    const hasChanges = miscTrinketPendingState.touchboost !== miscTrinketReferenceState.touchboost;

    window.setPendingIndicator('misc-trinket-pending-indicator', hasChanges);
}

async function loadMiscTrinketState() {
    const { current, saved } = await window.loadTweakState('misc_trinket');
    miscTrinketCurrentState = {
        touchboost: current.touchboost || '0'
    };

    // Normalize saved values (use defaults if empty)
    const savedNormalized = {
        touchboost: saved.touchboost || '0'
    };

    miscTrinketSavedState = { ...savedNormalized };

    const defMiscTrinket = window.getDefaultTweakPreset('misc_trinket');
    miscTrinketPendingState = window.initPendingState(miscTrinketCurrentState, miscTrinketSavedState, defMiscTrinket);

    const { reference } = window.resolveTweakReference(miscTrinketCurrentState, miscTrinketSavedState, defMiscTrinket);
    miscTrinketReferenceState = {
        touchboost: reference.touchboost || '0'
    };

    renderMiscTrinketCard();
}

async function saveMiscTrinket() {
    await runMiscTrinketBackend('save', 'touchboost', miscTrinketPendingState.touchboost);
    miscTrinketSavedState = { ...miscTrinketPendingState };
    miscTrinketReferenceState = { ...miscTrinketSavedState };
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

    // Register tweak immediately (Early Registration)
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('misc_trinket', {
            getState: () => ({ ...miscTrinketPendingState }),
            setState: (config) => {
                miscTrinketPendingState = { ...miscTrinketPendingState, ...config };
                renderMiscTrinketCard();
            },
            render: renderMiscTrinketCard,
            save: saveMiscTrinket,
            apply: applyMiscTrinket
        });
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

        window.bindSaveApplyButtons('misc-trinket', saveMiscTrinket, applyMiscTrinket);

        document.addEventListener('languageChanged', () => {
            renderMiscTrinketCard();
        });

                loadMiscTrinketState();

            });

        }
