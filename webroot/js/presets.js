// presets.js - Tweaks Preset System

// =============================================================================
// TWEAK REGISTRY - Each tweak registers its interface here
// =============================================================================

const TWEAK_REGISTRY = {};

// Register a tweak module
function registerTweak(id, module) {
    TWEAK_REGISTRY[id] = module;
}

// =============================================================================
// PRESET STATE
// =============================================================================

let currentPresetName = 'Default';
let currentPresetBuiltIn = true;
let availablePresets = []; // List of { name, builtIn, path }
let defaultPresetData = null; // Captured from kernel

// =============================================================================
// PRESET DATA MANAGEMENT
// =============================================================================

// Load available presets list
async function loadAvailablePresets() {
    availablePresets = [];

    // Add Default (always first) — label is localized
    const defaultLabel = (window.t ? t('tweaks.presetDefaultName') : 'Default');
    availablePresets.push({ name: 'Default', label: defaultLabel, builtIn: true, path: null });

    // Load user presets from persistent directory
    const presetDir = '/data/adb/floppy_companion/presets';
    const listResult = await exec(`ls -1 "${presetDir}"/*.json 2>/dev/null || true`);

    if (listResult && listResult.trim()) {
        const files = listResult.trim().split('\n');
        for (const file of files) {
            if (file.endsWith('.json') && !file.endsWith('.defaults.json')) {
                const name = file.split('/').pop().replace('.json', '');
                availablePresets.push({ name, builtIn: false, path: file });
            }
        }
    }

    renderPresetSelector();
}

// Load Default preset (kernel defaults captured at boot)
async function loadDefaultPreset() {
    const defaultPath = '/data/adb/floppy_companion/presets/.defaults.json';
    const content = await exec(`cat "${defaultPath}" 2>/dev/null || echo "{}"`);

    try {
        defaultPresetData = JSON.parse(content);
    } catch (e) {
        console.error('Failed to parse defaults:', e);
        defaultPresetData = { tweaks: {} };
    }
}

// Load a preset file
async function loadPresetFile(path) {
    const content = await exec(`cat "${path}" 2>/dev/null || echo "{}"`);
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to parse preset:', e);
        return null;
    }
}

// =============================================================================
// COLLECT / APPLY TWEAK STATES
// =============================================================================

// Gather current state from all registered tweaks
function collectAllTweakStates() {
    const config = {};
    for (const [id, tweak] of Object.entries(TWEAK_REGISTRY)) {
        if (typeof tweak.getState === 'function') {
            config[id] = tweak.getState();
        }
    }
    return config;
}

// Load preset data into all tweak UIs
function loadPresetToUI(presetData) {
    if (!presetData || !presetData.tweaks) return;

    for (const [id, tweak] of Object.entries(TWEAK_REGISTRY)) {
        if (presetData.tweaks[id] && typeof tweak.setState === 'function') {
            tweak.setState(presetData.tweaks[id]);
        } else if (defaultPresetData?.tweaks?.[id] && typeof tweak.setState === 'function') {
            // Fill missing with defaults
            tweak.setState(defaultPresetData.tweaks[id]);
        }

        // Re-render the tweak UI
        if (typeof tweak.render === 'function') {
            tweak.render();
        }
    }
}

// Apply all tweaks (run their apply logic)
async function applyAllTweaks() {
    for (const [id, tweak] of Object.entries(TWEAK_REGISTRY)) {
        if (typeof tweak.apply === 'function') {
            await tweak.apply();
        }
    }
}

// Save all tweaks (run their save logic)
async function saveAllTweaks() {
    for (const [id, tweak] of Object.entries(TWEAK_REGISTRY)) {
        if (typeof tweak.save === 'function') {
            await tweak.save();
        }
    }
}

// =============================================================================
// PRESET UI ACTIONS
// =============================================================================

