#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Thermal Control Tweak Backend Script (Floppy2100 only)
# Exposes LITTLE/MID/BIG/G3D trip offsets directly in Celsius.

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/thermal_control.conf"
DEFAULTS_FILE="$DATA_DIR/presets/.defaults.json"

BIG_NODE="/proc/exynos_tmu/BIG_offset"
MID_NODE="/proc/exynos_tmu/MID_offset"
LITTLE_NODE="/proc/exynos_tmu/LITTLE_offset"
G3D_NODE="/proc/exynos_tmu/G3D_offset"

OFFSET_MIN_C=-50
OFFSET_MAX_C=15
BOOT_SETTLE_SECONDS=55

thermal_control_available() {
    [ -e "$BIG_NODE" ] && [ -e "$MID_NODE" ] && [ -e "$LITTLE_NODE" ] && [ -e "$G3D_NODE" ]
}

is_integer() {
    printf '%s' "$1" | grep -Eq '^-?[0-9]+$'
}

sanitize_int() {
    value="$1"
    fallback="$2"

    if is_integer "$value"; then
        echo "$value"
    else
        echo "$fallback"
    fi

    unset value fallback
}

clamp_c() {
    value=$(sanitize_int "$1" 0)

    if [ "$value" -lt "$OFFSET_MIN_C" ]; then
        value="$OFFSET_MIN_C"
    fi

    if [ "$value" -gt "$OFFSET_MAX_C" ]; then
        value="$OFFSET_MAX_C"
    fi

    echo "$value"

    unset value
}

read_offset_node_mc() {
    node="$1"
    fallback="$2"
    value=""

    if [ -e "$node" ]; then
        value=$(cat "$node" 2>/dev/null || echo "")
    fi

    sanitize_int "$value" "$fallback"

    unset node fallback value
}

read_offset_node_c() {
    raw=$(read_offset_node_mc "$1" "$2")
    echo $((raw / 1000))
    unset raw
}

