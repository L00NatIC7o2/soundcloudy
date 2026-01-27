import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = { api: { responseLimit: false, bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, token } = req.query as { trackId?: string; token?: string };
  if (!trackId || !token)
    return res.status(400).json({ error: "Missing trackId or token" });

  try {
    // Get stream transcodings from /tracks/:id/stream endpoint
    const streamResp = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}/stream`,
      { headers: { Authorization: `OAuth ${token}` } },
    );
    const streamData = streamResp.data;

    // Find progressive mp3 URL
    const mp3Url = streamData.http_mp3_128_url || streamData.url;
    if (!mp3Url) {
      return res.status(404).json({ error: "No progressive stream available" });
    }

    // Fetch and pipe the audio
    const audioResp = await axios.get(mp3Url, {
      responseType: "stream",
      headers: { Range: req.headers.range },
    });

    res.status(audioResp.status);
    [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
    ].forEach((h) => {
      const v = audioResp.headers[h];
      if (v) res.setHeader(h, v);
    });
    audioResp.data.pipe(res);
  } catch (err: any) {
    console.error(
      "Stream error:",
      err.response?.status,
      err.response?.data || err.message,
    );
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
}
