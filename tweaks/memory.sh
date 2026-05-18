#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Memory Tweaks Backend

DATA_DIR="/data/adb/floppy_companion"
CONF_FILE="$DATA_DIR/config/memory.conf"

# Helper to read a value
read_val() {
    if [ -f "/proc/sys/vm/$1" ]; then
        cat "/proc/sys/vm/$1"
    else
        echo 0
    fi
}

# Helper to write a value
write_val() {
    if [ -f "/proc/sys/vm/$1" ]; then
        echo "$2" > "/proc/sys/vm/$1"
    fi
}

case "$1" in
    get_current)
        echo "swappiness=$(read_val swappiness)"
        echo "dirty_ratio=$(read_val dirty_ratio)"
        echo "dirty_bytes=$(read_val dirty_bytes)"
        echo "dirty_background_ratio=$(read_val dirty_background_ratio)"
        echo "dirty_background_bytes=$(read_val dirty_background_bytes)"
        echo "dirty_writeback_centisecs=$(read_val dirty_writeback_centisecs)"
        echo "dirty_expire_centisecs=$(read_val dirty_expire_centisecs)"
        echo "stat_interval=$(read_val stat_interval)"
        echo "vfs_cache_pressure=$(read_val vfs_cache_pressure)"
        echo "watermark_scale_factor=$(read_val watermark_scale_factor)"
        ;;

    get_saved)
        if [ -f "$CONF_FILE" ]; then
            cat "$CONF_FILE"
        fi
        ;;

    save)
        # Usage: save swappiness=60 dirty_ratio=20 ...
        shift
        echo "# Memory Config" > "$CONF_FILE"
        for arg in "$@"; do
            echo "$arg" >> "$CONF_FILE"
        done
        echo "Saved memory settings"
        ;;

    apply)
        # Usage: apply swappiness=60 dirty_ratio=20 ...
        shift
        for arg in "$@"; do
            key=$(echo "$arg" | cut -d= -f1)
            val=$(echo "$arg" | cut -d= -f2)

            # Handle mutually exclusive logic
            if [ "$key" = "dirty_bytes" ] && [ "$val" != 0 ]; then
                write_val dirty_ratio 0
                write_val dirty_bytes "$val"
            elif [ "$key" = "dirty_ratio" ] && [ "$val" != 0 ]; then
                write_val dirty_bytes 0
                write_val dirty_ratio "$val"
            elif [ "$key" = "dirty_background_bytes" ] && [ "$val" != 0 ]; then
                write_val dirty_background_ratio 0
                write_val dirty_background_bytes "$val"
            elif [ "$key" = "dirty_background_ratio" ] && [ "$val" != 0 ]; then
                write_val dirty_background_bytes 0
                write_val dirty_background_ratio "$val"
            else
                # direct mapping for others
                write_val "$key" "$val"
            fi
        done
        echo "Applied memory settings"
        ;;

    apply_saved)
        if [ -f "$CONF_FILE" ]; then
            while IFS= read -r line; do
                # skip comments and empty lines
                case "$line" in \#*|"") continue ;; esac
                
                key=$(echo "$line" | cut -d= -f1)
                val=$(echo "$line" | cut -d= -f2)
                
                # reusing logic via self-call or duplicate? 
                # duplicate for simplicity inside loop
                 if [ "$key" = "dirty_bytes" ] && [ "$val" != 0 ]; then
                    write_val dirty_ratio 0
                    write_val dirty_bytes "$val"
                elif [ "$key" = "dirty_ratio" ] && [ "$val" != 0 ]; then
                    write_val dirty_bytes 0
                    write_val dirty_ratio "$val"
                elif [ "$key" = "dirty_background_bytes" ] && [ "$val" != 0 ]; then
                    write_val dirty_background_ratio 0
                    write_val dirty_background_bytes "$val"
                elif [ "$key" = "dirty_background_ratio" ] && [ "$val" != 0 ]; then
                    write_val dirty_background_bytes 0
                    write_val dirty_background_ratio "$val"
                else
                    write_val "$key" "$val"
                fi
            done < "$CONF_FILE"
            echo "Applied saved memory settings"
        fi
        ;;
esac
