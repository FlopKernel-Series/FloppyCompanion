// Undervolt Tweak

const UNDERVOLT_KEYS = ['little', 'big', 'prime', 'gpu'];
const UNDERVOLT_BASE_STATE = { little: '0', big: '0', prime: '0', gpu: '0' };

let undervoltAvailable = false;
let undervoltCapabilities = { little: '0', big: '0', prime: '0', gpu: '0' };
let undervoltCurrentState = { ...UNDERVOLT_BASE_STATE };
let undervoltSavedState = {}; // Sparse overrides from config file
let undervoltPendingState = { ...UNDERVOLT_BASE_STATE };
let undervoltReferenceState = { ...UNDERVOLT_BASE_STATE };
let undervoltDefaultState = { ...UNDERVOLT_BASE_STATE };

const runUndervoltBackend = (...args) => window.runTweakBackend('undervolt', ...args);

function getSupportedUndervoltKeys() {
    return UNDERVOLT_KEYS.filter((key) => undervoltCapabilities[key] === '1');
}

function normalizeUndervoltState(state) {
    return {
        little: state.little || '0',
        big: state.big || '0',
        prime: state.prime || '0',
        gpu: state.gpu || '0'
    };
}

function buildUndervoltEffectiveState(source = undervoltPendingState) {
    const state = {};
    UNDERVOLT_KEYS.forEach((key) => {
        state[key] = String(
            source[key]
            ?? window.getTweakDefaultValue(key, undervoltCurrentState, undervoltDefaultState, '0')
        );
    });
    return state;
}

function ensureUndervoltUnlockedIfNeeded() {
    const unlockSwitch = document.getElementById('undervolt-unlock-switch');
    if (!unlockSwitch) return;

    const hasHighValue = getSupportedUndervoltKeys().some((key) => {
        const val = parseInt(undervoltPendingState[key] || '0', 10);
        return val > 15;
    });

    if (hasHighValue && !unlockSwitch.checked) {
        unlockSwitch.checked = true;
    }
}

async function checkUndervoltAvailable() {
    if (!['Floppy1280', 'Floppy2100'].includes(window.KERNEL_NAME)) {
        undervoltAvailable = false;
        return false;
    }
    const [availabilityOutput, capabilitiesOutput] = await Promise.all([
        runUndervoltBackend('is_available'),
        runUndervoltBackend('get_capabilities')
    ]);
    undervoltAvailable = (availabilityOutput === 'available=1');
    undervoltCapabilities = { ...undervoltCapabilities, ...parseKeyValue(capabilitiesOutput) };
    return undervoltAvailable;
}

async function loadUndervoltState() {
    const available = await checkUndervoltAvailable();
    const card = document.getElementById('undervolt-card');
    if (!available) {
        if (card) card.classList.add('hidden');
        return;
    }

    if (card) card.classList.remove('hidden');

    const { current, saved } = await window.loadTweakState('undervolt');
    undervoltCurrentState = normalizeUndervoltState(current);
    undervoltDefaultState = normalizeUndervoltState(window.getDefaultTweakPreset('undervolt') || {});
    undervoltSavedState = window.buildSparseStateAgainstDefaults(saved, undervoltDefaultState);
    const effectiveReferenceState = window.initPendingState(
        undervoltCurrentState,
        undervoltSavedState,
        undervoltDefaultState
    );
    undervoltPendingState = normalizeUndervoltState(effectiveReferenceState);
    undervoltReferenceState = normalizeUndervoltState(effectiveReferenceState);

    ensureUndervoltUnlockedIfNeeded();
    renderUndervoltCard();
}
window.loadUndervoltState = loadUndervoltState;

