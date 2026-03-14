#!/bin/bash
# Install hypr-shuzhi

set -euo pipefail

INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/hypr-shuzhi"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "Installing hypr-shuzhi to $INSTALL_DIR"

mkdir -p "$INSTALL_DIR/src"
cp src/*.js "$INSTALL_DIR/src/"
cp config.json "$INSTALL_DIR/"

# Make main.js executable
chmod +x "$INSTALL_DIR/src/main.js"

echo "Installing systemd units to $UNIT_DIR"
mkdir -p "$UNIT_DIR"
cp systemd/hypr-shuzhi.service "$UNIT_DIR/"
cp systemd/hypr-shuzhi.timer "$UNIT_DIR/"

systemctl --user daemon-reload

echo ""
echo "Installation complete."
echo ""
echo "Usage:"
echo "  # Run once:"
echo "  gjs -m $INSTALL_DIR/src/main.js"
echo ""
echo "  # Enable auto-refresh (every 30 minutes):"
echo "  systemctl --user enable --now hypr-shuzhi.timer"
echo ""
echo "  # Check timer status:"
echo "  systemctl --user status hypr-shuzhi.timer"
echo ""
echo "  # Edit config:"
echo "  \$EDITOR $INSTALL_DIR/config.json"
