# Local Phone Testing

## 1. Run the app locally

```powershell
npm run dev:all
```

This starts:

- Next.js on `http://localhost:3000`
- the socket server on `http://localhost:3001`

## 2. Open two tunnels

If you have `ngrok` installed:

```powershell
npm run tunnel:web
npm run tunnel:socket
```

You should get two public HTTPS URLs:

- web app tunnel, for example `https://abc123.ngrok-free.app`
- socket tunnel, for example `https://def456.ngrok-free.app`

## 3. Update your local env

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXTAUTH_URL=https://abc123.ngrok-free.app
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
NEXT_PUBLIC_SOCKET_URL=https://def456.ngrok-free.app
SOUNDCLOUD_CLIENT_ID=...
SOUNDCLOUD_CLIENT_SECRET=...
```

Then restart:

```powershell
npm run dev:all
```

## 4. Update the SoundCloud redirect

Because SoundCloud only allows one redirect, temporarily set it to:

```text
https://abc123.ngrok-free.app/api/auth/callback
```

## 5. Test on both devices

Open the same web tunnel URL on:

- desktop browser
- phone browser

Log into the same SoundCloud account on both.

## 6. Expected sync behavior

After the latest sync patch:

- desktop and phone should join the same realtime room based on the authenticated SoundCloud user
- opening the phone app should let it mirror the desktop player's current track
- audio should not automatically switch to the phone just because it mirrored state

## Notes

- If sync does not work, make sure both the web app and socket tunnel URLs are current and that both devices use the same environment.
- Restart the dev server after changing `.env.local`.
- When you are done testing, switch the SoundCloud redirect back to your usual URL.
