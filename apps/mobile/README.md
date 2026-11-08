# Soundcloudy Mobile

This is the native Expo app for Soundcloudy. It is meant to become the mobile-web experience rebuilt with native UI.

## Setup

Use Node.js 22.13 or newer with Expo Go for SDK 58.

1. Copy `.env.example` to `.env`
2. Set your hosted services:

```env
EXPO_PUBLIC_API_URL=https://soundcloudy-app.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://soundcloudy-app.onrender.com
```

3. Install dependencies:

```bash
npm install
```

4. Start Expo:

```bash
npm run start
```

## Notes

- You can develop on Windows.
- macOS is only needed later for the iOS simulator, native iOS builds, or App Store submission.
- Discover is the signed-in landing screen, with personalized SoundCloud sections, search, playlist playback, and phone-native audio. Desktop sync joins automatically after sign-in; current desktop playback and optional handoff are integrated without requiring a manual room connection.
- Sign in with the same SoundCloud account used by the desktop app. The phone resolves that account's desktop sync room through `/api/auth/session`.
- `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` must point to services reachable from the phone. For local services, use your computer's LAN IP instead of `localhost`.
- Phone audio uses `expo-audio`, which is included in Expo Go for SDK 58. The app config enables background audio and lock-screen metadata for native builds.
- Library, playlists, profile, and friends are still being ported; the native app does not yet have parity with the desktop app.
