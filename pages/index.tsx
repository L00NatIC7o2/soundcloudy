import { useEffect, useState } from "react";
import "@/styles/main.css";
import Player from "@/components/Player";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const clientId =
    process.env.NEXT_PUBLIC_SOUNDCLOUD_CLIENT_ID ||
    process.env.VITE_SOUNDCLOUD_CLIENT_ID ||
    "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    }
  }, []);

  const handleLogin = () => {
    const authUrl = `https://secure.soundcloud.com/authorize?client_id=${clientId}&redirect_uri=https://soundcloudy.vercel.app/api/callback&response_type=code&scope=non-expiring`;
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
    <div id="app">
      <h1>SoundCloudy</h1>

      {!token ? (
        <button onClick={handleLogin}>Login with SoundCloud</button>
      ) : (
        <>
          <div className="search-container">
            <input
              type="text"
              id="searchInput"
              placeholder="Search tracks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button id="searchBtn" onClick={handleSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <Player
            currentTrack={currentTrack}
            token={token}
            clientId={clientId}
          />

          <ul id="tracksList" className="tracks-list">
            {tracks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
