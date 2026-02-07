import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  startTransition,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";
import PlaylistMenu from "../src/components/PlaylistMenu";
import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("./homepage"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [albumResults, setAlbumResults] = useState<any[]>([]);
  const [playlistResults, setPlaylistResults] = useState<any[]>([]);
  const [searchView, setSearchView] = useState<
    "all" | "artists" | "albums" | "playlists" | "tracks"
  >("all");
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllPlaylists, setShowAllPlaylists] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState({
    artists: [] as any[],
    albums: [] as any[],
    playlists: [] as any[],
    tracks: [] as any[],
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewingLikes, setViewingLikes] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [viewingArtist, setViewingArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [artistTracks, setArtistTracks] = useState<any[]>([]);
  const [viewingTrack, setViewingTrack] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [viewingHomepage, setViewingHomepage] = useState(true);
  const [viewingLibrary, setViewingLibrary] = useState(false);
  const [libraryPlaylists, setLibraryPlaylists] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
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
  const [currentPlaylistId, setCurrentPlaylistId] = useState<number | null>(
    null,
  );
  const [currentPlaylistTitle, setCurrentPlaylistTitle] = useState<
    string | null
  >(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: any;
    source: "playlist" | "search" | "search-related";
    trackList?: any[];
  } | null>(null);
  const [contextPlaylistMenu, setContextPlaylistMenu] = useState<{
    x: number;
    y: number;
    trackId: number | string;
  } | null>(null);
  const [isInSelectedPlaylist, setIsInSelectedPlaylist] = useState(false);
  const [checkingSelectedPlaylist, setCheckingSelectedPlaylist] =
    useState(false);
  const [isFollowingArtist, setIsFollowingArtist] = useState(false);
  const [checkingArtistFollow, setCheckingArtistFollow] = useState(false);
  const [contextFollow, setContextFollow] = useState<{
    userId: number;
    isFollowing: boolean;
    loading: boolean;
  } | null>(null);
  const [sidebarPlaylistMenu, setSidebarPlaylistMenu] = useState<{
    x: number;
    y: number;
    playlist: any;
  } | null>(null);
  const [likedTracks, setLikedTracks] = useState<Record<number, boolean>>({});
  const [likedPlaylists, setLikedPlaylists] = useState<Record<number, boolean>>(
    {},
  );
  const [playerState, setPlayerState] = useState<{
    trackId: number | null;
    isPlaying: boolean;
  }>({ trackId: null, isPlaying: false });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarPlaylistMenuRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const suggestTimeoutRef = useRef<number | null>(null);
  const liveSearchTimeoutRef = useRef<number | null>(null);
  const isHistoryRestoreRef = useRef(false);
  const scrollTriggerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const playlistCacheRef = useRef<{ data: any[]; timestamp: number } | null>(
    null,
  );
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      if (pendingScrollRef.current !== null) return;
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return; // Skip if already queued

      rafId = requestAnimationFrame(() => {
        const maxCollapse = 200;
        const scrollY = window.scrollY;

        // Smooth progressive collapse
        const progress = Math.min(1, Math.max(0, scrollY / maxCollapse));

        document.documentElement.style.setProperty(
          "--scroll-progress",
          String(progress),
        );

        rafId = null;
      });
    };

    if (typeof window !== "undefined") {
      handleScroll();
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setPlayerState({
        trackId: typeof detail.trackId === "number" ? detail.trackId : null,
        isPlaying: Boolean(detail.isPlaying),
      });
    };

    window.addEventListener("player-state", handler as EventListener);
    return () =>
      window.removeEventListener("player-state", handler as EventListener);
  }, []);

  useEffect(() => {
    setPlayerState((prev) => ({
      trackId: currentTrack?.id ?? null,
      isPlaying: prev.trackId === currentTrack?.id ? prev.isPlaying : false,
    }));
  }, [currentTrack?.id]);

  // Fetch playlists with caching
  const fetchPlaylists = useCallback(
    async (forceRefresh = false) => {
      // Check cache first
      if (!forceRefresh && playlistCacheRef.current) {
        const now = Date.now();
        if (now - playlistCacheRef.current.timestamp < CACHE_DURATION) {
          setPlaylists(playlistCacheRef.current.data);
          return;
        }
      }

      try {
        const response = await fetch("/api/playlists");
        const data = await response.json();
        const sorted = (data.playlists || [])
          .sort((a: any, b: any) => (b.modified_at || 0) - (a.modified_at || 0))
          .slice(0, 5);
        setPlaylists(sorted);

        // Update cache
        playlistCacheRef.current = {
          data: sorted,
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error("Failed to fetch playlists:", error);
      }
    },
    [CACHE_DURATION],
  );

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

  const resolvePlaylistItem = (item: any) => {
    if (!item) return null;
    if (item.playlist) return item.playlist;
    return item;
  };

  const handleTrackPageOpen = (track: any, skipHistory = false) => {
    if (!track) return;
    setViewingTrack(true);
    setSelectedTrack(track);
    setViewingHomepage(false);
    setSelectedPlaylist(null);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setViewingLibrary(false);
    setSelectedArtist(null);
    setUserProfile(null);
    scrollToTop();
    if (!skipHistory && track?.id) {
      pushTabState("track", { trackId: track.id });
    }
  };

  const handleInfoClick = (event: ReactMouseEvent, item: any) => {
    event.stopPropagation();
    if (isTrackItem(item)) {
      handleTrackPageOpen(item);
      return;
    }
    const resolved = resolvePlaylistItem(item);
    if (resolved?.id) {
      handlePlaylistClick(resolved);
    }
  };

  const handlePlayerPlaylistClick = (
    playlistId: number | null,
    playlistTitle: string | null,
  ) => {
    if (!playlistId) return;
    handlePlaylistClick({ id: playlistId, title: playlistTitle || "Playlist" });
  };

  // Handle playlist click
  const handlePlaylistClick = async (
    playlist: any,
    skipHistory = false,
    autoPlayFirst = false,
    navigate = true,
  ) => {
    const resolvedPlaylist = resolvePlaylistItem(playlist);
    if (!resolvedPlaylist?.id) {
      return;
    }
    if (navigate) {
      setViewingTrack(false);
      setSelectedTrack(null);
      setSelectedPlaylist(resolvedPlaylist);
      setViewingHomepage(false);
      setViewingLibrary(false);
      setViewingLikes(false);
      setViewingProfile(false);
      setViewingArtist(false);
      setSelectedArtist(null);
      setUserProfile(null);
      setSectionLoading(true);
      setTracks([]);
      setPlaylistTracks([]);
    }
    try {
      const response = await fetch(`/api/playlist/${resolvedPlaylist.id}`);
      const data = await response.json();
      const tracks = data.tracks || [];
      if (navigate) {
        setPlaylistTracks(tracks);
      }
      if (autoPlayFirst && tracks.length > 0) {
        const playlistTitle = resolvedPlaylist?.title || null;
        const enrichedTracks = tracks.map((track: any) => ({
          ...track,
          playlistTitle,
          playlistId: resolvedPlaylist?.id || null,
        }));
        setQueue(enrichedTracks);
        setQueueSource("playlist");
        setCurrentQueueIndex(0);
        setCurrentPlaylistId(resolvedPlaylist?.id || null);
        setCurrentPlaylistTitle(playlistTitle);
        setCurrentTrack(enrichedTracks[0]);
      }
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    } finally {
      if (navigate) {
        setSectionLoading(false);
      }
    }
    if (navigate && !skipHistory) {
      pushTabState("playlist", { playlistId: resolvedPlaylist.id });
    }
  };

  // Handle likes click
  const handleLikesClick = async (skipHistory = false) => {
    setViewingLikes(true);
    setViewingHomepage(false);
    setViewingLibrary(false);
    setSelectedPlaylist(null);
    setViewingTrack(false);
    setSelectedTrack(null);
    setViewingProfile(false);
    setViewingArtist(false);
    setUserProfile(null);
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
    if (!skipHistory) {
      pushTabState("likes");
    }
  };

  const handleLibraryClick = async (skipHistory = false) => {
    setViewingLibrary(true);
    setViewingHomepage(false);
    setSelectedPlaylist(null);
    setViewingLikes(false);
    setViewingTrack(false);
    setSelectedTrack(null);
    setViewingProfile(false);
    setViewingArtist(false);
    setSelectedArtist(null);
    setTracks([]);
    setPlaylistTracks([]);
    setLibraryLoading(true);

    try {
      const [ownedResponse, likedResponse] = await Promise.all([
        fetch("/api/playlists"),
        fetch("/api/likes-playlists"),
      ]);
      const ownedData = await ownedResponse.json();
      const likedData = await likedResponse.json();
      const ownedPlaylists = ownedData.playlists || [];
      const likedPlaylistsList = likedData.playlists || [];
      const normalizedLikedPlaylists = likedPlaylistsList
        .map((item: any) => resolvePlaylistItem(item))
        .filter((item: any) => item?.id);

      const merged = new Map<number, any>();
      for (const playlist of ownedPlaylists) {
        if (playlist?.id) merged.set(playlist.id, playlist);
      }
      for (const playlist of normalizedLikedPlaylists) {
        if (playlist?.id) merged.set(playlist.id, playlist);
      }

      setLibraryPlaylists(Array.from(merged.values()));
      setLikedPlaylists((prev) => {
        const next = { ...prev };
        for (const playlist of normalizedLikedPlaylists) {
          if (playlist?.id) next[playlist.id] = true;
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch library playlists:", error);
      setLibraryPlaylists([]);
    } finally {
      setLibraryLoading(false);
    }

    if (!skipHistory) {
      pushTabState("library");
    }
  };

  // Handle profile click
  const handleProfileClick = async (skipHistory = false) => {
    setViewingProfile(true);
    setViewingHomepage(false);
    setViewingLibrary(false);
    setViewingArtist(false); // <-- Reset artist view
    setSelectedArtist(null); // <-- Clear selected artist
    setSelectedPlaylist(null);
    setViewingTrack(false);
    setSelectedTrack(null);
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
    if (!skipHistory) {
      pushTabState("profile");
    }
  };

  // Handle artist click
  const handleArtistClick = async (
    artist: any,
    skipHistory = false,
    skipScroll = false,
  ) => {
    setViewingArtist(true);
    setViewingHomepage(false);
    setViewingLibrary(false);
    setSelectedPlaylist(null);
    setViewingProfile(false);
    setViewingLikes(false);
    setViewingTrack(false);
    setSelectedTrack(null);
    setTracks([]);
    setSelectedArtist(artist);
    setSectionLoading(true);
    setArtistTracks([]);
    setIsFollowingArtist(false);
    setCheckingArtistFollow(false);
    if (!skipScroll) {
      scrollToTop();
    }

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
    if (!skipHistory) {
      pushTabState("artist", { artistId: artist.id });
    }
  };

  const fetchSearchSuggestions = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setSearchSuggestions({
          artists: [],
          albums: [],
          playlists: [],
          tracks: [],
        });
        return;
      }

      setSuggestLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=6&suggest=1`,
        );
        if (!response.ok) {
          setSuggestLoading(false);
          return;
        }
        const data = await response.json();
        if (trimmed !== query.trim()) {
          setSuggestLoading(false);
          return;
        }
        setSearchSuggestions({
          artists: data.artists || [],
          albums: data.albums || [],
          playlists: data.playlists || [],
          tracks: data.collection || [],
        });
      } catch (error) {
        console.error("Failed to fetch search suggestions:", error);
      } finally {
        setSuggestLoading(false);
      }
    },
    [query],
  );

  // Handle search with pagination
  const handleSearch = async (
    nextPageHref: string | null = null,
    overrideQuery?: string,
    skipHistory = false,
    preserveView = false,
    allowStaleQuery = false,
  ) => {
    const activeQuery = overrideQuery ?? query;
    if (!activeQuery.trim() && !nextPageHref) {
      setTracks([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      if (!preserveView) {
        setSearchView("all");
      }
      setSearchHasMore(false);
      return;
    }

    if (!nextPageHref) {
      setLoading(true);
      setTracks([]);
      setSearchNextHref(null);
      setSearchHasMore(false);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      if (!preserveView) {
        setSearchView("all");
      }
      setShowAllArtists(false);
      setShowAllAlbums(false);
      setShowAllPlaylists(false);
      scrollToTop();
    } else {
      setIsLoadingMore(true);
    }

    setSelectedPlaylist(null);
    setViewingLibrary(false);
    setViewingLikes(false);
    setViewingProfile(false);
    setViewingArtist(false);
    setViewingTrack(false);
    setSelectedTrack(null);
    setSelectedArtist(null);
    setUserProfile(null);
    setViewingHomepage(false);

    try {
      let url = "/api/search";
      if (nextPageHref) {
        url += `?nextHref=${encodeURIComponent(nextPageHref)}`;
      } else {
        url += `?q=${encodeURIComponent(activeQuery)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!nextPageHref && overrideQuery && overrideQuery !== query) {
        if (allowStaleQuery) {
          // allow restoring results on history navigation
        } else {
          return;
        }
      }

      console.log("Search response:", {
        query,
        resultsCount: (data.collection || []).length,
        hasMore: data.hasMore,
      });

      if (!nextPageHref) {
        startTransition(() => {
          setTracks(data.collection || []);
        });
        setArtistResults(data.artists || []);
        setAlbumResults(data.albums || []);
        setPlaylistResults(data.playlists || []);
        scrollToTop();
      } else {
        const newTracks = data.collection || [];
        const existingIds = new Set(tracks.map((t: any) => t.id));
        const uniqueNewTracks = newTracks.filter(
          (t: any) => !existingIds.has(t.id),
        );
        startTransition(() => {
          setTracks((prev) => [...prev, ...uniqueNewTracks]);
        });
      }

      setSearchHasMore(data.hasMore || false);
      setSearchNextHref(data.nextHref || null);
      if (!nextPageHref && !skipHistory) {
        pushTabState("search", { query: activeQuery });
      }
    } catch (error) {
      console.error("Search error:", error);
      setTracks([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      setSearchHasMore(false);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const openSearchSection = (
    view: "artists" | "albums" | "playlists" | "tracks",
  ) => {
    const activeQuery = query.trim();
    if (!activeQuery) return;
    setSearchView(view);
    setViewingHomepage(false);
    pushTabState("search-section", { query: activeQuery, view });
  };

  const isTrackPlaying = (trackId: number) => {
    return playerState.isPlaying && playerState.trackId === trackId;
  };

  const isPlaylistPlaying = (playlistId: number | null | undefined) => {
    if (!playlistId) return false;
    return (
      playerState.isPlaying &&
      (currentPlaylistId === playlistId ||
        currentTrack?.playlistId === playlistId)
    );
  };

  const isItemPlaying = (item: any) => {
    if (!item) return false;
    if (isTrackItem(item)) {
      return isTrackPlaying(item.id);
    }
    const resolved = resolvePlaylistItem(item);
    return isPlaylistPlaying(resolved?.id);
  };

  const togglePlayerPlayPause = () => {
    window.dispatchEvent(new CustomEvent("player-toggle"));
  };

  const handleCardPlayClick = async (
    event: ReactMouseEvent,
    item: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[] = [],
  ) => {
    event.stopPropagation();
    if (isTrackItem(item)) {
      if (currentTrack?.id === item.id) {
        togglePlayerPlayPause();
      } else {
        handleTrackClick(item, source, trackList);
      }
      return;
    }

    if (item?.id || item?.playlist?.id) {
      const resolved = resolvePlaylistItem(item);
      if (isPlaylistPlaying(resolved?.id)) {
        togglePlayerPlayPause();
        return;
      }
      await handlePlaylistClick(item, false, true, false);
    }
  };

  // Handle track click
  const handleTrackClick = (
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[] = [],
  ) => {
    if (source === "playlist") {
      const playlistTitle = selectedPlaylist?.title || null;
      const enrichedTracks = trackList.map((item) => ({
        ...item,
        playlistTitle,
        playlistId: selectedPlaylist?.id || null,
      }));
      const trackIndex = enrichedTracks.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1) {
        setQueue(enrichedTracks);
        setCurrentQueueIndex(trackIndex);
        setCurrentTrack(enrichedTracks[trackIndex]);
      } else {
        setCurrentTrack({
          ...track,
          playlistTitle,
          playlistId: selectedPlaylist?.id || null,
        });
      }
      setQueueSource("playlist");
      if (selectedPlaylist?.id) {
        setCurrentPlaylistId(selectedPlaylist.id);
        setCurrentPlaylistTitle(playlistTitle);
      }
    } else if (source === "search") {
      // Fetch related tracks for the clicked song and set queue to [clickedSong, ...relatedTracks]
      (async () => {
        setCurrentTrack(track);
        setQueueSource("search-related");
        setCurrentPlaylistId(null);
        setCurrentPlaylistTitle(null);
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

  const handleContextMenu = (
    event: ReactMouseEvent,
    item: any,
    source: "playlist" | "search" | "search-related",
    trackList?: any[],
  ) => {
    event.preventDefault();
    const userId = item?.user?.id;
    const isSelf = Boolean(userId && userProfile?.id === userId);
    if (userId && !isSelf) {
      setContextFollow({ userId, isFollowing: false, loading: true });
      checkFollowStatus(userId)
        .then((isFollowing) => {
          setContextFollow((prev) =>
            prev && prev.userId === userId
              ? { ...prev, isFollowing, loading: false }
              : prev,
          );
        })
        .catch(() => {
          setContextFollow((prev) =>
            prev && prev.userId === userId
              ? { ...prev, isFollowing: false, loading: false }
              : prev,
          );
        });
    } else {
      setContextFollow(null);
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
      source,
      trackList,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setContextPlaylistMenu(null);
    setContextFollow(null);
  };

  const closeSidebarPlaylistMenu = () => {
    setSidebarPlaylistMenu(null);
  };

  const checkFollowStatus = useCallback(async (userId: number) => {
    try {
      const response = await fetch(`/api/check-follow?userId=${userId}`);
      if (!response.ok) return false;
      const data = await response.json();
      return Boolean(data?.isFollowing);
    } catch (error) {
      console.error("Failed to check follow status:", error);
      return false;
    }
  }, []);

  const followUser = async (userId: number) => {
    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) return false;
      return true;
    } catch (error) {
      console.error("Failed to follow user:", error);
      return false;
    }
  };

  const unfollowUser = async (userId: number) => {
    try {
      const response = await fetch("/api/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) return false;
      return true;
    } catch (error) {
      console.error("Failed to unfollow user:", error);
      return false;
    }
  };

  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        closeContextMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeContextMenu();
    };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!sidebarPlaylistMenu) return;

    const handleClick = (event: MouseEvent) => {
      if (
        sidebarPlaylistMenuRef.current &&
        !sidebarPlaylistMenuRef.current.contains(event.target as Node)
      ) {
        closeSidebarPlaylistMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebarPlaylistMenu();
    };

    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sidebarPlaylistMenu]);

  useEffect(() => {
    const checkSelectedPlaylist = async () => {
      if (!contextMenu?.item?.id || !currentPlaylistId) {
        setIsInSelectedPlaylist(false);
        return;
      }

      setCheckingSelectedPlaylist(true);
      try {
        const response = await fetch(
          `/api/check-track-in-playlists?trackId=${contextMenu.item.id}&playlistId=${currentPlaylistId}`,
        );
        const data = await response.json();
        const inSelected = (data.playlistsWithTrack || []).some(
          (playlist: any) => playlist.id === currentPlaylistId,
        );
        setIsInSelectedPlaylist(inSelected);
      } catch (error) {
        console.error("Failed to check selected playlist:", error);
        setIsInSelectedPlaylist(false);
      } finally {
        setCheckingSelectedPlaylist(false);
      }
    };

    checkSelectedPlaylist();
  }, [contextMenu?.item?.id, currentPlaylistId]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!viewingArtist || !selectedArtist?.id) {
        setIsFollowingArtist(false);
        setCheckingArtistFollow(false);
        return;
      }

      setCheckingArtistFollow(true);
      const isFollowing = await checkFollowStatus(selectedArtist.id);
      if (!active) return;
      setIsFollowingArtist(isFollowing);
      setCheckingArtistFollow(false);
    };

    run();
    return () => {
      active = false;
    };
  }, [viewingArtist, selectedArtist?.id, checkFollowStatus]);

  const addToQueue = (track: any) => {
    if (!track?.id) return;
    setQueue((prev) => {
      const baseQueue = prev.length
        ? [...prev]
        : currentTrack
          ? [currentTrack]
          : [];

      if (baseQueue.length === 0) return [track];

      const insertIndex =
        currentQueueIndex >= 0
          ? Math.min(currentQueueIndex + 1, baseQueue.length)
          : Math.min(1, baseQueue.length);

      baseQueue.splice(insertIndex, 0, track);
      return baseQueue;
    });
  };

  const addToLikedSongs = async (track: any) => {
    if (!track?.id) return;
    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, like: true }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to like track");
      }
    } catch (error) {
      console.error("Failed to like track:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const checkTrackLikeStatus = async (trackId: number) => {
    try {
      const response = await fetch(`/api/check-like?trackId=${trackId}`);
      const data = await response.json();
      return Boolean(data?.isLiked);
    } catch (error) {
      console.error("Failed to check track like:", error);
      return false;
    }
  };

  const checkPlaylistLikeStatus = async (playlistId: number) => {
    try {
      const response = await fetch(
        `/api/check-like-playlist?playlistId=${playlistId}`,
      );
      const data = await response.json();
      return Boolean(data?.isLiked);
    } catch (error) {
      console.error("Failed to check playlist like:", error);
      return false;
    }
  };

  const toggleTrackLike = async (trackId: number) => {
    if (!trackId) return;
    const nextLiked = !likedTracks[trackId];
    setLikedTracks((prev) => ({ ...prev, [trackId]: nextLiked }));
    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, like: nextLiked }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update track like");
      }
      const isLiked = await checkTrackLikeStatus(trackId);
      setLikedTracks((prev) => ({ ...prev, [trackId]: isLiked }));
    } catch (error) {
      console.error("Failed to toggle track like:", error);
      setLikedTracks((prev) => ({ ...prev, [trackId]: !nextLiked }));
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const togglePlaylistLike = async (playlistId: number) => {
    if (!playlistId) return;
    const nextLiked = !likedPlaylists[playlistId];
    try {
      const response = await fetch("/api/like-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId, like: nextLiked }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update playlist like");
      }
      const isLiked = await checkPlaylistLikeStatus(playlistId);
      setLikedPlaylists((prev) => ({ ...prev, [playlistId]: isLiked }));
    } catch (error) {
      console.error("Failed to toggle playlist like:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  useEffect(() => {
    const trackIds = (tracks || [])
      .map((track: any) => track?.id)
      .filter((id: any) => typeof id === "number");
    const missing = trackIds
      .filter((id: number) => likedTracks[id] === undefined)
      .slice(0, 20);

    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const id of missing) {
        const isLiked = await checkTrackLikeStatus(id);
        if (cancelled) return;
        setLikedTracks((prev) =>
          prev[id] === undefined ? { ...prev, [id]: isLiked } : prev,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tracks, likedTracks]);

  useEffect(() => {
    const playlistIds = [...(albumResults || []), ...(playlistResults || [])]
      .map((item: any) => item?.id)
      .filter((id: any) => typeof id === "number");
    const missing = playlistIds
      .filter((id: number) => likedPlaylists[id] === undefined)
      .slice(0, 20);

    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const id of missing) {
        const isLiked = await checkPlaylistLikeStatus(id);
        if (cancelled) return;
        setLikedPlaylists((prev) =>
          prev[id] === undefined ? { ...prev, [id]: isLiked } : prev,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [albumResults, playlistResults, likedPlaylists]);

  const addToSelectedPlaylist = async (track: any) => {
    if (!track?.id || !currentPlaylistId) return;
    try {
      const response = await fetch("/api/add-to-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: currentPlaylistId,
          trackId: track.id,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add to playlist");
      }
    } catch (error) {
      console.error("Failed to add to playlist:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const removeFromSelectedPlaylist = async (track: any) => {
    if (!track?.id || !currentPlaylistId) return;
    try {
      const response = await fetch("/api/remove-from-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistId: currentPlaylistId,
          trackId: track.id,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove from playlist");
      }
    } catch (error) {
      console.error("Failed to remove from playlist:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const shareItem = async (item: any) => {
    const shareUrl =
      item?.permalink_url ||
      (item?.user?.permalink && item?.permalink
        ? `https://soundcloud.com/${item.user.permalink}/${item.permalink}`
        : "");

    if (!shareUrl) {
      alert("No share URL available for this item");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("Failed to copy link:", error);
      alert("Failed to copy link");
    }
  };

  const isTrackItem = (item: any) => {
    if (!item) return false;
    if (item.kind === "playlist" || item.kind === "playlist-like") {
      return false;
    }
    if (item.kind === "track") return true;
    return typeof item.duration === "number" && !Array.isArray(item.tracks);
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

  const getCardCover = (item: any) => {
    if (!item) return "/placeholder.png";
    if (isTrackItem(item)) {
      return (
        item.artwork_url?.replace("-large", "-t500x500") || "/placeholder.png"
      );
    }
    const resolved = resolvePlaylistItem(item);
    return resolved ? getPlaylistCover(resolved) : "/placeholder.png";
  };

  const getCardCoverStyle = (item: any) => ({
    backgroundImage: `url(${getCardCover(item)})`,
  });

  const findTrackById = (trackId: number | null) => {
    if (!trackId) return null;
    const sources = [
      currentTrack,
      ...tracks,
      ...playlistTracks,
      ...artistTracks,
      ...queue,
    ];
    return sources.find((track: any) => track?.id === trackId) || null;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state = window.history.state || {};
    if (!state.tab) {
      window.history.replaceState(
        { tab: "homepage", scrollY: window.scrollY },
        "",
        "",
      );
    }
  }, []);

  useEffect(() => {
    if (isHistoryRestoreRef.current) {
      isHistoryRestoreRef.current = false;
      return;
    }
    if (suggestTimeoutRef.current) {
      window.clearTimeout(suggestTimeoutRef.current);
    }
    if (liveSearchTimeoutRef.current) {
      window.clearTimeout(liveSearchTimeoutRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchSuggestions({
        artists: [],
        albums: [],
        playlists: [],
        tracks: [],
      });
      setShowSuggestions(false);
      return;
    }

    suggestTimeoutRef.current = window.setTimeout(() => {
      fetchSearchSuggestions(trimmed);
    }, 200);

    liveSearchTimeoutRef.current = window.setTimeout(() => {
      handleSearch(null, trimmed, true);
    }, 450);

    return () => {
      if (suggestTimeoutRef.current) {
        window.clearTimeout(suggestTimeoutRef.current);
      }
      if (liveSearchTimeoutRef.current) {
        window.clearTimeout(liveSearchTimeoutRef.current);
      }
    };
  }, [query, fetchSearchSuggestions]);

  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

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
      viewingArtist ||
      viewingTrack
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
    viewingTrack,
  ]);

  // Popstate handler for browser back/forward
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state || {};
      pendingScrollRef.current =
        typeof state.scrollY === "number" ? state.scrollY : 0;
      switch (state.tab) {
        case "homepage":
          setViewingHomepage(true);
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          setSelectedArtist(null);
          setUserProfile(null);
          break;
        case "profile":
          setViewingHomepage(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          handleProfileClick(true);
          break;
        case "library":
          setViewingHomepage(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          handleLibraryClick(true);
          break;
        case "likes":
          setViewingHomepage(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          handleLikesClick(true);
          break;
        case "playlist":
          setViewingHomepage(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          if (state.playlistId) {
            const playlist = playlists.find((p) => p.id === state.playlistId);
            if (playlist) handlePlaylistClick(playlist, true);
          }
          break;
        case "artist":
          setViewingHomepage(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          if (state.artistId) {
            handleArtistClick({ id: state.artistId }, true, true);
          }
          break;
        case "track":
          {
            const restoredTrackId = state.trackId || null;
            setViewingHomepage(false);
            setSelectedPlaylist(null);
            setViewingLikes(false);
            setViewingProfile(false);
            setViewingArtist(false);
            setViewingLibrary(false);
            setSelectedArtist(null);
            setUserProfile(null);
            setViewingTrack(true);
            setSelectedTrack(
              findTrackById(restoredTrackId) ||
                (restoredTrackId ? { id: restoredTrackId } : null),
            );
          }
          break;
        case "search":
          {
            const restoredQuery = state.query || "";
            isHistoryRestoreRef.current = true;
            setViewingHomepage(false);
            setSelectedPlaylist(null);
            setViewingLikes(false);
            setViewingProfile(false);
            setViewingArtist(false);
            setViewingTrack(false);
            setSelectedTrack(null);
            setSelectedArtist(null);
            setUserProfile(null);
            setSearchView("all");
            setQuery(restoredQuery);
            if (restoredQuery) {
              handleSearch(null, restoredQuery, true, false, true);
            }
          }
          break;
        case "search-section":
          {
            const restoredQuery = state.query || "";
            const restoredView = state.view || "all";
            isHistoryRestoreRef.current = true;
            setViewingHomepage(false);
            setSelectedPlaylist(null);
            setViewingLikes(false);
            setViewingProfile(false);
            setViewingArtist(false);
            setViewingTrack(false);
            setSelectedTrack(null);
            setSelectedArtist(null);
            setUserProfile(null);
            setSearchView(restoredView);
            setQuery(restoredQuery);
            if (restoredQuery) {
              handleSearch(null, restoredQuery, true, true, true);
            }
          }
          break;
        default:
          setViewingHomepage(true);
          setSelectedPlaylist(null);
          setViewingLikes(false);
          setViewingProfile(false);
          setViewingArtist(false);
          setViewingTrack(false);
          setSelectedTrack(null);
          setSelectedArtist(null);
          setUserProfile(null);
          break;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [playlists]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const state = window.history.state || {};
        if (!state.tab) return;
        window.history.replaceState(
          { ...state, scrollY: window.scrollY },
          "",
          "",
        );
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (pendingScrollRef.current === null || typeof window === "undefined") {
      return;
    }
    if (sectionLoading || loading || libraryLoading || isLoadingMore) {
      return;
    }
    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: target || 0, behavior: "auto" });
    });
  }, [
    sectionLoading,
    loading,
    libraryLoading,
    isLoadingMore,
    viewingHomepage,
    viewingLikes,
    viewingProfile,
    viewingArtist,
    viewingLibrary,
    viewingTrack,
    selectedPlaylist,
    searchView,
  ]);

  const pushTabState = (tab: string, data: Record<string, any> = {}) => {
    window.history.pushState({ tab, scrollY: 0, ...data }, "", "");
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
  const visibleArtists = showAllArtists
    ? artistResults
    : artistResults.slice(0, 8);
  const visibleAlbums = showAllAlbums ? albumResults : albumResults.slice(0, 8);
  const visiblePlaylists = showAllPlaylists
    ? playlistResults
    : playlistResults.slice(0, 8);

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
              setUserProfile(null);
              pushTabState("homepage");
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/50/home.png"
              alt="Home"
              className="nav-icon-img"
              loading="lazy"
              decoding="async"
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
              loading="lazy"
              decoding="async"
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
              handleLibraryClick();
            }}
          >
            <img
              src="https://img.icons8.com/parakeet-line/48/book.png"
              alt="My Library"
              className="nav-icon-img"
              loading="lazy"
              decoding="async"
            />
            {sidebarExpanded && <span className="nav-label">My Library</span>}
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
              loading="lazy"
              decoding="async"
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSidebarPlaylistMenu({
                      x: event.clientX,
                      y: event.clientY,
                      playlist,
                    });
                  }}
                >
                  <div
                    className={`playlist-thumb-wrap ${
                      isPlaylistPlaying(playlist.id) ? "playing" : ""
                    }`}
                  >
                    <img
                      src={getPlaylistCover(playlist)}
                      alt={playlist.title}
                      className="playlist-thumb"
                      loading="lazy"
                      decoding="async"
                    />
                    <button
                      type="button"
                      className={`sidebar-play-btn ${
                        isPlaylistPlaying(playlist.id) ? "pause" : "play"
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCardPlayClick(event, playlist, "search");
                      }}
                      aria-label={
                        isPlaylistPlaying(playlist.id)
                          ? `Pause ${playlist.title}`
                          : `Play ${playlist.title}`
                      }
                    >
                      {isPlaylistPlaying(playlist.id) ? (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {sidebarExpanded && (
                    <div
                      className="playlist-title-sidebar"
                      onClick={() => {
                        setViewingHomepage(false);
                        handlePlaylistClick(playlist);
                      }}
                    >
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
        <div className="search-box" ref={searchBoxRef}>
          <div className="search-input-wrap">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for songs..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                  handleSearch();
                }
              }}
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                className="search-clear-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setShowSuggestions(false);
                  handleSearch(null, "", true);
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button
            className="search-submit-btn"
            onClick={() => {
              setShowSuggestions(false);
              handleSearch();
            }}
            disabled={loading}
          >
            {loading ? "..." : "Search"}
          </button>
          {showSuggestions && query.trim().length > 0 && (
            <div className="search-suggestions">
              {suggestLoading && (
                <div className="search-suggestions-loading">Searching...</div>
              )}

              {!suggestLoading &&
                searchSuggestions.artists.length === 0 &&
                searchSuggestions.albums.length === 0 &&
                searchSuggestions.playlists.length === 0 &&
                searchSuggestions.tracks.length === 0 && (
                  <div className="search-suggestions-empty">No results yet</div>
                )}

              {searchSuggestions.artists.length > 0 && (
                <div className="search-suggestions-section">
                  <div className="search-suggestions-title">Profiles</div>
                  {searchSuggestions.artists.map((artist: any) => (
                    <div
                      key={`artist-${artist.id}`}
                      className="search-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowSuggestions(false);
                        handleArtistClick(artist);
                      }}
                    >
                      <img
                        src={
                          artist.avatar_url?.replace("-large", "-t200x200") ||
                          "/placeholder.png"
                        }
                        alt={artist.username}
                        className="search-suggestion-avatar"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="search-suggestion-text">
                        <div className="search-suggestion-name">
                          {artist.username}
                        </div>
                        <div className="search-suggestion-subtitle">
                          {artist.followers_count || 0} followers
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchSuggestions.albums.length > 0 && (
                <div className="search-suggestions-section">
                  <div className="search-suggestions-title">Albums</div>
                  {searchSuggestions.albums.map((album: any) => (
                    <div
                      key={`album-${album.id}`}
                      className="search-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowSuggestions(false);
                        handlePlaylistClick(album);
                      }}
                    >
                      <img
                        src={
                          album.artwork_url?.replace("-large", "-t200x200") ||
                          "/placeholder.png"
                        }
                        alt={album.title}
                        className="search-suggestion-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="search-suggestion-text">
                        <div className="search-suggestion-name">
                          {album.title}
                        </div>
                        <div className="search-suggestion-subtitle">
                          {album.user?.username || "Unknown"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchSuggestions.playlists.length > 0 && (
                <div className="search-suggestions-section">
                  <div className="search-suggestions-title">Playlists</div>
                  {searchSuggestions.playlists.map((playlist: any) => (
                    <div
                      key={`playlist-${playlist.id}`}
                      className="search-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowSuggestions(false);
                        handlePlaylistClick(playlist);
                      }}
                    >
                      <img
                        src={getPlaylistCover(playlist)}
                        alt={playlist.title}
                        className="search-suggestion-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="search-suggestion-text">
                        <div className="search-suggestion-name">
                          {playlist.title}
                        </div>
                        <div className="search-suggestion-subtitle">
                          {playlist.user?.username || "Unknown"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchSuggestions.tracks.length > 0 && (
                <div className="search-suggestions-section">
                  <div className="search-suggestions-title">Tracks</div>
                  {searchSuggestions.tracks.map((track: any) => (
                    <div
                      key={`track-${track.id}`}
                      className="search-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowSuggestions(false);
                        handleTrackClick(track, "search", [track]);
                      }}
                    >
                      <img
                        src={
                          track.artwork_url?.replace("-large", "-t200x200") ||
                          "/placeholder.png"
                        }
                        alt={track.title}
                        className="search-suggestion-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="search-suggestion-text">
                        <div className="search-suggestion-name">
                          {track.title}
                        </div>
                        <div className="search-suggestion-subtitle">
                          {track.user?.username || "Unknown"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="main-area">
        {viewingHomepage ? (
          <HomePage
            onTrackClick={handleTrackClick}
            onTrackContextMenu={handleContextMenu}
            onCardPlayClick={handleCardPlayClick}
            onInfoClick={handleInfoClick}
            isTrackPlaying={isTrackPlaying}
            isItemPlaying={isItemPlaying}
            onPlaylistClick={handlePlaylistClick}
            currentTrack={currentTrack}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onTrackEnd={handleNext}
          />
        ) : viewingTrack ? (
          <div className="track-view">
            <div className="playlist-header-sticky">
              <img
                src={
                  selectedTrack?.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={selectedTrack?.title || "Track"}
                className="playlist-header-cover"
                loading="eager"
                decoding="async"
              />
              <div className="track-page-text">
                <h2 className="playlist-header-title">
                  {selectedTrack?.title || "Track"}
                </h2>
                <div
                  className="track-page-artist"
                  onClick={() =>
                    selectedTrack?.user && handleArtistClick(selectedTrack.user)
                  }
                >
                  {selectedTrack?.user?.username || "Unknown"}
                </div>
              </div>
            </div>
            <div className="track-page-placeholder">
              Track page coming soon.
            </div>
          </div>
        ) : selectedPlaylist ||
          viewingLikes ||
          viewingProfile ||
          viewingArtist ||
          viewingLibrary ? (
          <div className="playlist-view">
            {sectionLoading ? (
              <div className="playlist-loading">Loading...</div>
            ) : (
              <>
                {viewingLibrary ? (
                  <>
                    <div className="playlist-header-sticky">
                      <h2 className="playlist-header-title">My Library</h2>
                    </div>
                    {libraryLoading ? (
                      <div className="playlist-loading">Loading...</div>
                    ) : (
                      <div className="library-grid">
                        {libraryPlaylists.map((playlist: any) => (
                          <div
                            key={`library-${playlist.id}`}
                            className="track-card"
                            onClick={() => handlePlaylistClick(playlist)}
                            onContextMenu={(event) =>
                              handleContextMenu(event, playlist, "search")
                            }
                          >
                            <button
                              type="button"
                              className={`card-play-btn ${
                                isPlaylistPlaying(playlist.id)
                                  ? "pause"
                                  : "play"
                              }`}
                              style={getCardCoverStyle(playlist)}
                              onClick={(event) =>
                                handleCardPlayClick(event, playlist, "search")
                              }
                              aria-label={
                                isPlaylistPlaying(playlist.id)
                                  ? "Pause"
                                  : "Play"
                              }
                            >
                              {isPlaylistPlaying(playlist.id) ? (
                                <svg
                                  width="40"
                                  height="40"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <rect x="6" y="4" width="4" height="16" />
                                  <rect x="14" y="4" width="4" height="16" />
                                </svg>
                              ) : (
                                <svg
                                  width="40"
                                  height="40"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              )}
                            </button>
                            <img
                              src={getPlaylistCover(playlist)}
                              alt={playlist.title}
                              className="track-cover"
                              loading="lazy"
                              decoding="async"
                            />
                            <div
                              className="track-info clickable"
                              onClick={(event) =>
                                handleInfoClick(event, playlist)
                              }
                            >
                              <div className="track-title">
                                {playlist.title}
                              </div>
                              <div
                                className="track-artist clickable"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleArtistClick(playlist.user);
                                }}
                              >
                                {playlist.user?.username || "Unknown"}
                              </div>
                              {playlist.user?.id &&
                                userProfile?.id &&
                                playlist.user.id !== userProfile.id && (
                                  <button
                                    type="button"
                                    className={`track-like-btn ${
                                      likedPlaylists[playlist.id] ? "liked" : ""
                                    }`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      togglePlaylistLike(playlist.id);
                                    }}
                                    aria-label={
                                      likedPlaylists[playlist.id]
                                        ? "Remove like"
                                        : "Add like"
                                    }
                                  >
                                    {likedPlaylists[playlist.id] ? "♥" : "♡"}
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : viewingProfile || viewingArtist ? (
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
                    <div className="profile-header-left">
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
                        loading="eager"
                        decoding="async"
                      />
                      <div className="profile-header-text">
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
                        {viewingArtist && selectedArtist?.id && (
                          <button
                            className={`follow-btn ${isFollowingArtist ? "following" : ""}`}
                            onClick={async () => {
                              if (checkingArtistFollow) return;
                              setCheckingArtistFollow(true);
                              const success = isFollowingArtist
                                ? await unfollowUser(selectedArtist.id)
                                : await followUser(selectedArtist.id);
                              if (success) {
                                setIsFollowingArtist(!isFollowingArtist);
                              }
                              setCheckingArtistFollow(false);
                            }}
                            disabled={checkingArtistFollow}
                          >
                            {isFollowingArtist ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="profile-header-right">
                      <div className="profile-header-stats">
                        <div className="profile-stat">
                          <div className="profile-stat-value">
                            {viewingProfile
                              ? userProfile?.followers_count
                              : selectedArtist?.followers_count}
                          </div>
                          <div className="profile-stat-label">Followers</div>
                        </div>
                        <div className="profile-stat">
                          <div className="profile-stat-value">
                            {viewingProfile
                              ? userProfile?.followings_count
                              : selectedArtist?.followings_count}
                          </div>
                          <div className="profile-stat-label">Following</div>
                        </div>
                        <div className="profile-stat">
                          <div className="profile-stat-value">
                            {viewingProfile
                              ? userProfile?.track_count
                              : selectedArtist?.track_count}
                          </div>
                          <div className="profile-stat-label">Tracks</div>
                        </div>
                      </div>
                      <div className="profile-header-bio">
                        {(viewingProfile
                          ? userProfile?.description
                          : selectedArtist?.description) && (
                          <p className="profile-bio">
                            {viewingProfile
                              ? userProfile?.description
                              : selectedArtist?.description}
                          </p>
                        )}
                        <div className="profile-links">
                          {(viewingProfile
                            ? userProfile?.links
                            : selectedArtist?.links
                          )?.map((link: any, index: number) => (
                            <a
                              key={`${link.url}-${index}`}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="profile-link"
                            >
                              <img
                                src={`https://img.icons8.com/ios-glyphs/30/ffffff/${(link.service || "link").toLowerCase()}.png`}
                                alt={link.service || "link"}
                                className="profile-link-icon"
                              />
                              <span>
                                {link.title || link.service || "Link"}
                              </span>
                            </a>
                          ))}
                          {(viewingProfile
                            ? userProfile?.website
                            : selectedArtist?.website) && (
                            <a
                              href={
                                viewingProfile
                                  ? userProfile?.website
                                  : selectedArtist?.website
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="profile-link"
                            >
                              <img
                                src="https://img.icons8.com/ios-glyphs/30/ffffff/link.png"
                                alt="Website"
                                className="profile-link-icon"
                              />
                              <span>
                                {viewingProfile
                                  ? userProfile?.website_title || "Website"
                                  : selectedArtist?.website_title || "Website"}
                              </span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="playlist-header-sticky">
                    <img
                      src={displayCover}
                      alt={displayTitle}
                      className="playlist-header-cover"
                      loading="eager"
                      decoding="async"
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
                      onContextMenu={(event) =>
                        handleContextMenu(
                          event,
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
                        loading="lazy"
                        decoding="async"
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
          <div className="search-results-container">
            {searchView === "artists" ? (
              <section className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Profiles</h3>
                </div>
                <div className="search-profiles-grid">
                  {artistResults.map((artist: any) => (
                    <div
                      key={`artist-${artist.id}`}
                      className="track-card search-profile-card"
                      onClick={() => handleArtistClick(artist)}
                      onContextMenu={(event) =>
                        handleContextMenu(event, artist, "search")
                      }
                    >
                      <img
                        src={
                          artist.avatar_url?.replace("-large", "-t500x500") ||
                          "/placeholder.png"
                        }
                        alt={artist.username}
                        className="search-profile-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="track-info">
                        <div className="track-title">{artist.username}</div>
                        <div className="track-artist">
                          {artist.followers_count || 0} followers
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : searchView === "albums" ? (
              <section className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Albums</h3>
                </div>
                <div className="search-albums-grid">
                  {albumResults.map((album: any) => (
                    <div
                      key={`album-${album.id}`}
                      className="track-card"
                      onClick={() => handlePlaylistClick(album)}
                      onContextMenu={(event) =>
                        handleContextMenu(event, album, "search")
                      }
                    >
                      <button
                        type="button"
                        className={`card-play-btn ${
                          isPlaylistPlaying(album.id) ? "pause" : "play"
                        }`}
                        style={getCardCoverStyle(album)}
                        onClick={(event) =>
                          handleCardPlayClick(event, album, "search")
                        }
                        aria-label={
                          isPlaylistPlaying(album.id) ? "Pause" : "Play"
                        }
                      >
                        {isPlaylistPlaying(album.id) ? (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        )}
                      </button>
                      <img
                        src={
                          album.artwork_url?.replace("-large", "-t500x500") ||
                          "/placeholder.png"
                        }
                        alt={album.title}
                        className="track-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div
                        className="track-info clickable"
                        onClick={(event) => handleInfoClick(event, album)}
                      >
                        <div className="track-title">{album.title}</div>
                        <div
                          className="track-artist clickable"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleArtistClick(album.user);
                          }}
                        >
                          {album.user?.username || "Unknown"}
                        </div>
                        <button
                          type="button"
                          className={`track-like-btn ${
                            likedPlaylists[album.id] ? "liked" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePlaylistLike(album.id);
                          }}
                          aria-label={
                            likedPlaylists[album.id]
                              ? "Remove like"
                              : "Add like"
                          }
                        >
                          {likedPlaylists[album.id] ? "♥" : "♡"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : searchView === "playlists" ? (
              <section className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Playlists</h3>
                </div>
                <div className="search-playlists-grid">
                  {playlistResults.map((playlist: any) => (
                    <div
                      key={`playlist-${playlist.id}`}
                      className="track-card"
                      onClick={() => handlePlaylistClick(playlist)}
                      onContextMenu={(event) =>
                        handleContextMenu(event, playlist, "search")
                      }
                    >
                      <button
                        type="button"
                        className={`card-play-btn ${
                          isPlaylistPlaying(playlist.id) ? "pause" : "play"
                        }`}
                        style={getCardCoverStyle(playlist)}
                        onClick={(event) =>
                          handleCardPlayClick(event, playlist, "search")
                        }
                        aria-label={
                          isPlaylistPlaying(playlist.id) ? "Pause" : "Play"
                        }
                      >
                        {isPlaylistPlaying(playlist.id) ? (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        )}
                      </button>
                      <img
                        src={getPlaylistCover(playlist)}
                        alt={playlist.title}
                        className="track-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div
                        className="track-info clickable"
                        onClick={(event) => handleInfoClick(event, playlist)}
                      >
                        <div className="track-title">{playlist.title}</div>
                        <div
                          className="track-artist clickable"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleArtistClick(playlist.user);
                          }}
                        >
                          {playlist.user?.username || "Unknown"}
                        </div>
                        <button
                          type="button"
                          className={`track-like-btn ${
                            likedPlaylists[playlist.id] ? "liked" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePlaylistLike(playlist.id);
                          }}
                          aria-label={
                            likedPlaylists[playlist.id]
                              ? "Remove like"
                              : "Add like"
                          }
                        >
                          {likedPlaylists[playlist.id] ? "♥" : "♡"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : searchView === "tracks" ? (
              <section className="search-section">
                <div className="search-section-header">
                  <h3 className="search-section-title">Tracks</h3>
                </div>
                <div className="search-tracks-grid">
                  {tracks.map((t: any) => (
                    <div
                      key={t.id}
                      className="track-card search-track-card"
                      onClick={() => handleTrackClick(t, "search", tracks)}
                      onContextMenu={(event) =>
                        handleContextMenu(event, t, "search", tracks)
                      }
                    >
                      <button
                        type="button"
                        className={`card-play-btn ${
                          isTrackPlaying(t.id) ? "pause" : "play"
                        }`}
                        style={getCardCoverStyle(t)}
                        onClick={(event) =>
                          handleCardPlayClick(event, t, "search", tracks)
                        }
                        aria-label={isTrackPlaying(t.id) ? "Pause" : "Play"}
                      >
                        {isTrackPlaying(t.id) ? (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        ) : (
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        )}
                      </button>
                      <img
                        src={
                          t.artwork_url?.replace("-large", "-t500x500") ||
                          "/placeholder.png"
                        }
                        alt={t.title}
                        className="track-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div
                        className="track-info clickable"
                        onClick={(event) => handleInfoClick(event, t)}
                      >
                        <div className="track-title">{t.title}</div>
                        <div
                          className="track-artist clickable"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArtistClick(t.user);
                          }}
                          style={{
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {t.user?.username || "Unknown"}
                        </div>
                        <button
                          type="button"
                          className={`track-like-btn ${
                            likedTracks[t.id] ? "liked" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTrackLike(t.id);
                          }}
                          aria-label={
                            likedTracks[t.id] ? "Remove like" : "Add like"
                          }
                        >
                          {likedTracks[t.id] ? "♥" : "♡"}
                        </button>
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
              </section>
            ) : (
              <>
                {artistResults.length > 0 && (
                  <section className="search-section">
                    <div className="search-section-header">
                      <h3 className="search-section-title">Profiles</h3>
                      {artistResults.length > 8 && (
                        <button
                          className="search-view-more"
                          onClick={() => openSearchSection("artists")}
                        >
                          View more
                        </button>
                      )}
                    </div>
                    <div className="horizontal-scroll drag-scroll">
                      {visibleArtists.map((artist: any) => (
                        <div
                          key={`artist-${artist.id}`}
                          className="track-card search-profile-card"
                          onClick={() => handleArtistClick(artist)}
                          onContextMenu={(event) =>
                            handleContextMenu(event, artist, "search")
                          }
                        >
                          <img
                            src={
                              artist.avatar_url?.replace(
                                "-large",
                                "-t500x500",
                              ) || "/placeholder.png"
                            }
                            alt={artist.username}
                            className="search-profile-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="track-info">
                            <div className="track-title">{artist.username}</div>
                            <div className="track-artist">
                              {artist.followers_count || 0} followers
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {albumResults.length > 0 && (
                  <section className="search-section">
                    <div className="search-section-header">
                      <h3 className="search-section-title">Albums</h3>
                      {albumResults.length > 8 && (
                        <button
                          className="search-view-more"
                          onClick={() => openSearchSection("albums")}
                        >
                          View more
                        </button>
                      )}
                    </div>
                    <div className="horizontal-scroll drag-scroll">
                      {visibleAlbums.map((album: any) => (
                        <div
                          key={`album-${album.id}`}
                          className="track-card"
                          onClick={() => handlePlaylistClick(album)}
                          onContextMenu={(event) =>
                            handleContextMenu(event, album, "search")
                          }
                        >
                          <button
                            type="button"
                            className={`card-play-btn ${
                              isPlaylistPlaying(album.id) ? "pause" : "play"
                            }`}
                            style={getCardCoverStyle(album)}
                            onClick={(event) =>
                              handleCardPlayClick(event, album, "search")
                            }
                            aria-label={
                              isPlaylistPlaying(album.id) ? "Pause" : "Play"
                            }
                          >
                            {isPlaylistPlaying(album.id) ? (
                              <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                              </svg>
                            ) : (
                              <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            )}
                          </button>
                          <img
                            src={
                              album.artwork_url?.replace(
                                "-large",
                                "-t500x500",
                              ) || "/placeholder.png"
                            }
                            alt={album.title}
                            className="track-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div
                            className="track-info clickable"
                            onClick={(event) => handleInfoClick(event, album)}
                          >
                            <div className="track-title">{album.title}</div>
                            <div
                              className="track-artist clickable"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleArtistClick(album.user);
                              }}
                            >
                              {album.user?.username || "Unknown"}
                            </div>
                            <button
                              type="button"
                              className={`track-like-btn ${
                                likedPlaylists[album.id] ? "liked" : ""
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePlaylistLike(album.id);
                              }}
                              aria-label={
                                likedPlaylists[album.id]
                                  ? "Remove like"
                                  : "Add like"
                              }
                            >
                              {likedPlaylists[album.id] ? "♥" : "♡"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {playlistResults.length > 0 && (
                  <section className="search-section">
                    <div className="search-section-header">
                      <h3 className="search-section-title">Playlists</h3>
                      {playlistResults.length > 8 && (
                        <button
                          className="search-view-more"
                          onClick={() => openSearchSection("playlists")}
                        >
                          View more
                        </button>
                      )}
                    </div>
                    <div className="horizontal-scroll drag-scroll">
                      {visiblePlaylists.map((playlist: any) => (
                        <div
                          key={`playlist-${playlist.id}`}
                          className="track-card"
                          onClick={() => handlePlaylistClick(playlist)}
                          onContextMenu={(event) =>
                            handleContextMenu(event, playlist, "search")
                          }
                        >
                          <button
                            type="button"
                            className={`card-play-btn ${
                              isPlaylistPlaying(playlist.id) ? "pause" : "play"
                            }`}
                            style={getCardCoverStyle(playlist)}
                            onClick={(event) =>
                              handleCardPlayClick(event, playlist, "search")
                            }
                            aria-label={
                              isPlaylistPlaying(playlist.id) ? "Pause" : "Play"
                            }
                          >
                            {isPlaylistPlaying(playlist.id) ? (
                              <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                              </svg>
                            ) : (
                              <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            )}
                          </button>
                          <img
                            src={getPlaylistCover(playlist)}
                            alt={playlist.title}
                            className="track-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div
                            className="track-info clickable"
                            onClick={(event) =>
                              handleInfoClick(event, playlist)
                            }
                          >
                            <div className="track-title">{playlist.title}</div>
                            <div
                              className="track-artist clickable"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleArtistClick(playlist.user);
                              }}
                            >
                              {playlist.user?.username || "Unknown"}
                            </div>
                            <button
                              type="button"
                              className={`track-like-btn ${
                                likedPlaylists[playlist.id] ? "liked" : ""
                              }`}
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePlaylistLike(playlist.id);
                              }}
                              aria-label={
                                likedPlaylists[playlist.id]
                                  ? "Remove like"
                                  : "Add like"
                              }
                            >
                              {likedPlaylists[playlist.id] ? "♥" : "♡"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="search-section">
                  <div className="search-section-header">
                    <h3 className="search-section-title">Tracks</h3>
                  </div>
                  <div className="search-tracks-grid">
                    {tracks.map((t: any) => (
                      <div
                        key={t.id}
                        className="track-card search-track-card"
                        onClick={() => handleTrackClick(t, "search", tracks)}
                        onContextMenu={(event) =>
                          handleContextMenu(event, t, "search", tracks)
                        }
                      >
                        <button
                          type="button"
                          className={`card-play-btn ${
                            isTrackPlaying(t.id) ? "pause" : "play"
                          }`}
                          style={getCardCoverStyle(t)}
                          onClick={(event) =>
                            handleCardPlayClick(event, t, "search", tracks)
                          }
                          aria-label={isTrackPlaying(t.id) ? "Pause" : "Play"}
                        >
                          {isTrackPlaying(t.id) ? (
                            <svg
                              width="40"
                              height="40"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg
                              width="40"
                              height="40"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                        </button>
                        <img
                          src={
                            t.artwork_url?.replace("-large", "-t500x500") ||
                            "/placeholder.png"
                          }
                          alt={t.title}
                          className="track-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div
                          className="track-info clickable"
                          onClick={(event) => handleInfoClick(event, t)}
                        >
                          <div className="track-title">{t.title}</div>
                          <div
                            className="track-artist clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArtistClick(t.user);
                            }}
                          >
                            {t.user?.username || "Unknown"}
                          </div>
                          <button
                            type="button"
                            className={`track-like-btn ${
                              likedTracks[t.id] ? "liked" : ""
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleTrackLike(t.id);
                            }}
                            aria-label={
                              likedTracks[t.id] ? "Remove like" : "Add like"
                            }
                          >
                            {likedTracks[t.id] ? "♥" : "♡"}
                          </button>
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
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {sidebarPlaylistMenu && (
        <div
          ref={sidebarPlaylistMenuRef}
          className="context-menu"
          style={{ top: sidebarPlaylistMenu.y, left: sidebarPlaylistMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              setViewingHomepage(false);
              handlePlaylistClick(sidebarPlaylistMenu.playlist);
              closeSidebarPlaylistMenu();
            }}
          >
            Go to playlist
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {isTrackItem(contextMenu.item) && (
            <button
              className="context-menu-item"
              onClick={() => {
                addToLikedSongs(contextMenu.item);
                closeContextMenu();
              }}
            >
              Add to liked songs
            </button>
          )}

          {isTrackItem(contextMenu.item) && (
            <button
              className="context-menu-item"
              onClick={() => {
                addToQueue(contextMenu.item);
                closeContextMenu();
              }}
            >
              Add to queue
            </button>
          )}

          {contextFollow && (
            <button
              className="context-menu-item"
              onClick={async () => {
                if (contextFollow.loading) return;
                setContextFollow((prev) =>
                  prev ? { ...prev, loading: true } : prev,
                );
                const success = contextFollow.isFollowing
                  ? await unfollowUser(contextFollow.userId)
                  : await followUser(contextFollow.userId);
                if (success) {
                  setContextFollow((prev) =>
                    prev
                      ? {
                          ...prev,
                          isFollowing: !prev.isFollowing,
                          loading: false,
                        }
                      : prev,
                  );
                } else {
                  setContextFollow((prev) =>
                    prev ? { ...prev, loading: false } : prev,
                  );
                }
                closeContextMenu();
              }}
              disabled={contextFollow.loading}
            >
              {contextFollow.isFollowing ? "Unfollow artist" : "Follow artist"}
            </button>
          )}

          {isTrackItem(contextMenu.item) && (
            <button
              className="context-menu-item"
              onClick={() => {
                if (currentPlaylistId) {
                  if (isInSelectedPlaylist) {
                    removeFromSelectedPlaylist(contextMenu.item);
                  } else {
                    addToSelectedPlaylist(contextMenu.item);
                  }
                  closeContextMenu();
                } else {
                  setContextMenu(null);
                  setContextPlaylistMenu({
                    x: contextMenu.x,
                    y: contextMenu.y,
                    trackId: contextMenu.item.id,
                  });
                }
              }}
              disabled={checkingSelectedPlaylist}
            >
              {currentPlaylistId
                ? isInSelectedPlaylist
                  ? `Remove from ${currentPlaylistTitle || "current playlist"}`
                  : `Add to ${currentPlaylistTitle || "current playlist"}`
                : "Add to playlist..."}
            </button>
          )}

          {currentPlaylistId && (
            <>
              <div className="context-menu-separator"></div>
              <div className="context-menu-label">Add to playlist</div>
              <button
                className="context-menu-item"
                onClick={() => {
                  setContextMenu(null);
                  setContextPlaylistMenu({
                    x: contextMenu.x,
                    y: contextMenu.y,
                    trackId: contextMenu.item.id,
                  });
                }}
              >
                Choose another playlist...
              </button>
            </>
          )}

          <button
            className="context-menu-item"
            onClick={() => {
              shareItem(contextMenu.item);
              closeContextMenu();
            }}
          >
            Share
          </button>
        </div>
      )}

      {contextPlaylistMenu && (
        <div
          className="context-playlist-menu"
          style={{ top: contextPlaylistMenu.y, left: contextPlaylistMenu.x }}
        >
          <PlaylistMenu
            trackId={contextPlaylistMenu.trackId}
            isOpen={true}
            onClose={() => setContextPlaylistMenu(null)}
          />
        </div>
      )}

      <Player
        currentTrack={currentTrack}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTrackEnd={handleNext}
        onArtistClick={handleArtistClick}
        onPlaylistClick={handlePlayerPlaylistClick}
        isShuffle={isShuffle}
        onShuffleChange={setIsShuffle}
      />
    </div>
  );
}
