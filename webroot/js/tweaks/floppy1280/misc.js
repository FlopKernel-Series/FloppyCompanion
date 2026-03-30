// Shared Exynos tweaks state

let miscCurrentState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscSavedState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscPendingState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscReferenceState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscCapabilities = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let exynosStateInitialized = false;
let exynosUiBound = false;
let exynosVariantListenerBound = false;

const runMiscBackend = (...args) => window.runTweakBackend('misc', ...args);
const EXYNOS_STATE_KEYS = ['block_ed3', 'gpu_clklck', 'gpu_unlock'];
const MISC_KEYS = ['block_ed3'];
const EXYNOS_KEYS = ['gpu_clklck', 'gpu_unlock'];

function getEnabledDisabledText(val) {
    if (val === '1') {
        return window.t ? window.t('tweaks.misc.enabled') : 'Enabled';
    }
    return window.t ? window.t('tweaks.misc.disabled') : 'Disabled';
}

function translateTextOrFallback(key, fallback) {
    const translated = window.t ? window.t(key) : '';
    if (translated && !String(translated).startsWith(key)) {
        return translated;
    }
    return fallback;
}

function getSupportedExynosKeys() {
    const keys = [];
    if (miscCapabilities.gpu_clklck === '1' && window.KERNEL_NAME !== 'Floppy2100') {
        keys.push('gpu_clklck');
    }
    if (miscCapabilities.gpu_unlock === '1') {
        keys.push('gpu_unlock');
    }
    return keys;
}

function isMiscKeySupported(key) {
    if (key === 'block_ed3') return miscCapabilities.block_ed3 === '1';
    if (key === 'gpu_clklck') return getSupportedExynosKeys().includes('gpu_clklck');
    if (key === 'gpu_unlock') return getSupportedExynosKeys().includes('gpu_unlock');
    return false;
}

function getCardSupportedKeys(cardId) {
    return cardId === 'misc' ? MISC_KEYS.filter(isMiscKeySupported) : EXYNOS_KEYS.filter(isMiscKeySupported);
}

function setCardVisibility(cardId, visible) {
    const card = document.getElementById(`${cardId}-card`);
    if (card) {
        card.classList.toggle('hidden', !visible);
    }
}

function updateRowVisibility() {
    const rowDefs = [
        { id: 'misc-row-blocked3', visible: isMiscKeySupported('block_ed3') },
        { id: 'misc-row-gpuclklck', visible: isMiscKeySupported('gpu_clklck') },
        { id: 'misc-row-gpuunlock', visible: isMiscKeySupported('gpu_unlock') }
    ];

    rowDefs.forEach(({ id, visible }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', !visible);
        el.style.borderBottom = visible ? '1px solid var(--md-sys-color-outline-variant)' : '';
    });

    ['misc', 'exynos'].forEach((cardId) => {
        const rows = cardId === 'misc'
            ? [document.getElementById('misc-row-blocked3')]
            : [document.getElementById('misc-row-gpuclklck'), document.getElementById('misc-row-gpuunlock')];
        const visibleRows = rows.filter((row) => row && !row.classList.contains('hidden'));
        if (visibleRows.length > 0) {
            visibleRows[visibleRows.length - 1].style.borderBottom = 'none';
        }
    });
}

function updateCardTitles() {
    const miscTitle = document.querySelector('#misc-card .card-title');
    const exynosTitle = document.querySelector('#exynos-card .card-title');

    if (miscTitle) miscTitle.textContent = translateTextOrFallback('tweaks.miscGenericTitle', 'Misc Tweaks');
    if (exynosTitle) exynosTitle.textContent = translateTextOrFallback('tweaks.exynos.title', 'Exynos Tweaks');
}

function updateGpuUnlockCopy() {
    const gpuUnlockBubble = document.getElementById('bubble-misc-gpuunlock');
    if (!gpuUnlockBubble) return;

    const key = window.KERNEL_NAME === 'Floppy2100'
        ? 'tweaks.tooltip.gpuUnlock2100'
        : 'tweaks.tooltip.gpuUnlock';
    gpuUnlockBubble.textContent = translateTextOrFallback(key, 'Enables GPU unlock immediately.');
}

