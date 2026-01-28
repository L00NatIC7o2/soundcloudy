import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,,
) {
  const token = req.cookies.soundcloud_token;onst token = req.cookies.soundcloud_token;

  if (!token) {  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });status(401).json({ error: "Not authenticated" });
  }

  // Not implemented - users select tracks manually for now  // Not implemented - users select tracks manually for now
  res.json({ track: null });son({ track: null });
}
