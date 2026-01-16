// Sound Control Tweak

let scCurrentState = { hp_l: '0', hp_r: '0', mic: '0' };
let scSavedState = { hp_l: '0', hp_r: '0', mic: '0' };
let scPendingState = { hp_l: '0', hp_r: '0', mic: '0' };
let scSplitMode = false;

async function runSoundControlBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/soundcontrol.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`SoundControl backend error (${action}):`, error);
        return '';
    }
}

function renderSoundControlCard() {
    // Update value labels from current state
    const valHp = document.getElementById('soundcontrol-val-hp');
    const valHpL = document.getElementById('soundcontrol-val-hp-l');
    const valHpR = document.getElementById('soundcontrol-val-hp-r');
    const valMic = document.getElementById('soundcontrol-val-mic');

    if (valHp) valHp.textContent = scCurrentState.hp_l + ' dB';
    if (valHpL) valHpL.textContent = scCurrentState.hp_l + ' dB';
    if (valHpR) valHpR.textContent = scCurrentState.hp_r + ' dB';
    if (valMic) valMic.textContent = scCurrentState.mic + ' dB';

    // Update sliders/inputs from pending state
    const sliderHp = document.getElementById('soundcontrol-slider-hp');
    const inputHp = document.getElementById('soundcontrol-input-hp');
    const sliderHpL = document.getElementById('soundcontrol-slider-hp-l');
    const inputHpL = document.getElementById('soundcontrol-input-hp-l');
    const sliderHpR = document.getElementById('soundcontrol-slider-hp-r');
    const inputHpR = document.getElementById('soundcontrol-input-hp-r');
    const sliderMic = document.getElementById('soundcontrol-slider-mic');
    const inputMic = document.getElementById('soundcontrol-input-mic');

    // In combined mode, use hp_l value for the combined slider
    if (sliderHp) sliderHp.value = scPendingState.hp_l;
    if (inputHp) inputHp.value = scPendingState.hp_l;
    if (sliderHpL) sliderHpL.value = scPendingState.hp_l;
    if (inputHpL) inputHpL.value = scPendingState.hp_l;
    if (sliderHpR) sliderHpR.value = scPendingState.hp_r;
    if (inputHpR) inputHpR.value = scPendingState.hp_r;
    if (sliderMic) sliderMic.value = scPendingState.mic;
    if (inputMic) inputMic.value = scPendingState.mic;

    updateSoundControlPendingIndicator();
}

