#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Sound Control Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/soundcontrol.conf"

NODE_HEADPHONE="/sys/kernel/sound_control/headphone_gain"
NODE_MIC="/sys/kernel/sound_control/mic_gain"

sanitize_gain_range() {
    val="$1"
    min="$2"
    max="$3"

    if ! echo "$val" | grep -Eq '^-?[0-9]+$'; then
        return 1
    fi

    if [ "$val" -lt "$min" ]; then
        echo "$min"
    elif [ "$val" -gt "$max" ]; then
        echo "$max"
    else
        echo "$val"
    fi

    unset val min max
}

sanitize_headphone_gain() {
    sanitize_gain_range "$1" -40 20
}

sanitize_mic_gain() {
    sanitize_gain_range "$1" -10 20
}

read_headphone_gain() {
    raw="$1"
    set -- "$raw"

    left="${1:-0}"
    right="${2:-$left}"

    left=$(sanitize_headphone_gain "$left") || left=0
    right=$(sanitize_headphone_gain "$right") || right="$left"

    echo "$left $right"

    unset left right
}

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
    hp_l=0
    hp_r=0
    mic=0
    
    if [ -f "$NODE_HEADPHONE" ]; then
        hp_val=$(cat "$NODE_HEADPHONE" 2>/dev/null || echo "0 0")
        hp_pair
        hp_pair=$(read_headphone_gain "$hp_val")
        hp_l="${hp_pair%% *}"
        hp_r="${hp_pair#* }"
    fi
    
    if [ -f "$NODE_MIC" ]; then
        mic=$(cat "$NODE_MIC" 2>/dev/null || echo 0)
        mic=$(sanitize_mic_gain "$mic") || mic=0
    fi
    
    echo "hp_l=$hp_l"
    echo "hp_r=$hp_r"
    echo "mic=$mic"

    unset hp_l hp_r mic
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

            case "$key" in
                hp_l|hp_r)
                    val=$(sanitize_headphone_gain "$val") || val=""
                    ;;
                mic)
                    val=$(sanitize_mic_gain "$val") || val=""
                    ;;
            esac

            [ -n "$key" ] && [ -n "$val" ] && echo "$key=$val" >> "$CONFIG_FILE"
        done

        if [ ! -s "$CONFIG_FILE" ]; then
            rm -f "$CONFIG_FILE"
        fi

        echo "saved"
        return 0
    fi

    hp_l="$1"
    hp_r="$2"
    mic="$3"
    
    [ -z "$hp_l" ] && hp_l=0
    [ -z "$hp_r" ] && hp_r="$hp_l"
    [ -z "$mic" ] && mic=0

    hp_l=$(sanitize_headphone_gain "$hp_l") || hp_l=0
    hp_r=$(sanitize_headphone_gain "$hp_r") || hp_r="$hp_l"
    mic=$(sanitize_mic_gain "$mic") || mic=0
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
hp_l=$hp_l
hp_r=$hp_r
mic=$mic
EOF
    echo "saved"

    unset hp_l hp_r mic
}

# Apply settings
apply() {
    hp_l="$1"
    hp_r="$2"
    mic="$3"

    [ -z "$hp_r" ] && hp_r="$hp_l"

    [ -n "$hp_l" ] && hp_l=$(sanitize_headphone_gain "$hp_l")
    [ -n "$hp_r" ] && hp_r=$(sanitize_headphone_gain "$hp_r")
    [ -n "$mic" ] && mic=$(sanitize_mic_gain "$mic")
    
    # Apply headphone gain (write as "L R")
    if [ -f "$NODE_HEADPHONE" ] && [ -n "$hp_l" ] && [ -n "$hp_r" ]; then
        echo "$hp_l $hp_r" > "$NODE_HEADPHONE" 2>/dev/null
    fi
    
    # Apply mic gain
    if [ -f "$NODE_MIC" ] && [ -n "$mic" ]; then
        echo "$mic" > "$NODE_MIC" 2>/dev/null
    fi
    
    echo "applied"

    unset hp_l hp_r mic
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    hp_l=$(grep '^hp_l=' "$CONFIG_FILE" | cut -d= -f2)
    hp_r=$(grep '^hp_r=' "$CONFIG_FILE" | cut -d= -f2)
    mic=$(grep '^mic=' "$CONFIG_FILE" | cut -d= -f2)
    
    if [ -n "$hp_l" ] || [ -n "$hp_r" ] || [ -n "$mic" ]; then
        apply "$hp_l" "$hp_r" "$mic"
    fi

    unset hp_l hp_r mic
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
