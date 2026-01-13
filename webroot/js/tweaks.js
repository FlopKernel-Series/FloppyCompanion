// tweaks.js - Tweaks Tab Logic

// =========================
// Schema-driven Tweaks UI
// =========================

const TWEAKS_SCHEMA_URL = './tweaks_schema.json';

function getTweakVarStore() {
    if (!window.__tweakVars) window.__tweakVars = {};
    return window.__tweakVars;
}

function setTweakVar(name, value) {
    const vars = getTweakVarStore();
    const prev = vars[name];
    vars[name] = value;
    if (prev !== value) {
        document.dispatchEvent(new CustomEvent('tweakVarsChanged', { detail: { name, value } }));
    }
}

function getTweakVar(name) {
    return getTweakVarStore()[name];
}

function truthy(value) {
    return value === true || value === 'true' || value === 1 || value === '1' || value === 'yes';
}

function evaluateRequires(requires) {
    if (!requires) return { ok: true };
    const rules = Array.isArray(requires) ? requires : [requires];

    for (const rule of rules) {
        if (!rule) continue;

        // Back-compat with schema rules like { var: "kernelName", eq: "Floppy1280" }
        if (rule.var && !rule.type) {
            const v = getTweakVar(rule.var);
            if (Object.prototype.hasOwnProperty.call(rule, 'eq') && v !== rule.eq) return { ok: false, reasonKey: rule.reasonKey };
            if (Object.prototype.hasOwnProperty.call(rule, 'truthy') && truthy(v) !== !!rule.truthy) return { ok: false, reasonKey: rule.reasonKey };
            if (Object.prototype.hasOwnProperty.call(rule, 'in')) {
                const list = Array.isArray(rule.in) ? rule.in : [];
                if (!list.includes(v)) return { ok: false, reasonKey: rule.reasonKey };
            }
            continue;
        }

        const type = rule.type || rule.kind || 'eq';

        if (type === 'var') {
            const v = getTweakVar(rule.name);
            if (Object.prototype.hasOwnProperty.call(rule, 'eq') && v !== rule.eq) return { ok: false, reasonKey: rule.reasonKey };
            if (Object.prototype.hasOwnProperty.call(rule, 'truthy') && truthy(v) !== !!rule.truthy) return { ok: false, reasonKey: rule.reasonKey };
            if (Object.prototype.hasOwnProperty.call(rule, 'in')) {
                const list = Array.isArray(rule.in) ? rule.in : [];
                if (!list.includes(v)) return { ok: false, reasonKey: rule.reasonKey };
            }
            continue;
        }

        if (type === 'kernelName') {
            const kernelName = window.KERNEL_NAME || '';
            if (rule.eq != null && kernelName !== rule.eq) return { ok: false, reasonKey: rule.reasonKey };
            if (rule.ne != null && kernelName === rule.ne) return { ok: false, reasonKey: rule.reasonKey };
            continue;
        }
    }

    return { ok: true };
}

function buildTweakCardShell(card) {
    const el = document.createElement('div');
    el.id = card.cardId;
    el.className = 'card tweak-card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const iconEl = createTweakIconSvg(card.iconKey);
    if (iconEl) header.appendChild(iconEl);

    const title = document.createElement('span');
    title.className = 'card-title';
    if (card.titleKey) title.setAttribute('data-i18n', card.titleKey);
    header.appendChild(title);

    if (card.tooltipKey) {
        const wrapper = document.createElement('div');
        wrapper.className = 'status-icon-wrapper';
        wrapper.setAttribute('style', 'position:relative; display:inline-block; vertical-align:middle; margin-left:8px;');

        const bubbleId = `${card.cardId}-bubble`;
        wrapper.innerHTML = `
            <svg class="status-icon info" onclick="toggleBubble('${bubbleId}', event)" viewBox="0 0 24 24" style="width:18px;height:18px;cursor:pointer;color:var(--md-sys-color-primary);">
                <path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            <div id="${bubbleId}" class="status-bubble center hidden" data-i18n="${card.tooltipKey}"></div>
        `;
        header.appendChild(wrapper);
    }

    if (card.pendingId) {
        const pending = document.createElement('span');
        pending.id = card.pendingId;
        pending.className = 'pending-indicator hidden';
        pending.setAttribute('data-i18n', 'tweaks.unsaved');
        header.appendChild(pending);
    }

    el.appendChild(header);

    const tpl = card.templateId ? document.getElementById(card.templateId) : null;
    if (tpl && tpl.content) {
        el.appendChild(tpl.content.cloneNode(true));
    } else {
        const body = document.createElement('div');
        body.className = 'card-content';
        el.appendChild(body);
    }

    return el;
}

