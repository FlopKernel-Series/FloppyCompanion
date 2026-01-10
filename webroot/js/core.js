// core.js - Utilities, KSU wrapper, and Global Constants

// --- Constants ---
window.VARIANTS = {
    'V': 'Vanilla',
    'KN': 'KernelSU Next',
    'RKS': 'RKSU',
    'SKS': 'SukiSU Ultra'
};

window.FLOPPY1280_DEVICES = ['a25x', 'a33x', 'a53x', 'm33x', 'm34x', 'gta4xls', 'a26xs'];

// --- KSU Execution Wrapper ---
let callbackCounter = 0;
function getUniqueCallbackName(prefix) {
    return `${prefix}_callback_${Date.now()}_${callbackCounter++}`;
}

// Global exec function
window.exec = async function (command) {
    if (typeof ksu === 'undefined') {
        console.error("ksu object is undefined");
        return null;
    }

    return new Promise((resolve, reject) => {
        const callbackFuncName = getUniqueCallbackName("exec");

        window[callbackFuncName] = (errno, stdout, stderr) => {
            delete window[callbackFuncName];

            if (errno !== 0) {
                console.error(`Command failed (errno ${errno}): ${command}`, stderr);
                resolve(null);
            } else {
                resolve(stdout ? stdout.trim() : '');
            }
        };

        try {
            ksu.exec(command, JSON.stringify({}), callbackFuncName);
        } catch (e) {
            delete window[callbackFuncName];
            console.error("KSU exec error", e);
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
            icon = '<svg viewBox="0 0 24 24" width="48" height="48"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>',
            iconClass = '',
            confirmText = 'Confirm',
            cancelText = 'Cancel'
        } = options;

        confirmModalTitle.textContent = title;
        confirmModalBody.innerHTML = body;
        confirmModalIcon.innerHTML = icon;
        confirmModalIcon.className = 'modal-icon' + (iconClass ? ' ' + iconClass : '');

        // Query buttons fresh each time
        let cancelBtn = document.getElementById('confirm-modal-cancel');
        let confirmBtn = document.getElementById('confirm-modal-confirm');

        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;

        confirmModal.classList.remove('hidden');

        // Clone and replace buttons to remove old event listeners
        const newCancel = cancelBtn.cloneNode(true);
        const newConfirm = confirmBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

        newCancel.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            resolve(false);
        });

        newConfirm.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            resolve(true);
        });
    });
};

// Processing Modal Helpers
window.logToModal = function (text) {
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
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
