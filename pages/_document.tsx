import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />

        {/* Preconnect to external domains for faster loading */}
        <link rel="preconnect" href="https://img.icons8.com" />
        <link rel="dns-prefetch" href="https://img.icons8.com" />
        <link rel="preconnect" href="https://i1.sndcdn.com" />
        <link rel="dns-prefetch" href="https://i1.sndcdn.com" />
        <link rel="preconnect" href="https://api.soundcloud.com" />
        <link rel="dns-prefetch" href="https://api.soundcloud.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
