import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import puppeteer from "puppeteer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/me", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 10000,
    });

    const user = response.data;

    console.log("User verified status:", user.verified);
    console.log("User badges:", user.badges);

    // Extract banner URL by scraping with Puppeteer
    let banner_url = null;
    let verified = false;
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      await page.goto(`https://soundcloud.com/${user.permalink}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Extract banner URL and verified status from the page
      const scrapedData = await page.evaluate(() => {
        let banner = null;
        let isVerified = false;

        // Look for the banner element
        const element = document.querySelector(
          ".profileHeaderBackground__visual",
        );

        if (element) {
          const style = element.getAttribute("style");
          if (style) {
            const match = style.match(/background-image:\s*url\(([^)]+)\)/);
            if (match && match[1]) {
              banner = match[1].replace(/^['"]|['"]$/g, "");
            }
          }
        }

        // Look for verified badge - try multiple selectors
        const verifiedBadge =
          document.querySelector(".sc-tag-verified") ||
          document.querySelector("[class*='verified']") ||
          document.querySelector("[title*='Verified']") ||
          document.querySelector("[aria-label*='Verified']");

        if (verifiedBadge) {
          isVerified = true;
          console.log("Found verified badge:", verifiedBadge.className);
        }

        return { banner, isVerified };
      });

      banner_url = scrapedData.banner;
      verified = scrapedData.isVerified;

      console.log("Puppeteer scraped banner_url:", banner_url);
      console.log("Puppeteer scraped verified:", verified);
    } catch (error) {
      console.error("Failed to scrape banner with Puppeteer:", error);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // Don't fallback to avatar - keep banner_url null if not found
    console.log("Final banner_url being returned:", banner_url);

    // Optionally fetch user's tracks
    let tracks = [];
    try {
      const tracksResponse = await axios.get(
        "https://api.soundcloud.com/users/" + user.id + "/tracks",
        {
          headers: {
            Authorization: `OAuth ${token}`,
          },
          params: {
            limit: 200,
            access: "playable",
          },
          timeout: 10000,
        },
      );
      tracks = Array.isArray(tracksResponse.data)
        ? tracksResponse.data
        : tracksResponse.data?.collection || [];
    } catch (error) {
      console.error("Failed to fetch user tracks:", error);
    }

    return res.json({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      banner_url: banner_url,
      description: user.description,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      track_count: user.track_count,
      verified: verified || false,
      tracks,
    });
  } catch (error: any) {
    console.error(
      "Profile fetch error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch profile" });
  }
}
