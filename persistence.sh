#!/system/bin/sh
# persistence.sh
# Handles reading and writing to /cache/fk_feat
# Usage: persistence.sh <action> [key] [value] [type]
# Actions: save, remove

CACHE_FILE="/cache/fk_feat"
ACTION=$1
KEY=$2
VALUE=$3
TYPE=$4 # 'toggle' or 'select'

if [ ! -f "$CACHE_FILE" ]; then
    touch "$CACHE_FILE"
fi

current_content=$(cat "$CACHE_FILE")

case "$ACTION" in
    save)
        if [ "$TYPE" = "select" ]; then
            # Integer type
            # Remove existing entry for this key
            current_content=$(echo "$current_content" | grep -v "^${KEY}=")
            
            # If value is '0' (disabled), set to -1
            if [ "$VALUE" = "0" ]; then
                newline="${KEY}=-1"
            else
                newline="${KEY}=${VALUE}"
            fi
            
            # Reconstruct file
            echo "$current_content" > "$CACHE_FILE"
            echo "$newline" >> "$CACHE_FILE"
            
        else
            # Boolean/Toggle type
            # Remove existing line if present (to avoid duplicates or ensure clean state)
            current_content=$(echo "$current_content" | grep -v "^${KEY}$")
            
            if [ "$VALUE" = "1" ]; then
                # Enable: Add key
                echo "$current_content" > "$CACHE_FILE"
                echo "$KEY" >> "$CACHE_FILE"
            else
                # Disable: Just remove (already removed above)
                echo "$current_content" > "$CACHE_FILE"
            fi
        fi
        
        # Clean up empty lines
        sed -i '/^$/d' "$CACHE_FILE"
        echo "Saved: $KEY -> $VALUE"
        ;;
        
    remove)
        # Remove any occurrence of key (standalone or key=*)
        grep -v "^${KEY}" "$CACHE_FILE" > "${CACHE_FILE}.tmp" 2>/dev/null || true
        mv "${CACHE_FILE}.tmp" "$CACHE_FILE" 2>/dev/null || true
        echo "Removed: $KEY"
        ;;
        
    *)
        echo "Usage: $0 save <key> <value> <type>"
        exit 1
        ;;
esac
