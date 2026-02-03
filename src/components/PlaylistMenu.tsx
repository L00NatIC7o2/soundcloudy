import { useEffect, useRef, useState } from "react";

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

export default function PlaylistMenu({
  trackId,
  onClose,
  isOpen,
  playlistsWithTrack = [],
}: PlaylistMenuProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
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
    if (playlistsWithTrack.includes(playlistId)) {
      alert("Track is already in this playlist");
      return;
    }

    setAddingTo(playlistId);
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
        const error = await response.json();
        throw new Error(error.error || "Failed to add to playlist");
      }

      alert("Track added to playlist!");
      onClose();
    } catch (error) {
      console.error("Failed to add to playlist:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setAddingTo(null);
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

  if (!isOpen) return null;

  return (
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
            const isInPlaylist = playlistsWithTrack.includes(playlist.id);
            return (
              <button
                key={playlist.id}
                className="playlist-menu-item"
                onClick={() => handleAddToPlaylist(playlist.id)}
                disabled={addingTo === playlist.id || isInPlaylist}
                title={
                  isInPlaylist ? "Already in this playlist" : "Add to playlist"
                }
              >
                <img
                  src={getPlaylistCover(playlist)}
                  alt={playlist.title}
                  className="playlist-menu-item-artwork"
                />
                <span className="playlist-menu-item-title">
                  {playlist.title}
                </span>
                {isInPlaylist && (
                  <img
                    src="https://img.icons8.com/parakeet-line/50/checked.png"
                    alt="In playlist"
                    className="playlist-menu-item-check"
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
