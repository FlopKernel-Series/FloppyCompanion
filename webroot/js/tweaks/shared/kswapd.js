// kswapd.js - KSWAPD Configuration Tweak

let kswapdAvailable = false;
let kswapdCapabilities = { threads: '0', affinity: '0', max_cpus: '8' };
let kswapdCurrentState = { threads: '1', affinity: '0x7f', max_cpus: '8' };
let kswapdSavedState = {};
let kswapdPendingState = { threads: '1', affinity: '0x7f' };
let kswapdReferenceState = { threads: '1', affinity: '0x7f' };
let kswapdDefaultState = { threads: '1', affinity: '0x7f' };

const runKswapdBackend = (...args) => window.runTweakBackend('kswapd', ...args);

function getMaxKswapdCpus() {
    const raw = kswapdCapabilities.max_cpus || kswapdCurrentState.max_cpus || '8';
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function parseCpumask(val) {
    if (val === undefined || val === null || val === '') {
        const maxCpus = getMaxKswapdCpus();
        return (1 << maxCpus) - 1;
    }
    const str = String(val).trim();
    if (str.startsWith('0x') || str.startsWith('0X')) {
        const parsed = parseInt(str, 16);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = parseInt(str, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCpumaskHex(mask) {
    const n = typeof mask === 'number' ? mask : parseCpumask(mask);
    return '0x' + n.toString(16);
}

function formatCpumaskBinary(mask, maxCpus) {
    const n = typeof mask === 'number' ? mask : parseCpumask(mask);
    const bits = maxCpus || getMaxKswapdCpus();
    return (n >>> 0).toString(2).padStart(bits, '0');
}

function formatAffinityDisplay(maskVal, maxCpus) {
    const mask = parseCpumask(maskVal);
    const bits = maxCpus || getMaxKswapdCpus();
    const hex = formatCpumaskHex(mask);
    const bin = formatCpumaskBinary(mask, bits);
    return `${hex} (${bin})`;
}

function formatThreadsDisplay(threadsVal) {
    const n = parseInt(threadsVal, 10) || 1;
    if (window.t) {
        const singularPattern = window.t('tweaks.kswapd.threadSingular') || '{count} thread';
        const pluralPattern = window.t('tweaks.kswapd.threadPlural') || '{count} threads';
        return (n === 1 ? singularPattern : pluralPattern).replace('{count}', String(n));
    }
    return `${n} ${n === 1 ? 'thread' : 'threads'}`;
}

function updateKswapdSliderTicks(slider, maxCpus) {
    if (!slider) return;
    const sliderShell = slider.closest('.tweak-beer-slider') || slider;
    const color = getComputedStyle(document.body).getPropertyValue('--md-sys-color-outline').trim() || '#747775';
    const ticks = maxCpus > 1 ? maxCpus : 2;

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

async function checkKswapdAvailable() {
    const [availabilityOutput, capabilitiesOutput] = await Promise.all([
        runKswapdBackend('is_available'),
        runKswapdBackend('get_capabilities')
    ]);

    kswapdAvailable = (availabilityOutput === 'available=1');
    kswapdCapabilities = { ...kswapdCapabilities, ...parseKeyValue(capabilitiesOutput) };
    return kswapdAvailable;
}

async function loadKswapdState() {
    try {
        const available = await checkKswapdAvailable();
        const card = document.getElementById('kswapd-card');

        if (!available) {
            if (card) card.classList.add('hidden');
            return;
        }

        if (card) card.classList.remove('hidden');

        const { current, saved } = await window.loadTweakState('kswapd');
        kswapdCurrentState = { threads: '1', affinity: '0x7f', max_cpus: '8', ...current };
        kswapdDefaultState = { ...window.getDefaultTweakPreset('kswapd') };
        kswapdSavedState = window.buildSparseStateAgainstDefaults(saved, kswapdDefaultState);

        const effective = window.initPendingState(kswapdCurrentState, kswapdSavedState, kswapdDefaultState);
        kswapdPendingState = {
            threads: String(effective.threads || kswapdCurrentState.threads || '1'),
            affinity: formatCpumaskHex(parseCpumask(effective.affinity || kswapdCurrentState.affinity || '0x7f'))
        };
        kswapdReferenceState = { ...kswapdPendingState };

        renderKswapdCard();
    } catch (e) {
        console.error('Failed to load KSWAPD state:', e);
    }
}
window.loadKswapdState = loadKswapdState;

function renderKswapdCard() {
    const maxCpus = getMaxKswapdCpus();

    // Toggle capability-based sections
    const threadsContainer = document.getElementById('kswapd-container-threads');
    if (threadsContainer) {
        threadsContainer.classList.toggle('hidden', kswapdCapabilities.threads === '0');
    }

    const affinitySection = document.getElementById('kswapd-section-affinity');
    if (affinitySection) {
        affinitySection.classList.toggle('hidden', kswapdCapabilities.affinity === '0');
    }

    // 1. Thread Count Controls
    const slider = document.getElementById('kswapd-slider-threads');
    const input = document.getElementById('kswapd-input-threads');
    const valThreads = document.getElementById('kswapd-val-threads');

    const pendingThreads = window.getTweakPendingValue(
        'threads',
        kswapdPendingState,
        kswapdReferenceState,
        kswapdDefaultState,
        kswapdCurrentState,
        '1'
    );

    if (slider) {
        slider.min = '1';
        slider.max = String(maxCpus);
        slider.value = pendingThreads;
        updateKswapdSliderTicks(slider, maxCpus);
    }

    if (input) {
        input.min = '1';
        input.max = String(maxCpus);
        const { placeholder, value } = window.getTweakTextInputState(
            'threads',
            kswapdPendingState,
            kswapdSavedState,
            kswapdReferenceState,
            kswapdDefaultState,
            kswapdCurrentState,
            '1'
        );
        input.placeholder = placeholder;
        input.value = value;
    }

    if (valThreads) {
        valThreads.textContent = formatThreadsDisplay(kswapdCurrentState.threads || '1');
    }

    // 2. CPU Affinity Chips
    const valAffinity = document.getElementById('kswapd-val-affinity');
    if (valAffinity) {
        valAffinity.textContent = formatAffinityDisplay(kswapdCurrentState.affinity || '0x7f', maxCpus);
    }

    const chipsContainer = document.getElementById('kswapd-cpu-chips');
    if (chipsContainer) {
        const pendingMask = parseCpumask(
            window.getTweakPendingValue(
                'affinity',
                kswapdPendingState,
                kswapdReferenceState,
                kswapdDefaultState,
                kswapdCurrentState,
                '0x7f'
            )
        );

        chipsContainer.innerHTML = '';

        for (let i = 0; i < maxCpus; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-btn chip medium';
            btn.dataset.cpu = String(i);
            btn.textContent = `CPU ${i}`;

            const isSelected = ((pendingMask >> i) & 1) === 1;
            if (isSelected) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', () => {
                const currentMask = parseCpumask(kswapdPendingState.affinity);
                const bit = 1 << i;
                const newMask = currentMask ^ bit;

                if (newMask === 0) {
                    const warnMsg = window.t
                        ? window.t('tweaks.kswapd.minOneCpu')
                        : 'At least one CPU must be selected';
                    window.showToast(warnMsg, true);
                    return;
                }

                kswapdPendingState.affinity = formatCpumaskHex(newMask);
                renderKswapdCard();
            });

            chipsContainer.appendChild(btn);
        }
    }

    // 3. Active Values Summary
    const currentThreads = document.getElementById('kswapd-current-threads');
    if (currentThreads) {
        currentThreads.textContent = formatThreadsDisplay(kswapdCurrentState.threads || '1');
    }

    const currentAffinity = document.getElementById('kswapd-current-affinity');
    if (currentAffinity) {
        currentAffinity.textContent = formatAffinityDisplay(kswapdCurrentState.affinity || '0x7f', maxCpus);
    }

    updateKswapdPendingIndicator();
}

function updateKswapdPendingIndicator() {
    const pendingThreads = window.getTweakPendingValue(
        'threads',
        kswapdPendingState,
        kswapdReferenceState,
        kswapdDefaultState,
        kswapdCurrentState,
        '1'
    );
    const refThreads = window.getTweakReferenceValue(
        'threads',
        kswapdReferenceState,
        kswapdDefaultState,
        kswapdCurrentState,
        '1'
    );

    const pendingAffinityMask = parseCpumask(
        window.getTweakPendingValue(
            'affinity',
            kswapdPendingState,
            kswapdReferenceState,
            kswapdDefaultState,
            kswapdCurrentState,
            '0x7f'
        )
    );
    const refAffinityMask = parseCpumask(
        window.getTweakReferenceValue(
            'affinity',
            kswapdReferenceState,
            kswapdDefaultState,
            kswapdCurrentState,
            '0x7f'
        )
    );

    const hasPending = (pendingThreads !== refThreads) || (pendingAffinityMask !== refAffinityMask);
    window.setPendingIndicator('kswapd-pending-indicator', hasPending);
}

function getNormalizedKswapdPendingState() {
    return window.resolveBlankTweakFields(
        kswapdPendingState,
        { threads: { id: 'kswapd-input-threads', fallback: '1' } },
        kswapdCurrentState,
        kswapdDefaultState
    );
}

async function saveKswapd() {
    const normalized = getNormalizedKswapdPendingState();
    const sparseState = window.buildSparseStateAgainstDefaults(normalized, kswapdDefaultState);

    const result = await runKswapdBackend(
        'save',
        ...Object.entries(sparseState).map(([k, v]) => `${k}=${v}`)
    );

    if (result && result.includes('saved')) {
        kswapdSavedState = { ...sparseState };
        kswapdReferenceState = window.initPendingState(kswapdCurrentState, kswapdSavedState, kswapdDefaultState);
        kswapdPendingState = { ...kswapdReferenceState };
        showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
        renderKswapdCard();
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to save settings', true);
    }
}

async function applyKswapd() {
    const normalized = getNormalizedKswapdPendingState();
    const maxCpus = getMaxKswapdCpus();
    const threads = String(Math.max(1, Math.min(maxCpus, parseInt(normalized.threads || '1', 10) || 1)));
    const affinity = formatCpumaskHex(parseCpumask(normalized.affinity || '0x7f'));

    const result = await runKswapdBackend('apply', `threads=${threads}`, `affinity=${affinity}`);

    if (result && result.includes('applied')) {
        const currentOutput = await runKswapdBackend('get_current');
        kswapdCurrentState = { threads: '1', affinity: '0x7f', max_cpus: '8', ...parseKeyValue(currentOutput) };
        showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
        renderKswapdCard();
    } else {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
    }
}

function initKswapdTweak() {
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('kswapd', {
            getState: () => getNormalizedKswapdPendingState(),
            setState: (config) => {
                kswapdPendingState = { ...kswapdPendingState, ...(config || {}) };
                renderKswapdCard();
            },
            render: renderKswapdCard,
            save: saveKswapd,
            apply: applyKswapd
        });
    }

    const slider = document.getElementById('kswapd-slider-threads');
    const input = document.getElementById('kswapd-input-threads');

    if (slider) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(slider);
        slider.addEventListener('input', (e) => {
            kswapdPendingState.threads = String(e.target.value || '1');
            renderKswapdCard();
        });
    }

    if (input) {
        if (window.preventSwipePropagation) window.preventSwipePropagation(input);
        input.addEventListener('change', (e) => {
            if (e.target.value === '') {
                kswapdPendingState.threads = window.getTweakDefaultValue(
                    'threads',
                    kswapdCurrentState,
                    kswapdDefaultState,
                    '1'
                );
                renderKswapdCard();
                return;
            }

            const maxCpus = getMaxKswapdCpus();
            let val = parseInt(e.target.value, 10) || 1;
            if (val < 1) val = 1;
            if (val > maxCpus) val = maxCpus;

            kswapdPendingState.threads = String(val);
            renderKswapdCard();
        });
    }

    window.bindSaveApplyButtons('kswapd', saveKswapd, applyKswapd);

    loadKswapdState();

    document.addEventListener('languageChanged', () => {
        if (kswapdAvailable) renderKswapdCard();
    });
}
window.initKswapdTweak = initKswapdTweak;
