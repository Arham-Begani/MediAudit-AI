/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Gemini SDK is server-only; keep it out of the client bundle.
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;