function renderSharedValues() {
    const valBlocked3 = document.getElementById('misc-val-blocked3');
    const valGpuClkLck = document.getElementById('misc-val-gpuclklck');
    const valGpuUnlock = document.getElementById('misc-val-gpuunlock');

    if (valBlocked3) valBlocked3.textContent = getEnabledDisabledText(miscCurrentState.block_ed3);
    if (valGpuClkLck) valGpuClkLck.textContent = getEnabledDisabledText(miscCurrentState.gpu_clklck);
    if (valGpuUnlock) valGpuUnlock.textContent = getEnabledDisabledText(miscCurrentState.gpu_unlock);

    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) blockEd3Switch.checked = miscPendingState.block_ed3 === '1';
    if (gpuClkLckSwitch) gpuClkLckSwitch.checked = miscPendingState.gpu_clklck === '1';
    if (gpuUnlockSwitch) gpuUnlockSwitch.checked = miscPendingState.gpu_unlock === '1';
}

function updatePendingIndicatorFor(cardId, keys) {
    const hasChanges = keys.some((key) => miscPendingState[key] !== miscReferenceState[key]);
    window.setPendingIndicator(`${cardId}-pending-indicator`, hasChanges);
}

function updatePendingIndicators() {
    updatePendingIndicatorFor('misc', getCardSupportedKeys('misc'));
    updatePendingIndicatorFor('exynos', getCardSupportedKeys('exynos'));
}

function updateGpuUnlockAvailability() {
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');
    if (!gpuUnlockSwitch) return;

    const switchContainer = gpuUnlockSwitch.closest('.tweak-switch-container');
    if (!isMiscKeySupported('gpu_unlock')) {
        gpuUnlockSwitch.disabled = true;
        if (switchContainer) switchContainer.style.opacity = '0.5';
        return;
    }

    if (window.KERNEL_NAME === 'Floppy2100') {
        gpuUnlockSwitch.disabled = false;
        if (switchContainer) switchContainer.style.opacity = '1';
        return;
    }

    let isOcMode = truthy(getTweakVar('isUnlockedOcMode'));
    if (!isOcMode) {
        const superfloppyMode = String(getTweakVar('superfloppyMode') ?? window.currentSuperfloppyMode ?? '0');
        isOcMode = ['1', '2', '3'].includes(superfloppyMode);
    }

    gpuUnlockSwitch.disabled = !isOcMode;
    if (switchContainer) switchContainer.style.opacity = isOcMode ? '1' : '0.5';
}

function renderExynosCards() {
    updateCardTitles();
    updateGpuUnlockCopy();
    updateRowVisibility();
    setCardVisibility('misc', getCardSupportedKeys('misc').length > 0);
    setCardVisibility('exynos', getCardSupportedKeys('exynos').length > 0);
    renderSharedValues();
    updatePendingIndicators();
    updateGpuUnlockAvailability();
}

async function loadSharedExynosState() {
    const capabilitiesOutput = await runMiscBackend('get_capabilities');
    const capabilities = parseKeyValue(capabilitiesOutput);
    miscCapabilities = {
        block_ed3: capabilities.block_ed3 || '0',
        gpu_clklck: capabilities.gpu_clklck || '0',
        gpu_unlock: capabilities.gpu_unlock || '0'
    };

    const { current, saved } = await window.loadTweakState('misc');
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0'
    };

    miscSavedState = { ...saved };

    const defMisc = window.getDefaultTweakPreset('misc');
    const defExynos = window.getDefaultTweakPreset('exynos');
    const defaultState = { ...defMisc, ...defExynos };

    miscPendingState = window.initPendingState(miscCurrentState, miscSavedState, defaultState);

    const { reference } = window.resolveTweakReference(miscCurrentState, miscSavedState, defaultState);
    miscReferenceState = {
        block_ed3: reference.block_ed3 || '0',
        gpu_clklck: reference.gpu_clklck || '0',
        gpu_unlock: reference.gpu_unlock || '0'
    };

    exynosStateInitialized = true;
    renderExynosCards();
}

async function loadMiscState() {
    await loadSharedExynosState();
}
window.loadMiscState = loadMiscState;

async function loadExynosState() {
    await loadSharedExynosState();
}
window.loadExynosState = loadExynosState;

async function saveStateSubset(keys) {
    for (const key of keys) {
        if (key === 'gpu_unlock') {
            const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');
            if (gpuUnlockSwitch && gpuUnlockSwitch.disabled) continue;
        }
        await runMiscBackend('save', key, miscPendingState[key]);
        miscSavedState[key] = miscPendingState[key];
        miscReferenceState[key] = miscPendingState[key];
    }

    renderExynosCards();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Saved');
}

