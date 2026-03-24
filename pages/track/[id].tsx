import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

interface Comment {
  id: string;
  user: {
    username: string;
    permalink_url: string;
    avatar_url: string;
  };
  body: string;
  timestamp: number;
}

interface TrackData {
  id: string;
  title: string;
  artist: {
    username: string;
    permalink_url: string;
    avatar_url: string;
  };
  play_count: number;
  likes_count: number;
  reposts_count: number;
  bio: string;
  comments: Comment[];
  related_tracks: Array<{
    id: string;
    title: string;
    artist: {
      username: string;
      permalink_url: string;
    };
    artwork_url: string;
  }>;
}

export default function TrackPage() {
  const router = useRouter();
  const { id } = router.query;
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const trackId = Array.isArray(id) ? id[0] : id;
    setLoading(true);
    setError(null);

    fetch(`/api/track/${trackId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load track");
        }
        return data;
      })
      .then((data) => {
        setTrack(data);
      })
      .catch((err) => {
        setTrack(null);
        setError(err instanceof Error ? err.message : "Failed to load track");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error || !track || !track.id || !track.title) {
    return (
      <div className="track-page-error">
        <h2>Track not found or incomplete</h2>
        <p>
          {error ||
            "Sorry, we couldn't load this track. It may be missing, deleted, or the ID is invalid."}
          <br />
          Please check the link or try again later.
        </p>
        <img
          src="/placeholder.png"
          alt="Missing track"
          width={180}
          style={{ borderRadius: 8, marginTop: 16 }}
        />
      </div>
    );
  }

  const relatedTracks = track.related_tracks ?? [];

  function renderBio(bio: string) {
    if (!bio) bio = "";
    return bio.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith("@")) {
        const username = part.slice(1);
        return (
          <Link
            key={i}
            href={`/artist/${username}`}
            style={{ color: "#ff5500" }}
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  }

  const comments = track.comments ?? [];

  return (
    <div className="track-page">
      <h1>{track.title}</h1>
      <div>
        {track.artist && track.artist.permalink_url && track.artist.permalink_url !== "#" ? (
          <Link href={track.artist.permalink_url} target="_blank">
            <img
              src={track.artist.avatar_url}
              alt={track.artist.username}
              width={40}
              style={{ borderRadius: "50%", marginRight: 8 }}
            />
            {track.artist.username}
          </Link>
        ) : (
          <span>
            <img
              src={track.artist?.avatar_url || "/placeholder.png"}
              alt={track.artist?.username || "Unknown"}
              width={40}
              style={{ borderRadius: "50%", marginRight: 8 }}
            />
            {track.artist?.username || "Unknown"}
          </span>
        )}
      </div>
      <div style={{ margin: "12px 0" }}>
        <span>Plays: {track.play_count}</span> |{" "}
        <span>Likes: {track.likes_count}</span> |{" "}
        <span>Reposts: {track.reposts_count}</span>
      </div>
      <div style={{ margin: "12px 0" }}>
        <strong>Bio:</strong> {renderBio(track.bio)}
      </div>
      <div style={{ margin: "24px 0" }}>
        <h2>Comments</h2>
        {comments.length === 0 ? (
          <div>No comments yet.</div>
        ) : (
          <ul>
            {comments.map((comment) => (
              <li key={comment.id} style={{ marginBottom: 16 }}>
                <Link href={comment.user.permalink_url} target="_blank">
                  <img
                    src={comment.user.avatar_url}
                    alt={comment.user.username}
                    width={32}
                    style={{ borderRadius: "50%", marginRight: 8 }}
                  />
                  <span style={{ color: "#ff5500" }}>
                    {comment.user.username}
                  </span>
                </Link>
                <span style={{ marginLeft: 8, color: "#888" }}>
                  {new Date(comment.timestamp * 1000).toLocaleString()}
                </span>
                <div style={{ marginTop: 4 }}>{comment.body}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ margin: "24px 0" }}>
        <h2>Related Tracks</h2>
        <div style={{ display: "flex", gap: 16 }}>
          {relatedTracks.length === 0 ? (
            <div>No related tracks found.</div>
          ) : (
            relatedTracks.map((rt) => (
              <div key={rt.id} style={{ width: 180 }}>
                <img
                  src={rt.artwork_url}
                  alt={rt.title}
                  width={180}
                  style={{ borderRadius: 8 }}
                />
                <div>
                  <Link href={`/track/${rt.id}`}>{rt.title}</Link>
                </div>
                <div>
                  {rt.artist.permalink_url && rt.artist.permalink_url !== "#" ? (
                    <Link
                      href={rt.artist.permalink_url}
                      target="_blank"
                      style={{ color: "#ff5500" }}
                    >
                      {rt.artist.username}
                    </Link>
                  ) : (
                    <span style={{ color: "#ff5500" }}>{rt.artist.username}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
