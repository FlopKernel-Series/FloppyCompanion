#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# KSWAPD Configuration Backend Script

MODDIR="${0%/*}/.."
DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/kswapd.conf"

THREADS_NODE="/sys/kernel/mm/vmscan/kswapd_threads"
CPU_NODE="/sys/kernel/mm/vmscan/kswapd_cpu"

get_max_cpus() {
    local max=0
    for c in /sys/devices/system/cpu/cpu[0-9]*; do
        [ -d "$c" ] || continue
        max=$((max + 1))
    done
    if [ "$max" -le 0 ]; then
        max=8
    fi
    echo "$max"
}

is_available() {
    if [ -f "$THREADS_NODE" ] || [ -f "$CPU_NODE" ]; then
        echo "available=1"
        return 0
    fi
    echo "available=0"
    return 1
}

get_capabilities() {
    local has_threads=0
    local has_affinity=0
    [ -f "$THREADS_NODE" ] && has_threads=1
    [ -f "$CPU_NODE" ] && has_affinity=1
    local max_cpus=$(get_max_cpus)
    echo "threads=$has_threads"
    echo "affinity=$has_affinity"
    echo "max_cpus=$max_cpus"
}

get_current() {
    local threads=""
    local affinity=""
    local max_cpus=$(get_max_cpus)

    if [ -f "$THREADS_NODE" ]; then
        threads=$(cat "$THREADS_NODE" 2>/dev/null)
    fi

    if [ -f "$CPU_NODE" ]; then
        local raw_aff=$(cat "$CPU_NODE" 2>/dev/null)
        if [ -n "$raw_aff" ]; then
            case "$raw_aff" in
                0x*|0X*)
                    affinity=$(printf "0x%x" "$raw_aff" 2>/dev/null || echo "$raw_aff")
                    ;;
                *)
                    affinity=$(printf "0x%x" "$raw_aff" 2>/dev/null || echo "0x$raw_aff")
                    ;;
            esac
        fi
    fi

    echo "threads=$threads"
    echo "affinity=$affinity"
    echo "max_cpus=$max_cpus"
}

get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "threads="
        echo "affinity="
    fi
}

save() {
    mkdir -p "$DATA_DIR/config" 2>/dev/null
    > "$CONFIG_FILE"
    for arg in "$@"; do
        case "$arg" in
            threads=*|affinity=*)
                echo "$arg" >> "$CONFIG_FILE"
                ;;
        esac
    done
    echo "saved"
}

apply() {
    local threads=""
    local affinity=""

    for arg in "$@"; do
        case "$arg" in
            threads=*) threads="${arg#threads=}" ;;
            affinity=*) affinity="${arg#affinity=}" ;;
        esac
    done

    if [ -z "$threads" ] && [ -z "$affinity" ]; then
        threads="$1"
        affinity="$2"
    fi

    if [ -n "$threads" ] && [ -f "$THREADS_NODE" ]; then
        echo "$threads" > "$THREADS_NODE" 2>/dev/null || true
    fi

    if [ -n "$affinity" ] && [ -f "$CPU_NODE" ]; then
        echo "$affinity" > "$CPU_NODE" 2>/dev/null || true
    fi

    echo "applied"
}

apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    local threads=$(grep '^threads=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)
    local affinity=$(grep '^affinity=' "$CONFIG_FILE" 2>/dev/null | cut -d= -f2)

    if [ -n "$threads" ] && [ -f "$THREADS_NODE" ]; then
        echo "$threads" > "$THREADS_NODE" 2>/dev/null || true
    fi
    if [ -n "$affinity" ] && [ -f "$CPU_NODE" ]; then
        echo "$affinity" > "$CPU_NODE" 2>/dev/null || true
    fi
    echo "applied"
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
