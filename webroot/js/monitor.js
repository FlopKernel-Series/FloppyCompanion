// monitor.js - Monitor tab (Memory)

(function () {
    'use strict';

    const HISTORY_POINTS = 60;
    const UPDATE_INTERVAL_MS = 1000;
    const MONITOR_TAB_INDEX = 3;

    // History arrays - filled with null initially, data enters from right
    let memHistory = new Array(HISTORY_POINTS).fill(null);
    let swapHistory = new Array(HISTORY_POINTS).fill(null);
    let monitorTimer = null;
    let thermalControlTimer = null;
    let voltageTimer = null;
    let lastUseBytes = false;
    let cpuViewMode = 'cluster';
    let isMonitorActive = false;
    let thermalMinMax = {}; // Track min/max per thermal zone
    const monitorCardIds = {
        memory: 'monitor-memory-card',
        cpu: 'monitor-cpu-card',
        gpu: 'monitor-gpu-card',
        thermal: 'monitor-thermal-card',
        voltage: 'monitor-voltage-card'
    };
    const loadedCards = {};
    const cardRequests = {};

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function parseMeminfo(text) {
        const lines = String(text || '').split('\n');
        const map = {};
        for (const line of lines) {
            const match = line.match(/^([^:]+):\s+(\d+)/);
            if (match) {
                map[match[1]] = parseInt(match[2], 10);
            }
        }
        return map;
    }

    function formatBytes(bytes) {
        const value = Number(bytes) || 0;
        const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
        let idx = 0;
        let num = value;
        while (num >= 1024 && idx < 2) {
            num /= 1024;
            idx++;
        }
        return `${num.toFixed(num >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function formatFreq(khz) {
        const value = Number(khz) || 0;
        if (!value) return '--';
        const mhz = value / 1000;
        if (mhz >= 1000) {
            const ghz = mhz / 1000;
            return `${ghz.toFixed(ghz >= 2 ? 2 : 1)} GHz`;
        }
        return `${mhz.toFixed(mhz >= 100 ? 0 : 1)} MHz`;
    }

    function kbToBytes(kb) {
        return (Number(kb) || 0) * 1024;
    }

    function parseCmdline(text) {
        const map = {};
        const tokens = String(text || '').split(/\s+/).filter(Boolean);
        for (const token of tokens) {
            const idx = token.indexOf('=');
            if (idx > 0) {
                const key = token.slice(0, idx);
                const val = token.slice(idx + 1);
                map[key] = val;
            }
        }
        return map;
    }

    function parsePolicyOutput(output) {
        const rows = [];
        const lines = String(output || '').split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 6) continue;
            const [id, cpus, cur, min, max, gov] = parts;
            rows.push({
                id: id || '',
                cpus: cpus || '',
                cur: cur || '',
                min: min || '',
                max: max || '',
                gov: gov || ''
            });
        }
        return rows;
    }

    function parseCoreOutput(output) {
        const rows = [];
        const lines = String(output || '').split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length < 2) continue;
            const [id, cur] = parts;
            rows.push({
                id: id || '',
                cur: cur || ''
            });
        }
        return rows;
    }

    function normalizeCpuId(id) {
        const trimmed = String(id || '').trim();
        if (!trimmed) return '';
        return trimmed.startsWith('cpu') ? trimmed : `cpu${trimmed}`;
    }

    function parseCpuList(cpus) {
        const list = String(cpus || '').trim().split(/\s+/).filter(Boolean);
        return list.map(normalizeCpuId).filter(Boolean);
    }

    function getCpuRangeText(cpus) {
        const cpuList = parseCpuList(cpus);
        if (!cpuList.length) return '';
        const first = cpuList[0].replace(/^cpu/, '');
        const last = cpuList[cpuList.length - 1].replace(/^cpu/, '');
        return first === last ? `cpu${first}` : `cpu${first}-${last}`;
    }

    function getClusterRoleMap(rows) {
        const clusters = rows
            .map((row, idx) => ({
                idx,
                id: String(row.id || ''),
                policyNum: parseInt(String(row.id || '').replace(/\D/g, ''), 10)
            }))
            .filter(item => !isNaN(item.policyNum));

        if (clusters.length === 0) return {};

        // Sort by policy ID number (physical CPU order) instead of
        // dynamic max freq, which changes during thermal throttling.
        clusters.sort((a, b) => a.policyNum - b.policyNum);
        const roleMap = {};
        const littleKey = t('monitor.cpu.clusterLittle');
        const bigKey = t('monitor.cpu.clusterBig');
        const midKey = t('monitor.cpu.clusterMid');
        const primeKey = t('monitor.cpu.clusterPrime');

        if (clusters.length === 1) {
            roleMap[clusters[0].id] = bigKey;
            return roleMap;
        }

        // 2 clusters: Little, Big
        // 3+ clusters: Little, Mid(s), Prime
        roleMap[clusters[0].id] = littleKey;
        if (clusters.length === 2) {
            roleMap[clusters[1].id] = bigKey;
        } else {
            roleMap[clusters[clusters.length - 1].id] = primeKey;
            for (let i = 1; i < clusters.length - 1; i++) {
                roleMap[clusters[i].id] = midKey;
            }
        }

        return roleMap;
    }

    function formatCpuLabel(row, roleMap, forceCluster = false) {
        if (cpuViewMode === 'core' && !forceCluster) {
            const coreId = String(row.id || '').replace('cpu', '');
            const label = t('monitor.cpu.cpuLabel', { id: coreId || '0' });
            return label;
        }

        const policyId = String(row.id || '').replace('policy', '');
        const range = getCpuRangeText(row.cpus);
        const role = roleMap ? roleMap[row.id] : null;
        const base = role || t('monitor.cpu.clusterLabel', { id: policyId || '0' });
        return range ? `${base} - ${policyId} (${range})` : `${base} - ${policyId}`;
    }

    function isEnabledValue(value) {
        const v = String(value || '').toLowerCase();
        return v === '1' || v === 'y' || v === 'yes' || v === 'true' || v === 'on';
    }

    function setVisible(el, visible) {
        if (!el) return;
        el.style.display = visible ? '' : 'none';
    }

    function getCssColor(name, fallback) {
        const val = getComputedStyle(document.body).getPropertyValue(name);
        return (val && val.trim()) || fallback;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 100, g: 150, b: 255 };
    }

    function colorToRgb(color) {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        const computed = ctx.fillStyle;
        if (computed.startsWith('#')) {
            return hexToRgb(computed);
        }
        const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
        }
        return { r: 100, g: 150, b: 255 };
    }

    function resizeCanvas(canvas) {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    }

    function drawGraph(canvas, history, color) {
        const ctx = resizeCanvas(canvas);
        if (!ctx) return;

        const width = canvas.getBoundingClientRect().width;
        const height = canvas.getBoundingClientRect().height;
        const padding = 4;
        const graphHeight = height - padding * 2;
        const gridColor = getCssColor('--md-sys-color-outline-variant', '#666666');
        const gridRgb = colorToRgb(gridColor);

        ctx.clearRect(0, 0, width, height);

        // Draw subtle horizontal guides so the graph has an obvious ceiling/floor.
        ctx.save();
        ctx.strokeStyle = `rgba(${gridRgb.r}, ${gridRgb.g}, ${gridRgb.b}, 0.42)`;
        ctx.lineWidth = 1;
        [0, 0.5, 1].forEach((ratio) => {
            const y = padding + graphHeight * ratio;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        });
        ctx.restore();

        // Find valid data range (non-null values from the right)
        let firstValidIdx = history.findIndex(v => v !== null);
        if (firstValidIdx === -1) return; // No data yet

        const rgb = colorToRgb(color);
        const step = width / (HISTORY_POINTS - 1);

        // Build points array - only for valid data, positioned from right
        const points = [];
        for (let i = firstValidIdx; i < history.length; i++) {
            const value = history[i];
            if (value !== null) {
                const clamped = clamp(value, 0, 100);
                points.push({
                    x: i * step,
                    y: padding + graphHeight * (1 - clamped / 100)
                });
            }
        }

        if (points.length < 1) return;

        // Create the path with smooth curves
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        if (points.length === 1) {
            // Single point - draw to right edge
            ctx.lineTo(width, points[0].y);
        } else {
            // Smooth bezier curves through points
            for (let i = 0; i < points.length - 1; i++) {
                const curr = points[i];
                const next = points[i + 1];
                const cpX = (curr.x + next.x) / 2;
                ctx.bezierCurveTo(cpX, curr.y, cpX, next.y, next.x, next.y);
            }
        }

        // Save line end point
        const lastPoint = points[points.length - 1];

        // Stroke the line with glow effect
        ctx.save();
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();

        // Main crisp line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Create filled area beneath the line
        ctx.lineTo(lastPoint.x, height);
        ctx.lineTo(points[0].x, height);
        ctx.closePath();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    function pushHistory(arr, value) {
        // Shift left, add new value on right
        arr.shift();
        arr.push(value);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function monitorCardKeyFromId(cardId) {
        return Object.keys(monitorCardIds).find(key => monitorCardIds[key] === cardId) || '';
    }

    function isCardExpanded(key) {
        const card = document.getElementById(monitorCardIds[key]);
        return !!card && !card.classList.contains('collapsed') && card.style.display !== 'none';
    }

    function setCardLoading(key, loading) {
        const card = document.getElementById(monitorCardIds[key]);
        if (card) card.classList.toggle('monitor-loading', !!loading);
    }

    function waitForPaint() {
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function setupCollapse(cardId, toggleId) {
        const card = document.getElementById(cardId);
        const toggle = document.getElementById(toggleId);
        if (!card || !toggle) return;
        const key = monitorCardKeyFromId(cardId);

        const setState = (collapsed) => {
            card.classList.toggle('collapsed', collapsed);
            toggle.setAttribute('aria-expanded', String(!collapsed));
        };

        setState(card.classList.contains('collapsed'));

        toggle.addEventListener('click', () => {
            const nextCollapsed = !card.classList.contains('collapsed');
            setState(nextCollapsed);
            if (!nextCollapsed && key) {
                refreshCard(key, { force: true });
            }
        });
    }

    function renderCpuList(policyRows, coreRows) {
        const list = document.getElementById('monitor-cpu-list');
        if (!list) return;
        list.innerHTML = '';

        if (!policyRows || policyRows.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'monitor-empty';
            empty.textContent = t('monitor.cpu.noData');
            list.appendChild(empty);
            return;
        }

        const currentLabel = t('monitor.cpu.currentLabel');
        const minLabel = t('monitor.cpu.minLabel');
        const maxLabel = t('monitor.cpu.maxLabel');
        const govLabel = t('monitor.cpu.govLabel');
        const roleMap = getClusterRoleMap(policyRows);

        if (cpuViewMode === 'core') {
            const coreMap = {};
            (coreRows || []).forEach((row) => {
                const id = normalizeCpuId(row.id);
                if (id) coreMap[id] = row.cur;
            });

            policyRows.forEach((row) => {
                const item = document.createElement('div');
                item.className = 'monitor-cpu-item';

                const title = document.createElement('div');
                title.className = 'monitor-cpu-item-title';
                title.textContent = formatCpuLabel(row, roleMap, true);

                item.appendChild(title);
                const cpuIds = parseCpuList(row.cpus);
                cpuIds.forEach((cpuId) => {
                    const cpuRow = document.createElement('div');
                    cpuRow.className = 'monitor-stat-row';
                    const cpuLabel = document.createElement('span');
                    cpuLabel.className = 'monitor-stat-label';
                    const cpuNum = cpuId.replace('cpu', '');
                    cpuLabel.textContent = t('monitor.cpu.cpuLabel', { id: cpuNum });
                    const cpuVal = document.createElement('span');
                    cpuVal.className = 'monitor-stat-value monitor-cpu-current';
                    cpuVal.textContent = formatFreq(coreMap[cpuId]);
                    cpuRow.appendChild(cpuLabel);
                    cpuRow.appendChild(cpuVal);
                    item.appendChild(cpuRow);
                });

                const minRow = document.createElement('div');
                minRow.className = 'monitor-stat-row';
                const minLabelEl = document.createElement('span');
                minLabelEl.className = 'monitor-stat-label';
                minLabelEl.textContent = minLabel;
                const minValEl = document.createElement('span');
                minValEl.className = 'monitor-stat-value';
                minValEl.textContent = formatFreq(row.min);
                minRow.appendChild(minLabelEl);
                minRow.appendChild(minValEl);

                const maxRow = document.createElement('div');
                maxRow.className = 'monitor-stat-row';
                const maxLabelEl = document.createElement('span');
                maxLabelEl.className = 'monitor-stat-label';
                maxLabelEl.textContent = maxLabel;
                const maxValEl = document.createElement('span');
                maxValEl.className = 'monitor-stat-value';
                maxValEl.textContent = formatFreq(row.max);
                maxRow.appendChild(maxLabelEl);
                maxRow.appendChild(maxValEl);

                const govRow = document.createElement('div');
                govRow.className = 'monitor-stat-row';
                const govLabelEl = document.createElement('span');
                govLabelEl.className = 'monitor-stat-label';
                govLabelEl.textContent = govLabel;
                const govValEl = document.createElement('span');
                govValEl.className = 'monitor-stat-value';
                govValEl.textContent = row.gov || '--';
                govRow.appendChild(govLabelEl);
                govRow.appendChild(govValEl);

                item.appendChild(minRow);
                item.appendChild(maxRow);
                item.appendChild(govRow);

                list.appendChild(item);
            });

            return;
        }

        policyRows.forEach((row) => {
            const item = document.createElement('div');
            item.className = 'monitor-cpu-item';

            const title = document.createElement('div');
            title.className = 'monitor-cpu-item-title';
            title.textContent = formatCpuLabel(row, roleMap);

            const currentRow = document.createElement('div');
            currentRow.className = 'monitor-stat-row';
            const currentLabelEl = document.createElement('span');
            currentLabelEl.className = 'monitor-stat-label';
            currentLabelEl.textContent = currentLabel;
            const currentValEl = document.createElement('span');
            currentValEl.className = 'monitor-stat-value monitor-cpu-current';
            currentValEl.textContent = formatFreq(row.cur);
            currentRow.appendChild(currentLabelEl);
            currentRow.appendChild(currentValEl);

            const minRow = document.createElement('div');
            minRow.className = 'monitor-stat-row';
            const minLabelEl = document.createElement('span');
            minLabelEl.className = 'monitor-stat-label';
            minLabelEl.textContent = minLabel;
            const minValEl = document.createElement('span');
            minValEl.className = 'monitor-stat-value';
            minValEl.textContent = formatFreq(row.min);
            minRow.appendChild(minLabelEl);
            minRow.appendChild(minValEl);

            const maxRow = document.createElement('div');
            maxRow.className = 'monitor-stat-row';
            const maxLabelEl = document.createElement('span');
            maxLabelEl.className = 'monitor-stat-label';
            maxLabelEl.textContent = maxLabel;
            const maxValEl = document.createElement('span');
            maxValEl.className = 'monitor-stat-value';
            maxValEl.textContent = formatFreq(row.max);
            maxRow.appendChild(maxLabelEl);
            maxRow.appendChild(maxValEl);

            const govRow = document.createElement('div');
            govRow.className = 'monitor-stat-row';
            const govLabelEl = document.createElement('span');
            govLabelEl.className = 'monitor-stat-label';
            govLabelEl.textContent = govLabel;
            const govValEl = document.createElement('span');
            govValEl.className = 'monitor-stat-value';
            govValEl.textContent = row.gov || '--';
            govRow.appendChild(govLabelEl);
            govRow.appendChild(govValEl);

            item.appendChild(title);
            item.appendChild(currentRow);
            item.appendChild(minRow);
            item.appendChild(maxRow);
            item.appendChild(govRow);
            list.appendChild(item);
        });
    }

    function updateCpuStatus(cmdline) {
        const params = parseCmdline(cmdline);
        const kernelName = window.KERNEL_NAME || '';
        const is1280 = kernelName === 'Floppy1280';
        const isTrinket = kernelName === 'FloppyTrinketMi';
        const featureFamilyKey = is1280 ? '1280' : null;

        const unlockedRow = document.getElementById('monitor-unlocked-row');
        const emsRow = document.getElementById('monitor-ems-row');
        const msmRow = document.getElementById('monitor-msm-row');

        const enabledLabel = t('monitor.cpu.enabled');
        const disabledLabel = t('monitor.cpu.disabled');
        const offLabel = t('monitor.cpu.off');

        const superfloppy = params.superfloppy;
        const ems = params.ems_efficient;
        const noMsmBoost = params.no_msm_perf_boost;

        const showUnlocked = superfloppy !== undefined || is1280;
        const showEms = ems !== undefined || is1280;
        const showMsm = noMsmBoost !== undefined || isTrinket;

        setVisible(unlockedRow, showUnlocked);
        setVisible(emsRow, showEms);
        setVisible(msmRow, showMsm);

        if (showUnlocked) {
            if (superfloppy && superfloppy !== '0') {
                const label = featureFamilyKey ? tf('superfloppy', 'label', superfloppy, featureFamilyKey) : null;
                setText('monitor-unlocked-value', label || `${enabledLabel} (${superfloppy})`);
            } else {
                setText('monitor-unlocked-value', offLabel);
            }
        }

        if (showEms) {
            if (ems !== undefined) {
                setText('monitor-ems-value', isEnabledValue(ems) ? enabledLabel : disabledLabel);
            } else {
                setText('monitor-ems-value', '--');
            }
        }

        if (showMsm) {
            if (noMsmBoost !== undefined) {
                const perfBoostEnabled = !isEnabledValue(noMsmBoost);
                setText('monitor-msm-value', perfBoostEnabled ? enabledLabel : disabledLabel);
            } else {
                setText('monitor-msm-value', '--');
            }
        }

        const statusSection = document.getElementById('monitor-cpu-status');
        if (statusSection) {
            statusSection.style.display = (showUnlocked || showEms || showMsm) ? '' : 'none';
        }
    }

    async function fetchMonitorData() {
        const cmd = [
            'cat /proc/meminfo',
            'echo __SEP__',
            'cat /sys/block/zram0/disksize 2>/dev/null',
            'echo __SEP__',
            'cat /sys/block/zram0/comp_algorithm 2>/dev/null',
            'echo __SEP__',
            'cat /proc/sys/vm/swappiness 2>/dev/null',
            'echo __SEP__',
            'cat /proc/sys/vm/dirty_ratio 2>/dev/null',
            'echo __SEP__',
            'cat /proc/sys/vm/dirty_bytes 2>/dev/null',
            'echo __SEP__',
            'cat /proc/sys/vm/dirty_background_ratio 2>/dev/null',
            'echo __SEP__',
            'cat /proc/sys/vm/dirty_background_bytes 2>/dev/null'
        ].join('; ');

        const output = await window.exec(cmd);
        if (!output) return null;
        const parts = output.split('__SEP__').map(p => p.trim());

        return {
            meminfo: parseMeminfo(parts[0] || ''),
            zramDisksize: parts[1] || '',
            zramAlgorithm: parts[2] || '',
            swappiness: parts[3] || '',
            dirtyRatio: parts[4] || '',
            dirtyBytes: parts[5] || '',
            dirtyBgRatio: parts[6] || '',
            dirtyBgBytes: parts[7] || ''
        };
    }

    async function fetchCpuData() {
        const policyCmd = `for p in /sys/devices/system/cpu/cpufreq/policy*; do ` +
            `[ -d "$p" ] || continue; ` +
            `id=$(basename "$p"); ` +
            `cpus=$(cat "$p/related_cpus" 2>/dev/null); ` +
            `cur=$(cat "$p/scaling_cur_freq" 2>/dev/null || cat "$p/cpuinfo_cur_freq" 2>/dev/null); ` +
            `min=$(cat "$p/scaling_min_freq" 2>/dev/null); ` +
            `max=$(cat "$p/scaling_max_freq" 2>/dev/null); ` +
            `gov=$(cat "$p/scaling_governor" 2>/dev/null); ` +
            `echo "$id|$cpus|$cur|$min|$max|$gov"; ` +
            `done`;

        const coreCmd = `for c in /sys/devices/system/cpu/cpu[0-9]*; do ` +
            `d="$c/cpufreq"; [ -f "$d/scaling_cur_freq" ] || continue; ` +
            `id=$(basename "$c"); ` +
            `cur=$(cat "$d/scaling_cur_freq" 2>/dev/null || cat "$d/cpuinfo_cur_freq" 2>/dev/null); ` +
            `echo "$id|$cur"; ` +
            `done`;

        const cmd = `${policyCmd}; echo __SEP__; ${coreCmd}; echo __SEP__; cat /proc/cmdline`;
        const output = await window.exec(cmd);
        if (!output) return null;
        const parts = output.split('__SEP__');
        return {
            policies: parsePolicyOutput(parts[0] || ''),
            cores: parseCoreOutput(parts[1] || ''),
            cmdline: (parts[2] || '').trim()
        };
    }

    // Helper to normalize GPU frequency values to kHz based on platform
    function normalizeGpuKhz(value, explicitUnit) {
        const n = Number(value);
        if (isNaN(n) || n === 0) return '';

        // Use explicit unit if provided
        if (explicitUnit === 'khz') return String(n);
        if (explicitUnit === 'mhz') return String(n * 1000);
        if (explicitUnit === 'hz') return String(Math.round(n / 1000));

        // Detect platform from global deviceInfo OR fallback check
        const info = window.deviceInfo || {};
        const isTrinket = info.isTrinketMi || window._fallbackIsTrinket;
        const is1280 = info.is1280;

        // Auto-detect unit based on magnitude
        // Hz: > 100,000,000 (e.g. 950,000,000) -> / 1000 -> kHz
        // kHz: 20,000 - 2,000,000 (e.g. 1,200,000) -> keep -> kHz
        // MHz: < 20,000 (e.g. 950) -> * 1000 -> kHz

        if (n > 100000000) {
            // Likely Hz (Adreno devfreq path)
            return String(Math.round(n / 1000));
        }

        if (n < 20000) {
            // Likely MHz (Adreno legacy or accidental Exynos path)
            return String(n * 1000);
        }

        // Likely kHz (Exynos native path)
        return String(n);
    }

    async function fetchGpuData() {
        const info = window.deviceInfo || {};
        const isTrinket = info.isTrinketMi || window._fallbackIsTrinket;

        // SKIP Exynos path if we know it's a Trinket device
        if (!isTrinket) {
            // ... (Exynos logic remains same) ...
            // Try Exynos path first (/sys/kernel/gpu/) - This path ALWAYS reports in kHz
            const GPU_SYSFS = '/sys/kernel/gpu';
            const exynosCmd = [
                `cat ${GPU_SYSFS}/gpu_clock 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_min_clock 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_max_clock 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_governor 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_unlock 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_clklck 2>/dev/null`,
                `cat ${GPU_SYSFS}/gpu_model 2>/dev/null; true`
            ].join('; echo __SEP__; ');

            const exynosOut = await window.exec(exynosCmd);
            if (exynosOut) {
                const parts = exynosOut.split('__SEP__').map(p => p.trim());
                if (parts[0]) {
                    const model = parts[6] || '';
                    const gpuData = {
                        cur: normalizeGpuKhz(parts[0]),
                        min: normalizeGpuKhz(parts[1]),
                        max: normalizeGpuKhz(parts[2]),
                        gov: parts[3] || '',
                        unlock: parts[4] || '',
                        clklck: parts[5] || '',
                        model: model,
                        adrenoboost: '', idlerActive: '',
                        idlerDownDiff: '', idlerIdleWait: '', idlerWorkload: ''
                    };
                    return gpuData;
                }
            }
        }

        // Trinket / Adreno Path (Direct Sysfs Read)
        const ADRENO_DEVFREQ = '/sys/devices/platform/soc/5900000.qcom,kgsl-3d0/devfreq/5900000.qcom,kgsl-3d0';
        const ADRENO_IDLER = '/sys/module/adreno_idler/parameters';

        const adrenoCmd = [
            `cat ${ADRENO_DEVFREQ}/cur_freq 2>/dev/null`,
            `cat ${ADRENO_DEVFREQ}/min_freq 2>/dev/null`,
            `cat ${ADRENO_DEVFREQ}/max_freq 2>/dev/null`,
            `cat ${ADRENO_DEVFREQ}/governor 2>/dev/null`,
            `cat /sys/class/kgsl/kgsl-3d0/gpu_model 2>/dev/null`,
            // Features
            `cat ${ADRENO_DEVFREQ}/adrenoboost 2>/dev/null || echo 0`,
            `cat ${ADRENO_IDLER}/adreno_idler_active 2>/dev/null || echo N`,
            `cat ${ADRENO_IDLER}/adreno_idler_downdifferential 2>/dev/null || echo 20`,
            `cat ${ADRENO_IDLER}/adreno_idler_idlewait 2>/dev/null || echo 15`,
            `cat ${ADRENO_IDLER}/adreno_idler_idleworkload 2>/dev/null || echo 5000`
        ].join('; echo __SEP__; ');

        const adrenoOut = await window.exec(adrenoCmd);
        if (!adrenoOut) return { error: 'Adreno read failed' };

        const parts = adrenoOut.split('__SEP__').map(p => p.trim());
        // Map parts to variables
        // [0]cur, [1]min, [2]max, [3]gov, [4]model, [5]boost, [6]active, [7]down, [8]wait, [9]work

        const rawCur = parts[0];
        const normCur = normalizeGpuKhz(rawCur);

        return {
            cur: normCur,
            min: normalizeGpuKhz(parts[1]),
            max: normalizeGpuKhz(parts[2]),
            gov: parts[3] || '',
            unlock: '', clklck: '',
            model: parts[4] || 'Adreno',
            adrenoboost: parts[5] || '',
            idlerActive: parts[6] || '',
            idlerDownDiff: parts[7] || '',
            idlerIdleWait: parts[8] || '',
            idlerWorkload: parts[9] || '',
            raw: adrenoOut
        };
    }

    async function fetchThermalData() {
        const cmd = `for zone in /sys/class/thermal/thermal_zone*; do ` +
            `[ -d "$zone" ] || continue; ` +
            `type=$(cat "$zone/type" 2>/dev/null); ` +
            `temp=$(cat "$zone/temp" 2>/dev/null); ` +
            `echo "$type|$temp"; ` +
            `done`;
        const output = await window.exec(cmd);
        if (!output) return null;
        const lines = output.trim().split('\n').filter(Boolean);
        const zones = [];
        for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 2) {
                const type = parts[0].trim();
                const temp = parseInt(parts[1], 10);
                if (type && !isNaN(temp)) {
                    zones.push({
                        type,
                        temp: temp / 1000
                    });
                }
            }
        }
        return zones;
    }

    async function fetchThermalControlData() {
        const info = window.deviceInfo || {};
        const is2100 = info.is2100;
        const is1280 = info.is1280;

        let data = { platform: 'unknown' };

        if (is2100) {
            data.platform = '2100';
            // Read sysfs nodes directly for Floppy2100
            const cmd = `cat /proc/exynos_tmu/BIG_offset 2>/dev/null || echo ""; ` +
                `cat /proc/exynos_tmu/MID_offset 2>/dev/null || echo ""; ` +
                `cat /proc/exynos_tmu/LITTLE_offset 2>/dev/null || echo ""; ` +
                `cat /proc/exynos_tmu/G3D_offset 2>/dev/null || echo ""; ` +
                `cat /sys/kernel/throttlers_protection 2>/dev/null || echo ""`;
            const output = await window.exec(cmd);
            if (output) {
                const lines = output.trim().split('\n');
                data.big_offset = lines[0] || '';
                data.mid_offset = lines[1] || '';
                data.little_offset = lines[2] || '';
                data.g3d_offset = lines[3] || '';
                data.throttling_protection = lines[4] || '';
            }
            // Read performance mode from config
            const perfCmd = `cat /data/adb/floppy_companion/config/thermal_control.conf 2>/dev/null | grep '^performance_mode=' | cut -d= -f2 || echo "0"`;
            const perfOutput = await window.exec(perfCmd);
            if (perfOutput) {
                data.performance_mode = perfOutput.trim();
            }
        } else if (is1280) {
            data.platform = '1280';
            // Read sysfs nodes directly for Floppy1280
            const cmd = `cat /sys/devices/platform/10080000.BIG/thermal_mode 2>/dev/null || echo ""; ` +
                `cat /sys/devices/platform/10080000.BIG/emergency_frequency 2>/dev/null || echo ""`;
            const output = await window.exec(cmd);
            if (output) {
                const lines = output.trim().split('\n');
                data.mode = lines[0] || '';
                data.custom_freq = lines[1] || '';
            }
        }

        return data;
    }

    async function fetchVoltageData() {
        const info = window.deviceInfo || {};
        if (!info.is1280 && !info.is2100) return null;

        const cmd = `for f in cpucl0_fv_table cpucl1_fv_table cpucl2_fv_table g3d_fv_table; do ` +
            `[ -f "/sys/kernel/fvmap/fv_tables/$f" ] || continue; ` +
            `echo "__FILE__:$f"; ` +
            `cat "/sys/kernel/fvmap/fv_tables/$f"; ` +
            `done`;

        const output = await window.exec(cmd);
        if (!output) return null;

        const files = output.split('__FILE__:').filter(Boolean);
        const data = {};

        for (const file of files) {
            const lines = file.trim().split('\n');
            const fileName = lines[0].trim();
            const table = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith('Freq')) continue;
                const parts = line.split(/\s+/);
                if (parts.length >= 2) {
                    const row = {
                        freq: parts[0],
                        volt: parts[1]
                    };
                    const baseMatch = line.match(/\(base:\s+(\d+)\)/);
                    if (baseMatch) {
                        row.base = baseMatch[1];
                    }
                    table.push(row);
                }
            }
            data[fileName] = table;
        }
        return data;
    }

    function parseZramAlgorithm(raw) {
        const match = raw.match(/\[([^\]]+)\]/);
        if (match) return match[1];
        const first = raw.trim().split(/\s+/)[0];
        return first || '--';
    }

    function updateDirtyLabels(useBytes) {
        const labelDirty = document.getElementById('monitor-vm-dirty-label');
        const labelDirtyBg = document.getElementById('monitor-vm-dirty-bg-label');
        if (!labelDirty || !labelDirtyBg) return;

        const keyDirty = useBytes ? 'monitor.memory.dirtyBytes' : 'monitor.memory.dirtyRatio';
        const keyDirtyBg = useBytes ? 'monitor.memory.dirtyBackgroundBytes' : 'monitor.memory.dirtyBackgroundRatio';

        labelDirty.textContent = t(keyDirty);
        labelDirtyBg.textContent = t(keyDirtyBg);
    }

    function updateMonitorUI(data) {
        if (!data) return;

        const meminfo = data.meminfo || {};
        const totalKb = meminfo.MemTotal || 0;
        const availableKb = meminfo.MemAvailable || ((meminfo.MemFree || 0) + (meminfo.Buffers || 0) + (meminfo.Cached || 0));
        const usedKb = Math.max(totalKb - availableKb, 0);

        const swapTotalKb = meminfo.SwapTotal || 0;
        const swapFreeKb = meminfo.SwapFree || 0;
        const swapUsedKb = Math.max(swapTotalKb - swapFreeKb, 0);

        const memPercent = totalKb ? (usedKb / totalKb) * 100 : 0;
        const swapPercent = swapTotalKb ? (swapUsedKb / swapTotalKb) * 100 : 0;

        // Push new values - they enter from the right and scroll left
        pushHistory(memHistory, memPercent);
        pushHistory(swapHistory, swapPercent);

        const accent = getCssColor('--md-sys-color-primary', '#0d47a1');
        drawGraph(document.getElementById('monitor-mem-graph'), memHistory, accent);
        drawGraph(document.getElementById('monitor-swap-graph'), swapHistory, accent);

        const usedLabel = t('monitor.memory.usedSuffix');
        const totalLabel = t('monitor.memory.totalSuffix');
        setText('monitor-mem-used', `${formatBytes(kbToBytes(usedKb))} ${usedLabel}`);
        setText('monitor-mem-total', `${formatBytes(kbToBytes(totalKb))} ${totalLabel}`);
        setText('monitor-swap-used', `${formatBytes(kbToBytes(swapUsedKb))} ${usedLabel}`);
        setText('monitor-swap-total', `${formatBytes(kbToBytes(swapTotalKb))} ${totalLabel}`);

        setText('monitor-total-memory', formatBytes(kbToBytes(totalKb)));

        const zramBytes = Number(data.zramDisksize || 0);
        setText('monitor-zram-disksize', zramBytes ? formatBytes(zramBytes) : '--');
        setText('monitor-zram-algorithm', data.zramAlgorithm ? parseZramAlgorithm(data.zramAlgorithm) : '--');

        setText('monitor-vm-swappiness', data.swappiness || '--');

        const dirtyBytes = parseInt(data.dirtyBytes || '0', 10);
        const dirtyBgBytes = parseInt(data.dirtyBgBytes || '0', 10);
        const useBytes = dirtyBytes > 0 || dirtyBgBytes > 0;
        lastUseBytes = useBytes;
        updateDirtyLabels(useBytes);

        if (useBytes) {
            setText('monitor-vm-dirty', dirtyBytes ? formatBytes(dirtyBytes) : '0 B');
            setText('monitor-vm-dirty-bg', dirtyBgBytes ? formatBytes(dirtyBgBytes) : '0 B');
        } else {
            setText('monitor-vm-dirty', data.dirtyRatio ? `${data.dirtyRatio}%` : '--');
            setText('monitor-vm-dirty-bg', data.dirtyBgRatio ? `${data.dirtyBgRatio}%` : '--');
        }
    }

    function updateCpuUI(data) {
        if (!data) return;
        renderCpuList(data.policies, data.cores);
        updateCpuStatus(data.cmdline);
    }

    function updateGpuUI(data) {
        if (!data) return;

        try {
            const list = document.getElementById('monitor-gpu-info');
            if (list) {
                list.innerHTML = '';

                const currentLabel = window.t ? t('monitor.gpu.currentLabel') : 'Current';
                const minLabel = window.t ? t('monitor.gpu.minLabel') : 'Min';
                const maxLabel = window.t ? t('monitor.gpu.maxLabel') : 'Max';
                const govLabel = window.t ? t('monitor.gpu.govLabel') : 'Governor';

                if (!data.cur && !data.min && !data.max) {
                    const empty = document.createElement('div');
                    empty.className = 'monitor-empty';
                    empty.textContent = window.t ? t('monitor.gpu.noData') : 'No GPU data available';
                    list.appendChild(empty);
                } else {
                    // Model title (if available)
                    if (data.model) {
                        const title = document.createElement('div');
                        title.className = 'monitor-cpu-item-title';
                        title.textContent = data.model;
                        list.appendChild(title);
                    }

                    const rows = [
                        { label: currentLabel, value: data.cur, isCurrent: true },
                        { label: minLabel, value: data.min, isCurrent: false },
                        { label: maxLabel, value: data.max, isCurrent: false },
                        { label: govLabel, value: data.gov || '--', isCurrent: false, isText: true }
                    ];

                    rows.forEach(r => {
                        const row = document.createElement('div');
                        row.className = 'monitor-stat-row';

                        const labelEl = document.createElement('span');
                        labelEl.className = 'monitor-stat-label';
                        labelEl.textContent = r.label;

                        const valEl = document.createElement('span');
                        valEl.className = 'monitor-stat-value';
                        if (r.isCurrent) valEl.classList.add('monitor-cpu-current');

                        let val = r.value;
                        if (!r.isText) {
                            val = val ? formatFreq(val) : '--';
                        }
                        valEl.textContent = val;

                        row.appendChild(labelEl);
                        row.appendChild(valEl);
                        list.appendChild(row);
                    });
                }
            }

            // GPU features status
            const enabledLabel = window.t ? t('monitor.gpu.enabled') : 'Enabled';
            const disabledLabel = window.t ? t('monitor.gpu.disabled') : 'Disabled';
            const statusSection = document.getElementById('monitor-gpu-status');

            const hasUnlock = data.unlock !== '';
            const hasClklck = data.clklck !== '';
            const hasAdrenoboost = data.adrenoboost !== '';
            const hasIdler = data.idlerActive !== '';
            const showStatus = hasUnlock || hasClklck || hasAdrenoboost || hasIdler;

            if (statusSection) {
               statusSection.style.display = showStatus ? '' : 'none';
            }

            // Exynos (Mali) features
            const unlockRow = document.getElementById('monitor-gpu-unlock-row');
            if (unlockRow) {
                unlockRow.style.display = hasUnlock ? '' : 'none';
                if (hasUnlock) {
                    setText('monitor-gpu-unlock-value', isEnabledValue(data.unlock) ? enabledLabel : disabledLabel);
                }
            }
            const clklckRow = document.getElementById('monitor-gpu-clklck-row');
            if (clklckRow) {
                clklckRow.style.display = hasClklck ? '' : 'none';
                if (hasClklck) {
                    setText('monitor-gpu-clklck-value', isEnabledValue(data.clklck) ? enabledLabel : disabledLabel);
                }
            }

            // Adreno features
            const isAdreno = data.model && data.model.includes('Adreno');

            const boostLabels = ['Off', 'Low', 'Medium', 'High'];
            const boostSection = document.getElementById('monitor-gpu-adrenoboost-section');

            if (isAdreno && boostSection) {
                boostSection.style.display = 'block'; // Show section
                const idx = Number(data.adrenoboost) || 0;
                const val = data.adrenoboost === '' ? 'Empty' : (boostLabels[idx] || data.adrenoboost);
                setText('monitor-gpu-adrenoboost-value', val);
            }

            const idlerSection = document.getElementById('monitor-gpu-idler-section');
            if (isAdreno && idlerSection) {
                idlerSection.style.display = 'block'; // Show section

                const val = data.idlerActive === '' ? 'Empty' : (isEnabledValue(data.idlerActive) ? enabledLabel : disabledLabel);
                setText('monitor-gpu-idler-active-value', val);

                const idlerRows = [
                    { id: 'monitor-gpu-idler-downdiff', key: 'idlerDownDiff' },
                    { id: 'monitor-gpu-idler-idlewait', key: 'idlerIdleWait' },
                    { id: 'monitor-gpu-idler-workload', key: 'idlerWorkload' }
                ];
                idlerRows.forEach(def => {
                    const val = data[def.key] === '' ? 'Empty' : data[def.key];
                    setText(def.id + '-value', val);
                });
            }

        } catch (e) {
            console.error('Error updating GPU UI', e);
        }
    }

    function updateThermalUI(data) {
        if (!data || !Array.isArray(data)) {
            const list = document.getElementById('monitor-thermal-list');
            if (list) list.innerHTML = `<div class="monitor-thermal-row"><span class="monitor-thermal-cell" colspan="4">${t('monitor.thermal.noData')}</span></div>`;
            return;
        }

        const list = document.getElementById('monitor-thermal-list');
        if (!list) return;

        let html = '';
        for (const zone of data) {
            const temp = zone.temp;
            const type = zone.type;

            // Initialize min/max to current temp on first read, then track
            if (!thermalMinMax[type]) {
                thermalMinMax[type] = { min: temp, max: temp };
            } else {
                if (temp < thermalMinMax[type].min) thermalMinMax[type].min = temp;
                if (temp > thermalMinMax[type].max) thermalMinMax[type].max = temp;
            }

            const min = thermalMinMax[type].min.toFixed(1);
            const max = thermalMinMax[type].max.toFixed(1);
            const current = temp.toFixed(1);
            const isHigh = temp >= 70;
            const tempClass = isHigh ? 'warning-text' : '';

            html += `
                <div class="monitor-thermal-row">
                    <span class="monitor-thermal-cell">${type}</span>
                    <span class="monitor-thermal-cell ${tempClass}">${current}°C</span>
                    <span class="monitor-thermal-cell">${min}°C</span>
                    <span class="monitor-thermal-cell">${max}°C</span>
                </div>
            `;
        }
        list.innerHTML = html;
    }

    function updateThermalControlUI(data) {
        if (!data || data.platform === 'unknown') {
            return;
        }

        if (data.platform === '2100') {
            // Floppy2100: Show and update performance mode, throttling protection, and thermal offsets
            const perfModeRow = document.getElementById('monitor-thermal-perf-mode-row');
            const perfModeValue = document.getElementById('monitor-thermal-perf-mode-value');
            if (perfModeRow && perfModeValue) {
                perfModeRow.style.display = 'flex';
                perfModeValue.textContent = data.performance_mode === '1' ? 'Enabled' : 'Disabled';
            }

            const throttleRow = document.getElementById('monitor-thermal-throttling-protection-row');
            const throttleValue = document.getElementById('monitor-thermal-throttling-protection-value');
            if (throttleRow && throttleValue) {
                throttleRow.style.display = 'flex';
                throttleValue.textContent = data.throttling_protection === '1' ? 'Enabled' : 'Disabled';
            }

            // Show and update offset rows
            const offsets = [
                { key: 'little_offset', rowId: 'monitor-thermal-little-offset-row', valueId: 'monitor-thermal-little-offset-value' },
                { key: 'big_offset', rowId: 'monitor-thermal-big-offset-row', valueId: 'monitor-thermal-big-offset-value' },
                { key: 'mid_offset', rowId: 'monitor-thermal-prime-offset-row', valueId: 'monitor-thermal-prime-offset-value' },
                { key: 'g3d_offset', rowId: 'monitor-thermal-g3d-offset-row', valueId: 'monitor-thermal-g3d-offset-value' }
            ];
            for (const offset of offsets) {
                const row = document.getElementById(offset.rowId);
                const value = document.getElementById(offset.valueId);
                if (row && value) {
                    if (data[offset.key] !== undefined && data[offset.key] !== '') {
                        row.style.display = 'flex';
                        value.textContent = data[offset.key] + '°C';
                    } else {
                        row.style.display = 'none';
                    }
                }
            }

            // Hide 1280-specific rows
            document.getElementById('monitor-thermal-mode-row').style.display = 'none';
            document.getElementById('monitor-thermal-custom-freq-row').style.display = 'none';

        } else if (data.platform === '1280') {
            // Floppy1280: Show and update thermal mode and custom frequency
            const modeRow = document.getElementById('monitor-thermal-mode-row');
            const modeValue = document.getElementById('monitor-thermal-mode-value');
            if (modeRow && modeValue) {
                modeRow.style.display = 'flex';
                const modeLabels = { '0': 'Disabled', '1': 'Stock', '2': 'Custom', '3': 'Performance' };
                modeValue.textContent = modeLabels[data.mode] || data.mode || '--';
            }

            const customFreqRow = document.getElementById('monitor-thermal-custom-freq-row');
            const customFreqValue = document.getElementById('monitor-thermal-custom-freq-value');
            if (customFreqRow && customFreqValue) {
                if (data.mode === '2' && data.custom_freq) {
                    customFreqRow.style.display = 'flex';
                    customFreqValue.textContent = data.custom_freq;
                } else {
                    customFreqRow.style.display = 'none';
                }
            }

            // Hide 2100-specific rows
            document.getElementById('monitor-thermal-perf-mode-row').style.display = 'none';
            document.getElementById('monitor-thermal-throttling-protection-row').style.display = 'none';
            document.getElementById('monitor-thermal-little-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-big-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-prime-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-g3d-offset-row').style.display = 'none';
        }
    }

    function updateVoltageUI(data) {
        const list = document.getElementById('monitor-voltage-list');
        const voltageCard = document.getElementById('monitor-voltage-card');
        if (!list || !voltageCard) return;

        if (!data || Object.keys(data).length === 0) {
            voltageCard.style.display = 'none';
            return;
        }

        voltageCard.style.display = 'block';
        list.innerHTML = '';
        const info = window.deviceInfo || {};

        const clusterFiles = info.is2100 ?
            ['cpucl0_fv_table', 'cpucl1_fv_table', 'cpucl2_fv_table', 'g3d_fv_table'] :
            ['cpucl0_fv_table', 'cpucl1_fv_table', 'g3d_fv_table'];

        const roles = info.is2100 ?
            [t('monitor.cpu.clusterLittle'), t('monitor.cpu.clusterBig'), t('monitor.cpu.clusterPrime'), t('monitor.gpu.title')] :
            [t('monitor.cpu.clusterLittle'), t('monitor.cpu.clusterBig'), t('monitor.gpu.title')];

        clusterFiles.forEach((fileName, idx) => {
            if (!data[fileName]) return;

            const tableData = data[fileName];
            if (tableData.length === 0) return;

            // Check if any row has undervolt (volt < base)
            const hasUV = tableData.some(row => row.base && parseInt(row.volt) < parseInt(row.base));

            const section = document.createElement('div');
            section.className = 'monitor-section';
            section.style.marginBottom = '12px';
            section.style.padding = '10px';

            let displayName = roles[idx];
            if (fileName.startsWith('cpucl')) {
                const num = fileName.replace('cpucl', '').replace('_fv_table', '');
                displayName = `${t('monitor.cpu.clusterLabel', { id: num })} (${roles[idx]})`;
            }

            const title = document.createElement('div');
            title.className = 'monitor-section-title';
            title.textContent = displayName;
            section.appendChild(title);

            const tableContainer = document.createElement('div');
            tableContainer.className = 'monitor-thermal-table';

            // Header Row
            const header = document.createElement('div');
            header.className = 'monitor-thermal-row monitor-thermal-header';
            header.style.padding = '4px 0';
            header.style.fontSize = '12px';

            // Grid columns: Freq, [UV], Volt, [Base]
            // We'll use grid-template-columns directly to ensure alignment
            const gridCols = hasUV ? '1.2fr 0.8fr 1fr 1fr' : '1.2fr 1fr';
            header.style.gridTemplateColumns = gridCols;

            let headerHtml = `<span class="monitor-thermal-cell">${t('monitor.voltage.freq')}</span>`;
            if (hasUV) {
                headerHtml += `<span class="monitor-thermal-cell">${t('monitor.voltage.uv')}</span>`;
                headerHtml += `<span class="monitor-thermal-cell">${t('monitor.voltage.effVolt')}</span>`;
                headerHtml += `<span class="monitor-thermal-cell">${t('monitor.voltage.baseVolt')}</span>`;
            } else {
                headerHtml += `<span class="monitor-thermal-cell">${t('monitor.voltage.voltage')}</span>`;
            }
            header.innerHTML = headerHtml;
            tableContainer.appendChild(header);

            const body = document.createElement('div');
            body.className = 'monitor-thermal-body';

            tableData.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'monitor-thermal-row';
                rowEl.style.gridTemplateColumns = gridCols;
                rowEl.style.padding = '4px 0';
                rowEl.style.borderBottom = '1px solid var(--md-sys-color-surface-variant)';

                const freqMhz = (parseInt(row.freq) / 1000).toFixed(0);
                const voltMv = (parseInt(row.volt) / 1000).toFixed(1);

                let rowHtml = `<span class="monitor-thermal-cell" style="font-size: 13px;">${freqMhz} MHz</span>`;

                if (hasUV) {
                    const baseMvNum = parseInt(row.base || row.volt);
                    const voltMvNum = parseInt(row.volt);
                    const uvPercent = baseMvNum > 0 ? ((1 - (voltMvNum / baseMvNum)) * 100).toFixed(1) : '0.0';
                    const baseMv = (baseMvNum / 1000).toFixed(1);

                    rowHtml += `<span class="monitor-thermal-cell" style="font-size: 12px; color: var(--md-sys-color-primary);">${uvPercent}%</span>`;
                    rowHtml += `<span class="monitor-thermal-cell" style="font-size: 13px;">${voltMv} mV</span>`;
                    rowHtml += `<span class="monitor-thermal-cell" style="font-size: 12px; opacity: 0.7;">${baseMv} mV</span>`;
                } else {
                    rowHtml += `<span class="monitor-thermal-cell" style="font-size: 13px;">${voltMv} mV</span>`;
                }

                rowEl.innerHTML = rowHtml;
                body.appendChild(rowEl);
            });

            tableContainer.appendChild(body);
            section.appendChild(tableContainer);
            list.appendChild(section);
        });
    }

    async function refreshCard(key, options = {}) {
        if (!isMonitorActive || document.hidden) return;
        if (!options.force && !isCardExpanded(key)) return;
        if (cardRequests[key]) return cardRequests[key];

        const firstLoad = !loadedCards[key];
        if (firstLoad) {
            setCardLoading(key, true);
            await waitForPaint();
        }

        cardRequests[key] = (async () => {
            try {
                if (key === 'memory') {
                    updateMonitorUI(await fetchMonitorData());
                } else if (key === 'cpu') {
                    updateCpuUI(await fetchCpuData());
                } else if (key === 'gpu') {
                    updateGpuUI(await fetchGpuData());
                } else if (key === 'thermal') {
                    const [thermalData, thermalControlData] = await Promise.all([
                        fetchThermalData(),
                        fetchThermalControlData()
                    ]);
                    updateThermalUI(thermalData);
                    updateThermalControlUI(thermalControlData);
                } else if (key === 'voltage') {
                    updateVoltageUI(await fetchVoltageData());
                }
                loadedCards[key] = true;
            } finally {
                setCardLoading(key, false);
                cardRequests[key] = null;
            }
        })();

        return cardRequests[key];
    }

    function refreshExpandedMonitorCards() {
        Object.keys(monitorCardIds).forEach(key => refreshCard(key));
    }

    async function refreshThermalControl() {
        if (!isMonitorActive || document.hidden || !isCardExpanded('thermal')) return;
        const thermalControlData = await fetchThermalControlData();
        updateThermalControlUI(thermalControlData);
    }

    async function refreshVoltage() {
        if (!isMonitorActive || document.hidden || !isCardExpanded('voltage')) return;
        const voltageData = await fetchVoltageData();
        updateVoltageUI(voltageData);
    }

    function startMonitorUpdates() {
        if (monitorTimer) return;
        refreshExpandedMonitorCards();
        monitorTimer = setInterval(refreshExpandedMonitorCards, UPDATE_INTERVAL_MS);
        thermalControlTimer = setInterval(refreshThermalControl, 5000);
        voltageTimer = setInterval(refreshVoltage, 5000);
    }

    function stopMonitorUpdates() {
        if (!monitorTimer) return;
        clearInterval(monitorTimer);
        monitorTimer = null;
        if (thermalControlTimer) {
            clearInterval(thermalControlTimer);
            thermalControlTimer = null;
        }
        if (voltageTimer) {
            clearInterval(voltageTimer);
            voltageTimer = null;
        }
    }

    function updatePlatformVisibility() {
        const info = window.deviceInfo || {};
        const is2100 = info.is2100;
        const is1280 = info.is1280;
        const voltageCard = document.getElementById('monitor-voltage-card');
        if (voltageCard) {
            voltageCard.style.display = (is2100 || is1280) ? 'block' : 'none';
        }

        if (is2100) {
            document.getElementById('monitor-thermal-perf-mode-row').style.display = 'flex';
            document.getElementById('monitor-thermal-throttling-protection-row').style.display = 'flex';
            document.getElementById('monitor-thermal-little-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-big-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-prime-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-g3d-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-mode-row').style.display = 'none';
            document.getElementById('monitor-thermal-custom-freq-row').style.display = 'none';
        } else if (is1280) {
            document.getElementById('monitor-thermal-mode-row').style.display = 'flex';
            document.getElementById('monitor-thermal-custom-freq-row').style.display = 'flex';
            document.getElementById('monitor-thermal-perf-mode-row').style.display = 'none';
            document.getElementById('monitor-thermal-throttling-protection-row').style.display = 'none';
            document.getElementById('monitor-thermal-little-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-big-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-prime-offset-row').style.display = 'none';
            document.getElementById('monitor-thermal-g3d-offset-row').style.display = 'none';
        } else {
            // Platform unknown - show all rows, will be corrected when data arrives
            document.getElementById('monitor-thermal-perf-mode-row').style.display = 'flex';
            document.getElementById('monitor-thermal-throttling-protection-row').style.display = 'flex';
            document.getElementById('monitor-thermal-little-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-big-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-prime-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-g3d-offset-row').style.display = 'flex';
            document.getElementById('monitor-thermal-mode-row').style.display = 'flex';
            document.getElementById('monitor-thermal-custom-freq-row').style.display = 'flex';
        }
    }

    function initMonitor() {
        const card = document.getElementById('monitor-memory-card');
        if (!card) return;

        // Reset history arrays
        memHistory = new Array(HISTORY_POINTS).fill(null);
        swapHistory = new Array(HISTORY_POINTS).fill(null);
        thermalMinMax = {}; // Reset thermal min/max tracking

        const memCanvas = document.getElementById('monitor-mem-graph');
        const swapCanvas = document.getElementById('monitor-swap-graph');

        stopMonitorUpdates();
        if (isMonitorActive && !document.hidden) {
            startMonitorUpdates();
        }

        setupCollapse('monitor-memory-card', 'monitor-memory-toggle');
        setupCollapse('monitor-cpu-card', 'monitor-cpu-toggle');
        setupCollapse('monitor-gpu-card', 'monitor-gpu-toggle');
        setupCollapse('monitor-thermal-card', 'monitor-thermal-toggle');
        setupCollapse('monitor-voltage-card', 'monitor-voltage-toggle');

        // Show platform-specific thermal control rows based on platform
        updatePlatformVisibility();

        document.addEventListener('tabChanged', (event) => {
            const idx = event?.detail?.index;
            isMonitorActive = idx === MONITOR_TAB_INDEX;
            if (isMonitorActive && !document.hidden) {
                startMonitorUpdates();
            } else {
                stopMonitorUpdates();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopMonitorUpdates();
            } else if (isMonitorActive) {
                startMonitorUpdates();
            }
        });

        const clusterToggle = document.getElementById('monitor-cpu-view-cluster');
        const coreToggle = document.getElementById('monitor-cpu-view-core');
        if (clusterToggle && coreToggle) {
            const updateView = () => {
                cpuViewMode = clusterToggle.checked ? 'cluster' : 'core';
                refreshCard('cpu', { force: true });
            };
            clusterToggle.addEventListener('change', updateView);
            coreToggle.addEventListener('change', updateView);
        }

        window.addEventListener('resize', () => {
            const accent = getCssColor('--md-sys-color-primary', '#0d47a1');
            drawGraph(memCanvas, memHistory, accent);
            drawGraph(swapCanvas, swapHistory, accent);
        });

        document.addEventListener('languageChanged', () => {
            updateDirtyLabels(lastUseBytes);
            refreshExpandedMonitorCards();
        });

        document.addEventListener('deviceDetected', () => {
            updatePlatformVisibility();
            refreshExpandedMonitorCards();
        });
    }

    window.initMonitor = initMonitor;
})();
