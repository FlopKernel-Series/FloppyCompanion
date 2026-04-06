#!/system/bin/sh
# Sound Control Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/soundcontrol.conf"

NODE_HEADPHONE="/sys/kernel/sound_control/headphone_gain"
NODE_MIC="/sys/kernel/sound_control/mic_gain"

# Check if sound control is available
is_available() {
    if [ -f "$NODE_HEADPHONE" ] || [ -f "$NODE_MIC" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current values
get_current() {
    local hp_l="0"
    local hp_r="0"
    local mic="0"
    
    if [ -f "$NODE_HEADPHONE" ]; then
        local hp_val=$(cat "$NODE_HEADPHONE" 2>/dev/null || echo "0 0")
        hp_l=$(echo "$hp_val" | awk '{print $1}')
        hp_r=$(echo "$hp_val" | awk '{print $2}')
        [ -z "$hp_l" ] && hp_l="0"
        [ -z "$hp_r" ] && hp_r="0"
    fi
    
    if [ -f "$NODE_MIC" ]; then
        mic=$(cat "$NODE_MIC" 2>/dev/null || echo "0")
    fi
    
    echo "hp_l=$hp_l"
    echo "hp_r=$hp_r"
    echo "mic=$mic"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

# Save config
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

    local hp_l="$1"
    local hp_r="$2"
    local mic="$3"
    
    [ -z "$hp_l" ] && hp_l="0"
    [ -z "$hp_r" ] && hp_r="0"
    [ -z "$mic" ] && mic="0"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
hp_l=$hp_l
hp_r=$hp_r
mic=$mic
EOF
    echo "saved"
}

# Apply settings
apply() {
    local hp_l="$1"
    local hp_r="$2"
    local mic="$3"
    
    # Apply headphone gain (write as "L R")
    if [ -f "$NODE_HEADPHONE" ] && [ -n "$hp_l" ] && [ -n "$hp_r" ]; then
        echo "$hp_l $hp_r" > "$NODE_HEADPHONE" 2>/dev/null
    fi
    
    # Apply mic gain
    if [ -f "$NODE_MIC" ] && [ -n "$mic" ]; then
        echo "$mic" > "$NODE_MIC" 2>/dev/null
    fi
    
    echo "applied"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    local hp_l=$(grep '^hp_l=' "$CONFIG_FILE" | cut -d= -f2)
    local hp_r=$(grep '^hp_r=' "$CONFIG_FILE" | cut -d= -f2)
    local mic=$(grep '^mic=' "$CONFIG_FILE" | cut -d= -f2)
    
    apply "$hp_l" "$hp_r" "$mic"
}

clear_saved() {
    rm -f "$CONFIG_FILE"
    echo "cleared"
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
        shift
        save "$@"
        ;;
    apply)
        apply "$2" "$3" "$4"
        ;;
    apply_saved)
        apply_saved
        ;;
    clear_saved)
        clear_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_saved|save|apply|apply_saved|clear_saved}"
        exit 1
        ;;
esac