function updateSoundControlPendingIndicator() {
    const indicator = document.getElementById('soundcontrol-pending-indicator');
    if (!indicator) return;

    const hasChanges =
        scPendingState.hp_l !== scSavedState.hp_l ||
        scPendingState.hp_r !== scSavedState.hp_r ||
        scPendingState.mic !== scSavedState.mic;

    if (hasChanges) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function toggleSoundControlSplitMode(split) {
    scSplitMode = split;
    const hpCombined = document.getElementById('soundcontrol-hp-combined');
    const hpLeft = document.getElementById('soundcontrol-hp-left');
    const hpRight = document.getElementById('soundcontrol-hp-right');

    if (split) {
        if (hpCombined) hpCombined.classList.add('hidden');
        if (hpLeft) hpLeft.classList.remove('hidden');
        if (hpRight) hpRight.classList.remove('hidden');
    } else {
        if (hpCombined) hpCombined.classList.remove('hidden');
        if (hpLeft) hpLeft.classList.add('hidden');
        if (hpRight) hpRight.classList.add('hidden');
        // When going back to combined, sync hp_r to hp_l
        scPendingState.hp_r = scPendingState.hp_l;
    }
    renderSoundControlCard();
}

async function loadSoundControlState() {
    const currentOutput = await runSoundControlBackend('get_current');
    const current = parseKeyValue(currentOutput);
    scCurrentState = {
        hp_l: current.hp_l || '0',
        hp_r: current.hp_r || '0',
        mic: current.mic || '0'
    };

    const savedOutput = await runSoundControlBackend('get_saved');
    const saved = parseKeyValue(savedOutput);
    scSavedState = {
        hp_l: saved.hp_l || '0',
        hp_r: saved.hp_r || '0',
        mic: saved.mic || '0'
    };

    scPendingState = { ...scSavedState };

    // Check if L and R are different - if so, enable split mode
    if (scPendingState.hp_l !== scPendingState.hp_r) {
        const splitSwitch = document.getElementById('soundcontrol-split-switch');
        if (splitSwitch) splitSwitch.checked = true;
        toggleSoundControlSplitMode(true);
    }

    renderSoundControlCard();
}

async function saveSoundControl() {
    await runSoundControlBackend('save', scPendingState.hp_l, scPendingState.hp_r, scPendingState.mic);
    scSavedState = { ...scPendingState };
    updateSoundControlPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Saved');
}

async function applySoundControl() {
    await runSoundControlBackend('apply', scPendingState.hp_l, scPendingState.hp_r, scPendingState.mic);

    // Refresh only current kernel state so active values update,
    // but do NOT reset pending state back to saved.
    const currentOutput = await runSoundControlBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    scCurrentState = {
        hp_l: current.hp_l || '0',
        hp_r: current.hp_r || '0',
        mic: current.mic || '0'
    };

    renderSoundControlCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
}

function updateSoundControlSliderTicks(slider) {
    if (!slider) return;
    const color = getComputedStyle(document.body).getPropertyValue('--md-sys-color-outline').trim() || '#747775';
    const ticks = 21; // 0-20 = 21 ticks

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
    slider.style.setProperty('--track-ticks', encoded);
}

function initSoundControlTweak() {
    const card = document.getElementById('soundcontrol-card');
    if (!card) return;

    // Only show on FloppyTrinketMi
    if (window.KERNEL_NAME !== 'FloppyTrinketMi') {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');

    // Split mode toggle
    const splitSwitch = document.getElementById('soundcontrol-split-switch');
    if (splitSwitch) {
        splitSwitch.addEventListener('change', (e) => {
            toggleSoundControlSplitMode(e.target.checked);
        });
    }

    // Combined headphone slider
    const sliderHp = document.getElementById('soundcontrol-slider-hp');
    const inputHp = document.getElementById('soundcontrol-input-hp');

    function syncCombinedHp(val) {
        val = Math.max(0, Math.min(20, parseInt(val) || 0));
        scPendingState.hp_l = String(val);
        scPendingState.hp_r = String(val);
        if (sliderHp) sliderHp.value = val;
        if (inputHp) inputHp.value = val;
        updateSoundControlPendingIndicator();
    }

    if (sliderHp) sliderHp.addEventListener('input', (e) => syncCombinedHp(e.target.value));
    if (inputHp) inputHp.addEventListener('change', (e) => syncCombinedHp(e.target.value));

    // Split L slider
    const sliderHpL = document.getElementById('soundcontrol-slider-hp-l');
    const inputHpL = document.getElementById('soundcontrol-input-hp-l');

    function syncHpL(val) {
        val = Math.max(0, Math.min(20, parseInt(val) || 0));
        scPendingState.hp_l = String(val);
        if (sliderHpL) sliderHpL.value = val;
        if (inputHpL) inputHpL.value = val;
        updateSoundControlPendingIndicator();
    }

    if (sliderHpL) sliderHpL.addEventListener('input', (e) => syncHpL(e.target.value));
    if (inputHpL) inputHpL.addEventListener('change', (e) => syncHpL(e.target.value));

    // Split R slider
    const sliderHpR = document.getElementById('soundcontrol-slider-hp-r');
    const inputHpR = document.getElementById('soundcontrol-input-hp-r');

    function syncHpR(val) {
        val = Math.max(0, Math.min(20, parseInt(val) || 0));
        scPendingState.hp_r = String(val);
        if (sliderHpR) sliderHpR.value = val;
        if (inputHpR) inputHpR.value = val;
        updateSoundControlPendingIndicator();
    }

    if (sliderHpR) sliderHpR.addEventListener('input', (e) => syncHpR(e.target.value));
    if (inputHpR) inputHpR.addEventListener('change', (e) => syncHpR(e.target.value));

    // Mic slider
    const sliderMic = document.getElementById('soundcontrol-slider-mic');
    const inputMic = document.getElementById('soundcontrol-input-mic');

    function syncMic(val) {
        val = Math.max(0, Math.min(20, parseInt(val) || 0));
        scPendingState.mic = String(val);
        if (sliderMic) sliderMic.value = val;
        if (inputMic) inputMic.value = val;
        updateSoundControlPendingIndicator();
    }

    if (sliderMic) sliderMic.addEventListener('input', (e) => syncMic(e.target.value));
    if (inputMic) inputMic.addEventListener('change', (e) => syncMic(e.target.value));

    // Prevent swipe conflicts on all sliders
    [sliderHp, sliderHpL, sliderHpR, sliderMic].forEach(slider => {
        if (slider) preventSwipePropagation(slider);
    });

    // Add ticks to sliders (21 ticks for 0-20 range)
    [sliderHp, sliderHpL, sliderHpR, sliderMic].forEach(slider => {
        if (slider) updateSoundControlSliderTicks(slider);
    });

    // Button handlers
    document.getElementById('soundcontrol-btn-save')?.addEventListener('click', saveSoundControl);
    document.getElementById('soundcontrol-btn-apply')?.addEventListener('click', applySoundControl);
    document.getElementById('soundcontrol-btn-save-apply')?.addEventListener('click', async () => {
        await saveSoundControl();
        await applySoundControl();
    });

    // Load initial state
    loadSoundControlState();

    // Language change listener
    document.addEventListener('languageChanged', () => {
        renderSoundControlCard();
    });
}