function renderUndervoltCard() {
    UNDERVOLT_KEYS.forEach((key) => {
        const container = document.getElementById(`undervolt-container-${key}`);
        if (container) {
            container.classList.toggle('hidden', undervoltCapabilities[key] !== '1');
        }
    });

    const elements = getSupportedUndervoltKeys();
    ensureUndervoltUnlockedIfNeeded();
    const unlockSwitch = document.getElementById('undervolt-unlock-switch');
    const isUnlocked = !!unlockSwitch?.checked;

    elements.forEach(el => {
        const valEl = document.getElementById(`undervolt-val-${el}`);
        const sliderEl = document.getElementById(`undervolt-slider-${el}`);
        const inputEl = document.getElementById(`undervolt-input-${el}`);

        if (!sliderEl || !inputEl) return;

        const valPending = window.getTweakPendingValue(
            el,
            undervoltPendingState,
            undervoltReferenceState,
            undervoltDefaultState,
            undervoltCurrentState,
            '0'
        );
        const valCurrent = undervoltCurrentState[el] || '0';

        // Update display values (label shows current kernel state)
        if (valEl) valEl.textContent = valCurrent + '%';

        // Slider shows pending/slider state
        sliderEl.value = valPending;
        const { placeholder, value } = window.getTweakTextInputState(
            el,
            undervoltPendingState,
            undervoltSavedState,
            undervoltReferenceState,
            undervoltDefaultState,
            undervoltCurrentState,
            '0'
        );
        inputEl.placeholder = placeholder;
        inputEl.value = value;

        // Update max range based on lock switch
        const max = isUnlocked ? 100 : 15;
        sliderEl.max = max;
        inputEl.max = max;

        // Update visual ticks
        updateSliderTicks(sliderEl, isUnlocked);
    });

    // Initial update
    const sliders = elements.map(t => document.getElementById(`undervolt-slider-${t}`));
    sliders.forEach(slider => {
        if (slider) updateSliderTicks(slider, isUnlocked);
    });

    // High-value warning logic (show if any value > 10)
    const highWarning = document.getElementById('undervolt-high-warning');
    if (highWarning) {
        const anyHigh = elements.some(el => {
            const val = parseInt(undervoltPendingState[el] || '0');
            return val > 10;
        });
        if (anyHigh) {
            highWarning.classList.remove('hidden');
        } else {
            highWarning.classList.add('hidden');
        }
    }

    updateUndervoltPendingIndicator();
}

