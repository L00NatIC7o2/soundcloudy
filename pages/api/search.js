import axios from "axios";

export default async function handler(req, res) {
  const { q, token } = req.query;
  if (!q || !token) return res.status(400).json({ error: "Missing params" });

  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: { q, limit: 50 },
      headers: { Authorization: `OAuth ${token}` },
    });
    res.json({ collection: response.data });
  } catch (error) {
    console.error(
      "Search error:",
      error.response?.status,
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message,
    });
  }
}
