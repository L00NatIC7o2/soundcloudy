import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";
import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("./homepage"), { ssr: false });

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
  const [viewingProfile, setViewingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [viewingArtist, setViewingArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [artistTracks, setArtistTracks] = useState<any[]>([]);
  const [viewingHomepage, setViewingHomepage] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  // Removed Genius cache state
  const [searchOffset, setSearchOffset] = useState<number>(0);
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false);
  const [searchNextHref, setSearchNextHref] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [queueSource, setQueueSource] = useState<
    "playlist" | "search" | "search-related"
  >("playlist");
  const [isShuffle, setIsShuffle] = useState(false);
  const scrollTriggerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  // Fetch playlists
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

  // Fetch last played track
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
        setCurrentQueueIndex(0);
      }
    } catch (error) {
      console.error("Failed to fetch last played track:", error);
    }
  };

  // Handle playlist click
  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist);
    setViewingHomepage(false);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setSectionLoading(true);
    setTracks([]);
    setPlaylistTracks([]);
    try {
      const response = await fetch(`/api/playlist/${playlist.id}`);
      const data = await response.json();
      setPlaylistTracks(data.tracks || []);
      // Do NOT set queue, queueSource, currentQueueIndex, or currentTrack here
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    } finally {
      setSectionLoading(false);
    }
    pushTabState("playlist", { playlistId: playlist.id });
  };

  // Handle likes click
  const handleLikesClick = async () => {
    setViewingLikes(true);
    setViewingHomepage(false);
    setSelectedPlaylist(null);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setSectionLoading(true);
    setTracks([]);
    setPlaylistTracks([]);
    try {
      const response = await fetch("/api/likes");
      const data = await response.json();
      const likes = data.likes || data.tracks || [];
      setPlaylistTracks(likes);
      if (!currentTrack) {
        setQueue(likes);
        setQueueSource("playlist");
        setCurrentQueueIndex(-1);
        setCurrentTrack(null);
      }
    } catch (error) {
      console.error("Failed to fetch liked songs:", error);
    } finally {
      setSectionLoading(false);
    }
    pushTabState("likes");
  };

  // Handle profile click
  const handleProfileClick = async () => {
    setViewingProfile(true);
    setViewingHomepage(false);
    setViewingArtist(false); // <-- Reset artist view
    setSelectedArtist(null); // <-- Clear selected artist
    setSelectedPlaylist(null);
    setViewingLikes(false);
    setSectionLoading(true);
    setTracks([]);
    setArtistTracks([]); // <-- Clear artist tracks
    setPlaylistTracks([]);

    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      console.log("User profile data:", data);
      setUserProfile(data);
      if (data.tracks) {
        setPlaylistTracks(data.tracks);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setSectionLoading(false);
    }
    pushTabState("profile");
  };

  // Handle artist click
  const handleArtistClick = async (artist: any) => {
    setViewingArtist(true);
    setViewingHomepage(false);
    setSelectedPlaylist(null);
    setViewingProfile(false);
    setViewingLikes(false);
    setTracks([]);
    setSelectedArtist(artist);
    setSectionLoading(true);
    setArtistTracks([]);

    try {
      const response = await fetch(`/api/artist/${artist.id}`);
      if (!response.ok) {
        throw new Error(`Artist fetch failed: ${response.status}`);
      }
      const data = await response.json();
      setSelectedArtist(data);
      setArtistTracks(data.tracks || []);
    } catch (error) {
      console.error("Failed to fetch artist tracks:", error);
    } finally {
      setSectionLoading(false);
    }
    pushTabState("artist", { artistId: artist.id });
  };

  // Handle search with pagination
  const handleSearch = async (nextPageHref: string | null = null) => {
    if (!query.trim() && !nextPageHref) {
      setTracks([]);
      setSearchHasMore(false);
      return;
    }

    if (!nextPageHref) {
      setLoading(true);
      setTracks([]);
      setSearchNextHref(null);
      setSearchHasMore(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      scrollToTop();
    } else {
      setIsLoadingMore(true);
    }

    setSelectedPlaylist(null);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setViewingHomepage(false);

    try {
      let url = "/api/search";
      if (nextPageHref) {
        url += `?nextHref=${encodeURIComponent(nextPageHref)}`;
      } else {
        url += `?q=${encodeURIComponent(query)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      console.log("Search response:", {
        query,
        resultsCount: (data.collection || []).length,
        hasMore: data.hasMore,
      });

      if (!nextPageHref) {
        setTracks(data.collection || []);
        scrollToTop();
      } else {
        const newTracks = data.collection || [];
        const existingIds = new Set(tracks.map((t: any) => t.id));
        const uniqueNewTracks = newTracks.filter(
          (t: any) => !existingIds.has(t.id),
        );
        setTracks((prev) => [...prev, ...uniqueNewTracks]);
      }

      setSearchHasMore(data.hasMore || false);
      setSearchNextHref(data.nextHref || null);
      if (!nextPageHref) {
        pushTabState("search", { query });
      }
    } catch (error) {
      console.error("Search error:", error);
      setTracks([]);
      setSearchHasMore(false);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Handle track click
  const handleTrackClick = (
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[] = [],
  ) => {
    if (source === "playlist") {
      setCurrentTrack(track);
      setQueueSource("playlist");
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1) {
        setQueue(trackList);
        setCurrentQueueIndex(trackIndex);
      }
    } else if (source === "search") {
      // Fetch related tracks for the clicked song and set queue to [clickedSong, ...relatedTracks]
      (async () => {
        setCurrentTrack(track);
        setQueueSource("search-related");
        try {
          const res = await fetch(`/api/related-tracks?trackId=${track.id}`);
          const data = await res.json();
          const related = Array.isArray(data.tracks) ? data.tracks : [];
          // Remove the clicked track if present in related
          const filteredRelated = related.filter((t: any) => t.id !== track.id);
          setQueue([track, ...filteredRelated]);
          setCurrentQueueIndex(0);
        } catch (e) {
          setQueue([track]);
          setCurrentQueueIndex(0);
        }
      })();
    }
  };

  // Handle next track
  const handleNext = async () => {
    // For playlist/likes or search-related: advance in queue
    if (
      (queueSource === "playlist" || queueSource === "search-related") &&
      queue.length > 0
    ) {
      let nextIndex: number;

      if (isShuffle) {
        // Pick random track from queue
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        // Play next track in sequence
        if (currentQueueIndex < queue.length - 1) {
          nextIndex = currentQueueIndex + 1;
        } else {
          return; // End of queue
        }
      }

      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
      return;
    }
    // fallback: do nothing
  };

  // Handle previous track
  const handlePrevious = () => {
    if (currentQueueIndex > 0) {
      const prevIndex = currentQueueIndex - 1;
      setCurrentQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
    }
  };

  // Utility functions
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

  // Removed fetchGeniusMetadata

  // Auth check
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
          // fetchLastPlayedTrack(); // Removed autoplay on login
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

  // Removed Genius metadata effect

  // Infinite scroll for search results
  useEffect(() => {
    // Only enable infinite scroll when viewing search results
    if (
      !scrollTriggerRef.current ||
      !searchHasMore ||
      isLoadingMore ||
      loading ||
      !searchNextHref ||
      selectedPlaylist ||
      viewingLikes ||
      viewingProfile ||
      viewingArtist
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && searchHasMore && !isLoadingMore) {
          handleSearch(searchNextHref);
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );

    observer.observe(scrollTriggerRef.current);

    return () => observer.disconnect();
  }, [
    searchHasMore,
    isLoadingMore,
    loading,
    searchNextHref,
    selectedPlaylist,
    viewingLikes,
    viewingProfile,
    viewingArtist,
  ]);

  // Popstate handler for browser back/forward
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state || {};
      switch (state.tab) {
        case "homepage":
          setViewingHomepage(true);
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setSelectedArtist(null);
          break;
        case "profile":
          setViewingHomepage(false);
          handleProfileClick();
          break;
        case "likes":
          setViewingHomepage(false);
          handleLikesClick();
          break;
        case "playlist":
          setViewingHomepage(false);
          if (state.playlistId) {
            const playlist = playlists.find((p) => p.id === state.playlistId);
            if (playlist) handlePlaylistClick(playlist);
          }
          break;
        case "artist":
          setViewingHomepage(false);
          if (state.artistId) {
            handleArtistClick({ id: state.artistId });
          }
          break;
        case "search":
          setViewingHomepage(false);
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setSelectedArtist(null);
          setQuery(state.query || "");
          handleSearch();
          break;
        default:
          setViewingHomepage(true);
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setSelectedArtist(null);
          break;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [playlists]);

  const pushTabState = (tab: string, data: Record<string, any> = {}) => {
    window.history.pushState({ tab, ...data }, "", "");
    if (tab === "homepage") setViewingHomepage(true);
    else setViewingHomepage(false);
  };

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
              setViewingHomepage(true);
              setSelectedPlaylist(null);
              setViewingLikes(false);
              setViewingProfile(false);
              setViewingArtist(false);
              setSelectedArtist(null);
              pushTabState("homepage");
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/50/home.png"
              alt="Home"
              className="nav-icon-img"
            />
            {sidebarExpanded && <span className="nav-label">Home</span>}
          </button>

          <button
            className="nav-item"
            onClick={() => {
              setViewingHomepage(false);
              handleProfileClick();
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/48/person-male.png"
              alt="Profile"
              className="nav-icon-img"
            />
            {sidebarExpanded && <span className="nav-label">Profile</span>}
          </button>

          <button
            className="nav-item"
            onClick={() => {
              setViewingHomepage(false);
              handleLikesClick();
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/48/like.png"
              alt="Liked Songs"
              className="nav-icon-img nav-icon-like"
            />
            {sidebarExpanded && <span className="nav-label">Liked Songs</span>}
          </button>

          <button
            className="nav-item"
            onClick={() => {
              setViewingHomepage(false);
              setSelectedPlaylist(null);
              setViewingLikes(false);
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/48/calendar-1.png"
              alt="Newly Released"
              className="nav-icon-img"
            />
            {sidebarExpanded && (
              <span className="nav-label">Newly Released</span>
            )}
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
                  onClick={() => {
                    setViewingHomepage(false);
                    handlePlaylistClick(playlist);
                  }}
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
          <button onClick={() => handleSearch()} disabled={loading}>
            {loading ? "..." : "Search"}
          </button>
        </div>
      </div>

      <main className="main-area">
        {viewingHomepage ? (
          <HomePage
            onTrackClick={handleTrackClick}
            currentTrack={currentTrack}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onTrackEnd={handleNext}
          />
        ) : selectedPlaylist ||
          viewingLikes ||
          viewingProfile ||
          viewingArtist ? (
          <div className="playlist-view">
            {sectionLoading ? (
              <div className="playlist-loading">Loading...</div>
            ) : (
              <>
                {viewingProfile || viewingArtist ? (
                  <div
                    className="profile-header"
                    style={{
                      backgroundImage: (
                        viewingProfile
                          ? userProfile?.banner_url
                          : selectedArtist?.banner_url
                      )
                        ? `url(${viewingProfile ? userProfile?.banner_url : selectedArtist?.banner_url})`
                        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <img
                      src={
                        viewingProfile
                          ? userProfile?.avatar_url?.replace(
                              "-large",
                              "-t500x500",
                            ) || "/placeholder.png"
                          : selectedArtist?.avatar_url?.replace(
                              "-large",
                              "-t500x500",
                            ) || "/placeholder.png"
                      }
                      alt={
                        viewingProfile
                          ? userProfile?.username
                          : selectedArtist?.username
                      }
                      className="profile-header-avatar"
                    />
                    <h2 className="profile-header-title">
                      {viewingProfile
                        ? userProfile?.username
                        : selectedArtist?.username}
                      {(viewingProfile
                        ? userProfile?.verified
                        : selectedArtist?.verified) && (
                        <span className="verified-badge" title="Verified">
                          ✓
                        </span>
                      )}
                    </h2>
                  </div>
                ) : (
                  <div className="playlist-header-sticky">
                    <img
                      src={displayCover}
                      alt={displayTitle}
                      className="playlist-header-cover"
                    />
                    <h2 className="playlist-header-title">{displayTitle}</h2>
                  </div>
                )}
                <div className="track-list">
                  {(viewingProfile
                    ? playlistTracks
                    : viewingArtist
                      ? artistTracks
                      : playlistTracks
                  ).map((track: any, index: number) => (
                    <div
                      key={track.id || index}
                      className="track-row"
                      onClick={() =>
                        handleTrackClick(
                          track,
                          "playlist",
                          viewingProfile
                            ? playlistTracks
                            : viewingArtist
                              ? artistTracks
                              : playlistTracks,
                        )
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
                        <div
                          className="track-row-artist"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArtistClick(track.user);
                          }}
                          style={{
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {track.user?.username || "Unknown"}
                        </div>
                      </div>
                      <div className="track-row-duration">
                        {formatDuration(track.duration)}
                      </div>
                      <div className="track-row-year">
                        {track.created_at ? getYear(track.created_at) : "—"}
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
              </>
            )}
          </div>
        ) : (
          <div className="tracks-grid">
            {tracks.map((t: any) => (
              <div
                key={t.id}
                className="track-card"
                onClick={() => handleTrackClick(t, "search", tracks)}
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
                  <div
                    className="track-artist"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArtistClick(t.user);
                    }}
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                  >
                    {t.user?.username || "Unknown"}
                  </div>
                </div>
              </div>
            ))}

            {searchHasMore && (
              <div
                ref={scrollTriggerRef}
                style={{
                  textAlign: "center",
                  padding: "40px",
                  gridColumn: "1 / -1",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: "14px",
                }}
              >
                {isLoadingMore ? "⏳ Loading more..." : ""}
              </div>
            )}
          </div>
        )}
      </main>

      <Player
        currentTrack={currentTrack}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTrackEnd={handleNext}
        onArtistClick={handleArtistClick}
        isShuffle={isShuffle}
        onShuffleChange={setIsShuffle}
      />
    </div>
  );
}
