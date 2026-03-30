#!/bin/bash
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
VERSION_CODE=$(grep "^versionCode=" "$MODULE_DIR/module.prop" | cut -d= -f2)

# Construct Filename
ZIP_NAME="FloppyCompanion-${VERSION}-${HASH}-${TIMESTAMP}.zip"
ZIP_PATH="$OUTPUT_DIR/$ZIP_NAME"

# --- Magiskboot Handling ---
echo "Resolving latest Magisk version..."
LATEST_URL=$(curl -sI https://github.com/topjohnwu/Magisk/releases/latest | grep -i "location:" | awk '{print $2}' | tr -d '\r')
TAG=${LATEST_URL##*/}
echo "Latest tag: $TAG"

MAGISK_APK="Magisk-${TAG}.apk"
MAGISK_URL="https://github.com/topjohnwu/Magisk/releases/download/${TAG}/${MAGISK_APK}"
TOOLS_DIR="$MODULE_DIR/tools"
FKFEAT_DIR="$TOOLS_DIR/fkfeat"

# Prepare tools directory
mkdir -p "$TOOLS_DIR"

if [ ! -d "$FKFEAT_DIR" ]; then
    echo "Missing fkfeat sources at $FKFEAT_DIR" >&2
    exit 1
fi

echo "Building fkfeat..."
make -C "$FKFEAT_DIR" clean
make -C "$FKFEAT_DIR" CC=aarch64-linux-gnu-gcc

if [ -f "../$MAGISK_APK" ]; then
    rm "../$MAGISK_APK"
fi

echo "Downloading $MAGISK_APK..."
curl -L -o "../$MAGISK_APK" "$MAGISK_URL"

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

echo "Done! Output: $ZIP_PATH"
