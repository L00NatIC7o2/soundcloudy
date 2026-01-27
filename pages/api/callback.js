import axios from "axios";

export default async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).json({ error: "No code" });

  const baseUrl = `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`;

  try {
    const response = await axios.post(
      "https://secure.soundcloud.com/oauth/token",
      new URLSearchParams({
        client_id: process.env.VITE_SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.VITE_SOUNDCLOUD_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/callback`,
        grant_type: "authorization_code",
        code: code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const token = response.data.access_token;
    res.redirect(`${baseUrl}/?token=${token}`);
  } catch (error) {
    console.error("OAuth error:", error.response?.data);
    res.redirect(`${baseUrl}/?error=auth_failed`);
  }
};
