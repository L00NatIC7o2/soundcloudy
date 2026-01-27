import { useState } from "react";
import Player from "../src/components/Player";

export default function Home() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);

  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();
      setTracks(data.collection || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-icons">
          <button onClick={handleLogin}>🔐</button>
        </div>
        <div className="rail-divider" />
        <div className="rail-thumbs">{/* thumbnails go here */}</div>
      </aside>

      <div className="top-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      </div>

      <main className="main-area">
        <ul className="tracks-list">
          {tracks.map((t: any) => (
            <li key={t.id}>
              <span>{t.title}</span>
              <button onClick={() => setCurrentTrack(t)}>Play</button>
            </li>
          ))}
        </ul>
      </main>

      <div className="player-bar">
        <Player currentTrack={currentTrack} />
      </div>
    </div>
  );
}
