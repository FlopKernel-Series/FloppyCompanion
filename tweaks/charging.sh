#!/system/bin/sh
# Charging Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/charging.conf"
NODE_BYPASS="/sys/class/power_supply/battery/input_suspend"
NODE_FAST="/sys/kernel/fast_charge/force_fast_charge"

# Check availability
is_available() {
    if [ -f "$NODE_BYPASS" ] || [ -f "$NODE_FAST" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current state
get_current() {
    bypass=""
    fast=""
    if [ -f "$NODE_BYPASS" ]; then
        bypass=$(cat "$NODE_BYPASS" 2>/dev/null || echo "0")
    fi
    if [ -f "$NODE_FAST" ]; then
        fast=$(cat "$NODE_FAST" 2>/dev/null || echo "0")
    fi
    echo "bypass=$bypass"
    echo "fast=$fast"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

# Save config
save() {
    bypass="$1"
    fast="$2"
    [ -z "$bypass" ] && bypass="0"
    [ -z "$fast" ] && fast="0"

    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
bypass=$bypass
fast=$fast
EOF
    echo "saved"
}

# Apply setting
apply() {
    bypass="$1"
    fast="$2"
    [ -z "$bypass" ] && bypass="0"
    [ -z "$fast" ] && fast="0"

    if [ -f "$NODE_BYPASS" ]; then
        echo "$bypass" > "$NODE_BYPASS" 2>/dev/null
    fi
    if [ -f "$NODE_FAST" ]; then
        echo "$fast" > "$NODE_FAST" 2>/dev/null
    fi
    echo "applied"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    bypass=$(grep '^bypass=' "$CONFIG_FILE" | cut -d= -f2)
    fast=$(grep '^fast=' "$CONFIG_FILE" | cut -d= -f2)

    if [ -n "$bypass" ] && [ -f "$NODE_BYPASS" ]; then
        echo "$bypass" > "$NODE_BYPASS" 2>/dev/null
    fi
    if [ -n "$fast" ] && [ -f "$NODE_FAST" ]; then
        echo "$fast" > "$NODE_FAST" 2>/dev/null
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
