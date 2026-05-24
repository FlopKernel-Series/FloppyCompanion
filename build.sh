#!/bin/bash
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
set -euo pipefail

# Configuration
MODULE_DIR="$(dirname "$(readlink -f "$0")")"
OUTPUT_DIR="$MODULE_DIR/out"

# Parse arguments
UPLOAD_TG=false
while getopts "t" opt; do
    case $opt in
        t) UPLOAD_TG=true ;;
        *) echo "Usage: $0 [-t]" && exit 1 ;;
    esac
done

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M)

# Get Git Hash
HASH=""
if git -C "$MODULE_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    if git -C "$MODULE_DIR" rev-parse HEAD > /dev/null 2>&1; then
        HASH=$(git -C "$MODULE_DIR" rev-parse --short HEAD | tr -d '\r\n' | xargs)
    fi
fi

if [ -z "$HASH" ]; then
    HASH="nohash"
fi

# Get Version from module.prop
VERSION=$(grep "^version=" "$MODULE_DIR/module.prop" | cut -d= -f2 | tr -d '\r\n' | xargs)
VERSION_CODE=$(grep "^versionCode=" "$MODULE_DIR/module.prop" | cut -d= -f2 | tr -d '\r\n' | xargs)

# Construct Filename
ZIP_NAME="FloppyCompanion-${VERSION}-${HASH}-${TIMESTAMP}.zip"
ZIP_PATH="$OUTPUT_DIR/$ZIP_NAME"

