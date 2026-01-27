import axios from "axios";

export default async (req, context) => {
  const { code } = new URL(req.url).searchParams;

  if (!code) {
    return new Response("No code", { status: 400 });
  }

  try {
    const response = await axios.post(
      "https://secure.soundcloud.com/oauth/token",
      new URLSearchParams({
        client_id: process.env.VITE_SOUNDCLOUD_CLIENT_ID,
        redirect_uri: "https://notyourniche.com/soundcloudy/callback",
        grant_type: "authorization_code",
        code: code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const token = response.data.access_token;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://notyourniche.com/soundcloudy/?token=${token}`,
      },
    });
  } catch (error) {
    console.error("OAuth error:", error.response?.data);
    return new Response("Auth failed", { status: 500 });
  }
};
