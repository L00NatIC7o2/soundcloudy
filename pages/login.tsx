import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          router.push("/");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

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
