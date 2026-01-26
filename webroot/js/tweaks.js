// tweaks.js - Core Tweaks Tab Logic

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

    const titleWrap = document.createElement('div');
    titleWrap.className = 'card-title-wrap';

    const title = document.createElement('span');
    title.className = 'card-title';
    if (card.titleKey) title.setAttribute('data-i18n', card.titleKey);
    titleWrap.appendChild(title);

    if (card.tooltipKey) {
        const wrapper = document.createElement('div');
        wrapper.className = 'status-icon-wrapper';

        const bubbleId = `${card.cardId}-bubble`;
        wrapper.innerHTML = `
            <svg class="status-icon info" onclick="toggleBubble('${bubbleId}', event)" viewBox="0 0 24 24">
                <path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            <div id="${bubbleId}" class="status-bubble center hidden" data-i18n="${card.tooltipKey}"></div>
        `;
        titleWrap.appendChild(wrapper);
    }

    header.appendChild(titleWrap);

    if (card.pendingId) {
        const pending = document.createElement('div');
        pending.id = card.pendingId;
        pending.className = 'pending-indicator hidden';

        // Create the icon SVG
        const svg = window.FC && window.FC.icons && window.FC.icons.createSvg
            ? window.FC.icons.createSvg('save_as', { className: 'pending-icon' })
            : null;
        if (svg) {
            pending.appendChild(svg);
        }

        // Create tooltip bubble
        const tooltip = document.createElement('span');
        tooltip.className = 'pending-tooltip';
        tooltip.setAttribute('data-i18n', 'tweaks.unsaved');
        tooltip.textContent = window.t ? window.t('tweaks.unsaved') : 'Unsaved';
        pending.appendChild(tooltip);

        // Toggle tooltip on click
        pending.addEventListener('click', (e) => {
            e.stopPropagation();
            pending.classList.toggle('show-tooltip');
        });

        // Hide tooltip when clicking elsewhere
        document.addEventListener('click', () => {
            pending.classList.remove('show-tooltip');
        });

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

    if (window.FC && window.FC.icons && window.FC.icons.createSvg) {
        return window.FC.icons.createSvg(String(iconKey), { className: 'icon-svg' });
    }

    return null;
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

// =========================
// Shared Utilities
// =========================

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

// =========================
// Initialization
// =========================

// Initialize tweaks tab
async function initTweaksTab() {
    // Build the tweaks DOM from schema/templates before any tweak init binds event listeners.
    await initTweaksSchemaUI();

    // Initialize preset system first (to load defaults)
    if (typeof window.initPresets === 'function') {
        await window.initPresets();
    }

    if (typeof initZramTweak === 'function') initZramTweak();
    if (typeof initMemoryTweak === 'function') initMemoryTweak();
    if (typeof initIoSchedulerTweak === 'function') initIoSchedulerTweak();
}

// Initialize platform tweaks
function initPlatformTweaks() {
    const doInit = () => {
        setTweakVar('kernelName', window.KERNEL_NAME || '');
        if (window.__tweaksSchema) refreshTweaksAvailability(window.__tweaksSchema);

        // Initialize all platform tweaks - each will show/hide its own card
        if (typeof initThermalTweak === 'function') initThermalTweak();
        if (typeof initUndervoltTweak === 'function') initUndervoltTweak();
        if (typeof initMiscTweak === 'function') initMiscTweak();
        if (typeof initChargingTweak === 'function') initChargingTweak();
        if (typeof initDisplayTweak === 'function') initDisplayTweak();
        if (typeof initSoundControlTweak === 'function') initSoundControlTweak();
        if (typeof initAdrenoTweak === 'function') initAdrenoTweak();
        if (typeof initMiscTrinketTweak === 'function') initMiscTrinketTweak();
    };

    // Ensure schema is loaded/rendered even if platform init runs before tweaks tab init.
    if (!window.__tweaksSchemaRendered) {
        return initTweaksSchemaUI().then(() => {
            doInit();
        }).catch(() => {
            doInit();
        });
    }

    doInit();
    return Promise.resolve();
}

// Export globally
window.initPlatformTweaks = initPlatformTweaks;

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

// Auto-init only for general tweaks
// Platform tweaks are initialized by main.js after device detection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTweaksTab();
    });
} else {
    initTweaksTab();
}
