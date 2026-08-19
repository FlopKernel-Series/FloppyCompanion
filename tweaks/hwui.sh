#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# HWUI renderer tweak backend

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/hwui.conf"

get_rom_default() {
    local prop_line
    local prop_value

    prop_line=$(getprop 2>/dev/null | grep '^\[ro\.hwui\.use_vulkan\]:' | head -n 1)
    if [ -z "$prop_line" ]; then
        echo "Unknown"
        return 0
    fi

    prop_value=$(getprop ro.hwui.use_vulkan 2>/dev/null)
    if [ "$prop_value" = "true" ]; then
        echo "Vulkan"
        return 0
    fi

    if [ -z "$prop_value" ]; then
        echo "OpenGL"
        return 0
    fi

    echo "OpenGL"
}

normalize_renderer() {
    case "$1" in
        default|skiagl|skiavk)
            echo "$1"
            ;;
        *)
            echo "default"
            ;;
    esac
}

get_current() {
    local renderer
    local disable_sbwc=0
    renderer=$(getprop debug.hwui.renderer 2>/dev/null)
    renderer=$(normalize_renderer "$renderer")

    local sbwc_val
    sbwc_val=$(getprop vendor.debug.c2.sbwc.enable 2>/dev/null)
    if [ "$sbwc_val" = "false" ]; then
        disable_sbwc=1
    fi

    echo "renderer=$renderer"
    echo "rom_default=$(get_rom_default)"
    echo "disable_sbwc=$disable_sbwc"
}

get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "renderer="
        echo "disable_sbwc="
    fi
}

save() {
    local renderer=""
    local disable_sbwc=""

    if [ "$#" -eq 0 ]; then
        rm -f "$CONFIG_FILE"
        echo "saved"
        return 0
    fi

    for arg in "$@"; do
        case "$arg" in
            renderer=*)
                renderer="${arg#renderer=}"
                ;;
            disable_sbwc=*)
                disable_sbwc="${arg#disable_sbwc=}"
                ;;
            *)
                if [ -z "$renderer" ]; then
                    renderer="$arg"
                fi
                ;;
        esac
    done

    [ -n "$renderer" ] && renderer=$(normalize_renderer "$renderer")
    mkdir -p "$(dirname "$CONFIG_FILE")"

    > "$CONFIG_FILE"
    if [ -n "$renderer" ] && [ "$renderer" != "default" ]; then
        echo "renderer=$renderer" >> "$CONFIG_FILE"
    fi
    if [ -n "$disable_sbwc" ] && [ "$disable_sbwc" != "0" ]; then
        echo "disable_sbwc=$disable_sbwc" >> "$CONFIG_FILE"
    fi

    if [ ! -s "$CONFIG_FILE" ]; then
        rm -f "$CONFIG_FILE"
    fi

    echo "saved"
}

apply() {
    local renderer=""
    local disable_sbwc=""

    for arg in "$@"; do
        case "$arg" in
            renderer=*)
                renderer="${arg#renderer=}"
                ;;
            disable_sbwc=*)
                disable_sbwc="${arg#disable_sbwc=}"
                ;;
            *)
                if [ -z "$renderer" ]; then
                    renderer="$arg"
                elif [ -z "$disable_sbwc" ]; then
                    disable_sbwc="$arg"
                fi
                ;;
        esac
    done

    if [ -n "$renderer" ]; then
        renderer=$(normalize_renderer "$renderer")
        if [ "$renderer" = "default" ]; then
            if command -v resetprop >/dev/null 2>&1; then
                resetprop -d debug.hwui.renderer >/dev/null 2>&1 || true
            fi
            setprop debug.hwui.renderer "" 2>/dev/null || true
        else
            if command -v resetprop >/dev/null 2>&1; then
                resetprop -n debug.hwui.renderer "$renderer" >/dev/null 2>&1 || true
            fi
            setprop debug.hwui.renderer "$renderer" 2>/dev/null || true
        fi
    fi

    if [ -n "$disable_sbwc" ]; then
        if [ "$disable_sbwc" = "1" ] || [ "$disable_sbwc" = "true" ]; then
            if command -v resetprop >/dev/null 2>&1; then
                resetprop -n vendor.debug.c2.sbwc.enable false >/dev/null 2>&1 || true
            fi
            setprop vendor.debug.c2.sbwc.enable false 2>/dev/null || true
        else
            if command -v resetprop >/dev/null 2>&1; then
                resetprop -d vendor.debug.c2.sbwc.enable >/dev/null 2>&1 || true
            fi
            setprop vendor.debug.c2.sbwc.enable "" 2>/dev/null || true
        fi
    fi

    echo "applied"
}

apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    local renderer=$(grep '^renderer=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)
    local disable_sbwc=$(grep '^disable_sbwc=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)

    apply "renderer=$renderer" "disable_sbwc=$disable_sbwc"
}

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
        shift
        apply "$@"
        ;;
    apply_saved)
        apply_saved
        ;;
    rom_default)
        get_rom_default
        ;;
    *)
        echo "usage: $0 {get_current|get_saved|save|apply|apply_saved|rom_default}"
        exit 1
        ;;
esac
