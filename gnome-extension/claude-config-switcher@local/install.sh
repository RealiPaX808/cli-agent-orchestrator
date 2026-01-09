#!/bin/bash

set -e

EXTENSION_UUID="claude-config-switcher@local"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
CLAUDE_DIR="$HOME/.claude"

echo "🚀 Installing Claude Config Switcher GNOME Extension..."
echo

# Check if GNOME Shell is installed
if ! command -v gnome-shell &> /dev/null; then
    echo "❌ GNOME Shell is not installed. This extension requires GNOME."
    exit 1
fi

# Get GNOME Shell version
GNOME_VERSION=$(gnome-shell --version | grep -oP '\d+' | head -1)
echo "✓ Detected GNOME Shell version: $GNOME_VERSION"

if [ "$GNOME_VERSION" -lt 45 ]; then
    echo "⚠️  Warning: This extension is designed for GNOME Shell 45+."
    echo "   Your version: $GNOME_VERSION. It may not work correctly."
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create extension directory
echo
echo "📁 Creating extension directory..."
mkdir -p "$EXTENSION_DIR"

# Copy extension files
echo "📋 Copying extension files..."
cp -r ./* "$EXTENSION_DIR/"

# Compile GSettings schema
echo "⚙️  Compiling GSettings schema..."
cd "$EXTENSION_DIR"
glib-compile-schemas schemas/

echo
echo "✅ Extension installed successfully!"
echo

# Check for Claude config directory
if [ ! -d "$CLAUDE_DIR" ]; then
    echo "📁 Creating Claude config directory..."
    mkdir -p "$CLAUDE_DIR"
fi

# Check if example configs should be set up
if [ ! -f "$CLAUDE_DIR/settings.claude.json" ] || [ ! -f "$CLAUDE_DIR/settings.glm.json" ]; then
    echo
    echo "⚙️  Setting up configuration files..."
    echo

    if [ ! -f "$CLAUDE_DIR/settings.claude.json" ]; then
        echo "   Creating $CLAUDE_DIR/settings.claude.json"
        cp example-configs/settings.claude.json "$CLAUDE_DIR/"
        echo "   ⚠️  Please edit $CLAUDE_DIR/settings.claude.json and add your Anthropic API key!"
    fi

    if [ ! -f "$CLAUDE_DIR/settings.glm.json" ]; then
        echo "   Creating $CLAUDE_DIR/settings.glm.json"
        cp example-configs/settings.glm.json "$CLAUDE_DIR/"
        echo "   ⚠️  Please edit $CLAUDE_DIR/settings.glm.json and add your Z.AI API key!"
    fi
else
    echo "✓ Configuration files already exist in $CLAUDE_DIR"
fi

echo
echo "🔄 Enabling extension..."
gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null || {
    echo "   Note: Extension will be enabled after GNOME Shell restart"
}

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "📝 Next steps:"
echo
echo "1. Edit your configuration files:"
echo "   - Claude: nano $CLAUDE_DIR/settings.claude.json"
echo "   - GLM:    nano $CLAUDE_DIR/settings.glm.json"
echo
echo "2. Restart GNOME Shell:"
echo "   - X11:     Press Alt+F2, type 'r', press Enter"
echo "   - Wayland: Log out and log back in"
echo
echo "3. Look for the extension icon in your top panel!"
echo
echo "📖 For more information, see README.md"
echo

read -p "Would you like to edit the Claude config now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ${EDITOR:-nano} "$CLAUDE_DIR/settings.claude.json"
fi

read -p "Would you like to edit the GLM config now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ${EDITOR:-nano} "$CLAUDE_DIR/settings.glm.json"
fi

echo
echo "🎉 All done! Restart GNOME Shell to use the extension."
