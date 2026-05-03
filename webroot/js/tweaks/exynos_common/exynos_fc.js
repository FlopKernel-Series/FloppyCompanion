const EXYNOS_FC_KEYS = ['cpucl0', 'cpucl1', 'cpucl2'];
const EXYNOS_FC_BASE_STATE = { cpucl0: '0', cpucl1: '0', cpucl2: '0' };

let exynosFcClusters = [];
let exynosFcCurrentState = { ...EXYNOS_FC_BASE_STATE };
let exynosFcSavedState = {};
let exynosFcPendingState = { ...EXYNOS_FC_BASE_STATE };
let exynosFcReferenceState = { ...EXYNOS_FC_BASE_STATE };
let exynosFcDefaultState = { ...EXYNOS_FC_BASE_STATE };
let exynosFcAvailable = false;

const runExynosFcBackend = (...args) => window.runTweakBackend('exynos_fc', ...args);

function normalizeExynosFcValue(value) {
    const parsed = parseInt(String(value ?? '0'), 10);
    return String(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
}

function normalizeExynosFcState(state = {}) {
    const normalized = {};
    EXYNOS_FC_KEYS.forEach((key) => {
        normalized[key] = normalizeExynosFcValue(state[key]);
    });
    return normalized;
}

function parseExynosFcOutput(output) {
    const clusters = [];
    String(output || '').split('---').forEach((chunk) => {
        const data = parseKeyValue(chunk);
        const key = data.cluster;
        if (!EXYNOS_FC_KEYS.includes(key)) return;

        const freqs = String(data.available || '')
            .split(',')
            .map(normalizeExynosFcValue)
            .filter((freq) => freq !== '0');
        const current = normalizeExynosFcValue(data.current);
        const available = Array.from(new Set(['0', ...freqs, current]))
            .filter((freq) => freq === '0' || parseInt(freq, 10) > 0)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        clusters.push({ key, current, available });
    });

    return clusters.sort((a, b) => EXYNOS_FC_KEYS.indexOf(a.key) - EXYNOS_FC_KEYS.indexOf(b.key));
}

function getSupportedExynosFcKeys() {
    return exynosFcClusters.map((cluster) => cluster.key);
}

function getExynosFcFrequencyText(value) {
    const freq = parseInt(normalizeExynosFcValue(value), 10);
    if (!freq) {
        return window.t ? window.t('tweaks.exynosFc.disabled') : 'Disabled';
    }
    return `${Math.round(freq / 1000)} MHz`;
}

function buildExynosFcEffectiveState(source = exynosFcPendingState) {
    const state = {};
    getSupportedExynosFcKeys().forEach((key) => {
        state[key] = normalizeExynosFcValue(
            source[key]
            ?? window.getTweakDefaultValue(key, exynosFcCurrentState, exynosFcDefaultState, '0')
        );
    });
    return state;
}

function ensureExynosFcOption(select, value) {
    if (!select || !value || Array.from(select.options).some((option) => option.value === value)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = getExynosFcFrequencyText(value);
    select.appendChild(option);
}

function renderExynosFcCard() {
    const supportedKeys = getSupportedExynosFcKeys();
    const card = document.getElementById('exynos-fc-card');
    if (card) card.classList.toggle('hidden', !exynosFcAvailable || supportedKeys.length === 0);

    EXYNOS_FC_KEYS.forEach((key) => {
        const row = document.getElementById(`exynos-fc-row-${key}`);
        const cluster = exynosFcClusters.find((item) => item.key === key);
        if (row) row.classList.toggle('hidden', !cluster);
        if (!cluster) return;

        const currentEl = document.getElementById(`exynos-fc-val-${key}`);
        const select = document.getElementById(`exynos-fc-select-${key}`);
        const pendingValue = window.getTweakPendingValue(
            key,
            exynosFcPendingState,
            exynosFcReferenceState,
            exynosFcDefaultState,
            exynosFcCurrentState,
            '0'
        );

        if (currentEl) currentEl.textContent = getExynosFcFrequencyText(exynosFcCurrentState[key]);
        if (!select) return;

        select.innerHTML = '';
        cluster.available.forEach((freq) => {
            const option = document.createElement('option');
            option.value = freq;
            option.textContent = getExynosFcFrequencyText(freq);
            select.appendChild(option);
        });
        ensureExynosFcOption(select, pendingValue);
        select.value = pendingValue;
    });

    updateExynosFcPendingIndicator();
}

function updateExynosFcPendingIndicator() {
    const hasChanges = getSupportedExynosFcKeys().some((key) => {
        const pendingValue = window.getTweakPendingValue(
            key,
            exynosFcPendingState,
            exynosFcReferenceState,
            exynosFcDefaultState,
            exynosFcCurrentState,
            '0'
        );
        const referenceValue = window.getTweakReferenceValue(
            key,
            exynosFcReferenceState,
            exynosFcDefaultState,
            exynosFcCurrentState,
            '0'
        );
        return pendingValue !== referenceValue;
    });

    window.setPendingIndicator('exynos-fc-pending-indicator', hasChanges);
}

async function loadExynosFcState() {
    if (window.KERNEL_NAME !== 'Floppy2100') {
        exynosFcAvailable = false;
        renderExynosFcCard();
        return;
    }

    const [availabilityOutput, allOutput, savedOutput] = await Promise.all([
        runExynosFcBackend('is_available'),
        runExynosFcBackend('get_all'),
        runExynosFcBackend('get_saved')
    ]);
    exynosFcAvailable = parseKeyValue(availabilityOutput).available === '1';
    exynosFcClusters = parseExynosFcOutput(allOutput);

    const currentState = {};
    exynosFcClusters.forEach((cluster) => {
        currentState[cluster.key] = cluster.current;
    });
    exynosFcCurrentState = normalizeExynosFcState({ ...EXYNOS_FC_BASE_STATE, ...currentState });
    exynosFcDefaultState = normalizeExynosFcState(window.getDefaultTweakPreset('exynos_fc') || {});
    exynosFcSavedState = window.buildSparseStateAgainstDefaults(
        normalizeExynosFcState(parseKeyValue(savedOutput)),
        exynosFcDefaultState
    );

    const effectiveReferenceState = window.initPendingState(
        exynosFcCurrentState,
        exynosFcSavedState,
        exynosFcDefaultState
    );
    exynosFcPendingState = normalizeExynosFcState(effectiveReferenceState);
    exynosFcReferenceState = normalizeExynosFcState(effectiveReferenceState);

    renderExynosFcCard();
}
window.loadExynosFcState = loadExynosFcState;

async function saveExynosFc() {
    const effectiveState = buildExynosFcEffectiveState();
    const sparseState = window.buildSparseStateAgainstDefaults(effectiveState, exynosFcDefaultState);
    await runExynosFcBackend('save', ...Object.entries(sparseState).map(([key, value]) => `${key}=${value}`));
    exynosFcSavedState = { ...sparseState };
    exynosFcReferenceState = normalizeExynosFcState(
        window.initPendingState(exynosFcCurrentState, exynosFcSavedState, exynosFcDefaultState)
    );
    exynosFcPendingState = { ...exynosFcReferenceState };
    renderExynosFcCard();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyExynosFc() {
    const effectiveState = buildExynosFcEffectiveState();
    await runExynosFcBackend('apply', ...Object.entries(effectiveState).map(([key, value]) => `${key}=${value}`));

    const allOutput = await runExynosFcBackend('get_all');
    exynosFcClusters = parseExynosFcOutput(allOutput);
    const currentState = {};
    exynosFcClusters.forEach((cluster) => {
        currentState[cluster.key] = cluster.current;
    });
    exynosFcCurrentState = normalizeExynosFcState({ ...EXYNOS_FC_BASE_STATE, ...currentState });

    renderExynosFcCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

function initExynosFcTweak() {
    if (window.KERNEL_NAME !== 'Floppy2100') {
        exynosFcAvailable = false;
        renderExynosFcCard();
        return;
    }

    if (typeof window.registerTweak === 'function') {
        window.registerTweak('exynos_fc', {
            getState: () => buildExynosFcEffectiveState(),
            setState: (config) => {
                exynosFcPendingState = normalizeExynosFcState({ ...exynosFcPendingState, ...(config || {}) });
                renderExynosFcCard();
            },
            render: renderExynosFcCard,
            save: saveExynosFc,
            apply: applyExynosFc
        });
    }

    EXYNOS_FC_KEYS.forEach((key) => {
        const select = document.getElementById(`exynos-fc-select-${key}`);
        if (!select) return;
        if (window.preventSwipePropagation) window.preventSwipePropagation(select);
        select.addEventListener('change', (e) => {
            exynosFcPendingState[key] = normalizeExynosFcValue(e.target.value);
            renderExynosFcCard();
        });
    });

    window.bindSaveApplyButtons('exynos-fc', saveExynosFc, applyExynosFc);

    document.addEventListener('languageChanged', () => {
        renderExynosFcCard();
    });

    loadExynosFcState();
}
