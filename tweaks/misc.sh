#!/system/bin/sh
# Misc Floppy1280 Tweaks Backend Script
# Handles: Block ED3, GPU Clock Lock, GPU Overclock

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/misc.conf"

# Sysfs nodes
BLOCK_ED3_NODE="/sys/devices/virtual/sec/tsp/block_ed3"
GPU_CLKLCK_NODE="/sys/kernel/gpu/gpu_clklck"
GPU_UNLOCK_NODE="/sys/kernel/gpu/gpu_unlock"

# Check if misc tweaks are available
is_available() {
    # Available if at least one node exists
    if [ -f "$BLOCK_ED3_NODE" ] || [ -f "$GPU_CLKLCK_NODE" ] || [ -f "$GPU_UNLOCK_NODE" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

# Get current state from kernel
get_current() {
    local block_ed3=""
    local gpu_clklck=""
    local gpu_unlock=""
    
    if [ -f "$BLOCK_ED3_NODE" ]; then
        block_ed3=$(cat "$BLOCK_ED3_NODE" 2>/dev/null || echo "")
    fi
    
    if [ -f "$GPU_CLKLCK_NODE" ]; then
        gpu_clklck=$(cat "$GPU_CLKLCK_NODE" 2>/dev/null || echo "")
    fi
    
    if [ -f "$GPU_UNLOCK_NODE" ]; then
        gpu_unlock=$(cat "$GPU_UNLOCK_NODE" 2>/dev/null || echo "")
    fi
    
    echo "block_ed3=$block_ed3"
    echo "gpu_clklck=$gpu_clklck"
    echo "gpu_unlock=$gpu_unlock"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "block_ed3="
        echo "gpu_clklck="
        echo "gpu_unlock="
    fi
}

# Save config (does not apply)
save() {
    local key="$1"
    local value="$2"
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    # Create or update config file
    if [ ! -f "$CONFIG_FILE" ]; then
        touch "$CONFIG_FILE"
    fi
    
    # Update or add the key
    if grep -q "^${key}=" "$CONFIG_FILE" 2>/dev/null; then
        sed -i "s/^${key}=.*/${key}=${value}/" "$CONFIG_FILE"
    else
        echo "${key}=${value}" >> "$CONFIG_FILE"
    fi
    
    echo "saved"
}

# Apply a single setting immediately
apply() {
    local key="$1"
    local value="$2"
    
    case "$key" in
        block_ed3)
            if [ -f "$BLOCK_ED3_NODE" ]; then
                echo "$value" > "$BLOCK_ED3_NODE" 2>/dev/null
                echo "applied"
            else
                echo "error: Node not available"
            fi
            ;;
        gpu_clklck)
            if [ -f "$GPU_CLKLCK_NODE" ]; then
                echo "$value" > "$GPU_CLKLCK_NODE" 2>/dev/null
                echo "applied"
            else
                echo "error: Node not available"
            fi
            ;;
        gpu_unlock)
            if [ -f "$GPU_UNLOCK_NODE" ]; then
                echo "$value" > "$GPU_UNLOCK_NODE" 2>/dev/null
                # Re-read to check if it stuck
                local actual=$(cat "$GPU_UNLOCK_NODE" 2>/dev/null)
                echo "applied=$actual"
            else
                echo "error: Node not available"
            fi
            ;;
        *)
            echo "error: Unknown key $key"
            ;;
    esac
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    local block_ed3=$(grep '^block_ed3=' "$CONFIG_FILE" | cut -d= -f2)
    local gpu_clklck=$(grep '^gpu_clklck=' "$CONFIG_FILE" | cut -d= -f2)
    local gpu_unlock=$(grep '^gpu_unlock=' "$CONFIG_FILE" | cut -d= -f2)
    
    if [ -n "$block_ed3" ] && [ -f "$BLOCK_ED3_NODE" ]; then
        echo "$block_ed3" > "$BLOCK_ED3_NODE" 2>/dev/null
    fi
    
    if [ -n "$gpu_clklck" ] && [ -f "$GPU_CLKLCK_NODE" ]; then
        echo "$gpu_clklck" > "$GPU_CLKLCK_NODE" 2>/dev/null
    fi
    
    if [ -n "$gpu_unlock" ] && [ -f "$GPU_UNLOCK_NODE" ]; then
        echo "$gpu_unlock" > "$GPU_UNLOCK_NODE" 2>/dev/null
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
