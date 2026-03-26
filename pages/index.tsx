import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  startTransition,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/router";
import Player from "../src/components/Player";
import PlaylistMenu from "../src/components/PlaylistMenu";
import MobilePlaylistSheet from "../src/components/MobilePlaylistSheet";
import TrackDetailView from "../src/components/TrackDetailView";
import Toast from "../src/components/Toast";
import dynamic from "next/dynamic";
import GirlfriendLogin from "./girlfriend";

const HomePage = dynamic(() => import("./homepage"), { ssr: false });

export default function Home() {
  const router = useRouter();
  const renderHeartIcon = (filled: boolean) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 21s-6.7-4.35-9.2-8.02C.87 10.15 1.16 6.5 4.3 4.6c2.19-1.32 4.94-.66 6.7 1.1 1.76-1.76 4.51-2.42 6.7-1.1 3.15 1.9 3.43 5.55 1.5 8.38C18.7 16.65 12 21 12 21z" />
    </svg>
  );
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
  const [playlistTrackQuery, setPlaylistTrackQuery] = useState("");
  const [profileTracksExpanded, setProfileTracksExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [viewingLikes, setViewingLikes] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profilePlaylists, setProfilePlaylists] = useState<any[]>([]);
  const [profileAlbums, setProfileAlbums] = useState<any[]>([]);
  const [profileReposts, setProfileReposts] = useState<any[]>([]);
  const [listeningHistory, setListeningHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [viewingArtist, setViewingArtist] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [artistTracks, setArtistTracks] = useState<any[]>([]);
  const [artistPlaylists, setArtistPlaylists] = useState<any[]>([]);
  const [artistAlbums, setArtistAlbums] = useState<any[]>([]);
  const [artistReposts, setArtistReposts] = useState<any[]>([]);
  const [viewingTrack, setViewingTrack] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackPanelMinimized, setTrackPanelMinimized] = useState(false);
  const [trackPanelState, setTrackPanelState] = useState<
    "open" | "opening" | "minimizing" | "minimized" | "closing"
  >("open");
  const [viewingHomepage, setViewingHomepage] = useState(true);
  const [viewingLibrary, setViewingLibrary] = useState(false);
  const [libraryPlaylists, setLibraryPlaylists] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [searchOffset, setSearchOffset] = useState<number>(0);
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false);
  const [searchNextHref, setSearchNextHref] = useState<string | null>(null);
  const [likesNextHref, setLikesNextHref] = useState<string | null>(null);
  const [likesHasMore, setLikesHasMore] = useState<boolean>(false);
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
  const [playlistsWithTrack, setPlaylistsWithTrack] = useState<number[]>([]);
  const [rowPlaylistMenuTrackId, setRowPlaylistMenuTrackId] = useState<
    number | null
  >(null);
  const [rowTrackPlaylistsMap, setRowTrackPlaylistsMap] = useState<
    Record<number, number[]>
  >({});
  const [mobileRowPlaylistTrack, setMobileRowPlaylistTrack] = useState<any>(null);
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
  const [playlistCoverOverrides, setPlaylistCoverOverrides] = useState<
    Record<number, string>
  >({});
  const [likeToast, setLikeToast] = useState<{
    message: string;
    artwork: string;
    visible: boolean;
  }>({
    message: "",
    artwork: "",
    visible: false,
  });
  const [appBackgroundCurrent, setAppBackgroundCurrent] = useState<string>("");
  const [appBackgroundPrevious, setAppBackgroundPrevious] = useState<string>("");
  const [appBackgroundTransitioning, setAppBackgroundTransitioning] =
    useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [playerState, setPlayerState] = useState<{
    trackId: number | null;
    isPlaying: boolean;
  }>({ trackId: null, isPlaying: false });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarPlaylistMenuRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mainAreaRef = useRef<HTMLElement | null>(null);
  const pullRefreshStartYRef = useRef<number | null>(null);
  const pullRefreshTriggeredRef = useRef(false);
  const suggestTimeoutRef = useRef<number | null>(null);
  const liveSearchTimeoutRef = useRef<number | null>(null);
  const isHistoryRestoreRef = useRef(false);
  const scrollTriggerRef = useRef<HTMLDivElement>(null);
  const historyScrollTriggerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const playlistCacheRef = useRef<{ data: any[]; timestamp: number } | null>(
    null,
  );
  const playlistCoverFetchRef = useRef<Set<number>>(new Set());
  const requestedTrackLikesRef = useRef<Set<number>>(new Set());
  const requestedTrackPlaylistMembershipRef = useRef<Set<number>>(new Set());
  const requestedRelatedQueueSeedsRef = useRef<Set<number>>(new Set());
  const inflightRelatedQueueSeedsRef = useRef<Set<number>>(new Set());
  const forceSearchSectionScrollRef = useRef(false);
  const trackPanelTimerRef = useRef<number | null>(null);
  const appBackgroundTimerRef = useRef<number | null>(null);
  const previousCurrentTrackRef = useRef<any>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const TRACK_PANEL_ANIMATION_MS = 320;

  const clearTrackPanelTimer = () => {
    if (typeof window === "undefined") return;
    if (trackPanelTimerRef.current !== null) {
      window.clearTimeout(trackPanelTimerRef.current);
      trackPanelTimerRef.current = null;
    }
  };

  const scheduleTrackPanelState = (callback: () => void) => {
    if (typeof window === "undefined") return;
    clearTrackPanelTimer();
    trackPanelTimerRef.current = window.setTimeout(() => {
      trackPanelTimerRef.current = null;
      callback();
    }, TRACK_PANEL_ANIMATION_MS);
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  const forceScrollToTop = () => {
    if (typeof window === "undefined") return;
    pendingScrollRef.current = 0;
    scrollToTop();
    mainAreaRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    const scrollingElement = document.scrollingElement as HTMLElement | null;
    if (scrollingElement) {
      scrollingElement.scrollTop = 0;
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainAreaRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "auto" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        mainAreaRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      }, 0);
    });
  };

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        const maxCollapse = 200;
        const scrollY = window.scrollY;

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
    return () => {
      clearTrackPanelTimer();
      if (appBackgroundTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(appBackgroundTimerRef.current);
      }
    };
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
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (!detail.track) return;

      const incomingTrack = {
        ...detail.track,
        remoteStartPosition:
          typeof detail.position === "number" ? detail.position : 0,
        remoteShouldPlay: detail.shouldPlay !== false,
      };

      setCurrentTrack(incomingTrack);
      setQueue([incomingTrack]);
      setCurrentQueueIndex(0);
      setQueueSource("search-related");
      setCurrentPlaylistId(null);
      setCurrentPlaylistTitle(null);
    };

    window.addEventListener("remote-load-track", handler as EventListener);
    return () =>
      window.removeEventListener("remote-load-track", handler as EventListener);
  }, []);

  useEffect(() => {
    setPlayerState((prev) => ({
      trackId: currentTrack?.id ?? null,
      isPlaying: prev.trackId === currentTrack?.id ? prev.isPlaying : false,
    }));
  }, [currentTrack?.id]);

  useEffect(() => {
    const previousTrack = previousCurrentTrackRef.current;

    if (
      previousTrack?.id &&
      previousTrack.id !== currentTrack?.id
    ) {
      const historyEntry = {
        ...previousTrack,
        played_at:
          previousTrack.played_at ||
          previousTrack.added_at ||
          new Date().toISOString(),
        added_at:
          previousTrack.added_at ||
          previousTrack.played_at ||
          new Date().toISOString(),
      };

      setListeningHistory((prev) => {
        if (prev[0]?.id === historyEntry.id) {
          return prev;
        }
        return [historyEntry, ...prev].slice(0, Math.max(historyLimit, 100));
      });
    }

    previousCurrentTrackRef.current = currentTrack || null;
  }, [currentTrack?.id, historyLimit]);

  useEffect(() => {
    const nextBackground =
      currentTrack?.artwork_url?.replace?.("-large", "-t500x500") ||
      currentTrack?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
      "";

    if (!nextBackground || nextBackground === appBackgroundCurrent) {
      return;
    }

    if (typeof window !== "undefined" && appBackgroundTimerRef.current !== null) {
      window.clearTimeout(appBackgroundTimerRef.current);
      appBackgroundTimerRef.current = null;
    }

    setAppBackgroundPrevious(appBackgroundCurrent);
    setAppBackgroundCurrent(nextBackground);
    setAppBackgroundTransitioning(Boolean(appBackgroundCurrent));

    if (typeof window !== "undefined" && appBackgroundCurrent) {
      appBackgroundTimerRef.current = window.setTimeout(() => {
        setAppBackgroundPrevious("");
        setAppBackgroundTransitioning(false);
        appBackgroundTimerRef.current = null;
      }, 1200);
    }
  }, [currentTrack?.id, appBackgroundCurrent, currentTrack]);

  useEffect(() => {
    if (!viewingTrack || !currentTrack?.id) return;
    if (selectedTrack?.id === currentTrack.id) return;
    setSelectedTrack(currentTrack);
  }, [viewingTrack, currentTrack, selectedTrack?.id]);

  useEffect(() => {
    setPlaylistTrackQuery("");
    setProfileTracksExpanded(false);
  }, [selectedPlaylist?.id, viewingLikes, viewingProfile, viewingArtist]);

  useEffect(() => {
    if (!contextPlaylistMenu?.trackId) {
      setPlaylistsWithTrack([]);
      return;
    }

    const fetchPlaylistsWithTrack = async () => {
      try {
        const response = await fetch(
          `/api/check-track-in-playlists?trackId=${contextPlaylistMenu.trackId}`,
        );
        const data = await response.json();
        setPlaylistsWithTrack(
          data.playlistsWithTrack?.map((p: any) => p.id) || [],
        );
      } catch (error) {
        console.error("Failed to fetch playlists with track:", error);
        setPlaylistsWithTrack([]);
      }
    };

    fetchPlaylistsWithTrack();
  }, [contextPlaylistMenu?.trackId]);

  // Listen for playlist membership changes from PlaylistMenu and update cached state
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e.detail;
        if (!d?.trackId) return;
        const pid = Number(d.playlistId);
        const numericTrackId = Number(d.trackId);
        if (
          contextPlaylistMenu?.trackId &&
          String(d.trackId) === String(contextPlaylistMenu.trackId)
        ) {
          if (d.action === "add") {
            setPlaylistsWithTrack((prev) =>
              prev.includes(pid) ? prev : [...prev, pid],
            );
          } else if (d.action === "remove") {
            setPlaylistsWithTrack((prev) => prev.filter((id) => id !== pid));
          }
        }
        setRowTrackPlaylistsMap((prev) => {
          const current = prev[numericTrackId] || [];
          return {
            ...prev,
            [numericTrackId]:
              d.action === "add"
                ? current.includes(pid)
                  ? current
                  : [...current, pid]
                : current.filter((id) => id !== pid),
          };
        });
      } catch (err) {
        console.error(
          "Failed to handle playlist-membership-changed event:",
          err,
        );
      }
    };
    window.addEventListener(
      "playlist-membership-changed",
      handler as EventListener,
    );
    return () =>
      window.removeEventListener(
        "playlist-membership-changed",
        handler as EventListener,
      );
  }, [contextPlaylistMenu?.trackId]);

  useEffect(() => {
    const nextMembership: Record<number, number[]> = {};
    const addPlaylistTracks = (playlist: any) => {
      if (!playlist?.id || !Array.isArray(playlist.tracks)) return;
      for (const track of playlist.tracks) {
        const trackId = Number(track?.id);
        if (!Number.isFinite(trackId) || trackId <= 0) continue;
        if (!nextMembership[trackId]) nextMembership[trackId] = [];
        if (!nextMembership[trackId].includes(playlist.id)) {
          nextMembership[trackId].push(playlist.id);
        }
      }
    };

    playlists.forEach(addPlaylistTracks);
    libraryPlaylists.forEach(addPlaylistTracks);
    profilePlaylists.forEach(addPlaylistTracks);
    artistPlaylists.forEach(addPlaylistTracks);

    if (currentPlaylistId && playlistTracks.length) {
      for (const track of playlistTracks) {
        const trackId = Number(track?.id);
        if (!Number.isFinite(trackId) || trackId <= 0) continue;
        if (!nextMembership[trackId]) nextMembership[trackId] = [];
        if (!nextMembership[trackId].includes(currentPlaylistId)) {
          nextMembership[trackId].push(currentPlaylistId);
        }
      }
    }

    if (!Object.keys(nextMembership).length) return;

    setRowTrackPlaylistsMap((prev) => {
      let changed = false;
      const merged = { ...prev };
      for (const [trackId, playlistIds] of Object.entries(nextMembership)) {
        const numericTrackId = Number(trackId);
        const current = merged[numericTrackId] || [];
        const combined = Array.from(new Set([...current, ...playlistIds]));
        if (
          combined.length !== current.length ||
          combined.some((id, index) => id !== current[index])
        ) {
          merged[numericTrackId] = combined;
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [
    playlists,
    libraryPlaylists,
    profilePlaylists,
    artistPlaylists,
    currentPlaylistId,
    playlistTracks,
  ]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return true;
      }
      return target.isContentEditable;
    };

    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("player-toggle"));
    };

    window.addEventListener("keydown", handleSpacebar, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleSpacebar);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const api = (window as any).electronAPI;
    if (!api?.windowControls) return;
    document.body.classList.add("electron");
    api.windowControls.isMaximized().then((state: boolean) => {
      setIsWindowMaximized(Boolean(state));
    });
    const cleanup = api.windowControls.onMaximized((state: boolean) => {
      setIsWindowMaximized(Boolean(state));
    });
    return () => {
      cleanup?.();
      document.body.classList.remove("electron");
    };
  }, []);

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

  const handleTrackPageOpen = (track: any, _skipHistory = false) => {
    if (!track) return;
    const wasMinimized = trackPanelMinimized || trackPanelState === "minimized";
    const wasClosed = !viewingTrack;
    clearTrackPanelTimer();
    setTrackPanelMinimized(false);
    setViewingTrack(true);
    setSelectedTrack(track);
    if (wasMinimized || wasClosed) {
      setTrackPanelState("opening");
      scheduleTrackPanelState(() => setTrackPanelState("open"));
      return;
    }
    setTrackPanelState("open");
  };

  const handleTrackPanelPlay = (track: any) => {
    if (!track) return;
    handleTrackClick(track, "search");
    handleTrackPageOpen(track, true);
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
    const resolved =
      libraryPlaylists.find((p) => p.id === playlistId) ||
      playlists.find((p) => p.id === playlistId) ||
      playlistResults.find((p) => p.id === playlistId) ||
      albumResults.find((p) => p.id === playlistId);
    const fallback = {
      id: playlistId,
      title: playlistTitle || "Playlist",
    };
    handlePlaylistClick(resolved || fallback);
  };

  // Handle playlist click
  const handlePlaylistClick = async (
    playlist: any,
    skipHistory = false,
    autoPlayFirst = false,
    navigate = true,
  ) => {
    // Handle system playlists that need URL resolution
    if (playlist?.needsResolution && playlist?.permalink_url) {
      setSectionLoading(true);
      try {
        console.log("Resolving system playlist URL:", playlist.permalink_url);

        // Get token from cookies
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("soundcloud_token="))
          ?.split("=")[1];

        if (!token) {
          console.error("No auth token found");
          setSectionLoading(false);
          return;
        }

        const response = await fetch(
          `https://api.soundcloud.com/resolve?url=${encodeURIComponent(playlist.permalink_url)}`,
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
          },
        );

        if (response.ok) {
          const resolvedData = await response.json();
          console.log("Resolved system playlist:", resolvedData);

          // Continue with the resolved playlist
          playlist = {
            ...resolvedData,
            needsResolution: false,
          };
        } else {
          console.error("Failed to resolve system playlist:", response.status);
          setSectionLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error resolving system playlist:", error);
        setSectionLoading(false);
        return;
      }
    }

    const resolvedPlaylist = resolvePlaylistItem(playlist);
    if (!resolvedPlaylist?.id) {
      return;
    }
    if (navigate) {
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
    setViewingProfile(false);
    setViewingArtist(false);
    setUserProfile(null);
    setSelectedArtist(null);
    setSectionLoading(true);
    setTracks([]);
    setPlaylistTracks([]);
    setLikesNextHref(null);
    setLikesHasMore(false);
    try {
      const { likes, hasMore, nextHref } = await fetchLikesPage();
      const likedMap: Record<number, boolean> = {};
      for (const t of likes) {
        if (t && t.id) {
          likedMap[t.id] = true;
        }
      }
      setPlaylistTracks(likes);
      setLikedTracks(likedMap);
      setLikesNextHref(nextHref);
      setLikesHasMore(hasMore);

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

  useEffect(() => {
    if (!viewingLibrary || libraryPlaylists.length === 0) return;
    const missing = libraryPlaylists
      .map((playlist: any) => resolvePlaylistItem(playlist) || playlist)
      .filter((playlist: any) => {
        if (!playlist?.id) return false;
        if (playlistCoverOverrides[playlist.id]) return false;
        if (playlistCoverFetchRef.current.has(playlist.id)) return false;
        const hasArtwork = Boolean(
          playlist.artwork_url ||
          (playlist.tracks && playlist.tracks[0]?.artwork_url),
        );
        return !hasArtwork;
      })
      .slice(0, 10);

    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const playlist of missing) {
        if (!playlist?.id) continue;
        playlistCoverFetchRef.current.add(playlist.id);
        try {
          const response = await fetch(`/api/playlist/${playlist.id}`);
          if (!response.ok) continue;
          const data = await response.json();
          const firstArtwork = data?.tracks?.[0]?.artwork_url;
          const normalized = normalizeArtworkUrl(firstArtwork);
          if (!cancelled && normalized) {
            setPlaylistCoverOverrides((prev) => ({
              ...prev,
              [playlist.id]: normalized,
            }));
          }
        } catch (error) {
          console.error("Failed to fetch playlist cover:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewingLibrary, libraryPlaylists, playlistCoverOverrides]);

  // Handle profile click
  const handleProfileClick = async (skipHistory = false) => {
    setViewingProfile(true);
    setViewingHomepage(false);
    setViewingLibrary(false);
    setViewingArtist(false); // <-- Reset artist view
    setSelectedArtist(null); // <-- Clear selected artist
    setSelectedPlaylist(null);
    setViewingLikes(false);
    setSectionLoading(true);
    setTracks([]);
    setArtistTracks([]); // <-- Clear artist tracks
    setProfilePlaylists([]);
    setProfileAlbums([]);
    setProfileReposts([]);
    setPlaylistTracks([]);
    if (listeningHistory.length === 0) {
      setHistoryLoading(true);
    }
    setHistoryError(null);

    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      console.log("User profile data:", data);
      setUserProfile(data);
      if (data.tracks) {
        setPlaylistTracks(data.tracks);
      }
      setProfilePlaylists(data.playlists || []);
      setProfileAlbums(data.albums || []);
      setProfileReposts(data.reposts || []);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setSectionLoading(false);
    }

    // Always refresh history in the background so external SoundCloud listens show up.
    fetchListeningHistoryBackground(historyLimit);

    if (!skipHistory) {
      pushTabState("profile");
    }
  };

  const normalizeHistoryItems = (items: any[]) =>
    items.map((item: any) => ({
      ...item,
      added_at: item.played_at || item.added_at || null,
    }));

  const mergeHistoryItems = useCallback((items: any[]) => {
    const seen = new Set<string>();
    return normalizeHistoryItems(items).filter((item: any) => {
      const itemId = Number(item?.id);
      if (!itemId) return false;
      const marker = `${itemId}:${item?.played_at || item?.added_at || ""}`;
      if (seen.has(marker)) return false;
      seen.add(marker);
      return true;
    });
  }, []);

  const fetchListeningHistoryItems = useCallback(
    async (limit: number) => {
      const api = (window as any).electronAPI;
      const useElectronFastPath = Boolean(api?.playHistoryViaWeb) && limit <= 100;
      if (useElectronFastPath) {
        const result = await api.playHistoryViaWeb();
        if (result?.error) {
          const response = await fetch(
            `/api/listening-history?limit=${limit}&scrape=1&cache=1`,
          );
          const data = await response.json();
          if (!response.ok || data?.error) {
            throw new Error(data?.error || "Unable to fetch listening history.");
          }
          return {
            items: mergeHistoryItems(Array.isArray(data.items) ? data.items : []),
            cached: Boolean(data?.cached),
            canLoadMore:
              useElectronFastPath &&
              Array.isArray(data.items) &&
              data.items.length > 0,
          };
        }

        const items = mergeHistoryItems(
          Array.isArray(result?.items) ? result.items : [],
        );
        const shouldScrapeFallback = result?.source === "stream" || items.length === 0;
        if (shouldScrapeFallback) {
          const response = await fetch(
            `/api/listening-history?limit=${limit}&scrape=1&force=1&cache=1`,
          );
          const data = await response.json();
          if (!response.ok || data?.error) {
            throw new Error(data?.error || "Unable to fetch listening history.");
          }
          return {
            items: mergeHistoryItems(Array.isArray(data.items) ? data.items : []),
            cached: Boolean(data?.cached),
            canLoadMore:
              useElectronFastPath &&
              Array.isArray(data.items) &&
              data.items.length > 0,
          };
        }

        return {
          items,
          cached: false,
          canLoadMore: useElectronFastPath && items.length > 0,
        };
      }

      const response = await fetch(`/api/listening-history?limit=${limit}&cache=1`);
      const data = await response.json();
      if (!response.ok || data?.error) {
        const scrapeResponse = await fetch(
          `/api/listening-history?limit=${limit}&scrape=1&force=1&cache=1`,
        );
        const scrapeData = await scrapeResponse.json();
        if (!scrapeResponse.ok || scrapeData?.error) {
          throw new Error(
            scrapeData?.error || data?.error || "Unable to fetch listening history.",
          );
        }
        return {
          items: mergeHistoryItems(
            Array.isArray(scrapeData.items) ? scrapeData.items : [],
          ),
          cached: Boolean(scrapeData?.cached),
        };
      }

      return {
        items: mergeHistoryItems(Array.isArray(data.items) ? data.items : []),
        cached: Boolean(data?.cached),
        canLoadMore: false,
      };
    },
    [mergeHistoryItems],
  );

  const fetchListeningHistoryBackground = async (limit = historyLimit) => {
    try {
      const shouldShowInitialLoading = listeningHistory.length === 0;
      if (shouldShowInitialLoading) {
        setHistoryLoading(true);
      }
      setHistoryError(null);
      await fetch("/api/auth/check");
      const result = await fetchListeningHistoryItems(limit);
      setListeningHistory((prev) => mergeHistoryItems([...result.items, ...prev]));
      setHistoryHasMore(result.canLoadMore || result.items.length >= limit);

    } catch (error) {
      console.error("Failed to fetch listening history:", error);
      setHistoryError("Unable to fetch listening history.");
      setHistoryHasMore(false);
    } finally {
      if (listeningHistory.length === 0) {
        setHistoryLoading(false);
      } else {
        setHistoryLoading(false);
      }
    }
  };

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || historyLoadingMore || !historyHasMore) return;
    const nextLimit = historyLimit + 100;
    try {
      setHistoryLoadingMore(true);
      setHistoryError(null);
      const result = await fetchListeningHistoryItems(nextLimit);
      setListeningHistory((prev) => mergeHistoryItems([...result.items, ...prev]));
      setHistoryLimit(nextLimit);
      setHistoryHasMore(result.canLoadMore || result.items.length >= nextLimit);
    } catch (error) {
      console.error("Failed to load more listening history:", error);
      setHistoryError("Unable to load more listening history.");
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [
    historyLoading,
    historyLoadingMore,
    historyHasMore,
    historyLimit,
    fetchListeningHistoryItems,
    mergeHistoryItems,
  ]);
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
    setTracks([]);
    setSelectedArtist(artist);
    setSectionLoading(true);
    setArtistTracks([]);
    setArtistPlaylists([]);
    setArtistAlbums([]);
    setArtistReposts([]);
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
      setArtistPlaylists(data.playlists || []);
      setArtistAlbums(data.albums || []);
      setArtistReposts(data.reposts || []);
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
        preloadTrackPlaylistMembership(
          (data.collection || [])
            .map((track: any) => Number(track?.id))
            .filter((id: number) => Number.isFinite(id) && id > 0),
        );
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
    isHistoryRestoreRef.current = false;
    forceSearchSectionScrollRef.current = true;
    forceScrollToTop();
    setSearchView(view);
    setViewingHomepage(false);
    if (typeof window !== "undefined") {
      const currentState = window.history.state || {};
      window.history.replaceState(
        { ...currentState, scrollY: 0 },
        "",
        "",
      );
    }
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

  const extendInfiniteRelatedQueue = useCallback(
    async (seedTrack: any, queueSnapshot: any[] = []) => {
      const seedId = Number(seedTrack?.id);
      if (!seedId) return false;
      if (
        requestedRelatedQueueSeedsRef.current.has(seedId) ||
        inflightRelatedQueueSeedsRef.current.has(seedId)
      ) {
        return false;
      }

      inflightRelatedQueueSeedsRef.current.add(seedId);

      try {
        const response = await fetch(`/api/related-tracks?trackId=${seedId}`);
        if (!response.ok) return false;

        const data = await response.json();
        const related = Array.isArray(data.tracks) ? data.tracks : [];
        const baseQueue = queueSnapshot.length ? queueSnapshot : queue;
        const seenIds = new Set(
          baseQueue
            .map((item) => Number(item?.id))
            .filter((id) => Number.isFinite(id) && id > 0),
        );
        seenIds.add(seedId);

        const freshRelated = related.filter((item: any) => {
          const itemId = Number(item?.id);
          return Number.isFinite(itemId) && itemId > 0 && !seenIds.has(itemId);
        });

        requestedRelatedQueueSeedsRef.current.add(seedId);

        if (!freshRelated.length) return false;

        setQueue((prev) => {
          const currentIds = new Set(
            prev
              .map((item) => Number(item?.id))
              .filter((id) => Number.isFinite(id) && id > 0),
          );
          const appendable = freshRelated.filter((item: any) => {
            const itemId = Number(item?.id);
            return Number.isFinite(itemId) && itemId > 0 && !currentIds.has(itemId);
          });
          return appendable.length ? [...prev, ...appendable] : prev;
        });

        return true;
      } catch (error) {
        console.error("Failed to extend related queue:", error);
        return false;
      } finally {
        inflightRelatedQueueSeedsRef.current.delete(seedId);
      }
    },
    [queue],
  );

  const pickRelatedQueueSeed = useCallback((queueSnapshot: any[]) => {
    for (let index = queueSnapshot.length - 1; index >= 0; index -= 1) {
      const candidate = queueSnapshot[index];
      const candidateId = Number(candidate?.id);
      if (!candidateId) continue;
      if (
        requestedRelatedQueueSeedsRef.current.has(candidateId) ||
        inflightRelatedQueueSeedsRef.current.has(candidateId)
      ) {
        continue;
      }
      return candidate;
    }
    return null;
  }, []);

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
        setQueue([track]);
        setCurrentQueueIndex(0);
      }
      setQueueSource("playlist");
      if (selectedPlaylist?.id) {
        setCurrentPlaylistId(selectedPlaylist.id);
        setCurrentPlaylistTitle(playlistTitle);
      }
    } else if (source === "search") {
      // Set current track and a temporary single-track queue immediately
      setCurrentTrack(track);
      setQueue([track]);
      setCurrentQueueIndex(0);
      setQueueSource("search-related");
      setCurrentPlaylistId(null);
      setCurrentPlaylistTitle(null);

      // Fetch related tracks in background and update queue
      (async () => {
        try {
          const res = await fetch(`/api/related-tracks?trackId=${track.id}`);
          const data = await res.json();
          const related = Array.isArray(data.tracks) ? data.tracks : [];
          // Remove the clicked track if present in related
          const filteredRelated = related.filter((t: any) => t.id !== track.id);
          const newQueue = [track, ...filteredRelated];
          setQueue(newQueue);
          setCurrentQueueIndex(0);
        } catch (e) {
          // Queue already set to single track, nothing more to do
        }
      })();
    } else if (source === "search-related") {
      // Already have queue set up
      const trackIndex = trackList.findIndex((t) => t.id === track.id);
      if (trackIndex !== -1 && trackList.length > 0) {
        setQueue(trackList);
        setCurrentQueueIndex(trackIndex);
        setCurrentTrack(trackList[trackIndex]);
        if (trackList.length - trackIndex <= 1) {
          void extendInfiniteRelatedQueue(trackList[trackList.length - 1], trackList);
        }
      } else {
        setCurrentTrack(track);
        setQueue([track]);
        setCurrentQueueIndex(0);
        void extendInfiniteRelatedQueue(track, [track]);
      }
      setQueueSource("search-related");
    }
  };

  useEffect(() => {
    if (queueSource !== "search-related" || queue.length === 0) return;

    const remainingCount =
      currentQueueIndex >= 0 ? queue.length - currentQueueIndex - 1 : queue.length - 1;

    if (remainingCount > 3) return;

    const seedTrack = pickRelatedQueueSeed(queue);
    if (!seedTrack?.id) return;

    void extendInfiniteRelatedQueue(seedTrack, queue);
  }, [
    queueSource,
    queue,
    currentQueueIndex,
    extendInfiniteRelatedQueue,
    pickRelatedQueueSeed,
  ]);

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

  const seedLikedPlaylists = async () => {
    try {
      const resp = await fetch(`/api/likes-playlists`);
      if (!resp.ok) return;
      const data = await resp.json();
      const list = data.playlists || [];
      const map: Record<number, boolean> = {};
      for (const p of list) {
        if (p && p.id) map[p.id] = true;
      }
      setLikedPlaylists((prev) => ({ ...prev, ...map }));
    } catch (error) {
      console.error("Failed to seed liked playlists:", error);
    }
  };

  const fetchPagedLikes = async (fetchAll = false) => {
    const map: Record<number, boolean> = {};
    const collected: any[] = [];
    let offset = 0;
    const limit = 50;
    while (true) {
      if (offset >= 200) break;
      const resp = await fetch(`/api/likes?offset=${offset}&limit=${limit}`);
      if (!resp.ok) break;
      const data = await resp.json();
      const likes = data.likes || data.tracks || [];
      for (const t of likes) {
        if (t && t.id) {
          map[t.id] = true;
          collected.push(t);
        }
      }
      if (!fetchAll || !data.hasMore || likes.length < limit) break;
      offset += likes.length;
    }
    return { collected, map };
  };

  const fetchLikesPage = async (nextHref?: string | null, limit = 50) => {
    const url = nextHref
      ? `/api/likes?nextHref=${encodeURIComponent(nextHref)}`
      : `/api/likes?limit=${limit}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch likes page: ${resp.status}`);
    }
    const data = await resp.json();
    const likes = data.likes || data.tracks || [];
    return {
      likes,
      hasMore: Boolean(data.hasMore),
      nextHref: typeof data.nextHref === "string" ? data.nextHref : null,
    };
  };

  const seedLikes = async (fetchAll = false) => {
    try {
      const { collected, map } = await fetchPagedLikes(fetchAll);
      setLikedTracks(map);
      if (viewingLikes) {
        setPlaylistTracks(collected);
      }
    } catch (error) {
      console.error("Failed to seed likes:", error);
    }
  };

  const loadMoreLikedSongs = async () => {
    if (
      !viewingLikes ||
      !likesHasMore ||
      isLoadingMore ||
      sectionLoading ||
      !likesNextHref
    ) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const { likes, hasMore, nextHref } = await fetchLikesPage(likesNextHref);
      if (likes.length > 0) {
        setPlaylistTracks((prev) => {
          const seen = new Set(prev.map((track: any) => track?.id));
          const merged = [...prev];
          for (const like of likes) {
            if (like?.id && !seen.has(like.id)) {
              seen.add(like.id);
              merged.push(like);
            }
          }
          return merged;
        });
        setLikedTracks((prev) => {
          const next = { ...prev };
          for (const like of likes) {
            if (like?.id) next[like.id] = true;
          }
          return next;
        });
      }
      setLikesNextHref(nextHref);
      setLikesHasMore(hasMore);
    } catch (error) {
      console.error("Failed to load more liked songs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const emitLikeUpdate = (
    trackId: number,
    isLiked: boolean,
    track?: any,
  ) => {
    try {
      window.dispatchEvent(
        new CustomEvent("likes-updated", {
          detail: { trackId, isLiked, track },
        }),
      );
    } catch (error) {
      console.error("Failed to dispatch likes-updated:", error);
    }
  };
  const emitLikedSongsToast = (isLiked: boolean, track?: any) => {
    try {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: {
            message: isLiked
              ? "Added to Liked Songs"
              : "Removed from Liked Songs",
            artwork: track ? getTrackCover(track) : "",
          },
        }),
      );
    } catch (error) {
      console.error("Failed to dispatch liked songs toast:", error);
    }
  };
  const toggleTrackLike = async (trackId: number, track?: any) => {
    if (!trackId) return;
    const wasViewing = viewingLikes; // Capture current state
    const nextLiked = !likedTracks[trackId];
    setLikedTracks((prev) => ({ ...prev, [trackId]: nextLiked }));
    emitLikeUpdate(trackId, nextLiked, track);
    try {
      // Ensure token is fresh before making the like request
      try {
        await fetch("/api/auth/refresh", { method: "POST" });
      } catch (err) {
        console.warn("Token refresh failed before like (continuing):", err);
      }
      const makeRequest = async () => {
        const resp = await fetch("/api/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId, like: nextLiked }),
        });
        if (!resp.ok && resp.status === 401) {
          // try refreshing and retry once
          try {
            await fetch("/api/auth/refresh", { method: "POST" });
          } catch (e) {
            console.warn("refresh failed during like retry", e);
          }
          const resp2 = await fetch("/api/like", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackId, like: nextLiked }),
          });
          return resp2;
        }
        return resp;
      };
      const response = await makeRequest();
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update track like");
      }
      setLikedTracks((prev) => ({ ...prev, [trackId]: nextLiked }));
      emitLikeUpdate(trackId, nextLiked, track);
      emitLikedSongsToast(nextLiked, track);

      // If user was viewing Likes when the toggle happened, refetch the list
      // to ensure it's in sync with the server
      if (wasViewing) {
        console.log(
          `[toggleTrackLike] Refetching likes for immediate UI update...`,
        );
        try {
          const { collected: likes, map } = await fetchPagedLikes(true);
          setPlaylistTracks(likes);
          setLikedTracks(map);
        } catch (err) {
          console.error("Failed to refetch likes:", err);
        }
      }
    } catch (error) {
      console.error("Failed to toggle track like:", error);
      setLikedTracks((prev) => ({ ...prev, [trackId]: !nextLiked }));
      emitLikeUpdate(trackId, !nextLiked, track);
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
    const trackIds = [
      ...(tracks || []),
      ...(playlistTracks || []),
      ...(artistTracks || []),
      ...(profileReposts || []),
      ...(listeningHistory || []),
    ]
      .map((track: any) => track?.id)
      .filter((id: any) => typeof id === "number");
    const missing = trackIds
      .filter(
        (id: number) =>
          likedTracks[id] === undefined && !requestedTrackLikesRef.current.has(id),
      )
      .slice(0, 20);

    if (missing.length === 0) return;

    let cancelled = false;
    missing.forEach((id) => requestedTrackLikesRef.current.add(id));
    (async () => {
      const results = await Promise.all(
        missing.map(async (id) => ({
          id,
          isLiked: await checkTrackLikeStatus(id),
        })),
      );
      if (cancelled) return;
      setLikedTracks((prev) => {
        const next = { ...prev };
        for (const { id, isLiked } of results) {
          if (next[id] === undefined) next[id] = isLiked;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tracks,
    playlistTracks,
    artistTracks,
    profileReposts,
    listeningHistory,
    likedTracks,
  ]);

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

    // Refresh token to ensure it's fresh
    try {
      await fetch("/api/auth/refresh", { method: "POST" });
    } catch (err) {
      console.warn("Token refresh failed (continuing anyway):", err);
    }

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
        const data = await response.json().catch(() => ({}));
        console.error("add-to-playlist failed", response.status, data);
        throw new Error(
          data.error || data.message || "Failed to add to playlist",
        );
      }
    } catch (error) {
      console.error("Failed to add to playlist:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const fetchTrackPlaylistsMembership = async (trackId: number | string) => {
    if (!trackId) return [];
    try {
      const response = await fetch(
        `/api/check-track-in-playlists?trackId=${trackId}`,
      );
      const data = await response.json();
      const ids = data.playlistsWithTrack?.map((p: any) => p.id) || [];
      setRowTrackPlaylistsMap((prev) => ({
        ...prev,
        [Number(trackId)]: ids,
      }));
      return ids;
    } catch (error) {
      console.error("Failed to fetch row track playlists:", error);
      return [];
    }
  };

  const fetchTracksPlaylistsMembership = async (trackIds: number[]) => {
    if (!trackIds.length) return;
    try {
      const response = await fetch(
        `/api/check-tracks-in-playlists?trackIds=${trackIds.join(",")}`,
      );
      const data = await response.json();
      const memberships = data.memberships || {};
      setRowTrackPlaylistsMap((prev) => {
        const next = { ...prev };
        for (const [trackId, playlistIds] of Object.entries(memberships)) {
          next[Number(trackId)] = Array.isArray(playlistIds)
            ? (playlistIds as number[])
            : [];
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to batch fetch row track playlists:", error);
    }
  };

  const preloadTrackPlaylistMembership = (trackIds: number[]) => {
    const normalizedIds = Array.from(
      new Set(
        trackIds.filter(
          (id) =>
            Number.isFinite(id) &&
            id > 0 &&
            rowTrackPlaylistsMap[id] === undefined &&
            !requestedTrackPlaylistMembershipRef.current.has(id),
        ),
      ),
    );

    if (!normalizedIds.length) return;

    normalizedIds.forEach((id) =>
      requestedTrackPlaylistMembershipRef.current.add(id),
    );

    void (async () => {
      for (let i = 0; i < normalizedIds.length; i += 20) {
        await fetchTracksPlaylistsMembership(normalizedIds.slice(i, i + 20));
      }
    })();
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
          if (queueSource === "search-related") {
            const seedTrack = pickRelatedQueueSeed(queue);
            if (seedTrack?.id) {
              void extendInfiniteRelatedQueue(seedTrack, queue);
            }
          }
          return;
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

  const normalizeArtworkUrl = (url?: string | null) => {
    if (!url) return null;
    return url.includes("-large") ? url.replace("-large", "-t500x500") : url;
  };

  const getTrackCover = (track: any) => {
    const artworkUrl =
      track?.artwork_url ||
      track?.track?.artwork_url ||
      track?.origin?.artwork_url;
    const userAvatar =
      track?.user?.avatar_url ||
      track?.artist?.avatar_url ||
      track?.track?.user?.avatar_url ||
      track?.origin?.user?.avatar_url;
    return (
      normalizeArtworkUrl(artworkUrl) ||
      normalizeArtworkUrl(userAvatar) ||
      "/placeholder.png"
    );
  };

  const getPlaylistCover = (playlist: any) => {
    const resolved = resolvePlaylistItem(playlist) || playlist;
    const override = resolved?.id ? playlistCoverOverrides[resolved.id] : null;
    if (override) return override;
    const visualsUrl =
      resolved?.visuals?.visuals?.[0]?.visual_url ||
      resolved?.visuals?.visual_url ||
      resolved?.picture_url;
    const artworkUrl = resolved?.artwork_url;
    const trackArtwork =
      resolved?.tracks?.length > 0 ? resolved.tracks[0]?.artwork_url : null;
    const fallbackAvatar = resolved?.user?.avatar_url;
    const cover =
      normalizeArtworkUrl(artworkUrl) ||
      normalizeArtworkUrl(trackArtwork) ||
      normalizeArtworkUrl(visualsUrl) ||
      normalizeArtworkUrl(fallbackAvatar);
    return cover || "/placeholder.png";
  };

  const getCardCover = (item: any) => {
    if (!item) return "/placeholder.png";
    if (isTrackItem(item)) {
      return getTrackCover(item);
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
    if (playlistTracks.length > 0) {
      return getTrackCover(playlistTracks[0]);
    }
    return "/placeholder.png";
  };

  const getYear = (dateString: string) => {
    return new Date(dateString).getFullYear();
  };

  // Removed fetchGeniusMetadata

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
          // Seed likes and liked-playlists cache so UI reflects server state immediately
          seedLikes(true);
          seedLikedPlaylists();
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
    if (!isAuthenticated) return;
    const refresh = async () => {
      try {
        await fetch("/api/auth/refresh");
      } catch (_error) {
        // silent refresh failure; auth check will handle re-login
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 45 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || listeningHistory.length > 0 || historyLoading) return;
    void fetchListeningHistoryBackground(historyLimit);
  }, [
    isAuthenticated,
    listeningHistory.length,
    historyLoading,
    historyLimit,
  ]);

  useEffect(() => {
    if (!viewingProfile || !isAuthenticated) return;

    const refreshHistory = () => {
      void fetchListeningHistoryBackground(historyLimit);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshHistory();
      }
    };

    window.addEventListener("focus", refreshHistory);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(refreshHistory, 60_000);

    return () => {
      window.removeEventListener("focus", refreshHistory);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [viewingProfile, isAuthenticated, historyLimit]);

  // Global listener to react to like changes from anywhere in the app
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const d = e.detail;
        if (!d) return;
        const { trackId, isLiked, track } = d;
        if (viewingLikes) {
          if (isLiked) {
            setPlaylistTracks((prev) =>
              prev.some((t) => t?.id === trackId)
                ? prev
                : track
                  ? [track, ...prev]
                  : [{ id: trackId }, ...prev],
            );
            setLikedTracks((prev) => ({ ...prev, [trackId]: true }));
          } else {
            setPlaylistTracks((prev) => prev.filter((t) => t?.id !== trackId));
            setLikedTracks((prev) => {
              const copy = { ...prev } as Record<number, boolean>;
              delete copy[trackId as number];
              return copy;
            });
          }
        } else {
          setLikedTracks((prev) => ({ ...prev, [trackId]: Boolean(isLiked) }));
        }
      } catch (err) {
        console.error("likes-updated handler error:", err);
      }
    };

    window.addEventListener("likes-updated", handler as EventListener);
    return () =>
      window.removeEventListener("likes-updated", handler as EventListener);
  }, [viewingLikes]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setLikeToast({
        message: String(detail.message || ""),
        artwork: String(detail.artwork || ""),
        visible: true,
      });
    };

    window.addEventListener("show-toast", handler as EventListener);
    return () =>
      window.removeEventListener("show-toast", handler as EventListener);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setIsAuthenticated(false);
      router.push("/login");
    }
  };

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

  useEffect(() => {
    // Enable infinite scroll for search results and liked songs.
    if (
      !scrollTriggerRef.current ||
      isLoadingMore ||
      loading ||
      selectedPlaylist ||
      viewingProfile ||
      viewingArtist ||
      viewingTrack
    ) {
      return;
    }

    if (!viewingLikes && (!searchHasMore || !searchNextHref)) {
      return;
    }

    if (viewingLikes && !likesHasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || isLoadingMore) return;
        if (viewingLikes) {
          loadMoreLikedSongs();
          return;
        }
        if (searchHasMore) {
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
    likesHasMore,
    loading,
    searchNextHref,
    viewingLikes,
    selectedPlaylist,
    viewingProfile,
    viewingArtist,
    viewingTrack,
    likesNextHref,
  ]);

  useEffect(() => {
    if (
      !historyScrollTriggerRef.current ||
      !viewingProfile ||
      historyLoading ||
      historyLoadingMore ||
      !historyHasMore
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        void loadMoreHistory();
      },
      { threshold: 0.1, rootMargin: "120px" },
    );

    observer.observe(historyScrollTriggerRef.current);

    return () => observer.disconnect();
  }, [
    viewingProfile,
    historyLoading,
    historyLoadingMore,
    historyHasMore,
    loadMoreHistory,
  ]);

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
          setSelectedArtist(null);
          setUserProfile(null);
          break;
        case "profile":
          setViewingHomepage(false);
          handleProfileClick(true);
          break;
        case "library":
          setViewingHomepage(false);
          handleLibraryClick(true);
          break;
        case "likes":
          setViewingHomepage(false);
          handleLikesClick(true);
          break;
        case "playlist":
          setViewingHomepage(false);
          if (state.playlistId) {
            const playlist = playlists.find((p) => p.id === state.playlistId);
            if (playlist) handlePlaylistClick(playlist, true);
          }
          break;
        case "artist":
          setViewingHomepage(false);
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
    viewingTrack,
    selectedPlaylist,
    searchView,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !forceSearchSectionScrollRef.current ||
      loading ||
      sectionLoading ||
      libraryLoading ||
      isLoadingMore
    ) {
      return;
    }

    const scrollNow = () => {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const scrollingElement = document.scrollingElement as HTMLElement | null;
      if (scrollingElement) {
        scrollingElement.scrollTop = 0;
      }
      mainAreaRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    };

    scrollNow();
    const rafId = window.requestAnimationFrame(() => {
      scrollNow();
      window.setTimeout(() => {
        scrollNow();
        forceSearchSectionScrollRef.current = false;
      }, 0);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [searchView, loading, sectionLoading, libraryLoading, isLoadingMore, tracks.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = mainAreaRef.current;
    if (!element) return;

    const isAtTop = () => {
      const scrollingElement = document.scrollingElement as HTMLElement | null;
      return (
        window.scrollY <= 0 &&
        (document.documentElement.scrollTop || 0) <= 0 &&
        (document.body.scrollTop || 0) <= 0 &&
        ((scrollingElement?.scrollTop ?? 0) <= 0)
      );
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (window.innerWidth > 1000 || !isAtTop()) {
        pullRefreshStartYRef.current = null;
        pullRefreshTriggeredRef.current = false;
        return;
      }
      pullRefreshStartYRef.current = event.touches[0]?.clientY ?? null;
      pullRefreshTriggeredRef.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        window.innerWidth > 1000 ||
        pullRefreshStartYRef.current === null ||
        pullRefreshTriggeredRef.current
      ) {
        return;
      }

      const currentY = event.touches[0]?.clientY ?? null;
      if (currentY === null) return;

      if (!isAtTop()) {
        pullRefreshStartYRef.current = null;
        return;
      }

      const deltaY = currentY - pullRefreshStartYRef.current;
      if (deltaY > 96) {
        pullRefreshTriggeredRef.current = true;
        window.location.reload();
      }
    };

    const handleTouchEnd = () => {
      pullRefreshStartYRef.current = null;
      pullRefreshTriggeredRef.current = false;
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  const pushTabState = (tab: string, data: Record<string, any> = {}) => {
    window.history.pushState({ tab, scrollY: 0, ...data }, "", "");
    if (tab === "homepage") setViewingHomepage(true);
    else setViewingHomepage(false);
  };

    const displayTitle = viewingLikes ? "Liked Songs" : selectedPlaylist?.title;
    const displayCover = viewingLikes
      ? getLikedSongsCover()
      : selectedPlaylist
        ? getPlaylistCover(selectedPlaylist)
        : undefined;
  const activeProfileBanner = viewingProfile
    ? normalizeArtworkUrl(userProfile?.banner_url)
    : normalizeArtworkUrl(
        selectedArtist?.banner_url ||
          selectedArtist?.visuals?.visuals?.[0]?.visual_url ||
          selectedArtist?.visuals?.visual_url ||
          selectedArtist?.picture_url ||
          selectedArtist?.avatar_url,
      );
  const visibleArtists = showAllArtists
    ? artistResults
    : artistResults.slice(0, 8);
  const visibleAlbums = showAllAlbums ? albumResults : albumResults.slice(0, 8);
  const visiblePlaylists = showAllPlaylists
    ? playlistResults
    : playlistResults.slice(0, 8);
  const visibleTrackPreview = tracks.slice(0, 15);
  const activeProfileAlbums = viewingProfile ? profileAlbums : artistAlbums;
  const activeProfilePlaylists = viewingProfile
    ? profilePlaylists
    : artistPlaylists;
  const activeProfileTracks = viewingProfile
    ? playlistTracks
    : viewingArtist
      ? artistTracks
      : [];
  const filteredProfileTracks = activeProfileTracks.filter((track: any) => {
    const term = playlistTrackQuery.trim().toLowerCase();
    if (!term) return true;
    const title = String(track?.title || "").toLowerCase();
    const artist = String(track?.user?.username || "").toLowerCase();
    return title.includes(term) || artist.includes(term);
  });
  const visibleProfileTracks = profileTracksExpanded
    ? filteredProfileTracks
    : filteredProfileTracks.slice(0, 5);
  const activeProfileReposts = viewingProfile ? profileReposts : artistReposts;
  const filteredProfileReposts = activeProfileReposts.filter((track: any) => {
    const term = playlistTrackQuery.trim().toLowerCase();
    if (!term) return true;
    const title = String(track?.title || "").toLowerCase();
    const artist = String(track?.user?.username || "").toLowerCase();
    return title.includes(term) || artist.includes(term);
  });
  const visiblePlaylistTracks = (
    viewingProfile || viewingArtist ? [] : playlistTracks
  ).filter((track: any) => {
    const term = playlistTrackQuery.trim().toLowerCase();
    if (!term) return true;
    const title = String(track?.title || "").toLowerCase();
    const artist = String(track?.user?.username || "").toLowerCase();
    return title.includes(term) || artist.includes(term);
  });

  useEffect(() => {
    if (!currentPlaylistId || !visiblePlaylistTracks.length) return;
    setRowTrackPlaylistsMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const track of visiblePlaylistTracks) {
        if (!track?.id) continue;
        const current = next[track.id] || [];
        if (!current.includes(currentPlaylistId)) {
          next[track.id] = [...current, currentPlaylistId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentPlaylistId, visiblePlaylistTracks]);

  const visibleRowTrackIds = Array.from(
    new Set(
      [
        ...visiblePlaylistTracks,
        ...visibleProfileTracks,
        ...filteredProfileReposts,
        ...(searchView === "tracks" ? tracks : tracks.slice(0, 15)),
      ]
        .map((track: any) => Number(track?.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  useEffect(() => {
    preloadTrackPlaylistMembership(visibleRowTrackIds);
  }, [visibleRowTrackIds.join(","), rowTrackPlaylistsMap]);

  const renderTrackRows = (
    trackItems: any[],
    rowKeyPrefix: string,
    playlistContextId: number | null = null,
  ) => (
    <div className="track-list">
      {trackItems.map((track: any, index: number) => (
        <div
          key={`${rowKeyPrefix}-${track.id || index}`}
          className="track-row"
          onClick={() => handleTrackClick(track, "playlist", trackItems)}
          onContextMenu={(event) =>
            handleContextMenu(event, track, "playlist", trackItems)
          }
        >
          <img
            src={getTrackCover(track)}
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
          <div
            className="track-row-actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`track-like-btn track-row-like-btn ${
                likedTracks[track.id] ? "liked" : ""
              }`}
              onClick={() => void toggleTrackLike(track.id, track)}
              aria-label={
                likedTracks[track.id] ? "Remove like" : "Add like"
              }
            >
              {renderHeartIcon(Boolean(likedTracks[track.id]))}
            </button>
            <div className="track-row-playlist-wrap">
              <button
                type="button"
                className={`track-row-playlist-btn ${
                  (
                    rowTrackPlaylistsMap[track.id] ||
                    (playlistContextId ? [playlistContextId] : [])
                  ).length
                    ? "in-playlist"
                    : ""
                }`}
                onClick={() => {
                  void fetchTrackPlaylistsMembership(track.id);
                  if (
                    typeof window !== "undefined" &&
                    window.innerWidth <= 1000
                  ) {
                    setMobileRowPlaylistTrack(track);
                    return;
                  }
                  setRowPlaylistMenuTrackId((prev) =>
                    prev === track.id ? null : track.id,
                  );
                }}
                aria-label="Add to playlist"
              >
                <img
                  src={
                    (
                      rowTrackPlaylistsMap[track.id] ||
                      (playlistContextId ? [playlistContextId] : [])
                    ).length
                      ? "https://img.icons8.com/parakeet-line/50/checked.png"
                      : "https://img.icons8.com/parakeet-line/48/add.png"
                  }
                  alt="Add to playlist"
                  className="player-add-playlist-icon"
                />
              </button>
              <PlaylistMenu
                trackId={track.id}
                isOpen={rowPlaylistMenuTrackId === track.id}
                onClose={() => setRowPlaylistMenuTrackId(null)}
                playlistsWithTrack={
                  rowTrackPlaylistsMap[track.id] ||
                  (playlistContextId ? [playlistContextId] : [])
                }
              />
            </div>
          </div>
          <div className="track-row-duration">
            {formatDuration(track.duration)}
          </div>
          <div className="track-row-year">
            {track.created_at ? getYear(track.created_at) : "-"}
          </div>
          <div className="track-row-added">
            {track.added_at
              ? formatTimeAgo(track.added_at)
              : track.created_at
                ? formatTimeAgo(track.created_at)
                : "-"}
          </div>
        </div>
      ))}
    </div>
  );

  const renderSearchTrackCards = (trackItems: any[]) => (
    <div className="horizontal-scroll drag-scroll">
      {trackItems.map((track: any) => (
        <div
          key={`track-card-${track.id}`}
          className="track-card"
          onClick={() => handleTrackClick(track, "search", tracks)}
          onContextMenu={(event) =>
            handleContextMenu(event, track, "search", tracks)
          }
        >
          <button
            type="button"
            className={`card-play-btn ${
              isTrackPlaying(track.id) ? "pause" : "play"
            }`}
            style={getCardCoverStyle(track)}
            onClick={(event) =>
              handleCardPlayClick(event, track, "search", tracks)
            }
            aria-label={isTrackPlaying(track.id) ? "Pause" : "Play"}
          >
            {isTrackPlaying(track.id) ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <img
            src={
              track.artwork_url?.replace("-large", "-t500x500") ||
              "/placeholder.png"
            }
            alt={track.title}
            className="track-cover"
            loading="lazy"
            decoding="async"
          />
          <div
            className="track-info clickable"
            onClick={(event) => handleInfoClick(event, track)}
          >
            <div className="track-title">{track.title}</div>
            <div
              className="track-artist clickable"
              onClick={(event) => {
                event.stopPropagation();
                handleArtistClick(track.user);
              }}
            >
              {track.user?.username || "Unknown"}
            </div>
            <button
              type="button"
              className={`track-like-btn ${likedTracks[track.id] ? "liked" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                void toggleTrackLike(track.id, track);
              }}
              aria-label={likedTracks[track.id] ? "Remove like" : "Add like"}
            >
              {renderHeartIcon(Boolean(likedTracks[track.id]))}
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  if (authChecking) {
    return <div style={{ padding: "20px", color: "white" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }
  const appShellStyle = {
    "--app-bg-current": appBackgroundCurrent ? `url("${appBackgroundCurrent}")` : "none",
    "--app-bg-previous": appBackgroundPrevious
      ? `url("${appBackgroundPrevious}")`
      : "none",
  } as CSSProperties;

  return (
    <div
      className={`app-shell app-shell-reactive ${appBackgroundTransitioning ? "app-shell-transitioning" : ""} ${playerState.isPlaying ? "app-shell-playing" : ""}`}
      style={appShellStyle}
    >
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
                {sidebarExpanded ? "No playlists yet" : "-"}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
          >
            {sidebarExpanded && <span className="nav-label">Log out</span>}
            {!sidebarExpanded && <span aria-hidden="true">≋</span>}
          </button>
        </div>
      </aside>

      <div className="titlebar">
        <div className="titlebar-drag" aria-hidden="true" />
        <div className="titlebar-right">
          <button
            type="button"
            className="titlebar-btn"
            onClick={() =>
              (window as any).electronAPI?.windowControls?.minimize()
            }
            aria-label="Minimize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M1 5h8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="titlebar-btn"
            onClick={() =>
              (window as any).electronAPI?.windowControls?.maximizeToggle()
            }
            aria-label={isWindowMaximized ? "Restore" : "Maximize"}
          >
            {isWindowMaximized ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="1.75"
                  y="3"
                  width="5.75"
                  height="5.25"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M3 3V1.75h5.25V7H7.1"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="1.75"
                  y="1.75"
                  width="6.5"
                  height="6.5"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="titlebar-btn close"
            onClick={() => (window as any).electronAPI?.windowControls?.close()}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2 2l6 6M8 2L2 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

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
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
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
          <button
            type="button"
            className="mobile-logout-btn"
            onClick={handleLogout}
          >
            Log out
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

      <main className="main-area" ref={mainAreaRef}>
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
                                    {renderHeartIcon(Boolean(likedPlaylists[playlist.id]))}
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
                    onContextMenu={(event) => {
                      const profileItem = viewingProfile
                        ? userProfile
                        : selectedArtist;
                      if (profileItem) {
                        handleContextMenu(event, profileItem, "search");
                      }
                    }}
                    style={{
                      backgroundImage: activeProfileBanner
                        ? `url(${activeProfileBanner})`
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
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4.5 9.2l2.4 2.4 6.6-6.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                  <div
                    className="playlist-header-sticky"
                    style={{
                      "--playlist-banner-image": displayCover
                        ? `url(${displayCover})`
                        : "none",
                    } as CSSProperties}
                  >
                    <img
                      src={displayCover}
                      alt={displayTitle}
                      className="playlist-header-cover"
                      loading="eager"
                      decoding="async"
                    />
                    <div className="playlist-header-main">
                      <h2 className="playlist-header-title">{displayTitle}</h2>
                    </div>
                    <div className="playlist-track-search playlist-track-search-banner">
                      <input
                        type="text"
                        value={playlistTrackQuery}
                        onChange={(event) =>
                          setPlaylistTrackQuery(event.target.value)
                        }
                        placeholder={`Search in ${displayTitle || "playlist"}`}
                        aria-label="Search playlist tracks"
                      />
                    </div>
                  </div>
                )}
                {(viewingProfile || viewingArtist) &&
                  activeProfileAlbums.length > 0 && (
                    <section className="search-section">
                      <div className="search-section-header">
                        <h3 className="search-section-title">Albums</h3>
                      </div>
                      <div className="horizontal-scroll drag-scroll">
                        {activeProfileAlbums.map((album: any) => (
                          <div
                            key={`profile-album-${album.id}`}
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
                              src={getPlaylistCover(album)}
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
                                {renderHeartIcon(Boolean(likedPlaylists[album.id]))}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                {(viewingProfile || viewingArtist) &&
                  activeProfilePlaylists.length > 0 && (
                    <section className="search-section">
                      <div className="search-section-header">
                        <h3 className="search-section-title">Playlists</h3>
                      </div>
                      <div className="horizontal-scroll drag-scroll">
                        {activeProfilePlaylists.map((playlist: any) => (
                          <div
                            key={`profile-playlist-${playlist.id}`}
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
                                {renderHeartIcon(Boolean(likedPlaylists[playlist.id]))}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                {(viewingProfile || viewingArtist) && (
                  <section className="search-section">
                    <div className="search-section-header profile-section-header">
                      <h3 className="search-section-title">Tracks</h3>
                      <div className="playlist-track-search playlist-track-search-inline">
                        <input
                          type="text"
                          value={playlistTrackQuery}
                          onChange={(event) =>
                            setPlaylistTrackQuery(event.target.value)
                          }
                          placeholder={`Search in ${viewingProfile ? userProfile?.username || "profile" : selectedArtist?.username || "profile"}`}
                          aria-label="Search profile tracks"
                        />
                      </div>
                    </div>
                    {filteredProfileTracks.length === 0 ? (
                      <div className="playlist-loading">
                        No tracks found.
                      </div>
                    ) : (
                      <>
                        {renderTrackRows(visibleProfileTracks, "profile-track")}
                        {!profileTracksExpanded &&
                          filteredProfileTracks.length > 5 && (
                            <button
                              type="button"
                              className="load-more-btn"
                              onClick={() => setProfileTracksExpanded(true)}
                            >
                              View all
                            </button>
                          )}
                      </>
                    )}
                  </section>
                )}
                {(viewingProfile || viewingArtist) && (
                  <section className="search-section">
                    <div className="search-section-header">
                      <h3 className="search-section-title">Reposts</h3>
                    </div>
                    {filteredProfileReposts.length === 0 ? (
                      <div className="playlist-loading">
                        No reposted songs yet.
                      </div>
                    ) : (
                      renderTrackRows(filteredProfileReposts, "profile-repost")
                    )}
                  </section>
                )}
                {viewingProfile && (
                  <section className="search-section">
                    <div className="search-section-header">
                      <h3 className="search-section-title">
                        Listening History
                      </h3>
                    </div>
                    {historyLoading && listeningHistory.length === 0 ? (
                      <div className="playlist-loading">Loading...</div>
                    ) : historyError ? (
                      <div className="playlist-loading">{historyError}</div>
                    ) : listeningHistory.length === 0 ? (
                      <div className="playlist-loading">
                        No listening history yet.
                      </div>
                    ) : (
                      <>
                        <div className="track-list">
                          {listeningHistory.map((track: any, index: number) => (
                            <div
                              key={`history-${track.id || index}`}
                              className="track-row"
                              onClick={() =>
                                handleTrackClick(
                                  track,
                                  "playlist",
                                  listeningHistory,
                                )
                              }
                              onContextMenu={(event) =>
                                handleContextMenu(
                                  event,
                                  track,
                                  "playlist",
                                  listeningHistory,
                                )
                              }
                            >
                              <img
                                src={
                                  track.artwork_url?.replace(
                                    "-large",
                                    "-t200x200",
                                  ) || "/placeholder.png"
                                }
                                alt={track.title}
                                className="track-row-cover"
                                loading="lazy"
                                decoding="async"
                              />
                              <div className="track-row-info">
                                <div className="track-row-title">
                                  {track.title}
                                </div>
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
                                {track.created_at
                                  ? getYear(track.created_at)
                                  : "-"}
                              </div>
                              <div className="track-row-added">
                                {track.added_at
                                  ? formatTimeAgo(track.added_at)
                                  : track.created_at
                                    ? formatTimeAgo(track.created_at)
                                    : "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                        {(historyHasMore || historyLoadingMore) && (
                          <div
                            ref={historyScrollTriggerRef}
                            style={{
                              textAlign: "center",
                              padding: "24px 0 0",
                              color: "rgba(255,255,255,0.5)",
                              fontSize: "14px",
                            }}
                          >
                            {historyLoadingMore
                              ? "Loading older history..."
                              : "Scroll for older history"}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
                {!(viewingProfile || viewingArtist) &&
                  renderTrackRows(
                    visiblePlaylistTracks,
                    "playlist-track",
                    currentPlaylistId,
                  )}
                {viewingLikes && likesHasMore && (
                  <div
                    ref={scrollTriggerRef}
                    style={{
                      textAlign: "center",
                      padding: "32px 0 8px",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "14px",
                    }}
                  >
                    {isLoadingMore ? "Loading more..." : ""}
                  </div>
                )}
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
                          {renderHeartIcon(Boolean(likedPlaylists[album.id]))}
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
                          {renderHeartIcon(Boolean(likedPlaylists[playlist.id]))}
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
                {renderTrackRows(tracks, "search-track")}

                {searchHasMore && (
                  <div
                    ref={scrollTriggerRef}
                    style={{
                      textAlign: "center",
                      padding: "24px 0 0",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "14px",
                    }}
                  >
                    {isLoadingMore ? "Loading more..." : ""}
                  </div>
                )}
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
                              {renderHeartIcon(Boolean(likedPlaylists[album.id]))}
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
                              {renderHeartIcon(Boolean(likedPlaylists[playlist.id]))}
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
                    {tracks.length > 15 && (
                      <button
                        className="search-view-more"
                        onClick={() => openSearchSection("tracks")}
                      >
                        View more
                      </button>
                    )}
                  </div>
                  {renderSearchTrackCards(visibleTrackPreview)}
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
              onClick={async () => {
                await toggleTrackLike(contextMenu.item.id, contextMenu.item);
                closeContextMenu();
              }}
            >
              {likedTracks[contextMenu.item.id]
                ? "Remove from liked songs"
                : "Add to liked songs"}
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

      {/* Always render PlaylistMenu to keep Toast alive */}
      <div
        className="context-playlist-menu"
        style={{
          top: contextPlaylistMenu?.y,
          left: contextPlaylistMenu?.x,
          visibility: contextPlaylistMenu ? "visible" : "hidden",
          pointerEvents: contextPlaylistMenu ? "auto" : "none",
        }}
      >
        <PlaylistMenu
          trackId={contextPlaylistMenu?.trackId || ""}
          isOpen={!!contextPlaylistMenu}
          onClose={() => setContextPlaylistMenu(null)}
          playlistsWithTrack={playlistsWithTrack}
        />
      </div>

      <MobilePlaylistSheet
        trackId={mobileRowPlaylistTrack?.id || ""}
        isOpen={!!mobileRowPlaylistTrack}
        onClose={() => setMobileRowPlaylistTrack(null)}
        playlistsWithTrack={
          mobileRowPlaylistTrack?.id
            ? rowTrackPlaylistsMap[mobileRowPlaylistTrack.id] || []
            : []
        }
      />

      <Toast
        playlistName=""
        playlistArtwork=""
        message={likeToast.message}
        artwork={likeToast.artwork}
        isVisible={likeToast.visible}
        onDismiss={() =>
          setLikeToast((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      />

      {viewingTrack && trackPanelMinimized && selectedTrack ? (
        <button
          className="track-panel-restore"
          onClick={() => {
            clearTrackPanelTimer();
            setTrackPanelMinimized(false);
            setTrackPanelState("opening");
            scheduleTrackPanelState(() => setTrackPanelState("open"));
          }}
          aria-label="Restore track panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 7.5L6 3.5l4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      {viewingTrack && !trackPanelMinimized && selectedTrack ? (
        <TrackDetailView
          track={selectedTrack}
          panelState={trackPanelState}
          onArtistClick={handleArtistClick}
          onPlayTrack={handleTrackPanelPlay}
          onClose={() => {
            clearTrackPanelTimer();
            setTrackPanelMinimized(false);
            setTrackPanelState("closing");
            scheduleTrackPanelState(() => {
              setViewingTrack(false);
              setSelectedTrack(null);
              setTrackPanelMinimized(false);
              setTrackPanelState("open");
            });
          }}
          onMinimize={() => {
            clearTrackPanelTimer();
            setTrackPanelState("minimizing");
            scheduleTrackPanelState(() => {
              setTrackPanelMinimized(true);
              setTrackPanelState("minimized");
            });
          }}
        />
      ) : null}

      <Player
        currentTrack={currentTrack}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onTrackEnd={handleNext}
        onArtistClick={handleArtistClick}
        onPlaylistClick={handlePlayerPlaylistClick}
        onTrackOpen={handleTrackPageOpen}
        queue={queue}
        currentQueueIndex={currentQueueIndex}
        listeningHistory={listeningHistory}
        historyHasMore={historyHasMore}
        historyLoadingMore={historyLoadingMore}
        onRequestMoreHistory={loadMoreHistory}
        queueSource={queueSource}
        onQueueSelect={handleTrackClick}
        isShuffle={isShuffle}
        onShuffleChange={setIsShuffle}
      />
    </div>
  );
}






















