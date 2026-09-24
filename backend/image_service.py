import os
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
from typing import Optional, Tuple, Dict

# Cache för sökord i minnet så att frekventa notiser (t.ex. polisnotiser) inte hamrar bildbanken
_IMAGE_QUERY_CACHE: Dict[str, str] = {}
_MAX_CACHE_SIZE = 200

def get_cached_image(query: str) -> Optional[str]:
    return _IMAGE_QUERY_CACHE.get(query.lower().strip())

def set_cached_image(query: str, url: str) -> None:
    global _IMAGE_QUERY_CACHE
    if len(_IMAGE_QUERY_CACHE) >= _MAX_CACHE_SIZE:
        # Töm hälften av de äldsta posterna
        keys_to_remove = list(_IMAGE_QUERY_CACHE.keys())[:50]
        for k in keys_to_remove:
            _IMAGE_QUERY_CACHE.pop(k, None)
    _IMAGE_QUERY_CACHE[query.lower().strip()] = url

def fetch_og_image(article_url: str, timeout: float = 3.5) -> Optional[str]:
    """
    Försöker extrahera redaktionell bild (og:image eller twitter:image) direkt från artikelns webbsida.
    """
    if not article_url or not article_url.startswith("http"):
        return None

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        # Hämta strömmande och läs bara första 128KB för snabb prestanda (meta-taggar finns alltid i head)
        resp = requests.get(article_url, headers=headers, timeout=timeout, stream=True)
        if resp.status_code != 200:
            return None

        content_chunks = []
        bytes_read = 0
        for chunk in resp.iter_content(chunk_size=16384):
            content_chunks.append(chunk)
            bytes_read += len(chunk)
            if bytes_read >= 131072: # 128 KB
                break
            # Om vi redan nått slutet av </head> kan vi avbryta tidigt
            if b"</head>" in chunk.lower():
                break

        resp.close()
        html_head = b"".join(content_chunks).decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html_head, "html.parser")

        # Prioriterad sökning efter bilder
        og_tag = (
            soup.find("meta", property="og:image") or
            soup.find("meta", attrs={"name": "twitter:image"}) or
            soup.find("meta", property="twitter:image") or
            soup.find("meta", attrs={"name": "thumbnail"})
        )

        if og_tag and og_tag.get("content"):
            img_src = og_tag.get("content").strip()
            # Validera att det är en absolut URL och en giltig bild
            if img_src.startswith("//"):
                img_src = "https:" + img_src
            elif img_src.startswith("/"):
                img_src = urllib.parse.urljoin(article_url, img_src)

            # Filtrera bort uppenbara tracking pixels eller SVG
            low_src = img_src.lower()
            if img_src.startswith("http") and not any(bad in low_src for bad in [".svg", "1x1", "pixel", "blank.gif", "tracking"]):
                return img_src
    except Exception as e:
        # Tyst hantering - failover sker till bildbank
        pass

    return None

