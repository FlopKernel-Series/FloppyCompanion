// tweaks.js - Tweaks Tab Logic

// ZRAM State
let zramCurrentState = {};
let zramSavedState = {};
let zramPendingState = {};

// Helper: Convert bytes to MiB for display
function bytesToMiB(bytes) {
    return Math.round(bytes / 1048576);
}

// Helper: Convert MiB to bytes
function mibToBytes(mib) {
    return mib * 1048576;
}

// Run ZRAM backend command
async function runZramBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/tweaks/zram.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Parse key=value output
function parseKeyValue(output) {
    const result = {};
    if (!output) return result;
    output.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            result[key.trim()] = valueParts.join('=').trim();
        }
    });
    return result;
}

// Load ZRAM state
async function loadZramState() {
    try {
        const currentOutput = await runZramBackend('get_current');
        const savedOutput = await runZramBackend('get_saved');

        zramCurrentState = parseKeyValue(currentOutput);
        zramSavedState = parseKeyValue(savedOutput);

        // Sanitize saved state: treat empty values as undefined
        Object.keys(zramSavedState).forEach(key => {
            if (zramSavedState[key] === '') delete zramSavedState[key];
        });

        // Initialize pending state from saved if available, else from current, else from defaults
        const defaults = window.getDefaultPreset ? window.getDefaultPreset() : null;
        const defZram = defaults?.tweaks?.zram || {};

        zramPendingState = {
            disksize: zramSavedState.disksize || zramCurrentState.disksize || defZram.disksize || '0',
            algorithm: zramSavedState.algorithm || zramCurrentState.algorithm || defZram.algorithm || 'lz4',
            enabled: zramSavedState.enabled !== undefined ? zramSavedState.enabled : (zramCurrentState.enabled || defZram.enabled || '1')
        };

        renderZramCard();
    } catch (e) {
        console.error('Failed to load ZRAM state:', e);
    }
}

// Render ZRAM card UI
function renderZramCard() {
    // Enable toggle
    const enableToggle = document.getElementById('zram-enable-toggle');
    if (enableToggle) {
        enableToggle.checked = zramPendingState.enabled !== '0';
    }

    // Disk size options
    const sizeOptions = document.getElementById('zram-size-options');
    const customBtn = document.getElementById('zram-size-custom-btn');
    const customInputRow = document.getElementById('zram-custom-input-row');
    const customInput = document.getElementById('zram-custom-size');

    if (sizeOptions) {
        const pendingSize = zramPendingState.disksize;
        const currentMiB = bytesToMiB(parseInt(zramCurrentState.disksize) || 0);
        let matchedPreset = false;

        sizeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
            const btnSize = btn.dataset.size;

            if (btnSize !== 'custom' && btnSize === pendingSize) {
                btn.classList.add('selected');
                matchedPreset = true;
            }
        });

        // If no preset matched, select Custom
        if (!matchedPreset && customBtn && pendingSize) {
            customBtn.classList.add('selected');
            if (customInputRow) customInputRow.classList.remove('hidden');
            if (customInput) {
                customInput.placeholder = currentMiB.toString();
                // Only set value if it's a custom (non-preset) size
                const pendingMiB = bytesToMiB(parseInt(pendingSize) || 0);
                if (pendingMiB > 0 && ![1536, 2048, 3072, 4096, 6144, 8192].includes(pendingMiB)) {
                    customInput.value = pendingMiB;
                }
            }
        } else if (customInputRow) {
            customInputRow.classList.add('hidden');
        }
    }

    // Algorithm options - populate dynamically
    const algoOptions = document.getElementById('zram-algo-options');
    if (algoOptions && zramCurrentState.available) {
        const algos = zramCurrentState.available.split(',').filter(a => a);
        algoOptions.innerHTML = '';

        algos.forEach(algo => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.dataset.algo = algo;
            btn.textContent = algo;

            if (algo === zramPendingState.algorithm) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', () => selectZramAlgorithm(algo));
            algoOptions.appendChild(btn);
        });
    }

    // Active values display
    const currentDisksize = document.getElementById('zram-current-disksize');
    const currentAlgorithm = document.getElementById('zram-current-algorithm');

    if (currentDisksize) {
        const sizeMiB = bytesToMiB(parseInt(zramCurrentState.disksize) || 0);
        currentDisksize.textContent = `${sizeMiB} MiB`;
    }
    if (currentAlgorithm) {
        currentAlgorithm.textContent = zramCurrentState.algorithm || '--';
    }

    // Hide options if disabled
    const optionsSection = document.getElementById('zram-options');
    if (optionsSection) {
        if (zramPendingState.enabled === '0') {
            optionsSection.classList.add('hidden');
        } else {
            optionsSection.classList.remove('hidden');
        }
    }

    // Update pending indicator
    updateZramPendingIndicator();
}

