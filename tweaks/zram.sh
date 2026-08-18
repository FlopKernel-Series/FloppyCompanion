#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# ZRAM Tweak Backend Script

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/zram.conf"
STATUS_FILE="$DATA_DIR/.zram_status"
PID_FILE="$DATA_DIR/.zram_pid"
LOG_FILE="$DATA_DIR/.zram_apply.log"
ZRAM_DEV=""

# Find ZRAM device
find_zram() {
    if [ -e /dev/block/zram0 ]; then
        ZRAM_DEV="/dev/block/zram0"
    elif [ -e /dev/zram0 ]; then
        ZRAM_DEV="/dev/zram0"
    else
        echo "error: ZRAM device not found"
        return 1
    fi
    return 0
}

# Get current ZRAM state from kernel
get_current() {
    find_zram || return 1

    # Get disksize in bytes
    local disksize=$(cat /sys/block/zram0/disksize 2>/dev/null || echo "0")

    # Get current algorithm (marked with [])
    local comp_algo_full=$(cat /sys/block/zram0/comp_algorithm 2>/dev/null || echo "lz4")
    local comp_algo=$(echo "$comp_algo_full" | grep -o '\[.*\]' | tr -d '[]')
    [ -z "$comp_algo" ] && comp_algo=$(echo "$comp_algo_full" | awk '{print $1}')

    # Get available algorithms
    local available_algos=$(cat /sys/block/zram0/comp_algorithm 2>/dev/null | tr ' ' '\n' | tr -d '[]' | grep -v '^$' | tr '\n' ',')

    # Check if swap is enabled
    local swap_enabled=0
    if [ -f /proc/swaps ] && grep -q "zram" /proc/swaps; then
        swap_enabled=1
    elif swapon 2>/dev/null | grep -q zram; then
        swap_enabled=1
    fi

    echo "disksize=$disksize"
    echo "algorithm=$comp_algo"
    echo "available=$available_algos"
    echo "enabled=$swap_enabled"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "disksize="
        echo "algorithm="
        echo "enabled="
    fi
}

# Save ZRAM configuration
save() {
    mkdir -p "$DATA_DIR/config" 2>/dev/null

    # Write config file with only provided values (sparse)
    > "$CONFIG_FILE"
    for arg in "$@"; do
        case "$arg" in
            disksize=*|algorithm=*|enabled=*)
                echo "$arg" >> "$CONFIG_FILE"
                ;;
        esac
    done

    echo "saved"
}

# Apply ZRAM settings synchronously (Stage 1 tear-down, Stage 2 re-arm)
apply() {
    local disksize="$1"
    local algorithm="$2"
    local enabled="$3"

    find_zram || return 1

    # If disabling ZRAM
    if [ "$enabled" = "0" ]; then
        while grep -q "zram" /proc/swaps 2>/dev/null || ! echo 1 > /sys/block/zram0/reset 2>/dev/null; do
            sync
            echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
            swapoff "$ZRAM_DEV" 2>/dev/null || swapoff -a 2>/dev/null || true
            sleep 1
        done
        echo "applied: ZRAM disabled"
        return 0
    fi

    # Preserve current/default disksize if not explicitly overridden
    if [ -z "$disksize" ] || [ "$disksize" = "0" ]; then
        disksize=$(cat /sys/block/zram0/disksize 2>/dev/null || echo "0")
        if [ "$disksize" = "0" ] && [ -f "$DATA_DIR/presets/.defaults.json" ]; then
            disksize=$(grep -A 5 '"zram"' "$DATA_DIR/presets/.defaults.json" 2>/dev/null | grep '"disksize"' | grep -o '[0-9]\+')
        fi
    fi

    # Stage 1: Free page cache, disable swap, and reset device
    while grep -q "zram" /proc/swaps 2>/dev/null || ! echo 1 > /sys/block/zram0/reset 2>/dev/null; do
        sync
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
        swapoff "$ZRAM_DEV" 2>/dev/null || swapoff -a 2>/dev/null || true
        sleep 1
    done

    # Stage 2: Set compression algorithm on uninitialized device
    if [ -n "$algorithm" ]; then
        if ! echo "$algorithm" > /sys/block/zram0/comp_algorithm 2>/dev/null; then
            echo "error: Failed to set compression algorithm '$algorithm'"
            return 1
        fi
    fi

    # Set disksize on uninitialized device
    if [ -n "$disksize" ] && [ "$disksize" != "0" ]; then
        if ! echo "$disksize" > /sys/block/zram0/disksize 2>/dev/null; then
            echo "error: Failed to set disksize '$disksize'"
            return 1
        fi
    fi

    # Format swap device and re-enable
    mkswap "$ZRAM_DEV" 2>/dev/null || true
    if ! swapon "$ZRAM_DEV" 2>/dev/null; then
        echo "error: Failed to enable swap on $ZRAM_DEV"
        return 1
    fi

    echo "applied"
    return 0
}

# Run apply in background subshell with child PID tracking ($!)
run_apply_async() {
    local disksize="$1"
    local algorithm="$2"
    local enabled="$3"

    mkdir -p "$DATA_DIR" 2>/dev/null

    # Check if a background apply job is already active
    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
            echo "running"
            return 0
        fi
    fi

    echo "running" > "$STATUS_FILE"

    (
        if apply "$disksize" "$algorithm" "$enabled" > "$LOG_FILE" 2>&1; then
            echo "ok" > "$STATUS_FILE"
        else
            echo "error" > "$STATUS_FILE"
        fi
        rm -f "$PID_FILE" 2>/dev/null
    ) &
    local child_pid=$!
    echo "$child_pid" > "$PID_FILE"

    echo "started"
}

# Query background apply status
get_apply_status() {
    if [ ! -f "$STATUS_FILE" ]; then
        echo "idle"
        return 0
    fi

    local st=$(cat "$STATUS_FILE" 2>/dev/null || echo "idle")

    if [ "$st" = "running" ] && [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
            # Child process died unexpectedly
            st=$(cat "$STATUS_FILE" 2>/dev/null || echo "idle")
            if [ "$st" = "running" ]; then
                echo "error"
                rm -f "$PID_FILE" 2>/dev/null
                return 0
            fi
        fi
    fi

    echo "$st"
}

# Clear background apply status files
clear_apply_status() {
    rm -f "$STATUS_FILE" "$LOG_FILE" "$PID_FILE" 2>/dev/null
    echo "cleared"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    # Parse config file
    local disksize=$(grep '^disksize=' "$CONFIG_FILE" | cut -d= -f2)
    local algorithm=$(grep '^algorithm=' "$CONFIG_FILE" | cut -d= -f2)
    local enabled=$(grep '^enabled=' "$CONFIG_FILE" | cut -d= -f2)

    # Apply if we have any saved configuration override
    if [ -n "$disksize" ] || [ -n "$algorithm" ] || [ "$enabled" = "0" ]; then
        apply "$disksize" "$algorithm" "$enabled"
    fi
}

# Main action handler
case "$1" in
    get_current)
        get_current
        ;;
    get_saved)
        get_saved
        ;;
    save)
        shift
        save "$@"
        ;;
    apply)
        apply "$2" "$3" "$4"
        ;;
    apply_async)
        run_apply_async "$2" "$3" "$4"
        ;;
    get_apply_status)
        get_apply_status
        ;;
    clear_apply_status)
        clear_apply_status
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {get_current|get_saved|save|apply|apply_async|get_apply_status|clear_apply_status|apply_saved}"
        exit 1
        ;;
esac
