#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# ZRAM Tweak Backend Script

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/zram.conf"
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

# Save config (does not apply)
save() {
    if [ "$#" -eq 0 ]; then
        rm -f "$CONFIG_FILE"
        echo "saved"
        return 0
    fi

    if echo "$1" | grep -q '='; then
        mkdir -p "$(dirname "$CONFIG_FILE")"
        : > "$CONFIG_FILE"
        for arg in "$@"; do
            key="${arg%%=*}"
            val="${arg#*=}"
            [ -n "$key" ] && [ -n "$val" ] && echo "$key=$val" >> "$CONFIG_FILE"
        done

        if [ ! -s "$CONFIG_FILE" ]; then
            rm -f "$CONFIG_FILE"
        fi
        echo "saved"
        return 0
    fi

    local disksize="$1"
    local algorithm="$2"
    local enabled="$3"

    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
disksize=$disksize
algorithm=$algorithm
enabled=$enabled
EOF
    echo "saved"
}

# Apply ZRAM settings immediately
apply() {
    local disksize="$1"
    local algorithm="$2"
    local enabled="$3"

    find_zram || return 1

    # If disabling ZRAM
    if [ "$enabled" = "0" ]; then
        if grep -q "zram" /proc/swaps 2>/dev/null; then
            swapoff "$ZRAM_DEV" 2>/dev/null || true
            local wait_count=0
            while grep -q "zram" /proc/swaps 2>/dev/null && [ "$wait_count" -lt 30 ]; do
                sleep 0.1 2>/dev/null || usleep 100000 2>/dev/null || sleep 1
                wait_count=$((wait_count + 1))
            done
        fi
        echo 1 > /sys/block/zram0/reset 2>/dev/null || true
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

    # Disable current swap and wait for pages to drain back to RAM
    if grep -q "zram" /proc/swaps 2>/dev/null; then
        swapoff "$ZRAM_DEV" 2>/dev/null
        local wait_count=0
        while grep -q "zram" /proc/swaps 2>/dev/null && [ "$wait_count" -lt 50 ]; do
            sleep 0.1 2>/dev/null || usleep 100000 2>/dev/null || sleep 1
            wait_count=$((wait_count + 1))
        done
    fi

    if grep -q "zram" /proc/swaps 2>/dev/null; then
        echo "error: Swap is busy and could not be disabled"
        return 1
    fi

    # Reset the device (retry briefly if block device handle is momentarily held)
    local reset_ok=0
    local retry=0
    while [ "$retry" -lt 10 ]; do
        if echo 1 > /sys/block/zram0/reset 2>/dev/null; then
            reset_ok=1
            break
        fi
        sleep 0.1 2>/dev/null || usleep 100000 2>/dev/null || sleep 1
        retry=$((retry + 1))
    done

    if [ "$reset_ok" != "1" ]; then
        echo "error: Failed to reset ZRAM device (busy)"
        return 1
    fi

    # Set compression algorithm (must be set before disksize)
    if [ -n "$algorithm" ]; then
        echo "$algorithm" > /sys/block/zram0/comp_algorithm 2>/dev/null
    fi

    # Set disksize
    if [ -n "$disksize" ] && [ "$disksize" != "0" ]; then
        echo "$disksize" > /sys/block/zram0/disksize 2>/dev/null
    fi

    # Re-initialize swap
    mkswap "$ZRAM_DEV" 2>/dev/null

    # Enable swap
    swapon "$ZRAM_DEV" 2>/dev/null

    echo "applied"
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
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {get_current|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