def fetch_wikimedia_image(query: str, timeout: float = 3.5) -> Optional[str]:
    """
    Söker Wikimedia Commons efter en relevant bild utan krav på API-nycklar.
    """
    if not query or len(query.strip()) < 2:
        return None

    clean_query = query.strip()
    cached = get_cached_image(clean_query)
    if cached:
        return cached

    try:
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{clean_query} filetype:bitmap",
            "gsrnamespace": 6,
            "gsrlimit": 6,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": 800,
            "format": "json"
        }
        headers = {
            "User-Agent": "RssBevakaren/2026.09 (https://github.com/Minglarn/rss_bevakaren; kontakt: app@local.lan)"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id, page in pages.items():
                title = page.get("title", "")
                # Undvik flaggor, ikoner, diagram, vapensköldar
                if any(bad in title.lower() for bad in ["flag", "coat of arms", "icon", "symbol", "map", "diagram", "logo"]):
                    continue

                imageinfo = page.get("imageinfo", [])
                if imageinfo:
                    info = imageinfo[0]
                    mime = info.get("mime", "").lower()
                    if "image/jpeg" in mime or "image/png" in mime or "image/webp" in mime:
                        thumb = info.get("thumburl") or info.get("url")
                        if thumb and thumb.startswith("http"):
                            set_cached_image(clean_query, thumb)
                            return thumb
    except Exception:
        pass

    return None

def fetch_unsplash_image(query: str, timeout: float = 3.5) -> Optional[str]:
    """
    Valfritt: söker Unsplash om UNSPLASH_ACCESS_KEY finns konfigurerad.
    """
    access_key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not access_key or not query:
        return None

    try:
        url = "https://api.unsplash.com/search/photos"
        params = {
            "query": query,
            "per_page": 1,
            "orientation": "landscape"
        }
        headers = {
            "Authorization": f"Client-ID {access_key}"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                urls = results[0].get("urls", {})
                img = urls.get("regular") or urls.get("small")
                if img:
                    return img
    except Exception:
        pass

    return None

def build_search_query(
    title: str,
    summary: str = "",
    source: str = "",
    category: str = "",
    ai_query: str = ""
) -> str:
    """
    Bygger en träffsäker sökterm för bildbanker baserat på AI-analys eller innehåll.
    """
    if ai_query and len(ai_query.strip()) >= 3:
        return ai_query.strip()

    t_low = (title or "").lower()
    s_low = (source or "").lower()
    sum_low = (summary or "").lower()
    cat_low = (category or "").lower()

    # Specifika kontroller för Blåljus och Polisen
    if "polis" in s_low or "polis" in t_low:
        if any(w in t_low for w in ["trafik", "hastighet", "fartkontroll", "böter", "körkort"]):
            return "police car sweden"
        if any(w in t_low for w in ["brand", "eld"]):
            return "firefighter emergency"
        if any(w in t_low for w in ["stöld", "inbrott", "rån"]):
            return "police investigation sweden"
        if any(w in t_low for w in ["vapen", "skottlossning", "skjuten"]):
            return "police tape cordon sweden"
        return "swedish police car"

    if any(w in t_low or w in sum_low for w in ["brand", "lågor", "räddningstjänst", "brandkår"]):
        return "firefighter rescue truck"

    if any(w in t_low for w in ["skolattack", "skola", "knivskärning på skola"]):
        return "school building"

    if any(w in t_low or w in cat_low for w in ["domstol", "tingsrätt", "hovrätt", "häktad", "åtal", "dom"]):
        return "courtroom gavel justice"

    if any(w in t_low or w in cat_low for w in ["sjukhus", "vård", "ambulans", "operation"]):
        return "hospital ambulance"

    if any(w in t_low or w in cat_low for w in ["regering", "riksdag", "statsminister", "partiledare"]):
        return "riksdagen stockholm sweden"

    if "ekonomi" in cat_low or any(w in t_low for w in ["börsen", "ränta", "inflation", "aktie"]):
        return "stock market financial exchange"

    if "motor" in cat_low or any(w in t_low for w in ["elbil", "bilskatt", "fordon", "volvo"]):
        return "electric vehicle highway"

    if "teknik" in cat_low or any(w in t_low for w in ["google", "apple", "samsung", "ai ", "mjukvara"]):
        return "modern technology smartphone"

    # Fallback för övriga ämnen
    return "sweden news report"

def resolve_article_image(
    link: str,
    title: str,
    summary: str = "",
    source: str = "",
    category: str = "",
    ai_query: str = ""
) -> Tuple[Optional[str], str]:
    """
    Associerar en bild till en artikel i två steg:
    1. Open Graph / redaktionell bild från artikellänken
    2. Fri bildbank (Unsplash eller Wikimedia Commons) via AI/innehållssökord

    Returnerar tuple: (bild_url, metod_beskrivning)
    """
    # 1. Försök med redaktionell bild från artikelns webbsida
    if link and link.startswith("http"):
        og_img = fetch_og_image(link)
        if og_img:
            return og_img, "opengraph"

    # 2. Om Unsplash är konfigurerat med nyckel
    query = build_search_query(title, summary, source, category, ai_query)
    unsplash_img = fetch_unsplash_image(query)
    if unsplash_img:
        return unsplash_img, f"unsplash:{query}"

    # 3. Öppen bild via Wikimedia Commons
    wiki_img = fetch_wikimedia_image(query)
    if wiki_img:
        return wiki_img, f"wikimedia:{query}"

    # Om specifik sökning inte gav något, prova ett bredare fallbacksökord
    if query != "sweden news report":
        fallback_img = fetch_wikimedia_image("sweden news report")
        if fallback_img:
            return fallback_img, "wikimedia:fallback"

    return None, "none"
