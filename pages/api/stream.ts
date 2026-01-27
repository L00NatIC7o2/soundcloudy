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
    // Fetch track metadata with transcodings
    const trackResp = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
      },
    );
    const track = trackResp.data;

    // Find progressive or HLS transcoding
    const transcodings = track.media?.transcodings || [];
    const prog = transcodings.find(
      (t: any) => t.format?.protocol === "progressive",
    );
    const hls = transcodings.find((t: any) => t.format?.protocol === "hls");
    const transcoding = prog || hls;

    if (!transcoding?.url) {
      return res
        .status(404)
        .json({ error: "No streamable transcoding available for this track" });
    }

    // Resolve the stream URL
    const resolveResp = await axios.get(transcoding.url, {
      headers: { Authorization: `OAuth ${token}` },
    });
    const streamUrl = resolveResp.data?.url;
    if (!streamUrl) {
      return res
        .status(404)
        .json({ error: "Stream URL not found in response" });
    }

    // Fetch and pipe the audio
    const audioResp = await axios.get(streamUrl, {
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
