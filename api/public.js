import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import savedConfig from '../src/config/supabase.public.json' with { type: 'json' };
import { cleanPath, isPrivatePath, makePage, renderHtml, sitemap } from '../seo/pages.mjs';
import { loadPublicSnapshot, publicConfig } from '../seo/load-public.mjs';

export function createPublicHandler({ load, template, environment = process.env } = {}) {
  return async function publicHandler(req, res) {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      res.setHeader('Allow', 'GET, HEAD');
      res.statusCode = 405;
      res.end();
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const request = new URL(req.url || '/', 'http://localhost');
    const routedPath = Array.isArray(req.query?.path) ? req.query.path.at(-1) : req.query?.path;
    const path = cleanPath(
      routedPath || request.searchParams.getAll('path').at(-1) || request.pathname,
    );
    if (!path || isPrivatePath(path)) {
      res.statusCode = 404;
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.end('Stranica nije dostupna.');
      return;
    }
    const preview = environment.VERCEL_ENV === 'preview';
    try {
      const snapshot = await (
        load || (() => loadPublicSnapshot(publicConfig(environment, savedConfig)))
      )();
      if (path === '/sitemap.xml') {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('X-Robots-Tag', 'noindex');
        res.statusCode = 200;
        res.end(req.method === 'HEAD' ? undefined : sitemap(snapshot));
        return;
      }
      const page = makePage(path, snapshot);
      if (page.redirect) {
        res.statusCode = 308;
        res.setHeader('Location', page.redirect);
        res.end();
        return;
      }
      const html = await (
        template || (() => readFile(join(process.cwd(), 'dist/index.html'), 'utf8'))
      )();
      res.statusCode = page.status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (!page.indexable || preview) res.setHeader('X-Robots-Tag', 'noindex, follow');
      const markup = renderHtml(html, page, snapshot, {
        preview,
        googleVerification: environment.GOOGLE_SITE_VERIFICATION || '',
        bingVerification: environment.BING_SITE_VERIFICATION || '',
      });
      res.end(req.method === 'HEAD' ? undefined : markup);
    } catch {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Retry-After', '60');
      res.end(
        req.method === 'HEAD'
          ? undefined
          : '<!doctype html><html lang="hr"><head><meta charset="UTF-8"><meta name="robots" content="noindex,nofollow"><title>Stranica trenutačno nije dostupna | FormaPoint</title></head><body><main><h1>Stranica trenutačno nije dostupna</h1><p>Pokušajte ponovno za nekoliko trenutaka.</p></main></body></html>',
      );
    }
  };
}
export default createPublicHandler();
