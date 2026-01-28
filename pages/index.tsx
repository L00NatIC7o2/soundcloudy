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
  const [authChecking, setAuthChecking] = useState(true);
  const [viewingLikes, setViewingLikes] = useState(false);
  const [geniusCache, setGeniusCache] = useState<Record<string, any>>({});
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Queue management
  const [queue, setQueue] = useState<any[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [queueSource, setQueueSource] = useState<
    "playlist" | "search" | "related"
  >("playlist");

  // Define all functions BEFORE useEffect
  const fetchPlaylists = async () => {
    try {
      const response = await fetch("/api/playlists");
      const data = await response.json();
      const sorted = (data.playlists || [])
        .sort((a: any, b: any) => (b.modified_at || 0) - (a.modified_at || 0))
        .slice(0, 5);
      setPlaylists(sorted);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  };

  const fetchLastPlayedTrack = async () => {
    try {
      const response = await fetch("/api/likes");

      if (!response.ok) {
        console.error("Failed to fetch last played track:", response.status);
        return;
      }

      const data = await response.json();

      if (data.likes && data.likes.length > 0) {
        setCurrentTrack(data.likes[0]);
        setQueue(data.likes);
        setQueueIndex(0);
      }
    } catch (error) {
      console.error("Failed to fetch last played track:", error);
    }
  };

  const fetchRelatedTracks = async (trackId: number) => {
    try {
      const response = await fetch(`/api/related-tracks?trackId=${trackId}`);
      const data = await response.json();
      return data.collection || [];
    } catch (error) {
      console.error("Failed to fetch related tracks:", error);
      return [];
    }
  };

  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setViewingLikes(false);
    setTracks([]);
    try {
      const response = await fetch(`/api/playlist/${playlist.id}`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    }
  };

  const handleLikesClick = async () => {
    setViewingLikes(true);
    setSelectedPlaylist(null);
    setTracks([]);
    try {
      const response = await fetch("/api/likes");
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch liked songs:", error);
    }
  };

  const handleSearch = async (offset = 0) => {
    if (!query.trim()) return;

    if (offset === 0) {
      setLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setSelectedPlaylist(null);
    setViewingLikes(false);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=20`,
      );
      const data = await response.json();

      if (offset === 0) {
        // New search
        setTracks(data.collection || []);
        setSearchOffset(20);
      } else {
        // Load more - append results
        const newTracks = data.collection || [];
        const existingIds = new Set(tracks.map((t: any) => t.id));
        const uniqueNewTracks = newTracks.filter(
          (t: any) => !existingIds.has(t.id),
        );

        setTracks((prev) => [...prev, ...uniqueNewTracks]);
        setSearchOffset(offset + 20);
      }

      setSearchHasMore(data.hasMore || false);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleTrackClick = async (
    track: any,
    source: "playlist" | "search",
    trackList: any[] = [],
  ) => {
    setCurrentTrack(track);
    setQueueSource(source);

    if (source === "playlist") {
      // Set queue to playlist tracks starting from clicked track
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1) {
        setQueue(trackList);
        setCurrentQueueIndex(trackIndex);
      }
    } else if (source === "search") {
      // Fetch related tracks for autoplay
      const related = await fetchRelatedTracks(track.id);
      setQueue([track, ...related]);
      setCurrentQueueIndex(0);
    }
  };

  const handleTrackEnd = async () => {
    if (currentQueueIndex < queue.length - 1) {
      // Play next in queue
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    } else if (queueSource === "search" && currentTrack) {
      // Fetch more related tracks
      const related = await fetchRelatedTracks(currentTrack.id);
      if (related.length > 0) {
        setQueue([...queue, ...related]);
        setCurrentQueueIndex(queue.length);
        setCurrentTrack(related[0]);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQueueIndex > 0) {
      const prevIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
    }
  };

  const handleNext = () => {
    if (currentQueueIndex < queue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
    } else if (queueSource === "search" && currentTrack) {
      // Fetch more related tracks
      fetchRelatedTracks(currentTrack.id).then((related) => {
        if (related.length > 0) {
          setQueue([...queue, ...related]);
          setCurrentQueueIndex(queue.length);
          setCurrentTrack(related[0]);
        }
      });
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

  const getPlaylistCover = (playlist: any) => {
    if (playlist.artwork_url) {
      return playlist.artwork_url.replace("-large", "-t500x500");
    }
    if (
      playlist.tracks &&
      playlist.tracks.length > 0 &&
      playlist.tracks[0].artwork_url
    ) {
      return playlist.tracks[0].artwork_url.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getLikedSongsCover = () => {
    if (playlistTracks.length > 0 && playlistTracks[0].artwork_url) {
      return playlistTracks[0].artwork_url.replace("-large", "-t500x500");
    }
    return "/placeholder.png";
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  const fetchGeniusMetadata = async (track: any) => {
    const cacheKey = `${track.id}`;
    if (geniusCache[cacheKey]) {
      return geniusCache[cacheKey];
    }

    try {
      const params = new URLSearchParams({
        title: track.title || "",
        artist: track.user?.username || "",
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(
        `/api/genius-metadata?${params.toString()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Genius API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.found && data.releaseDate) {
        const metadata = {
          releaseYear: new Date(data.releaseDate).getFullYear(),
        };
        setGeniusCache((prev) => ({ ...prev, [cacheKey]: metadata }));
        return metadata;
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn("Genius fetch timeout for track:", track.id);
      } else {
        console.error("Genius fetch failed:", error);
      }
    }

    return null;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (!res.ok) {
          router.push("/login");
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
          fetchPlaylists();
          fetchLastPlayedTrack();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
        setIsAuthenticated(false);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (playlistTracks.length > 0) {
      playlistTracks.forEach((track) => {
        if (track.id && !geniusCache[track.id]) {
          fetchGeniusMetadata(track).catch((err) => {
            console.warn(`Failed to fetch Genius data for ${track.id}:`, err);
          });
        }
      });
    }
  }, [playlistTracks, geniusCache]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setHeaderScrolled(scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (authChecking) {
    return <div style={{ padding: "20px", color: "white" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayTitle = viewingLikes ? "Liked Songs" : selectedPlaylist?.title;
  const displayCover = viewingLikes
    ? getLikedSongsCover()
    : selectedPlaylist
      ? getPlaylistCover(selectedPlaylist)
      : null;

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
            onClick={() => {
              setSelectedPlaylist(null);
              setViewingLikes(false);
            }}
          >
            <span className="nav-icon">🏠</span>
            {sidebarExpanded && <span className="nav-label">Home</span>}
          </button>

          <button
            className="nav-item"
            onClick={() => {
              window.open("https://soundcloud.com/you", "_blank");
            }}
          >
            <span className="nav-icon">👤</span>
            {sidebarExpanded && <span className="nav-label">Profile</span>}
          </button>

          <button className="nav-item" onClick={handleLikesClick}>
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
            <div className="section-title">Recent Playlists</div>
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
                    src={getPlaylistCover(playlist)}
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
            placeholder="Search for songs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
      </div>

      <main className="main-area">
        {selectedPlaylist || viewingLikes ? (
          <div className="playlist-view">
            <div
              className={`playlist-header-sticky ${headerScrolled ? "scrolled" : ""}`}
            >
              <img
                src={displayCover}
                alt={displayTitle}
                className="playlist-header-cover"
              />
              <h2 className="playlist-header-title">{displayTitle}</h2>
            </div>
            <div className="track-list">
              {playlistTracks.map((track: any, index: number) => (
                <div
                  key={track.id || index}
                  className="track-row"
                  onClick={() =>
                    handleTrackClick(track, "playlist", playlistTracks)
                  }
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
                  <div className="track-row-year">
                    {geniusCache[track.id]?.releaseYear ||
                      (track.created_at ? getYear(track.created_at) : "—")}
                  </div>
                  <div className="track-row-added">
                    {track.added_at
                      ? formatTimeAgo(track.added_at)
                      : track.created_at
                        ? formatTimeAgo(track.created_at)
                        : "—"}
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
                onClick={() => handleTrackClick(t, "search")}
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

      <Player
        currentTrack={currentTrack}
        onTrackEnd={handleTrackEnd}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </div>
  );
}
