# macOS Anki Calendar widget

`PupilWidget.xcodeproj` builds a WidgetKit extension for macOS 14 and later. The Tauri app remains the containing app. The extension reads a small JSON snapshot (study dates and current streak) from a shared app group, not the card database. The app updates it on launch and after reviews, undo, deletion of a space, and reset. WidgetKit controls refresh timing; the widget asks for a refresh roughly every 15 minutes.

## Signing and local build

A widget needs a signed containing app and extension belonging to the same Apple developer team. Sign in to Xcode, create a macOS signing certificate, and configure the widget target's team and bundle identifier for your account. Use a team-prefixed app group (`TEAMID.com.pupil.desktop`) on macOS; both processes must have the same group entitlement and signing team. A `group.`-prefixed group needs an authorized provisioning profile instead.

With Rust, Bun, and Xcode configured, build the widget-enabled local app:

```sh
export PUPIL_APPLE_TEAM_ID=YOURTEAMID
export PUPIL_SIGNING_IDENTITY='Apple Development: Your Name (YOURTEAMID)'
./apps/app/macos/scripts/build-widget-app.sh
```

Set `PUPIL_WIDGET_BUNDLE_ID` if your Apple account requires a different extension identifier, and `PUPIL_APP_GROUP` to override the default team-prefixed group. Open the resulting `apps/app/src-tauri/target/release/bundle/macos/Pupil.app` once, then add **Anki Calendar** from the macOS widget gallery. The signed app is a local build; distributing it requires the appropriate Developer ID, provisioning and notarization. A plain `tauri build` does not include the widget.

The widget has a medium size. It shows the last 168 local calendar days; the dashboard shows the most recent 112. An empty placeholder asks the user to open Pupil if no snapshot is available.
