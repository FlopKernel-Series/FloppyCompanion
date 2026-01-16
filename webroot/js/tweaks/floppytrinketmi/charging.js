// Charging Tweak

let chargingCurrentState = { bypass: '0', fast: '0' };
let chargingSavedState = { bypass: '0', fast: '0' };
let chargingPendingState = { bypass: '0', fast: '0' };

async function runChargingBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/charging.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Charging backend error (${action}):`, error);
        return '';
    }
}

function renderChargingCard() {
    const valBypass = document.getElementById('charging-val-bypass');
    const toggleBypass = document.getElementById('charging-bypass-switch');

    // Use generic enabled/disabled or specific keys
    const txtEnabled = window.t ? window.t('tweaks.charging.enabled') : 'Enabled';
    const txtDisabled = window.t ? window.t('tweaks.charging.disabled') : 'Disabled';

    if (valBypass) valBypass.textContent = (chargingCurrentState.bypass === '1') ? txtEnabled : txtDisabled;
    if (toggleBypass) toggleBypass.checked = chargingPendingState.bypass === '1';

    const valFast = document.getElementById('charging-val-fast');
    const toggleFast = document.getElementById('charging-fast-switch');

    if (valFast) valFast.textContent = (chargingCurrentState.fast === '1') ? txtEnabled : txtDisabled;
    if (toggleFast) toggleFast.checked = chargingPendingState.fast === '1';

    updateChargingPendingIndicator();
}

function updateChargingPendingIndicator() {
    const indicator = document.getElementById('charging-pending-indicator');
    if (!indicator) return;

    const hasChanges =
        chargingPendingState.bypass !== chargingSavedState.bypass ||
        chargingPendingState.fast !== chargingSavedState.fast;

    indicator.classList.toggle('hidden', !hasChanges);
}

async function loadChargingState() {
    const currentOutput = await runChargingBackend('get_current');
    const current = parseKeyValue(currentOutput);
    chargingCurrentState = {
        bypass: current.bypass || '0',
        fast: current.fast || '0'
    };

    const savedOutput = await runChargingBackend('get_saved');
    const saved = parseKeyValue(savedOutput);
    chargingSavedState = {
        bypass: saved.bypass || chargingCurrentState.bypass || '0',
        fast: saved.fast || chargingCurrentState.fast || '0'
    };

    chargingPendingState = { ...chargingSavedState };
    renderChargingCard();
}

async function saveCharging() {
    await runChargingBackend('save', chargingPendingState.bypass, chargingPendingState.fast);
    chargingSavedState = { ...chargingPendingState };
    updateChargingPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyCharging() {
    await runChargingBackend('apply', chargingPendingState.bypass, chargingPendingState.fast);

    const currentOutput = await runChargingBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    chargingCurrentState = {
        bypass: current.bypass || '0',
        fast: current.fast || '0'
    };

    renderChargingCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

async function initChargingTweak() {
    const card = document.getElementById('charging-card');
    if (!card) return;

    if (window.KERNEL_NAME !== 'FloppyTrinketMi') {
        card.classList.add('hidden');
        return;
    }

    const availOutput = await runChargingBackend('is_available');
    const available = parseKeyValue(availOutput).available === '1';
    if (!available) {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');

    const toggleBypass = document.getElementById('charging-bypass-switch');
    if (toggleBypass) {
        toggleBypass.addEventListener('change', (e) => {
            chargingPendingState.bypass = e.target.checked ? '1' : '0';
            updateChargingPendingIndicator();
        });
    }

    const toggleFast = document.getElementById('charging-fast-switch');
    if (toggleFast) {
        toggleFast.addEventListener('change', (e) => {
            chargingPendingState.fast = e.target.checked ? '1' : '0';
            updateChargingPendingIndicator();
        });
    }

    document.getElementById('charging-btn-save')?.addEventListener('click', saveCharging);
    document.getElementById('charging-btn-apply')?.addEventListener('click', applyCharging);
    document.getElementById('charging-btn-save-apply')?.addEventListener('click', async () => {
        await saveCharging();
        await applyCharging();
    });

    document.addEventListener('languageChanged', () => {
        renderChargingCard();
    });

    loadChargingState();
}
