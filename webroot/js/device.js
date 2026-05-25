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
    let is2100 = false;
    let uname = '';

    try {
        const output = await exec([
            'name=""',
            'for p in /sys/kernel/sec_detect/device_name /sys/mi_detect/device_name; do [ -r "$p" ] || continue; name=$(cat "$p" 2>/dev/null); [ -n "$name" ] && break; done',
            'model=""',
            'for p in /sys/kernel/sec_detect/device_model /sys/mi_detect/device_model; do [ -r "$p" ] || continue; model=$(cat "$p" 2>/dev/null); [ -n "$model" ] && break; done',
            'printf "name=%s\\nmodel=%s\\nuname=%s\\n" "$name" "$model" "$(uname -r)"'
        ].join('; '));

        if (output) {
            output.split('\n').forEach(line => {
                const idx = line.indexOf('=');
                if (idx < 0) return;
                const key = line.slice(0, idx);
                const value = line.slice(idx + 1).trim();
                if (key === 'name') deviceName = value || null;
                if (key === 'model') deviceModel = value || null;
                if (key === 'uname') uname = value;
            });
        }
    } catch (e) {
        console.error("Failed to read device info", e);
    }

    if (deviceName) {
        // Theme & Identification Logic
        const TRINKET_DEVICES = ['ginkgo', 'willow', 'sm6125', 'trinket', 'laurel_sprout'];
        const deviceCode = (deviceName || '').trim().toLowerCase();

        isTrinketMi = isTrinketMi || TRINKET_DEVICES.some(code => deviceCode.includes(code));
        is1280 = is1280 || window.FLOPPY1280_DEVICES.includes(deviceCode);
        is2100 = is2100 || window.FLOPPY2100_DEVICES.includes(deviceCode);
    }

    let familyKey = null;
    let kernelName = null;
    let featuresSupported = false;

    if (isTrinketMi) {
        familyKey = 'trinket';
        kernelName = 'FloppyTrinketMi';
        featuresSupported = true;
    } else if (is2100) {
        familyKey = '2100';
        kernelName = 'Floppy2100';
        featuresSupported = true;
    } else if (is1280) {
        familyKey = '1280';
        kernelName = 'Floppy1280';
        featuresSupported = true;
    }

    return {
        name: deviceName || 'Unknown',
        model: deviceModel,
        displayName: deviceModel ? `${deviceModel} (${deviceName})` : (deviceName || 'Unknown'),
        isTrinketMi: isTrinketMi,
        is1280: is1280,
        is2100: is2100,
        familyKey: familyKey,
        kernelName: kernelName,
        featuresSupported: featuresSupported,
        uname: uname,
    };
}
