export const config = {
  clientId: import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID || "",
  clientSecret: import.meta.env.VITE_SOUNDCLOUD_CLIENT_SECRET || "",
  apiBase: "https://api.soundcloud.com",
};

if (!config.clientId) {
  console.warn("Warning: VITE_SOUNDCLOUD_CLIENT_ID not set in .env");
}
if (!config.clientSecret) {
  console.warn("Warning: VITE_SOUNDCLOUD_CLIENT_SECRET not set in .env");
}
