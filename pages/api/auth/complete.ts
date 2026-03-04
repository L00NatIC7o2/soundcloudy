import type { NextApiRequest, NextApiResponse } from "next";

const codes = (globalThis.__SC_CONNECT_CODES ||= new Map<string, any>());

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { connect_code } = req.query;
  if (!connect_code || typeof connect_code !== "string")
    return res.status(400).json({ error: "missing connect_code" });
  const entry = codes.get(connect_code);
  if (!entry) return res.status(404).json({ error: "invalid connect_code" });
  if (!entry.tokens) return res.status(202).json({ status: "pending" });

  // return tokens (you may want to exchange or mint a short session token instead)
  res.json({ status: "complete", tokens: entry.tokens });
}
