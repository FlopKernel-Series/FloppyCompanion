// core.js - Utilities, KSU wrapper, and Global Constants

// --- Constants ---
window.VARIANTS = {
    'V': 'Vanilla',
    'KN': 'KernelSU Next',
    'MBS': 'MamboSU',
    'RKS': 'RKSU',
    'RESKS': 'ReSukiSU',
    'SKS': 'SukiSU Ultra',
    'XXK': 'XXKSU'
};

window.DATA_DIR = '/data/adb/modules/floppy_companion';

window.FLOPPY1280_DEVICES = ['a25x', 'a33x', 'a53x', 'm33x', 'm34x', 'gta4xls', 'a26xs'];
window.FLOPPY2100_DEVICES = ['r9s', 'o1s', 'p3s', 't2s'];

// --- KSU Execution Wrapper ---
let callbackCounter = 0;
function getUniqueCallbackName(prefix) {
    return `${prefix}_callback_${Date.now()}_${callbackCounter++}`;
}

window.FCLog = window.FCLog || (() => {
    let sequence = 0;

    const isEnabled = () => {
        try {
            return localStorage.getItem('fc_debug_console') !== '0';
        } catch {
            return true;
        }
    };
    const nextId = () => ++sequence;
    const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const duration = (startedAt) => `${Math.round(now() - startedAt)}ms`;
    const trimOutput = (value) => {
        const text = String(value ?? '').trim();
        if (text.length <= 4000) return text;
        return `${text.slice(0, 4000)}\n... [truncated ${text.length - 4000} chars]`;
    };

    const write = (method, ...args) => {
        if (!isEnabled()) return;
        const logger = console[method] || console.log;
        logger.call(console, ...args);
    };

    const group = (title, body, method = 'debug') => {
        if (!isEnabled()) return;
        const canGroup = typeof console.groupCollapsed === 'function' && typeof console.groupEnd === 'function';
        if (canGroup) console.groupCollapsed(title);
        else write(method, title);

        try {
            body();
        } finally {
            if (canGroup) console.groupEnd();
        }
    };

    return {
        nextId,
        now,
        duration,
        trimOutput,
        debug: (...args) => write('debug', '[FC]', ...args),
        info: (...args) => write('info', '[FC]', ...args),
        warn: (...args) => write('warn', '[FC]', ...args),
        error: (...args) => write('error', '[FC]', ...args),
        group
    };
})();