// Update pending indicator
function updateZramPendingIndicator() {
    const indicator = document.getElementById('zram-pending-indicator');
    if (!indicator) return;

    // Check if pending differs from saved
    // If nothing is saved, compare pending to current (initial) values
    const savedDisksize = zramSavedState.disksize || zramCurrentState.disksize;
    const savedAlgorithm = zramSavedState.algorithm || zramCurrentState.algorithm;
    const savedEnabled = zramSavedState.enabled !== undefined ? zramSavedState.enabled : zramCurrentState.enabled;

    const hasPending =
        (zramPendingState.disksize !== savedDisksize) ||
        (zramPendingState.algorithm !== savedAlgorithm) ||
        (zramPendingState.enabled !== savedEnabled);

    if (hasPending) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Select disk size
function selectZramDisksize(sizeBytes) {
    zramPendingState.disksize = sizeBytes.toString();
    renderZramCard();
}

// Select algorithm
function selectZramAlgorithm(algo) {
    zramPendingState.algorithm = algo;
    renderZramCard();
}

// Toggle enable/disable
async function toggleZramEnabled(enabled) {
    if (!enabled) {
        // Show warning before disabling
        const confirmed = await showConfirmModal({
            title: t('tweaks.zram.disableWarningTitle'),
            body: `<p>${t('tweaks.zram.disableWarningBody')}</p><p>${t('tweaks.zram.disableWarningNote')}</p>`,
            iconClass: 'warning',
            confirmText: t('modal.disable')
        });

        if (!confirmed) {
            const toggle = document.getElementById('zram-enable-toggle');
            if (toggle) toggle.checked = true;
            return;
        }
    }

    zramPendingState.enabled = enabled ? '1' : '0';
    renderZramCard();
}

// Save ZRAM config
async function saveZram() {
    const result = await runZramBackend('save',
        zramPendingState.disksize,
        zramPendingState.algorithm,
        zramPendingState.enabled
    );

    if (result && result.includes('saved')) {
        zramSavedState = { ...zramPendingState };
        showToast('ZRAM settings saved');
        updateZramPendingIndicator();
    } else {
        showToast('Failed to save ZRAM settings', true);
    }
}

// Apply ZRAM config (now, without saving)
async function applyZram() {
    const result = await runZramBackend('apply',
        zramPendingState.disksize,
        zramPendingState.algorithm,
        zramPendingState.enabled
    );

    if (result && result.includes('applied')) {
        showToast('ZRAM settings applied');
        // Reload current state
        const currentOutput = await runZramBackend('get_current');
        zramCurrentState = parseKeyValue(currentOutput);
        renderZramCard();
    } else {
        showToast('Failed to apply ZRAM settings', true);
    }
}

// Save and Apply
async function saveAndApplyZram() {
    await saveZram();
    await applyZram();
}

// Initialize ZRAM tweak UI
function initZramTweak() {
    // Enable toggle
    const enableToggle = document.getElementById('zram-enable-toggle');
    if (enableToggle) {
        enableToggle.addEventListener('change', (e) => {
            toggleZramEnabled(e.target.checked);
        });
    }

    // Disk size preset buttons
    const sizeOptions = document.getElementById('zram-size-options');
    if (sizeOptions) {
        sizeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                if (size === 'custom') {
                    const customInputRow = document.getElementById('zram-custom-input-row');
                    if (customInputRow) customInputRow.classList.toggle('hidden');
                    // Select custom button
                    sizeOptions.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                } else {
                    selectZramDisksize(size);
                }
            });
        });
    }

    // Custom size input
    const customInput = document.getElementById('zram-custom-size');
    if (customInput) {
        customInput.addEventListener('input', () => {
            const mib = parseInt(customInput.value) || 0;
            if (mib >= 1 && mib <= 65536) {
                zramPendingState.disksize = mibToBytes(mib).toString();
                updateZramPendingIndicator();
            }
        });
    }

    // Action buttons
    const btnSave = document.getElementById('zram-btn-save');
    const btnApply = document.getElementById('zram-btn-apply');
    const btnSaveApply = document.getElementById('zram-btn-save-apply');

    if (btnSave) btnSave.addEventListener('click', saveZram);
    if (btnApply) btnApply.addEventListener('click', applyZram);
    if (btnSaveApply) btnSaveApply.addEventListener('click', saveAndApplyZram);

    // Load initial state
    loadZramState();

    // Register with TWEAK_REGISTRY for preset system
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('zram', {
            getState: () => ({ ...zramPendingState }),
            setState: (config) => {
                zramPendingState = { ...config };
                renderZramCard();
            },
            render: renderZramCard,
            save: saveZram,
            apply: applyZram
        });
    }
}

