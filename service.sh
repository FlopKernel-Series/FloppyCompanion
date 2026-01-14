#!/system/bin/sh
# FloppyCompanion service script
# This script applies saved tweaks after boot completes

MODDIR="${0%/*}"

# Wait for boot to complete
while [ "$(getprop sys.boot_completed)" != "1" ]; do
    sleep 1
done

# Additional delay for vendor scripts to finish
sleep 3

# --- Persistence Setup ---
DATA_DIR="/data/adb/floppy_companion"
mkdir -p "$DATA_DIR/config"
mkdir -p "$DATA_DIR/presets"

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

# Misc Floppy1280 Tweaks
if [ -f "$MODDIR/tweaks/misc.sh" ]; then
    sh "$MODDIR/tweaks/misc.sh" apply_saved
fi

# Sound Control (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/soundcontrol.sh" ]; then
    sh "$MODDIR/tweaks/soundcontrol.sh" apply_saved
fi

# Bypass Charging (FloppyTrinketMi only)
if [ -f "$MODDIR/tweaks/bypass_charging.sh" ]; then
    sh "$MODDIR/tweaks/bypass_charging.sh" apply_saved
fi

# --- Update Module Description ---
KERN_VER=$(uname -r)
DESCRIPTION="Companion module to tweak FloppyKernel."

if echo "$KERN_VER" | grep -q "Floppy"; then
    STATUS="✅"
    
    # Parse kernel name (Floppy1280, FloppyTrinketMi, etc)
    KERN_NAME=$(echo "$KERN_VER" | grep -o 'Floppy[A-Za-z0-9]*')
    
    # Parse version
    VERSION=$(echo "$KERN_VER" | grep -o '\-v[0-9]*\.[0-9]*' | tr -d '-')
    
    # Parse variant
    VARIANT=""
    for v in V SKS KN RKS; do
        if echo "$KERN_VER" | grep -q "\-$v"; then
            VARIANT="$v"
            break
        fi
    done
    
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
        VER_MAJOR=$(echo "$VERSION" | sed 's/v//' | cut -d. -f1)
        VER_MINOR=$(echo "$VERSION" | sed 's/v//' | cut -d. -f2)
        
        # Floppy1280: minimum v6.2
        if [ "$KERN_NAME" = "Floppy1280" ]; then
            if [ "$VER_MAJOR" -lt 6 ] 2>/dev/null; then
                UNSUPPORTED=1
            elif [ "$VER_MAJOR" -eq 6 ] && [ "$VER_MINOR" -lt 2 ] 2>/dev/null; then
                UNSUPPORTED=1
            fi
        fi
        
        # FloppyTrinketMi: minimum v1.2
        if [ "$KERN_NAME" = "FloppyTrinketMi" ]; then
            if [ "$VER_MAJOR" -lt 1 ] 2>/dev/null; then
                UNSUPPORTED=1
            elif [ "$VER_MAJOR" -eq 1 ] && [ "$VER_MINOR" -lt 2 ] 2>/dev/null; then
                UNSUPPORTED=1
            fi
        fi
    fi
    
    if [ "$UNSUPPORTED" = "1" ]; then
        STATUS="⚠️"
        INFO="$INFO (Unsupported)"
    fi
else
    STATUS="❌"
    INFO="Not Floppy or incompatible version"
fi

if [ -f "$MODDIR/module.prop" ]; then
    sed -i "s/^description=.*/description=$DESCRIPTION Detected kernel: $INFO $STATUS/" "$MODDIR/module.prop"
fi
