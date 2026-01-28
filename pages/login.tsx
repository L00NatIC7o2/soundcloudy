import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Login() {
  const router = useRouter();

  const handleLogin = () => {
    const clientId = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
    const redirectUri = `${window.location.origin}/api/auth/callback`;

    const authUrl = new URL("https://soundcloud.com/oauth");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "non-expiring");
    authUrl.searchParams.append("display", "popup");

    window.location.href = authUrl.toString();
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
