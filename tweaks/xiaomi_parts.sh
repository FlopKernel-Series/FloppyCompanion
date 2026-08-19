#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Xiaomi Parts (Torch & Vibration Control) Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/xiaomi_parts.conf"

NODE_TORCH="/sys/devices/platform/soc/1c40000.qcom,spmi/spmi-0/spmi0-03/1c40000.qcom,spmi:qcom,pmi632@3:qcom,leds@d300/leds/led:torch_0/custom_brightness"
if [ ! -f "$NODE_TORCH" ] && [ -f "/sys/class/leds/led:torch_0/custom_brightness" ]; then
    NODE_TORCH="/sys/class/leds/led:torch_0/custom_brightness"
fi

NODE_VIBRATOR="/sys/class/leds/vibrator/vtg_level"
if [ ! -f "$NODE_VIBRATOR" ] && [ -f "/sys/devices/platform/soc/1c40000.qcom,spmi/spmi-0/spmi0-03/1c40000.qcom,spmi:qcom,pmi632@3:qcom,vibrator@5300/leds/vibrator/vtg_level" ]; then
    NODE_VIBRATOR="/sys/devices/platform/soc/1c40000.qcom,spmi/spmi-0/spmi0-03/1c40000.qcom,spmi:qcom,pmi632@3:qcom,vibrator@5300/leds/vibrator/vtg_level"
fi

TORCH_MIN_RAW=25
TORCH_MAX_RAW=255
TORCH_RANGE=$((TORCH_MAX_RAW - TORCH_MIN_RAW))

VIB_MIN_RAW=1504
VIB_MAX_RAW=3544
VIB_RANGE=$((VIB_MAX_RAW - VIB_MIN_RAW))

clamp_val() {
    local val="$1"
    local min="$2"
    local max="$3"

    if ! echo "$val" | grep -Eq '^[0-9]+$'; then
        echo "$min"
        return 0
    fi

    if [ "$val" -lt "$min" ]; then
        echo "$min"
    elif [ "$val" -gt "$max" ]; then
        echo "$max"
    else
        echo "$val"
    fi
}

raw_to_torch_pct() {
    local raw="$1"
    raw=$(clamp_val "$raw" "$TORCH_MIN_RAW" "$TORCH_MAX_RAW")
    local pct=$(( ((raw - TORCH_MIN_RAW) * 100 + (TORCH_RANGE / 2)) / TORCH_RANGE ))
    clamp_val "$pct" 10 100
}

torch_pct_to_raw() {
    local pct="$1"
    pct=$(clamp_val "$pct" 10 100)
    local raw=$(( TORCH_MIN_RAW + ((pct * TORCH_RANGE + 50) / 100) ))
    clamp_val "$raw" "$TORCH_MIN_RAW" "$TORCH_MAX_RAW"
}

raw_to_vib_pct() {
    local raw="$1"
    raw=$(clamp_val "$raw" "$VIB_MIN_RAW" "$VIB_MAX_RAW")
    local pct=$(( ((raw - VIB_MIN_RAW) * 100 + (VIB_RANGE / 2)) / VIB_RANGE ))
    clamp_val "$pct" 10 100
}

vib_pct_to_raw() {
    local pct="$1"
    pct=$(clamp_val "$pct" 10 100)
    local raw=$(( VIB_MIN_RAW + ((pct * VIB_RANGE + 50) / 100) ))
    clamp_val "$raw" "$VIB_MIN_RAW" "$VIB_MAX_RAW"
}

is_available() {
    if [ -f "$NODE_TORCH" ] || [ -f "$NODE_VIBRATOR" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_capabilities() {
    local torch=0
    local vibration=0

    [ -f "$NODE_TORCH" ] && torch=1
    [ -f "$NODE_VIBRATOR" ] && vibration=1

    echo "torch=$torch"
    echo "vibration=$vibration"
}

get_current() {
    local torch_pct="85"
    local vibration_pct="85"

    if [ -f "$NODE_TORCH" ]; then
        local raw_torch
        raw_torch=$(cat "$NODE_TORCH" 2>/dev/null || echo "$TORCH_MAX_RAW")
        torch_pct=$(raw_to_torch_pct "$raw_torch")
    fi

    if [ -f "$NODE_VIBRATOR" ]; then
        local raw_vib
        raw_vib=$(cat "$NODE_VIBRATOR" 2>/dev/null || echo "$VIB_MAX_RAW")
        vibration_pct=$(raw_to_vib_pct "$raw_vib")
    fi

    echo "torch_strength=$torch_pct"
    echo "vibration_strength=$vibration_pct"
}

get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "torch_strength="
        echo "vibration_strength="
    fi
}

save() {
    local torch_strength=""
    local vibration_strength=""

    if [ "$#" -eq 0 ]; then
        rm -f "$CONFIG_FILE"
        echo "saved"
        return 0
    fi

    for arg in "$@"; do
        case "$arg" in
            torch_strength=*)
                torch_strength="${arg#torch_strength=}"
                ;;
            vibration_strength=*)
                vibration_strength="${arg#vibration_strength=}"
                ;;
            *)
                if [ -z "$torch_strength" ]; then
                    torch_strength="$arg"
                elif [ -z "$vibration_strength" ]; then
                    vibration_strength="$arg"
                fi
                ;;
        esac
    done

    mkdir -p "$(dirname "$CONFIG_FILE")"
    : > "$CONFIG_FILE"

    if [ -n "$torch_strength" ]; then
        torch_strength=$(clamp_val "$torch_strength" 10 100)
        echo "torch_strength=$torch_strength" >> "$CONFIG_FILE"
    fi

    if [ -n "$vibration_strength" ]; then
        vibration_strength=$(clamp_val "$vibration_strength" 10 100)
        echo "vibration_strength=$vibration_strength" >> "$CONFIG_FILE"
    fi

    if [ ! -s "$CONFIG_FILE" ]; then
        rm -f "$CONFIG_FILE"
    fi

    echo "saved"
}

apply() {
    local torch_strength=""
    local vibration_strength=""

    for arg in "$@"; do
        case "$arg" in
            torch_strength=*)
                torch_strength="${arg#torch_strength=}"
                ;;
            vibration_strength=*)
                vibration_strength="${arg#vibration_strength=}"
                ;;
            *)
                if [ -z "$torch_strength" ]; then
                    torch_strength="$arg"
                elif [ -z "$vibration_strength" ]; then
                    vibration_strength="$arg"
                fi
                ;;
        esac
    done

    if [ -f "$NODE_TORCH" ] && [ -n "$torch_strength" ]; then
        local raw_torch
        raw_torch=$(torch_pct_to_raw "$torch_strength")
        echo "$raw_torch" > "$NODE_TORCH" 2>/dev/null || true
    fi

    if [ -f "$NODE_VIBRATOR" ] && [ -n "$vibration_strength" ]; then
        local raw_vib
        raw_vib=$(vib_pct_to_raw "$vibration_strength")
        echo "$raw_vib" > "$NODE_VIBRATOR" 2>/dev/null || true
    fi

    echo "applied"
}

apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    local torch_strength=$(grep '^torch_strength=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)
    local vibration_strength=$(grep '^vibration_strength=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)

    if [ -n "$torch_strength" ] || [ -n "$vibration_strength" ]; then
        apply "torch_strength=$torch_strength" "vibration_strength=$vibration_strength"
    fi
}

case "$1" in
    is_available)
        is_available
        ;;
    get_capabilities)
        get_capabilities
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
        shift
        apply "$@"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_capabilities|get_current|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
