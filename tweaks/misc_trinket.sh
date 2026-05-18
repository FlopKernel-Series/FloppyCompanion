#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Misc Trinket Tweaks Backend Script
# Handles: MSM Performance Touchboost

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/misc_trinket.conf"

# Sysfs node
TOUCHBOOST_NODE="/sys/module/msm_performance/parameters/touchboost"

# Check if misc trinket tweaks are available
is_available() {
    if [ -f "$TOUCHBOOST_NODE" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current state from kernel
get_current() {
    touchboost=""
    
    if [ -f "$TOUCHBOOST_NODE" ]; then
        touchboost=$(cat "$TOUCHBOOST_NODE" 2>/dev/null | tr -d '\n\r' || echo "")
    fi
    
    echo "touchboost=$touchboost"

    unset touchboost
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "touchboost="
    fi
}

# Save config (does not apply)
save() {
    key="$1"
    value="$2"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    if [ ! -f "$CONFIG_FILE" ]; then
        touch "$CONFIG_FILE"
    fi
    
    if grep -q "^$key=" "$CONFIG_FILE" 2>/dev/null; then
        sed -i "s/^$key=.*/$key=$value/" "$CONFIG_FILE"
    else
        echo "$key=$value" >> "$CONFIG_FILE"
    fi
    
    echo "saved"

    unset key value
}

# Apply a single setting immediately
apply() {
    key="$1"
    value="$2"
    
    case "$key" in
        touchboost)
            if [ -f "$TOUCHBOOST_NODE" ]; then
                echo "$value" > "$TOUCHBOOST_NODE" 2>/dev/null
                echo "applied"
            else
                echo "error: Node not available"
            fi
            ;;
        *)
            echo "error: Unknown key $key"
            ;;
    esac

    unset key value
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    touchboost=$(grep '^touchboost=' "$CONFIG_FILE" | cut -d= -f2)
    
    if [ -n "$touchboost" ] && [ -f "$TOUCHBOOST_NODE" ]; then
        echo "$touchboost" > "$TOUCHBOOST_NODE" 2>/dev/null
    fi
    
    echo "applied_saved"

    unset touchboost
}

# Main action handler
case "$1" in
    is_available)
        is_available
        ;;
    get_current)
        get_current
        ;;
    get_saved)
        get_saved
        ;;
    save)
        save "$2" "$3"
        ;;
    apply)
        apply "$2" "$3"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
