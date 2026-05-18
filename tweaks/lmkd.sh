#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# LMKD (Low Memory Killer daemon) tweak backend

DATA_DIR="/data/adb/floppy_companion"
CONF_FILE="$DATA_DIR/config/lmkd.conf"
PROP_PREFIX="persist.device_config.lmkd_native"
MANAGED_KEYS="use_psi use_minfree_levels low medium critical critical_upgrade upgrade_pressure downgrade_pressure kill_heaviest_task kill_timeout_ms psi_partial_stall_ms psi_complete_stall_ms thrashing_limit thrashing_limit_decay swap_util_max swap_free_low_percentage"

normalize_bool() {
    case "$1" in
        1|true|TRUE|y|Y|yes|YES|on|ON)
            echo 1
            ;;
        0|false|FALSE|n|N|no|NO|off|OFF)
            echo 0
            ;;
        *)
            echo "$1"
            ;;
    esac
}

is_low_ram_device() {
    [ "$(normalize_bool "$(getprop ro.config.low_ram 2>/dev/null)")" = 1 ]
}

has_memcg_v1() {
    [ -d /sys/fs/cgroup/memory ]
}

default_for() {
    case "$1" in
        use_psi)
            echo 1
            ;;
        use_minfree_levels)
            echo 0
            ;;
        *)
            echo ""
            ;;
    esac
}

get_effective_prop() {
    key="$1"
    value="$(getprop "$PROP_PREFIX.$key" 2>/dev/null)"

    if [ -z "$value" ]; then
        value="$(get_default_prop "$key")"
    fi

    case "$key" in
        use_psi|use_minfree_levels|critical_upgrade|kill_heaviest_task)
            value="$(normalize_bool "$value")"
            ;;
    esac

    echo "$value"
}

get_default_prop() {
    key="$1"
    value="$(getprop "ro.lmk.$key" 2>/dev/null)"

    if [ -z "$value" ]; then
        value="$(default_for "$key")"
    fi

    case "$key" in
        use_psi|use_minfree_levels|critical_upgrade|kill_heaviest_task)
            value="$(normalize_bool "$value")"
            ;;
    esac

    echo "$value"
}

set_lmkd_prop() {
    key="$1"
    value="$2"

    case "$key" in
        use_psi|use_minfree_levels|critical_upgrade|kill_heaviest_task)
            value="$(normalize_bool "$value")"
            ;;
    esac

    setprop "$PROP_PREFIX.$key" "$value"
}

clear_lmkd_prop() {
    setprop "$PROP_PREFIX.$1" ""
}

reinit_lmkd() {
    if [ -x /system/bin/lmkd ]; then
        /system/bin/lmkd --reinit >/dev/null 2>&1 && return 0
    fi

    setprop lmkd.reinit 1 >/dev/null 2>&1
}

get_support() {
    if has_memcg_v1; then
        echo "legacy_minfree_supported=1"
        echo "psi_disable_supported=1"
    else
        echo "legacy_minfree_supported=0"
        echo "psi_disable_supported=0"
    fi
}

validate_args() {
    for arg in "$@"; do
        key="${arg%%=*}"
        value="${arg#*=}"

        if ! has_memcg_v1; then
            if [ "$key" = "use_minfree_levels" ] && [ "$(normalize_bool "$value")" = 1 ]; then
                return 1
            fi
            if [ "$key" = "use_psi" ] && [ "$(normalize_bool "$value")" = 0 ]; then
                return 1
            fi
        fi
    done

    return 0
}

get_current() {
    echo "use_psi=$(get_effective_prop use_psi)"
    echo "use_minfree_levels=$(get_effective_prop use_minfree_levels)"
    echo "low=$(get_effective_prop low)"
    echo "medium=$(get_effective_prop medium)"
    echo "critical=$(get_effective_prop critical)"
    echo "critical_upgrade=$(get_effective_prop critical_upgrade)"
    echo "upgrade_pressure=$(get_effective_prop upgrade_pressure)"
    echo "downgrade_pressure=$(get_effective_prop downgrade_pressure)"
    echo "kill_heaviest_task=$(get_effective_prop kill_heaviest_task)"
    echo "kill_timeout_ms=$(get_effective_prop kill_timeout_ms)"
    echo "psi_partial_stall_ms=$(get_effective_prop psi_partial_stall_ms)"
    echo "psi_complete_stall_ms=$(get_effective_prop psi_complete_stall_ms)"
    echo "thrashing_limit=$(get_effective_prop thrashing_limit)"
    echo "thrashing_limit_decay=$(get_effective_prop thrashing_limit_decay)"
    echo "swap_util_max=$(get_effective_prop swap_util_max)"
    echo "swap_free_low_percentage=$(get_effective_prop swap_free_low_percentage)"
}

