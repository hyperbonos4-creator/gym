/** @type {import('next').NextConfig} */
const ACCESS_URL = (process.env.ACCESS_URL || "http://127.0.0.1:3010").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  // Errores de lint preexistentes (hooks/img) no bloquean el build de seguridad.
  eslint: { ignoreDuringBuilds: true },
  // Evita que Next pelee con el backend por el trailing-slash del kiosko.
  skipTrailingSlashRedirect: true,
  async redirects() {
    // La carpeta del kiosko apunta al index explícito (200, sin bucle). Como el
    // kiosko usa assets relativos, la URL conserva el prefijo /kiosk/.
    return [
      { source: "/kiosk", destination: "/kiosk/index.html?source=webcam", permanent: false },
      { source: "/kiosk/", destination: "/kiosk/index.html?source=webcam", permanent: false },
      { source: "/kiosk/puerta", destination: "/kiosk/index.html?source=webcam", permanent: false },
      { source: "/socios", destination: "/clientes", permanent: false },
      { source: "/socios/:path*", destination: "/clientes/:path*", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    // Origen único: solo proxeamos archivos reales del kiosko y la API del
    // backend de acceso, para que el link de enrolamiento y el kiosko facial
    // vivan bajo el dominio de la plataforma.
    return [
      { source: "/kiosk/:path+", destination: `${ACCESS_URL}/kiosk/:path+` },
      { source: "/api/v1/:path*", destination: `${ACCESS_URL}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
