import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';

const pages = ['/', '/leistungen/', '/ausstellung/', '/inspiration/', '/karriere/', '/kontakt/', '/impressum/', '/datenschutz/'];

export const GET: APIRoute = ({ site }) => {
  const urls = pages.map((p) => `  <url><loc>${new URL(withBase(p), site).href}</loc></url>`).join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
