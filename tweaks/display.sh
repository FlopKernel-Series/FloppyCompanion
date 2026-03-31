#!/system/bin/sh
# Display Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/display.conf"
NODE_HBM="/sys/devices/platform/soc/soc:qcom,dsi-display/hbm"
NODE_CABC="/sys/devices/platform/soc/soc:qcom,dsi-display/cabc"

is_available() {
    if [ -f "$NODE_HBM" ] || [ -f "$NODE_CABC" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_current() {
    hbm=""
    cabc=""
    if [ -f "$NODE_HBM" ]; then
        hbm=$(cat "$NODE_HBM" 2>/dev/null || echo "")
    fi
    if [ -f "$NODE_CABC" ]; then
        cabc=$(cat "$NODE_CABC" 2>/dev/null || echo "")
    fi
    echo "hbm=$hbm"
    echo "cabc=$cabc"
}

get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

save() {
    hbm="$1"
    cabc="$2"
    [ -z "$hbm" ] && hbm="0"
    [ -z "$cabc" ] && cabc="0"

    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
hbm=$hbm
cabc=$cabc
EOF
    echo "saved"
}

apply() {
    hbm="$1"
    cabc="$2"
    [ -z "$hbm" ] && hbm="0"
    [ -z "$cabc" ] && cabc="0"

    if [ -f "$NODE_HBM" ]; then
        echo "$hbm" > "$NODE_HBM" 2>/dev/null
    fi
    if [ -f "$NODE_CABC" ]; then
        echo "$cabc" > "$NODE_CABC" 2>/dev/null
    fi
    echo "applied"
}

apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    hbm=$(grep '^hbm=' "$CONFIG_FILE" | cut -d= -f2)
    cabc=$(grep '^cabc=' "$CONFIG_FILE" | cut -d= -f2)

    if [ -f "$NODE_HBM" ] && [ -n "$hbm" ]; then
        echo "$hbm" > "$NODE_HBM" 2>/dev/null
    fi
    if [ -f "$NODE_CABC" ] && [ -n "$cabc" ]; then
        echo "$cabc" > "$NODE_CABC" 2>/dev/null
    fi
    echo "applied_saved"
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
