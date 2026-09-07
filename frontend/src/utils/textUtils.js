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
