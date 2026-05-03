// Shared Exynos tweaks state

let miscCurrentState = { block_ed3: '0', htpr: '0', esg_short_burst: '0', gpu_clklck: '0', gpu_unlock: '0', throttlers_protection: '0' };
let miscSavedState = { block_ed3: '0', htpr: '0', esg_short_burst: '0', gpu_clklck: '0', gpu_unlock: '0', throttlers_protection: '0' };
let miscPendingState = { block_ed3: '0', htpr: '0', esg_short_burst: '0', gpu_clklck: '0', gpu_unlock: '0', throttlers_protection: '0' };
let miscReferenceState = { block_ed3: '0', htpr: '0', esg_short_burst: '0', gpu_clklck: '0', gpu_unlock: '0', throttlers_protection: '0' };
let miscCapabilities = { block_ed3: '0', htpr: '0', esg_short_burst: '0', gpu_clklck: '0', gpu_unlock: '0', throttlers_protection: '0' };
let exynosFeatureState = { init_protection: '1' };
let exynosStateInitialized = false;
let exynosUiBound = false;
let exynosVariantListenerBound = false;

const runMiscBackend = (...args) => window.runTweakBackend('misc', ...args);
const EXYNOS_STATE_KEYS = ['block_ed3', 'htpr', 'esg_short_burst', 'gpu_clklck', 'gpu_unlock', 'throttlers_protection'];
const MISC_KEYS = ['block_ed3'];
const EXYNOS_KEYS = ['htpr', 'esg_short_burst', 'gpu_clklck', 'throttlers_protection', 'gpu_unlock'];

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

function isMiscToggleDisabled(key) {
    if (key !== 'gpu_unlock' && key !== 'throttlers_protection') return false;

    const switchId = key === 'gpu_unlock' ? 'misc-gpuunlock-switch' : 'misc-throttlersprotection-switch';
    const toggleSwitch = document.getElementById(switchId);
    return !!(toggleSwitch && toggleSwitch.disabled);
}

function getThrottlersProtectionRecommendation(action) {
    if (window.KERNEL_NAME !== 'Floppy2100') return null;
    if (!isMiscKeySupported('throttlers_protection') || isMiscToggleDisabled('throttlers_protection')) return null;

    const pendingValue = String(miscPendingState.throttlers_protection || '0');
    const currentValue = String(miscCurrentState.throttlers_protection || '0');
    const referenceValue = String(miscReferenceState.throttlers_protection || '0');

    let changed = false;
    if (action === 'save') {
        changed = pendingValue !== referenceValue;
    } else if (action === 'apply') {
        changed = pendingValue !== currentValue;
    } else if (action === 'save_apply') {
        changed = pendingValue !== referenceValue || pendingValue !== currentValue;
    }

    if (!changed) return null;
    return pendingValue === '1' ? 'enable' : 'disable';
}

function getRecommendationConfirmText(action) {
    if (action === 'save') {
        return translateTextOrFallback('tweaks.save', 'Save');
    }

    if (action === 'apply') {
        return translateTextOrFallback('tweaks.apply', 'Apply');
    }

    return translateTextOrFallback('tweaks.saveApply', 'Save & Apply');
}

async function maybeRecommendThermalControlOffsets(recommendation, action) {
    if (!recommendation) return;
    if (typeof window.isThermalControlRecommendationAvailable !== 'function') return;
    if (typeof window.applyThermalControlRecommendation !== 'function') return;

    const available = await window.isThermalControlRecommendationAvailable();
    if (!available) return;

    const enabling = recommendation === 'enable';
    const confirmed = await showConfirmModal({
        title: enabling
            ? translateTextOrFallback('modal.throttlersProtectionOffsetsEnableTitle', 'Set recommended thermal offsets?')
            : translateTextOrFallback('modal.throttlersProtectionOffsetsDisableTitle', 'Reset thermal offsets to 0°C?'),
        body: enabling
            ? translateTextOrFallback(
                'modal.throttlersProtectionOffsetsEnableBody',
                '<p>Throttling Protection was enabled. Recommended offsets help avoid overheating because the ROM can no longer throttle the SoC.</p><p>This will set Big and Prime to <strong>-10°C</strong>, Little to <strong>-8°C</strong>, and G3D to <strong>-13°C</strong>.</p>'
            )
            : translateTextOrFallback(
                'modal.throttlersProtectionOffsetsDisableBody',
                '<p>Throttling Protection was disabled. Resetting all thermal offsets to <strong>0°C</strong> is recommended because the ROM will manage throttling again.</p>'
            ),
        iconClass: enabling ? 'warning' : 'info',
        confirmText: getRecommendationConfirmText(action),
        cancelText: translateTextOrFallback('modal.cancel', 'Cancel')
    });

    if (!confirmed) return;
    await window.applyThermalControlRecommendation({ direction: recommendation, action });
}

