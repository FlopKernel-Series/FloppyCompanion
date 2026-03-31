// LMKD Tweak

let lmkdCurrentState = {};
let lmkdSavedState = {};
let lmkdPendingState = {};
let lmkdReferenceState = {};
let lmkdDefaultState = {};
let lmkdSupportState = { legacy_minfree_supported: '1', psi_disable_supported: '1' };

const LMKD_BOOLEAN_KEYS = [
    'use_psi',
    'use_minfree_levels',
    'critical_upgrade',
    'kill_heaviest_task'
];

const LMKD_NUMERIC_KEYS = [
    'low',
    'medium',
    'critical',
    'upgrade_pressure',
    'downgrade_pressure',
    'kill_timeout_ms',
    'psi_partial_stall_ms',
    'psi_complete_stall_ms',
    'thrashing_limit',
    'thrashing_limit_decay',
    'swap_util_max',
    'swap_free_low_percentage'
];

const LMKD_ALL_KEYS = [...LMKD_BOOLEAN_KEYS, ...LMKD_NUMERIC_KEYS];

const runLmkdBackend = (...args) => window.runTweakBackend('lmkd', ...args);

function getLmkdEnabledDisabledText(value) {
    if (value === '1') {
        return window.t ? window.t('tweaks.lmkd.enabled') : 'Enabled';
    }
    return window.t ? window.t('tweaks.lmkd.disabled') : 'Disabled';
}

function getLmkdFallbackValue(key) {
    if (LMKD_BOOLEAN_KEYS.includes(key)) {
        return key === 'use_psi' ? '1' : '0';
    }

    switch (key) {
        case 'low': return '1001';
        case 'medium': return '800';
        case 'critical': return '0';
        case 'upgrade_pressure': return '100';
        case 'downgrade_pressure': return '100';
        case 'kill_timeout_ms': return '0';
        case 'psi_partial_stall_ms': return '70';
        case 'psi_complete_stall_ms': return '700';
        case 'thrashing_limit': return '100';
        case 'thrashing_limit_decay': return '10';
        case 'swap_util_max': return '100';
        case 'swap_free_low_percentage': return '20';
        default: return '0';
    }
}

function getLmkdResolvedValue(key) {
    return String(
        lmkdPendingState[key]
        ?? lmkdReferenceState[key]
        ?? lmkdDefaultState[key]
        ?? lmkdCurrentState[key]
        ?? getLmkdFallbackValue(key)
    );
}

function getLmkdDefaultValue(key) {
    return String(lmkdDefaultState[key] ?? getLmkdFallbackValue(key));
}

function buildLmkdEffectiveState(overrides = {}) {
    const state = {};

    LMKD_ALL_KEYS.forEach((key) => {
        state[key] = String(
            overrides[key]
            ?? lmkdDefaultState[key]
            ?? getLmkdFallbackValue(key)
        );
    });

    return state;
}

function buildLmkdSparseState(source) {
    const sparse = {};

    LMKD_ALL_KEYS.forEach((key) => {
        const value = String(source[key] ?? getLmkdDefaultValue(key));
        if (value !== getLmkdDefaultValue(key)) {
            sparse[key] = value;
        }
    });

    return sparse;
}

function buildLmkdOverrideArgs(source) {
    const sparseState = buildLmkdSparseState(source);

    return LMKD_ALL_KEYS
        .filter((key) => Object.prototype.hasOwnProperty.call(sparseState, key))
        .map((key) => `${key}=${sparseState[key]}`);
}

function isLmkdLegacyMinfreeSupported() {
    return String(lmkdSupportState.legacy_minfree_supported || '1') === '1';
}

function isLmkdPsiDisableSupported() {
    return String(lmkdSupportState.psi_disable_supported || '1') === '1';
}

