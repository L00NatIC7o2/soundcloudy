import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

const CLIENT_ID = process.env.VITE_SOUNDCLOUD_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_SOUNDCLOUD_CLIENT_SECRET;

console.log("CLIENT_ID length:", CLIENT_ID?.length, "Value:", `"${CLIENT_ID}"`);
console.log(
  "CLIENT_SECRET length:",
  CLIENT_SECRET?.length,
  "Value:",
  `"${CLIENT_SECRET}"`,
);
console.log(
  "Has trailing spaces?",
  CLIENT_ID?.endsWith(" "),
  CLIENT_SECRET?.endsWith(" "),
);

axios
  .post(
    "https://secure.soundcloud.com/oauth/token",
    new URLSearchParams({
      client_id: CLIENT_ID?.trim(),
      client_secret: CLIENT_SECRET?.trim(),
      grant_type: "client_credentials",
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  )
  .then((res) => {
    console.log("✓ OAuth Success!");
  })
  .catch((err) => {
    console.error("✗ OAuth Failed!");
    console.error(err.response?.data);
  });
