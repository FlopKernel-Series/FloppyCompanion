#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# I/O Scheduler Tweak Backend Script

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/iosched.conf"

# Get list of compatible block devices
get_devices() {
    for dev_path in /sys/block/*; do
        dev_name="${dev_path##*/}"
        
        # Filter unwanted devices
        case "$dev_name" in
            loop*|ram*|zram*|dm-*|sr*) continue ;;
        esac
        
        # Double check if queue/scheduler exists
        if [ ! -f "$dev_path/queue/scheduler" ]; then
            continue
        fi
        
        echo "$dev_name"
    done
}

# Get current scheduler info for a device
# usage: get_scheduler <device_name>
get_scheduler() {
    dev="$1"
    sched_file="/sys/block/$dev/queue/scheduler"
    
    if [ ! -f "$sched_file" ]; then
        echo "error: device not found"
        return 1
    fi
    
    content=$(cat "$sched_file")
    active=$(echo "$content" | grep -o '\[.*\]' | tr -d '[]')
    available=$(echo "$content" | tr -d '[]' | tr ' ' ',')
    
    echo "device=$dev"
    echo "active=$active"
    echo "available=$available"

    unset dev sched_file content active available
}

# Get all devices with their schedulers
get_all_schedulers() {
    for dev in $(get_devices); do
        get_scheduler "$dev"
        echo "---"
    done
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

# Save config
# usage: save "dev1=sched1" "dev2=sched2" ...
save() {
    mkdir -p "$(dirname "$CONFIG_FILE")"
    : > "$CONFIG_FILE"
    
    for arg in "$@"; do
        echo "$arg" >> "$CONFIG_FILE"
    done
    echo "saved"
}

# Apply settings
# usage: apply "dev1=sched1" "dev2=sched2" ...
apply() {
    for arg in "$@"; do
        dev="${arg%%=*}"
        sched="${arg#*=}"
        
        if [ -f "/sys/block/$dev/queue/scheduler" ]; then
            echo "$sched" > "/sys/block/$dev/queue/scheduler" 2>/dev/null
        fi
    done
    echo "applied"

    unset dev sched
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    while IFS='=' read -r dev sched; do
        # simple validation
        if [ -n "$dev" ] && [ -n "$sched" ]; then
             if [ -f "/sys/block/$dev/queue/scheduler" ]; then
                echo "$sched" > "/sys/block/$dev/queue/scheduler" 2>/dev/null
            fi
        fi
    done < "$CONFIG_FILE"
}

# Main action handler
case "$1" in
    get_devices)
        get_devices
        ;;
    get_all)
        get_all_schedulers
        ;;
    get_saved)
        get_saved
        ;;
    save)
        shift
        save "$@"
        ;;
    apply)
        shift
        apply "$@"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {get_devices|get_all|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
