#!/bin/bash
# Copyright (c) 2026 Flopster101
# SPDX-License-Identifier: GPL-3.0
set -euo pipefail

# Configuration
MODULE_DIR="$(dirname "$(readlink -f "$0")")"
OUTPUT_DIR="$MODULE_DIR/out"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M)

# Get Git Hash
HASH=""
if git -C "$MODULE_DIR" rev-parse --git-dir > /dev/null 2>&1; then
    if git -C "$MODULE_DIR" rev-parse HEAD > /dev/null 2>&1; then
        HASH=$(git -C "$MODULE_DIR" rev-parse --short HEAD)
    fi
fi

if [ -z "$HASH" ]; then
    HASH="nohash"
fi

# Get Version from module.prop
VERSION=$(grep "^version=" "$MODULE_DIR/module.prop" | cut -d= -f2)

# Construct Filename
ZIP_NAME="FloppyCompanion-$VERSION-$HASH-$TIMESTAMP.zip"
ZIP_PATH="$OUTPUT_DIR/$ZIP_NAME"

# --- Magiskboot Handling ---
echo "Resolving latest Magisk version..."
LATEST_URL=$(curl -sI https://github.com/topjohnwu/Magisk/releases/latest | grep -i "location:" | awk '{print $2}' | tr -d '\r')
TAG=${LATEST_URL##*/}
echo "Latest tag: $TAG"

MAGISK_APK="Magisk-$TAG.apk"
MAGISK_URL="https://github.com/topjohnwu/Magisk/releases/download/$TAG/$MAGISK_APK"
TOOLS_DIR="$MODULE_DIR/tools"
FKFEAT_DIR="$TOOLS_DIR/fkfeat"

prune_beercss_vendor() {
    local webroot_dir="$1"
    local beercss_dir="$webroot_dir/vendor/beercss"
    local beercss_cdn_dir="$beercss_dir/dist/cdn"

    if [ -d "$beercss_dir" ]; then
        return 0
    fi

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

    if [ -d "$webroot_dir" ]; then
        return 0
    fi

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
if [[ -f "$TOOLS_DIR/magiskboot" ]]; then
    rm -f "$TOOLS_DIR/magiskboot"
fi
unzip -p "../$MAGISK_APK" "lib/arm64-v8a/libmagiskboot.so" > "$TOOLS_DIR/magiskboot"
chmod +x "$TOOLS_DIR/magiskboot"

# Build Zip
echo "Packaging $ZIP_NAME..."

# Temporarily update module.prop version to include git hash
ORIGINAL_VERSION="$VERSION"
NEW_VERSION="$VERSION-$HASH"
sed -i "s/^version=.*/version=$NEW_VERSION/" "$MODULE_DIR/module.prop"

# Create temporary directory for module files
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Copy module files
for i in "LICENSE" "customize.sh" "features_backend.sh" \
    "module.prop" "persistence.sh" "service.sh" "tweaks" \
    "uninstall.sh" "webroot"; do
   cp -rfa "$MODULE_DIR/$i" "$TEMP_DIR"
done

prune_beercss_vendor "$TEMP_DIR/webroot"
prune_simulator_assets "$TEMP_DIR/webroot"

if [[ ! -d "$TEMP_DIR/tools" ]]; then
    mkdir -p "$TEMP_DIR/tools"
fi

if [[ ! -f "$TEMP_DIR/tools/magiskboot" ]]; then
    cp -a "$TOOLS_DIR/magiskboot" "$TEMP_DIR/tools/magiskboot"  
fi

if [ ! -x "$FKFEAT_DIR/fkfeatctl" ]; then
    echo "Built fkfeat binary missing at $FKFEAT_DIR/fkfeatctl" >&2
    exit 1
fi

if [[ ! -d "$TEMP_DIR/tools/fkfeat" ]]; then
    mkdir -p "$TEMP_DIR/tools/fkfeat"
fi

if [[ ! -f "$TEMP_DIR/tools/fkfeat/fkfeatctl" ]]; then
    cp -a "$FKFEAT_DIR/fkfeatctl" "$TEMP_DIR/tools/fkfeat/fkfeatctl"
fi

chmod 755 "$TEMP_DIR/tools/magiskboot" "$TEMP_DIR/tools/fkfeat/fkfeatctl"

# Create zip from temporary directory
(
cd "$TEMP_DIR" || exit 1
zip -r "$ZIP_PATH" . > /dev/null
) || exit 1

# Restore original module.prop version
sed -i "s/^version=.*/version=$ORIGINAL_VERSION/" "$MODULE_DIR/module.prop"

# Cleanup tools binary
rm -f "$TOOLS_DIR/magiskboot"
if [ -z "$(ls -A "$TOOLS_DIR" 2>/dev/null)" ]; then
    rmdir "$TOOLS_DIR" 2>/dev/null || true
fi

echo "Done! Output: $ZIP_PATH"
