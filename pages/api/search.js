export const config = { runtime: "nodejs" };

import axios from "axios";

export default function handler(req, res) {
  res.json({ ok: true, q: req.query.q || null, token: !!req.query.token });
}
