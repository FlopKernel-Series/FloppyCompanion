// Xiaomi Parts Tweak (Flashlight & Vibration Control for FloppyTrinketMi)

let xpCurrentState = { torch_strength: '85', vibration_strength: '85' };
let xpSavedState = {};
let xpPendingState = { torch_strength: '85', vibration_strength: '85' };
let xpReferenceState = { torch_strength: '85', vibration_strength: '85' };
let xpDefaultState = { torch_strength: '85', vibration_strength: '85' };
let xpCapabilities = { torch: '1', vibration: '1' };
let xpAvailable = false;

const runXiaomiPartsBackend = (...args) => window.runTweakBackend('xiaomi_parts', ...args);

function clampXpPercent(val, min = 10, max = 100) {
    const parsed = parseInt(val, 10);
    if (Number.isNaN(parsed)) return 85;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeXiaomiPartsState(state = {}) {
    return {
        torch_strength: String(clampXpPercent(state.torch_strength ?? '85', 10, 100)),
        vibration_strength: String(clampXpPercent(state.vibration_strength ?? '85', 10, 100))
    };
}

function getNormalizedXiaomiPartsPendingState() {
    const normalized = { ...xpPendingState };

    const inputTorch = document.getElementById('xiaomi-parts-input-torch');
    if (inputTorch && String(inputTorch.value ?? '').trim() === '') {
        normalized.torch_strength = window.getTweakDefaultValue(
            'torch_strength',
            xpCurrentState,
            xpDefaultState,
            '85'
        );
    }

    const inputVib = document.getElementById('xiaomi-parts-input-vibration');
    if (inputVib && String(inputVib.value ?? '').trim() === '') {
        normalized.vibration_strength = window.getTweakDefaultValue(
            'vibration_strength',
            xpCurrentState,
            xpDefaultState,
            '85'
        );
    }

    return normalizeXiaomiPartsState(normalized);
}

function updateXiaomiPartsSliderTicks(slider) {
    if (!slider) return;
    const sliderShell = slider.closest('.tweak-beer-slider') || slider;
    const color = getComputedStyle(document.body).getPropertyValue('--md-sys-color-outline').trim() || '#747775';
    const ticks = 10;

    const lines = [];
    for (let i = 0; i < ticks; i++) {
        const pct = (i / (ticks - 1)) * 100;
        let transform = '';
        if (i === 0) transform = "transform='translate(0.5, 0)'";
        if (i === ticks - 1) transform = "transform='translate(-0.5, 0)'";
        lines.push(`<line x1='${pct}%' y1='0' x2='${pct}%' y2='100%' stroke='${color}' stroke-width='1' ${transform} />`);
    }

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>${lines.join('')}</svg>`;
    const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

    sliderShell.style.setProperty('--track-ticks', encoded);

    if (window.syncBeerRangeSlider) {
        window.syncBeerRangeSlider(slider);
    }
}

function updateXiaomiPartsPendingIndicator() {
    const normalized = getNormalizedXiaomiPartsPendingState();
    const hasChanges =
        normalized.torch_strength !== xpReferenceState.torch_strength ||
        normalized.vibration_strength !== xpReferenceState.vibration_strength;

    window.setPendingIndicator('xiaomi-parts-pending-indicator', hasChanges);
}

function renderXiaomiPartsCard() {
    const torchContainer = document.getElementById('xiaomi-parts-torch-container');
    if (torchContainer) {
        torchContainer.classList.toggle('hidden', xpCapabilities.torch === '0');
    }

    const vibContainer = document.getElementById('xiaomi-parts-vibration-container');
    if (vibContainer) {
        vibContainer.classList.toggle('hidden', xpCapabilities.vibration === '0');
    }

    const pendingTorch = window.getTweakPendingValue(
        'torch_strength',
        xpPendingState,
        xpReferenceState,
        xpDefaultState,
        xpCurrentState,
        '85'
    );
    const pendingVib = window.getTweakPendingValue(
        'vibration_strength',
        xpPendingState,
        xpReferenceState,
        xpDefaultState,
        xpCurrentState,
        '85'
    );

    // 1. Torch Controls
    const sliderTorch = document.getElementById('xiaomi-parts-slider-torch');
    const inputTorch = document.getElementById('xiaomi-parts-input-torch');
    const valTorch = document.getElementById('xiaomi-parts-val-torch');

    if (sliderTorch) {
        sliderTorch.value = pendingTorch;
        updateXiaomiPartsSliderTicks(sliderTorch);
    }
    if (inputTorch) {
        const { placeholder, value } = window.getTweakTextInputState(
            'torch_strength',
            xpPendingState,
            xpSavedState,
            xpReferenceState,
            xpDefaultState,
            xpCurrentState,
            '85'
        );
        inputTorch.placeholder = placeholder;
        inputTorch.value = value;
    }
    if (valTorch) {
        valTorch.textContent = (xpCurrentState.torch_strength || '85') + '%';
    }

    // 2. Vibration Controls
    const sliderVib = document.getElementById('xiaomi-parts-slider-vibration');
    const inputVib = document.getElementById('xiaomi-parts-input-vibration');
    const valVib = document.getElementById('xiaomi-parts-val-vibration');

    if (sliderVib) {
        sliderVib.value = pendingVib;
        updateXiaomiPartsSliderTicks(sliderVib);
    }
    if (inputVib) {
        const { placeholder, value } = window.getTweakTextInputState(
            'vibration_strength',
            xpPendingState,
            xpSavedState,
            xpReferenceState,
            xpDefaultState,
            xpCurrentState,
            '85'
        );
        inputVib.placeholder = placeholder;
        inputVib.value = value;
    }
    if (valVib) {
        valVib.textContent = (xpCurrentState.vibration_strength || '85') + '%';
    }

    // 3. Active summary values
    const curTorch = document.getElementById('xiaomi-parts-current-torch');
    if (curTorch) {
        curTorch.textContent = (xpCurrentState.torch_strength || '85') + '%';
    }
    const curVib = document.getElementById('xiaomi-parts-current-vibration');
    if (curVib) {
        curVib.textContent = (xpCurrentState.vibration_strength || '85') + '%';
    }

    updateXiaomiPartsPendingIndicator();
}

async function loadXiaomiPartsState() {
    try {
        const [availOutput, capOutput] = await Promise.all([
            runXiaomiPartsBackend('is_available'),
            runXiaomiPartsBackend('get_capabilities')
        ]);

        xpAvailable = (availOutput === 'available=1');
        xpCapabilities = { torch: '1', vibration: '1', ...parseKeyValue(capOutput) };

        const card = document.getElementById('xiaomi-parts-card');
        if (!xpAvailable) {
            if (card) card.classList.add('hidden');
            return;
        }

        if (card) card.classList.remove('hidden');

        const { current, saved } = await window.loadTweakState('xiaomi_parts');
        xpCurrentState = normalizeXiaomiPartsState(current);
        xpDefaultState = normalizeXiaomiPartsState(window.getDefaultTweakPreset('xiaomi_parts'));
        xpSavedState = window.buildSparseStateAgainstDefaults(saved, xpDefaultState);

        const effective = window.initPendingState(xpCurrentState, xpSavedState, xpDefaultState);
        xpPendingState = normalizeXiaomiPartsState(effective);
        xpReferenceState = { ...xpPendingState };

        renderXiaomiPartsCard();
    } catch (e) {
        console.error('Failed to load Xiaomi Parts state:', e);
    }
}
window.loadXiaomiPartsState = loadXiaomiPartsState;

async function saveXiaomiParts() {
    const normalized = getNormalizedXiaomiPartsPendingState();
    const sparseState = window.buildSparseStateAgainstDefaults(normalized, xpDefaultState);
    const args = Object.entries(sparseState).map(([k, v]) => `${k}=${v}`);

    const result = await runXiaomiPartsBackend('save', ...args);
    if (result && result.includes('saved')) {
        xpSavedState = { ...sparseState };
        xpReferenceState = { ...normalized };
        xpPendingState = { ...normalized };
        renderXiaomiPartsCard();
        showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
        return true;
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return false;
    }
}

async function applyXiaomiParts() {
    const normalized = getNormalizedXiaomiPartsPendingState();
    const args = [
        `torch_strength=${normalized.torch_strength}`,
        `vibration_strength=${normalized.vibration_strength}`
    ];

    const result = await runXiaomiPartsBackend('apply', ...args);
    if (result && result.includes('applied')) {
        const currentOutput = await runXiaomiPartsBackend('get_current');
        xpCurrentState = normalizeXiaomiPartsState(parseKeyValue(currentOutput));
        renderXiaomiPartsCard();
        showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
    }
}

function initXiaomiPartsTweak() {
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('xiaomi_parts', {
            getState: () => getNormalizedXiaomiPartsPendingState(),
            setState: (config) => {
                xpPendingState = normalizeXiaomiPartsState({
                    ...xpPendingState,
                    ...(config || {})
                });
                renderXiaomiPartsCard();
            },
            render: renderXiaomiPartsCard,
            save: saveXiaomiParts,
            apply: applyXiaomiParts
        });
    }

    const sliderTorch = document.getElementById('xiaomi-parts-slider-torch');
    const inputTorch = document.getElementById('xiaomi-parts-input-torch');
    const sliderVib = document.getElementById('xiaomi-parts-slider-vibration');
    const inputVib = document.getElementById('xiaomi-parts-input-vibration');

    if (sliderTorch) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(sliderTorch);
        sliderTorch.addEventListener('input', (e) => {
            xpPendingState.torch_strength = String(clampXpPercent(e.target.value, 10, 100));
            renderXiaomiPartsCard();
        });
    }

    if (inputTorch) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(inputTorch);
        inputTorch.addEventListener('change', (e) => {
            if (e.target.value === '') {
                xpPendingState.torch_strength = window.getTweakDefaultValue(
                    'torch_strength',
                    xpCurrentState,
                    xpDefaultState,
                    '85'
                );
            } else {
                xpPendingState.torch_strength = String(clampXpPercent(e.target.value, 10, 100));
            }
            renderXiaomiPartsCard();
        });
    }

    if (sliderVib) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(sliderVib);
        sliderVib.addEventListener('input', (e) => {
            xpPendingState.vibration_strength = String(clampXpPercent(e.target.value, 10, 100));
            renderXiaomiPartsCard();
        });
    }

    if (inputVib) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(inputVib);
        inputVib.addEventListener('change', (e) => {
            if (e.target.value === '') {
                xpPendingState.vibration_strength = window.getTweakDefaultValue(
                    'vibration_strength',
                    xpCurrentState,
                    xpDefaultState,
                    '85'
                );
            } else {
                xpPendingState.vibration_strength = String(clampXpPercent(e.target.value, 10, 100));
            }
            renderXiaomiPartsCard();
        });
    }

    const btnSave = document.getElementById('xiaomi-parts-btn-save');
    const btnApply = document.getElementById('xiaomi-parts-btn-apply');
    const btnSaveApply = document.getElementById('xiaomi-parts-btn-save-apply');

    if (btnSave) {
        btnSave.addEventListener('click', () => saveXiaomiParts());
    }
    if (btnApply) {
        btnApply.addEventListener('click', () => applyXiaomiParts());
    }
    if (btnSaveApply) {
        btnSaveApply.addEventListener('click', async () => {
            const saved = await saveXiaomiParts();
            if (saved) {
                await applyXiaomiParts();
            }
        });
    }

    loadXiaomiPartsState();
}

document.addEventListener('languageChanged', () => {
    if (document.getElementById('xiaomi-parts-card')) {
        renderXiaomiPartsCard();
    }
});