// Show load preset confirmation modal
async function showLoadPresetModal() {
    const isDefault = currentPresetName === 'Default';
    const message = isDefault
        ? (t('tweaks.loadDefaultDesc'))
        : t('tweaks.loadPresetDesc').replace('{name}', currentPresetName);

    const result = await showConfirmModal({
        title: t('tweaks.loadPresetTitle'),
        body: `<p>${message}</p><p>${t('tweaks.loadPresetWarning')}</p>`,
        iconClass: 'info',
        confirmText: t('tweaks.applyNow'),
        cancelText: t('modal.cancel'),
        extraButton: { text: t('tweaks.loadOnly'), value: 'load' }
    });

    if (result === true) return 'apply';
    if (result === 'load') return 'load';
    return null;
}

// Handle Load Preset button click
async function handleLoadPreset() {
    const action = await showLoadPresetModal();
    if (!action) return;

    // Get preset data
    let presetData;
    if (currentPresetName === 'Default') {
        presetData = defaultPresetData;
    } else {
        const preset = availablePresets.find(p => p.name === currentPresetName);
        if (preset && preset.path) {
            presetData = await loadPresetFile(preset.path);
        }
    }

    if (!presetData) {
        showToast('Failed to load preset', true);
        return;
    }

    // Load to UI
    loadPresetToUI(presetData);

    // Always save tweaks to persistence
    await saveAllTweaks();

    if (action === 'apply') {
        // Apply all tweaks immediately
        await applyAllTweaks();
        showToast('Preset saved & applied');
    } else {
        showToast('Preset loaded & saved');
    }
}

// Handle Save button click
async function handleSavePreset() {
    const isBuiltIn = currentPresetBuiltIn;

    if (isBuiltIn) {
        // Prompt for new name
        const name = await promptPresetName();
        if (name) {
            await savePresetAs(name);
        }
    } else {
        // Ask: Overwrite or Save as New?
        const action = await showOverwritePrompt();
        if (action === 'overwrite') {
            await savePresetAs(currentPresetName);
        } else if (action === 'new') {
            const name = await promptPresetName();
            if (name) {
                await savePresetAs(name);
            }
        }
    }
}

// Save preset with given name
async function savePresetAs(name) {
    const presetData = {
        name: name,
        version: 1,
        builtIn: false,
        savedAt: new Date().toISOString(),
        tweaks: collectAllTweakStates()
    };

    const presetDir = '/data/adb/modules/floppy_companion/presets';
    const filePath = `${presetDir}/${name}.json`;

    // Write file
    const json = JSON.stringify(presetData, null, 2);
    const result = await exec(`mkdir -p "${presetDir}" && cat > "${filePath}" << 'PRESET_EOF'
${json}
PRESET_EOF`);

    // Also save all tweak configs
    await saveAllTweaks();

    // Update state
    currentPresetName = name;
    currentPresetBuiltIn = false;

    // Reload preset list
    await loadAvailablePresets();

    showToast(`Saved as "${name}"`);
}

// Handle Export button click
async function handleExportPreset() {
    if (currentPresetBuiltIn) {
        showToast('Cannot export built-in presets', true);
        return;
    }

    const presetData = {
        name: currentPresetName,
        version: 1,
        builtIn: false,
        exportedAt: new Date().toISOString(),
        tweaks: collectAllTweakStates()
    };

    const exportDir = '/sdcard/FloppyCompanion/presets';
    const filePath = `${exportDir}/${currentPresetName}.json`;

    const json = JSON.stringify(presetData, null, 2);
    await exec(`mkdir -p "${exportDir}" && cat > "${filePath}" << 'PRESET_EOF'
${json}
PRESET_EOF`);

    showToast(`Exported to ${filePath}`);
}

