import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const res = await fetch("/api/auth/check");
      if (!res.ok) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, [router]);

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

  if (!isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}
      >
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
        >
          {sidebarExpanded ? "◀" : "▶"}
        </button>

        <nav className="sidebar-nav">
          <button className="nav-item">
            <span className="nav-icon">🏠</span>
            {sidebarExpanded && <span className="nav-label">Home</span>}
          </button>

          <button className="nav-item">
            <span className="nav-icon">❤️</span>
            {sidebarExpanded && <span className="nav-label">Liked Songs</span>}
          </button>

          <button className="nav-item">
            <span className="nav-icon">🆕</span>
            {sidebarExpanded && <span className="nav-label">New Releases</span>}
          </button>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-playlists">
          {sidebarExpanded && <div className="section-title">Most Played</div>}
          <div className="playlist-thumbs">
            {/* Placeholder thumbnails */}
            <img
              src="/placeholder.png"
              alt="Playlist"
              className="playlist-thumb"
            />
            <img
              src="/placeholder.png"
              alt="Playlist"
              className="playlist-thumb"
            />
            <img
              src="/placeholder.png"
              alt="Playlist"
              className="playlist-thumb"
            />
            <img
              src="/placeholder.png"
              alt="Playlist"
              className="playlist-thumb"
            />
            <img
              src="/placeholder.png"
              alt="Playlist"
              className="playlist-thumb"
            />
          </div>
        </div>
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
        <div className="tracks-grid">
          {tracks.map((t: any) => (
            <div
              key={t.id}
              className="track-card"
              onClick={() => setCurrentTrack(t)}
            >
              <img
                src={
                  t.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={t.title}
                className="track-cover"
              />
              <div className="track-info">
                <div className="track-title">{t.title}</div>
                <div className="track-artist">
                  {t.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <div className="player-bar">
        <Player currentTrack={currentTrack} />
      </div>
    </div>
  );
}
