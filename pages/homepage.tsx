import { useEffect, useState } from "react";

export default function HomePage({
  onTrackClick,
  currentTrack,
  onPrevious,
  onNext,
  onTrackEnd,
}: {
  onTrackClick: (
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[],
  ) => void;
  currentTrack: any;
  onPrevious: () => void;
  onNext: () => void;
  onTrackEnd: () => void;
}) {
  const [recentlyPlayed, setRecentlyPlayed] = useState<any[]>([]);
  const [moreOfWhatYouLike, setMoreOfWhatYouLike] = useState<any[]>([]);
  const [recentlyReleased, setRecentlyReleased] = useState<any[]>([]);
  const [recommendedAlbums, setRecommendedAlbums] = useState<any[]>([]);

  useEffect(() => {
    // Fetch recently played items (tracks, playlists, albums)
    fetch("/api/recently-played")
      .then((res) => res.json())
      .then((data) => setRecentlyPlayed(data.items || []));

    // Fetch related tracks ("more of what you like")
    fetch("/api/related-tracks?for=homepage")
      .then((res) => res.json())
      .then((data) => setMoreOfWhatYouLike(data.tracks || []));

    // Fetch recently released songs from favorite artists (stub, implement endpoint)
    fetch("/api/recently-released")
      .then((res) => res.json())
      .then((data) => setRecentlyReleased(data.tracks || []));

    // Fetch recommended albums from favorite artists (stub, implement endpoint)
    fetch("/api/recommended-albums")
      .then((res) => res.json())
      .then((data) => setRecommendedAlbums(data.albums || []));
  }, []);

  const handleItemClick = (item: any) => {
    if (item.kind === "track") {
      const tracks = recentlyPlayed.filter((i) => i.kind === "track");
      onTrackClick(item, "playlist", tracks);
    } else if (item.kind === "playlist" || item.kind === "playlist-like") {
      // Handle playlist click - could navigate to playlist view
      console.log("Playlist clicked:", item);
    }
  };

  return (
    <div className="homepage-container">
      <section className="homepage-section">
        <h2>Recently Played</h2>
        <div className="horizontal-scroll">
          {recentlyPlayed.map((item) => (
            <div
              key={item.id}
              className="horizontal-card"
              onClick={() => handleItemClick(item)}
            >
              <img
                src={
                  item.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={item.title}
                className="horizontal-cover"
              />
              <div className="horizontal-info">
                <div className="horizontal-title">{item.title}</div>
                <div className="horizontal-subtitle">
                  {item.kind === "track" && (item.user?.username || "Unknown")}
                  {(item.kind === "playlist" ||
                    item.kind === "playlist-like") &&
                    `Playlist • ${item.track_count || 0} tracks`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>More of What You Like</h2>
        <div className="horizontal-scroll">
          {moreOfWhatYouLike.map((track) => (
            <div
              key={track.id}
              className="horizontal-card"
              onClick={() => onTrackClick(track, "search", moreOfWhatYouLike)}
            >
              <img
                src={
                  track.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={track.title}
                className="horizontal-cover"
              />
              <div className="horizontal-info">
                <div className="horizontal-title">{track.title}</div>
                <div className="horizontal-subtitle">
                  {track.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>Recently Released</h2>
        <div className="tracks-grid">
          {recentlyReleased.map((track) => (
            <div
              key={track.id}
              className="track-card"
              onClick={() => onTrackClick(track, "search", recentlyReleased)}
            >
              <img
                src={
                  track.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={track.title}
                className="track-cover"
              />
              <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">
                  {track.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="homepage-section">
        <h2>Recommended Albums</h2>
        <div className="albums-grid">
          {recommendedAlbums.map((album) => (
            <div key={album.id} className="album-card">
              <img
                src={
                  album.artwork_url?.replace("-large", "-t500x500") ||
                  "/placeholder.png"
                }
                alt={album.title}
                className="album-cover"
              />
              <div className="album-info">
                <div className="album-title">{album.title}</div>
                <div className="album-artist">
                  {album.user?.username || "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
