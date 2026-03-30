#!/system/bin/sh
# Capture kernel defaults for all tweaks
# Called at boot BEFORE any tweaks are applied

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
OUTPUT_FILE="$DATA_DIR/presets/.defaults.json"

# Detect kernel family (best-effort, aligned with WebUI logic)
KERN_VER=$(uname -r 2>/dev/null || echo "")
IS_1280=0
IS_2100=0
IS_TRINKET=0

DEVICE_NAME=""
if [ -f /sys/kernel/sec_detect/device_name ]; then
  DEVICE_NAME=$(cat /sys/kernel/sec_detect/device_name 2>/dev/null)
elif [ -f /sys/mi_detect/device_name ]; then
  DEVICE_NAME=$(cat /sys/mi_detect/device_name 2>/dev/null)
fi

DEVICE_CODE=$(echo "$DEVICE_NAME" | tr 'A-Z' 'a-z')
TRINKET_DEVICES="ginkgo willow sm6125 trinket laurel_sprout"
FLOPPY1280_DEVICES="a25x a33x a53x m33x m34x gta4xls a26xs"
FLOPPY2100_DEVICES="r9s o1s p3s t2s"

for d in $TRINKET_DEVICES; do
  if echo "$DEVICE_CODE" | grep -q "$d"; then
    IS_TRINKET=1
    break
  fi
done

if [ "$IS_TRINKET" != "1" ]; then
  for d in $FLOPPY1280_DEVICES; do
    if echo "$DEVICE_CODE" | grep -q "$d"; then
      IS_1280=1
      break
    fi
  done
fi

if [ "$IS_TRINKET" != "1" ] && [ "$IS_1280" != "1" ]; then
  for d in $FLOPPY2100_DEVICES; do
    if echo "$DEVICE_CODE" | grep -q "$d"; then
      IS_2100=1
      break
    fi
  done
fi

# Create presets directory
mkdir -p "$DATA_DIR/presets"

# --- ZRAM Defaults ---
ZRAM_DEV=""
if [ -e /dev/block/zram0 ]; then
    ZRAM_DEV="/dev/block/zram0"
elif [ -e /dev/zram0 ]; then
    ZRAM_DEV="/dev/zram0"
fi

if [ -n "$ZRAM_DEV" ]; then
    ZRAM_DISKSIZE=$(cat /sys/block/zram0/disksize 2>/dev/null || echo "0")
    ZRAM_ALGO_FULL=$(cat /sys/block/zram0/comp_algorithm 2>/dev/null || echo "lz4")
    ZRAM_ALGO=$(echo "$ZRAM_ALGO_FULL" | grep -o '\[.*\]' | tr -d '[]')
    [ -z "$ZRAM_ALGO" ] && ZRAM_ALGO=$(echo "$ZRAM_ALGO_FULL" | awk '{print $1}')
    
    # Check if swap is enabled (or configured)
    ZRAM_ENABLED=0
    # If disksize is non-zero, consider it enabled (available) even if not currently swapped on
    if [ "$ZRAM_DISKSIZE" -gt 0 ] 2>/dev/null; then
        ZRAM_ENABLED=1
    elif swapon 2>/dev/null | grep -q zram0; then
        ZRAM_ENABLED=1
    fi
else
    ZRAM_DISKSIZE="0"
    ZRAM_ALGO="lz4"
    ZRAM_ENABLED="0"
fi

