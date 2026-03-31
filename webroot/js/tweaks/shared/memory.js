// Memory Tweak

let memoryCurrentState = {};
let memorySavedState = {};
let memoryPendingState = {};
let memoryDirtyMode = 'ratio'; // 'ratio' or 'bytes'
let memoryReferenceState = {};
let memoryDefaultState = {};

const runMemoryBackend = (...args) => window.runTweakBackend('memory', ...args);

function buildMemoryEffectiveState() {
    const state = {
        swappiness: window.getTweakPendingValue('swappiness', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_ratio: window.getTweakPendingValue('dirty_ratio', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_bytes: window.getTweakPendingValue('dirty_bytes', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_background_ratio: window.getTweakPendingValue('dirty_background_ratio', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_background_bytes: window.getTweakPendingValue('dirty_background_bytes', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_writeback_centisecs: window.getTweakPendingValue('dirty_writeback_centisecs', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        dirty_expire_centisecs: window.getTweakPendingValue('dirty_expire_centisecs', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        stat_interval: window.getTweakPendingValue('stat_interval', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        vfs_cache_pressure: window.getTweakPendingValue('vfs_cache_pressure', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState),
        watermark_scale_factor: window.getTweakPendingValue('watermark_scale_factor', memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState)
    };

    // Keep ratio/bytes mutually exclusive in the persisted/applied state.
    if (memoryDirtyMode === 'ratio') {
        state.dirty_bytes = '0';
        state.dirty_background_bytes = '0';
    } else {
        state.dirty_ratio = '0';
        state.dirty_background_ratio = '0';
    }

    return state;
}

// Load Memory state
async function loadMemoryState() {
    try {
        const { current, saved } = await window.loadTweakState('memory');

        memoryCurrentState = current;
        memoryDefaultState = { ...window.getDefaultTweakPreset('memory') };
        memorySavedState = window.buildSparseStateAgainstDefaults(saved, memoryDefaultState);

        // Keep saved/custom overrides separate from the boot-captured defaults.
        memoryReferenceState = window.initPendingState(memoryCurrentState, memorySavedState, memoryDefaultState);
        memoryPendingState = { ...memoryReferenceState };

        // Determine initial Dirty Mode
        // If bytes are non-zero, use bytes. Otherwise default to ratio.
        const dBytes = parseInt(memoryPendingState.dirty_bytes || '0');
        const dbBytes = parseInt(memoryPendingState.dirty_background_bytes || '0');

        if (dBytes > 0 || dbBytes > 0) {
            memoryDirtyMode = 'bytes';
        } else {
            memoryDirtyMode = 'ratio';
        }

        renderMemoryCard();
    } catch (e) {
        console.error('Failed to load Memory state:', e);
    }
}
window.loadMemoryState = loadMemoryState;

// Render Memory Card UI
function renderMemoryCard() {
    // 1. Swappiness
    const swappinessInput = document.getElementById('mem-swappiness');
    const swappinessVal = document.getElementById('mem-val-swappiness');
    if (swappinessInput) {
        const { placeholder, value } = window.getTweakTextInputState(
            'swappiness',
            memoryPendingState,
            memorySavedState,
            memoryReferenceState,
            memoryDefaultState,
            memoryCurrentState
        );
        swappinessInput.placeholder = placeholder;
        swappinessInput.value = value;
    }
    if (swappinessVal) swappinessVal.textContent = memoryCurrentState.swappiness || '--';

    // 2. Dirty Mode Toggle
    const modeRatio = document.getElementById('mem-mode-ratio');
    const modeBytes = document.getElementById('mem-mode-bytes');
    if (modeRatio && modeBytes) {
        modeRatio.checked = memoryDirtyMode === 'ratio';
        modeBytes.checked = memoryDirtyMode === 'bytes';
    }

    // Toggle visibility based on mode
    const groupRatio = document.getElementById('mem-group-ratio');
    const groupBytes = document.getElementById('mem-group-bytes');
    if (groupRatio) groupRatio.classList.toggle('hidden', memoryDirtyMode !== 'ratio');
    if (groupBytes) groupBytes.classList.toggle('hidden', memoryDirtyMode !== 'bytes');

    // 3. Ratio Inputs
    if (memoryDirtyMode === 'ratio') {
        updateMemInput('dirty_ratio');
        updateMemInput('dirty_background_ratio');
    } else {
        updateMemInput('dirty_bytes');
        updateMemInput('dirty_background_bytes');
    }

    // 4. Other VM Params
    updateMemInput('dirty_writeback_centisecs');
    updateMemInput('dirty_expire_centisecs');
    updateMemInput('stat_interval');
    updateMemInput('vfs_cache_pressure');
    updateMemInput('watermark_scale_factor');

    updateMemoryPendingIndicator();
}

// Helper to update individual input and value label
function updateMemInput(key) {
    const input = document.getElementById(`mem-${key}`);
    const label = document.getElementById(`mem-val-${key}`);

    if (input) {
        const { placeholder, value } = window.getTweakTextInputState(
            key,
            memoryPendingState,
            memorySavedState,
            memoryReferenceState,
            memoryDefaultState,
            memoryCurrentState
        );
        input.placeholder = placeholder;
        input.value = value;
    }
    if (label) label.textContent = memoryCurrentState[key] || '--';
}

function updateMemoryPendingIndicator() {
    // Simple check: compare JSON strings of interesting keys
    // In a real generic system we'd do deep compare, but here we know the keys
    const paramKeys = ['swappiness', 'dirty_ratio', 'dirty_bytes', 'dirty_background_ratio',
        'dirty_background_bytes', 'dirty_writeback_centisecs', 'dirty_expire_centisecs',
        'stat_interval', 'vfs_cache_pressure', 'watermark_scale_factor'];

    let hasPending = false;
    // Check against saved if exists, else current
    for (const key of paramKeys) {
        const referenceVal = window.getTweakReferenceValue(key, memoryReferenceState, memoryDefaultState, memoryCurrentState);
        const pendingVal = window.getTweakPendingValue(key, memoryPendingState, memoryReferenceState, memoryDefaultState, memoryCurrentState);
        if (pendingVal != referenceVal) {
            hasPending = true;
            break;
        }
    }

    window.setPendingIndicator('mem-pending-indicator', hasPending);
}

// Input Change Handlers
function handleMemInput(key, value) {
    if (value === '' || value === undefined) {
        memoryPendingState[key] = window.getTweakDefaultValue(key, memoryCurrentState, memoryDefaultState);
    } else {
        memoryPendingState[key] = value;
    }

    // Handle mutual exclusivity for pending state immediately
    if (key === 'dirty_ratio' && value !== '0') memoryPendingState.dirty_bytes = '0';
    if (key === 'dirty_bytes' && value !== '0') memoryPendingState.dirty_ratio = '0';
    if (key === 'dirty_background_ratio' && value !== '0') memoryPendingState.dirty_background_bytes = '0';
    if (key === 'dirty_background_bytes' && value !== '0') memoryPendingState.dirty_background_ratio = '0';

    updateMemoryPendingIndicator();
}

function setMemoryMode(mode) {
    memoryDirtyMode = mode;
    renderMemoryCard();
}

async function saveMemory() {
    const effectiveState = buildMemoryEffectiveState();
    const sparseState = window.buildSparseStateAgainstDefaults(effectiveState, memoryDefaultState);
    const args = Object.entries(sparseState).map(([key, value]) => `${key}=${value}`);

    const result = await runMemoryBackend('save', ...args);
    if (result && result.includes('Saved')) {
        showToast('Memory settings saved');
        memorySavedState = { ...sparseState };
        memoryReferenceState = window.initPendingState(memoryCurrentState, memorySavedState, memoryDefaultState);
        memoryPendingState = { ...memoryReferenceState };
        renderMemoryCard();
    } else {
        showToast('Failed to save Memory settings', true);
    }
}

async function applyMemory() {
    const effectiveState = buildMemoryEffectiveState();
    const args = Object.entries(effectiveState).map(([key, value]) => `${key}=${value}`);

    const result = await runMemoryBackend('apply', ...args);
    if (result && result.includes('Applied')) {
        showToast('Memory settings applied');
        const currentOutput = await runMemoryBackend('get_current');
        memoryCurrentState = parseKeyValue(currentOutput);
        renderMemoryCard();
    } else {
        showToast('Failed to apply Memory settings', true);
    }
}

function initMemoryTweak() {
    // Mode toggles
    const modeRatio = document.getElementById('mem-mode-ratio');
    if (modeRatio) modeRatio.addEventListener('change', () => setMemoryMode('ratio'));

    const modeBytes = document.getElementById('mem-mode-bytes');
    if (modeBytes) modeBytes.addEventListener('change', () => setMemoryMode('bytes'));

    // Inputs
    const paramKeys = ['swappiness', 'dirty_ratio', 'dirty_bytes', 'dirty_background_ratio',
        'dirty_background_bytes', 'dirty_writeback_centisecs', 'dirty_expire_centisecs',
        'stat_interval', 'vfs_cache_pressure', 'watermark_scale_factor'];

    paramKeys.forEach(key => {
        const input = document.getElementById(`mem-${key}`);
        if (input) {
            input.addEventListener('input', (e) => handleMemInput(key, e.target.value));
        }
    });

    // Buttons
    const btnSave = document.getElementById('mem-btn-save');
    const btnApply = document.getElementById('mem-btn-apply');
    window.bindSaveApplyButtons('mem', saveMemory, applyMemory);

    loadMemoryState();

    // Register
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('memory', {
            getState: () => ({ ...memoryPendingState }),
            setState: (config) => {
                memoryPendingState = { ...memoryPendingState, ...config };
                // Update mode based on config
                if (parseInt(config.dirty_bytes) > 0 || parseInt(config.dirty_background_bytes) > 0) {
                    memoryDirtyMode = 'bytes';
                } else {
                    memoryDirtyMode = 'ratio';
                }
                renderMemoryCard();
            },
            render: renderMemoryCard,
            save: saveMemory,
            apply: applyMemory
        });
    }
}