function getLmkdConstraintMessage(key) {
    if (key === 'use_minfree_levels') {
        return window.t ? window.t('tweaks.lmkd.requiresLegacyMinfree') : 'Requires legacy memcg (cgroup v1)';
    }
    if (key === 'use_psi') {
        return window.t ? window.t('tweaks.lmkd.requiresVmpressureFallback') : 'Disabling requires vmpressure fallback (cgroup v1)';
    }
    return window.t ? window.t('tweaks.lmkd.requiresLegacyMinfree') : 'Requires legacy memcg (cgroup v1)';
}

async function loadLmkdState() {
    try {
        const [{ current, saved }, supportOutput] = await Promise.all([
            window.loadTweakState('lmkd'),
            runLmkdBackend('get_support')
        ]);

        lmkdCurrentState = current;
        lmkdSupportState = { ...parseKeyValue(supportOutput) };
        lmkdDefaultState = buildLmkdEffectiveState(window.getDefaultTweakPreset('lmkd'));
        lmkdSavedState = buildLmkdSparseState(saved);
        lmkdReferenceState = buildLmkdEffectiveState(lmkdSavedState);
        lmkdPendingState = { ...lmkdReferenceState };

        LMKD_ALL_KEYS.forEach((key) => {
            if (lmkdPendingState[key] === undefined) {
                lmkdPendingState[key] = getLmkdResolvedValue(key);
            }
            if (lmkdReferenceState[key] === undefined) {
                lmkdReferenceState[key] = getLmkdDefaultValue(key);
            }
        });

        renderLmkdCard();
    } catch (e) {
        console.error('Failed to load LMKD state:', e);
    }
}
window.loadLmkdState = loadLmkdState;

function renderLmkdBoolean(key) {
    const toggle = document.getElementById(`lmkd-toggle-${key}`);
    const label = document.getElementById(`lmkd-val-${key}`);
    const switchContainer = toggle?.closest('.tweak-switch-container');
    const unsupportedLegacyMinfree = key === 'use_minfree_levels' && !isLmkdLegacyMinfreeSupported();
    const unsupportedPsiDisable = key === 'use_psi' && !isLmkdPsiDisableSupported();
    const currentValue = String(lmkdCurrentState[key] ?? getLmkdFallbackValue(key));
    const pendingValue = getLmkdResolvedValue(key);
    const lockToggle =
        (unsupportedLegacyMinfree && pendingValue !== '1') ||
        (unsupportedPsiDisable && pendingValue !== '0');

    if (toggle) {
        toggle.disabled = lockToggle;
        toggle.checked = pendingValue === '1';
    }
    if (switchContainer) {
        switchContainer.style.opacity = lockToggle ? '0.5' : '1';
    }
    if (label) {
        if (unsupportedLegacyMinfree && pendingValue !== '1') {
            label.textContent = getLmkdConstraintMessage('use_minfree_levels');
        } else if (unsupportedPsiDisable && pendingValue !== '0') {
            label.textContent = getLmkdConstraintMessage('use_psi');
        } else {
            label.textContent = getLmkdEnabledDisabledText(currentValue);
        }
    }
}

function renderLmkdNumber(key) {
    const input = document.getElementById(`lmkd-${key}`);
    const label = document.getElementById(`lmkd-val-${key}`);
    const currentVal = lmkdCurrentState[key] ?? getLmkdDefaultValue(key);

    if (input) {
        const { placeholder, value } = window.getTweakTextInputState(
            key,
            lmkdPendingState,
            lmkdSavedState,
            lmkdReferenceState,
            lmkdDefaultState,
            lmkdCurrentState,
            getLmkdFallbackValue(key)
        );
        input.placeholder = placeholder;
        input.value = value;
    }

    if (label) {
        label.textContent = currentVal || '--';
    }
}

function updateLmkdPendingIndicator() {
    const hasPending = LMKD_ALL_KEYS.some((key) => {
        const referenceVal = String(
            lmkdReferenceState[key]
            ?? getLmkdDefaultValue(key)
        );
        return getLmkdResolvedValue(key) !== referenceVal;
    });

    window.setPendingIndicator('lmkd-pending-indicator', hasPending);
}

