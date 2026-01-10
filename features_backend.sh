#!/system/bin/sh

MODDIR="${0%/*}"
TOOLS="$MODDIR/tools"
MAGISKBOOT="$TOOLS/magiskboot"
WORK_DIR="/data/local/tmp/fc_work"
BOOT_BLOCK="/dev/block/by-name/boot"

log() {
    echo "[FC] $@"
}

cleanup() {
    rm -rf "$WORK_DIR"
}

check_magiskboot() {
    if [ ! -x "$MAGISKBOOT" ]; then
        chmod 755 "$MAGISKBOOT"
    fi
    if [ ! -x "$MAGISKBOOT" ]; then
        log "Error: magiskboot not found or not executable at $MAGISKBOOT"
        return 1
    fi
}

case "$1" in
    unpack)
        log "Unpacking boot image..."
        check_magiskboot || exit 1
        
        cleanup
        mkdir -p "$WORK_DIR"
        cd "$WORK_DIR"
        
        # Determine actual boot block (handle slots if necessary, but simple for now)
        # Assuming generic /dev/block/by-name/boot works for recent devices or provides link
        
        if dd if="$BOOT_BLOCK" of=boot.img > /dev/null 2>&1; then
            log "Boot image dumped."
        else
            log "Error: Failed to dump boot image."
            exit 1
        fi

        chmod 755 "$MAGISKBOOT"
        "$MAGISKBOOT" unpack boot.img > /dev/null 2>&1
        
        if [ -f "kernel" ]; then
            log "Unpack successful."
        else
            log "Error: Unpack failed."
            exit 1
        fi
        ;;
        
    read_features)
        # Needs unpack first
        cd "$WORK_DIR" || exit 1
        if [ ! -f "kernel" ]; then
            echo "Error: Kernel not found. Refresh to unpack."
            exit 1
        fi
        
        # Read baked-in cmdline
        # Expected format: cgroup.memory=nokmem aosp_mode=0 superfloppy=0 force_perm=0 ems_efficient=0
        # Use grep to find lines with numeric values (e.g., superfloppy=0 not superfloppy=%s)
        
        echo "---FEATURES_START---"
        # Find the cmdline by looking for superfloppy= followed by a digit
        strings kernel | grep "superfloppy=[0-9]" | head -1
        echo "---FEATURES_END---"
        ;;
        
    patch)
        # Usage: patch "key=val" "key2=val2" ...
        # Example: patch "superfloppy=1" "force_perm=1"
        shift
        cd "$WORK_DIR" || exit 1
        
        if [ ! -f "kernel" ]; then
            log "Kernel not found."
            exit 1
        fi
        
        log "Applying patches..."
        
        # Get current cmdline from kernel binary
        CURRENT_CMDLINE=$(strings kernel | grep "superfloppy=[0-9]" | head -1)
        if [ -z "$CURRENT_CMDLINE" ]; then
            log "Error: Could not locate cmdline in binary."
            exit 1
        fi
        
        NEW_CMDLINE="$CURRENT_CMDLINE"
        
        # Loop through arguments (key=val)
        for ARG in "$@"; do
            KEY="${ARG%%=*}"
            VAL="${ARG#*=}"
            
            # Use sed -E for extended regex (works on Android's toybox)
            NEW_CMDLINE=$(echo "$NEW_CMDLINE" | sed -E "s/${KEY}=[0-9]+/${KEY}=${VAL}/g")
        done
        
        log "Old: $CURRENT_CMDLINE"
        log "New: $NEW_CMDLINE"
        
        if [ "$CURRENT_CMDLINE" = "$NEW_CMDLINE" ]; then
            log "No changes detected."
        else
            # Hexpatch
            # Convert strings to hex
            # We use xxd usually, but Android might default to toybox xxd or OD
            # Let's use magiskboot hexpatch if we know offsets, or the hexpatch feature is generic replacement?
            # magiskboot hexpatch <file> <hex1> <hex2> replaces ALL occurrences.
            # We must be careful. The cmdline string should be unique enough.
            
            # Helper to string->hex
            str_to_hex() {
                printf "%s" "$1" | xxd -p | tr -d '\n'
            }
            
            HEX_OLD=$(str_to_hex "$CURRENT_CMDLINE")
            HEX_NEW=$(str_to_hex "$NEW_CMDLINE")
            
            # Check length - MUST be same for baked-in replacement usually?
            # Magiskboot hexpatch usually supports different lengths if file structure allows, 
            # but for raw binary replacement blindly, exact length is safest. 
            # However, if we just change digits (0 -> 1), length is same.
            
            if [ ${#HEX_OLD} -ne ${#HEX_NEW} ]; then
                log "Warning: Length mismatch. Padding might be needed."
                # We assume simple integer changes for now (0->1, 1->2)
            fi
            
            "$MAGISKBOOT" hexpatch kernel "$HEX_OLD" "$HEX_NEW" > /dev/null 2>&1
            log "Kernel patched."
            
            # Repack
            log "Repacking..."
            "$MAGISKBOOT" repack boot.img > /dev/null 2>&1
            
            if [ -f "new-boot.img" ]; then
                log "Flashing..."
                cat new-boot.img > "$BOOT_BLOCK"
                log "Success! Reboot required."
            else
                log "Error: Repack failed."
                exit 1
            fi
        fi
        ;;
        
    cleanup)
        cleanup
        ;;
        
    *)
        echo "Usage: $0 {unpack|read_features|patch key=val...|cleanup}"
        exit 1
        ;;
esac
