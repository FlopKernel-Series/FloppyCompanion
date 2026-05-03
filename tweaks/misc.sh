#!/system/bin/sh
# Misc Exynos Tweaks Backend Script
# Handles: Block ED3, ESG Bursty Mode, GPU Clock Lock, GPU Overclock, Throttling Protection, High Touch Polling Rate

DATA_DIR="/data/adb/floppy_companion"
CONFIG_FILE="$DATA_DIR/config/misc.conf"
HTPR_STATE_FILE="$DATA_DIR/state/htpr"

# Sysfs nodes
BLOCK_ED3_NODE="/sys/devices/virtual/sec/tsp/block_ed3"
GPU_CLKLCK_NODE="/sys/kernel/gpu/gpu_clklck"
GPU_UNLOCK_NODE="/sys/kernel/gpu/gpu_unlock"
THROTTLERS_PROTECTION_NODE="/sys/kernel/throttlers_protection"
ESG_SHORT_BURST_NODE="/sys/kernel/ems/energy_step/short_burst"
TSP_CMD_NODE="/sys/class/sec/tsp/cmd"

# Check if misc tweaks are available
is_available() {
    # Available if at least one node exists
    if [ -f "$BLOCK_ED3_NODE" ] || [ -f "$TSP_CMD_NODE" ] || [ -f "$ESG_SHORT_BURST_NODE" ] || [ -f "$GPU_CLKLCK_NODE" ] || [ -f "$GPU_UNLOCK_NODE" ] || [ -f "$THROTTLERS_PROTECTION_NODE" ]; then
        echo "available=1"
    else
        echo "available=0"
    fi
}

get_capabilities() {
    [ -f "$BLOCK_ED3_NODE" ] && echo "block_ed3=1" || echo "block_ed3=0"
    [ -f "$TSP_CMD_NODE" ] && echo "htpr=1" || echo "htpr=0"
    [ -f "$ESG_SHORT_BURST_NODE" ] && echo "esg_short_burst=1" || echo "esg_short_burst=0"
    [ -f "$GPU_CLKLCK_NODE" ] && echo "gpu_clklck=1" || echo "gpu_clklck=0"
    [ -f "$GPU_UNLOCK_NODE" ] && echo "gpu_unlock=1" || echo "gpu_unlock=0"
    [ -f "$THROTTLERS_PROTECTION_NODE" ] && echo "throttlers_protection=1" || echo "throttlers_protection=0"
}

# Get current state from kernel
get_current() {
    local block_ed3=""
    local htpr=""
    local esg_short_burst=""
    local gpu_clklck=""
    local gpu_unlock=""
    local throttlers_protection=""
    
    if [ -f "$BLOCK_ED3_NODE" ]; then
        block_ed3=$(cat "$BLOCK_ED3_NODE" 2>/dev/null || echo "")
    fi

    if [ -f "$TSP_CMD_NODE" ]; then
        if [ -f "$HTPR_STATE_FILE" ]; then
            htpr=$(cat "$HTPR_STATE_FILE" 2>/dev/null || echo "0")
        else
            htpr="0"
        fi
    fi

    if [ -f "$ESG_SHORT_BURST_NODE" ]; then
        esg_short_burst=$(cat "$ESG_SHORT_BURST_NODE" 2>/dev/null || echo "")
    fi
    
    if [ -f "$GPU_CLKLCK_NODE" ]; then
        gpu_clklck=$(cat "$GPU_CLKLCK_NODE" 2>/dev/null || echo "")
    fi
    
    if [ -f "$GPU_UNLOCK_NODE" ]; then
        gpu_unlock=$(cat "$GPU_UNLOCK_NODE" 2>/dev/null || echo "")
    fi

    if [ -f "$THROTTLERS_PROTECTION_NODE" ]; then
        throttlers_protection=$(cat "$THROTTLERS_PROTECTION_NODE" 2>/dev/null || echo "")
    fi
    
    echo "block_ed3=$block_ed3"
    echo "htpr=$htpr"
    echo "esg_short_burst=$esg_short_burst"
    echo "gpu_clklck=$gpu_clklck"
    echo "gpu_unlock=$gpu_unlock"
    echo "throttlers_protection=$throttlers_protection"
}

