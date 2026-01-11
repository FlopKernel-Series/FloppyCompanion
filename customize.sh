#!/system/bin/sh
# FloppyCompanion Installation Script

ui_print "========================================"
ui_print "       FloppyCompanion Installer"
ui_print "========================================"
ui_print ""

# Get kernel version
KERN_VER=$(uname -r)

ui_print "- Detecting kernel..."

if echo "$KERN_VER" | grep -q "Floppy"; then
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

    ui_print ""
    ui_print "  ✅ FloppyKernel Detected!"
    ui_print ""
    ui_print "  Kernel: $KERN_NAME"
    [ -n "$VERSION" ] && ui_print "  Version: $VERSION"
    [ -n "$VARIANT" ] && ui_print "  Variant: $VARIANT"
    ui_print "  Build: $BUILD_TYPE$DIRTY"

    # Check for unsupported version
    UNSUPPORTED=0
    MIN_MSG=""
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
            MIN_MSG="Floppy1280 versions below v6.2"
        fi
        
        # FloppyTrinketMi: minimum v1.2
        if [ "$KERN_NAME" = "FloppyTrinketMi" ]; then
            if [ "$VER_MAJOR" -lt 1 ] 2>/dev/null; then
                UNSUPPORTED=1
            elif [ "$VER_MAJOR" -eq 1 ] && [ "$VER_MINOR" -lt 2 ] 2>/dev/null; then
                UNSUPPORTED=1
            fi
            MIN_MSG="FloppyTrinketMi versions below v1.2"
        fi
    fi
    
    if [ "$UNSUPPORTED" = "1" ]; then
        ui_print "  ----------------------------------------"
        ui_print "  ⚠️  UNSUPPORTED VERSION"
        ui_print "  ----------------------------------------"
        ui_print "  $MIN_MSG are"
        ui_print "  not fully supported by this module."
        ui_print "  Please update your kernel."
        ui_print "  ----------------------------------------"
    fi
    ui_print ""
else
    ui_print ""
    ui_print "========================================"
    ui_print "           ⚠️  WARNING  ⚠️"
    ui_print "========================================"
    ui_print ""
    ui_print "  FloppyKernel NOT detected!"
    ui_print ""
    ui_print "  Current kernel: $KERN_VER"
    ui_print ""
    ui_print "  This module is designed for"
    ui_print "  FloppyKernel and will NOT work"
    ui_print "  to its fullest with other kernels."
    ui_print ""
    ui_print "========================================"
    ui_print ""
fi

ui_print "- Installing module files..."
ui_print ""

# Create persistent data directory
DATA_DIR="/data/adb/floppy_companion"
mkdir -p "$DATA_DIR/config"
mkdir -p "$DATA_DIR/presets"

ui_print "- Installation complete!"
ui_print ""
