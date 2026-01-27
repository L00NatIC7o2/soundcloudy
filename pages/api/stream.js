import axios from "axios";

export default async function handler(req, res) {
  const { trackId, token } = req.query;
  if (!trackId || !token)
    return res.status(400).json({ error: "Missing trackId or token" });

  try {
    // Get track (to find progressive transcoding)
    const trackResp = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
      },
    );
    const track = trackResp.data;

    const prog = track.media?.transcodings?.find(
      (t) => t.format?.protocol === "progressive",
    );
    if (!prog) {
      return res
        .status(404)
        .json({ error: "No progressive stream for this track" });
    }

    // Resolve progressive stream URL
    const streamResp = await axios.get(`${prog.url}?oauth_token=${token}`);
    const streamUrl = streamResp.data?.url;
    if (!streamUrl)
      return res.status(500).json({ error: "Stream URL missing" });

    // Pipe the audio data
    const audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: {
        Range: req.headers.range || undefined, // support range if present
      },
    });

    // Forward status and headers
    res.status(audioResp.status);
    Object.entries(audioResp.headers).forEach(([k, v]) => {
      if (typeof v !== "undefined") res.setHeader(k, v);
    });

    audioResp.data.pipe(res);
  } catch (err) {
    console.error(
      "Stream proxy error:",
      err.response?.status,
      err.response?.data || err.message,
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
}
