export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str || '';
  if (!str.includes('&')) return str;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    return doc.body.textContent || str;
  } catch (e) {
    return str;
  }
}

export function resolveFeedIcon(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string' || !iconUrl.trim()) {
    return '/default-feed-icon.png';
  }
  const cleanUrl = iconUrl.trim();
  if (cleanUrl.endsWith('/default-feed-icon.svg')) {
    return '/default-feed-icon.png';
  }
  return cleanUrl;
}
