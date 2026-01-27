import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export const config = { api: { responseLimit: false, bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, token, clientId } = req.query as {
    trackId?: string;
    token?: string;
    clientId?: string;
  };
  if (!trackId || !token)
    return res.status(400).json({ error: "Missing trackId or token" });

  try {
    const trackResp = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}${
        clientId ? `?client_id=${clientId}` : ""
      }`,
      { headers: { Authorization: `OAuth ${token}` } },
    );
    const track = trackResp.data;

    const prog = track.media?.transcodings?.find(
      (t: any) => t.format?.protocol === "progressive",
    );

    let streamUrl: string | undefined;
    if (prog) {
      const streamResp = await axios.get(
        `${prog.url}${prog.url.includes("?") ? "&" : "?"}oauth_token=${token}${
          clientId ? `&client_id=${clientId}` : ""
        }`,
        { headers: { Authorization: `OAuth ${token}` } },
      );
      streamUrl = streamResp.data?.url;
    } else if (track.stream_url) {
      streamUrl = `${track.stream_url}?oauth_token=${token}${
        clientId ? `&client_id=${clientId}` : ""
      }`;
    }

    if (!streamUrl)
      return res.status(404).json({ error: "No stream URL available" });

    const audioResp = await axios.get(streamUrl, {
      responseType: "stream",
      headers: {
        Authorization: `OAuth ${token}`,
        Range: req.headers.range,
      },
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