// Handle Import button click
async function handleImportPreset() {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Wait for file selection
    const file = await new Promise((resolve) => {
        fileInput.addEventListener('change', (e) => {
            resolve(e.target.files[0] || null);
        });
        fileInput.addEventListener('cancel', () => resolve(null));
        fileInput.click();
    });

    fileInput.remove();

    if (!file) return;

    // Read file content
    const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });

    // Parse preset
    let presetData;
    try {
        presetData = JSON.parse(content);
    } catch (e) {
        showToast('Invalid preset file', true);
        return;
    }

    // Sanitize name
    const name = (presetData.name || file.name.replace('.json', '')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const modulePresetDir = '/data/adb/modules/floppy_companion/presets';
    const moduleFilePath = `${modulePresetDir}/${name}.json`;

    presetData.name = name;
    presetData.builtIn = false;

    const json = JSON.stringify(presetData, null, 2);
    await exec(`mkdir -p "${modulePresetDir}" && cat > "${moduleFilePath}" << 'PRESET_EOF'
${json}
PRESET_EOF`);

    // Reload presets and select the imported one
    await loadAvailablePresets();
    currentPresetName = name;
    currentPresetBuiltIn = false;
    renderPresetSelector();

    showToast(`Imported "${name}"`);
}

// Prompt for preset name
async function promptPresetName() {
    const result = await showConfirmModal({
        title: 'Save Preset',
        body: `<p>Enter a name for the preset:</p>
               <input type="text" id="save-preset-name-input" class="preset-name-input" placeholder="My Preset" maxlength="32" style="margin-top: 8px;">`,
        iconName: 'save',
        confirmText: 'Save',
        cancelText: 'Cancel'
    });

    if (result === true) {
        const input = document.getElementById('save-preset-name-input');
        let name = input ? input.value.trim() : '';
        name = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        return name || null;
    }
    return null;
}

// Show overwrite prompt
async function showOverwritePrompt() {
    const result = await showConfirmModal({
        title: 'Save Preset',
        body: `<p>Do you want to overwrite "${currentPresetName}" or save as a new preset?</p>`,
        iconClass: 'info',
        confirmText: 'Overwrite',
        cancelText: t('modal.cancel'),
        extraButton: { text: 'Save as New', value: 'new' }
    });

    if (result === true) return 'overwrite';
    if (result === 'new') return 'new';
    return null;
}

// =============================================================================
// UI RENDERING
// =============================================================================

function renderPresetSelector() {
    const selector = document.getElementById('preset-selector');
    if (!selector) return;

    selector.innerHTML = '';

    for (const preset of availablePresets) {
        const option = document.createElement('option');
        option.value = preset.name;
        const label = (preset.name === 'Default') ? (t('tweaks.presetDefaultName')) : (preset.label || preset.name);
        option.textContent = label + (preset.builtIn ? '' : ' ★');
        if (preset.name === currentPresetName) {
            option.selected = true;
        }
        selector.appendChild(option);
    }

    // Update export button state
    const exportBtn = document.getElementById('preset-export-btn');
    if (exportBtn) {
        exportBtn.disabled = currentPresetBuiltIn;
        exportBtn.style.opacity = currentPresetBuiltIn ? '0.5' : '1';
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initPresets() {
    // Load default preset data
    await loadDefaultPreset();

    // Load available presets
    await loadAvailablePresets();

    // Wire up UI
    const selector = document.getElementById('preset-selector');
    const loadBtn = document.getElementById('preset-load-btn');
    const saveBtn = document.getElementById('preset-save-btn');
    const importBtn = document.getElementById('preset-import-btn');
    const exportBtn = document.getElementById('preset-export-btn');

    if (selector) {
        selector.addEventListener('change', (e) => {
            const preset = availablePresets.find(p => p.name === e.target.value);
            if (preset) {
                currentPresetName = preset.name;
                currentPresetBuiltIn = preset.builtIn;
                renderPresetSelector();
            }
        });
    }

    if (loadBtn) loadBtn.addEventListener('click', handleLoadPreset);
    if (saveBtn) saveBtn.addEventListener('click', handleSavePreset);
    if (importBtn) importBtn.addEventListener('click', handleImportPreset);
    if (exportBtn) exportBtn.addEventListener('click', handleExportPreset);

    // Re-render preset selector when language changes
    document.addEventListener('languageChanged', renderPresetSelector);
}

// Make functions available globally
window.TWEAK_REGISTRY = TWEAK_REGISTRY;
window.registerTweak = registerTweak;
window.initPresets = initPresets;
window.collectAllTweakStates = collectAllTweakStates;
window.loadPresetToUI = loadPresetToUI;
window.getDefaultPreset = () => defaultPresetData;