if (!window.__fcGlobalConsoleLoggingBound) {
    window.__fcGlobalConsoleLoggingBound = true;

    window.addEventListener('error', (event) => {
        window.FCLog.error('uncaught error', {
            message: event.message,
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        window.FCLog.error('unhandled promise rejection', event.reason);
    });
}

// Global exec function
window.exec = async function (command) {
    const log = window.FCLog;
    const execId = log.nextId();
    const startedAt = log.now();
    log.debug(`shell #${execId} start`, command);

    if (window.__FC_SIM_ACTIVE && typeof window.__FC_SIM_EXEC === 'function') {
        try {
            const output = await window.__FC_SIM_EXEC(command);
            const trimmedOutput = output ? String(output).trim() : '';
            log.group(`[FC] shell #${execId} simulator ok (${log.duration(startedAt)})`, () => {
                console.debug('command:', command);
                if (trimmedOutput) console.debug('stdout:', log.trimOutput(trimmedOutput));
            });
            return trimmedOutput;
        } catch (e) {
            log.group(`[FC] shell #${execId} simulator error (${log.duration(startedAt)})`, () => {
                console.debug('command:', command);
                console.error(e);
            }, 'error');
            return null;
        }
    }

    if (typeof ksu === 'undefined') {
        log.error(`shell #${execId} failed: ksu object is undefined`, command);
        return null;
    }

    return new Promise((resolve, reject) => {
        const callbackFuncName = getUniqueCallbackName("exec");

        window[callbackFuncName] = (errno, stdout, stderr) => {
            delete window[callbackFuncName];

            if (errno !== 0) {
                log.group(`[FC] shell #${execId} failed errno ${errno} (${log.duration(startedAt)})`, () => {
                    console.debug('command:', command);
                    if (stdout) console.debug('stdout:', log.trimOutput(stdout));
                    if (stderr) console.error('stderr:', log.trimOutput(stderr));
                }, 'error');
                resolve(null);
            } else {
                const trimmedStdout = stdout ? stdout.trim() : '';
                log.group(`[FC] shell #${execId} ok (${log.duration(startedAt)})`, () => {
                    console.debug('command:', command);
                    if (trimmedStdout) console.debug('stdout:', log.trimOutput(trimmedStdout));
                    if (stderr) console.warn('stderr:', log.trimOutput(stderr));
                });
                resolve(trimmedStdout);
            }
        };

        try {
            ksu.exec(command, JSON.stringify({}), callbackFuncName);
        } catch (e) {
            delete window[callbackFuncName];
            log.group(`[FC] shell #${execId} bridge error (${log.duration(startedAt)})`, () => {
                console.debug('command:', command);
                console.error(e);
            }, 'error');
            resolve(null);
        }
    });
};

// --- Modal Utilities ---

// Reusable Confirmation Modal
window.showConfirmModal = function (options = {}) {
    return new Promise((resolve) => {
        const confirmModal = document.getElementById('confirm-modal');
        const confirmModalIcon = document.getElementById('confirm-modal-icon');
        const confirmModalTitle = document.getElementById('confirm-modal-title');
        const confirmModalBody = document.getElementById('confirm-modal-body');

        const {
            title = 'Confirmation',
            body = 'Are you sure?',
            icon = null,
            iconName = null,
            iconClass = '',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            showCancel = true,
            extraButton = null // { text: 'Extra', value: 'extra' }
        } = options;

        confirmModalTitle.textContent = title;
        confirmModalBody.innerHTML = body;

        let resolvedIcon = icon;
        if (!resolvedIcon) {
            let name = iconName;
            if (!name) {
                if (iconClass === 'warning') name = 'warning';
                else if (iconClass === 'info') name = 'info';
                else if (iconClass === 'success') name = 'success';
                else name = 'check_circle';
            }

            if (window.FC && window.FC.icons && window.FC.icons.svgString) {
                resolvedIcon = window.FC.icons.svgString(String(name), { width: 48, height: 48, fill: 'currentColor' });
            }
        }

        if (!resolvedIcon) {
            // Hard fallback if icons registry is unavailable.
            resolvedIcon = '<svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';
        }

        confirmModalIcon.innerHTML = resolvedIcon;
        confirmModalIcon.className = 'modal-icon' + (iconClass ? ' ' + iconClass : '');

        // Query buttons fresh each time
        let cancelBtn = document.getElementById('confirm-modal-cancel');
        let confirmBtn = document.getElementById('confirm-modal-confirm');
        let extraBtn = document.getElementById('confirm-modal-extra');

        cancelBtn.textContent = cancelText;
        cancelBtn.classList.toggle('hidden', !showCancel);
        confirmBtn.textContent = confirmText;

        // Handle extra button
        if (extraButton && extraBtn) {
            extraBtn.textContent = extraButton.text;
            extraBtn.classList.remove('hidden');
        } else if (extraBtn) {
            extraBtn.classList.add('hidden');
        }

        confirmModal.classList.remove('hidden');

        // Clone and replace buttons to remove old event listeners
        const newCancel = cancelBtn.cloneNode(true);
        const newConfirm = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        newCancel.classList.toggle('hidden', !showCancel);

        newCancel.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            resolve(false);
        });

        newConfirm.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            resolve(true);
        });

        // Handle extra button
        if (extraButton && extraBtn) {
            const newExtra = extraBtn.cloneNode(true);
            extraBtn.parentNode.replaceChild(newExtra, extraBtn);
            newExtra.classList.remove('hidden');
            newExtra.addEventListener('click', () => {
                confirmModal.classList.add('hidden');
                resolve(extraButton.value || 'extra');
            });
        }
    });
};

// Processing Modal Helpers
window.logToModal = function (text) {
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
        if (terminalOutput.textContent && !terminalOutput.textContent.endsWith('\n')) {
            terminalOutput.textContent += '\n';
        }
        terminalOutput.textContent += text + '\n';
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
};

window.openModal = function () {
    const modal = document.getElementById('processing-modal');
    const terminalOutput = document.getElementById('terminal-output');
    const modalClose = document.getElementById('modal-close');

    if (modal) {
        modal.classList.remove('hidden');
        if (terminalOutput) terminalOutput.textContent = '';
        if (modalClose) modalClose.classList.add('hidden');
    }
};

window.safeHTML = function (str) {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