// Expose toast function if not already available
if (typeof showToast === 'undefined') {
    window.showToast = function (message, isError = false) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast' + (isError ? ' error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
}

// Memory State
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


// Initialize tweaks tab
async function initTweaksTab() {
    // Initialize preset system first (to load defaults)
    if (typeof window.initPresets === 'function') {
        await window.initPresets();
    }

    // Initialize individual tweaks
    initZramTweak();
    initMemoryTweak();
    initIoSchedulerTweak();
}

// I/O Scheduler State
let ioschedDevices = []; // Array of {name, active, available}
let ioschedSavedState = {};
let ioschedPendingState = {};

// Run I/O Backend
async function runIoBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/tweaks/iosched.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Parse I/O Scheduler Output
function parseIoSchedulerOutput(output) {
    const devices = [];
    if (!output) return devices;

    const chunks = output.split('---');
    chunks.forEach(chunk => {
        if (!chunk.trim()) return;
        const lines = chunk.trim().split('\n');
        const dev = {};
        lines.forEach(line => {
            const [k, v] = line.split('=');
            if (k && v) dev[k.trim()] = v.trim();
        });
        if (dev.device) {
            devices.push(dev);
        }
    });
    return devices;
}

// Load I/O Scheduler State
async function loadIoSchedulerState() {
    try {
        const currentOutput = await runIoBackend('get_all');
        const savedOutput = await runIoBackend('get_saved');

        ioschedDevices = parseIoSchedulerOutput(currentOutput);
        ioschedSavedState = parseKeyValue(savedOutput);

        // Initialize pending state
        ioschedPendingState = {};
        ioschedDevices.forEach(d => {
            // Priority: Saved > Active in system > Default
            const defaults = window.getDefaultPreset ? window.getDefaultPreset() : null;
            const defIo = defaults?.tweaks?.iosched || {};
            ioschedPendingState[d.device] = ioschedSavedState[d.device] || d.active || defIo[d.device];
        });

        renderIoCard();
    } catch (e) {
        console.error('Failed to load I/O Scheduler state:', e);
    }
}

