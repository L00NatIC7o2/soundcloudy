import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer"; // Back to standard puppeteer
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

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
  const token = req.cookies.soundcloud_token;
  if (!token)
    return res.status(401).json({ error: "Not authenticated", sections: [] });

  const cachePath = getStoragePath();
  const authHeader = { Authorization: `OAuth ${token}` };

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

  try {
    // 3. API Fetching (Fastest)
    console.log("Fetching API sections...");

    // Recently Played (calling your local endpoint)
    try {
      const hist = await axios.get(`${baseUrl}/api/recently-played?limit=20`, {
        headers: { Cookie: `soundcloud_token=${token}` },
      });
      if (hist.data.items)
        sections.push({ title: "Recently Played", items: hist.data.items });
    } catch (e) {
      console.log("Recent API skip");
    }

    // 4. Puppeteer Sniffer (For personalized mixed-selections)
    console.log("Launching browser to sniff api-v2...");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

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
    await browser.close();

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
