#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# FloppyCompanion service script
# This script applies saved tweaks after boot completes

MODDIR="${0%/*}"

# Wait for boot to complete
while [ "$(getprop sys.boot_completed)" != 1 ]; do
    sleep 1
done

# Additional delay for vendor scripts to finish
sleep 3

# --- Persistence Setup ---
DATA_DIR="/data/adb/floppy_companion"
mkdir -p "$DATA_DIR/config"
mkdir -p "$DATA_DIR/presets"

get_device_prop() {
    for prop_path in "/sys/kernel/sec_detect/$1" "/sys/mi_detect/$1"; do
        if [ -r "$prop_path" ]; then
            cat "$prop_path"
            return 0
        fi
    done
    return 1
}

extract_variant_code() {
    echo "$1" | sed -n -E 's/.*-v[0-9]+\.[0-9]+(\.[0-9]+)?[a-z]*(\-([A-Z0-9]+))?(-.*)?$/\3/p'
}

resolve_kernel_name() {
    DEVICE_NAME=$(get_device_prop device_name | tr '[:upper:]' '[:lower:]')

    case "$DEVICE_NAME" in
        a25x|a33x|a53x|m33x|m34x|gta4xls|a26xs)
            echo "Floppy1280"
            ;;
        r9s|o1s|p3s|t2s)
            echo "Floppy2100"
            ;;
        *ginkgo*|*willow*|*sm6125*|*trinket*|*laurel_sprout*)
            echo "FloppyTrinketMi"
            ;;
        *)
            echo "$1" | grep -o 'Floppy[A-Za-z0-9]*' | head -n 1
            ;;
    esac
}

update_module_prop_description() {
    prop_file="$1"
    description_value="$2"
    overlay_dir="$DATA_DIR/runtime"
    overlay_file="$overlay_dir/module.prop"
    tmp_file

    [ -f "$prop_file" ] || return 1

    mkdir -p "$overlay_dir" || return 1

    if awk -v target="$prop_file" '$2 == target { found = 1; exit } END { exit !found }' /proc/mounts 2>/dev/null; then
        umount "$prop_file" 2>/dev/null || umount -l "$prop_file" 2>/dev/null || true
    fi

    tmp_file="${overlay_file}.tmp.$$"

    if ! awk -v desc="$description_value" '
        BEGIN { updated = 0 }
        /^description=/ {
            print "description=" desc
            updated = 1
            next
        }
        { print }
        END {
            if (!updated) {
                print "description=" desc
            }
        }
    ' "$prop_file" > "$tmp_file"; then
        rm -f "$tmp_file"
        return 1
    fi

    chmod --reference="$prop_file" "$tmp_file" 2>/dev/null || chmod 0644 "$tmp_file" 2>/dev/null || true
    chown --reference="$prop_file" "$tmp_file" 2>/dev/null || true
    chcon --reference="$prop_file" "$tmp_file" 2>/dev/null || true

    if ! mv -f "$tmp_file" "$overlay_file" 2>/dev/null; then
        if ! cat "$tmp_file" > "$overlay_file" 2>/dev/null; then
            rm -f "$tmp_file"
            return 1
        fi
        rm -f "$tmp_file"
    fi

    chmod --reference="$prop_file" "$overlay_file" 2>/dev/null || chmod 0644 "$overlay_file" 2>/dev/null || true
    chown --reference="$prop_file" "$overlay_file" 2>/dev/null || true
    chcon --reference="$prop_file" "$overlay_file" 2>/dev/null || true

    mount -o bind "$overlay_file" "$prop_file" 2>/dev/null || mount --bind "$overlay_file" "$prop_file" 2>/dev/null || return 1

    unset prop_file description_value overlay_dir overlay_file tmp_file

    return 0
}

# --- Capture Kernel Defaults (before any tweaks) ---
if [ -f "$MODDIR/tweaks/capture_defaults.sh" ]; then
    sh "$MODDIR/tweaks/capture_defaults.sh"
fi

# --- Apply Saved Tweaks ---

# ZRAM
if [ -f "$MODDIR/tweaks/zram.sh" ]; then
    sh "$MODDIR/tweaks/zram.sh" apply_saved
fi

# Memory
if [ -f "$MODDIR/tweaks/memory.sh" ]; then
    sh "$MODDIR/tweaks/memory.sh" apply_saved
fi

# LMKD
if [ -f "$MODDIR/tweaks/lmkd.sh" ]; then
    sh "$MODDIR/tweaks/lmkd.sh" apply_saved
fi

# I/O Scheduler
if [ -f "$MODDIR/tweaks/iosched.sh" ]; then
    sh "$MODDIR/tweaks/iosched.sh" apply_saved
fi

# Thermal Mode (Floppy1280 only)
if [ -f "$MODDIR/tweaks/thermal.sh" ]; then
    sh "$MODDIR/tweaks/thermal.sh" apply_saved
fi

# Undervolt (Floppy1280 only)
if [ -f "$MODDIR/tweaks/undervolt.sh" ]; then
    sh "$MODDIR/tweaks/undervolt.sh" apply_saved
fi

if [ -f "$MODDIR/tweaks/exynos_fc.sh" ]; then
    sh "$MODDIR/tweaks/exynos_fc.sh" apply_saved
