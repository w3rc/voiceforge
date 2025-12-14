#!/bin/bash

# Configuration
APP_NAME="VoiceForge"
APP_FILENAME="VoiceForge-1.0.0.AppImage"
SOURCE_DIR="$(pwd)/dist-electron"
INSTALL_DIR="$HOME/Applications"
ICON_SOURCE="$(pwd)/assets/icon.png"
ICON_DEST="$HOME/.local/share/icons/hicolor/512x512/apps"
DESKTOP_FILE="$HOME/.local/share/applications/voiceforge.desktop"

# Ensure directories exist
mkdir -p "$INSTALL_DIR"
mkdir -p "$ICON_DEST"

# 1. Install AppImage
echo "Installing AppImage to $INSTALL_DIR..."
cp "$SOURCE_DIR/$APP_FILENAME" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/$APP_FILENAME"

# 2. Install Icon
echo "Installing icon..."
cp "$ICON_SOURCE" "$ICON_DEST/voiceforge.png"

# 3. Create .desktop file
echo "Creating desktop entry..."
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=$APP_NAME
Exec=$INSTALL_DIR/$APP_FILENAME
Icon=voiceforge
Type=Application
Categories=AudioVideo;Audio;
Comment=Transform your voice into text with professional accuracy
Terminal=false
StartupWMClass=voiceforge
EOF

# 4. Update desktop database
echo "Updating desktop database..."
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Installation complete! VoiceForge should now appear in your applications list."
