// Adreno Tweak

const ADRENOBOOST_NODE = '/sys/devices/platform/soc/5900000.qcom,kgsl-3d0/devfreq/5900000.qcom,kgsl-3d0/adrenoboost';
const ADRENOIDLER_ACTIVE_NODE = '/sys/module/adreno_idler/parameters/adreno_idler_active';
const ADRENOIDLER_DOWNDIFF_NODE = '/sys/module/adreno_idler/parameters/adreno_idler_downdifferential';
const ADRENOIDLER_IDLEWAIT_NODE = '/sys/module/adreno_idler/parameters/adreno_idler_idlewait';
const ADRENOIDLER_IDLEWORKLOAD_NODE = '/sys/module/adreno_idler/parameters/adreno_idler_idleworkload';

let adrenoCurrentState = {
    adrenoboost: '0',
    idler_active: 'N',
    idler_downdifferential: '20',
    idler_idlewait: '15',
    idler_idleworkload: '5000'
};
let adrenoSavedState = {
    adrenoboost: '0',
    idler_active: 'N',
    idler_downdifferential: '20',
    idler_idlewait: '15',
    idler_idleworkload: '5000'
};
let adrenoPendingState = {
    adrenoboost: '0',
    idler_active: 'N',
    idler_downdifferential: '20',
    idler_idlewait: '15',
    idler_idleworkload: '5000'
};

async function runAdrenoBackend(action, ...args) {
    const cmd = `sh ${DATA_DIR}/tweaks/adreno.sh ${action} ${args.join(' ')}`;
    try {
        const result = await exec(cmd);
        return result.trim();
    } catch (error) {
        console.error(`Adreno backend error (${action}):`, error);
        return '';
    }
}

function getAdrenoboostText(val) {
    switch (String(val)) {
        case '1': return window.t ? window.t('tweaks.adreno.adrenoboostLow') : 'Low';
        case '2': return window.t ? window.t('tweaks.adreno.adrenoboostMedium') : 'Medium';
        case '3': return window.t ? window.t('tweaks.adreno.adrenoboostHigh') : 'High';
        default: return window.t ? window.t('tweaks.adreno.adrenoboostOff') : 'Off';
    }
}

function updateAdrenoboostOptions(selectedValue) {
    const container = document.getElementById('adreno-adrenoboost-options');
    if (!container) return;
    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === String(selectedValue));
    });
}

function updateAdrenoPendingIndicator() {
    const indicator = document.getElementById('adreno-pending-indicator');
    if (!indicator) return;

    const hasChanges =
        adrenoPendingState.adrenoboost !== adrenoSavedState.adrenoboost ||
        adrenoPendingState.idler_active !== adrenoSavedState.idler_active ||
        adrenoPendingState.idler_downdifferential !== adrenoSavedState.idler_downdifferential ||
        adrenoPendingState.idler_idlewait !== adrenoSavedState.idler_idlewait ||
        adrenoPendingState.idler_idleworkload !== adrenoSavedState.idler_idleworkload;

    indicator.classList.toggle('hidden', !hasChanges);
}

