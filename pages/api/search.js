import axios from "axios";

export const config = {
  runtime: "nodejs",
};

export default async (req, res) => {
  const { q, token } = req.query;

  if (!q || !token) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: { q, limit: 50 },
      headers: { Authorization: `OAuth ${token}` },
    });

    res.json({ collection: response.data });
  } catch (error) {
    console.error("Search error:", error.response?.data);
    res.status(500).json({ error: error.message });
  }
};
