# Desktop App

The Windows desktop client uses Electron for its shell and the existing Next.js
app for its renderer.

## Windows installer and updates

- `npm run electron:build` creates a per-user NSIS installer named for the
  product and package version. The configured output directory is
  `D:\soundcloudy-build-v2`.
- `npm run electron:publish` builds the app and publishes installer and update
  metadata to the configured GitHub Releases repository. Publishing requires
  GitHub release credentials in the environment.
- Installed builds check for updates on startup by default and download them in
  the background. Update behavior can be changed in Settings. When an update is
  ready, Soundcloudy shows it in the in-app notification center; installation
  happens when the user chooses to restart.
- The updater is available only in packaged desktop builds. Development builds
  do not apply self-updates.
- Friend requests, relationships, and privacy preferences are stored in the
  current user's Electron data directory and are not included in the installer.

Increment `version` in the root `package.json` before creating a release so
electron-updater can distinguish each release.