function getSupportedExynosKeys() {
    const keys = [];
    if (miscCapabilities.htpr === '1') {
        keys.push('htpr');
    }
    if (miscCapabilities.esg_short_burst === '1' && window.KERNEL_NAME === 'Floppy2100') {
        keys.push('esg_short_burst');
    }
    if (miscCapabilities.gpu_clklck === '1' && window.KERNEL_NAME !== 'Floppy2100') {
        keys.push('gpu_clklck');
    }
    if (miscCapabilities.throttlers_protection === '1') {
        keys.push('throttlers_protection');
    }
    if (miscCapabilities.gpu_unlock === '1') {
        keys.push('gpu_unlock');
    }
    return keys;
}

function isMiscKeySupported(key) {
    if (key === 'block_ed3') return miscCapabilities.block_ed3 === '1';
    if (key === 'htpr') return getSupportedExynosKeys().includes('htpr');
    if (key === 'esg_short_burst') return getSupportedExynosKeys().includes('esg_short_burst');
    if (key === 'gpu_clklck') return getSupportedExynosKeys().includes('gpu_clklck');
    if (key === 'throttlers_protection') return getSupportedExynosKeys().includes('throttlers_protection');
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
        { id: 'misc-row-htpr', visible: isMiscKeySupported('htpr') },
        { id: 'misc-row-esgshortburst', visible: isMiscKeySupported('esg_short_burst') },
        { id: 'misc-row-gpuclklck', visible: isMiscKeySupported('gpu_clklck') },
        { id: 'misc-row-throttlersprotection', visible: isMiscKeySupported('throttlers_protection') },
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
            : [
                document.getElementById('misc-row-htpr'),
                document.getElementById('misc-row-esgshortburst'),
                document.getElementById('misc-row-gpuclklck'),
                document.getElementById('misc-row-throttlersprotection'),
                document.getElementById('misc-row-gpuunlock')
            ];
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

    const is2100 = window.KERNEL_NAME === 'Floppy2100';
    const key = is2100 ? 'tweaks.tooltip.gpuUnlock2100' : 'tweaks.tooltip.gpuUnlock';
    gpuUnlockBubble.setAttribute('data-i18n', key);
    gpuUnlockBubble.textContent = translateTextOrFallback(
        key,
        is2100
            ? 'Enables GPU overclocking immediately. On Floppy2100, this overclocks the GPU to 949 MHz and can be toggled at any time with immediate effect.'
            : 'Enables GPU overclocking immediately.'
    );
}