function createTweakIconSvg(iconKey) {
    if (!iconKey) return null;

    // These SVGs are copied from the previous hardcoded card headers.
    // Keep them inline to avoid extra assets and to match existing CSS (`.icon-svg`).
    const defs = {
        thermal: {
            viewBox: '0 -960 960 960',
            path: 'M480-80q-83 0-141.5-58.5T280-280q0-48 21-89.5t59-70.5v-320q0-50 35-85t85-35q50 0 85 35t35 85v320q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-80Zm-40-440h80v-40h-40v-40h40v-80h-40v-40h40v-40q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240Z'
        },
        undervolt: {
            viewBox: '0 -960 960 960',
            path: 'm422-232 207-248H469l29-227-185 267h139l-30 208ZM320-80l40-280H160l360-520h80l-40 320h240L400-80h-80Zm151-390Z'
        },
        misc: {
            viewBox: '0 -960 960 960',
            path: 'M160-120q-33 0-56.5-23.5T80-200v-560q0-33 23.5-56.5T160-840h560q33 0 56.5 23.5T800-760v80h80v80h-80v80h80v80h-80v80h80v80h-80v80q0 33-23.5 56.5T720-120H160Zm0-80h560v-560H160v560Zm80-80h200v-160H240v160Zm240-280h160v-120H480v120Zm-240 80h200v-200H240v200Zm240 200h160v-240H480v240ZM160-760v560-560Z'
        },
        soundcontrol: {
            viewBox: '0 -960 960 960',
            path: 'M360-120H200q-33 0-56.5-23.5T120-200v-280q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480v280q0 33-23.5 56.5T760-120H600v-320h160v-40q0-117-81.5-198.5T480-760q-117 0-198.5 81.5T200-480v40h160v320Zm-80-240h-80v160h80v-160Zm400 0v160h80v-160h-80Zm-400 0h-80 80Zm400 0h80-80Z'
        },
        zram: {
            viewBox: '0 0 24 24',
            path: 'M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z'
        },
        memory: {
            viewBox: '0 0 24 24',
            path: 'M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z'
        },
        iosched: {
            viewBox: '0 0 24 24',
            path: 'M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm6 12c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V12z'
        }
    };

    const def = defs[String(iconKey)];
    if (!def) return null;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon-svg');
    svg.setAttribute('viewBox', def.viewBox);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', def.path);
    svg.appendChild(path);

    return svg;
}

