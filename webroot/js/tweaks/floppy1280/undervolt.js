// Undervolt Tweak

let undervoltAvailable = false;
let undervoltCurrentState = { little: '0', big: '0', gpu: '0' };
let undervoltSavedState = { little: '0', big: '0', gpu: '0' }; // From config file
let undervoltPendingState = { little: '0', big: '0', gpu: '0' };

async function runUndervoltBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/undervolt.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Undervolt backend error (${action}):`, error);
        return '';
    }
}

async function checkUndervoltAvailable() {
    // Only available on Floppy1280
    if (window.KERNEL_NAME !== 'Floppy1280') {
        undervoltAvailable = false;
        return false;
    }
    const output = await runUndervoltBackend('is_available');
    undervoltAvailable = (output === 'available=1');
    return undervoltAvailable;
}

function loadUndervoltState() {
    checkUndervoltAvailable().then(available => {
        if (!available) {
            document.getElementById('undervolt-card').classList.add('hidden');
            return;
        }

        document.getElementById('undervolt-card').classList.remove('hidden');

        // Load current and saved states in parallel
        Promise.all([
            runUndervoltBackend('get_current'),
            runUndervoltBackend('get_saved')
        ]).then(([currentOutput, savedOutput]) => {
            undervoltCurrentState = parseKeyValue(currentOutput);
            undervoltSavedState = parseKeyValue(savedOutput);

            // Set pending to saved if available, else current (0)
            if (savedOutput.trim() && undervoltSavedState.little !== undefined) {
                undervoltPendingState = { ...undervoltSavedState };
            } else {
                undervoltPendingState = { ...undervoltCurrentState };
            }

            renderUndervoltCard();
        });
    });
}

function renderUndervoltCard() {
    const elements = ['little', 'big', 'gpu'];

    elements.forEach(el => {
        const valEl = document.getElementById(`undervolt-val-${el}`);
        const sliderEl = document.getElementById(`undervolt-slider-${el}`);
        const inputEl = document.getElementById(`undervolt-input-${el}`);

        if (!sliderEl || !inputEl) return;

        const valPending = undervoltPendingState[el] || '0';
        const valCurrent = undervoltCurrentState[el] || '0';

        // Update display values (label shows current kernel state)
        if (valEl) valEl.textContent = valCurrent + '%';

        // Slider shows pending/slider state
        sliderEl.value = valPending;
        if (inputEl) inputEl.value = valPending;


        // Update max range based on lock switch
        const isUnlocked = document.getElementById('undervolt-unlock-switch').checked;
        const max = isUnlocked ? 100 : 15;
        sliderEl.max = max;
        inputEl.max = max;

        // Update visual ticks
        updateSliderTicks(sliderEl, isUnlocked);
    });

    // Initial update
    const switchEl = document.getElementById('undervolt-unlock-switch');
    if (switchEl) {
        const isUnlocked = switchEl.checked;
        const sliders = ['little', 'big', 'gpu'].map(t => document.getElementById(`undervolt-slider-${t}`));
        sliders.forEach(slider => {
            if (slider) updateSliderTicks(slider, isUnlocked);
        });
    }

    // High-value warning logic (show if any value > 10)
    const highWarning = document.getElementById('undervolt-high-warning');
    if (highWarning) {
        const anyHigh = ['little', 'big', 'gpu'].some(el => {
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

    slider.style.setProperty('--track-ticks', encoded);
}

function updateUndervoltPendingIndicator() {
    const indicator = document.getElementById('undervolt-pending-indicator');
    if (!indicator) return;

    // Compare pending with saved (or current/default)
    const hasSaved = undervoltSavedState.little !== undefined;
    const reference = hasSaved ? undervoltSavedState : { little: '0', big: '0', gpu: '0' };

    const isChanged =
        undervoltPendingState.little !== reference.little ||
        undervoltPendingState.big !== reference.big ||
        undervoltPendingState.gpu !== reference.gpu;

    if (isChanged) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

async function saveUndervolt() {
    const { little, big, gpu } = undervoltPendingState;
    await runUndervoltBackend('save', little, big, gpu);
    undervoltSavedState = { ...undervoltPendingState };
    updateUndervoltPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyUndervolt() {
    const { little, big, gpu } = undervoltPendingState;
    await runUndervoltBackend('apply', little, big, gpu);

    // Refresh current
    const current = await runUndervoltBackend('get_current');
    undervoltCurrentState = parseKeyValue(current);

    renderUndervoltCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

// Clear undervolt persistence (called externally)
async function clearUndervoltPersistence() {
    await runUndervoltBackend('clear_saved');
    undervoltSavedState = { little: '0', big: '0', gpu: '0' };
    undervoltPendingState = { little: '0', big: '0', gpu: '0' };
    renderUndervoltCard();

    // Show the notice to inform user their settings were cleared
    const notice = document.getElementById('undervolt-notice');
    if (notice) notice.classList.remove('hidden');
}
// Export globally for other modules to use
window.clearUndervoltPersistence = clearUndervoltPersistence;

function initUndervoltTweak() {
    loadUndervoltState();

    // Unlock Switch
    // Event Listeners
    ['little', 'big', 'gpu'].forEach(type => {
        const slider = document.getElementById(`undervolt-slider-${type}`);
        const input = document.getElementById(`undervolt-input-${type}`);

        if (slider) {
            preventSwipePropagation(slider); // Fix swipe conflict

            slider.addEventListener('input', (e) => {
                const val = e.target.value;
                if (input) input.value = val;

                undervoltPendingState[type] = val;
                renderUndervoltCard();
            });
        }

        if (input) {
            input.addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 0;
                // Clamp
                const max = parseInt(document.getElementById(`undervolt-slider-${type}`).max);
                if (val < 0) val = 0;
                if (val > max) val = max;

                input.value = val;
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
    const saveBtn = document.getElementById('undervolt-btn-save');
    const applyBtn = document.getElementById('undervolt-btn-apply');
    const saveApplyBtn = document.getElementById('undervolt-btn-save-apply');

    if (saveBtn) saveBtn.addEventListener('click', saveUndervolt);
    if (applyBtn) applyBtn.addEventListener('click', applyUndervolt);
    if (saveApplyBtn) saveApplyBtn.addEventListener('click', async () => {
        await saveUndervolt();
        await applyUndervolt();
    });

    // Language change listener
    document.addEventListener('languageChanged', () => {
        if (undervoltAvailable) renderUndervoltCard();
    });

    if (typeof window.registerTweak === 'function') {
        window.registerTweak('undervolt', {
            getState: () => ({ ...undervoltPendingState }),
            setState: (config) => {
                undervoltPendingState = { ...undervoltPendingState, ...config };
                renderUndervoltCard();
            },
            render: renderUndervoltCard,
            save: saveUndervolt,
            apply: applyUndervolt
        });
    }
}
