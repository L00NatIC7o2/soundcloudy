import { useEffect } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const checkAuth = async () => {
      const res = await fetch("/api/auth/check");
      if (res.ok) {
        router.push("/");
      }
    };
    checkAuth();
  }, [router]);

  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SoundCloudy</h1>
        <p>Stream your favorite music</p>
        <button onClick={handleLogin} className="login-button">
          Login with SoundCloud
        </button>
      </div>
    </div>
  );
}
