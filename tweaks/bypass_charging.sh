#!/system/bin/sh
# Bypass Charging Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/bypass_charging.conf"
NODE_INPUT_SUSPEND="/sys/class/power_supply/battery/input_suspend"

# Check availability
is_available() {
    if [ -f "$NODE_INPUT_SUSPEND" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current state
get_current() {
    enabled=""
    if [ -f "$NODE_INPUT_SUSPEND" ]; then
        enabled=$(cat "$NODE_INPUT_SUSPEND" 2>/dev/null || echo "")
    fi
    echo "enabled=$enabled"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "enabled=0"
    fi
}

# Save config
save() {
    enabled="$1"
    [ -z "$enabled" ] && enabled="0"

    mkdir -p "$(dirname "$CONFIG_FILE")"
    echo "enabled=$enabled" > "$CONFIG_FILE"
    echo "saved"
}

# Apply setting
apply() {
    enabled="$1"
    if [ ! -f "$NODE_INPUT_SUSPEND" ]; then
        echo "error: Node not available"
        return 1
    fi

    [ -z "$enabled" ] && enabled="0"
    echo "$enabled" > "$NODE_INPUT_SUSPEND" 2>/dev/null
    echo "applied"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    enabled=$(grep '^enabled=' "$CONFIG_FILE" | cut -d= -f2)
    if [ -n "$enabled" ] && [ -f "$NODE_INPUT_SUSPEND" ]; then
        echo "$enabled" > "$NODE_INPUT_SUSPEND" 2>/dev/null
    fi
    echo "applied_saved"
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
        save "$2"
        ;;
    apply)
        apply "$2"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
