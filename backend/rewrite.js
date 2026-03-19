const cheerio = require('cheerio');

function makeAbsoluteUrl(baseUrl, attributeUrl) {
  try {
    return new URL(attributeUrl, baseUrl).toString();
  } catch (err) {
    return null;
  }
}

function rewriteHtml(html, sessionId, targetUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const assetProxy = (url) => `/proxy-asset?session=${encodeURIComponent(sessionId)}&url=${encodeURIComponent(url)}`;

  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = makeAbsoluteUrl(targetUrl, href);
    if (abs) $(el).attr('href', assetProxy(abs));
  });

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    const abs = makeAbsoluteUrl(targetUrl, src);
    if (abs) $(el).attr('src', assetProxy(abs));
  });

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const abs = makeAbsoluteUrl(targetUrl, src);
    if (abs) $(el).attr('src', assetProxy(abs));
  });

  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (style.includes('url(')) {
      // do not rewrite inline url() for now
    }
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const abs = makeAbsoluteUrl(targetUrl, href);
    if (abs) $(el).attr('data-proxy-href', abs); // store resolved URL for frontend
  });

  $('form[action]').each((_, el) => {
    const action = $(el).attr('action');
    const abs = makeAbsoluteUrl(targetUrl, action);
    if (abs) $(el).attr('data-proxy-action', abs);
  });

  // Optionally strip CSP to avoid blocked resources by browser for script injection etc.
  $('meta[http-equiv="Content-Security-Policy"]').remove();

  return $.html();
}

module.exports = {
  rewriteHtml,
};
