// HWUI renderer tweak

let hwuiCurrentState = {};
let hwuiSavedState = {};
let hwuiPendingState = {};
let hwuiReferenceState = {};
let hwuiDefaultState = {};

const HWUI_RENDERERS = ['default', 'skiavk', 'skiagl'];
const runHwuiBackend = (...args) => window.runTweakBackend('hwui', ...args);

function normalizeHwuiRenderer(value) {
    const renderer = String(value || 'default');
    return HWUI_RENDERERS.includes(renderer) ? renderer : 'default';
}

function normalizeHwuiSbwc(value) {
    return value === '1' || value === 1 || value === true || value === 'true' ? '1' : '0';
}

function isHwuiFloppy2100() {
    return window.KERNEL_NAME === 'Floppy2100';
}

function getHwuiRendererLabel(renderer) {
    const translate = (key, fallback) => {
        const value = window.t ? window.t(key) : '';
        const text = String(value || '');
        return text && text !== key && !text.startsWith('@') ? text : fallback;
    };

    const labels = {
        default: translate('tweaks.hwui.default', 'Default'),
        skiavk: 'Vulkan',
        skiagl: 'OpenGL'
    };
    return labels[normalizeHwuiRenderer(renderer)] || labels.default;
}

async function loadHwuiState() {
    try {
        const { current, saved } = await window.loadTweakState('hwui');

        hwuiCurrentState = {
            ...current,
            renderer: normalizeHwuiRenderer(current.renderer),
            disable_sbwc: normalizeHwuiSbwc(current.disable_sbwc)
        };
        hwuiDefaultState = {
            renderer: 'default',
            disable_sbwc: '0',
            ...window.getDefaultTweakPreset('hwui')
        };
        hwuiDefaultState.renderer = normalizeHwuiRenderer(hwuiDefaultState.renderer);
        hwuiDefaultState.disable_sbwc = normalizeHwuiSbwc(hwuiDefaultState.disable_sbwc);
        hwuiSavedState = window.buildSparseStateAgainstDefaults(saved, hwuiDefaultState);

        hwuiReferenceState = window.initPendingState(hwuiCurrentState, hwuiSavedState, hwuiDefaultState);
        hwuiReferenceState.renderer = normalizeHwuiRenderer(hwuiReferenceState.renderer);
        hwuiReferenceState.disable_sbwc = normalizeHwuiSbwc(hwuiReferenceState.disable_sbwc);
        hwuiPendingState = { ...hwuiReferenceState };

        renderHwuiCard();
    } catch (e) {
        console.error('Failed to load HWUI state:', e);
    }
}
window.loadHwuiState = loadHwuiState;

function renderHwuiCard() {
    const is2100 = isHwuiFloppy2100();

    const pendingRenderer = normalizeHwuiRenderer(hwuiPendingState.renderer);
    const pendingSbwc = normalizeHwuiSbwc(hwuiPendingState.disable_sbwc);

    const options = document.getElementById('hwui-renderer-options');
    if (options) {
        options.querySelectorAll('.option-btn').forEach((btn) => {
            btn.classList.toggle('selected', btn.dataset.renderer === pendingRenderer);
        });
    }

    // Floppy 2100 SBWC Switch (shown on Floppy2100 regardless of selected renderer)
    const sbwcRow = document.getElementById('hwui-sbwc-row');
    const sbwcToggle = document.getElementById('hwui-disable-sbwc-toggle');
    if (sbwcRow) {
        sbwcRow.classList.toggle('hidden', !is2100);
    }
    if (sbwcToggle) {
        sbwcToggle.checked = pendingSbwc === '1';
    }

    // Floppy 2100 Vulkan info notice (shown when Vulkan is selected)
    const sbwcWarning = document.getElementById('hwui-sbwc-warning');
    if (sbwcWarning) {
        const showWarning = is2100 && pendingRenderer === 'skiavk';
        sbwcWarning.classList.toggle('hidden', !showWarning);
    }

    const activeEl = document.getElementById('hwui-current-renderer');
    if (activeEl) {
        activeEl.textContent = getHwuiRendererLabel(hwuiCurrentState.renderer);
    }

    const defaultEl = document.getElementById('hwui-rom-default');
    if (defaultEl) {
        defaultEl.textContent = hwuiCurrentState.rom_default || hwuiDefaultState.rom_default || 'Unknown';
    }

    updateHwuiPendingIndicator();
}

function updateHwuiPendingIndicator() {
    const is2100 = isHwuiFloppy2100();
    const pendingRenderer = normalizeHwuiRenderer(hwuiPendingState.renderer);
    const referenceRenderer = normalizeHwuiRenderer(hwuiReferenceState.renderer);

    let isChanged = pendingRenderer !== referenceRenderer;
    if (is2100) {
        const pendingSbwc = normalizeHwuiSbwc(hwuiPendingState.disable_sbwc);
        const referenceSbwc = normalizeHwuiSbwc(hwuiReferenceState.disable_sbwc);
        if (pendingSbwc !== referenceSbwc) {
            isChanged = true;
        }
    }

    window.setPendingIndicator('hwui-pending-indicator', isChanged);
}

