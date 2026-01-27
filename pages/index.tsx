import { useEffect, useState } from "react";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    }
  }, []);

  const handleLogin = () => {
    const CLIENT_ID = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
    const REDIRECT_URI = "https://soundcloudy.vercel.app/api/callback"; // Vercel domain
    const authUrl = `https://secure.soundcloud.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=non-expiring`;
    window.location.href = authUrl;
  };

  const handleSearch = async () => {
    if (!token) {
      alert("Please login first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${query}&token=${token}`);
      const data = await response.json();
      setTracks(data.collection || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>SoundCloudy</h1>

      {!token ? (
        <button onClick={handleLogin}>Login with SoundCloud</button>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks..."
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>

          <ul>
            {tracks.map((track) => (
              <li key={track.id}>{track.title}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
