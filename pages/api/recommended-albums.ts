import type { NextApiRequest, NextApiResponse } from "next";

// Placeholder: implement real logic for recommended albums
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.status(200).json({ albums: [] });
}
