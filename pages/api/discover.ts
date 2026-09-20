import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer"; // Back to standard puppeteer
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getRequestSoundCloudWebCredentials,
  requireSoundCloudAccessToken,
} from "../../src/server/auth/soundcloud";

const DISCOVER_CACHE_VERSION = 2;
const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000;

// 1. Setup local storage path (Works on Windows/Linux/Mac)
const getStoragePath = () => {
  const root =
    process.env.APPDATA ||
    (os.platform() === "darwin"
      ? path.join(os.homedir(), "Library", "Preferences")
      : os.homedir());
  const dir = path.join(root, "soundcloudy");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "discover-cache.json");
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await requireSoundCloudAccessToken(req, res);
  if (!token)
    return res.status(401).json({ error: "Not authenticated", sections: [] });

  const cachePath = getStoragePath();

  // 2. Check Local File Cache
  if (fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    const cacheVersion = Number(cached?.version || 0);
    const isFresh = Date.now() - cached.timestamp < DISCOVER_CACHE_TTL_MS;
    const canUseDiskCache =
      process.env.NODE_ENV === "production" &&
      cacheVersion === DISCOVER_CACHE_VERSION &&
      isFresh;
    if (canUseDiskCache) {
      console.log("Returning data from local disk cache");
      return res.status(200).json(cached.data);
    }
  }

  const sections: any[] = [];
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const baseUrl = `${protocol}://${req.headers.host}`;
  const requestHeaders = { Cookie: req.headers.cookie || "" };

  try {
    // 3. API Fetching (Fastest)
    console.log("Fetching API sections...");

    const existingWebCredentials = await getRequestSoundCloudWebCredentials(
      req,
      res,
    );
    if (!existingWebCredentials?.clientId) {
      try {
        console.log("Priming SoundCloud web credentials from listening history...");
        await axios.get(
          `${baseUrl}/api/listening-history?limit=1&scrape=1&force=1&cache=1`,
          {
            headers: requestHeaders,
          },
        );
      } catch (error) {
        console.log("Listening history credential prime skip");
      }
    }

    let recentlyPlayedItems: any[] = [];

    // Recently Played should mirror listening history directly.
    try {
      const listeningHistory = await axios.get(
        `${baseUrl}/api/listening-history?limit=20&cache=1&scrape=1`,
        {
          headers: requestHeaders,
        },
      );
      if (
        Array.isArray(listeningHistory.data.items) &&
        listeningHistory.data.items.length
      ) {
        sections.push({
          title: "Recently Played",
          items: listeningHistory.data.items,
        });
      }
    } catch (e) {
      console.log("Listening history section skip");
    }

    // Recommended For You can stay on the recent activity feed for now.
    try {
      const hist = await axios.get(`${baseUrl}/api/recently-played?limit=20`, {
        headers: requestHeaders,
      });
      if (Array.isArray(hist.data.items) && hist.data.items.length) {
        recentlyPlayedItems = hist.data.items;
        sections.push({ title: "Recommended For You", items: hist.data.items });
      }
    } catch (e) {
      console.log("Recent activity recommendation skip");
    }

    // Homepage recommendation fallback, independent of Puppeteer sniffing.
    if (recentlyPlayedItems.length === 0) {
      try {
        const related = await axios.get(`${baseUrl}/api/related-tracks?for=homepage`, {
          headers: requestHeaders,
        });
        if (Array.isArray(related.data?.tracks) && related.data.tracks.length) {
          sections.push({
            title: "Recommended For You",
            items: related.data.tracks,
          });
        }
      } catch (e) {
        console.log("Homepage recommendations skip");
      }
    }

    // 4. Puppeteer Sniffer (For personalized mixed-selections)
    try {
      console.log("Launching browser to sniff api-v2...");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });

      try {
        const page = await browser.newPage();
        const sniffedSections: any[] = [];
        const sniffedSectionTitles = new Set<string>();
        const responseTasks: Promise<void>[] = [];
        await page.setCookie({
          name: "oauth_token",
          value: token,
          domain: ".soundcloud.com",
          path: "/",
          secure: true,
        });

        // Listen for the internal mixed-selections API
        page.on("response", async (response) => {
          const task = (async () => {
            const url = response.url();
            if (!url.includes("api-v2.soundcloud.com/mixed-selections")) {
              return;
            }
            if (response.request().method() === "OPTIONS") {
              return;
            }
            const contentType = response.headers()["content-type"] || "";
            if (!/json/i.test(contentType)) {
              return;
            }

            try {
              const bodyText = await response.text();
              if (!bodyText?.trim()) {
                return;
              }
              const data = JSON.parse(bodyText);
              data.collection?.forEach((s: any) => {
                const title = s.title || "For You";
                const items = Array.isArray(s.items?.collection)
                  ? s.items.collection
                  : [];
                if (!items.length) return;
                if (sniffedSectionTitles.has(title)) return;
                sniffedSectionTitles.add(title);
                sniffedSections.push({
                  title,
                  items,
                });
              });
            } catch (error) {
              console.error("Mixed selections parse failed:", error);
            }
          })();

          responseTasks.push(task);
        });

        await page.goto("https://soundcloud.com/discover", {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await page.waitForNetworkIdle({ idleTime: 800, timeout: 8000 }).catch(
          () => {},
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await Promise.allSettled(responseTasks);

        if (sniffedSections.length) {
          console.log(
            "Discover mixed sections found:",
            sniffedSections.map((section) => section.title),
          );
          sections.push(...sniffedSections);
        } else {
          console.log("No mixed sections captured from discover page");
        }
      } finally {
        await browser.close();
      }
    } catch (error: any) {
      console.error("Discover Puppeteer fallback failed:", error?.message || error);
    }

    // 5. Save to Local Cache
    const result = { sections };
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        version: DISCOVER_CACHE_VERSION,
        data: result,
        timestamp: Date.now(),
      }),
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Discover Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

