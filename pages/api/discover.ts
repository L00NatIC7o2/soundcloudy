import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer";
import axios from "axios";
import fs from "fs";
import path from "path";

// Cache the discover data for 1 hour
const discoverCache: {
  data: any;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Load cached credentials
function loadCachedCredentials() {
  try {
    const appData =
      process.env.APPDATA ||
      path.join(require("os").homedir(), "AppData", "Roaming");
    const credPath = path.join(appData, "soundcloudy", "sc-credentials.json");

    if (fs.existsSync(credPath)) {
      const cached = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      const age = Date.now() - cached.timestamp;

      // Cache valid for 24 hours
      if (age < 24 * 60 * 60 * 1000) {
        return cached;
      }
    }
  } catch (e) {
    console.error("Failed to load cached credentials:", e);
  }
  return null;
}

async function scrapeDiscoverPage(token: string): Promise<any> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set authentication cookie
    await page.setCookie({
      name: "oauth_token",
      value: token,
      domain: ".soundcloud.com",
      path: "/",
      httpOnly: false,
      secure: true,
    });

    let extractedClientId: string | null = null;
    let extractedAppVersion: string | null = null;
    const apiResponses: any[] = [];

    // Intercept API requests to extract credentials and capture data
    await page.on("response", async (response) => {
      try {
        const url = response.url();
        if (
          url.includes("api-v2.soundcloud.com") ||
          url.includes("api.soundcloud.com")
        ) {
          const parsedUrl = new URL(url);
          const clientId = parsedUrl.searchParams.get("client_id");
          const appVersion = parsedUrl.searchParams.get("app_version");

          if (clientId && !extractedClientId) {
            extractedClientId = clientId;
            console.log("Extracted client_id from API request:", clientId);
          }
          if (appVersion && !extractedAppVersion) {
            extractedAppVersion = appVersion;
            console.log("Extracted app_version from API request:", appVersion);
          }

          // Capture mixed-selections and other relevant API responses
          if (
            url.includes("mixed-selections") ||
            url.includes("personalized")
          ) {
            try {
              const data = await response.json();
              apiResponses.push({ url, data });
              console.log("Captured API response from:", url);
            } catch (e) {
              // Can't parse as JSON
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    console.log("Navigating to SoundCloud discover page...");
    await page.goto("https://soundcloud.com/discover", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForSelector(".lazyLoadingList, .sound", { timeout: 15000 });

    // Give it a bit more time to load API responses
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Captured API responses:", apiResponses.length);

    // Parse the API responses into sections
    const sections: any[] = [];

    for (const { url, data } of apiResponses) {
      if (data.collection && Array.isArray(data.collection)) {
        // Determine section title based on URL or data
        let title = "Recommended";
        if (url.includes("personalized-tracks")) {
          title = "Daily Drops";
        } else if (url.includes("artist-stations")) {
          title = "Weekly Wave";
        } else if (url.includes("all-music")) {
          title = "More of What You Like";
        }

        const items = data.collection.map((item: any) => {
          // Handle both track and playlist items
          const isPlaylist =
            item.playlist ||
            item.kind === "playlist" ||
            item.kind === "system-playlist";
          const actualItem = item.playlist || item.track || item;

          return {
            kind: isPlaylist ? "system-playlist" : "track",
            id: actualItem.id,
            title: actualItem.title,
            username: actualItem.user?.username || "SoundCloud",
            permalink_url: actualItem.permalink_url,
            artwork_url: actualItem.artwork_url,
            track_count: actualItem.track_count || 0,
            user: actualItem.user,
          };
        });

        sections.push({ title, items });
      }
    }

    console.log("Extracted sections from API responses:", sections.length);

    return {
      sections,
      extractedClientId,
      extractedAppVersion,
    };
  } finally {
    await browser.close();
  }
}

async function fetchDiscoverDataViaAPI(token: string): Promise<any> {
  console.log("Fetching discover data using axios...");

  const sections: any[] = [];

  // 1. Fetch listening history as "Recently Played"
  try {
    console.log("Fetching recently played tracks from /api/recently-played...");
    const historyResponse = await axios.get(
      "http://localhost:3000/api/recently-played",
      {
        params: { limit: 20 },
        headers: {
          Cookie: `soundcloud_token=${token}`,
        },
        timeout: 10000,
      },
    );

    console.log("Recently played response status:", historyResponse.status);
    const items = (historyResponse.data.items || []).slice(0, 20);

    if (items.length > 0) {
      console.log(`Added ${items.length} recently played tracks`);
      sections.push({
        title: "Recently Played",
        items: items.map((track: any) => ({
          kind: "track",
          id: track.id,
          title: track.title,
          username: track.user?.username,
          permalink_url: track.permalink_url,
          artwork_url: track.artwork_url,
          user: track.user,
        })),
      });
    }
  } catch (e: any) {
    console.error("Failed to fetch recently played:", e.message);
  }

  // 2. Fetch user's liked tracks as "Your Likes"
  try {
    console.log("Fetching liked tracks from SoundCloud API...");
    const likesResponse = await axios.get(
      "https://api.soundcloud.com/me/favorites",
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 20 },
        timeout: 10000,
      },
    );

    console.log("Likes response status:", likesResponse.status);
    const rawLikes = Array.isArray(likesResponse.data)
      ? likesResponse.data
      : likesResponse.data?.collection || [];
    const items = rawLikes
      .map((item: any) => item?.track || item)
      .filter((item: any) => item && item.id)
      .slice(0, 20);

    if (items.length > 0) {
      console.log(`Added ${items.length} liked tracks`);
      sections.push({
        title: "Your Likes",
        items: items.map((track: any) => ({
          kind: "track",
          id: track.id,
          title: track.title,
          username: track.user?.username,
          permalink_url: track.permalink_url,
          artwork_url: track.artwork_url,
          user: track.user,
        })),
      });
    }
  } catch (e: any) {
    console.error("Failed to fetch likes:", e.message);
  }

  // 3. Fetch user's playlists
  try {
    console.log("Fetching playlists from SoundCloud API...");
    const playlistsResponse = await axios.get(
      "https://api.soundcloud.com/me/playlists",
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 20 },
        timeout: 10000,
      },
    );

    console.log("Playlists response status:", playlistsResponse.status);
    const items = (
      playlistsResponse.data.collection ||
      playlistsResponse.data ||
      []
    )
      .filter((item: any) => item && item.id)
      .slice(0, 20);

    if (items.length > 0) {
      console.log(`Added ${items.length} playlists`);
      sections.push({
        title: "Your Playlists",
        items: items.map((playlist: any) => ({
          kind: "playlist",
          id: playlist.id,
          title: playlist.title,
          username: playlist.user?.username,
          permalink_url: playlist.permalink_url,
          artwork_url: playlist.artwork_url,
          track_count: playlist.track_count || 0,
          user: playlist.user,
        })),
      });
    }
  } catch (e: any) {
    console.error("Failed to fetch playlists:", e.message);
  }

  // 4. Fetch recommended albums
  try {
    console.log("Fetching recommended albums from /api/recommended-albums...");
    const albumsResponse = await axios.get(
      "http://localhost:3000/api/recommended-albums",
      {
        headers: {
          Cookie: `soundcloud_token=${token}`,
        },
        timeout: 10000,
      },
    );

    console.log("Recommended albums response status:", albumsResponse.status);
    const items = (albumsResponse.data.albums || []).slice(0, 20);

    if (items.length > 0) {
      console.log(`Added ${items.length} recommended albums`);
      sections.push({
        title: "Albums For You",
        items: items.map((album: any) => ({
          kind: "playlist",
          id: album.id,
          title: album.title,
          username: album.user?.username,
          permalink_url: album.permalink_url,
          artwork_url: album.artwork_url,
          track_count: album.track_count || 0,
          user: album.user,
        })),
      });
    }
  } catch (e: any) {
    console.error("Failed to fetch recommended albums:", e.message);
  }

  console.log(`Successfully fetched ${sections.length} sections`);
  return { sections };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const token = req.cookies.soundcloud_token;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated", sections: [] });
    }

    // Check cache first
    const now = Date.now();
    if (discoverCache.data && now - discoverCache.timestamp < CACHE_TTL_MS) {
      console.log("Returning cached discover data");
      return res.status(200).json(discoverCache.data);
    }

    console.log("Cache miss or expired, fetching fresh discover data");

    // Try API first
    let result;
    try {
      result = await fetchDiscoverDataViaAPI(token);
      console.log(
        "Successfully fetched via API, sections:",
        result.sections?.length || 0,
      );

      // If we got sections, cache and return
      if (result.sections && result.sections.length > 0) {
        discoverCache.data = result;
        discoverCache.timestamp = now;
        return res.status(200).json(result);
      }
    } catch (apiError) {
      console.log("API fetch failed:", apiError);
    }

    // Skip scraping fallback for now, just return what we got from API
    console.log("API returned no sections, returning empty result");
    const emptyResult = { sections: [] };
    return res.status(200).json(emptyResult);
  } catch (error: any) {
    console.error("Error in discover API:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch discover data",
      sections: [],
    });
  }
}
