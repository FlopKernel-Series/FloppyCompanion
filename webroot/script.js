// Helper to execute verify command
async function exec(command) {
    try {
        if (typeof ksu === 'undefined') {
            throw new Error("ksu object is undefined");
        }

        const result = await ksu.exec(command);
        // logDebug(`Cmd: ${command} | Type: ${typeof result} | Val: ${JSON.stringify(result)}`);

        // Handle Sync Interface (returns String stdout)
        if (typeof result === 'string') {
            return result.trim();
        }

        // Handle Async/Promise Interface (returns Object)
        if (result && typeof result === 'object') {
            const { stdout, stderr, exitCode } = result;
            if (exitCode !== 0) {
                console.error(`Command failed: ${command}`, stderr);
                // logDebug(`Cmd failed: ${command} | Stderr: ${stderr} | Exit: ${exitCode}`);
                return null;
            }
            return stdout ? stdout.trim() : '';
        }

        return null; // Unknown type
    } catch (e) {
        console.error("KSU exec error", e);
        // logDebug(`Exec Error: ${e.message}`);
        // Fallback for browser testing
        if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
            if (command === 'uname -r') return '5.10.247-Floppy-v6.2-RKS-g4184e67c28bf-dirty';
            if (command.startsWith('cat ')) return 'a25x';
        }
        return null;
    }
}

function logDebug(msg) {
    // Debug disabled
}

const VARIANTS = {
    'V': 'Vanilla',
    'KN': 'KernelSU Next',
    'RKS': 'RKSU',
    'SKS': 'SukiSU Ultra'
};

const FLOPPY1280_DEVICES = ['a25x', 'a33x', 'a53x', 'm33x', 'm34x', 'gta4xls', 'a26xs'];