read_defaults_value() {
    section="$1"
    key="$2"

    if [ ! -f "$DEFAULTS_FILE" ]; then
        return 1
    fi

    awk -v section="$section" -v key="$key" '
        BEGIN {
            in_section = 0
        }
        $0 ~ "^[[:space:]]*\"" section "\": \\{" {
            in_section = 1
            next
        }
        in_section && $0 ~ "^[[:space:]]*}" {
            in_section = 0
            next
        }
        in_section {
            pattern = "^[[:space:]]*\"" key "\": \""
            if ($0 ~ pattern) {
                line = $0
                sub(pattern, "", line)
                sub(/".*$/, "", line)
                print line
                exit
            }
        }
    ' "$DEFAULTS_FILE" 2>/dev/null

    unset section key
}

resolve_default_setting_c() {
    key="$1"
    node="$2"
    fallback_mc="$3"
    value=$(read_defaults_value "thermal_control" "$key")

    if [ -n "$value" ]; then
        sanitize_int "$value" "$((fallback_mc / 1000))"
        return 0
    fi

    read_offset_node_c "$node" "$fallback_mc"

    unset key node fallback_mc value
}

is_available() {
    if thermal_control_available; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_current() {
    echo "big_offset=$(read_offset_node_mc "$BIG_NODE" "-10000")"
    echo "mid_offset=$(read_offset_node_mc "$MID_NODE" "-10000")"
    echo "little_offset=$(read_offset_node_mc "$LITTLE_NODE" "-8000")"
    echo "g3d_offset=$(read_offset_node_mc "$G3D_NODE" "-13000")"
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

    if echo "$1" | grep -q '='; then
        mkdir -p "$(dirname "$CONFIG_FILE")"
        : > "$CONFIG_FILE"

        for arg in "$@"; do
            key="${arg%%=*}"
            val="${arg#*=}"
            if [ -z "$key" ] || [ -z "$val" ]; then
                continue
            fi
            if [ "$key" = "performance_mode" ]; then
                echo "$key=$(sanitize_int "$val" 0)" >> "$CONFIG_FILE"
            else
                echo "$key=$(clamp_c "$val")" >> "$CONFIG_FILE"
            fi
        done

        if [ ! -s "$CONFIG_FILE" ]; then
            rm -f "$CONFIG_FILE"
        fi

        echo "saved"
        return 0
    fi

    little=$(clamp_c "$1")
    big=$(clamp_c "$2")
    prime=$(clamp_c "$3")
    g3d=$(clamp_c "$4")

    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
little=$little
big=$big
prime=$prime
g3d=$g3d
EOF
    echo "saved"

    unset little big prime g3d
}

apply() {
    if ! thermal_control_available; then
        echo "error: Thermal control not available"
        return 1
    fi

    little=$(clamp_c "$1")
    big=$(clamp_c "$2")
    prime=$(clamp_c "$3")
    g3d=$(clamp_c "$4")

    if [ -e "$LITTLE_NODE" ]; then
        echo $((little * 1000)) > "$LITTLE_NODE" 2>/dev/null
    fi

    if [ -e "$MID_NODE" ]; then
        echo $((big * 1000)) > "$MID_NODE" 2>/dev/null
    fi

    if [ -e "$BIG_NODE" ]; then
        echo $((prime * 1000)) > "$BIG_NODE" 2>/dev/null
    fi

    if [ -e "$G3D_NODE" ]; then
        echo $((g3d * 1000)) > "$G3D_NODE" 2>/dev/null
    fi

    echo "applied"

    unset little big prime g3d
}

apply_saved() {
    little=$(resolve_default_setting_c "little" "$LITTLE_NODE" "-8000")
    big=$(resolve_default_setting_c "big" "$MID_NODE" "-10000")
    prime=$(resolve_default_setting_c "prime" "$BIG_NODE" "-10000")
    g3d=$(resolve_default_setting_c "g3d" "$G3D_NODE" "-13000")
    performance_mode=0

    if [ -f "$CONFIG_FILE" ]; then
        saved_value=$(grep '^little=' "$CONFIG_FILE" | cut -d= -f2)
        [ -n "$saved_value" ] && little=$(clamp_c "$saved_value")

        saved_value=$(grep '^big=' "$CONFIG_FILE" | cut -d= -f2)
        [ -n "$saved_value" ] && big=$(clamp_c "$saved_value")

        saved_value=$(grep '^prime=' "$CONFIG_FILE" | cut -d= -f2)
        [ -n "$saved_value" ] && prime=$(clamp_c "$saved_value")

        saved_value=$(grep '^g3d=' "$CONFIG_FILE" | cut -d= -f2)
        [ -n "$saved_value" ] && g3d=$(clamp_c "$saved_value")

        saved_value=$(grep '^performance_mode=' "$CONFIG_FILE" | cut -d= -f2)
        [ -n "$saved_value" ] && performance_mode=$(sanitize_int "$saved_value" 0)
    fi

    if [ "$performance_mode" = 1 ]; then
        little=0
        big=0
        prime=0
        g3d=0
    fi

    apply "$little" "$big" "$prime" "$g3d"

    unset little big prime g3d performance_mode
}

clear_saved() {
    rm -f "$CONFIG_FILE"
    echo "cleared"
}

emit_defaults_fragment() {
    thermal_control_available || return 1

    little=$(read_offset_node_c "$LITTLE_NODE" "-8000")
    big=$(read_offset_node_c "$MID_NODE" "-10000")
    prime=$(read_offset_node_c "$BIG_NODE" "-10000")
    g3d=$(read_offset_node_c "$G3D_NODE" "-13000")

    cat << EOF
    "thermal_control": {
      "performance_mode": 0,
      "little": "$little",
      "big": "$big",
      "prime": "$prime",
      "g3d": "$g3d"
    }
EOF

    unset little big prime g3d
}

capture_settled_defaults() {
    thermal_control_available || return 0
    [ -f "$DEFAULTS_FILE" ] || return 0

    fragment="$(emit_defaults_fragment)"
    [ -n "$fragment" ] || return 1

    tmp_file="${DEFAULTS_FILE}.tmp.$$"

    awk -v fragment="$fragment" '
        BEGIN {
            skip = 0
            replaced = 0
        }
        /^    "thermal_control": \{/ {
            if (!replaced) {
                print fragment
                replaced = 1
            }
            skip = 1
            next
        }
        skip {
            if (/^    }$/) {
                skip = 0
                next
            }
            next
        }
        { print }
    ' "$DEFAULTS_FILE" > "$tmp_file" && mv -f "$tmp_file" "$DEFAULTS_FILE"

    unset fragment tmp_file
}

wait_for_boot_settle() {
    uptime_seconds=0

    while [ "$(getprop sys.boot_completed)" != 1 ]; do
        sleep 1
    done

    while :; do
        uptime_seconds=$(cut -d. -f1 /proc/uptime 2>/dev/null || echo 0)
        uptime_seconds=$(sanitize_int "$uptime_seconds" 0)

        if [ "$uptime_seconds" -ge "$BOOT_SETTLE_SECONDS" ]; then
            break
        fi

        sleep 1
    done

    unset uptime_seconds
}

sync_boot_state() {
    thermal_control_available || return 0
    wait_for_boot_settle
    capture_settled_defaults
    apply_saved
}

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
        apply "$2" "$3" "$4" "$5"
        ;;
    apply_saved)
        apply_saved
        ;;
    clear_saved)
        clear_saved
        ;;
    emit_defaults_fragment)
        emit_defaults_fragment
        ;;
    capture_settled_defaults)
        capture_settled_defaults
        ;;
    sync_boot_state)
        sync_boot_state
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_saved|save|apply|apply_saved|clear_saved|emit_defaults_fragment|capture_settled_defaults|sync_boot_state}"
        exit 1
        ;;
esac
