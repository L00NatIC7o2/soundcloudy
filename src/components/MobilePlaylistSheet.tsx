import { memo, useEffect, useRef, useState } from "react";
import Toast from "./Toast";

const PLAYLIST_CACHE_TTL_MS = 60_000;
let cachedPlaylists: Playlist[] | null = null;
let cachedPlaylistsAt = 0;

interface Playlist {
  id: number;
  title: string;
  artwork_url: string | null;
  tracks?: Array<{ artwork_url?: string | null }>;
}

interface MobilePlaylistSheetProps {
  trackId: number | string;
  isOpen: boolean;
  onClose: () => void;
  playlistsWithTrack?: number[];
}

const MobilePlaylistSheet = memo(function MobilePlaylistSheet({
  trackId,
  isOpen,
  onClose,
  playlistsWithTrack = [],
}: MobilePlaylistSheetProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [removingFrom, setRemovingFrom] = useState<number | null>(null);
  const [localPlaylistsWithTrack, setLocalPlaylistsWithTrack] =
    useState<number[]>(playlistsWithTrack);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastPlaylist, setToastPlaylist] = useState<{
    name: string;
    artwork: string;
  } | null>(null);
  const [toastAction, setToastAction] = useState<"add" | "remove">("add");
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalPlaylistsWithTrack(playlistsWithTrack);
  }, [playlistsWithTrack]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchPlaylists();
  }, [isOpen]);

  useEffect(() => {
    if (typeof document === "undefined" || !isOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  const fetchPlaylists = async () => {
    if (
      cachedPlaylists &&
      Date.now() - cachedPlaylistsAt < PLAYLIST_CACHE_TTL_MS
    ) {
      setPlaylists(cachedPlaylists);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/playlists");
      const data = await response.json();
      const nextPlaylists = data.playlists || [];
      setPlaylists(nextPlaylists);
      cachedPlaylists = nextPlaylists;
      cachedPlaylistsAt = Date.now();
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlaylistCover = (playlist: Playlist) => {
    if (playlist.artwork_url) {
      return playlist.artwork_url.replace("-large", "-t500x500");
    }
    if (playlist.tracks && playlist.tracks.length > 0) {
      const firstTrackArtwork = playlist.tracks[0]?.artwork_url;
      if (firstTrackArtwork) {
        return firstTrackArtwork.replace("-large", "-t500x500");
      }
    }
    return "/placeholder.png";
  };

  const handleCreateNewPlaylist = async () => {
    const playlistName = prompt("Enter playlist name:");
    if (!playlistName) return;
    alert("Create playlist feature coming soon");
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!trackId) return;
    if (localPlaylistsWithTrack.includes(playlistId)) return;

    setAddingTo(playlistId);

    try {
      await fetch("/api/auth/refresh", { method: "POST" });
    } catch (err) {
      console.warn("Token refresh failed (continuing anyway):", err);
    }

    const maxRetries = 3;
    let retryCount = 0;

    const attemptAdd = async (): Promise<void> => {
      try {
        const response = await fetch("/api/add-to-playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId, trackId }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            alert("Session expired, please log in again.");
            setAddingTo(null);
            return;
          }
          if (response.status === 403) {
            const text = await response.text();
            let errorBody: any = {};
            try {
              errorBody = JSON.parse(text);
            } catch {
              errorBody = { raw: text };
            }
            const msg = errorBody.error || "Request rate limited by SoundCloud";
            if (msg.includes("Quota") && retryCount < maxRetries) {
              retryCount++;
              const delay = Math.pow(2, retryCount) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
              return attemptAdd();
            }
            throw new Error(msg);
          }
          const text = await response.text();
          let errorBody: any = {};
          try {
            errorBody = JSON.parse(text);
          } catch {
            errorBody = { raw: text };
          }
          throw new Error(
            errorBody.error ||
              errorBody.message ||
              errorBody.raw ||
              response.statusText ||
              "Failed to add to playlist",
          );
        }

        const playlist = playlists.find((p) => p.id === playlistId);
        if (playlist) {
          setToastPlaylist({
            name: playlist.title,
            artwork: getPlaylistCover(playlist),
          });
          setToastAction("add");
          setToastVisible(true);
          setLocalPlaylistsWithTrack((prev) => [...prev, playlist.id]);
          try {
            window.dispatchEvent(
              new CustomEvent("playlist-membership-changed", {
                detail: { trackId, playlistId: playlist.id, action: "add" },
              }),
            );
          } catch {}
        }
      } catch (error) {
        console.error("Failed to add to playlist:", error);
        const msg =
          error instanceof Error ? error.message : "Failed to add track";
        alert(`Error: ${msg}`);
      } finally {
        setAddingTo(null);
      }
    };

    await attemptAdd();
  };

  const handleRemoveFromPlaylist = async (playlistId: number) => {
    if (!trackId) return;
    setRemovingFrom(playlistId);

    try {
      await fetch("/api/auth/refresh", { method: "POST" });
    } catch (err) {
      console.warn("Token refresh failed (continuing anyway):", err);
    }

    try {
      const response = await fetch("/api/remove-from-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId, trackId }),
      });

      if (!response.ok) {
        const text = await response.text();
        let errorBody: any = {};
        try {
          errorBody = JSON.parse(text);
        } catch {
          errorBody = { raw: text };
        }
        throw new Error(errorBody.error || "Failed to remove from playlist");
      }

      const playlist = playlists.find((p) => p.id === playlistId);
      if (playlist) {
        setToastPlaylist({
          name: playlist.title,
          artwork: getPlaylistCover(playlist),
        });
        setToastAction("remove");
        setToastVisible(true);
        setLocalPlaylistsWithTrack((prev) =>
          prev.filter((id) => id !== playlist.id),
        );
        try {
          window.dispatchEvent(
            new CustomEvent("playlist-membership-changed", {
              detail: { trackId, playlistId: playlist.id, action: "remove" },
            }),
          );
        } catch {}
      }
    } catch (error) {
      console.error("Failed to remove from playlist:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to remove track";
      alert(`Error: ${msg}`);
    } finally {
      setRemovingFrom(null);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientY ?? null;
    touchCurrentRef.current = touchStartRef.current;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchCurrentRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = () => {
    if (
      touchStartRef.current !== null &&
      touchCurrentRef.current !== null &&
      touchCurrentRef.current - touchStartRef.current > 90
    ) {
      onClose();
    }
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  if (!isOpen && !toastVisible) return null;

  return (
    <>
      <div
        className={`mobile-playlist-sheet ${isOpen ? "open" : ""}`}
        onClick={onClose}
      >
        <div
          className="mobile-playlist-sheet-panel"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mobile-playlist-sheet-handle" />
          <div className="mobile-playlist-sheet-top">
            <div className="mobile-playlist-sheet-title">Add to Playlist</div>
            <button
              type="button"
              className="mobile-playlist-sheet-close"
              onClick={onClose}
              aria-label="Close playlist sheet"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 15l6-6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <button
            type="button"
            className="mobile-playlist-sheet-create"
            onClick={handleCreateNewPlaylist}
          >
            + Create New Playlist
          </button>

          <div className="mobile-playlist-sheet-list">
            {loading ? (
              <div className="mobile-playlist-sheet-empty">Loading playlists...</div>
            ) : playlists.length === 0 ? (
              <div className="mobile-playlist-sheet-empty">No playlists yet</div>
            ) : (
              playlists.map((playlist) => {
                const isInPlaylist = localPlaylistsWithTrack.includes(playlist.id);
                return (
                  <div key={playlist.id} className="mobile-playlist-sheet-item">
                    <button
                      type="button"
                      className="mobile-playlist-sheet-item-main"
                      onClick={() =>
                        isInPlaylist
                          ? handleRemoveFromPlaylist(playlist.id)
                          : handleAddToPlaylist(playlist.id)
                      }
                      disabled={
                        addingTo === playlist.id || removingFrom === playlist.id
                      }
                    >
                      <img
                        src={getPlaylistCover(playlist)}
                        alt={playlist.title}
                        className="mobile-playlist-sheet-item-artwork"
                      />
                      <span className="mobile-playlist-sheet-item-title">
                        {playlist.title}
                      </span>
                      <span
                        className={`mobile-playlist-sheet-item-status ${isInPlaylist ? "in-playlist" : ""}`}
                      >
                        {addingTo === playlist.id
                          ? "Adding..."
                          : removingFrom === playlist.id
                            ? "Removing..."
                            : isInPlaylist
                              ? "Added"
                              : "Add"}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <Toast
        playlistName={toastPlaylist?.name || ""}
        playlistArtwork={toastPlaylist?.artwork || ""}
        isVisible={toastVisible}
        action={toastAction}
        onDismiss={() => setToastVisible(false)}
      />
    </>
  );
});

export default MobilePlaylistSheet;
