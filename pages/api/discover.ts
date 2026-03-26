import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer"; // Back to standard puppeteer
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

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
    if (Date.now() - cached.timestamp < 3600000) {
      // 1 hour cache
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

    // Recently Played (calling your local endpoint)
    try {
      const hist = await axios.get(`${baseUrl}/api/recently-played?limit=20`, {
        headers: requestHeaders,
      });
      if (Array.isArray(hist.data.items) && hist.data.items.length)
        sections.push({ title: "Recently Played", items: hist.data.items });
    } catch (e) {
      console.log("Recent API skip");
    }

    // Homepage recommendation fallback, independent of Puppeteer sniffing.
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

    // 4. Puppeteer Sniffer (For personalized mixed-selections)
    try {
      console.log("Launching browser to sniff api-v2...");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });

      try {
        const page = await browser.newPage();
        await page.setCookie({
          name: "oauth_token",
          value: token,
          domain: ".soundcloud.com",
          path: "/",
          secure: true,
        });

        // Listen for the internal mixed-selections API
        page.on("response", async (response) => {
          const url = response.url();
          if (url.includes("api-v2.soundcloud.com/mixed-selections")) {
            try {
              const data = await response.json();
              data.collection?.forEach((s: any) => {
                if (s.items?.collection?.length) {
                  sections.push({
                    title: s.title || "For You",
                    items: s.items.collection,
                  });
                }
              });
            } catch {}
          }
        });

        await page.goto("https://soundcloud.com/discover", {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
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
      JSON.stringify({ data: result, timestamp: Date.now() }),
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Discover Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

