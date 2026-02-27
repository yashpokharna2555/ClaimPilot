import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/files",
        destination: `${api}/files`,
      },
    ];
  },
};

export default nextConfig;
