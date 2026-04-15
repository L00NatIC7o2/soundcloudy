# Soundcloudy Mobile

This is the native Expo app for Soundcloudy. It is meant to become the mobile-web experience rebuilt with native UI.

## Setup

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
- The current native shell includes:
  - backend/socket config
  - desktop room connection
  - desktop playback sync
  - native search screen
  - library/friends/playlist landing area for the next ported screens

