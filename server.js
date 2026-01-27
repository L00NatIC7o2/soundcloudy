import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.VITE_SOUNDCLOUD_CLIENT_ID;
const PUBLIC_URL = process.env.VITE_PUBLIC_URL || "http://localhost:3000";
const REDIRECT_URI = `${PUBLIC_URL}/soundcloudy/callback`;

console.log("Public URL:", PUBLIC_URL);
console.log("Redirect URI:", REDIRECT_URI);

app.get("/authorize", (req, res) => {
  const authUrl = `https://secure.soundcloud.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=non-expiring`;
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "No code" });

  try {
    const response = await axios.post(
      "https://secure.soundcloud.com/oauth/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code: code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const token = response.data.access_token;
    res.redirect(`${PUBLIC_URL}/soundcloudy/?token=${token}`);
  } catch (error) {
    console.error("OAuth error:", error.response?.data);
    res.redirect(`${PUBLIC_URL}/soundcloudy/?error=auth_failed`);
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const { q, token } = req.query;
    if (!q || !token) return res.status(400).json({ error: "Missing params" });

    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: { q, limit: 50 },
      headers: { Authorization: `OAuth ${token}` },
    });

    res.json({ collection: response.data });
  } catch (error) {
    console.error("Search error:", error.response?.data);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`),
);
