import feedparser
import time
import calendar
import requests

def fetch_feed_items(url: str):
    """Fetches and parses an RSS feed, returning a list of items."""
    print(f"Laddar och tolkar RSS-flöde: {url}")
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=15)
        parsed = feedparser.parse(res.content)
        items = []
        for entry in parsed.entries:
            categories = [tag.get('term') for tag in entry.get('tags', []) if tag.get('term')]
            
            published_ts = 0
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_ts = calendar.timegm(entry.published_parsed)
                
            summary_html = entry.get("summary", "")
            image_url = ""
            clean_summary = summary_html
            
            # Use BeautifulSoup to find image and clean text
            if summary_html:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(summary_html, "html.parser")
                img_tag = soup.find("img")
                if img_tag and img_tag.has_attr("src"):
                    image_url = img_tag["src"]
                
                # Also try to extract from media enclosures if no image in summary
                if not image_url and "media_content" in entry:
                    for media in entry.media_content:
                        if media.get("medium") == "image":
                            image_url = media.get("url", "")
                            break
                            
                # Check standard RSS enclosures for images
                if not image_url and "enclosures" in entry:
                    for enc in entry.enclosures:
                        if enc.get("type", "").startswith("image/"):
                            image_url = enc.get("href", "")
                            break
                            
                clean_summary = soup.get_text(separator=" ", strip=True)
                
            items.append({
                "title": entry.get("title", "No Title"),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "published_ts": published_ts,
                "summary": clean_summary,
                "image_url": image_url,
                "categories": categories,
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
