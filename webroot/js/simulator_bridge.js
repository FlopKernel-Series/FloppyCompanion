// simulator_bridge.js - Browser-only simulation bridge for quick WebUI demos

(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const simEnabled = params.get('sim') === '1';
    if (!simEnabled) return;

    const FAMILY_TO_KERNEL = {
        '1280': 'Floppy1280',
        '2100': 'Floppy2100',
        'trinket': 'FloppyTrinketMi'
    };

    const PROFILE_DEFAULTS = {
        '1280': {
            family: '1280',
            kernelName: 'Floppy1280',
            deviceCode: 'a53x',
            deviceModel: 'Galaxy A53',
            uname: '5.10.0-Floppy1280-v6.2-KN-release',
            cmdlineBase: 'console=ttySAC2 cgroup.memory=nokmem',
            features: {
                superfloppy: '0',
                force_perm: '0',
                ems_efficient: '0',
                aosp_mode: '0'
            }
        },
        '2100': {
            family: '2100',
            kernelName: 'Floppy2100',
            deviceCode: 'r9s',
            deviceModel: 'Galaxy S21 FE',
            uname: '5.4.0-Floppy2100-v1.0-KN-release',
            cmdlineBase: 'console=ttySAC2 cgroup.memory=nokmem',
            features: {
                uname_bpf_spoof: '1',
                mass_storage_hack: '0',
                init_protection: '1',
                selinux_mode: '0'
            }
        },
        'trinket': {
            family: 'trinket',
            kernelName: 'FloppyTrinketMi',
            deviceCode: 'ginkgo',
            deviceModel: 'Redmi Note 8',
            uname: '4.14.0-FloppyTrinketMi-v2.0b-KN-release',
            cmdlineBase: 'console=ttyMSM0',
            features: {
                no_init_protection: '0',
                legacy_timestamp_source: '0',
                no_msm_perf_boost: '0',
                warm_reboot: '0',
                uname_bpf_spoof: '1'
            }
        }
    };

    function tryParseSimConfig() {
        const raw = params.get('simcfg');
        if (!raw) return null;
        try {
            const decoded = atob(raw);
            const parsed = JSON.parse(decoded);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    function buildSimConfig() {
        const parsed = tryParseSimConfig() || {};
        const familyFromParam = params.get('family');
        const requestedFamily = parsed.family || familyFromParam || '2100';
        const family = PROFILE_DEFAULTS[requestedFamily] ? requestedFamily : '2100';
        const profile = PROFILE_DEFAULTS[family];

        return {
            family,
            kernelName: parsed.kernelName || profile.kernelName || FAMILY_TO_KERNEL[family],
            deviceCode: (parsed.deviceCode || profile.deviceCode || '').toLowerCase(),
            deviceModel: parsed.deviceModel || profile.deviceModel || 'Simulator Device',
            resolution: parsed.resolution || params.get('resolution') || '1080x2340',
            dpi: Number(parsed.dpi || params.get('dpi') || 411) || 411,
            uname: parsed.uname || profile.uname,
            cmdlineBase: parsed.cmdlineBase || profile.cmdlineBase,
            features: { ...profile.features, ...(parsed.features || {}) }
        };
    }

    function keyValueLines(obj) {
        return Object.entries(obj || {})
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
    }

    function shellSplit(command) {
        const tokens = [];
        const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
        let match;
        while ((match = regex.exec(command)) !== null) {
            tokens.push(match[1] || match[2] || match[3] || '');
        }
        return tokens;
    }

    function parseKeyValueArgs(args) {
        const parsed = {};
        (args || []).forEach((arg) => {
            if (!arg || !arg.includes('=')) return;
            const idx = arg.indexOf('=');
            const key = arg.slice(0, idx);
            const value = arg.slice(idx + 1);
            if (key) parsed[key] = value;
        });
        return parsed;
    }

    function makeDefaultState(config) {
        const isExynos = config.family === '1280' || config.family === '2100';
        const isTrinket = config.family === 'trinket';

        const state = {
            config,
            features: { ...(config.features || {}) },
            liveFeatures: { ...(config.features || {}) },
            persistedFeatures: {},
            files: {},
            tweakCurrent: {
                zram: {
                    enabled: '1',
                    disksize: '3221225472',
                    algorithm: 'lz4',
                    available: 'lz4,lzo-rle,lz4hc'
                },
                memory: {
                    swappiness: '60',
                    dirty_ratio: '20',
                    dirty_bytes: '0',
                    dirty_background_ratio: '10',
                    dirty_background_bytes: '0',
                    dirty_writeback_centisecs: '500',
                    dirty_expire_centisecs: '3000',
                    stat_interval: '1',
                    vfs_cache_pressure: '100',
                    watermark_scale_factor: '10'
                },
                lmkd: {
                    use_psi: '1',
                    use_minfree_levels: '0',
                    critical_upgrade: '0',
                    kill_heaviest_task: '0',
                    low: '1001',
                    medium: '800',
                    critical: '0',
                    upgrade_pressure: '100',
                    downgrade_pressure: '100',
                    kill_timeout_ms: '0',
                    psi_partial_stall_ms: '70',
                    psi_complete_stall_ms: '700',
                    thrashing_limit: '100',
                    thrashing_limit_decay: '10',
                    swap_util_max: '100',
                    swap_free_low_percentage: '20'
                },
                iosched: {
                    '/dev/block/sda': 'mq-deadline',
                    '/dev/block/sdb': 'none'
                },
                thermal: {
                    mode: '1',
                    custom_freq: '2288000'
                },
                thermal_control: {
                    big_offset: '-10000',
                    mid_offset: '-10000',
                    little_offset: '-8000',
                    g3d_offset: '-13000'
                },
                undervolt: {
                    little: '0',
                    big: '0',
                    prime: '0',
                    gpu: '0'
                },
                misc: {
                    block_ed3: '0',
                    htpr: '0',
                    esg_short_burst: '0',
                    gpu_clklck: '0',
                    gpu_unlock: '0',
                    throttlers_protection: '0'
                },
                soundcontrol: {
                    hp_l: '0',
                    hp_r: '0',
                    mic: '0'
                },
                charging: {
                    bypass: '0',
                    fast: '0'
                },
                display: {
                    hbm: '0',
                    cabc: '0'
                },
                adreno: {
                    adrenoboost: '0',
                    idler_active: 'N',
                    idler_downdifferential: '20',
                    idler_idlewait: '15',
                    idler_idleworkload: '5000'
                },
                misc_trinket: {
                    touchboost: '0'
                }
            },
            tweakSaved: {
                zram: {},
                memory: {},
                lmkd: {},
                iosched: {},
                thermal: {},
                thermal_control: {},
                undervolt: {},
                misc: {},
                soundcontrol: {},
                charging: {},
                display: {},
                adreno: {},
                misc_trinket: {}
            },
            ioDevices: [
                { device: '/dev/block/sda', active: 'mq-deadline', available: 'mq-deadline,none,bfq' },
                { device: '/dev/block/sdb', active: 'none', available: 'none,mq-deadline,bfq' }
            ]
        };

        if (!isExynos) {
            delete state.tweakCurrent.thermal;
            delete state.tweakCurrent.thermal_control;
            delete state.tweakCurrent.undervolt;
            delete state.tweakCurrent.misc;
            state.tweakSaved.thermal = {};
            state.tweakSaved.thermal_control = {};
            state.tweakSaved.undervolt = {};
            state.tweakSaved.misc = {};
        }

        if (config.family !== '2100') {
            delete state.tweakCurrent.thermal_control;
            state.tweakSaved.thermal_control = {};
        }

        if (!isTrinket) {
            delete state.tweakCurrent.soundcontrol;
            delete state.tweakCurrent.charging;
            delete state.tweakCurrent.display;
            delete state.tweakCurrent.adreno;
            delete state.tweakCurrent.misc_trinket;
            state.tweakSaved.soundcontrol = {};
            state.tweakSaved.charging = {};
            state.tweakSaved.display = {};
            state.tweakSaved.adreno = {};
            state.tweakSaved.misc_trinket = {};
        }

        const defaultPresetTweaks = {
            zram: { ...state.tweakCurrent.zram },
            memory: { ...state.tweakCurrent.memory },
            lmkd: { ...state.tweakCurrent.lmkd },
            iosched: {
                '/dev/block/sda': 'mq-deadline',
                '/dev/block/sdb': 'none'
            }
        };

        if (isExynos) {
            defaultPresetTweaks.undervolt = { ...state.tweakCurrent.undervolt };
            defaultPresetTweaks.misc = { block_ed3: state.tweakCurrent.misc.block_ed3 };
            defaultPresetTweaks.exynos = {
                htpr: state.tweakCurrent.misc.htpr,
                esg_short_burst: state.tweakCurrent.misc.esg_short_burst,
                gpu_clklck: state.tweakCurrent.misc.gpu_clklck,
                gpu_unlock: state.tweakCurrent.misc.gpu_unlock,
                throttlers_protection: state.tweakCurrent.misc.throttlers_protection
            };
            if (config.family === '1280') {
                defaultPresetTweaks.thermal = { ...state.tweakCurrent.thermal };
            }
            if (config.family === '2100') {
                defaultPresetTweaks.thermal_control = {
                    performance_mode: '0',
                    little: '-8',
                    big: '-10',
                    prime: '-10',
                    g3d: '-13'
                };
            }
        }

        if (isTrinket) {
            defaultPresetTweaks.soundcontrol = { ...state.tweakCurrent.soundcontrol };
            defaultPresetTweaks.charging = { ...state.tweakCurrent.charging };
            defaultPresetTweaks.display = { ...state.tweakCurrent.display };
            defaultPresetTweaks.adreno = { ...state.tweakCurrent.adreno };
            defaultPresetTweaks.misc_trinket = { ...state.tweakCurrent.misc_trinket };
        }

        const defaultsJson = {
            name: 'Default',
            version: 1,
            builtIn: true,
            capturedAt: new Date().toISOString(),
            tweaks: defaultPresetTweaks
        };

        state.files['/data/adb/modules/floppy_companion/module.prop'] = [
            'id=floppy_companion',
            'name=FloppyCompanion',
            'version=v1.0.2-sim',
            'versionCode=10200',
            'author=Flopster101',
            'description=Simulator session'
        ].join('\n');

        state.files['/data/adb/floppy_companion/presets/.defaults.json'] = JSON.stringify(defaultsJson, null, 2);
        state.files['/data/adb/modules/floppy_companion/.patch_log'] = '';

        state.procCmdline = buildProcCmdline(state);
        return state;
    }

    function buildProcCmdline(state) {
        const tokenText = Object.entries(state.features)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
        const base = state.config.cmdlineBase || 'console=ttyS0';
        return `${base} ${tokenText}`.trim();
    }

    const config = buildSimConfig();
    const state = makeDefaultState(config);

    window.__FC_SIM_ACTIVE = true;
    window.__FC_SIM_CONFIG = config;

    function setPatchLog(lines) {
        state.files['/data/adb/modules/floppy_companion/.patch_log'] = lines.join('\n');
    }

    function handleFeaturesBackend(action, args) {
        if (action === 'unpack') {
            setPatchLog(['[FC] Unpacking boot image...', '[FC] Unpack successful.']);
            return 'Unpack successful.';
        }

        if (action === 'read_features') {
            const mode = args[0] || 'kernel';
            let payload = '';
            if (mode === 'header') {
                payload = state.procCmdline;
            } else if (mode === 'kernel') {
                payload = state.procCmdline;
            } else if (mode === 'kernel_tokens') {
                payload = keyValueLines(state.features);
            }
            return `---FEATURES_START---\n${payload}\n---FEATURES_END---`;
        }

        if (action === 'read_live_features') {
            return `---FEATURES_START---\n${keyValueLines(state.liveFeatures)}\n---FEATURES_END---`;
        }

        if (action === 'patch') {
            const patchArgs = parseKeyValueArgs(args.slice(1));
            Object.entries(patchArgs).forEach(([k, v]) => {
                state.features[k] = String(v);
                state.liveFeatures[k] = String(v);
            });
            state.procCmdline = buildProcCmdline(state);
            setPatchLog([
                `[FC] Applying patches (${args[0] || 'kernel'} mode)...`,
                `[FC] Patched keys: ${Object.keys(patchArgs).join(', ') || 'none'}`,
                '[FC] Success! Reboot required.'
            ]);
            return 'Success! Reboot required.';
        }

        if (action === 'cleanup') return '';
        return 'Error: Unsupported simulator backend action';
    }

    function applyPositionalTweak(scriptName, action, args) {
        const current = state.tweakCurrent[scriptName] || {};

        if (scriptName === 'zram' && action === 'apply') {
            current.disksize = args[0] || current.disksize || '0';
            current.algorithm = args[1] || current.algorithm || 'lz4';
            current.enabled = args[2] || current.enabled || '1';
            return;
        }

        if (scriptName === 'thermal' && action === 'apply') {
            current.mode = args[0] || current.mode || '1';
            current.custom_freq = args[1] || current.custom_freq || '2288000';
            return;
        }

        if (scriptName === 'undervolt' && action === 'apply') {
            current.little = args[0] || current.little || '0';
            current.big = args[1] || current.big || '0';
            current.prime = args[2] || current.prime || '0';
            current.gpu = args[3] || current.gpu || '0';
            return;
        }

        if (scriptName === 'thermal_control' && action === 'apply') {
            const little = parseInt(args[0] || '-8', 10) || 0;
            const big = parseInt(args[1] || '-10', 10) || 0;
            const prime = parseInt(args[2] || '-10', 10) || 0;
            const g3d = parseInt(args[3] || '-13', 10) || 0;
            current.little_offset = String(little * 1000);
            current.mid_offset = String(big * 1000);
            current.big_offset = String(prime * 1000);
            current.g3d_offset = String(g3d * 1000);
            return;
        }

        if (scriptName === 'misc' && (action === 'save' || action === 'apply')) {
            const key = args[0];
            const val = args[1] || '0';
            if (key) {
                if (action === 'save') state.tweakSaved.misc[key] = val;
                else current[key] = val;
            }
            return;
        }

        if (scriptName === 'soundcontrol' && action === 'apply') {
            current.hp_l = args[0] || current.hp_l || '0';
            current.hp_r = args[1] || current.hp_r || '0';
            current.mic = args[2] || current.mic || '0';
            return;
        }

        if (scriptName === 'charging' && (action === 'save' || action === 'apply')) {
            const target = action === 'save' ? state.tweakSaved.charging : current;
            target.bypass = args[0] || target.bypass || '0';
            target.fast = args[1] || target.fast || '0';
            return;
        }

        if (scriptName === 'display' && (action === 'save' || action === 'apply')) {
            const target = action === 'save' ? state.tweakSaved.display : current;
            target.hbm = args[0] || target.hbm || '0';
            target.cabc = args[1] || target.cabc || '0';
            return;
        }

        if (scriptName === 'adreno' && action === 'apply') {
            current.adrenoboost = args[0] || current.adrenoboost || '0';
            current.idler_active = args[1] || current.idler_active || 'N';
            current.idler_downdifferential = args[2] || current.idler_downdifferential || '20';
            current.idler_idlewait = args[3] || current.idler_idlewait || '15';
            current.idler_idleworkload = args[4] || current.idler_idleworkload || '5000';
            return;
        }

        if (scriptName === 'misc_trinket' && (action === 'save' || action === 'apply')) {
            const key = args[0];
            const val = args[1] || '0';
            if (!key) return;
            if (action === 'save') state.tweakSaved.misc_trinket[key] = val;
            else current[key] = val;
        }
    }

    function handleTweakBackend(scriptName, action, args) {
        if (action === 'is_available') {
            const available =
                (scriptName === 'thermal' && state.config.family === '1280') ||
                (scriptName === 'thermal_control' && state.config.family === '2100') ||
                (scriptName === 'undervolt' && (state.config.family === '1280' || state.config.family === '2100')) ||
                (['soundcontrol', 'charging', 'display', 'adreno', 'misc_trinket'].includes(scriptName) && state.config.family === 'trinket');
            return `available=${available ? '1' : '0'}`;
        }

        if (action === 'get_capabilities') {
            if (scriptName === 'undervolt') {
                return 'little=1\nbig=1\nprime=1\ngpu=1';
            }
            if (scriptName === 'misc') {
                if (state.config.family === '2100') {
                    return 'block_ed3=1\nhtpr=1\nesg_short_burst=1\ngpu_clklck=1\ngpu_unlock=1\nthrottlers_protection=1';
                }
                return 'block_ed3=1\nhtpr=1\ngpu_clklck=1\ngpu_unlock=1\nthrottlers_protection=1';
            }
            return '';
        }

        if (action === 'get_support' && scriptName === 'lmkd') {
            return 'legacy_minfree_supported=1\npsi_disable_supported=1';
        }

        if (action === 'get_all' && scriptName === 'iosched') {
            return state.ioDevices
                .map((d) => `device=${d.device}\nactive=${d.active}\navailable=${d.available}\n---`)
                .join('\n');
        }

        if (action === 'get_current') {
            return keyValueLines(state.tweakCurrent[scriptName] || {});
        }

        if (action === 'get_saved') {
            return keyValueLines(state.tweakSaved[scriptName] || {});
        }

        if (action === 'clear_saved_key' && scriptName === 'misc') {
            const key = args[0];
            if (key && state.tweakSaved.misc) delete state.tweakSaved.misc[key];
            return 'ok';
        }

        if (action === 'clear_saved') {
            state.tweakSaved[scriptName] = {};
            return 'cleared';
        }

        if (action === 'save' || action === 'apply') {
            const kv = parseKeyValueArgs(args);
            const hasKeyValueArgs = Object.keys(kv).length > 0;

            if (hasKeyValueArgs) {
                if (action === 'save') {
                    state.tweakSaved[scriptName] = { ...(state.tweakSaved[scriptName] || {}), ...kv };
                } else {
                    state.tweakCurrent[scriptName] = { ...(state.tweakCurrent[scriptName] || {}), ...kv };
                    if (scriptName === 'iosched') {
                        state.ioDevices = state.ioDevices.map((d) => ({
                            ...d,
                            active: kv[d.device] || d.active
                        }));
                    }
                }
            } else {
                applyPositionalTweak(scriptName, action, args);
            }

            if (scriptName === 'memory' || scriptName === 'lmkd') {
                return action === 'save' ? 'Saved' : 'Applied';
            }
            if (scriptName === 'zram' || scriptName === 'iosched') {
                return action === 'save' ? 'saved' : 'applied';
            }

            return action === 'save' ? 'saved' : 'applied';
        }

        if (action === 'apply_saved') {
            const saved = state.tweakSaved[scriptName] || {};
            if (scriptName === 'thermal_control') {
                const defaults = (
                    JSON.parse(state.files['/data/adb/floppy_companion/presets/.defaults.json'] || '{}').tweaks || {}
                ).thermal_control || { performance_mode: '0', little: '-8', big: '-10', prime: '-10', g3d: '-13' };
                if ((saved.performance_mode || '0') === '1') {
                    applyPositionalTweak(scriptName, 'apply', ['0', '0', '0', '0']);
                    return 'applied';
                }
                applyPositionalTweak(scriptName, 'apply', [
                    saved.little || defaults.little || '-8',
                    saved.big || defaults.big || '-10',
                    saved.prime || defaults.prime || '-10',
                    saved.g3d || defaults.g3d || '-13'
                ]);
                return 'applied';
            }
            state.tweakCurrent[scriptName] = { ...(state.tweakCurrent[scriptName] || {}), ...saved };
            return 'applied';
        }

        return '';
    }

    function handlePersistenceScript(action, args) {
        if (action === 'save') {
            const key = args[0];
            const val = args[1] || '0';
            const persistType = args[2] || 'toggle';
            if (key) {
                state.persistedFeatures[key] = { val, persistType };
            }
            return `Saved ${key || ''}`.trim();
        }

        if (action === 'remove') {
            const key = args[0];
            if (key) delete state.persistedFeatures[key];
            return `Removed ${key || ''}`.trim();
        }

        return 'ok';
    }

    function handlePresetHereDoc(cmd) {
        const match = cmd.match(/cat > "([^"]+)" << 'PRESET_EOF'\n([\s\S]*?)\nPRESET_EOF/m);
        if (!match) return '';
        const path = match[1];
        const content = match[2];
        state.files[path] = content;
        return 'saved';
    }

    function handleCatCommand(cmd) {
        if (cmd.includes('/sys/kernel/sec_detect/device_name') || cmd.includes('/sys/mi_detect/device_name')) {
            return state.config.deviceCode;
        }
        if (cmd.includes('/sys/kernel/sec_detect/device_model') || cmd.includes('/sys/mi_detect/device_model')) {
            return state.config.deviceModel;
        }
        if (cmd.includes('/proc/cmdline')) {
            return state.procCmdline;
        }

        const quoted = cmd.match(/cat\s+"([^"]+)"/);
        const unquoted = cmd.match(/cat\s+([^\s]+)/);
        const path = quoted ? quoted[1] : (unquoted ? unquoted[1] : null);
        if (!path) return '';

        if (Object.prototype.hasOwnProperty.call(state.files, path)) {
            return state.files[path];
        }

        if (cmd.includes('|| echo "{}"')) {
            return '{}';
        }

        if (cmd.includes('|| echo ""')) {
            return '';
        }

        return '';
    }

    function handleListPresets() {
        const prefix = '/data/adb/floppy_companion/presets/';
        const files = Object.keys(state.files)
            .filter((path) => path.startsWith(prefix) && path.endsWith('.json'))
            .sort();
        return files.join('\n');
    }

    function handleFileExistsCheck(cmd) {
        const match = cmd.match(/\[\s*-f\s+"([^"]+)"\s*\]\s*&&\s*echo\s+"?ok"?/);
        if (!match) return '';
        const path = match[1];
        return Object.prototype.hasOwnProperty.call(state.files, path) ? 'ok' : '';
    }

    function handleRm(cmd) {
        const quoted = [...cmd.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        quoted.forEach((path) => {
            if (path.endsWith('*.conf')) return;
            delete state.files[path];
        });
        return '';
    }

    function simulatorExec(command) {
        const cmd = String(command || '').trim();
        if (!cmd) return '';

        if (cmd.includes('PRESET_EOF')) {
            return handlePresetHereDoc(cmd);
        }

        if (cmd.startsWith('uname -r')) {
            return state.config.uname;
        }

        if (cmd.includes('fkfeatctl get init_protection')) {
            return String(state.liveFeatures.init_protection ?? state.features.init_protection ?? '1');
        }

        if (cmd.startsWith('sh ')) {
            const tokens = shellSplit(cmd);
            const scriptPath = tokens[1] || '';
            const action = tokens[2] || '';
            const args = tokens.slice(3);

            if (scriptPath.endsWith('/features_backend.sh')) {
                return handleFeaturesBackend(action, args);
            }

            const tweakMatch = scriptPath.match(/\/tweaks\/([^/]+)\.sh$/);
            if (tweakMatch) {
                return handleTweakBackend(tweakMatch[1], action, args);
            }

            if (scriptPath.endsWith('/persistence.sh')) {
                return handlePersistenceScript(action, args);
            }

            return '';
        }

        if (cmd.startsWith('echo "" > ')) {
            const outMatch = cmd.match(/>\s*"([^"]+)"/);
            if (outMatch) state.files[outMatch[1]] = '';
            return '';
        }

        if (cmd.startsWith('am start -a android.intent.action.VIEW -d ')) {
            const urlMatch = cmd.match(/-d\s+"([^"]+)"/);
            if (urlMatch) {
                window.open(urlMatch[1], '_blank', 'noopener');
            }
            return 'OK';
        }

        if (cmd.startsWith('ls -1 "/data/adb/floppy_companion/presets"/*.json')) {
            return handleListPresets();
        }

        if (cmd.startsWith('cat ')) {
            return handleCatCommand(cmd);
        }

        if (cmd.startsWith('rm -f ') || cmd.startsWith('rm ')) {
            return handleRm(cmd);
        }

        if (cmd.startsWith('[ -f ')) {
            return handleFileExistsCheck(cmd);
        }

        if (cmd.startsWith('mkdir -p ')) {
            return '';
        }

        return '';
    }

    window.__FC_SIM_EXEC = async function (command) {
        return simulatorExec(command);
    };
})();
