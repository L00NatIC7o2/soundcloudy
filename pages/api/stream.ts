import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = {
  api: { responseLimit: false, bodyParser: false },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, token } = req.query as { trackId?: string; token?: string };
  if (!trackId || !token)
    return res.status(400).json({ error: "Missing trackId or token" });

  try {
    // Fetch track to find a progressive transcoding
    const trackResp = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
      },
    );
    const track = trackResp.data;

    const prog = track.media?.transcodings?.find(
      (t: any) => t.format?.protocol === "progressive",
    );

    let streamUrl: string | undefined;
    if (prog) {
      const streamResp = await axios.get(`${prog.url}?oauth_token=${token}`, {
        headers: { Authorization: `OAuth ${token}` },
      });
      streamUrl = streamResp.data?.url;
    } else if (track.stream_url) {
      streamUrl = `${track.stream_url}?oauth_token=${token}`;
    }

    if (!streamUrl)
      return res.status(404).json({ error: "No stream URL available" });

    const audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: { Range: req.headers.range },
    });

    res.status(audioResp.status);
    const copyHeaders = [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
    ];
    copyHeaders.forEach((h) => {
      const v = audioResp.headers[h];
      if (v) res.setHeader(h, v);
    });

    audioResp.data.pipe(res);
  } catch (err: any) {
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
