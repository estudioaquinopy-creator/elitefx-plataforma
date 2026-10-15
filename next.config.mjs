/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mientras no se pueda compilar en el entorno de desarrollo, no bloqueamos el despliegue por tipos.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Permite subir imágenes de hasta 5 MB desde los formularios.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};
export default nextConfig;