async function applyStateSubset(keys) {
    for (const key of keys) {
        if (key === 'gpu_unlock') {
            const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');
            if (gpuUnlockSwitch && gpuUnlockSwitch.disabled) continue;
        }
        await runMiscBackend('apply', key, miscPendingState[key]);
    }

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

    renderExynosCards();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
}

async function saveMisc() {
    await saveStateSubset(getCardSupportedKeys('misc'));
}

async function applyMisc() {
    await applyStateSubset(getCardSupportedKeys('misc'));
}

async function saveExynos() {
    await saveStateSubset(getCardSupportedKeys('exynos'));
}

async function applyExynos() {
    await applyStateSubset(getCardSupportedKeys('exynos'));
}

async function clearGpuUnlockPersistence() {
    await runMiscBackend('clear_saved_key', 'gpu_unlock');
    delete miscSavedState.gpu_unlock;
    miscReferenceState.gpu_unlock = miscCurrentState.gpu_unlock;
    miscPendingState.gpu_unlock = miscCurrentState.gpu_unlock;
    renderExynosCards();
}
window.clearGpuUnlockPersistence = clearGpuUnlockPersistence;

function applySubsetState(config, keys) {
    keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(config || {}, key)) {
            miscPendingState[key] = config[key];
        }
    });
    renderExynosCards();
}

function bindExynosUiIfNeeded() {
    if (exynosUiBound) return;
    exynosUiBound = true;

    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) {
        blockEd3Switch.addEventListener('change', (e) => {
            miscPendingState.block_ed3 = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (gpuClkLckSwitch) {
        gpuClkLckSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_clklck = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (gpuUnlockSwitch) {
        gpuUnlockSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_unlock = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    window.bindSaveApplyButtons('misc', saveMisc, applyMisc);
    window.bindSaveApplyButtons('exynos', saveExynos, applyExynos);

    document.addEventListener('languageChanged', () => {
        renderExynosCards();
    });
}

function bindGpuUnlockVariantListenerIfNeeded() {
    if (exynosVariantListenerBound || window.KERNEL_NAME !== 'Floppy1280') return;
    exynosVariantListenerBound = true;

    let lastGpuUnlockCategory = ['1', '2', '3'].includes(String(window.currentSuperfloppyMode ?? '0')) ? 'oc' : 'other';

    document.addEventListener('superfloppyModeChanged', (e) => {
        const mode = String(e?.detail?.mode ?? window.currentSuperfloppyMode ?? '0');
        const newCategory = ['1', '2', '3'].includes(mode) ? 'oc' : 'other';

        if (lastGpuUnlockCategory !== null && lastGpuUnlockCategory !== newCategory) {
            if (window.clearGpuUnlockPersistence) {
                window.clearGpuUnlockPersistence();
            }
        }
        lastGpuUnlockCategory = newCategory;

        updateGpuUnlockAvailability();
    });
}

function registerExynosTweaks() {
    if (typeof window.registerTweak !== 'function') return;

    window.registerTweak('misc', {
        getState: () => ({ block_ed3: miscPendingState.block_ed3 }),
        setState: (config) => applySubsetState(config, MISC_KEYS),
        render: renderExynosCards,
        save: saveMisc,
        apply: applyMisc
    });

    window.registerTweak('exynos', {
        getState: () => {
            const state = {};
            EXYNOS_KEYS.forEach((key) => {
                state[key] = miscPendingState[key];
            });
            return state;
        },
        setState: (config) => applySubsetState(config, EXYNOS_KEYS),
        render: renderExynosCards,
        save: saveExynos,
        apply: applyExynos
    });
}

function initSharedExynosTweakUI() {
    const isSupportedKernel = window.KERNEL_NAME === 'Floppy1280' || window.KERNEL_NAME === 'Floppy2100';
    if (!isSupportedKernel) {
        setCardVisibility('misc', false);
        setCardVisibility('exynos', false);
        return;
    }

    bindExynosUiIfNeeded();
    bindGpuUnlockVariantListenerIfNeeded();

    if (!exynosStateInitialized) {
        loadSharedExynosState();
        return;
    }

    renderExynosCards();
}

function initMiscTweak() {
    registerExynosTweaks();
    initSharedExynosTweakUI();
}

function initExynosTweak() {
    registerExynosTweaks();
    initSharedExynosTweakUI();
}

window.initExynosTweak = initExynosTweak;
