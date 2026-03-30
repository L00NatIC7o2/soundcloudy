import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../server/auth/connectStore";
import { getAllowedCorsOrigin } from "../../server/http/origin";

function applyCors(req: NextApiRequest, res: NextApiResponse) {
  const allowedOrigin = getAllowedCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const codes = getConnectStore();
  const { connect_code } = req.query;
  if (!connect_code || typeof connect_code !== "string")
    return res.status(400).json({ error: "missing connect_code" });
  const entry = codes.get(connect_code);
  if (!entry) return res.status(404).json({ error: "invalid connect_code" });
  if (!entry.tokens) return res.status(202).json({ status: "pending" });

  res.json({ status: "complete", tokens: entry.tokens });
}
