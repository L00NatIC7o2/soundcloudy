import { useEffect, useRef, useState, memo } from "react";
import Toast from "./Toast";

interface Playlist {
  id: number;
  title: string;
  artwork_url: string | null;
  tracks?: Array<{ artwork_url?: string | null }>;
}

interface PlaylistMenuProps {
  trackId: number | string;
  onClose: () => void;
  isOpen: boolean;
  playlistsWithTrack?: number[]; // Array of playlist IDs that already contain this track
}

const PlaylistMenu = memo(function PlaylistMenu({
  trackId,
  onClose,
  isOpen,
  playlistsWithTrack = [],
}: PlaylistMenuProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [removingFrom, setRemovingFrom] = useState<number | null>(null);
  // local copy of playlistsWithTrack so we can mutate when we add/remove inside menu
  const [localPlaylistsWithTrack, setLocalPlaylistsWithTrack] =
    useState<number[]>(playlistsWithTrack);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastPlaylist, setToastPlaylist] = useState<{
    name: string;
    artwork: string;
  } | null>(null);
  const [toastAction, setToastAction] = useState<"add" | "remove">("add");
  const [hoveredRemove, setHoveredRemove] = useState<number | null>(null);

  // if the incoming prop changes we should update local copy
  useEffect(() => {
    setLocalPlaylistsWithTrack(playlistsWithTrack);
  }, [playlistsWithTrack]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/playlists");
      const data = await response.json();
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewPlaylist = async () => {
    const playlistName = prompt("Enter playlist name:");
    if (!playlistName) return;

    try {
      // This would need a new API endpoint to create playlists
      alert("Create playlist feature coming soon");
    } catch (error) {
      console.error("Failed to create playlist:", error);
      alert("Failed to create playlist");
    }
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!trackId) {
      console.warn("handleAddToPlaylist called without trackId");
      alert("No track selected");
      return;
    }

    if (localPlaylistsWithTrack.includes(playlistId)) {
      alert("Track is already in this playlist");
      return;
    }

    setAddingTo(playlistId);

    // Refresh token first to ensure it's fresh
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
          body: JSON.stringify({
            playlistId,
            trackId,
          }),
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
              console.log(
                `Quota exceeded, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`,
              );
              alert(
                `SoundCloud rate limit hit. Retrying in ${Math.ceil(delay / 1000)}s... (attempt ${retryCount}/${maxRetries})`,
              );
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
          console.error("add-to-playlist failed", response.status, errorBody);
          const msg =
            errorBody.error ||
            errorBody.message ||
            errorBody.raw ||
            (typeof errorBody === "object"
              ? JSON.stringify(errorBody)
              : errorBody) ||
            response.statusText;
          throw new Error(msg || "Failed to add to playlist");
        }

        // Show toast notification instead of alert
        const playlist = playlists.find((p) => p.id === playlistId);
        if (playlist) {
          setToastPlaylist({
            name: playlist.title,
            artwork: getPlaylistCover(playlist),
          });
          setToastAction("add");
          setToastVisible(true);
          setLocalPlaylistsWithTrack((prev) => [...prev, playlist.id]);
          // Notify app that playlist membership changed so global caches can update
          try {
            window.dispatchEvent(
              new CustomEvent("playlist-membership-changed", {
                detail: { trackId, playlistId: playlist.id, action: "add" },
              }),
            );
          } catch (err) {
            /* ignore */
          }
          setAddingTo(null);
          // Don't close the menu - let user close it manually
        }
      } catch (error) {
        setAddingTo(null);
        console.error("Failed to add to playlist:", error);
        const msg =
          error instanceof Error ? error.message : "Failed to add track";
        alert(`Error: ${msg}`);
      }
    };

    await attemptAdd();
  };

  const handleRemoveFromPlaylist = async (
    playlistId: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    if (!trackId) {
      console.warn("handleRemoveFromPlaylist called without trackId");
      return;
    }

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
        body: JSON.stringify({
          playlistId,
          trackId,
        }),
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

      // Show removal toast
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
        } catch (err) {
          /* ignore */
        }
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

  if (!isOpen && !toastVisible) return null;

  return (
    <>
      {isOpen && (
        <div ref={menuRef} className="playlist-menu">
          <div className="playlist-menu-header">Add to Playlist</div>

          <button
            className="playlist-menu-create"
            onClick={handleCreateNewPlaylist}
          >
            <span>+ Create New Playlist</span>
          </button>

          <div className="playlist-menu-separator"></div>

          <div className="playlist-menu-list">
            {loading ? (
              <div className="playlist-menu-loading">Loading playlists...</div>
            ) : playlists.length === 0 ? (
              <div className="playlist-menu-empty">No playlists yet</div>
            ) : (
              playlists.map((playlist) => {
                const isInPlaylist = localPlaylistsWithTrack.includes(
                  playlist.id,
                );
                return (
                  <div
                    key={playlist.id}
                    className="playlist-menu-item"
                    title={
                      isInPlaylist ? "Remove from playlist" : "Add to playlist"
                    }
                  >
                    {isInPlaylist ? (
                      <button className="playlist-menu-item-button" disabled>
                        <img
                          src={getPlaylistCover(playlist)}
                          alt={playlist.title}
                          className="playlist-menu-item-artwork"
                        />
                        <span className="playlist-menu-item-title">
                          {playlist.title}
                        </span>
                      </button>
                    ) : (
                      <button
                        className="playlist-menu-item-button"
                        onClick={() => handleAddToPlaylist(playlist.id)}
                        disabled={addingTo === playlist.id}
                      >
                        <img
                          src={getPlaylistCover(playlist)}
                          alt={playlist.title}
                          className="playlist-menu-item-artwork"
                        />
                        <span className="playlist-menu-item-title">
                          {playlist.title}
                        </span>
                      </button>
                    )}
                    {isInPlaylist && (
                      <button
                        className="playlist-menu-item-remove"
                        onClick={(e) =>
                          handleRemoveFromPlaylist(playlist.id, e)
                        }
                        onMouseEnter={() => setHoveredRemove(playlist.id)}
                        onMouseLeave={() => setHoveredRemove(null)}
                        disabled={removingFrom === playlist.id}
                        aria-label="Remove from playlist"
                      >
                        <img
                          src={
                            hoveredRemove === playlist.id
                              ? "https://img.icons8.com/ios-glyphs/30/ffffff/multiply.png"
                              : "https://img.icons8.com/parakeet-line/50/checked.png"
                          }
                          alt={
                            hoveredRemove === playlist.id
                              ? "Click to remove"
                              : "In playlist - click to remove"
                          }
                          className="playlist-menu-item-check"
                        />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
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

export default PlaylistMenu;
