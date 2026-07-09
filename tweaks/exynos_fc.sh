#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/exynos_fc.conf"
FC_DIR="/sys/kernel/exynos_fc"
GPU_CLAMP_NODE="/sys/kernel/gpu/gpu_clamp"
CPUFREQ_DIR="/sys/devices/system/cpu/cpufreq"
FVMAP_DIR="/sys/kernel/fvmap/fv_tables"
GPU_SYSFS_DIR="/sys/kernel/gpu"
CLUSTER_KEYS="cpucl0 cpucl1 cpucl2 gpu power_mode"

is_valid_key() {
    case "$1" in
        cpucl0|cpucl1|cpucl2|gpu|power_mode) return 0 ;;
        *) return 1 ;;
    esac
}

cluster_index() {
    case "$1" in
        cpucl0) echo "0" ;;
        cpucl1) echo "1" ;;
        cpucl2) echo "2" ;;
        *) echo "" ;;
    esac
}

node_for_key() {
    if [ "$1" = "power_mode" ]; then
        echo "$FC_DIR/power_mode"
    elif [ "$1" = "gpu" ]; then
        echo "$GPU_CLAMP_NODE"
    else
        echo "$FC_DIR/${1}_clamp"
    fi
}

sanitize_freq() {
    case "$1" in
        ''|*[!0-9]*) echo "0" ;;
        *) echo "$1" ;;
    esac
}

read_node_or_zero() {
    node="$1"
    if [ -f "$node" ]; then
        sanitize_freq "$(cat "$node" 2>/dev/null)"
    else
        echo "0"
    fi
}

get_policy_for_cluster() {
    target="$1"
    idx=0
    for policy_num in $(ls -d "$CPUFREQ_DIR"/policy* 2>/dev/null | sed 's/.*policy//' | sort -n); do
        [ -d "$CPUFREQ_DIR/policy$policy_num" ] || continue
        if [ "$idx" = "$target" ]; then
            echo "$CPUFREQ_DIR/policy$policy_num"
            return 0
        fi
        idx=$((idx + 1))
    done
    return 1
}

get_available_for_key() {
    key="$1"
    if [ "$key" = "power_mode" ]; then
        echo "0,1"
        return 0
    elif [ "$key" = "gpu" ]; then
        if [ -f "$FVMAP_DIR/g3d_fv_table" ]; then
            awk 'NR > 1 && $1 ~ /^[0-9]+$/ { print $1 }' "$FVMAP_DIR/g3d_fv_table" 2>/dev/null | sort -n | uniq | tr '\n' ',' | sed 's/,$//'
        elif [ -f "$GPU_SYSFS_DIR/gpu_freq_table" ]; then
            tr ' ' '\n' < "$GPU_SYSFS_DIR/gpu_freq_table" 2>/dev/null | sed '/^[0-9][0-9]*$/!d' | sort -n | uniq | tr '\n' ',' | sed 's/,$//'
        fi
        return 0
    fi
    idx=$(cluster_index "$key")
    [ -n "$idx" ] || return 0
    policy=$(get_policy_for_cluster "$idx") || return 0
    if [ -f "$policy/scaling_available_frequencies" ]; then
        list=$(cat "$policy/scaling_available_frequencies" 2>/dev/null)
        echo "$list" | tr ' ' '\n' | sed '/^$/d' | sort -n | uniq | tr '\n' ',' | sed 's/,$//'
    fi
}

has_any_node() {
    for key in $CLUSTER_KEYS; do
        [ -f "$(node_for_key "$key")" ] && return 0
    done
    return 1
}

is_available() {
    if has_any_node; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_current() {
    for key in $CLUSTER_KEYS; do
        if [ -f "$(node_for_key "$key")" ]; then
            echo "$key=$(read_node_or_zero "$(node_for_key "$key")")"
        fi
    done
}

get_all() {
    for key in $CLUSTER_KEYS; do
        [ -f "$(node_for_key "$key")" ] || continue
        echo "cluster=$key"
        echo "current=$(read_node_or_zero "$(node_for_key "$key")")"
        echo "available=$(get_available_for_key "$key")"
        echo "---"
    done
}

get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

save() {
    if [ "$#" -eq 0 ]; then
        rm -f "$CONFIG_FILE"
        echo "saved"
        return 0
    fi

    mkdir -p "$(dirname "$CONFIG_FILE")"
    : > "$CONFIG_FILE"

    for arg in "$@"; do
        key="${arg%%=*}"
        val="${arg#*=}"
        is_valid_key "$key" || continue
        echo "$key=$(sanitize_freq "$val")" >> "$CONFIG_FILE"
    done

    if [ ! -s "$CONFIG_FILE" ]; then
        rm -f "$CONFIG_FILE"
    fi

    echo "saved"
}

apply() {
    failed=0
    pm_val=""
    for arg in "$@"; do
        key="${arg%%=*}"
        val="${arg#*=}"
        if [ "$key" = "power_mode" ]; then
            pm_val="$val"
            break
        fi
    done

    if [ "$pm_val" = "0" ]; then
        node=$(node_for_key "power_mode")
        if [ -f "$node" ]; then
            if ! echo "0" > "$node" 2>/dev/null; then
                echo "error: failed to write power_mode" >&2
                failed=1
            fi
        fi
    fi

    for arg in "$@"; do
        key="${arg%%=*}"
        val="${arg#*=}"
        is_valid_key "$key" || continue

        if [ "$key" = "power_mode" ]; then
            if [ "$val" = "1" ]; then
                node=$(node_for_key "power_mode")
                [ -f "$node" ] || continue
                if ! echo "1" > "$node" 2>/dev/null; then
                    echo "error: failed to write power_mode" >&2
                    failed=1
                fi
            fi
            continue
        fi

        if [ "$pm_val" = "1" ]; then
            case "$key" in
                cpucl*) continue ;;
            esac
        fi

        node=$(node_for_key "$key")
        [ -f "$node" ] || continue
        if ! echo "$(sanitize_freq "$val")" > "$node" 2>/dev/null; then
            echo "error: failed to write $key" >&2
            failed=1
        fi
    done
    if [ "$failed" != "0" ]; then
        echo "error: failed"
        return 1
    fi
    echo "applied"
}

apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        apply "$line" >/dev/null
    done < "$CONFIG_FILE"
    echo "applied"
}

clear_saved() {
    rm -f "$CONFIG_FILE"
    echo "cleared"
}

case "$1" in
    is_available)
        is_available
        ;;
    get_current)
        get_current
        ;;
    get_all)
        get_all
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
    clear_saved)
        clear_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_all|get_saved|save|apply|apply_saved|clear_saved}"
        exit 1
        ;;
esac
