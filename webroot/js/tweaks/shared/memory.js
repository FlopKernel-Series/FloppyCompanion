// Memory Tweak

let memoryCurrentState = {};
let memorySavedState = {};
let memoryPendingState = {};
let memoryDirtyMode = 'ratio'; // 'ratio' or 'bytes'

// Run Memory backend command
async function runMemoryBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/tweaks/memory.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Load Memory state
async function loadMemoryState() {
    try {
        const currentOutput = await runMemoryBackend('get_current');
        const savedOutput = await runMemoryBackend('get_saved');

        memoryCurrentState = parseKeyValue(currentOutput);
        memorySavedState = parseKeyValue(savedOutput);

        // Sanitize
        Object.keys(memorySavedState).forEach(key => {
            if (memorySavedState[key] === '') delete memorySavedState[key];
        });

        // Initialize pending
        const defaults = window.getDefaultPreset ? window.getDefaultPreset() : null;
        const defMem = defaults?.tweaks?.memory || {};
        memoryPendingState = { ...defMem, ...memoryCurrentState, ...memorySavedState };

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

// Render Memory Card UI
function renderMemoryCard() {
    // 1. Swappiness
    const swappinessInput = document.getElementById('mem-swappiness');
    const swappinessVal = document.getElementById('mem-val-swappiness');
    if (swappinessInput) {
        swappinessInput.placeholder = memoryCurrentState.swappiness || '';
        swappinessInput.value = memoryPendingState.swappiness !== memoryCurrentState.swappiness ? memoryPendingState.swappiness : '';
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
        input.placeholder = memoryCurrentState[key] || '';
        // Only show value if it differs from current
        if (memoryPendingState[key] && memoryPendingState[key] !== memoryCurrentState[key]) {
            input.value = memoryPendingState[key];
        } else {
            input.value = '';
        }
    }
    if (label) label.textContent = memoryCurrentState[key] || '--';
}

function updateMemoryPendingIndicator() {
    const indicator = document.getElementById('mem-pending-indicator');
    if (!indicator) return;

    // Simple check: compare JSON strings of interesting keys
    // In a real generic system we'd do deep compare, but here we know the keys
    const paramKeys = ['swappiness', 'dirty_ratio', 'dirty_bytes', 'dirty_background_ratio',
        'dirty_background_bytes', 'dirty_writeback_centisecs', 'dirty_expire_centisecs',
        'stat_interval', 'vfs_cache_pressure', 'watermark_scale_factor'];

    let hasPending = false;
    // Check against saved if exists, else current
    for (const key of paramKeys) {
        const savedVal = memorySavedState[key] || memoryCurrentState[key];
        const pendingVal = memoryPendingState[key] || savedVal; // Fallback to saved if not in pending
        if (pendingVal != savedVal) {
            hasPending = true;
            break;
        }
    }

    if (hasPending) indicator.classList.remove('hidden');
    else indicator.classList.add('hidden');
}

// Input Change Handlers
function handleMemInput(key, value) {
    if (value === '' || value === undefined) {
        // Revert to saved/current
        memoryPendingState[key] = memorySavedState[key] || memoryCurrentState[key];
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
    // Construct args from pending state
    // We only save keys that are relevant.
    // Ensure mutual exclusivity is enforced in the saved data
    const args = [];
    const keys = ['swappiness', 'dirty_writeback_centisecs', 'dirty_expire_centisecs',
        'stat_interval', 'vfs_cache_pressure', 'watermark_scale_factor'];

    keys.forEach(k => args.push(`${k}=${memoryPendingState[k] || memoryCurrentState[k]}`));

    if (memoryDirtyMode === 'ratio') {
        args.push(`dirty_ratio=${memoryPendingState.dirty_ratio || '0'}`);
        args.push(`dirty_background_ratio=${memoryPendingState.dirty_background_ratio || '0'}`);
        args.push(`dirty_bytes=0`);
        args.push(`dirty_background_bytes=0`);
    } else {
        args.push(`dirty_bytes=${memoryPendingState.dirty_bytes || '0'}`);
        args.push(`dirty_background_bytes=${memoryPendingState.dirty_background_bytes || '0'}`);
        args.push(`dirty_ratio=0`);
        args.push(`dirty_background_ratio=0`);
    }

    const result = await runMemoryBackend('save', ...args);
    if (result && result.includes('Saved')) {
        showToast('Memory settings saved');
        memorySavedState = { ...memoryPendingState };
        // Sync mutual exclusions to saved state
        if (memoryDirtyMode === 'ratio') {
            memorySavedState.dirty_bytes = '0';
            memorySavedState.dirty_background_bytes = '0';
        } else {
            memorySavedState.dirty_ratio = '0';
            memorySavedState.dirty_background_ratio = '0';
        }
        updateMemoryPendingIndicator();
    } else {
        showToast('Failed to save Memory settings', true);
    }
}

async function applyMemory() {
    // Similar to save but just apply
    const args = [];
    const keys = ['swappiness', 'dirty_writeback_centisecs', 'dirty_expire_centisecs',
        'stat_interval', 'vfs_cache_pressure', 'watermark_scale_factor'];

    keys.forEach(k => args.push(`${k}=${memoryPendingState[k] || memoryCurrentState[k]}`));

    if (memoryDirtyMode === 'ratio') {
        args.push(`dirty_ratio=${memoryPendingState.dirty_ratio || '0'}`);
        args.push(`dirty_background_ratio=${memoryPendingState.dirty_background_ratio || '0'}`);
        args.push(`dirty_bytes=0`);
        args.push(`dirty_background_bytes=0`);
    } else {
        args.push(`dirty_bytes=${memoryPendingState.dirty_bytes || '0'}`);
        args.push(`dirty_background_bytes=${memoryPendingState.dirty_background_bytes || '0'}`);
        args.push(`dirty_ratio=0`);
        args.push(`dirty_background_ratio=0`);
    }

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
    const btnSaveApply = document.getElementById('mem-btn-save-apply');

    if (btnSave) btnSave.addEventListener('click', saveMemory);
    if (btnApply) btnApply.addEventListener('click', applyMemory);
    if (btnSaveApply) btnSaveApply.addEventListener('click', async () => {
        await saveMemory();
        await applyMemory();
    });

    loadMemoryState();

    // Register
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('memory', {
            getState: () => ({ ...memoryPendingState }),
            setState: (config) => {
                memoryPendingState = { ...config };
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