# Get saved config
get_saved() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    else
        echo "block_ed3="
        echo "htpr="
        echo "esg_short_burst="
        echo "gpu_clklck="
        echo "gpu_unlock="
        echo "throttlers_protection="
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
        htpr)
            if [ -f "$TSP_CMD_NODE" ]; then
                if [ "$value" = "1" ]; then
                    echo "set_game_mode,1" >> "$TSP_CMD_NODE" 2>/dev/null
                else
                    echo "set_game_mode,0" >> "$TSP_CMD_NODE" 2>/dev/null
                fi
                mkdir -p "$(dirname "$HTPR_STATE_FILE")"
                echo "$value" > "$HTPR_STATE_FILE"
                echo "applied"
            else
                echo "error: Node not available"
            fi
            ;;
        esg_short_burst)
            if [ -f "$ESG_SHORT_BURST_NODE" ]; then
                echo "$value" > "$ESG_SHORT_BURST_NODE" 2>/dev/null
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
        throttlers_protection)
            if [ -f "$THROTTLERS_PROTECTION_NODE" ]; then
                echo "$value" > "$THROTTLERS_PROTECTION_NODE" 2>/dev/null
                echo "applied"
            else
                echo "error: Node not available"
            fi
            ;;
        *)
            echo "error: Unknown key $key"
            ;;
    esac
}

# Clear a single saved key (so kernel default applies)
clear_saved_key() {
    local key="$1"
    if [ -f "$CONFIG_FILE" ]; then
        sed -i "/^${key}=/d" "$CONFIG_FILE"
    fi
    echo "cleared"
}

# Apply saved config (called at boot)
apply_saved() {
    if [ ! -f "$CONFIG_FILE" ]; then
        return 0
    fi
    
    local block_ed3=$(grep '^block_ed3=' "$CONFIG_FILE" | cut -d= -f2)
    local htpr=$(grep '^htpr=' "$CONFIG_FILE" | cut -d= -f2)
    local esg_short_burst=$(grep '^esg_short_burst=' "$CONFIG_FILE" | cut -d= -f2)
    local gpu_clklck=$(grep '^gpu_clklck=' "$CONFIG_FILE" | cut -d= -f2)
    local gpu_unlock=$(grep '^gpu_unlock=' "$CONFIG_FILE" | cut -d= -f2)
    local throttlers_protection=$(grep '^throttlers_protection=' "$CONFIG_FILE" | cut -d= -f2)
    
    if [ -n "$block_ed3" ] && [ -f "$BLOCK_ED3_NODE" ]; then
        echo "$block_ed3" > "$BLOCK_ED3_NODE" 2>/dev/null
    fi

    if [ -n "$htpr" ] && [ -f "$TSP_CMD_NODE" ]; then
        if [ "$htpr" = "1" ]; then
            echo "set_game_mode,1" >> "$TSP_CMD_NODE" 2>/dev/null
        else
            echo "set_game_mode,0" >> "$TSP_CMD_NODE" 2>/dev/null
        fi
        mkdir -p "$(dirname "$HTPR_STATE_FILE")"
        echo "$htpr" > "$HTPR_STATE_FILE"
    fi

    if [ -n "$esg_short_burst" ] && [ -f "$ESG_SHORT_BURST_NODE" ]; then
        echo "$esg_short_burst" > "$ESG_SHORT_BURST_NODE" 2>/dev/null
    fi
    
    if [ -n "$gpu_clklck" ] && [ -f "$GPU_CLKLCK_NODE" ]; then
        echo "$gpu_clklck" > "$GPU_CLKLCK_NODE" 2>/dev/null
    fi
    
    if [ -n "$gpu_unlock" ] && [ -f "$GPU_UNLOCK_NODE" ]; then
        echo "$gpu_unlock" > "$GPU_UNLOCK_NODE" 2>/dev/null
    fi

    if [ -n "$throttlers_protection" ] && [ -f "$THROTTLERS_PROTECTION_NODE" ]; then
        echo "$throttlers_protection" > "$THROTTLERS_PROTECTION_NODE" 2>/dev/null
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
    get_capabilities)
        get_capabilities
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
    clear_saved_key)
        clear_saved_key "$2"
        ;;
    *)
        echo "usage: $0 {is_available|get_current|get_capabilities|get_saved|save|apply|apply_saved|clear_saved_key}"
        exit 1
        ;;
esac
