#!/usr/bin/env node
/**
 * One-click script to extract and update SoundCloud API credentials
 * Run: npm run update-sc-creds
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

async function extractCredentials() {
  console.log("🚀 Launching browser to extract SoundCloud credentials...\n");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  let capturedClientId = null;
  let capturedAppVersion = null;

  page.on("response", async (response) => {
    try {
      const url = response.url();
      if (
        url.includes("api-v2.soundcloud.com") &&
        (url.includes("play-history") || url.includes("me/"))
      ) {
        const urlObj = new URL(url);
        const clientId = urlObj.searchParams.get("client_id");
        const appVersion = urlObj.searchParams.get("app_version");

        if (clientId && !capturedClientId) {
          capturedClientId = clientId;
          console.log(`✓ Captured client_id: ${clientId}`);
        }
        if (appVersion && !capturedAppVersion) {
          capturedAppVersion = appVersion;
          console.log(`✓ Captured app_version: ${appVersion}`);
        }
      }
    } catch (_error) {
      // Ignore parsing errors
    }
  });

  console.log("📖 Opening SoundCloud... Please log in if needed.\n");
  await page.goto("https://soundcloud.com/you/history", {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "⏳ Waiting for API calls... (navigate around if credentials aren't captured)\n",
  );

  // Wait up to 30 seconds for credentials
  const startTime = Date.now();
  while (
    (!capturedClientId || !capturedAppVersion) &&
    Date.now() - startTime < 30000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await browser.close();

  if (!capturedClientId || !capturedAppVersion) {
    console.error(
      "\n❌ Failed to capture credentials. Make sure you're logged in and try again.\n",
    );
    process.exit(1);
  }

  return {
    clientId: capturedClientId,
    appVersion: capturedAppVersion,
  };
}

function updateEnvFile(credentials) {
  const envPath = path.join(process.cwd(), ".env.local");
  let lines = [];

  if (fs.existsSync(envPath)) {
    const existing = fs.readFileSync(envPath, "utf-8");
    lines = existing.split("\n");
  }

  const updates = {
    SOUNDCLOUD_V2_CLIENT_ID: credentials.clientId,
    SOUNDCLOUD_APP_VERSION: credentials.appVersion,
  };

  for (const [key, value] of Object.entries(updates)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index !== -1) {
      lines[index] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, lines.filter(Boolean).join("\n") + "\n", "utf-8");
  console.log("\n✅ Updated .env.local with new credentials!\n");
}

async function main() {
  try {
    console.log("═".repeat(60));
    console.log("  SoundCloud Credentials Updater");
    console.log("═".repeat(60) + "\n");

    const answer = await question(
      "This will open a browser to extract credentials. Continue? (y/n): ",
    );
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log("\n❌ Cancelled.\n");
      process.exit(0);
    }

    const credentials = await extractCredentials();
    updateEnvFile(credentials);

    console.log("📋 Credentials:");
    console.log(`   client_id:   ${credentials.clientId}`);
    console.log(`   app_version: ${credentials.appVersion}\n`);
    console.log("🔄 Restart your dev server or Electron app to apply.\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message, "\n");
    process.exit(1);
  }
}

main();