# --- Magiskboot Handling ---
echo "Resolving latest Magisk version..."
LATEST_URL=$(curl -sI https://github.com/topjohnwu/Magisk/releases/latest | grep -i "location:" | awk '{print $2}' | tr -d '\r\n' | xargs)
TAG=${LATEST_URL##*/}
echo "Latest tag: $TAG"

MAGISK_APK="Magisk-${TAG}.apk"
MAGISK_URL="https://github.com/topjohnwu/Magisk/releases/download/${TAG}/${MAGISK_APK}"
TOOLS_DIR="$MODULE_DIR/tools"
FKFEAT_DIR="$TOOLS_DIR/fkfeat"

prune_beercss_vendor() {
    local webroot_dir="$1"
    local beercss_dir="$webroot_dir/vendor/beercss"
    local beercss_cdn_dir="$beercss_dir/dist/cdn"

    [ -d "$beercss_dir" ] || return 0

    if [ ! -d "$beercss_cdn_dir" ]; then
        echo "BeerCSS vendor checkout found but missing dist/cdn at $beercss_cdn_dir" >&2
        exit 1
    fi

    echo "Pruning BeerCSS vendor files to runtime assets..."

    # Keep only the packaged runtime payload, not the upstream repo sources/docs.
    find "$beercss_dir" -mindepth 1 -maxdepth 1 \
        ! -name "LICENSE" \
        ! -name "dist" \
        -exec rm -rf {} +

    find "$beercss_dir/dist" -mindepth 1 -maxdepth 1 \
        ! -name "cdn" \
        -exec rm -rf {} +

    # Retain only the minified CDN assets we are likely to reference at runtime,
    # plus fonts and SVG assets required by the BeerCSS stylesheets.
    find "$beercss_cdn_dir" -mindepth 1 -maxdepth 1 \
        ! -name "beer.min.css" \
        ! -name "beer.scoped.min.css" \
        ! -name "beer.min.js" \
        ! -name "material-symbols-outlined.woff2" \
        ! -name "material-symbols-rounded.woff2" \
        ! -name "material-symbols-sharp.woff2" \
        ! -name "material-symbols-subset.woff2" \
        ! -name "*.svg" \
        -exec rm -f {} +
}

prune_simulator_assets() {
    local webroot_dir="$1"

    [ -d "$webroot_dir" ] || return 0

    echo "Removing simulator-only assets from package payload..."
    rm -f "$webroot_dir/simulator.html"
    rm -f "$webroot_dir/js/simulator_bridge.js"

    if [ -f "$webroot_dir/index.html" ]; then
        sed -i '/simulator_bridge\.js/d' "$webroot_dir/index.html"
    fi
}

# Prepare tools directory
mkdir -p "$TOOLS_DIR"

if [ ! -d "$FKFEAT_DIR" ]; then
    echo "Missing fkfeat sources at $FKFEAT_DIR" >&2
    exit 1
fi

echo "Building fkfeat..."
make -s -C "$FKFEAT_DIR" clean
make -s -C "$FKFEAT_DIR" CC=aarch64-linux-gnu-gcc

if [ -f "../$MAGISK_APK" ]; then
    rm "../$MAGISK_APK"
fi

echo "Downloading $MAGISK_APK..."
curl -L -o "../$MAGISK_APK" "$MAGISK_URL" 2>/dev/null

# Extract ARM64 magiskboot
echo "Extracting magiskboot (arm64)..."
unzip -p "../$MAGISK_APK" "lib/arm64-v8a/libmagiskboot.so" > "$TOOLS_DIR/magiskboot"
chmod +x "$TOOLS_DIR/magiskboot"

# Build Zip
echo "Packaging $ZIP_NAME..."
cd "$MODULE_DIR" || exit 1

# Temporarily update module.prop version to include git hash
ORIGINAL_VERSION="$VERSION"
NEW_VERSION="${VERSION}-${HASH}"
sed -i "s/^version=.*/version=${NEW_VERSION}/" module.prop

# Create temporary directory for module files
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy module files
cp module.prop "$TEMP_DIR/"
cp LICENSE "$TEMP_DIR/"
cp service.sh "$TEMP_DIR/"
cp uninstall.sh "$TEMP_DIR/"
cp persistence.sh "$TEMP_DIR/"
cp customize.sh "$TEMP_DIR/"
cp features_backend.sh "$TEMP_DIR/"
cp -r tweaks "$TEMP_DIR/"
cp -r webroot "$TEMP_DIR/"
prune_beercss_vendor "$TEMP_DIR/webroot"
prune_simulator_assets "$TEMP_DIR/webroot"
mkdir -p "$TEMP_DIR/tools"
cp "$TOOLS_DIR/magiskboot" "$TEMP_DIR/tools/"

if [ ! -x "$FKFEAT_DIR/fkfeatctl" ]; then
    echo "Built fkfeat binary missing at $FKFEAT_DIR/fkfeatctl" >&2
    exit 1
fi

mkdir -p "$TEMP_DIR/tools/fkfeat"
cp "$FKFEAT_DIR/fkfeatctl" "$TEMP_DIR/tools/fkfeat/"
chmod 755 "$TEMP_DIR/tools/magiskboot" "$TEMP_DIR/tools/fkfeat/fkfeatctl"

# Create zip from temporary directory
cd "$TEMP_DIR" || exit 1
zip -r "$ZIP_PATH" . > /dev/null

# Restore original module.prop version
cd "$MODULE_DIR" || exit 1
sed -i "s/^version=.*/version=${ORIGINAL_VERSION}/" module.prop

# Cleanup tools binary
rm -f "$TOOLS_DIR/magiskboot"
if [ -z "$(ls -A $TOOLS_DIR 2>/dev/null)" ]; then
    rmdir "$TOOLS_DIR" 2>/dev/null || true
fi

# Telegram Upload
if [ "$UPLOAD_TG" = true ]; then
    TG_BOT_TOKEN="${TG_BOT_TOKEN:-$(cat ../bot_token 2>/dev/null | tr -d '\r\n' | xargs || true)}"
    TG_CHAT_ID="${TG_CHAT_ID:-$(cat ../chat_id 2>/dev/null | tr -d '\r\n' | xargs || true)}"

    if [ -n "$TG_BOT_TOKEN" ] && [ -n "$TG_CHAT_ID" ]; then
        if [ ! -f "$ZIP_PATH" ]; then
            echo "Error: Zip file not found at $ZIP_PATH"
        else
            echo "Uploading to Telegram..."
            COMMIT_HASH=$(git -C "$MODULE_DIR" rev-parse HEAD | tr -d '\r\n' | xargs)
            COMMIT_URL="https://github.com/FlopKernel-Series/FloppyCompanion/commit/$COMMIT_HASH"
            BRANCH=$(git -C "$MODULE_DIR" rev-parse --abbrev-ref HEAD | tr -d '\r\n' | xargs)
            COMMIT_SUBJECT=$(git -C "$MODULE_DIR" log -1 --format=%s | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
            BUILD_HOST="$(whoami)@$(hostname)"

            CAPTION="<b>New FloppyCompanion CI Build!</b>
Branch: <code>$BRANCH</code>
Version: <code>$NEW_VERSION</code>
Build host: <code>$BUILD_HOST</code>
Commit: <code>${COMMIT_HASH:0:7}</code>

<a href=\"$COMMIT_URL\">$COMMIT_SUBJECT</a>"

            RESPONSE=$(curl -s \
                 --form-string "chat_id=$TG_CHAT_ID" \
                 -F "document=@$ZIP_PATH" \
                 --form-string "caption=$CAPTION" \
                 --form-string "parse_mode=HTML" \
                 "https://api.telegram.org/bot$TG_BOT_TOKEN/sendDocument" 2>&1 || true)

            if echo "$RESPONSE" | grep -q '"ok":true'; then
                echo "Telegram upload successful."
            else
                echo "Telegram upload failed."
                echo "$RESPONSE" | grep -v "Authorization"
            fi
        fi
    else
        echo "Telegram upload skipped: TG_BOT_TOKEN or TG_CHAT_ID is empty."
    fi
fi

echo "Done! Output: $ZIP_PATH"
