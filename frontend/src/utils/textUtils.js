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

export function getImageSourceLabel(item) {
  if (!item || !item.image_url) return null;
  const src = (item.image_source || '').toLowerCase();
  const url = (item.image_url || '').toLowerCase();
  if (src === 'wikimedia' || url.includes('wikimedia.org') || url.includes('wikipedia.org')) {
    return 'Bild: Wikimedia (Illustrativ)';
  }
  if (src === 'unsplash' || url.includes('unsplash.com')) {
    return 'Bild: Unsplash (Illustrativ)';
  }
  if (src === 'opengraph') {
    return 'Foto: Open Graph';
  }
  return null;
}