function renderAdrenoCard() {
    updateAdrenoboostOptions(adrenoPendingState.adrenoboost);

    const currentAdrenoboost = document.getElementById('adreno-current-adrenoboost');
    if (currentAdrenoboost) {
        currentAdrenoboost.textContent = getAdrenoboostText(adrenoCurrentState.adrenoboost);
    }

    const txtEnabled = window.t ? window.t('tweaks.adreno.enabled') : 'Enabled';
    const txtDisabled = window.t ? window.t('tweaks.adreno.disabled') : 'Disabled';

    const valActive = document.getElementById('adreno-val-active');
    const toggleActive = document.getElementById('adreno-active-switch');
    if (valActive) {
        valActive.textContent = (adrenoCurrentState.idler_active === 'Y') ? txtEnabled : txtDisabled;
    }
    if (toggleActive) {
        toggleActive.checked = adrenoPendingState.idler_active === 'Y';
    }

    const valDowndiff = document.getElementById('adreno-val-downdifferential');
    const inputDowndiff = document.getElementById('adreno-downdifferential');
    if (valDowndiff) valDowndiff.textContent = adrenoCurrentState.idler_downdifferential || '--';
    if (inputDowndiff) {
        inputDowndiff.placeholder = adrenoCurrentState.idler_downdifferential || '';
        if (adrenoPendingState.idler_downdifferential && adrenoPendingState.idler_downdifferential !== adrenoCurrentState.idler_downdifferential) {
            inputDowndiff.value = adrenoPendingState.idler_downdifferential;
        } else {
            inputDowndiff.value = '';
        }
    }

    const valIdlewait = document.getElementById('adreno-val-idlewait');
    const inputIdlewait = document.getElementById('adreno-idlewait');
    if (valIdlewait) valIdlewait.textContent = adrenoCurrentState.idler_idlewait || '--';
    if (inputIdlewait) {
        inputIdlewait.placeholder = adrenoCurrentState.idler_idlewait || '';
        if (adrenoPendingState.idler_idlewait && adrenoPendingState.idler_idlewait !== adrenoCurrentState.idler_idlewait) {
            inputIdlewait.value = adrenoPendingState.idler_idlewait;
        } else {
            inputIdlewait.value = '';
        }
    }

    const valIdleworkload = document.getElementById('adreno-val-idleworkload');
    const inputIdleworkload = document.getElementById('adreno-idleworkload');
    if (valIdleworkload) valIdleworkload.textContent = adrenoCurrentState.idler_idleworkload || '--';
    if (inputIdleworkload) {
        inputIdleworkload.placeholder = adrenoCurrentState.idler_idleworkload || '';
        if (adrenoPendingState.idler_idleworkload && adrenoPendingState.idler_idleworkload !== adrenoCurrentState.idler_idleworkload) {
            inputIdleworkload.value = adrenoPendingState.idler_idleworkload;
        } else {
            inputIdleworkload.value = '';
        }
    }

    updateAdrenoPendingIndicator();
}

async function loadAdrenoState() {
    const currentOutput = await runAdrenoBackend('get_current');
    const current = parseKeyValue(currentOutput);
    adrenoCurrentState = {
        adrenoboost: current.adrenoboost || '0',
        idler_active: current.idler_active || 'N',
        idler_downdifferential: current.idler_downdifferential || '20',
        idler_idlewait: current.idler_idlewait || '15',
        idler_idleworkload: current.idler_idleworkload || '5000'
    };

    const savedOutput = await runAdrenoBackend('get_saved');
    const saved = parseKeyValue(savedOutput);

    // Normalize saved values (use defaults if empty)
    const savedNormalized = {
        adrenoboost: saved.adrenoboost || '0',
        idler_active: saved.idler_active || 'N',
        idler_downdifferential: saved.idler_downdifferential || '20',
        idler_idlewait: saved.idler_idlewait || '15',
        idler_idleworkload: saved.idler_idleworkload || '5000'
    };

    // Check if saved values are the defaults (which backend returns when no config file exists)
    const isDefaultSaved =
        savedNormalized.adrenoboost === '0' &&
        savedNormalized.idler_active === 'N' &&
        savedNormalized.idler_downdifferential === '20' &&
        savedNormalized.idler_idlewait === '15' &&
        savedNormalized.idler_idleworkload === '5000';

    // If saved is defaults and differs from current, there's no saved config file - use current
    // Otherwise, use saved (either it's not defaults, or it matches current)
    const savedDiffersFromCurrent =
        savedNormalized.adrenoboost !== adrenoCurrentState.adrenoboost ||
        savedNormalized.idler_active !== adrenoCurrentState.idler_active ||
        savedNormalized.idler_downdifferential !== adrenoCurrentState.idler_downdifferential ||
        savedNormalized.idler_idlewait !== adrenoCurrentState.idler_idlewait ||
        savedNormalized.idler_idleworkload !== adrenoCurrentState.idler_idleworkload;

    const hasActualSavedConfig = !isDefaultSaved || !savedDiffersFromCurrent;

    // pending indicator fix
    if (hasActualSavedConfig) {
        adrenoSavedState = savedNormalized;
    } else {
        adrenoSavedState = { ...adrenoCurrentState };
    }

    // Initialize pending state from current if no saved config, otherwise from saved
    adrenoPendingState = hasActualSavedConfig ? { ...adrenoSavedState } : { ...adrenoCurrentState };
    renderAdrenoCard();
}