async function loadTweaksSchema() {
    const res = await fetch(TWEAKS_SCHEMA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load tweaks schema: ${res.status}`);
    return res.json();
}

function renderTweaksFromSchemaOnce(schema) {
    if (window.__tweaksSchemaRendered) return;
    const root = document.getElementById('tweaks-sections');
    if (!root) return;
    root.innerHTML = '';

    const sections = schema?.sections || [];
    for (const section of sections) {
        const sectionEl = document.createElement('div');
        sectionEl.id = `tweaks-section-${section.id || ''}`;

        if (section.titleKey) {
            const h2 = document.createElement('h2');
            h2.className = 'section-title';
            h2.setAttribute('data-i18n', section.titleKey);
            sectionEl.appendChild(h2);
        }

        const cards = section.tweaks || section.cards || [];
        for (const card of cards) {
            sectionEl.appendChild(buildTweakCardShell(card));
        }

        root.appendChild(sectionEl);
    }

    window.__tweaksSchemaRendered = true;
}

function refreshTweaksAvailability(schema) {
    const sections = schema?.sections || [];
    for (const section of sections) {
        const sectionEl = section.id ? document.getElementById(`tweaks-section-${section.id}`) : null;
        const sectionOk = evaluateRequires(section.requires).ok;
        if (sectionEl) {
            sectionEl.classList.toggle('hidden', !sectionOk);
        }

        const cards = section.tweaks || section.cards || [];
        for (const card of cards) {
            const el = card.cardId ? document.getElementById(card.cardId) : null;
            if (!el) continue;
            const requiresEval = evaluateRequires(card.requires);
            const hide = card.hideWhenUnavailable !== false;
            el.classList.toggle('hidden', hide && !requiresEval.ok);
            el.classList.toggle('disabled', !requiresEval.ok && !hide);
        }
    }

    if (typeof window.I18N?.applyTranslations === 'function') {
        window.I18N.applyTranslations();
    }

    applyControlAvailability(schema);
}

function findTweakDef(schema, id) {
    const sections = schema?.sections || [];
    for (const section of sections) {
        const cards = section.tweaks || section.cards || [];
        for (const card of cards) {
            if (card.id === id) return card;
        }
    }
    return null;
}

function resolveControlRulesForCard(cardDef) {
    if (!cardDef) return [];
    if (Array.isArray(cardDef.controlRules)) return cardDef.controlRules;

    // Back-compat: older drafts used { controlRequires: { name: requiresRule } }.
    if (cardDef.controlRequires && typeof cardDef.controlRequires === 'object') {
        const rules = [];
        for (const [key, requires] of Object.entries(cardDef.controlRequires)) {
            // Minimal legacy support for known controls.
            if (cardDef.id === 'misc' && key === 'gpu_unlock') {
                rules.push({
                    id: key,
                    selector: '#misc-gpuunlock-switch',
                    mode: 'disable',
                    dimClosest: '.tweak-switch-container',
                    requires
                });
            }
        }
        return rules;
    }

    return [];
}

function setDisabledOnElement(el, disabled) {
    if (!el) return;
    const tag = (el.tagName || '').toLowerCase();

    if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') {
        el.disabled = !!disabled;
    } else {
        el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        el.style.pointerEvents = disabled ? 'none' : '';
    }
}

function applyControlRule(rule, scopeEl) {
    if (!rule || !rule.selector) return;
    const root = scopeEl || document;
    const targets = Array.from(root.querySelectorAll(rule.selector));
    if (targets.length === 0) return;

    const ok = evaluateRequires(rule.requires).ok;
    const mode = rule.mode || 'disable';

    for (const target of targets) {
        if (mode === 'hide') {
            const container = rule.hideClosest
                ? target.closest(rule.hideClosest)
                : (target.closest('.tweak-row') || target.closest('.slider-container') || target);
            if (container) container.classList.toggle('hidden', !ok);
            continue;
        }

        // default: disable
        setDisabledOnElement(target, !ok);

        if (rule.dimClosest) {
            const dimEl = target.closest(rule.dimClosest);
            if (dimEl) dimEl.style.opacity = ok ? '1' : '0.5';
        }
    }
}

function applyControlAvailability(schema) {
    const sections = schema?.sections || [];
    for (const section of sections) {
        const cards = section.tweaks || section.cards || [];
        for (const card of cards) {
            const cardEl = card.cardId ? document.getElementById(card.cardId) : null;
            if (!cardEl) continue;

            const cardDef = findTweakDef(schema, card.id);
            const rules = resolveControlRulesForCard(cardDef);
            for (const rule of rules) {
                applyControlRule(rule, cardEl);
            }
        }
    }
}

async function initTweaksSchemaUI() {
    if (window.__tweaksSchema) return;
    const schema = await loadTweaksSchema();
    window.__tweaksSchema = schema;

    // Seed variables (some may be unknown until main.js sets them)
    setTweakVar('kernelName', window.KERNEL_NAME || '');
    if (window.currentSuperfloppyMode != null) {
        setTweakVar('superfloppyMode', String(window.currentSuperfloppyMode));
        setTweakVar('isUnlockedOcMode', ['1', '2', '3'].includes(String(window.currentSuperfloppyMode)));
    }

    renderTweaksFromSchemaOnce(schema);
    refreshTweaksAvailability(schema);

    document.addEventListener('tweakVarsChanged', () => refreshTweaksAvailability(schema));
}

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
    // Build the tweaks DOM from schema/templates before any tweak init binds event listeners.
    await initTweaksSchemaUI();

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

        // Show thermal card
        const thermalCard = document.getElementById('thermal-card');
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
    await loadThermalState(); // Refresh from backend
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

    // If schema-driven control rules are available, let the generic engine handle it.
    if (window.__tweaksSchema) {
        applyControlAvailability(window.__tweaksSchema);
        return;
    }

    // Prefer schema-declared condition, fallback to derived vars / raw superfloppy mode.
    let isOcMode = truthy(getTweakVar('isUnlockedOcMode'));
    if (!isOcMode) {
        const superfloppyMode = String(getTweakVar('superfloppyMode') ?? window.currentSuperfloppyMode ?? '0');
        isOcMode = ['1', '2', '3'].includes(superfloppyMode);
    }

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
    await runMiscBackend('apply', 'gpu_unlock', miscPendingState.gpu_unlock);

    await loadMiscState(); // Refresh from backend
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

// --- Sound Control Tweak Logic (FloppyTrinketMi only) ---

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
    await loadSoundControlState(); // Refresh from backend
    showToast(window.t ? window.t('toast.settingsApplied') : 'Applied');
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

// Initialize platform tweaks
function initPlatformTweaks() {
    const doInit = () => {
        setTweakVar('kernelName', window.KERNEL_NAME || '');
        if (window.__tweaksSchema) refreshTweaksAvailability(window.__tweaksSchema);

        // Initialize all platform tweaks - each will show/hide its own card
        initThermalTweak();
        initUndervoltTweak();
        initMiscTweak();
        initSoundControlTweak();
    };

    // Ensure schema is loaded/rendered even if platform init runs before tweaks tab init.
    if (!window.__tweaksSchemaRendered) {
        initTweaksSchemaUI().then(doInit).catch(doInit);
        return;
    }

    doInit();
}

// Global: listen for Unlocked Mode changes (emitted from features.js)
document.addEventListener('superfloppyModeChanged', (e) => {
    const mode = e?.detail?.mode != null ? String(e.detail.mode) : (window.currentSuperfloppyMode != null ? String(window.currentSuperfloppyMode) : '0');
    window.currentSuperfloppyMode = mode;
    setTweakVar('superfloppyMode', mode);
    setTweakVar('isUnlockedOcMode', ['1', '2', '3'].includes(mode));

    if (typeof updateGpuUnlockAvailability === 'function') {
        updateGpuUnlockAvailability();
    }
    if (window.__tweaksSchema) refreshTweaksAvailability(window.__tweaksSchema);
});

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

        const valPending = undervoltPendingState[el] || '0';
        const valCurrent = undervoltCurrentState[el] || '0';

        // Update display values (label shows current kernel state)
        if (valEl) valEl.textContent = valCurrent + '%';

        // Slider shows pending/slider state
        sliderEl.value = valPending;
        if (inputEl) inputEl.value = valPending;


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
