# Detect and load the best matching installer/manager translation.
load_translations() {
    local translations_dir="${MODPATH:-${MODDIR:-}}/translations"
    local raw_lang cfg l r
    lang=""

    resolve_locale() {
        local candidate="$1"
        local clean_locale short_lang
        [ -n "$candidate" ] || return 1

        clean_locale=$(echo "$candidate" | tr '_' '-')
        if [ -d "$translations_dir/$clean_locale" ]; then
            lang="$clean_locale"
            return 0
        elif [ "$clean_locale" = "zh-CN" ] || [ "$clean_locale" = "zh-Hans-CN" ] || [ "$clean_locale" = "zh-Hans" ]; then
            lang="zh-rCN"
            return 0
        elif [ "$clean_locale" = "zh-TW" ] || [ "$clean_locale" = "zh-Hant-TW" ] || [ "$clean_locale" = "zh-Hant" ]; then
            lang="zh-rTW"
            return 0
        else
            short_lang=$(echo "$clean_locale" | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')
            if [ -d "$translations_dir/$short_lang" ]; then
                lang="$short_lang"
                return 0
            fi
        fi
        return 1
    }

    raw_lang=$(settings get system system_locales 2>/dev/null | cut -d',' -f1)
    resolve_locale "$raw_lang" || :

    if [ -z "$lang" ]; then
        resolve_locale "$(getprop persist.sys.locale 2>/dev/null)" || :
    fi

    if [ -z "$lang" ]; then
        resolve_locale "$(getprop ro.product.locale 2>/dev/null)" || :
    fi

    if [ -z "$lang" ]; then
        cfg=$(cmd activity get-config 2>/dev/null | grep -m1 '^config:' | sed 's/^config:[[:space:]]*//' | cut -d',' -f1)
        l=$(echo "$cfg" | tr '-' '\n' | grep -m1 -E '^[a-z]{2,3}$' || :)
        r=$(echo "$cfg" | tr '-' '\n' | grep -m1 -E '^r[A-Z]{2}$' | cut -c2- || :)
        resolve_locale "${l:+$l${r:+-$r}}" || :
    fi

    lang=${lang:-en}
    if [ -f "$translations_dir/$lang/strings.sh" ]; then
        . "$translations_dir/$lang/strings.sh"
    elif [ -f "$translations_dir/strings.sh" ]; then
        . "$translations_dir/strings.sh"
    else
        return 1
    fi
}
