#!/bin/bash
set -euo pipefail

ACTION="${1:-install}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER_ID="$(id -u)"
AGENT_DIRECTORY="$HOME/Library/LaunchAgents"
LOG_DIRECTORY="$HOME/Library/Logs/PetWolly"
WEB_LABEL="org.petwolly.web"
DESKTOP_LABEL="org.petwolly.desktop"
WEB_PLIST="$AGENT_DIRECTORY/$WEB_LABEL.plist"
DESKTOP_PLIST="$AGENT_DIRECTORY/$DESKTOP_LABEL.plist"
WEB_SCRIPT="$PROJECT_ROOT/scripts/woolly-web-service.sh"
DESKTOP_SCRIPT="$PROJECT_ROOT/scripts/woolly-desktop-service.sh"
DESKTOP_APP="$PROJECT_ROOT/native-pet/DesktopPet.app/Contents/MacOS/DesktopPet"
NPM_COMMAND="$(command -v npm)"
NODE_DIRECTORY="$(dirname "$(command -v node)")"
BRIDGE_URL="http://127.0.0.1:3100"

require_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        echo "Pet Wolly login startup is supported only on macOS." >&2
        exit 1
    fi
}

remove_agent() {
    local plist_path="$1"
    launchctl bootout "gui/$USER_ID" "$plist_path" 2>/dev/null || true
    rm -f "$plist_path"
}

write_web_plist() {
    cat > "$WEB_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$WEB_LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$WEB_SCRIPT</string></array>
  <key>WorkingDirectory</key><string>$PROJECT_ROOT</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$NODE_DIRECTORY:/usr/local/bin:/usr/bin:/bin</string>
    <key>PORT</key><string>3100</string>
    <key>WOLLY_NPM</key><string>$NPM_COMMAND</string>
  </dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIRECTORY/web.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIRECTORY/web-error.log</string>
</dict></plist>
PLIST
}

write_desktop_plist() {
    cat > "$DESKTOP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$DESKTOP_LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DESKTOP_SCRIPT</string></array>
  <key>WorkingDirectory</key><string>$PROJECT_ROOT</string>
  <key>EnvironmentVariables</key><dict>
    <key>CAMPUS_URL</key><string>$BRIDGE_URL</string>
    <key>WOLLY_DESKTOP_APP</key><string>$DESKTOP_APP</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIRECTORY/desktop.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIRECTORY/desktop-error.log</string>
</dict></plist>
PLIST
}

install_agents() {
    require_macos
    mkdir -p "$AGENT_DIRECTORY" "$LOG_DIRECTORY"
    if [[ ! -x "$DESKTOP_APP" ]]; then
        (cd "$PROJECT_ROOT/native-pet" && ./build-app.sh)
    fi
    remove_agent "$WEB_PLIST"
    remove_agent "$DESKTOP_PLIST"
    write_web_plist
    write_desktop_plist
    launchctl bootstrap "gui/$USER_ID" "$WEB_PLIST"
    launchctl bootstrap "gui/$USER_ID" "$DESKTOP_PLIST"
    echo "Pet Wolly will start at login. Bridge: $BRIDGE_URL"
}

show_status() {
    launchctl print "gui/$USER_ID/$WEB_LABEL" 2>/dev/null || true
    launchctl print "gui/$USER_ID/$DESKTOP_LABEL" 2>/dev/null || true
}

case "$ACTION" in
    install) install_agents ;;
    uninstall)
        remove_agent "$WEB_PLIST"
        remove_agent "$DESKTOP_PLIST"
        echo "Pet Wolly login startup removed."
        ;;
    status) show_status ;;
    *)
        echo "Usage: $0 {install|uninstall|status}" >&2
        exit 1
        ;;
esac
