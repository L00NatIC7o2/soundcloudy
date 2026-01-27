import { Player } from "./components/Player";
import { soundcloudService } from "./services/soundcloudService";
import type { Track } from "./types/soundcloud";
import { config } from "./config";

const player = new Player();

let accessToken: string | null = null;

// First, user clicks "Login with SoundCloud"
const loginBtn = document.createElement("button");
loginBtn.textContent = "Login with SoundCloud";
loginBtn.addEventListener("click", () => {
  const CLIENT_ID = "uhlkXHnXoaAxIjoziy18peYV5eSwuMLz";
  const REDIRECT_URI = "https://notyourniche.com/soundcloudy/callback";
  const authUrl = `https://secure.soundcloud.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=non-expiring`;
  window.location.href = authUrl;
});
document.getElementById("app")?.prepend(loginBtn);

// After redirect back, extract token from URL
const params = new URLSearchParams(window.location.search);
if (params.has("access_token")) {
  accessToken = params.get("access_token");
  console.log("Token obtained:", accessToken);
}

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const tracksList = document.getElementById("tracksList");
const trackInfo = document.getElementById("trackInfo");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");

console.log("Client ID:", config.clientId); // Debug line

searchBtn?.addEventListener("click", async () => {
  if (!accessToken) {
    alert("Please login first");
    return;
  }

  const query = searchInput.value.trim();
  try {
    tracksList!.innerHTML = "<li>Searching...</li>";
    const response = await fetch(`/api/search?q=${query}&token=${accessToken}`);
    const data = await response.json();
    const tracks = data.collection || [];

    if (!tracks.length) {
      tracksList!.innerHTML = "<li>No tracks found</li>";
      return;
    }

    displayTracks(tracks);
  } catch (error) {
    tracksList!.innerHTML = "<li>Error searching</li>";
  }
});

function displayTracks(tracks: Track[]): void {
  if (!tracksList) return;

  tracksList.innerHTML = tracks
    .map(
      (track) => `
    <li class="track-item">
      <img src="${track.artwork_url || "https://via.placeholder.com/50"}" alt="${track.title}" class="track-image" />
      <div class="track-details">
        <div class="track-title">${track.title}</div>
        <div class="track-artist">${track.user?.username || "Unknown Artist"}</div>
      </div>
      <button class="play-track-btn" data-id="${track.id}">Play</button>
    </li>
  `,
    )
    .join("");

  document.querySelectorAll(".play-track-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const trackId = parseInt(
        (e.target as HTMLElement).getAttribute("data-id") || "0",
      );
      try {
        const track = await soundcloudService.getTrack(trackId);
        player.play(track);
        updateTrackInfo(track);
      } catch (error) {
        console.error("Play error:", error);
        alert("Could not play track");
      }
    });
  });
}

function updateTrackInfo(track: Track): void {
  if (!trackInfo) return;

  trackInfo.innerHTML = `
    <img src="${track.artwork_url || "https://via.placeholder.com/80"}" alt="${track.title}" />
    <div>
      <div class="current-title">${track.title}</div>
      <div class="current-artist">${track.user?.username || "Unknown"}</div>
    </div>
  `;
}

playBtn?.addEventListener("click", () => {
  const currentTrack = player.getCurrentTrack();
  if (currentTrack) {
    player.play(currentTrack);
  }
});

pauseBtn?.addEventListener("click", () => {
  player.pause();
});
