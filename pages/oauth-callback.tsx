import { useEffect } from "react";
import { useRouter } from "next/router";

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Extract token from URL hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get("access_token");

    if (token) {
      // Set token in cookie
      document.cookie = `soundcloud_token=${token}; path=/; max-age=31536000`;
      router.push("/");
    } else {
      router.push("/login?error=no_token");
    }
  }, [router]);

  return (
    <div style={{ padding: "20px", color: "white", textAlign: "center" }}>
      Authorizing...
    </div>
  );
}
