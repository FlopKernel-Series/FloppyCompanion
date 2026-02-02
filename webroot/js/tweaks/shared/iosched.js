// I/O Scheduler Tweak

let ioschedDevices = []; // Array of {name, active, available}
let ioschedSavedState = {};
let ioschedPendingState = {};
let ioschedReferenceState = {};

const runIoBackend = (...args) => window.runTweakBackend('iosched', ...args);

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
        const defIo = window.getDefaultTweakPreset('iosched');
        const { reference } = window.resolveTweakReference({}, ioschedSavedState, defIo);
        ioschedReferenceState = { ...reference };

        ioschedPendingState = {};
        ioschedDevices.forEach(d => {
            const fallback = ioschedReferenceState[d.device] || d.active;
            ioschedPendingState[d.device] = ioschedSavedState[d.device] || fallback;
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
    let hasPending = false;
    for (const dev of ioschedDevices) {
        // Compare pending vs saved (or initial active)
        const reference = ioschedReferenceState[dev.device] || dev.active;
        if (ioschedPendingState[dev.device] !== reference) {
            hasPending = true;
            break;
        }
    }

    window.setPendingIndicator('iosched-pending-indicator', hasPending);
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
        ioschedReferenceState = { ...ioschedSavedState };
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
    window.bindSaveApplyButtons('iosched', saveIoScheduler, applyIoScheduler);

    loadIoSchedulerState();

    // Register
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('iosched', {
            getState: () => ({ ...ioschedPendingState }),
            setState: (config) => {
                ioschedPendingState = { ...ioschedPendingState, ...config };
                renderIoCard();
            },
            render: renderIoCard,
            save: saveIoScheduler,
            apply: applyIoScheduler
        });
    }
}
