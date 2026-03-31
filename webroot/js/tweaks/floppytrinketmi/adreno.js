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
let adrenoReferenceState = {
    adrenoboost: '0',
    idler_active: 'N',
    idler_downdifferential: '20',
    idler_idlewait: '15',
    idler_idleworkload: '5000'
};
let adrenoDefaultState = {};

const runAdrenoBackend = (...args) => window.runTweakBackend('adreno', ...args);

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
    const hasChanges =
        adrenoPendingState.adrenoboost !== adrenoReferenceState.adrenoboost ||
        adrenoPendingState.idler_active !== adrenoReferenceState.idler_active ||
        adrenoPendingState.idler_downdifferential !== adrenoReferenceState.idler_downdifferential ||
        adrenoPendingState.idler_idlewait !== adrenoReferenceState.idler_idlewait ||
        adrenoPendingState.idler_idleworkload !== adrenoReferenceState.idler_idleworkload;

    window.setPendingIndicator('adreno-pending-indicator', hasChanges);
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
        const { placeholder, value } = window.getTweakTextInputState(
            'idler_downdifferential',
            adrenoPendingState,
            adrenoSavedState,
            adrenoReferenceState,
            adrenoDefaultState,
            adrenoCurrentState,
            '20'
        );
        inputDowndiff.placeholder = placeholder;
        inputDowndiff.value = value;
    }

    const valIdlewait = document.getElementById('adreno-val-idlewait');
    const inputIdlewait = document.getElementById('adreno-idlewait');
    if (valIdlewait) valIdlewait.textContent = adrenoCurrentState.idler_idlewait || '--';
    if (inputIdlewait) {
        const { placeholder, value } = window.getTweakTextInputState(
            'idler_idlewait',
            adrenoPendingState,
            adrenoSavedState,
            adrenoReferenceState,
            adrenoDefaultState,
            adrenoCurrentState,
            '15'
        );
        inputIdlewait.placeholder = placeholder;
        inputIdlewait.value = value;
    }

    const valIdleworkload = document.getElementById('adreno-val-idleworkload');
    const inputIdleworkload = document.getElementById('adreno-idleworkload');
    if (valIdleworkload) valIdleworkload.textContent = adrenoCurrentState.idler_idleworkload || '--';
    if (inputIdleworkload) {
        const { placeholder, value } = window.getTweakTextInputState(
            'idler_idleworkload',
            adrenoPendingState,
            adrenoSavedState,
            adrenoReferenceState,
            adrenoDefaultState,
            adrenoCurrentState,
            '5000'
        );
        inputIdleworkload.placeholder = placeholder;
        inputIdleworkload.value = value;
    }

    updateAdrenoPendingIndicator();
}

async function loadAdrenoState() {
    const { current, saved } = await window.loadTweakState('adreno');
    adrenoCurrentState = {
        adrenoboost: current.adrenoboost || '0',
        idler_active: current.idler_active || 'N',
        idler_downdifferential: current.idler_downdifferential || '20',
        idler_idlewait: current.idler_idlewait || '15',
        idler_idleworkload: current.idler_idleworkload || '5000'
    };

    adrenoDefaultState = { ...window.getDefaultTweakPreset('adreno') };
    adrenoSavedState = window.buildSparseStateAgainstDefaults(saved, adrenoDefaultState);

    adrenoPendingState = window.initPendingState(adrenoCurrentState, adrenoSavedState, adrenoDefaultState);

    const { reference } = window.resolveTweakReference(adrenoCurrentState, adrenoSavedState, adrenoDefaultState);
    adrenoReferenceState = {
        adrenoboost: reference.adrenoboost || '0',
        idler_active: reference.idler_active || 'N',
        idler_downdifferential: reference.idler_downdifferential || '20',
        idler_idlewait: reference.idler_idlewait || '15',
        idler_idleworkload: reference.idler_idleworkload || '5000'
    };
    renderAdrenoCard();
}
window.loadAdrenoState = loadAdrenoState;

async function saveAdreno() {
    const sparseState = window.buildSparseStateAgainstDefaults(adrenoPendingState, adrenoDefaultState);
    await runAdrenoBackend('save', ...Object.entries(sparseState).map(([key, value]) => `${key}=${value}`));
    adrenoSavedState = { ...sparseState };
    adrenoReferenceState = window.initPendingState(adrenoCurrentState, adrenoSavedState, adrenoDefaultState);
    adrenoPendingState = { ...adrenoReferenceState };
    renderAdrenoCard();
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

    // Register tweak immediately (Early Registration)
    if (typeof window.registerTweak === 'function') {
        window.registerTweak('adreno', {
            getState: () => ({ ...adrenoPendingState }),
            setState: (config) => {
                adrenoPendingState = { ...adrenoPendingState, ...config };
                renderAdrenoCard();
            },
            render: renderAdrenoCard,
            save: saveAdreno,
            apply: applyAdreno
        });
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
                    adrenoPendingState.idler_downdifferential = window.getTweakDefaultValue(
                        'idler_downdifferential',
                        adrenoCurrentState,
                        adrenoDefaultState,
                        '20'
                    );
                } else {
                    adrenoPendingState.idler_downdifferential = e.target.value;
                }
                renderAdrenoCard();
            });
        }

        const inputIdlewait = document.getElementById('adreno-idlewait');
        if (inputIdlewait) {
            inputIdlewait.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    adrenoPendingState.idler_idlewait = window.getTweakDefaultValue(
                        'idler_idlewait',
                        adrenoCurrentState,
                        adrenoDefaultState,
                        '15'
                    );
                } else {
                    adrenoPendingState.idler_idlewait = e.target.value;
                }
                renderAdrenoCard();
            });
        }

        const inputIdleworkload = document.getElementById('adreno-idleworkload');
        if (inputIdleworkload) {
            inputIdleworkload.addEventListener('input', (e) => {
                if (e.target.value === '') {
                    adrenoPendingState.idler_idleworkload = window.getTweakDefaultValue(
                        'idler_idleworkload',
                        adrenoCurrentState,
                        adrenoDefaultState,
                        '5000'
                    );
                } else {
                    adrenoPendingState.idler_idleworkload = e.target.value;
                }
                renderAdrenoCard();
            });
        }

        window.bindSaveApplyButtons('adreno', saveAdreno, applyAdreno);

        document.addEventListener('languageChanged', () => {
            renderAdrenoCard();
        });

                loadAdrenoState();

            });

        }
