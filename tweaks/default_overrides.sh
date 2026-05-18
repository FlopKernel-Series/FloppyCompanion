#!/system/bin/sh
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
# Predefined tweak defaults that should not be captured from live runtime state.

apply_predefined_tweak_defaults() {
    tweak_id="$1"

    case "$tweak_id" in
        soundcontrol)
            $IS_TRINKET || return 1
            # shellcheck disable=SC2034
            SOUND_HP_L=0
            # shellcheck disable=SC2034
            SOUND_HP_R=0
            # shellcheck disable=SC2034
            SOUND_MIC=0
            return 0
            ;;
    esac

    return 1
}
