import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    const clientId = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
    const redirectUri = `${window.location.origin}/api/auth/callback`;

    const authUrl = `https://api.soundcloud.com/connect?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

    console.log("Auth URL:", authUrl);
    window.location.href = authUrl;
  };

  useEffect(() => {
    const errorParam = router.query.error;
    if (errorParam) {
      setError(typeof errorParam === "string" ? errorParam : "Unknown error");
    }
  }, [router.query]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>🎵 Soundcloudy</h1>
        <p>Your personal SoundCloud player</p>

        {error && <div className="login-error">Error: {error}</div>}

        <button className="login-button" onClick={handleLogin}>
          Login with SoundCloud
        </button>
      </div>
    </div>
  );
}
