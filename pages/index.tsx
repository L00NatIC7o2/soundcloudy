import { useEffect, useState } from "react";
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
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${query}`);
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

      <button onClick={handleLogin}>Login with SoundCloud</button>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search tracks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <Player currentTrack={currentTrack} />

      <ul className="tracks-list">
        {tracks.map((t: any) => (
          <li key={t.id}>
            {t.title} <button onClick={() => setCurrentTrack(t)}>Play</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
