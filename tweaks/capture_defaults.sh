#!/system/bin/sh
# Capture kernel defaults for all tweaks
# Called at boot BEFORE any tweaks are applied

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
OUTPUT_FILE="$DATA_DIR/presets/.defaults.json"
TMP_OUTPUT_FILE="$OUTPUT_FILE.tmp.$$"
DEFAULT_OVERRIDES_FILE="$MODDIR/tweaks/default_overrides.sh"

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
rm -f "$OUTPUT_FILE" "$TMP_OUTPUT_FILE"

apply_predefined_tweak_defaults() {
    return 1
}

[ -f "$DEFAULT_OVERRIDES_FILE" ] && . "$DEFAULT_OVERRIDES_FILE"

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

# --- Sound Control Defaults (FloppyTrinketMi only) ---
SOUND_HP_L="0"
SOUND_HP_R="0"
SOUND_MIC="0"

# --- Output JSON ---
cat > "$TMP_OUTPUT_FILE" << EOF
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
    if [ "$IS_1280" = "1" ] || [ "$IS_2100" = "1" ]; then
      cat << EOF_EXYNOS_UV
,
$(if [ "$IS_1280" = "1" ]; then cat << EOF_1280_THERMAL
    "thermal": {
      "mode": "$(cat /sys/devices/platform/10080000.BIG/thermal_mode 2>/dev/null || echo 1)",
      "custom_freq": "$(cat /sys/devices/platform/10080000.BIG/emergency_frequency 2>/dev/null || echo 2288000)"
    },
EOF_1280_THERMAL
fi)
    "undervolt": {
$(      first=1
      append_uv_entry() {
        key="$1"
        node="$2"
        [ -e "$node" ] || return
        val=$(cat "$node" 2>/dev/null || echo 0)
        if [ "$first" -eq 0 ]; then
          printf ',\n'
        fi
        printf '      "%s": "%s"' "$key" "$val"
        first=0
      }
      append_uv_entry "little" "/sys/kernel/exynos_uv/cpucl0_uv_percent"
      append_uv_entry "big" "/sys/kernel/exynos_uv/cpucl1_uv_percent"
      append_uv_entry "prime" "/sys/kernel/exynos_uv/cpucl2_uv_percent"
      if [ -f /sys/kernel/exynos_uv/g3d_uv_percent ]; then
        append_uv_entry "gpu" "/sys/kernel/exynos_uv/g3d_uv_percent"
      elif [ -f /sys/kernel/exynos_uv/gpu_uv_percent ]; then
        append_uv_entry "gpu" "/sys/kernel/exynos_uv/gpu_uv_percent"
      fi
)
    }
$(
      if [ -d /sys/kernel/exynos_fc ]; then
        cat << EOF_EXYNOS_FC_DEFAULTS
,
    "exynos_fc": {
$(        first=1
        append_fc_entry() {
          key="$1"
          node="$2"
          [ -f "$node" ] || return
          val=$(cat "$node" 2>/dev/null || echo 0)
          if [ "$first" -eq 0 ]; then
            printf ',\n'
          fi
          printf '      "%s": "%s"' "$key" "$val"
          first=0
        }
        append_fc_entry "cpucl0" "/sys/kernel/exynos_fc/cpucl0_clamp"
        append_fc_entry "cpucl1" "/sys/kernel/exynos_fc/cpucl1_clamp"
        append_fc_entry "cpucl2" "/sys/kernel/exynos_fc/cpucl2_clamp"
)
    }
EOF_EXYNOS_FC_DEFAULTS
      fi
)
EOF_EXYNOS_UV
    fi
)$(
    if [ "$IS_1280" = "1" ] || [ "$IS_2100" = "1" ]; then
      cat << EOF_EXYNOS
,
    "misc": {
$(      if [ -f /sys/devices/virtual/sec/tsp/block_ed3 ]; then
        printf '      "block_ed3": "%s"' "$(cat /sys/devices/virtual/sec/tsp/block_ed3 2>/dev/null || echo 0)"
      fi
)
    },
    "exynos": {
$(      first=1
      append_exynos_entry() {
        key="$1"
        node="$2"
        [ -f "$node" ] || return
        val=$(cat "$node" 2>/dev/null || echo 0)
        if [ "$first" -eq 0 ]; then
          printf ',\n'
        fi
        printf '      "%s": "%s"' "$key" "$val"
        first=0
      }
      append_exynos_entry "gpu_clklck" "/sys/kernel/gpu/gpu_clklck"
      append_exynos_entry "gpu_unlock" "/sys/kernel/gpu/gpu_unlock"
      append_exynos_entry "throttlers_protection" "/sys/kernel/throttlers_protection"
      append_exynos_entry "esg_short_burst" "/sys/kernel/ems/energy_step/short_burst"
)
    }
$(      if [ "$IS_2100" = "1" ] && [ -f "$MODDIR/tweaks/thermal_control.sh" ] && [ "$(sh "$MODDIR/tweaks/thermal_control.sh" is_available 2>/dev/null)" = "available=1" ]; then
        printf ',\n'
        sh "$MODDIR/tweaks/thermal_control.sh" emit_defaults_fragment
      fi
)
EOF_EXYNOS
    elif [ "$IS_TRINKET" = "1" ]; then
    cat << EOF_TRINKET
,
    "soundcontrol": {
      "hp_l": "$SOUND_HP_L",
      "hp_r": "$SOUND_HP_R",
      "mic": "$SOUND_MIC"
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

mv -f "$TMP_OUTPUT_FILE" "$OUTPUT_FILE"
echo "Defaults captured to $OUTPUT_FILE"
