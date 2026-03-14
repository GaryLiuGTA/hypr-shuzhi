bash install.sh
systemctl --user enable --now hypr-shuzhi.timer

# systemctl --user enable --now hypr-shuzhi.timer
# Created symlink '/home/garyliu/.config/systemd/user/timers.target.wants/hypr-shuzhi.timer' → '/home/garyliu/.config/systemd/user/hypr-shuzhi.timer'.
#
# [Unit]
# Description=Refresh wallpaper with new poetry on schedule
#
# [Timer]
# OnBootSec=30s
# OnUnitActiveSec=30min
# RandomizedDelaySec=60s
#
# [Install]
# WantedBy=timers.target
