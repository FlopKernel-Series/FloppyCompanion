#!/system/bin/sh

MODDIR="${0%/*}"
TOOLS="$MODDIR/tools"
MAGISKBOOT="$TOOLS/magiskboot"
FKFEAT="$TOOLS/fkfeat/fkfeatctl"
WORK_DIR="/data/local/tmp/fc_work"
BOOT_BLOCK="/dev/block/by-name/boot"
LOG_FILE="$MODDIR/.patch_log"

log() {
    echo "[FC] $*"
    echo "[FC] $*" >> "$LOG_FILE"
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

check_fkfeat() {
    if [ ! -x "$FKFEAT" ] && [ -f "$FKFEAT" ]; then
        chmod 755 "$FKFEAT"
    fi
    if [ ! -x "$FKFEAT" ]; then
        log "Error: fkfeatctl not found or not executable at $FKFEAT"
        return 1
    fi
}

# Helper: Resolve Boot Device (handling A/B slots)
get_boot_device() {
    local SLOT=$(getprop ro.boot.slot_suffix 2>/dev/null)
    
    # Use generic /dev/block/by-name
    if [ -n "$SLOT" ]; then
         echo "/dev/block/by-name/boot$SLOT"
    else
         echo "/dev/block/by-name/boot"
    fi
}

get_kernel_feature_value() {
    local KEY="$1"
    strings kernel | grep -E "^${KEY}=[0-9]+$" | head -1 | cut -d= -f2
}

case "$1" in
    unpack)
        log "Unpacking boot image..."
        check_magiskboot || exit 1
        
        cleanup
        mkdir -p "$WORK_DIR"
        cd "$WORK_DIR"
        
        BOOT_DEV=$(get_boot_device)
        log "Target boot device: $BOOT_DEV"
        
        if dd if="$BOOT_DEV" of=boot.img > /dev/null 2>&1; then
            log "Boot image dumped."
        else
            log "Error: Failed to dump boot image ($BOOT_DEV)."
            exit 1
        fi

        chmod 755 "$MAGISKBOOT"
        "$MAGISKBOOT" unpack -h boot.img > /dev/null 2>&1
        
        if [ -f "kernel" ]; then
            log "Unpack successful."
        else
            log "Error: Unpack failed."
            exit 1
        fi
        ;;
        
    read_features)
        # Usage: read_features <mode>
        # mode: header, kernel, or kernel_tokens
        MODE="$2"
        
        cd "$WORK_DIR" || exit 1
        if [ ! -f "kernel" ]; then
            echo "Error: Kernel not found. Refresh to unpack."
            exit 1
        fi

        echo "---FEATURES_START---"
        
        if [ "$MODE" = "header" ]; then
            # Trinket: header-based cmdline
            FULL_CMDLINE=$(grep "^cmdline=" header | cut -d= -f2-)
            echo "$FULL_CMDLINE"
        elif [ "$MODE" = "kernel" ]; then
            # Floppy1280: baked-in kernel cmdline
            # Use cgroup.memory=nokmem as anchor
            strings kernel | grep "cgroup.memory=nokmem" | head -1
        elif [ "$MODE" = "kernel_tokens" ]; then
            strings kernel | grep -E '^[A-Za-z0-9_.-]+=[0-9]+$'
        else
            echo "Error: Unsupported feature read mode: $MODE"
            exit 1
        fi

        echo "---FEATURES_END---"
        ;;

    read_live_features)
        # Usage: read_live_features <mode>
        # mode: fkfeat
        MODE="$2"

        echo "---FEATURES_START---"

        if [ "$MODE" = "fkfeat" ]; then
            check_fkfeat || exit 1
            "$FKFEAT" list
        else
            echo "Error: Unsupported live feature read mode: $MODE"
            exit 1
        fi

        echo "---FEATURES_END---"
        ;;
        
    patch)
        # Usage: patch <mode> "key=val" "key2=val2" ...
        # mode: header, kernel, or kernel_tokens
        MODE="$2"
        shift 2  # Remove 'patch' and mode from args
        
        cd "$WORK_DIR" || exit 1
        
        if [ ! -f "kernel" ]; then
            log "Kernel not found."
            exit 1
        fi
        
        log "Applying patches (mode: $MODE)..."
        
        if [ "$MODE" = "header" ]; then
            # --- TRINKET / Header Mode ---
            CMDLINE_FILE="cmdline.txt"
            # Extract current cmdline to temp file
            grep "^cmdline=" header | cut -d= -f2- > "$CMDLINE_FILE"
            CURRENT_CMDLINE=$(cat "$CMDLINE_FILE")
            
            NEW_CMDLINE="$CURRENT_CMDLINE"
            
            for ARG in "$@"; do
                KEY="${ARG%%=*}"
                VAL="${ARG#*=}"
                
                # Check for existence with space pads for safety (avoids partial matches)
                if echo " $NEW_CMDLINE " | grep -q " ${KEY}="; then
                    # Replace existing: match start-of-line OR space before key
                    # capture the separator (\1) to preserve it
                    NEW_CMDLINE=$(echo "$NEW_CMDLINE" | sed -E "s/(^|[[:space:]])${KEY}=[^[:space:]]*/\1${KEY}=${VAL}/g")
                else
                    # Append new if not present
                    NEW_CMDLINE="$NEW_CMDLINE ${KEY}=${VAL}"
                fi
            done
            
            # Clean up spaces
            NEW_CMDLINE=$(echo "$NEW_CMDLINE" | sed -e 's;^[ \t]*;;' -e 's;  *; ;g' -e 's;[ \t]*$;;')
            
            log "Old: $CURRENT_CMDLINE"
            log "New: $NEW_CMDLINE"
            
            # Update header file
            # Use sed with pipe delimiter to avoid slash conflict
            # We must be careful to only replace the cmdline line
            sed -i "s|^cmdline=.*|cmdline=${NEW_CMDLINE}|" header
            log "Header updated."
            
        elif [ "$MODE" = "kernel" ]; then
            # --- 1280 / Kernel Mode ---
            # Use cgroup.memory=nokmem as anchor to find actual cmdline
            CURRENT_CMDLINE=$(strings kernel | grep "cgroup.memory=nokmem" | head -1)
            NEW_CMDLINE="$CURRENT_CMDLINE"
            
            for ARG in "$@"; do
                KEY="${ARG%%=*}"
                VAL="${ARG#*=}"
                NEW_CMDLINE=$(echo "$NEW_CMDLINE" | sed -E "s/${KEY}=[0-9]+/${KEY}=${VAL}/g")
            done
            
            log "Old: $CURRENT_CMDLINE"
            log "New: $NEW_CMDLINE"
            
            if [ "$CURRENT_CMDLINE" != "$NEW_CMDLINE" ]; then
                str_to_hex() { printf "%s" "$1" | xxd -p | tr -d '\n'; }
                HEX_OLD=$(str_to_hex "$CURRENT_CMDLINE")
                HEX_NEW=$(str_to_hex "$NEW_CMDLINE")
                
                if [ ${#HEX_OLD} -ne ${#HEX_NEW} ]; then
                    log "Warning: Length mismatch. Safe padding not implemented."
                fi
                
                "$MAGISKBOOT" hexpatch kernel "$HEX_OLD" "$HEX_NEW" > /dev/null 2>&1
                log "Kernel patched."
            else
                log "No changes needing binary patch."
            fi
        elif [ "$MODE" = "kernel_tokens" ]; then
            # --- Feature Token / Kernel Mode ---
            PATCHED_ANY=0

            for ARG in "$@"; do
                KEY="${ARG%%=*}"
                VAL="${ARG#*=}"
                CURRENT_VAL=$(get_kernel_feature_value "$KEY")

                if [ -z "$CURRENT_VAL" ]; then
                    log "Warning: Feature token not found in kernel: $KEY"
                    continue
                fi

                if [ "$CURRENT_VAL" = "$VAL" ]; then
                    log "No patch needed for $KEY (already $VAL)."
                    continue
                fi

                OLD_TOKEN="${KEY}=${CURRENT_VAL}"
                NEW_TOKEN="${KEY}=${VAL}"

                log "Old: $OLD_TOKEN"
                log "New: $NEW_TOKEN"

                if [ ${#OLD_TOKEN} -ne ${#NEW_TOKEN} ]; then
                    log "Error: Length mismatch for $KEY. Safe padding not implemented."
                    exit 1
                fi

                str_to_hex() { printf "%s" "$1" | xxd -p | tr -d '\n'; }
                HEX_OLD=$(str_to_hex "$OLD_TOKEN")
                HEX_NEW=$(str_to_hex "$NEW_TOKEN")

                "$MAGISKBOOT" hexpatch kernel "$HEX_OLD" "$HEX_NEW" > /dev/null 2>&1
                log "Kernel token patched for $KEY."
                PATCHED_ANY=1
            done

            if [ "$PATCHED_ANY" -eq 0 ]; then
                log "No changes needing binary patch."
            fi
        else
            log "Error: Unsupported boot image layout."
            exit 1
        fi
        
        # Repack & Flash
        log "Repacking..."
        "$MAGISKBOOT" repack boot.img > /dev/null 2>&1
        
        if [ -f "new-boot.img" ]; then
            BOOT_DEV=$(get_boot_device)
            log "Flashing to $BOOT_DEV..."
            cat new-boot.img > "$BOOT_DEV"
            log "Success! Reboot required."
        else
            log "Error: Repack failed."
            exit 1
        fi
        ;;
        
    cleanup)
        cleanup
        ;;
        
    *)
        echo "Usage: $0 {unpack|read_features <mode>|read_live_features <mode>|patch <mode> key=val...|cleanup}"
        exit 1
        ;;
esac
