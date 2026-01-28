import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Login() {
  const router = useRouter();

  const handleLogin = () => {
    const clientId =
      process.env.NEXT_PUBLIC_SOUNDCLOUD_CLIENT_ID ||
      "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    const scope = "non-expiring";

    const authUrl = `https://api.soundcloud.com/connect?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

    window.location.href = authUrl;
  };

  useEffect(() => {
    const { error } = router.query;
    if (error) {
      alert(`Login error: ${error}`);
    }
  }, [router.query]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🎵 Soundcloudy</h1>
        <p>Your personal SoundCloud player</p>
        <button className="login-button" onClick={handleLogin}>
          Login with SoundCloud
        </button>
      </div>
    </div>
  );
}
