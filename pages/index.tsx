import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch("/api/auth/check");
      if (!res.ok) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
        fetchPlaylists();
      }
    };
    checkAuth();
  }, [router]);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch("/api/playlists");
      const data = await response.json();
      const sorted = (data.playlists || [])
        .sort(
          (a: any, b: any) => (b.playback_count || 0) - (a.playback_count || 0),
        )
        .slice(0, 5);
      setPlaylists(sorted);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  };

  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setTracks([]);
    try {
      const response = await fetch(`/api/playlist/${playlist.id}`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSelectedPlaylist(null);
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

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
          <button
            className="nav-item"
            onClick={() => setSelectedPlaylist(null)}
          >
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
          {sidebarExpanded && (
            <div className="section-title">Most Played Playlists</div>
          )}
          <div className="playlist-thumbs">
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="playlist-item"
                  onClick={() => handlePlaylistClick(playlist)}
                >
                  <img
                    src={
                      playlist.artwork_url?.replace("-large", "-t300x300") ||
                      "/placeholder.png"
                    }
                    alt={playlist.title}
                    className="playlist-thumb"
                  />
                  {sidebarExpanded && (
                    <div className="playlist-title-sidebar">
                      {playlist.title}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                {sidebarExpanded ? "No playlists yet" : "—"}
              </div>
            )}
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
        {selectedPlaylist ? (
          <div className="playlist-view">
            <h2 className="playlist-header">{selectedPlaylist.title}</h2>
            <div className="track-list">
              {playlistTracks.map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="track-row"
                  onClick={() => setCurrentTrack(track)}
                >
                  <img
                    src={
                      track.artwork_url?.replace("-large", "-t200x200") ||
                      "/placeholder.png"
                    }
                    alt={track.title}
                    className="track-row-cover"
                  />
                  <div className="track-row-info">
                    <div className="track-row-title">{track.title}</div>
                    <div className="track-row-artist">
                      {track.user?.username || "Unknown"}
                    </div>
                  </div>
                  <div className="track-row-duration">
                    {formatDuration(track.duration)}
                  </div>
                  <div className="track-row-added">
                    {track.created_at ? formatTimeAgo(track.created_at) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )}
      </main>

      <div className="player-bar">
        <Player currentTrack={currentTrack} />
      </div>
    </div>
  );
}