fi

# Misc Floppy1280 Tweaks
if [ -f "$MODDIR/tweaks/misc.sh" ]; then
    sh "$MODDIR/tweaks/misc.sh" apply_saved
fi

# Thermal Control (Floppy2100 only, delayed until offsets settle)
if [ -f "$MODDIR/tweaks/thermal_control.sh" ]; then
    sh "$MODDIR/tweaks/thermal_control.sh" sync_boot_state &
fi

# Sound Control (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/soundcontrol.sh" ]; then
    sh "$MODDIR/tweaks/soundcontrol.sh" apply_saved
fi

# Charging (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/charging.sh" ]; then
    sh "$MODDIR/tweaks/charging.sh" apply_saved
fi

# Display (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/display.sh" ]; then
    sh "$MODDIR/tweaks/display.sh" apply_saved
fi

# Adreno (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/adreno.sh" ]; then
    sh "$MODDIR/tweaks/adreno.sh" apply_saved
fi

# Misc Trinket Tweaks (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/misc_trinket.sh" ]; then
    sh "$MODDIR/tweaks/misc_trinket.sh" apply_saved
fi

# --- Update Module Description ---
KERN_VER=$(uname -r)
DESCRIPTION="Companion module to tweak FloppyKernel."

if echo "$KERN_VER" | grep -q "Floppy"; then
    STATUS="✅"
    
    # Parse kernel name (Floppy1280, FloppyTrinketMi, etc)
    KERN_NAME=$(resolve_kernel_name "$KERN_VER")
    
    # Parse version (including suffix like "v2.0b" or patch v6.2.1)
    VERSION=$(echo "$KERN_VER" | grep -o -E '\-v[0-9]+\.[0-9]+(\.[0-9]+)?[a-z]*' | tr -d '-')
    
    # Parse variant
    VARIANT=$(extract_variant_code "$KERN_VER")
    
    # Parse build type
    if echo "$KERN_VER" | grep -q "\-release"; then
        BUILD_TYPE="Release"
    else
        BUILD_TYPE="Testing"
        # Try to get git hash
        GIT_HASH=$(echo "$KERN_VER" | grep -o '\-g[0-9a-f]*' | sed 's/-g//')
        if [ -n "$GIT_HASH" ]; then
            BUILD_TYPE="$BUILD_TYPE ($GIT_HASH)"
        fi
    fi
    
    # Check for dirty flag
    DIRTY=""
    if echo "$KERN_VER" | grep -q "dirty"; then
        DIRTY=", dirty"
    fi
    
    # Assemble formatted info
    INFO="$KERN_NAME $VERSION"
    [ -n "$VARIANT" ] && INFO="$INFO, $VARIANT"
    INFO="$INFO, $BUILD_TYPE$DIRTY"
    
    # Check for unsupported version
    UNSUPPORTED=0
    if [ -n "$VERSION" ]; then
        # Parse version with potential suffix (e.g., "v2.0b" -> major=2, minor=0, suffix=b)
        VERSION_CLEAN=$(echo "$VERSION" | sed 's/v//')
        VER_MAJOR=$(echo "$VERSION_CLEAN" | cut -d. -f1)
        VER_MINOR_RAW=$(echo "$VERSION_CLEAN" | cut -d. -f2)
        VER_MINOR=$(echo "$VER_MINOR_RAW" | sed 's/[^0-9].*//')
        VER_SUFFIX=$(echo "$VER_MINOR_RAW" | sed 's/[0-9]*//')
        
        # Floppy1280: minimum v6.2
        if [ "$KERN_NAME" = "Floppy1280" ]; then
            if [ "$VER_MAJOR" -lt 6 ] 2>/dev/null; then
                UNSUPPORTED=1
            elif [ "$VER_MAJOR" -eq 6 ] && [ "$VER_MINOR" -lt 2 ] 2>/dev/null; then
                UNSUPPORTED=1
            fi
        fi
        
        # FloppyTrinketMi: minimum v2.0b
        if [ "$KERN_NAME" = "FloppyTrinketMi" ]; then
            if [ "$VER_MAJOR" -lt 2 ] 2>/dev/null; then
                UNSUPPORTED=1
            elif [ "$VER_MAJOR" -eq 2 ] && [ "$VER_MINOR" -eq 0 ] 2>/dev/null; then
                # For v2.0, require "b" suffix or no suffix
                if [ -n "$VER_SUFFIX" ] && [ "$VER_SUFFIX" != "b" ]; then
                    UNSUPPORTED=1
                fi
                # v2.0b and v2.0 (no suffix) are both supported
            elif [ "$VER_MAJOR" -eq 2 ] && [ "$VER_MINOR" -lt 0 ] 2>/dev/null; then
                UNSUPPORTED=1
            fi
        fi
    fi
    
    if [ "$UNSUPPORTED" = 1 ]; then
        STATUS="⚠️"
        INFO="$INFO (Unsupported)"
    fi
else
    STATUS="❌"
    INFO="Not Floppy or incompatible version"
fi

if [ -f "$MODDIR/module.prop" ]; then
    INFO=$(printf '%s' "$INFO" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')
    update_module_prop_description "$MODDIR/module.prop" "$DESCRIPTION Detected kernel: $INFO $STATUS"
fi