async function saveAdreno() {
    await runAdrenoBackend('save',
        adrenoPendingState.adrenoboost,
        adrenoPendingState.idler_active,
        adrenoPendingState.idler_downdifferential,
        adrenoPendingState.idler_idlewait,
        adrenoPendingState.idler_idleworkload
    );
    adrenoSavedState = { ...adrenoPendingState };
    updateAdrenoPendingIndicator();
    showToast(window.t ? window.t('toast.settingsSaved') : 'Settings saved');
}

async function applyAdreno() {
    await runAdrenoBackend('apply',
        adrenoPendingState.adrenoboost,
        adrenoPendingState.idler_active,
        adrenoPendingState.idler_downdifferential,
        adrenoPendingState.idler_idlewait,
        adrenoPendingState.idler_idleworkload
    );

    const currentOutput = await runAdrenoBackend('get_current');
    if (!currentOutput) {
        showToast(window.t ? window.t('toast.settingsFailed') : 'Failed to apply settings', true);
        return;
    }

    const current = parseKeyValue(currentOutput);
    adrenoCurrentState = {
        adrenoboost: current.adrenoboost || '0',
        idler_active: current.idler_active || 'N',
        idler_downdifferential: current.idler_downdifferential || '20',
        idler_idlewait: current.idler_idlewait || '15',
        idler_idleworkload: current.idler_idleworkload || '5000'
    };

    renderAdrenoCard();
    showToast(window.t ? window.t('toast.settingsApplied') : 'Settings applied');
}

function initAdrenoTweak() {
    const card = document.getElementById('adreno-card');
    if (!card) return;

    if (window.KERNEL_NAME !== 'FloppyTrinketMi') {
        card.classList.add('hidden');
        return;
    }

    runAdrenoBackend('is_available').then((availability) => {
        const available = parseKeyValue(availability).available === '1';
        if (!available) {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');

        const adrenoboostOptions = document.getElementById('adreno-adrenoboost-options');
        if (adrenoboostOptions) {
            adrenoboostOptions.querySelectorAll('.option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    adrenoPendingState.adrenoboost = String(btn.dataset.value || '0');
                    renderAdrenoCard();
                });
            });
        }

        const toggleActive = document.getElementById('adreno-active-switch');
        if (toggleActive) {
            toggleActive.addEventListener('change', (e) => {
                adrenoPendingState.idler_active = e.target.checked ? 'Y' : 'N';
                updateAdrenoPendingIndicator();
            });
        }

        const inputDowndiff = document.getElementById('adreno-downdifferential');
        if (inputDowndiff) {
            inputDowndiff.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    adrenoPendingState.idler_downdifferential = adrenoSavedState.idler_downdifferential || adrenoCurrentState.idler_downdifferential || '20';
                } else {
                    adrenoPendingState.idler_downdifferential = e.target.value;
                }
                updateAdrenoPendingIndicator();
            });
        }

        const inputIdlewait = document.getElementById('adreno-idlewait');
        if (inputIdlewait) {
            inputIdlewait.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    adrenoPendingState.idler_idlewait = adrenoSavedState.idler_idlewait || adrenoCurrentState.idler_idlewait || '15';
                } else {
                    adrenoPendingState.idler_idlewait = e.target.value;
                }
                updateAdrenoPendingIndicator();
            });
        }

        const inputIdleworkload = document.getElementById('adreno-idleworkload');
        if (inputIdleworkload) {
            inputIdleworkload.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    adrenoPendingState.idler_idleworkload = adrenoSavedState.idler_idleworkload || adrenoCurrentState.idler_idleworkload || '5000';
                } else {
                    adrenoPendingState.idler_idleworkload = e.target.value;
                }
                updateAdrenoPendingIndicator();
            });
        }

        document.getElementById('adreno-btn-save')?.addEventListener('click', saveAdreno);
        document.getElementById('adreno-btn-apply')?.addEventListener('click', applyAdreno);
        document.getElementById('adreno-btn-save-apply')?.addEventListener('click', async () => {
            await saveAdreno();
            await applyAdreno();
        });

        document.addEventListener('languageChanged', () => {
            renderAdrenoCard();
        });

        loadAdrenoState();

        if (typeof window.registerTweak === 'function') {
            window.registerTweak('adreno', {
                getState: () => ({ ...adrenoPendingState }),
                            setState: (config) => {
                                adrenoPendingState = { ...adrenoPendingState, ...config };
                                renderAdrenoCard();
                            },                render: renderAdrenoCard,
                save: saveAdreno,
                apply: applyAdreno
            });
        }
    });
}
