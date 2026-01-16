// ZRAM Tweak

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
    if (btnSaveApply) btnSaveApply.addEventListener('click', async () => {
        await saveZram();
        await applyZram();
    });

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