function renderLmkdCard() {
    LMKD_BOOLEAN_KEYS.forEach(renderLmkdBoolean);
    LMKD_NUMERIC_KEYS.forEach(renderLmkdNumber);
    updateLmkdPendingIndicator();
}

function setLmkdBoolean(key, enabled) {
    if (key === 'use_minfree_levels' && enabled && !isLmkdLegacyMinfreeSupported()) {
        showToast(getLmkdConstraintMessage('use_minfree_levels'), true);
        renderLmkdCard();
        return;
    }
    if (key === 'use_psi' && !enabled && !isLmkdPsiDisableSupported()) {
        showToast(getLmkdConstraintMessage('use_psi'), true);
        renderLmkdCard();
        return;
    }

    lmkdPendingState[key] = enabled ? '1' : '0';
    updateLmkdPendingIndicator();
}

function setLmkdNumber(key, value) {
    if (value === '' || value === undefined) {
        lmkdPendingState[key] = window.getTweakDefaultValue(
            key,
            lmkdCurrentState,
            lmkdDefaultState,
            getLmkdFallbackValue(key)
        );
    } else {
        lmkdPendingState[key] = String(value);
    }

    updateLmkdPendingIndicator();
}

function buildLmkdArgs() {
    return LMKD_ALL_KEYS.map((key) => `${key}=${getLmkdResolvedValue(key)}`);
}

async function saveLmkd() {
    const sparseState = buildLmkdSparseState(lmkdPendingState);
    const args = buildLmkdOverrideArgs(lmkdPendingState);
    const result = await runLmkdBackend('save', ...args);

    if (result && result.includes('Saved')) {
        lmkdSavedState = { ...sparseState };
        lmkdReferenceState = buildLmkdEffectiveState(lmkdSavedState);
        lmkdPendingState = { ...lmkdReferenceState };
        showToast('LMKD settings saved');
        renderLmkdCard();
    } else {
        showToast('Failed to save LMKD settings', true);
    }
}

async function applyLmkd() {
    if (getLmkdResolvedValue('use_minfree_levels') === '1' && !isLmkdLegacyMinfreeSupported()) {
        showToast(getLmkdConstraintMessage('use_minfree_levels'), true);
        renderLmkdCard();
        return;
    }
    if (getLmkdResolvedValue('use_psi') === '0' && !isLmkdPsiDisableSupported()) {
        showToast(getLmkdConstraintMessage('use_psi'), true);
        renderLmkdCard();
        return;
    }

    const result = await runLmkdBackend('apply', ...buildLmkdOverrideArgs(lmkdPendingState));

    if (result && result.includes('Applied')) {
        showToast('LMKD settings applied');
        const currentOutput = await runLmkdBackend('get_current');
        lmkdCurrentState = parseKeyValue(currentOutput);
        renderLmkdCard();
    } else {
        showToast('Failed to apply LMKD settings', true);
    }
}

function initLmkdTweak() {
    LMKD_BOOLEAN_KEYS.forEach((key) => {
        const toggle = document.getElementById(`lmkd-toggle-${key}`);
        if (toggle) {
            toggle.addEventListener('change', (e) => setLmkdBoolean(key, e.target.checked));
        }
    });

    LMKD_NUMERIC_KEYS.forEach((key) => {
        const input = document.getElementById(`lmkd-${key}`);
        if (input) {
            input.addEventListener('input', (e) => setLmkdNumber(key, e.target.value));
        }
    });

    window.bindSaveApplyButtons('lmkd', saveLmkd, applyLmkd);
    document.addEventListener('languageChanged', renderLmkdCard);
    loadLmkdState();

    if (typeof window.registerTweak === 'function') {
        window.registerTweak('lmkd', {
            getState: () => ({ ...lmkdPendingState }),
            setState: (config) => {
                lmkdPendingState = {
                    ...lmkdPendingState,
                    ...buildLmkdEffectiveState(config || {})
                };
                renderLmkdCard();
            },
            render: renderLmkdCard,
            save: saveLmkd,
            apply: applyLmkd
        });
    }
}