// Render I/O Card
function renderIoCard() {
    const container = document.getElementById('iosched-devices-container');
    if (!container) return;

    container.innerHTML = '';

    if (ioschedDevices.length === 0) {
        container.innerHTML = '<div class="tweak-row"><span class="tweak-label">No compatible devices found</span></div>';
        return;
    }

    ioschedDevices.forEach(dev => {
        const row = document.createElement('div');
        row.className = 'tweak-block-row';
        row.style.marginBottom = '12px';

        // Device Header with active value on the right
        const header = document.createElement('div');
        header.className = 'tweak-section-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const label = document.createElement('span');
        label.className = 'tweak-label';
        label.textContent = dev.device;

        const activeVal = document.createElement('span');
        activeVal.className = 'tweak-val';
        activeVal.style.fontSize = '0.85em';
        activeVal.style.color = 'var(--md-sys-color-primary)';
        activeVal.style.textTransform = 'none';
        activeVal.style.fontWeight = 'normal';
        activeVal.textContent = dev.active || 'none';

        header.appendChild(label);
        header.appendChild(activeVal);
        row.appendChild(header);

        // Schedulers List (Chips)
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'option-grid small-grid'; // Reusing grid style

        const algos = (dev.available || '').split(',');
        algos.forEach(algo => {
            if (!algo) return;
            const btn = document.createElement('button');
            btn.className = 'option-btn small-btn'; // Add small-btn style
            btn.textContent = algo;

            if (algo === ioschedPendingState[dev.device]) {
                btn.classList.add('selected');
            }

            btn.onclick = () => {
                ioschedPendingState[dev.device] = algo;
                updateIoPendingIndicator();
                renderIoCard();
            };
            chipsContainer.appendChild(btn);
        });

        row.appendChild(chipsContainer);

        container.appendChild(row);
    });

    updateIoPendingIndicator();
}

// Update Indicator
function updateIoPendingIndicator() {
    const indicator = document.getElementById('iosched-pending-indicator');
    if (!indicator) return;

    let hasPending = false;
    for (const dev of ioschedDevices) {
        // Compare pending vs saved (or initial active)
        const saved = ioschedSavedState[dev.device] || dev.active;
        if (ioschedPendingState[dev.device] !== saved) {
            hasPending = true;
            break;
        }
    }

    if (hasPending) indicator.classList.remove('hidden');
    else indicator.classList.add('hidden');
}

// Save I/O
async function saveIoScheduler() {
    const args = [];
    Object.keys(ioschedPendingState).forEach(dev => {
        args.push(`${dev}=${ioschedPendingState[dev]}`);
    });

    const result = await runIoBackend('save', ...args);
    if (result && result.includes('saved')) {
        showToast('I/O settings saved');
        ioschedSavedState = { ...ioschedPendingState };
        updateIoPendingIndicator();
    } else {
        showToast('Failed to save I/O settings', true);
    }
}

// Apply I/O
async function applyIoScheduler() {
    const args = [];
    Object.keys(ioschedPendingState).forEach(dev => {
        args.push(`${dev}=${ioschedPendingState[dev]}`);
    });

    const result = await runIoBackend('apply', ...args);
    if (result && result.includes('applied')) {
        showToast('I/O settings applied');
        // Reload real state to confirm
        const currentOutput = await runIoBackend('get_all');
        ioschedDevices = parseIoSchedulerOutput(currentOutput);
        renderIoCard();
    } else {
        showToast('Failed to apply I/O settings', true);
    }
}

// Init I/O Tweak
function initIoSchedulerTweak() {
    const btnSave = document.getElementById('iosched-btn-save');
    const btnApply = document.getElementById('iosched-btn-apply');
    const btnSaveApply = document.getElementById('iosched-btn-save-apply');

    if (btnSave) btnSave.addEventListener('click', saveIoScheduler);
    if (btnApply) btnApply.addEventListener('click', applyIoScheduler);
    if (btnSaveApply) btnSaveApply.addEventListener('click', async () => {
        await saveIoScheduler();
        await applyIoScheduler();
    });

    loadIoSchedulerState();

    // Register
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('iosched', {
            getState: () => ({ ...ioschedPendingState }),
            setState: (config) => {
                ioschedPendingState = { ...config };
                renderIoCard();
            },
            render: renderIoCard,
            save: saveIoScheduler,
            apply: applyIoScheduler
        });
    }
}

// =============================================================================
// THERMAL MODE (Floppy1280 only)
// =============================================================================

let thermalCurrentState = {};
let thermalSavedState = {};
let thermalPendingState = {};
let thermalAvailable = false;

// Mode descriptions for display
const THERMAL_MODE_NAMES = {
    '0': 'Disabled',
    '1': 'Stock',
    '2': 'Custom',
    '3': 'Performance'
};

