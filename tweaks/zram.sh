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
    disksize=$(cat /sys/block/zram0/disksize 2>/dev/null || echo 0)
    
    # Get current algorithm (marked with [])
    comp_algo_full=$(cat /sys/block/zram0/comp_algorithm 2>/dev/null || echo "lz4")
    comp_algo=$(echo "$comp_algo_full" | grep -o '\[.*\]' | tr -d '[]')
    [ -z "$comp_algo" ] && comp_algo=$(echo "$comp_algo_full" | awk '{print $1}')
    
    # Get available algorithms
    available_algos=$(cat /sys/block/zram0/comp_algorithm 2>/dev/null | tr ' ' '\n' | tr -d '[]' | grep -v '^$' | tr '\n' ',')
    
    # Check if swap is enabled
    swap_enabled=0
    if [ -f /proc/swaps ] && grep -q "zram" /proc/swaps; then
        swap_enabled=1
    elif swapon 2>/dev/null | grep -q zram; then
        swap_enabled=1
    fi
    
    echo "disksize=$disksize"
    echo "algorithm=$comp_algo"
    echo "available=$available_algos"
    echo "enabled=$swap_enabled"

    unset disksize comp_algo_full comp_algo available_algos swap_enabled
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

    disksize="$1"
    algorithm="$2"
    enabled="$3"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
disksize=$disksize
algorithm=$algorithm
enabled=$enabled
EOF
    echo "saved"

    unset disksize algorithm enabled
}

# Apply ZRAM settings immediately
apply() {
    disksize="$1"
    algorithm="$2"
    enabled="$3"
    
    find_zram || return 1
    
    # If disabling ZRAM
    if [ "$enabled" = 0 ]; then
        swapoff $ZRAM_DEV 2>/dev/null
        echo 1 > /sys/block/zram0/reset 2>/dev/null
        echo "applied: ZRAM disabled"
        return 0
    fi
    
    # Disable current swap
    swapoff $ZRAM_DEV 2>/dev/null
    
    # Reset the device
    echo 1 > /sys/block/zram0/reset 2>/dev/null
    
    # Set compression algorithm (must be set before disksize)
    if [ -n "$algorithm" ]; then
        echo "$algorithm" > /sys/block/zram0/comp_algorithm 2>/dev/null
    fi
    
    # Set disksize
    if [ -n "$disksize" ] && [ "$disksize" != 0 ]; then
        echo "$disksize" > /sys/block/zram0/disksize 2>/dev/null
    fi
    
    # Re-initialize swap
    mkswap $ZRAM_DEV 2>/dev/null
    
    # Enable swap
    swapon $ZRAM_DEV 2>/dev/null
    
    echo "applied"

    unset disksize algorithm enabled
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    # Parse config file
    disksize=$(grep '^disksize=' "$CONFIG_FILE" | cut -d= -f2)
    algorithm=$(grep '^algorithm=' "$CONFIG_FILE" | cut -d= -f2)
    enabled=$(grep '^enabled=' "$CONFIG_FILE" | cut -d= -f2)
    
    # Only apply if we have valid values
    if [ -n "$disksize" ] || [ "$enabled" = 0 ]; then
        apply "$disksize" "$algorithm" "$enabled"
    fi

    unset disksize algorithm enabled
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