# --- Output JSON ---
cat > "$OUTPUT_FILE" << EOF
{
  "name": "Default",
  "version": 1,
  "builtIn": true,
  "capturedAt": "$(date -Iseconds)",
  "tweaks": {
    "zram": {
      "enabled": "$ZRAM_ENABLED",
      "disksize": "$ZRAM_DISKSIZE",
      "algorithm": "$ZRAM_ALGO"
    },
    "memory": {
      "swappiness": "$(cat /proc/sys/vm/swappiness 2>/dev/null || echo 60)",
      "dirty_ratio": "$(cat /proc/sys/vm/dirty_ratio 2>/dev/null || echo 20)",
      "dirty_bytes": "$(cat /proc/sys/vm/dirty_bytes 2>/dev/null || echo 0)",
      "dirty_background_ratio": "$(cat /proc/sys/vm/dirty_background_ratio 2>/dev/null || echo 10)",
      "dirty_background_bytes": "$(cat /proc/sys/vm/dirty_background_bytes 2>/dev/null || echo 0)",
      "dirty_writeback_centisecs": "$(cat /proc/sys/vm/dirty_writeback_centisecs 2>/dev/null || echo 500)",
      "dirty_expire_centisecs": "$(cat /proc/sys/vm/dirty_expire_centisecs 2>/dev/null || echo 3000)",
      "stat_interval": "$(cat /proc/sys/vm/stat_interval 2>/dev/null || echo 1)",
      "vfs_cache_pressure": "$(cat /proc/sys/vm/vfs_cache_pressure 2>/dev/null || echo 100)",
      "watermark_scale_factor": "$(cat /proc/sys/vm/watermark_scale_factor 2>/dev/null || echo 10)"
    },
    "lmkd": {
$(
if [ -f "$MODDIR/tweaks/lmkd.sh" ]; then
    sh "$MODDIR/tweaks/lmkd.sh" get_defaults | \
    awk '
    BEGIN { first=1 }
    {
        split($0, kv, "=")
        key=kv[1]
        val=substr($0, length(key) + 2)
        if (key == "") next
        if (!first) printf ",\n"
        printf "      \"%s\": \"%s\"", key, val
        first=0
    }
    '
fi
)
    },
    "iosched": {
$(
if [ -f "$MODDIR/tweaks/iosched.sh" ]; then
    sh "$MODDIR/tweaks/iosched.sh" get_all | \
    awk '
    BEGIN { first=1 }
    /^device=/ { 
        dev=substr($0, 8) 
    }
    /^active=/ { 
        sched=substr($0, 8)
        if (!first) printf ",\n"
        printf "      \"%s\": \"%s\"", dev, sched
        first=0
    }
    '
fi
)
    }$(
    if [ "$IS_1280" = "1" ]; then
      cat << EOF_1280
,
    "thermal": {
      "mode": "$(cat /sys/devices/platform/10080000.BIG/thermal_mode 2>/dev/null || echo 1)",
      "custom_freq": "$(cat /sys/devices/platform/10080000.BIG/emergency_frequency 2>/dev/null || echo 2288000)"
    },
    "undervolt": {
      "little": "$(cat /sys/kernel/exynos_uv/cpucl0_uv_percent 2>/dev/null || echo 0)",
      "big": "$(cat /sys/kernel/exynos_uv/cpucl1_uv_percent 2>/dev/null || echo 0)",
      "gpu": "$(cat /sys/kernel/exynos_uv/gpu_uv_percent 2>/dev/null || echo 0)"
    }
EOF_1280
    fi
)$(
    if [ "$IS_1280" = "1" ] || [ "$IS_2100" = "1" ]; then
      cat << EOF_EXYNOS
,
    "misc": {
      "block_ed3": "$(cat /sys/devices/virtual/sec/tsp/block_ed3 2>/dev/null || echo 0)"
    },
    "exynos": {
      "gpu_clklck": "$(cat /sys/kernel/gpu/gpu_clklck 2>/dev/null || echo 0)",
      "gpu_unlock": "$(cat /sys/kernel/gpu/gpu_unlock 2>/dev/null || echo 0)"
    }
EOF_EXYNOS
    elif [ "$IS_TRINKET" = "1" ]; then
    cat << EOF_TRINKET
,
    "soundcontrol": {
      "hp_l": "$(cat /sys/kernel/sound_control/headphone_gain 2>/dev/null | awk '{print $1}' || echo 0)",
      "hp_r": "$(cat /sys/kernel/sound_control/headphone_gain 2>/dev/null | awk '{print $2}' || echo 0)",
      "mic": "$(cat /sys/kernel/sound_control/mic_gain 2>/dev/null || echo 0)"
    },
    "charging": {
      "bypass": "$(cat /sys/class/power_supply/battery/input_suspend 2>/dev/null || echo 0)",
      "fast": "$(cat /sys/kernel/fast_charge/force_fast_charge 2>/dev/null || echo 0)"
    },
    "display": {
      "hbm": "$(cat /sys/devices/platform/soc/soc:qcom,dsi-display/hbm 2>/dev/null || echo 0)",
      "cabc": "$(cat /sys/devices/platform/soc/soc:qcom,dsi-display/cabc 2>/dev/null || echo 0)"
    },
    "adreno": {
      "adrenoboost": "$(cat /sys/devices/platform/soc/5900000.qcom,kgsl-3d0/devfreq/5900000.qcom,kgsl-3d0/adrenoboost 2>/dev/null || echo 0)",
      "idler_active": "$(cat /sys/module/adreno_idler/parameters/adreno_idler_active 2>/dev/null || echo N)",
      "idler_downdifferential": "$(cat /sys/module/adreno_idler/parameters/adreno_idler_downdifferential 2>/dev/null || echo 20)",
      "idler_idlewait": "$(cat /sys/module/adreno_idler/parameters/adreno_idler_idlewait 2>/dev/null || echo 15)",
      "idler_idleworkload": "$(cat /sys/module/adreno_idler/parameters/adreno_idler_idleworkload 2>/dev/null || echo 5000)"
    },
    "misc_trinket": {
      "touchboost": "$(cat /sys/module/msm_performance/parameters/touchboost 2>/dev/null || echo 0)"
    }
EOF_TRINKET
    fi
)
  }
}
EOF

echo "Defaults captured to $OUTPUT_FILE"