function renderSharedValues() {
    const valBlocked3 = document.getElementById('misc-val-blocked3');
    const valHtpr = document.getElementById('misc-val-htpr');
    const valEsgShortBurst = document.getElementById('misc-val-esgshortburst');
    const valGpuClkLck = document.getElementById('misc-val-gpuclklck');
    const valThrottlersProtection = document.getElementById('misc-val-throttlersprotection');
    const valGpuUnlock = document.getElementById('misc-val-gpuunlock');

    if (valBlocked3) valBlocked3.textContent = getEnabledDisabledText(miscCurrentState.block_ed3);
    if (valHtpr) valHtpr.textContent = getEnabledDisabledText(miscCurrentState.htpr);
    if (valEsgShortBurst) valEsgShortBurst.textContent = getEnabledDisabledText(miscCurrentState.esg_short_burst);
    if (valGpuClkLck) valGpuClkLck.textContent = getEnabledDisabledText(miscCurrentState.gpu_clklck);
    if (valThrottlersProtection) valThrottlersProtection.textContent = getEnabledDisabledText(miscCurrentState.throttlers_protection);
    if (valGpuUnlock) valGpuUnlock.textContent = getEnabledDisabledText(miscCurrentState.gpu_unlock);

    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const htprSwitch = document.getElementById('misc-htpr-switch');
    const esgShortBurstSwitch = document.getElementById('misc-esgshortburst-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const throttlersProtectionSwitch = document.getElementById('misc-throttlersprotection-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) blockEd3Switch.checked = miscPendingState.block_ed3 === '1';
    if (htprSwitch) htprSwitch.checked = miscPendingState.htpr === '1';
    if (esgShortBurstSwitch) esgShortBurstSwitch.checked = miscPendingState.esg_short_burst === '1';
    if (gpuClkLckSwitch) gpuClkLckSwitch.checked = miscPendingState.gpu_clklck === '1';
    if (throttlersProtectionSwitch) throttlersProtectionSwitch.checked = miscPendingState.throttlers_protection === '1';
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

function updateThrottlersProtectionAvailability() {
    const throttlersProtectionSwitch = document.getElementById('misc-throttlersprotection-switch');
    if (!throttlersProtectionSwitch) return;

    const switchContainer = throttlersProtectionSwitch.closest('.tweak-switch-container');
    if (!isMiscKeySupported('throttlers_protection')) {
        throttlersProtectionSwitch.disabled = true;
        if (switchContainer) switchContainer.style.opacity = '0.5';
        return;
    }

    const isBlockedByInitProtection = window.KERNEL_NAME === 'Floppy2100'
        && String(exynosFeatureState.init_protection || '1') !== '1';

    throttlersProtectionSwitch.disabled = isBlockedByInitProtection;
    if (switchContainer) switchContainer.style.opacity = isBlockedByInitProtection ? '0.5' : '1';
}

function renderExynosCards() {
    updateCardTitles();
    updateGpuUnlockCopy();
    updateRowVisibility();
    setCardVisibility('misc', getCardSupportedKeys('misc').length > 0);
    setCardVisibility('exynos', getCardSupportedKeys('exynos').length > 0);
    renderSharedValues();
    updatePendingIndicators();
    updateThrottlersProtectionAvailability();
    updateGpuUnlockAvailability();
}

async function loadExynosFeatureState() {
    if (window.KERNEL_NAME !== 'Floppy2100') {
        exynosFeatureState = { init_protection: '1' };
        return;
    }

    try {
        const output = await exec('/data/adb/modules/floppy_companion/tools/fkfeat/fkfeatctl get init_protection 2>/dev/null');
        const match = String(output || '').match(/init_protection=(\d+)/);
        exynosFeatureState = { init_protection: match ? match[1] : '1' };
    } catch (e) {
        exynosFeatureState = { init_protection: '1' };
    }
}

async function loadSharedExynosState() {
    const capabilitiesOutput = await runMiscBackend('get_capabilities');
    const capabilities = parseKeyValue(capabilitiesOutput);
    miscCapabilities = {
        block_ed3: capabilities.block_ed3 || '0',
        htpr: capabilities.htpr || '0',
        esg_short_burst: capabilities.esg_short_burst || '0',
        gpu_clklck: capabilities.gpu_clklck || '0',
        gpu_unlock: capabilities.gpu_unlock || '0',
        throttlers_protection: capabilities.throttlers_protection || '0'
    };

    await loadExynosFeatureState();

    const { current, saved } = await window.loadTweakState('misc');
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        htpr: current.htpr || '0',
        esg_short_burst: current.esg_short_burst || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0',
        throttlers_protection: current.throttlers_protection || '0'
    };

    miscSavedState = { ...saved };

    const defMisc = window.getDefaultTweakPreset('misc');
    const defExynos = window.getDefaultTweakPreset('exynos');
    const defaultState = { ...defMisc, ...defExynos };
    miscSavedState = window.buildSparseStateAgainstDefaults(saved, defaultState);

    const effectiveReferenceState = window.initPendingState(miscCurrentState, miscSavedState, defaultState);
    miscPendingState = { ...effectiveReferenceState };
    miscReferenceState = {
        block_ed3: effectiveReferenceState.block_ed3 || '0',
        htpr: effectiveReferenceState.htpr || '0',
        esg_short_burst: effectiveReferenceState.esg_short_burst || '0',
        gpu_clklck: effectiveReferenceState.gpu_clklck || '0',
        gpu_unlock: effectiveReferenceState.gpu_unlock || '0',
        throttlers_protection: effectiveReferenceState.throttlers_protection || '0'
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
        if (isMiscToggleDisabled(key)) continue;
        await runMiscBackend('save', key, miscPendingState[key]);
        miscSavedState[key] = miscPendingState[key];
        miscReferenceState[key] = miscPendingState[key];
    }

    renderExynosCards();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Saved');
    return true;
}