async function init() {
    const navItems = document.querySelectorAll('.nav-item');
    const sliderTrack = document.getElementById('slider-track');
    const TAB_COUNT = 4; // Status, Features, Tweaks, About

    function updateSlide(index) {
        // Update Bottom Nav
        navItems.forEach((nav, i) => {
            if (i === index) nav.classList.add('active');
            else nav.classList.remove('active');
        });

        // Slide Track
        // 0 -> 0%, 1 -> -25%, 2 -> -50%, 3 -> -75%
        const percentage = index * -25;
        sliderTrack.style.transform = `translateX(${percentage}%)`;
    }

    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            updateSlide(index);
        });
    });

    // Touch / Swipe Logic
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let currentIndex = 0;

    const minSwipeDistance = 50; // px

    // Attach to slider container or document
    const sliderContainer = document.querySelector('.slider-container');

    sliderContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        sliderTrack.style.transition = 'none'; // Disable transition for direct follow
    }, { passive: true });

    sliderContainer.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Calculate resistance or limit
        // Current translate percentage
        const baseTranslate = currentIndex * -25; // %
        // Convert diff to percentage of container width
        const containerWidth = sliderContainer.offsetWidth;
        const diffPercent = (diff / containerWidth) * 100 / 4; // /4 because track is 400%

        let newTranslate = baseTranslate + diffPercent;

        // Form boundaries with resistance
        if (newTranslate > 0) newTranslate = newTranslate * 0.3;
        // Max negative is -75% (3 * -25)
        if (newTranslate < -75) newTranslate = -75 + (newTranslate + 75) * 0.3;

        sliderTrack.style.transform = `translateX(${newTranslate}%)`;
    }, { passive: true });

    sliderContainer.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        sliderTrack.style.transition = 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'; // Restore transition

        const diff = currentX - startX;
        // Determine whether to change slide
        if (Math.abs(diff) > minSwipeDistance) {
            if (diff < 0 && currentIndex < TAB_COUNT - 1) {
                currentIndex++;
            } else if (diff > 0 && currentIndex > 0) {
                currentIndex--;
            }
        }

        updateSlide(currentIndex);
    });

    // Sync state on init if needed (defaults to 0)
    updateSlide(0);

    const statusCard = document.getElementById('status-card');
    const errorCard = document.getElementById('error-card');
    const deviceEl = document.getElementById('device-name');
    const linuxVerEl = document.getElementById('linux-version');
    const versionEl = document.getElementById('kernel-version');
    const variantEl = document.getElementById('kernel-variant');
    const buildTypeEl = document.getElementById('build-type');
    // const kernelNameEl = document.getElementById('kernel-name'); // Removed as title is static or handled elsewhere
    const subtitleEl = document.getElementById('managed-kernel-subtitle');

    // 1. Check Device Name & Model
    // Note: User confirmed sec_detect exposes device_model
    const deviceName = await exec('cat /sys/kernel/sec_detect/device_name');
    const deviceModel = await exec('cat /sys/kernel/sec_detect/device_model');

    if (deviceName) {
        const displayName = deviceModel ? `${deviceModel} (${deviceName})` : deviceName;
        deviceEl.textContent = displayName;

        // Theme Logic
        const TRINKET_DEVICES = ['ginkgo', 'willow', 'sm6125', 'trinket']; // FloppyTrinketMi family
        const deviceCode = (deviceName || '').toLowerCase();

        // Check if device is in Trinket list
        const isTrinket = TRINKET_DEVICES.some(code => deviceCode.includes(code));

        if (isTrinket) {
            document.body.classList.add('theme-orange');
            if (subtitleEl) subtitleEl.textContent = "Managing: FloppyTrinketMi";
        } else if (FLOPPY1280_DEVICES.includes(deviceName)) {
            // Apply "Exynos Blue" specific styling if needed via class
            document.body.classList.add('theme-exynos-blue');
            if (subtitleEl) subtitleEl.textContent = 'Managing: Floppy1280';
        } else {
            if (subtitleEl) subtitleEl.textContent = 'Managing: FloppyKernel'; // Generic fallback
        }
    } else {
        deviceEl.textContent = 'Unknown';
    }

    // Setup Exit Button
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (typeof ksu !== 'undefined' && ksu.exit) {
                ksu.exit();
            } else {
                console.log('Exit requested (testing environment)');
                // window.close(); // Often blocked in browsers
            }
        });
    }

    // 2. Check Kernel Version (uname -r)
    // Format: 5.10.247-Floppy-v6.2-RKS-g4184e67c28bf-dirty
    const uname = await exec('uname -r');

    if (!uname) {
        statusCard.classList.add('hidden');
        errorCard.classList.remove('hidden');
        return;
    }

    // Parse Linux Version (always present in uname)
    // "5.10.247-..." -> "5.10.247"
    const linuxVer = uname.split('-')[0];
    if (linuxVerEl) linuxVerEl.textContent = linuxVer;

    if (uname.includes('Floppy')) {
        // Family handling moved to subtitle logic above

        // Parse Version
        // Regex to capture: v[Number]
        const versionMatch = uname.match(/-v(\d+\.\d+)/);
        if (versionMatch) {
            versionEl.textContent = `v${versionMatch[1]}`;
        } else {
            versionEl.textContent = uname;
        }

        // Parse Variant (RKS, V, KN, SKS)
        // We look for the part after the version
        // Example: ...-v6.2-RKS-...
        let variantFound = 'Standard';
        for (const [code, name] of Object.entries(VARIANTS)) {
            // Regex: -CODE- or -CODE$ (end of string)
            const regex = new RegExp(`-${code}(-|$)`);
            if (regex.test(uname)) {
                variantFound = name;
                break;
            }
        }
        variantEl.textContent = variantFound;

        // Parse Release Status
        if (uname.includes('-release')) {
            buildTypeEl.textContent = 'Release Build';
            buildTypeEl.style.color = 'var(--md-sys-color-primary)';
        } else {
            // Unofficial/Testing build
            let label = 'Testing';

            // Extract hash: looks for -g[hash]
            // Example: ...-RKS-g4184e67c28bf...
            const hashMatch = uname.match(/-g([0-9a-f]+)/);
            if (hashMatch) {
                label += ` (${hashMatch[1]})`; // hash without 'g'
            } else {
                label += ' (Git)';
            }

            if (uname.includes('dirty')) {
                label += ' (Dirty)';
                buildTypeEl.style.color = '#e2b349'; // Warning color
            }

            buildTypeEl.textContent = label;
        }

    } else {
        // Not FloppyKernel
        statusCard.classList.add('hidden');
        errorCard.classList.remove('hidden');
    }
}

// On Load
if (typeof ksu !== 'undefined' || window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    init();
} else {
    // Wait for KSU to inject? usually it's there at load time for webview
    window.addEventListener('load', init);
}
