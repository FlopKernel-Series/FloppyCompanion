// device.js - Device Detection and Parsing

// --- Module Prop Parsing ---
async function getModuleProps() {
    try {
        const propContent = await exec('cat /data/adb/modules/floppy_companion/module.prop');
        const props = {};
        if (propContent) {
            propContent.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim();
                    props[key] = val;
                }
            });
        }
        return props;
    } catch (e) {
        console.error("Failed to read module.prop", e);
        return {};
    }
}

// --- Device Info Resolution ---
async function resolveDeviceInfo() {
    let deviceName = null;
    let deviceModel = null;
    let isTrinketMi = false;
    let is1280 = false;
    let isFloppyKernel = false;

    // Try to read device info
    const namePaths = [
        '/sys/kernel/sec_detect/device_name',
        '/sys/mi_detect/device_name'
    ];
    const modelPaths = [
        '/sys/kernel/sec_detect/device_model',
        '/sys/mi_detect/device_model'
    ];

    for (const path of namePaths) {
        deviceName = await exec(`cat ${path}`);
        if (deviceName) break;
    }
    for (const path of modelPaths) {
        deviceModel = await exec(`cat ${path}`);
        if (deviceModel) break;
    }

    if (deviceName) {
        // Theme & Identification Logic
        const TRINKET_DEVICES = ['ginkgo', 'willow', 'sm6125', 'trinket', 'laurel_sprout'];
        const deviceCode = (deviceName || '').toLowerCase();

        isTrinketMi = isTrinketMi || TRINKET_DEVICES.some(code => deviceCode.includes(code));
        is1280 = is1280 || window.FLOPPY1280_DEVICES.includes(deviceName);
    }

    return {
        name: deviceName || 'Unknown',
        model: deviceModel,
        displayName: deviceModel ? `${deviceModel} (${deviceName})` : (deviceName || 'Unknown'),
        isTrinketMi: isTrinketMi,
        is1280: is1280,
    };
}
