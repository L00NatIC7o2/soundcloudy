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
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-icons">{/* add your nav icons here */}</div>
        <div className="rail-divider" />
        <div className="rail-thumbs">{/* thumbnails */}</div>
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
        </div>
      </div>

      <main className="main-area">{/* your main content */}</main>

      <div className="player-bar">
        <Player currentTrack={currentTrack} />
      </div>
    </div>
  );
}
