/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Without this, the client Router Cache can serve a page snapshot from
    // before a message was sent when navigating back into a chat thread.
    staleTimes: { dynamic: 0 },
  },
};
export default nextConfig;
