import feedparser

def fetch_feed_items(url: str):
    """Fetches and parses an RSS feed, returning a list of items."""
    try:
        parsed = feedparser.parse(url)
        items = []
        for entry in parsed.entries:
            items.append({
                "title": entry.get("title", "No Title"),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "summary": entry.get("summary", ""),
            })
        return items
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

def filter_items_by_keywords(items, keywords):
    """Returns items that contain at least one of the keywords in title or summary."""
    if not keywords:
        return items # or return [] depending on if we want all news when no keywords

    filtered = []
    kw_lower = [k.keyword.lower() for k in keywords]
    for item in items:
        title = item['title'].lower()
        summary = item['summary'].lower()
        if any(k in title or k in summary for k in kw_lower):
            filtered.append(item)
    return filtered
