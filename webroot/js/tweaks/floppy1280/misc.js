// Misc Tweaks

let miscCurrentState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscSavedState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscPendingState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscReferenceState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };

const runMiscBackend = (...args) => window.runTweakBackend('misc', ...args);

function getEnabledDisabledText(val) {
    if (val === '1') {
        return window.t ? window.t('tweaks.misc.enabled') : 'Enabled';
    }
    return window.t ? window.t('tweaks.misc.disabled') : 'Disabled';
}

function renderMiscCard() {
    // Update value labels from current state
    const valBlocked3 = document.getElementById('misc-val-blocked3');
    const valGpuClkLck = document.getElementById('misc-val-gpuclklck');
    const valGpuUnlock = document.getElementById('misc-val-gpuunlock');

    if (valBlocked3) valBlocked3.textContent = getEnabledDisabledText(miscCurrentState.block_ed3);
    if (valGpuClkLck) valGpuClkLck.textContent = getEnabledDisabledText(miscCurrentState.gpu_clklck);
    if (valGpuUnlock) valGpuUnlock.textContent = getEnabledDisabledText(miscCurrentState.gpu_unlock);

    // Update switches from pending state
    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) blockEd3Switch.checked = (miscPendingState.block_ed3 === '1');
    if (gpuClkLckSwitch) gpuClkLckSwitch.checked = (miscPendingState.gpu_clklck === '1');
    if (gpuUnlockSwitch) gpuUnlockSwitch.checked = (miscPendingState.gpu_unlock === '1');

    updateMiscPendingIndicator();
    updateGpuUnlockAvailability();
}

function updateMiscPendingIndicator() {
    const hasChanges =
        miscPendingState.block_ed3 !== miscReferenceState.block_ed3 ||
        miscPendingState.gpu_clklck !== miscReferenceState.gpu_clklck ||
        miscPendingState.gpu_unlock !== miscReferenceState.gpu_unlock;

    window.setPendingIndicator('misc-pending-indicator', hasChanges);
}

function updateGpuUnlockAvailability() {
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');
    if (!gpuUnlockSwitch) return;

    // If schema-driven control rules are available, let the generic engine handle it.
    if (window.__tweaksSchema) {
        applyControlAvailability(window.__tweaksSchema);
        return;
    }

    // Prefer schema-declared condition, fallback to derived vars / raw superfloppy mode.
    let isOcMode = truthy(getTweakVar('isUnlockedOcMode'));
    if (!isOcMode) {
        const superfloppyMode = String(getTweakVar('superfloppyMode') ?? window.currentSuperfloppyMode ?? '0');
        isOcMode = ['1', '2', '3'].includes(superfloppyMode);
    }

    const switchContainer = gpuUnlockSwitch.closest('.tweak-switch-container');

    if (!isOcMode) {
        gpuUnlockSwitch.disabled = true;
        if (switchContainer) switchContainer.style.opacity = '0.5';
    } else {
        gpuUnlockSwitch.disabled = false;
        if (switchContainer) switchContainer.style.opacity = '1';
    }
}

async function loadMiscState() {
    // Get current kernel state
    const { current, saved } = await window.loadTweakState('misc');
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0'
    };

    miscSavedState = {
        block_ed3: saved.block_ed3 || '0',
        gpu_clklck: saved.gpu_clklck || '0',
        gpu_unlock: saved.gpu_unlock || '0'
    };

    const defMisc = window.getDefaultTweakPreset('misc');
    miscPendingState = window.initPendingState(miscCurrentState, miscSavedState, defMisc);

    const { reference } = window.resolveTweakReference(miscCurrentState, miscSavedState, defMisc);
    miscReferenceState = {
        block_ed3: reference.block_ed3 || '0',
        gpu_clklck: reference.gpu_clklck || '0',
        gpu_unlock: reference.gpu_unlock || '0'
    };

    renderMiscCard();
}

async function saveMisc() {
    await runMiscBackend('save', 'block_ed3', miscPendingState.block_ed3);
    await runMiscBackend('save', 'gpu_clklck', miscPendingState.gpu_clklck);
    await runMiscBackend('save', 'gpu_unlock', miscPendingState.gpu_unlock);
    miscSavedState = { ...miscPendingState };
    miscReferenceState = { ...miscSavedState };
    updateMiscPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Saved');
}

async function applyMisc() {
    await runMiscBackend('apply', 'block_ed3', miscPendingState.block_ed3);
    await runMiscBackend('apply', 'gpu_clklck', miscPendingState.gpu_clklck);
    await runMiscBackend('apply', 'gpu_unlock', miscPendingState.gpu_unlock);

    // Refresh only current kernel state so active values update,
    // but do NOT reset pending state back to saved.
    const currentOutput = await runMiscBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0'
    };

    renderMiscCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
}

function initMiscTweak() {
    // Register tweak immediately (Early Registration)
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('misc', {
            getState: () => ({ ...miscPendingState }),
            setState: (config) => {
                miscPendingState = { ...miscPendingState, ...config };
                renderMiscCard();
            },
            render: renderMiscCard,
            save: saveMisc,
            apply: applyMisc
        });
    }

    const miscCard = document.getElementById('misc-card');
    if (!miscCard) return;

    // Only show on Floppy1280
    if (window.KERNEL_NAME !== 'Floppy1280') {
        miscCard.classList.add('hidden');
        return;
    }

    // Show card
    miscCard.classList.remove('hidden');

    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    // Switch change handlers - update pending state only
    if (blockEd3Switch) {
        blockEd3Switch.addEventListener('change', (e) => {
            miscPendingState.block_ed3 = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    if (gpuClkLckSwitch) {
        gpuClkLckSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_clklck = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    if (gpuUnlockSwitch) {
        gpuUnlockSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_unlock = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    window.bindSaveApplyButtons('misc', saveMisc, applyMisc);

    // Load initial state
    loadMiscState();

    // Listen for superfloppy mode changes
    document.addEventListener('superfloppyModeChanged', () => {
        updateGpuUnlockAvailability();
    });

    // Language change listener
    document.addEventListener('languageChanged', () => {
        renderMiscCard();
    });
}
