#!/system/bin/sh
# FloppyCompanion Installation Script
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0

. "$MODPATH/translations/locale.sh"
load_translations

ui_print "========================================"
ui_print "       $STR_INSTALLER_TITLE"
ui_print "========================================"
ui_print ""

# Get kernel version
if [ -f /proc/version ]; then
    read -r _ _ KERN_VER _ < /proc/version
fi
[ -z "$KERN_VER" ] && KERN_VER=$(uname -r)
KERN_NAME=""

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
            echo "$(echo "$1" | grep -o 'Floppy[A-Za-z0-9]*' | head -n 1)"
            ;;
    esac
}

resolve_icon_family() {
    case "$1" in
        Floppy1280)
            echo "1280"
            ;;
        Floppy2100)
            echo "2100"
            ;;
        FloppyTrinketMi)
            echo "trinket"
            ;;
        *)
            return 1
            ;;
    esac
}

install_webui_icon() {
    if [ -z "$MODPATH" ]; then
        ui_print "- ⚠️  $STR_COULD_NOT_ACCESS_MODULE_PATH"
        return 0
    fi

    ICON_FAMILY=$(resolve_icon_family "$KERN_NAME" 2>/dev/null)
    ICON_SOURCE=""

    if [ -n "$ICON_FAMILY" ]; then
        ICON_SOURCE="$MODPATH/icons/icon-${ICON_FAMILY}.png"
    fi

    if [ -n "$ICON_SOURCE" ] && [ -f "$ICON_SOURCE" ]; then
        cp -f "$ICON_SOURCE" "$MODPATH/webroot/icon.png"
        ui_print "- $(printf "$STR_APPLIED_ICON" "$KERN_NAME")"
    else
        ui_print "- ⚠️  $STR_NO_ICON"
    fi

    rm -rf "$MODPATH/icons"
}

ui_print "- $STR_DETECTING_KERNEL"

if echo "$KERN_VER" | grep -q "Floppy"; then
    # Parse kernel name (Floppy1280, FloppyTrinketMi, etc)
    KERN_NAME=$(resolve_kernel_name "$KERN_VER")

    # Parse version (including suffix like "v2.0b" or patch v6.2.1)
    VERSION=$(echo "$KERN_VER" | grep -o -E '\-v[0-9]+\.[0-9]+(\.[0-9]+)?[a-z]*' | tr -d '-')

    # Parse variant
    VARIANT=$(extract_variant_code "$KERN_VER")

    # Parse build type
    if echo "$KERN_VER" | grep -q "\-release"; then
        BUILD_TYPE="$STR_BUILD_RELEASE"
    else
        BUILD_TYPE="$STR_BUILD_TESTING"
        GIT_HASH=$(echo "$KERN_VER" | grep -o '\-g[0-9a-f]*' | sed 's/-g//')
        if [ -n "$GIT_HASH" ]; then
            BUILD_TYPE="$BUILD_TYPE ($GIT_HASH)"
        fi
    fi

    # Check for dirty flag
    DIRTY=""
    if echo "$KERN_VER" | grep -q "dirty"; then
        DIRTY="$STR_BUILD_DIRTY"
    fi

    # Assemble formatted info
    INFO="$KERN_NAME $VERSION"
    [ -n "$VARIANT" ] && INFO="$INFO, $VARIANT"
    INFO="$INFO, $BUILD_TYPE$DIRTY"

    ui_print ""
    ui_print "  ✅ $STR_KERNEL_DETECTED"
    ui_print ""
    ui_print "  $STR_LABEL_KERNEL: $KERN_NAME"
    [ -n "$VERSION" ] && ui_print "  $STR_LABEL_VERSION: $VERSION"
    [ -n "$VARIANT" ] && ui_print "  $STR_LABEL_VARIANT: $VARIANT"
    ui_print "  $STR_LABEL_BUILD: $BUILD_TYPE$DIRTY"

    # Check for unsupported version
    UNSUPPORTED=0
    MIN_VERSION=""
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
            MIN_VERSION="v6.2"
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
            MIN_VERSION="v2.0b"
        fi
    fi
    
    if [ "$UNSUPPORTED" = "1" ]; then
        ui_print "  ----------------------------------------"
        ui_print "  ⚠️  $STR_UNSUPPORTED_VERSION"
        ui_print "  ----------------------------------------"
        ui_print "  $(printf "$STR_UNSUPPORTED_LINE_1" "$MIN_VERSION")"
        ui_print "  $STR_UNSUPPORTED_LINE_2"
        ui_print "  $STR_UPDATE_KERNEL"
        ui_print "  ----------------------------------------"
    fi
    ui_print ""
else
    ui_print ""
    ui_print "========================================"
    ui_print "           ⚠️  $STR_WARNING  ⚠️"
    ui_print "========================================"
    ui_print ""
    ui_print "  $STR_KERNEL_NOT_DETECTED"
    ui_print ""
    ui_print "  $STR_CURRENT_KERNEL: $KERN_VER"
    ui_print ""
    ui_print "  $STR_MODULE_DESIGNED_FOR"
    ui_print "  $STR_WILL_NOT_WORK"
    ui_print "  $STR_OTHER_KERNELS"
    ui_print ""
    ui_print "========================================"
    ui_print ""
fi

ui_print "- $STR_INSTALLING_FILES"
ui_print ""

install_webui_icon
ui_print ""

# Set the initial localized description; service.sh adds detected kernel details at boot.
if [ -f "$MODPATH/module.prop" ]; then
    DESCRIPTION_TMP="$MODPATH/module.prop.tmp.$$"
    if awk -v desc="$STR_MODULE_DESCRIPTION" '
        /^description=/ { print "description=" desc; updated = 1; next }
        { print }
        END { if (!updated) print "description=" desc }
    ' "$MODPATH/module.prop" > "$DESCRIPTION_TMP" &&
        mv -f "$DESCRIPTION_TMP" "$MODPATH/module.prop"; then
        :
    else
        rm -f "$DESCRIPTION_TMP"
        ui_print "- ⚠️  $STR_DESCRIPTION_UPDATE_FAILED"
    fi
fi

# Create persistent data directory
DATA_DIR="/data/adb/floppy_companion"
mkdir -p "$DATA_DIR/config"
mkdir -p "$DATA_DIR/presets"

ui_print "- $STR_INSTALLATION_COMPLETE"
ui_print ""
