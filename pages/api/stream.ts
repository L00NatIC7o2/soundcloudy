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
      const streamResp = await axios.get(prog.url, {
        headers: { Authorization: `OAuth ${token}` },
        params: { oauth_token: token },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      streamUrl = streamResp.data?.url || streamResp.headers.location;
    } else if (track.stream_url) {
      streamUrl = `${track.stream_url}?oauth_token=${token}`;
    }

    if (!streamUrl)
      return res.status(404).json({ error: "No stream URL available" });

    const audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: {
        Authorization: `OAuth ${token}`,
        Range: req.headers.range,
      },
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 400,
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
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data || err.message });
  }
}