async function applyStateSubset(keys) {
    for (const key of keys) {
        if (isMiscToggleDisabled(key)) continue;
        await runMiscBackend('apply', key, miscPendingState[key]);
    }

    const currentOutput = await runMiscBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return false;
    }

    const current = parseKeyValue(currentOutput);
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        htpr: current.htpr || '0',
        esg_short_burst: current.esg_short_burst || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0',
        throttlers_protection: current.throttlers_protection || '0'
    };

    renderExynosCards();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
    return true;
}

async function saveMisc() {
    await saveStateSubset(getCardSupportedKeys('misc'));
}

async function applyMisc() {
    await applyStateSubset(getCardSupportedKeys('misc'));
}

async function saveExynos(options = {}) {
    const { promptRecommendation = false } = options;
    const recommendation = promptRecommendation ? getThrottlersProtectionRecommendation('save') : null;
    const saved = await saveStateSubset(getCardSupportedKeys('exynos'));
    if (promptRecommendation && saved) {
        await maybeRecommendThermalControlOffsets(recommendation, 'save');
    }
    return saved;
}

async function applyExynos(options = {}) {
    const { promptRecommendation = false } = options;
    const recommendation = promptRecommendation ? getThrottlersProtectionRecommendation('apply') : null;
    const applied = await applyStateSubset(getCardSupportedKeys('exynos'));
    if (promptRecommendation && applied) {
        await maybeRecommendThermalControlOffsets(recommendation, 'apply');
    }
    return applied;
}

async function saveApplyExynos(options = {}) {
    const { promptRecommendation = false } = options;
    const recommendation = promptRecommendation ? getThrottlersProtectionRecommendation('save_apply') : null;
    const keys = getCardSupportedKeys('exynos');
    const saved = await saveStateSubset(keys);
    const applied = await applyStateSubset(keys);
    if (promptRecommendation && saved && applied) {
        await maybeRecommendThermalControlOffsets(recommendation, 'save_apply');
    }
    return saved && applied;
}

function bindButtonIfPresent(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (button) button.addEventListener('click', handler);
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
    const htprSwitch = document.getElementById('misc-htpr-switch');
    const esgShortBurstSwitch = document.getElementById('misc-esgshortburst-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const throttlersProtectionSwitch = document.getElementById('misc-throttlersprotection-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) {
        blockEd3Switch.addEventListener('change', (e) => {
            miscPendingState.block_ed3 = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (esgShortBurstSwitch) {
        esgShortBurstSwitch.addEventListener('change', (e) => {
            miscPendingState.esg_short_burst = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (htprSwitch) {
        htprSwitch.addEventListener('change', (e) => {
            miscPendingState.htpr = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (gpuClkLckSwitch) {
        gpuClkLckSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_clklck = e.target.checked ? '1' : '0';
            updatePendingIndicators();
        });
    }

    if (throttlersProtectionSwitch) {
        throttlersProtectionSwitch.addEventListener('change', (e) => {
            miscPendingState.throttlers_protection = e.target.checked ? '1' : '0';
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
    bindButtonIfPresent('exynos-btn-save', () => saveExynos({ promptRecommendation: true }));
    bindButtonIfPresent('exynos-btn-apply', () => applyExynos({ promptRecommendation: true }));
    bindButtonIfPresent('exynos-btn-save-apply', () => saveApplyExynos({ promptRecommendation: true }));

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

    loadExynosFeatureState().then(renderExynosCards);
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