// Run Thermal backend
async function runThermalBackend(action, ...args) {
    const scriptPath = '/data/adb/modules/floppy_companion/tweaks/thermal.sh';
    let cmd = `sh "${scriptPath}" ${action}`;
    if (args.length > 0) {
        cmd += ' "' + args.join('" "') + '"';
    }
    return await exec(cmd);
}

// Check if thermal control is available (Floppy1280)
async function checkThermalAvailable() {
    const output = await runThermalBackend('is_available');
    const parsed = parseKeyValue(output);
    return parsed.available === '1';
}

// Load Thermal state
async function loadThermalState() {
    try {
        thermalAvailable = await checkThermalAvailable();

        if (!thermalAvailable) {
            return;
        }

        const currentOutput = await runThermalBackend('get_current');
        const savedOutput = await runThermalBackend('get_saved');

        thermalCurrentState = parseKeyValue(currentOutput);
        thermalSavedState = parseKeyValue(savedOutput);

        // Sanitize saved state
        Object.keys(thermalSavedState).forEach(key => {
            if (thermalSavedState[key] === '') delete thermalSavedState[key];
        });

        // Initialize pending state
        thermalPendingState = {
            mode: thermalSavedState.mode || thermalCurrentState.mode || '1',
            custom_freq: thermalSavedState.custom_freq || thermalCurrentState.custom_freq || ''
        };

        // Show platform tweaks section and thermal card
        const platformSection = document.getElementById('platform-tweaks-section');
        const thermalCard = document.getElementById('thermal-card');
        if (platformSection) platformSection.classList.remove('hidden');
        if (thermalCard) thermalCard.classList.remove('hidden');

        renderThermalCard();
    } catch (e) {
        console.error('Failed to load thermal state:', e);
    }
}

// Render Thermal card UI
function renderThermalCard() {
    const modeVal = document.getElementById('thermal-val-mode');
    const customFreqVal = document.getElementById('thermal-val-custom_freq');
    const modeOptions = document.getElementById('thermal-mode-options');
    const customFreqRow = document.getElementById('thermal-custom-freq-row');
    const customFreqInput = document.getElementById('thermal-custom_freq');

    // Update current value display
    if (modeVal) {
        const modeName = THERMAL_MODE_NAMES[thermalCurrentState.mode] || thermalCurrentState.mode || '--';
        const modeNum = thermalCurrentState.mode;
        modeVal.textContent = modeNum !== undefined && modeNum !== '' ? `${modeName} - ${modeNum}` : modeName;
    }

    if (customFreqVal && thermalCurrentState.custom_freq) {
        customFreqVal.textContent = thermalCurrentState.custom_freq;
    }

    // Update mode selection buttons
    if (modeOptions) {
        modeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.mode === thermalPendingState.mode) {
                btn.classList.add('selected');
            }
        });
    }

    // Show/hide custom frequency row based on mode
    if (customFreqRow) {
        if (thermalPendingState.mode === '2') {
            customFreqRow.classList.remove('hidden');
        } else {
            customFreqRow.classList.add('hidden');
        }
    }

    // Update custom frequency input
    if (customFreqInput && thermalPendingState.custom_freq) {
        customFreqInput.value = thermalPendingState.custom_freq;
    }

    // Update mode description
    const descEl = document.getElementById('thermal-mode-description');
    if (descEl) {
        const descKey = `tweaks.thermal.desc${thermalPendingState.mode}`;
        const descText = window.t ? window.t(descKey) : '';

        if (thermalPendingState.mode === '0') {
            // Mode 0 gets warning icon and bold DANGEROUS text
            const warnText = window.t ? window.t('tweaks.thermal.desc0Warn') : 'DANGEROUS!';
            descEl.innerHTML = `<span class="warning-text"><svg class="warning-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg><strong>${warnText}</strong></span> ${descText}`;
        } else {
            descEl.textContent = descText;
        }
    }

    updateThermalPendingIndicator();
}

