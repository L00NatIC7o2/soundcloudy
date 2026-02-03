import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * Extracts SoundCloud V2 Client ID by intercepting API requests
 * Requires auth cookie to access authenticated endpoints
 */
export async function extractSoundCloudV2ClientId(
  authToken: string,
): Promise<string | null> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set the authentication cookie
    await page.setCookie({
      name: "soundcloud_token",
      value: authToken,
      domain: "soundcloud.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    let capturedClientId: string | null = null;

    // Intercept requests to capture client_id from API calls
    await page.on("response", async (response) => {
      const url = response.url();
      // Look for API requests that contain client_id
      if (
        url.includes("api") &&
        url.includes("client_id") &&
        !capturedClientId
      ) {
        try {
          const urlObj = new URL(url);
          const clientId = urlObj.searchParams.get("client_id");
          if (clientId) {
            capturedClientId = clientId;
            console.log(`✓ Captured SoundCloud V2 Client ID: ${clientId}`);
          }
        } catch (e) {
          // URL parsing failed, continue
        }
      }
    });

    // Navigate to a page that will trigger API calls
    await page
      .goto("https://soundcloud.com/collection/playlists", {
        waitUntil: "networkidle2",
        timeout: 15000,
      })
      .catch(() => {
        // Ignore timeout errors - we might capture the ID before page fully loads
      });

    // Give it a moment to capture
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await browser.close();

    return capturedClientId;
  } catch (error) {
    console.error("Error extracting SoundCloud V2 Client ID:", error);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return null;
  }
}

/**
 * Saves credentials to .env.local file
 */
export function saveEnvFile(credentials: Record<string, string>): boolean {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const lines: string[] = [];

    // Read existing file if it exists
    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, "utf-8");
      lines.push(...existing.split("\n"));
    }

    // Update or add credentials
    for (const [key, value] of Object.entries(credentials)) {
      const index = lines.findIndex((line) => line.startsWith(`${key}=`));
      if (index !== -1) {
        lines[index] = `${key}=${value}`;
      } else {
        lines.push(`${key}=${value}`);
      }
    }

    // Write back to file
    fs.writeFileSync(envPath, lines.join("\n"), "utf-8");
    console.log("✓ Saved credentials to .env.local");
    return true;
  } catch (error) {
    console.error("Error saving .env.local:", error);
    return false;
  }
}