function selectHwuiRenderer(renderer) {
    const normalized = normalizeHwuiRenderer(renderer);
    hwuiPendingState.renderer = normalized;

    // On Floppy 2100, selecting Vulkan automatically enables the disable SBWC switch
    if (isHwuiFloppy2100() && normalized === 'skiavk') {
        hwuiPendingState.disable_sbwc = '1';
    }

    renderHwuiCard();
}

function getHwuiCardTitle() {
    const title = document.querySelector('#hwui-card .card-title')?.textContent?.trim();
    return title || (window.t ? window.t('tweaks.hwui.title') : 'HWUI Renderer');
}

async function maybeShowHwuiRebootModal() {
    if (typeof window.showTweakRebootRequiredModal === 'function') {
        await window.showTweakRebootRequiredModal([getHwuiCardTitle()]);
    }
}

async function saveHwui(options = {}) {
    const is2100 = isHwuiFloppy2100();
    const normalizedState = {
        renderer: normalizeHwuiRenderer(hwuiPendingState.renderer)
    };
    if (is2100) {
        normalizedState.disable_sbwc = normalizeHwuiSbwc(hwuiPendingState.disable_sbwc);
    }

    const sparseState = window.buildSparseStateAgainstDefaults(normalizedState, hwuiDefaultState);
    const args = Object.entries(sparseState).map(([key, value]) => `${key}=${value}`);
    const result = await runHwuiBackend('save', ...args);

    if (result && result.includes('saved')) {
        hwuiSavedState = { ...sparseState };
        hwuiReferenceState = window.initPendingState(hwuiCurrentState, hwuiSavedState, hwuiDefaultState);
        hwuiReferenceState.renderer = normalizeHwuiRenderer(hwuiReferenceState.renderer);
        hwuiReferenceState.disable_sbwc = normalizeHwuiSbwc(hwuiReferenceState.disable_sbwc);
        hwuiPendingState = { ...hwuiReferenceState };
        showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
        renderHwuiCard();
        return true;
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return false;
    }
}

async function applyHwui() {
    const is2100 = isHwuiFloppy2100();
    const renderer = normalizeHwuiRenderer(hwuiPendingState.renderer);
    const args = [`renderer=${renderer}`];
    if (is2100) {
        args.push(`disable_sbwc=${normalizeHwuiSbwc(hwuiPendingState.disable_sbwc)}`);
    }

    const result = await runHwuiBackend('apply', ...args);

    if (result && result.includes('applied')) {
        showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
        const currentOutput = await runHwuiBackend('get_current');
        hwuiCurrentState = parseKeyValue(currentOutput);
        hwuiCurrentState.renderer = normalizeHwuiRenderer(hwuiCurrentState.renderer);
        hwuiCurrentState.disable_sbwc = normalizeHwuiSbwc(hwuiCurrentState.disable_sbwc);
        renderHwuiCard();
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
    }
}

function initHwuiTweak() {
    const options = document.getElementById('hwui-renderer-options');
    if (options) {
        options.querySelectorAll('.option-btn').forEach((btn) => {
            btn.addEventListener('click', () => selectHwuiRenderer(btn.dataset.renderer));
        });
    }

    const sbwcToggle = document.getElementById('hwui-disable-sbwc-toggle');
    if (sbwcToggle) {
        sbwcToggle.addEventListener('change', (e) => {
            hwuiPendingState.disable_sbwc = e.target.checked ? '1' : '0';
            renderHwuiCard();
        });
    }

    bindHwuiButtons();
    loadHwuiState();

    if (typeof window.registerTweak === 'function') {
        window.registerTweak('hwui', {
            getState: () => {
                const is2100 = isHwuiFloppy2100();
                const state = { renderer: normalizeHwuiRenderer(hwuiPendingState.renderer) };
                if (is2100) {
                    state.disable_sbwc = normalizeHwuiSbwc(hwuiPendingState.disable_sbwc);
                }
                return state;
            },
            setState: (config) => {
                hwuiPendingState = {
                    ...hwuiPendingState,
                    renderer: normalizeHwuiRenderer(config?.renderer),
                    disable_sbwc: normalizeHwuiSbwc(config?.disable_sbwc ?? hwuiPendingState.disable_sbwc)
                };
                renderHwuiCard();
            },
            render: renderHwuiCard,
            save: saveHwui,
            apply: applyHwui
        });
    }
}

function bindHwuiButtons() {
    const btnSave = document.getElementById('hwui-btn-save');
    const btnApply = document.getElementById('hwui-btn-apply');
    const btnSaveApply = document.getElementById('hwui-btn-save-apply');

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const saved = await saveHwui();
            if (saved) {
                await maybeShowHwuiRebootModal();
            }
        });
    }
    if (btnApply) {
        btnApply.addEventListener('click', () => applyHwui());
    }
    if (btnSaveApply) {
        btnSaveApply.addEventListener('click', async () => {
            const saved = await saveHwui();
            if (saved) {
                await applyHwui();
                await maybeShowHwuiRebootModal();
            }
        });
    }
}

document.addEventListener('languageChanged', () => {
    if (document.getElementById('hwui-card')) {
        renderHwuiCard();
    }
});

document.addEventListener('deviceDetected', () => {
    if (document.getElementById('hwui-card')) {
        renderHwuiCard();
    }
});

document.addEventListener('tweakVarsChanged', (e) => {
    if (e.detail?.name === 'kernelName' && document.getElementById('hwui-card')) {
        renderHwuiCard();
    }
});
