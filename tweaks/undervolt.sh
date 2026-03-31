#!/system/bin/sh
# Shared Exynos undervolt backend

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/undervolt.conf"

NODE_LITTLE="/sys/kernel/exynos_uv/cpucl0_uv_percent"
NODE_BIG="/sys/kernel/exynos_uv/cpucl1_uv_percent"
NODE_PRIME="/sys/kernel/exynos_uv/cpucl2_uv_percent"
NODE_GPU="/sys/kernel/exynos_uv/gpu_uv_percent"
NODE_G3D="/sys/kernel/exynos_uv/g3d_uv_percent"

resolve_gpu_node() {
    if [ -f "$NODE_G3D" ]; then
        echo "$NODE_G3D"
    else
        echo "$NODE_GPU"
    fi
}

has_any_uv_node() {
    local gpu_node
    gpu_node=$(resolve_gpu_node)
    [ -f "$NODE_LITTLE" ] || [ -f "$NODE_BIG" ] || [ -f "$NODE_PRIME" ] || [ -f "$gpu_node" ]
}

read_node_or_zero() {
    local node="$1"
    if [ -e "$node" ]; then
        cat "$node" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Check if undervolt control is available
is_available() {
    if has_any_uv_node; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_capabilities() {
    local gpu_node
    gpu_node=$(resolve_gpu_node)
    echo "little=$([ -f "$NODE_LITTLE" ] && echo 1 || echo 0)"
    echo "big=$([ -f "$NODE_BIG" ] && echo 1 || echo 0)"
    echo "prime=$([ -f "$NODE_PRIME" ] && echo 1 || echo 0)"
    echo "gpu=$([ -f "$gpu_node" ] && echo 1 || echo 0)"
}

# Get current values
get_current() {
    local gpu_node
    gpu_node=$(resolve_gpu_node)

    if ! has_any_uv_node; then
        echo "little=0"
        echo "big=0"
        echo "prime=0"
        echo "gpu=0"
        return
    fi

    local little
    little=$(read_node_or_zero "$NODE_LITTLE")
    local big
    big=$(read_node_or_zero "$NODE_BIG")
    local prime
    prime=$(read_node_or_zero "$NODE_PRIME")
    local gpu
    gpu=$(read_node_or_zero "$gpu_node")

    echo "little=$little"
    echo "big=$big"
    echo "prime=$prime"
    echo "gpu=$gpu"
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

    local little="$1"
    local big="$2"
    local prime="$3"
    local gpu="$4"
    
    # Sanitize inputs (ensure they are numbers)
    [ -z "$little" ] && little="0"
    [ -z "$big" ] && big="0"
    [ -z "$prime" ] && prime="0"
    [ -z "$gpu" ] && gpu="0"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" << EOF
little=$little
big=$big
prime=$prime
gpu=$gpu
EOF
    echo "saved"
}

# Apply settings
apply() {
    local little="$1"
    local big="$2"
    local prime="$3"
    local gpu="$4"
    local gpu_node
    gpu_node=$(resolve_gpu_node)

    if ! has_any_uv_node; then
        echo "error: undervolt nodes not found"
        return 1
    fi
    
    # Apply Little
    if [ -n "$little" ] && [ -e "$NODE_LITTLE" ]; then
        echo "$little" > "$NODE_LITTLE" 2>/dev/null
    fi
    
    # Apply Big
    if [ -n "$big" ] && [ -e "$NODE_BIG" ]; then
        echo "$big" > "$NODE_BIG" 2>/dev/null
    fi

    # Apply Prime
    if [ -n "$prime" ] && [ -e "$NODE_PRIME" ]; then
        echo "$prime" > "$NODE_PRIME" 2>/dev/null
    fi
    
    # Apply GPU
    if [ -n "$gpu" ] && [ -e "$gpu_node" ]; then
        echo "$gpu" > "$gpu_node" 2>/dev/null
    fi
    
    echo "applied"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    local little=$(grep '^little=' "$CONFIG_FILE" | cut -d= -f2)
    local big=$(grep '^big=' "$CONFIG_FILE" | cut -d= -f2)
    local prime=$(grep '^prime=' "$CONFIG_FILE" | cut -d= -f2)
    local gpu=$(grep '^gpu=' "$CONFIG_FILE" | cut -d= -f2)
    
    apply "$little" "$big" "$prime" "$gpu"
}

# Clear saved config (for when Overclock is enabled)
clear_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        rm "$CONFIG_FILE"
    fi
    echo "cleared"
}

# Main action handler
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
        save "$2" "$3" "$4" "$5"
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
    *)
        echo "usage: $0 {is_available|get_capabilities|get_current|get_saved|save|apply|apply_saved|clear_saved}"
        exit 1
        ;;
esac