function updateSliderTicks(slider, isUnlocked) {
    if (!slider) return;
    const sliderShell = slider.closest('.tweak-beer-slider') || slider;

    // Get color from CSS variable
    const color = getComputedStyle(document.body).getPropertyValue('--md-sys-color-outline').trim() || '#747775';

    // Determine ticks count
    // Locked: 0-15 -> 16 ticks
    // Unlocked: 0-100 (step 5) -> 21 ticks
    const ticks = isUnlocked ? 21 : 16;

    // Generate SVG
    const lines = [];
    for (let i = 0; i < ticks; i++) {
        const pct = (i / (ticks - 1)) * 100;
        let transform = '';
        if (i === 0) transform = "transform='translate(0.5, 0)'"; // Shift first tick right
        if (i === ticks - 1) transform = "transform='translate(-0.5, 0)'"; // Shift last tick left

        lines.push(`<line x1='${pct}%' y1='0' x2='${pct}%' y2='100%' stroke='${color}' stroke-width='1' ${transform} />`);
    }

    // We need xmlns for proper rendering in data URI
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>${lines.join('')}</svg>`;
    const encoded = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

    sliderShell.style.setProperty('--track-ticks', encoded);

    if (window.syncBeerRangeSlider) {
        window.syncBeerRangeSlider(slider);
    }
}

function updateUndervoltPendingIndicator() {
    const isChanged = getSupportedUndervoltKeys().some((key) => {
        const pendingValue = window.getTweakPendingValue(
            key,
            undervoltPendingState,
            undervoltReferenceState,
            undervoltDefaultState,
            undervoltCurrentState,
            '0'
        );
        const referenceValue = window.getTweakReferenceValue(
            key,
            undervoltReferenceState,
            undervoltDefaultState,
            undervoltCurrentState,
            '0'
        );

        return pendingValue !== referenceValue;
    });

    window.setPendingIndicator('undervolt-pending-indicator', isChanged);
}

async function saveUndervolt() {
    const effectiveState = buildUndervoltEffectiveState();
    const sparseState = window.buildSparseStateAgainstDefaults(effectiveState, undervoltDefaultState);
    await runUndervoltBackend('save', ...Object.entries(sparseState).map(([key, value]) => `${key}=${value}`));
    undervoltSavedState = { ...sparseState };
    undervoltReferenceState = normalizeUndervoltState(
        window.initPendingState(undervoltCurrentState, undervoltSavedState, undervoltDefaultState)
    );
    undervoltPendingState = { ...undervoltReferenceState };
    renderUndervoltCard();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyUndervolt() {
    const { little, big, prime, gpu } = undervoltPendingState;
    await runUndervoltBackend('apply', little, big, prime, gpu);

    // Refresh current
    const current = await runUndervoltBackend('get_current');
    undervoltCurrentState = normalizeUndervoltState(parseKeyValue(current));

    renderUndervoltCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

// Clear undervolt persistence (called externally)
async function clearUndervoltPersistence() {
    await runUndervoltBackend('clear_saved');
    await loadUndervoltState();

    // Show the notice to inform user their settings were cleared
    const notice = document.getElementById('undervolt-notice');
    if (notice) notice.classList.remove('hidden');
}
// Export globally for other modules to use
window.clearUndervoltPersistence = clearUndervoltPersistence;

function initUndervoltTweak() {
    // Register tweak immediately (Early Registration)
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('undervolt', {
            getState: () => ({ ...undervoltPendingState }),
            setState: (config) => {
                const baseline = normalizeUndervoltState({ ...undervoltCurrentState, ...undervoltDefaultState });
                undervoltPendingState = normalizeUndervoltState({ ...baseline, ...(config || {}) });
                ensureUndervoltUnlockedIfNeeded();
                renderUndervoltCard();
            },
            render: renderUndervoltCard,
            save: saveUndervolt,
            apply: applyUndervolt
        });
    }

    loadUndervoltState();

    // Unlock Switch
    // Event Listeners
    UNDERVOLT_KEYS.forEach(type => {
        const slider = document.getElementById(`undervolt-slider-${type}`);
        const input = document.getElementById(`undervolt-input-${type}`);

        if (slider) {
            if (window.preventSwipePropagation) window.preventSwipePropagation(slider); // Fix swipe conflict

            slider.addEventListener('input', (e) => {
                undervoltPendingState[type] = String(e.target.value || '0');
                renderUndervoltCard();
            });
        }

        if (input) {
            if (window.preventSwipePropagation) window.preventSwipePropagation(input);

            input.addEventListener('change', (e) => {
                if (e.target.value === '') {
                    undervoltPendingState[type] = window.getTweakDefaultValue(
                        type,
                        undervoltCurrentState,
                        undervoltDefaultState,
                        '0'
                    );
                    renderUndervoltCard();
                    return;
                }

                let val = parseInt(e.target.value) || 0;
                // Clamp
                const max = parseInt(document.getElementById(`undervolt-slider-${type}`).max);
                if (val < 0) val = 0;
                if (val > max) val = max;

                if (slider) slider.value = val;

                undervoltPendingState[type] = val.toString();
                renderUndervoltCard();
            });
        }
    });

    const unlockSwitch = document.getElementById('undervolt-unlock-switch');
    if (unlockSwitch) {
        unlockSwitch.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Show MD3 confirmation modal
                const confirmed = await showConfirmModal({
                    title: t('tweaks.undervolt.unlockConfirmTitle'),
                    body: t('tweaks.undervolt.unlockConfirmBody'),
                    confirmText: t('modal.unlock'),
                    cancelText: t('modal.cancel'),
                    iconClass: 'warning'
                });
                if (!confirmed) {
                    e.target.checked = false;
                    return;
                }
            }
            renderUndervoltCard();
        });
    }

    // Action Buttons
    window.bindSaveApplyButtons('undervolt', saveUndervolt, applyUndervolt);

    // Language change listener
    document.addEventListener('languageChanged', () => {
        if (undervoltAvailable) renderUndervoltCard();
    });
}