// Update pending indicator
function updateThermalPendingIndicator() {
    const indicator = document.getElementById('thermal-pending-indicator');
    if (!indicator) return;

    // If no saved config exists yet, compare against current kernel state (no "unsaved" on first load)
    const hasSavedConfig = thermalSavedState.mode !== undefined && thermalSavedState.mode !== '';
    const referenceMode = hasSavedConfig ? thermalSavedState.mode : thermalCurrentState.mode;
    const referenceFreq = hasSavedConfig ? (thermalSavedState.custom_freq || '') : (thermalCurrentState.custom_freq || '');

    const hasChanges = thermalPendingState.mode !== referenceMode ||
        (thermalPendingState.mode === '2' && thermalPendingState.custom_freq !== referenceFreq);

    if (hasChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Select thermal mode
function selectThermalMode(mode) {
    thermalPendingState.mode = mode;
    renderThermalCard();
}

// Save thermal config
async function saveThermal() {
    const mode = thermalPendingState.mode;
    const customFreq = thermalPendingState.custom_freq || '';

    await runThermalBackend('save', mode, customFreq);

    // Update saved state
    thermalSavedState.mode = mode;
    thermalSavedState.custom_freq = customFreq;

    updateThermalPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

// Apply thermal config
async function applyThermal() {
    const mode = thermalPendingState.mode;
    const customFreq = thermalPendingState.custom_freq || '';

    await runThermalBackend('apply', mode, customFreq);

    // Refresh current state
    const currentOutput = await runThermalBackend('get_current');
    thermalCurrentState = parseKeyValue(currentOutput);

    renderThermalCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

// Initialize Thermal tweak UI
function initThermalTweak() {
    loadThermalState();

    // Wire up mode option buttons
    const modeOptions = document.getElementById('thermal-mode-options');
    if (modeOptions) {
        modeOptions.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectThermalMode(btn.dataset.mode);
            });
        });
    }

    // Wire up custom frequency input
    const customFreqInput = document.getElementById('thermal-custom_freq');
    if (customFreqInput) {
        customFreqInput.addEventListener('input', (e) => {
            thermalPendingState.custom_freq = e.target.value;
            updateThermalPendingIndicator();
        });
    }

    // Wire up action buttons
    const saveBtn = document.getElementById('thermal-btn-save');
    const applyBtn = document.getElementById('thermal-btn-apply');
    const saveApplyBtn = document.getElementById('thermal-btn-save-apply');

    if (saveBtn) saveBtn.addEventListener('click', saveThermal);
    if (applyBtn) applyBtn.addEventListener('click', applyThermal);
    if (saveApplyBtn) saveApplyBtn.addEventListener('click', async () => {
        await saveThermal();
        await applyThermal();
    });

    // Re-render on language change to update description text
    document.addEventListener('languageChanged', () => {
        if (thermalAvailable) {
            renderThermalCard();
        }
    });

    // Register with preset system
    if (typeof registerTweak === 'function') {
        registerTweak('thermal', {
            getState: () => ({ ...thermalPendingState }),
            setState: (config) => {
                thermalPendingState = { ...config };
                renderThermalCard();
            },
            render: renderThermalCard,
            save: saveThermal,
            apply: applyThermal
        });
    }
}

// --- Misc Floppy1280 Tweaks Logic ---

let miscCurrentState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscSavedState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };
let miscPendingState = { block_ed3: '0', gpu_clklck: '0', gpu_unlock: '0' };

