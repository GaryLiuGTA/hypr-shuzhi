#!/bin/bash
# Install hypr-shuzhi

set -euo pipefail

INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/hypr-shuzhi"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

command -v gjs >/dev/null || { echo "Error: gjs not found. Install gjs first." >&2; exit 1; }
command -v hyprctl >/dev/null || { echo "Error: hyprctl not found. Are you running Hyprland/Omarchy?" >&2; exit 1; }
command -v jq >/dev/null || { echo "Error: jq not found." >&2; exit 1; }

# updateInterval (minutes) in config.json controls the refresh timer; a
# negative value disables scheduling instead of installing the timer.
UPDATE_INTERVAL=$(jq -r '.updateInterval // 30' config.json)

# Omarchy >= 4.0 renders backgrounds via omarchy-shell (Quickshell); older
# versions need swaybg instead. Neither is a hard install-time dependency of
# this script, but warn if the wallpaper won't be able to display at all.
if command -v omarchy-shell >/dev/null; then
  echo "Detected omarchy-shell — wallpaper will render via omarchy-shell (Omarchy >= 4.0)."
elif command -v swaybg >/dev/null; then
  echo "Detected swaybg — wallpaper will render via swaybg (Omarchy < 4.0)."
else
  echo "Warning: neither omarchy-shell nor swaybg found. Install swaybg if you're on Omarchy < 4.0." >&2
fi

echo "Installing hypr-shuzhi to $INSTALL_DIR"

mkdir -p "$INSTALL_DIR/src"
cp src/*.js "$INSTALL_DIR/src/"
cp config.json "$INSTALL_DIR/"

# Make main.js executable
chmod +x "$INSTALL_DIR/src/main.js"

echo "Installing systemd units to $UNIT_DIR"
mkdir -p "$UNIT_DIR"
cp systemd/hypr-shuzhi.service "$UNIT_DIR/"

if (( UPDATE_INTERVAL <= 0 )); then
  echo "updateInterval is $UPDATE_INTERVAL — schedule disabled, removing timer."
  systemctl --user disable --now hypr-shuzhi.timer >/dev/null 2>&1 || true
  rm -f "$UNIT_DIR/hypr-shuzhi.timer"
else
  sed "s/@UPDATE_INTERVAL@/$UPDATE_INTERVAL/" systemd/hypr-shuzhi.timer > "$UNIT_DIR/hypr-shuzhi.timer"
fi

systemctl --user daemon-reload

echo ""
echo "Installation complete."
echo ""
echo "Usage:"
echo "  # Run once:"
echo "  gjs -m $INSTALL_DIR/src/main.js"
echo ""
if (( UPDATE_INTERVAL <= 0 )); then
  echo "  # Schedule is disabled (updateInterval: $UPDATE_INTERVAL in config.json)."
  echo "  # Set updateInterval to a positive number of minutes and re-run install.sh to enable it."
  echo "  # To refresh the wallpaper manually instead:"
  echo "  gjs -m $INSTALL_DIR/src/main.js"
else
  echo "  # Enable auto-refresh (every ${UPDATE_INTERVAL} minutes):"
  echo "  systemctl --user enable --now hypr-shuzhi.timer"
  echo ""
  echo "  # Check timer status:"
  echo "  systemctl --user status hypr-shuzhi.timer"
fi
echo ""
echo "  # Edit config:"
echo "  \$EDITOR $INSTALL_DIR/config.json"