get_defaults() {
    echo "use_psi=$(get_default_prop use_psi)"
    echo "use_minfree_levels=$(get_default_prop use_minfree_levels)"
    echo "low=$(get_default_prop low)"
    echo "medium=$(get_default_prop medium)"
    echo "critical=$(get_default_prop critical)"
    echo "critical_upgrade=$(get_default_prop critical_upgrade)"
    echo "upgrade_pressure=$(get_default_prop upgrade_pressure)"
    echo "downgrade_pressure=$(get_default_prop downgrade_pressure)"
    echo "kill_heaviest_task=$(get_default_prop kill_heaviest_task)"
    echo "kill_timeout_ms=$(get_default_prop kill_timeout_ms)"
    echo "psi_partial_stall_ms=$(get_default_prop psi_partial_stall_ms)"
    echo "psi_complete_stall_ms=$(get_default_prop psi_complete_stall_ms)"
    echo "thrashing_limit=$(get_default_prop thrashing_limit)"
    echo "thrashing_limit_decay=$(get_default_prop thrashing_limit_decay)"
    echo "swap_util_max=$(get_default_prop swap_util_max)"
    echo "swap_free_low_percentage=$(get_default_prop swap_free_low_percentage)"
}

get_saved() {
    if [ -f "$CONF_FILE" ]; then
        cat "$CONF_FILE"
    fi
}

save() {
    shift

    if [ "$#" -eq 0 ]; then
        rm -f "$CONF_FILE"
        echo "Saved LMKD settings"
        return 0
    fi

    mkdir -p "$(dirname "$CONF_FILE")"
    echo "# LMKD Config" > "$CONF_FILE"
    for arg in "$@"; do
        echo "$arg" >> "$CONF_FILE"
    done

    echo "Saved LMKD settings"
}

apply_args() {
    for arg in "$@"; do
        key="${arg%%=*}"
        value="${arg#*=}"

        [ -z "$key" ] && continue
        set_lmkd_prop "$key" "$value"
    done
}

apply() {
    shift

    if ! validate_args "$@"; then
        echo "Unsupported LMKD settings"
        return 1
    fi

    for key in $MANAGED_KEYS; do
        clear_lmkd_prop "$key"
    done

    apply_args "$@"
    reinit_lmkd
    echo "Applied LMKD settings"
}

apply_saved() {
    has_custom=0

    for key in $MANAGED_KEYS; do
        value="$(getprop "$PROP_PREFIX.$key" 2>/dev/null)"
        if [ -n "$value" ]; then
            has_custom=1
            break
        fi
    done

    if [ ! -f "$CONF_FILE" ] && [ "$has_custom" != 0 ]; then
        return 0
    fi

    args=""

    if [ -f "$CONF_FILE" ]; then
        while IFS= read -r line; do
            case "$line" in
                \#*|"")
                    continue
                    ;;
            esac

            key="${line%%=*}"
            value="${line#*=}"
            if ! has_memcg_v1; then
                if [ "$key" = "use_minfree_levels" ] && [ "$(normalize_bool "$value")" = 1 ]; then
                    continue
                fi
                if [ "$key" = "use_psi" ] && [ "$(normalize_bool "$value")" = 0 ]; then
                    continue
                fi
            fi

            if [ -z "$args" ]; then
                args="$line"
            else
                args="$args
$line"
            fi
        done < "$CONF_FILE"
    fi

    for key in $MANAGED_KEYS; do
        clear_lmkd_prop "$key"
    done

    if [ -n "$args" ]; then
        OLD_IFS="$IFS"
        IFS='
'
        # shellcheck disable=SC2086
        apply_args $args
        IFS="$OLD_IFS"
    fi

    reinit_lmkd
    echo "Applied saved LMKD settings"
}

case "$1" in
    get_current)
        get_current
        ;;
    get_defaults)
        get_defaults
        ;;
    get_support)
        get_support
        ;;
    get_saved)
        get_saved
        ;;
    save)
        save "$@"
        ;;
    apply)
        apply "$@"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {get_current|get_defaults|get_support|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
