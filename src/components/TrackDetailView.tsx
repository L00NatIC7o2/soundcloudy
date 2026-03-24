import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  fetchTrackDetails,
  getCachedTrackDetails,
  type TrackDetails,
} from "../lib/trackDetails";

type ArtistLike = {
  id?: number;
  username?: string;
  permalink_url?: string;
  avatar_url?: string;
};

type Props = {
  track: any;
  panelState: "open" | "opening" | "minimizing" | "minimized" | "closing";
  onArtistClick?: (artist: any) => void;
  onPlayTrack: (track: any) => void;
  onClose: () => void;
  onMinimize: () => void;
};

export default function TrackDetailView({
  track,
  panelState,
  onArtistClick,
  onPlayTrack,
  onClose,
  onMinimize,
}: Props) {
  const getTrackArtwork = (item: any, fallbackArtist?: ArtistLike | null) =>
    item?.artwork_url?.replace?.("-large", "-t500x500") ||
    item?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    fallbackArtist?.avatar_url?.replace?.("-large", "-t500x500") ||
    null;

  const [details, setDetails] = useState<TrackDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(5);

  useEffect(() => {
    if (!track?.id) {
      setDetails(null);
      return;
    }

    setVisibleCommentsCount(5);
    const cached = getCachedTrackDetails(track.id);
    if (cached) {
      setDetails(cached);
      setError(null);
      setLoading(false);
    } else {
      setDetails(null);
      setLoading(true);
    }

    let cancelled = false;
    setError(null);

    fetchTrackDetails(track.id)
      .then((data) => {
        if (!cancelled) {
          setDetails(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load track");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  const displayArtist = useMemo(
    () => details?.artist || track?.user || track?.artist || null,
    [details, track],
  );
  const displayTitle = details?.title || track?.title || "Track";
  const stats = [
    {
      label: "Plays",
      value:
        details?.play_count ??
        track?.play_count ??
        track?.playback_count ??
        0,
    },
    {
      label: "Likes",
      value: details?.likes_count ?? track?.likes_count ?? track?.favoritings_count ?? 0,
    },
    {
      label: "Reposts",
      value: details?.reposts_count ?? track?.reposts_count ?? 0,
    },
  ];
  const trackBio = details?.bio || track?.description || "";
  const displayArtwork =
    getTrackArtwork(track, displayArtist) ||
    getTrackArtwork(details, displayArtist) ||
    "/placeholder.png";
  const comments = details?.comments || [];
  const relatedTracks = details?.related_tracks || [];
  const visibleComments = comments.slice(0, visibleCommentsCount);
  const canShowMoreComments = visibleCommentsCount < comments.length;
  const panelStyle = {
    "--track-panel-artwork": `url("${displayArtwork}")`,
  } as CSSProperties;

  const renderBio = (bio: string) => {
    if (!bio) return null;

    return bio.split(/(@\w+)/g).map((part, index) => {
      if (!part.startsWith("@")) {
        return <span key={`${part}-${index}`}>{part}</span>;
      }

      return (
        <span key={`${part}-${index}`} style={{ color: "#ff5500" }}>
          {part}
        </span>
      );
    });
  };

  return (
    <section
      className={`track-panel-shell track-panel-shell-${panelState}`}
      aria-label="Track panel"
    >
      <div className="track-panel-card" style={panelStyle}>
        <div className="track-panel-header-actions">
          <button
            type="button"
            className="track-panel-window-btn"
            onClick={onMinimize}
            aria-label="Minimize track panel"
            title="Minimize"
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
            className="track-panel-window-btn close"
            onClick={onClose}
            aria-label="Close track panel"
            title="Close"
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
        <div className="track-panel-scroll">
          <div className="playlist-header-sticky track-panel-header">
            <img
              src={displayArtwork}
              alt={displayTitle}
              className="playlist-header-cover"
              loading="eager"
              decoding="async"
            />
            <div className="track-page-text">
              <h2 className="playlist-header-title">{displayTitle}</h2>
              {displayArtist?.username ? (
                <div
                  className="track-page-artist"
                  onClick={() => {
                    if (displayArtist?.id && onArtistClick) {
                      onArtistClick(displayArtist);
                    }
                  }}
                  style={{ cursor: displayArtist?.id ? "pointer" : "default" }}
                >
                  {displayArtist.username}
                </div>
              ) : null}
            </div>
          </div>

          <div className="track-panel-body">
            {error ? (
              <div className="track-page-placeholder">
                {error}. Showing available track info.
              </div>
            ) : null}

            <div className="track-panel-stats">
              {stats.map((stat) => (
                <div key={stat.label} className="track-panel-stat">
                  <div className="track-panel-stat-label">{stat.label}</div>
                  <div className="track-panel-stat-value">
                    {Number(stat.value || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {trackBio ? (
              <section>
                <h3 className="search-section-title">About This Track</h3>
                <div className="track-panel-copy">{renderBio(trackBio)}</div>
              </section>
            ) : null}

            <section>
              <h3 className="search-section-title">Comments</h3>
              {loading && comments.length === 0 ? (
                <div className="track-page-placeholder">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="track-page-placeholder">No comments yet.</div>
              ) : (
                <div className="track-panel-comments">
                  {visibleComments.map((comment) => (
                    <div key={comment.id} className="track-panel-comment">
                      <div className="track-panel-comment-head">
                        <img
                          src={comment.user.avatar_url || "/placeholder.png"}
                          alt={comment.user.username}
                          width={36}
                          height={36}
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                        <div>
                          <div className="track-panel-comment-user">
                            {comment.user.username}
                          </div>
                          <div className="track-panel-comment-time">
                            {new Date(comment.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="track-panel-comment-body">{comment.body}</div>
                    </div>
                  ))}
                  {canShowMoreComments ? (
                    <button
                      type="button"
                      className="track-panel-more"
                      onClick={() => setVisibleCommentsCount((prev) => prev + 10)}
                    >
                      View more comments
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            <section>
              <h3 className="search-section-title">Related Tracks</h3>
              {loading && relatedTracks.length === 0 ? (
                <div className="track-page-placeholder">Loading related tracks...</div>
              ) : relatedTracks.length === 0 ? (
                <div className="track-page-placeholder">No related tracks found.</div>
              ) : (
                <div className="library-grid">
                  {relatedTracks.map((relatedTrack) => {
                    const relatedArtist =
                      relatedTrack.user?.username ||
                      relatedTrack.artist?.username ||
                      "Unknown";
                    const relatedArtwork =
                      getTrackArtwork(
                        relatedTrack,
                        relatedTrack.user || relatedTrack.artist,
                      ) || "/placeholder.png";

                    return (
                      <div
                        key={relatedTrack.id}
                        className="track-card"
                        onClick={() => onPlayTrack(relatedTrack)}
                      >
                        <img
                          src={relatedArtwork}
                          alt={relatedTrack.title}
                          className="track-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="track-info clickable">
                          <div className="track-title">{relatedTrack.title}</div>
                          <div className="track-artist">{relatedArtist}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}






