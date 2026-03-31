#!/system/bin/sh
# Adreno Tweak Backend Script (FloppyTrinketMi only)

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/adreno.conf"
NODE_ADRENOBOOST="/sys/devices/platform/soc/5900000.qcom,kgsl-3d0/devfreq/5900000.qcom,kgsl-3d0/adrenoboost"
NODE_IDLER_ACTIVE="/sys/module/adreno_idler/parameters/adreno_idler_active"
NODE_IDLER_DOWNDIFF="/sys/module/adreno_idler/parameters/adreno_idler_downdifferential"
NODE_IDLER_IDLEWAIT="/sys/module/adreno_idler/parameters/adreno_idler_idlewait"
NODE_IDLER_IDLEWORKLOAD="/sys/module/adreno_idler/parameters/adreno_idler_idleworkload"

# Check availability
is_available() {
    if [ -f "$NODE_ADRENOBOOST" ] || [ -f "$NODE_IDLER_ACTIVE" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current state
get_current() {
    adrenoboost=""
    idler_active=""
    idler_downdifferential=""
    idler_idlewait=""
    idler_idleworkload=""
    
    if [ -f "$NODE_ADRENOBOOST" ]; then
        adrenoboost=$(cat "$NODE_ADRENOBOOST" 2>/dev/null | tr -d '\n\r' || echo "0")
    fi
    if [ -f "$NODE_IDLER_ACTIVE" ]; then
        idler_active=$(cat "$NODE_IDLER_ACTIVE" 2>/dev/null | tr -d '\n\r' || echo "N")
    fi
    if [ -f "$NODE_IDLER_DOWNDIFF" ]; then
        idler_downdifferential=$(cat "$NODE_IDLER_DOWNDIFF" 2>/dev/null | tr -d '\n\r' || echo "20")
    fi
    if [ -f "$NODE_IDLER_IDLEWAIT" ]; then
        idler_idlewait=$(cat "$NODE_IDLER_IDLEWAIT" 2>/dev/null | tr -d '\n\r' || echo "15")
    fi
    if [ -f "$NODE_IDLER_IDLEWORKLOAD" ]; then
        idler_idleworkload=$(cat "$NODE_IDLER_IDLEWORKLOAD" 2>/dev/null | tr -d '\n\r' || echo "5000")
    fi
    
    echo "adrenoboost=$adrenoboost"
    echo "idler_active=$idler_active"
    echo "idler_downdifferential=$idler_downdifferential"
    echo "idler_idlewait=$idler_idlewait"
    echo "idler_idleworkload=$idler_idleworkload"
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

    adrenoboost="$1"
    idler_active="$2"
    idler_downdifferential="$3"
    idler_idlewait="$4"
    idler_idleworkload="$5"
    
    [ -z "$adrenoboost" ] && adrenoboost="0"
    [ -z "$idler_active" ] && idler_active="N"
    [ -z "$idler_downdifferential" ] && idler_downdifferential="20"
    [ -z "$idler_idlewait" ] && idler_idlewait="15"
    [ -z "$idler_idleworkload" ] && idler_idleworkload="5000"

    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
adrenoboost=$adrenoboost
idler_active=$idler_active
idler_downdifferential=$idler_downdifferential
idler_idlewait=$idler_idlewait
idler_idleworkload=$idler_idleworkload
EOF
    echo "saved"
}

# Apply setting
apply() {
    adrenoboost="$1"
    idler_active="$2"
    idler_downdifferential="$3"
    idler_idlewait="$4"
    idler_idleworkload="$5"
    
    [ -z "$adrenoboost" ] && adrenoboost="0"
    [ -z "$idler_active" ] && idler_active="N"
    [ -z "$idler_downdifferential" ] && idler_downdifferential="20"
    [ -z "$idler_idlewait" ] && idler_idlewait="15"
    [ -z "$idler_idleworkload" ] && idler_idleworkload="5000"

    if [ -f "$NODE_ADRENOBOOST" ]; then
        echo "$adrenoboost" > "$NODE_ADRENOBOOST" 2>/dev/null
    fi
    if [ -f "$NODE_IDLER_ACTIVE" ]; then
        echo "$idler_active" > "$NODE_IDLER_ACTIVE" 2>/dev/null
    fi
    if [ -f "$NODE_IDLER_DOWNDIFF" ]; then
        echo "$idler_downdifferential" > "$NODE_IDLER_DOWNDIFF" 2>/dev/null
    fi
    if [ -f "$NODE_IDLER_IDLEWAIT" ]; then
        echo "$idler_idlewait" > "$NODE_IDLER_IDLEWAIT" 2>/dev/null
    fi
    if [ -f "$NODE_IDLER_IDLEWORKLOAD" ]; then
        echo "$idler_idleworkload" > "$NODE_IDLER_IDLEWORKLOAD" 2>/dev/null
    fi
    echo "applied"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi

    adrenoboost=$(grep '^adrenoboost=' "$CONFIG_FILE" | cut -d= -f2)
    idler_active=$(grep '^idler_active=' "$CONFIG_FILE" | cut -d= -f2)
    idler_downdifferential=$(grep '^idler_downdifferential=' "$CONFIG_FILE" | cut -d= -f2)
    idler_idlewait=$(grep '^idler_idlewait=' "$CONFIG_FILE" | cut -d= -f2)
    idler_idleworkload=$(grep '^idler_idleworkload=' "$CONFIG_FILE" | cut -d= -f2)

    if [ -n "$adrenoboost" ] && [ -f "$NODE_ADRENOBOOST" ]; then
        echo "$adrenoboost" > "$NODE_ADRENOBOOST" 2>/dev/null
    fi
    if [ -n "$idler_active" ] && [ -f "$NODE_IDLER_ACTIVE" ]; then
        echo "$idler_active" > "$NODE_IDLER_ACTIVE" 2>/dev/null
    fi
    if [ -n "$idler_downdifferential" ] && [ -f "$NODE_IDLER_DOWNDIFF" ]; then
        echo "$idler_downdifferential" > "$NODE_IDLER_DOWNDIFF" 2>/dev/null
    fi
    if [ -n "$idler_idlewait" ] && [ -f "$NODE_IDLER_IDLEWAIT" ]; then
        echo "$idler_idlewait" > "$NODE_IDLER_IDLEWAIT" 2>/dev/null
    fi
    if [ -n "$idler_idleworkload" ] && [ -f "$NODE_IDLER_IDLEWORKLOAD" ]; then
        echo "$idler_idleworkload" > "$NODE_IDLER_IDLEWORKLOAD" 2>/dev/null
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
        shift
        save "$@"
        ;;
    apply)
        apply "$2" "$3" "$4" "$5" "$6"
        ;;
    apply_saved)
        apply_saved
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_saved|save|apply|apply_saved}"
        exit 1
        ;;
esac
