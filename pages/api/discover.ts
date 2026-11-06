import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer"; // Back to standard puppeteer
import axios from "axios";
import {
  getRequestSoundCloudWebCredentials,
  getStoredSoundCloudSession,
  requireSoundCloudAccessToken,
} from "../../src/server/auth/soundcloud";
import {
  getPersonalDataCache,
  setPersonalDataCache,
} from "../../apps/backend/src/server/cache/personalData";

const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await requireSoundCloudAccessToken(req, res);
  if (!token)
    return res.status(401).json({ error: "Not authenticated", sections: [] });

  const sessionState = await getStoredSoundCloudSession(req, res);
  const userId = sessionState?.session?.userId || sessionState?.tokens?.userId;
  const cachedDiscover = userId
    ? getPersonalDataCache<{ sections: any[] }>(userId, "discover")
    : undefined;
  if (cachedDiscover) {
    console.log("Returning personalized Discover data from cache");
    return res.status(200).json(cachedDiscover);
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
    if (process.env.SOUNDCLOUD_DISCOVER_SNIFFER_ENABLED === "false") {
      console.log("Skipping Discover browser sniffer because it is disabled");
    } else {
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
        console.error(
          "Discover Puppeteer fallback failed:",
          error?.message || error,
        );
      }
    }

    // Cache the personalized response per user.
    const result = { sections };
    if (userId) {
      setPersonalDataCache(
        userId,
        "discover",
        result,
        DISCOVER_CACHE_TTL_MS,
      );
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Discover Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
