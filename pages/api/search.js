import axios from "axios";

export default async (req, res) => {
  const { q, token } = req.query;

  if (!q || !token) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const response = await axios.get(
      "https://api-v2.soundcloud.com/search/tracks",
      {
        params: {
          q,
          limit: 50,
          client_id: process.env.VITE_SOUNDCLOUD_CLIENT_ID, // fallback
        },
        headers: { Authorization: `OAuth ${token}` },
      },
    );

    res.json({ collection: response.data.collection || response.data });
  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};