async function runMiscBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/misc.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Misc backend error (${action}):`, error);
        return '';
    }
}

function getEnabledDisabledText(val) {
    if (val === '1') {
        return window.t ? window.t('tweaks.misc.enabled') : 'Enabled';
    }
    return window.t ? window.t('tweaks.misc.disabled') : 'Disabled';
}

function renderMiscCard() {
    // Update value labels from current state
    const valBlocked3 = document.getElementById('misc-val-blocked3');
    const valGpuClkLck = document.getElementById('misc-val-gpuclklck');
    const valGpuUnlock = document.getElementById('misc-val-gpuunlock');

    if (valBlocked3) valBlocked3.textContent = getEnabledDisabledText(miscCurrentState.block_ed3);
    if (valGpuClkLck) valGpuClkLck.textContent = getEnabledDisabledText(miscCurrentState.gpu_clklck);
    if (valGpuUnlock) valGpuUnlock.textContent = getEnabledDisabledText(miscCurrentState.gpu_unlock);

    // Update switches from pending state
    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    if (blockEd3Switch) blockEd3Switch.checked = (miscPendingState.block_ed3 === '1');
    if (gpuClkLckSwitch) gpuClkLckSwitch.checked = (miscPendingState.gpu_clklck === '1');
    if (gpuUnlockSwitch) gpuUnlockSwitch.checked = (miscPendingState.gpu_unlock === '1');

    updateMiscPendingIndicator();
    updateGpuUnlockAvailability();
}

function updateMiscPendingIndicator() {
    const indicator = document.getElementById('misc-pending-indicator');
    if (!indicator) return;

    const hasChanges =
        miscPendingState.block_ed3 !== miscSavedState.block_ed3 ||
        miscPendingState.gpu_clklck !== miscSavedState.gpu_clklck ||
        miscPendingState.gpu_unlock !== miscSavedState.gpu_unlock;

    if (hasChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function updateGpuUnlockAvailability() {
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');
    if (!gpuUnlockSwitch) return;

    // Get current superfloppy mode (from features.js)
    // Modes 1, 2, 3 are OC modes; 4, 5, 0 are not
    const superfloppyMode = window.currentSuperfloppyMode || '0';
    const isOcMode = ['1', '2', '3'].includes(superfloppyMode);

    const switchContainer = gpuUnlockSwitch.closest('.tweak-switch-container');

    if (!isOcMode) {
        gpuUnlockSwitch.disabled = true;
        if (switchContainer) switchContainer.style.opacity = '0.5';
    } else {
        gpuUnlockSwitch.disabled = false;
        if (switchContainer) switchContainer.style.opacity = '1';
    }
}

async function loadMiscState() {
    // Get current kernel state
    const currentOutput = await runMiscBackend('get_current');
    const current = parseKeyValue(currentOutput);
    miscCurrentState = {
        block_ed3: current.block_ed3 || '0',
        gpu_clklck: current.gpu_clklck || '0',
        gpu_unlock: current.gpu_unlock || '0'
    };

    // Get saved config
    const savedOutput = await runMiscBackend('get_saved');
    const saved = parseKeyValue(savedOutput);
    miscSavedState = {
        block_ed3: saved.block_ed3 || '0',
        gpu_clklck: saved.gpu_clklck || '0',
        gpu_unlock: saved.gpu_unlock || '0'
    };

    // Pending starts from saved
    miscPendingState = { ...miscSavedState };

    renderMiscCard();
}

async function saveMisc() {
    await runMiscBackend('save', 'block_ed3', miscPendingState.block_ed3);
    await runMiscBackend('save', 'gpu_clklck', miscPendingState.gpu_clklck);
    await runMiscBackend('save', 'gpu_unlock', miscPendingState.gpu_unlock);
    miscSavedState = { ...miscPendingState };
    updateMiscPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Saved');
}

async function applyMisc() {
    await runMiscBackend('apply', 'block_ed3', miscPendingState.block_ed3);
    await runMiscBackend('apply', 'gpu_clklck', miscPendingState.gpu_clklck);

    // GPU Unlock needs special handling - check if it stuck
    const result = await runMiscBackend('apply', 'gpu_unlock', miscPendingState.gpu_unlock);
    const match = result.match(/applied=(\d)/);
    if (match) {
        miscCurrentState.gpu_unlock = match[1];
        if (match[1] !== miscPendingState.gpu_unlock) {
            // Reset pending to match actual
            miscPendingState.gpu_unlock = match[1];
        }
    }

    // Update current state
    miscCurrentState.block_ed3 = miscPendingState.block_ed3;
    miscCurrentState.gpu_clklck = miscPendingState.gpu_clklck;

    renderMiscCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
}

function initMiscTweak() {
    const miscCard = document.getElementById('misc-card');
    if (!miscCard) return;

    // Only show on Floppy1280
    if (window.KERNEL_NAME !== 'Floppy1280') {
        miscCard.classList.add('hidden');
        return;
    }

    // Show card
    miscCard.classList.remove('hidden');

    const blockEd3Switch = document.getElementById('misc-blocked3-switch');
    const gpuClkLckSwitch = document.getElementById('misc-gpuclklck-switch');
    const gpuUnlockSwitch = document.getElementById('misc-gpuunlock-switch');

    // Switch change handlers - update pending state only
    if (blockEd3Switch) {
        blockEd3Switch.addEventListener('change', (e) => {
            miscPendingState.block_ed3 = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    if (gpuClkLckSwitch) {
        gpuClkLckSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_clklck = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    if (gpuUnlockSwitch) {
        gpuUnlockSwitch.addEventListener('change', (e) => {
            miscPendingState.gpu_unlock = e.target.checked ? '1' : '0';
            updateMiscPendingIndicator();
        });
    }

    // Button handlers
    document.getElementById('misc-btn-save')?.addEventListener('click', saveMisc);
    document.getElementById('misc-btn-apply')?.addEventListener('click', applyMisc);
    document.getElementById('misc-btn-save-apply')?.addEventListener('click', async () => {
        await saveMisc();
        await applyMisc();
    });

    // Load initial state
    loadMiscState();

    // Listen for superfloppy mode changes
    document.addEventListener('superfloppyModeChanged', () => {
        updateGpuUnlockAvailability();
    });

    // Language change listener
    document.addEventListener('languageChanged', () => {
        renderMiscCard();
    });
}

// Initialize platform tweaks
function initPlatformTweaks() {
    initThermalTweak();
    initUndervoltTweak();
    initMiscTweak();
}

// --- Undervolt Tweak Logic (Floppy1280 only) ---

let undervoltAvailable = false;
let undervoltCurrentState = { little: '0', big: '0', gpu: '0' };
let undervoltSavedState = { little: '0', big: '0', gpu: '0' }; // From config file
let undervoltPendingState = { little: '0', big: '0', gpu: '0' };

// Helper: Stop propagation of touch events to prevent page swipe
function preventSwipePropagation(element) {
    if (!element) return;
    const stopProp = (e) => e.stopPropagation();
    element.addEventListener('touchstart', stopProp, { passive: true });
    element.addEventListener('touchmove', stopProp, { passive: true });
}

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

        const val = undervoltPendingState[el] || '0';

        // Update display values
        if (valEl) valEl.textContent = val + '%';
        sliderEl.value = val;
        inputEl.value = val;

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
    // We use percentages for x position.
    // Stroke width 1px.
    // vector-effect='non-scaling-stroke' ensures 1px width regardless of scaling?
    // Actually, simple rects might be safer if we control the viewbox.
    // Let's use simple lines with x1=percentage x2=percentage.
    // But width need to be 1px screen pixels. 
    // If we use vector-effect="non-scaling-stroke", the stroke remains 1 unit of user coordinate system if not scaled?
    // No, non-scaling-stroke means visual stroke width is constant.

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
                renderUndervoltCard(); // Changed from updateUndervoltPendingUI
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
                renderUndervoltCard(); // Changed from updateUndervoltPendingUI
            });
        }
    });

    const unlockSwitch = document.getElementById('undervolt-unlock-switch');
    if (unlockSwitch) {
        unlockSwitch.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Show MD3 confirmation modal
                const confirmed = await showConfirmModal({
                    title: t('tweaks.undervolt.unlockConfirmTitle') || 'Unlock Full Range?',
                    body: t('tweaks.undervolt.unlockConfirmBody') || 'Values beyond 15% have no practical use and may cause severe system instability. Are you sure you want to unlock the full range?',
                    confirmText: t('modal.unlock') || 'Unlock',
                    cancelText: t('modal.cancel') || 'Cancel',
                    icon: '<svg viewBox="0 0 24 24" width="48" height="48"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/></svg>',
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
}

// Export globally
window.initPlatformTweaks = initPlatformTweaks;

// Auto-init only for general tweaks
// Platform tweaks are initialized by main.js after device detection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTweaksTab();
    });
} else {
    initTweaksTab();
}
