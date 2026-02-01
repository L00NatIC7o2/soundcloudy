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
    // Fetch recently played tracks
    fetch("/api/recently-played")
      .then((res) => res.json())
      .then((data) => setRecentlyPlayed(data.tracks || []));

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

  return (
    <div className="homepage-container">
      <section className="homepage-section">
        <h2>Recently Played</h2>
        <div className="tracks-grid">
          {recentlyPlayed.map((track) => (
            <div
              key={track.id}
              className="track-card"
              onClick={() => onTrackClick(track, "playlist", recentlyPlayed)}
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
        <h2>More of What You Like</h2>
        <div className="tracks-grid">
          {moreOfWhatYouLike.map((track) => (
            <div
              key={track.id}
              className="track-card"
              onClick={() => onTrackClick(track, "search", moreOfWhatYouLike)}
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
