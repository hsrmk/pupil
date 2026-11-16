#!/bin/bash
# Builds a local macOS app containing the separately signed WidgetKit extension.
set -euo pipefail
: "${PUPIL_APPLE_TEAM_ID:?Set PUPIL_APPLE_TEAM_ID to your Apple developer team ID}"
: "${PUPIL_SIGNING_IDENTITY:?Set PUPIL_SIGNING_IDENTITY to a macOS signing certificate name or SHA-1}"
script_dir="$(cd "$(dirname "$0")" && pwd)"
app_dir="$(cd "$script_dir/../.." && pwd)"
mac_dir="$app_dir/macos"
project_root="$(cd "$app_dir/../.." && pwd)"
group="${PUPIL_APP_GROUP:-${PUPIL_APPLE_TEAM_ID}.com.pupil.desktop}"
widget_bundle_id="${PUPIL_WIDGET_BUNDLE_ID:-com.pupil.desktop.widget}"
derived="$app_dir/src-tauri/target/pupil-widget-derived"
output="$app_dir/src-tauri/target/release/bundle/macos/Pupil.app"
entitlements="$(mktemp -t pupil-widget-entitlements)"
trap 'rm -f "$entitlements"' EXIT

cd "$project_root"
bun run --cwd apps/app tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
xcodebuild -project "$mac_dir/PupilWidget.xcodeproj" -scheme PupilWidget -configuration Release \
  -derivedDataPath "$derived" DEVELOPMENT_TEAM="$PUPIL_APPLE_TEAM_ID" \
  CODE_SIGN_IDENTITY="Apple Development" PUPIL_APP_GROUP="$group" \
  PRODUCT_BUNDLE_IDENTIFIER="$widget_bundle_id" build

# Add the extension before signing the enclosing app. The widget only reads the
# app-group snapshot; it never receives access to Pupil's card database.
mkdir -p "$output/Contents/PlugIns"
rm -rf "$output/Contents/PlugIns/PupilWidget.appex"
ditto "$derived/Build/Products/Release/PupilWidget.appex" "$output/Contents/PlugIns/PupilWidget.appex"
/usr/libexec/PlistBuddy -c "Add :PupilAppGroup string $group" "$output/Contents/Info.plist"
cat > "$entitlements" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.application-groups</key><array><string>$group</string></array>
</dict></plist>
PLIST
codesign --force --sign "$PUPIL_SIGNING_IDENTITY" --entitlements "$entitlements" "$output"
codesign --verify --deep --strict "$output"
printf '\nBuilt widget-enabled app: %s\n' "$output"
