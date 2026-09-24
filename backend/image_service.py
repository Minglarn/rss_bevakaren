import os
import re
import urllib.parse
import requests
from bs4 import BeautifulSoup
from typing import Optional, Tuple, Dict

# Cache för sökord i minnet så att frekventa notiser (t.ex. polisnotiser) inte hamrar bildbanken
_IMAGE_QUERY_CACHE: Dict[str, str] = {}
_MAX_CACHE_SIZE = 200

# Mönster i bild-URL:er som representerar generiska banners, logotyper, delningsbilder eller placeholders
GENERIC_IMAGE_PATTERNS = [
    "logo", "site-logo", "sitelogo", "brand-logo", "brand_logo", "branding", "favicon", "avatar", "placeholder",
    "default-share", "default_share", "og-default", "fallback", "dummy",
    "social-share", "social_share", "share-image", "share_image", "article-default",
    "1x1", "pixel", "blank", "tracking", "transparent", "icon-", "-icon",
    "polisen-logo", "svt-logo", "dn-logo", "di-logo", "gp-logo", "sydsvenskan-logo",
    "default_image", "generic", "header-bg"
]

# Kända felaktiga bilder från tidigare generiska fallback-sökningar som ska blockeras
KNOWN_BAD_IMAGES = [
    "albert_einstein_sticks_his_tongue",
    "employment_by_region_in_denmark_and_sweden",
    "employment_distributed_by_region",
    "president_jimmy_carter_and_swedish_prime_minister",
    "residence_of_the_ambassador_of_sweden"
]

def get_cached_image(query: str) -> Optional[str]:
    return _IMAGE_QUERY_CACHE.get(query.lower().strip())

def set_cached_image(query: str, url: str) -> None:
    global _IMAGE_QUERY_CACHE
    if len(_IMAGE_QUERY_CACHE) >= _MAX_CACHE_SIZE:
        keys_to_remove = list(_IMAGE_QUERY_CACHE.keys())[:50]
        for k in keys_to_remove:
            _IMAGE_QUERY_CACHE.pop(k, None)
    _IMAGE_QUERY_CACHE[query.lower().strip()] = url

def is_generic_or_bad_image(img_url: str) -> bool:
    """Kontrollerar om en bild-URL är en generisk sajt-logotyp, placeholder eller känd felaktig bild."""
    if not img_url or not isinstance(img_url, str):
        return True
    
    low = img_url.lower()
    
    # Blockera kända felaktiga Wikimedia-fallbacks
    if any(bad in low for bad in KNOWN_BAD_IMAGES):
        return True
        
    # Blockera SVG-filer och ikoner som og:image
    if low.endswith(".svg") or low.endswith(".ico") or ".svg?" in low:
        return True
        
    # Blockera generiska logotyper och placeholders
    if any(pat in low for pat in GENERIC_IMAGE_PATTERNS):
        return True
        
    return False

def fetch_og_image(article_url: str, timeout: float = 3.5) -> Optional[str]:
    """
    Försöker extrahera redaktionell bild (og:image eller twitter:image) direkt från artikelns webbsida.
    Returnerar endast äkta artikelbilder, aldrig generiska sajt-logotyper eller placeholders.
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
            if img_src.startswith("//"):
                img_src = "https:" + img_src
            elif img_src.startswith("/"):
                img_src = urllib.parse.urljoin(article_url, img_src)

            # Strikt validering: avvisa om det är en logotyp, placeholder eller SVG
            if img_src.startswith("http") and not is_generic_or_bad_image(img_src):
                return img_src
    except Exception:
        pass

    return None

def fetch_wikimedia_image(query: str, timeout: float = 3.5) -> Optional[str]:
    """
    Söker Wikimedia Commons efter en relevant bild utan krav på API-nycklar.
    Filtrerar strikt bort kartor, diagram, flaggor, historiska teckningar och orelaterade personer.
    """
    if not query or len(query.strip()) < 3:
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
            "gsrlimit": 8,
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
                title = page.get("title", "").lower()
                
                # Undvik flaggor, ikoner, diagram, vapensköldar, historiska ritningar
                bad_title_keywords = [
                    "flag", "coat of arms", "icon", "symbol", "map", "diagram", 
                    "logo", "drawing", "painting", "sketch", "stamp", "coin", 
                    "postage", "historic", "1800s", "1900s", "19th century", 
                    "albert einstein", "employment distributed", "residence of the ambassador", 
                    "carter", "ullsten", "statue", "monument", "bust"
                ]
                if any(bad in title for bad in bad_title_keywords):
                    continue

                imageinfo = page.get("imageinfo", [])
                if imageinfo:
                    info = imageinfo[0]
                    mime = info.get("mime", "").lower()
                    if "image/jpeg" in mime or "image/png" in mime or "image/webp" in mime:
                        thumb = info.get("thumburl") or info.get("url")
                        if thumb and thumb.startswith("http") and not is_generic_or_bad_image(thumb):
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
    if not access_key or not query or len(query.strip()) < 3:
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
                if img and not is_generic_or_bad_image(img):
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
    Bygger en specifik sökterm för bildbanker baserat på AI-analys eller tydligt händelsetema.
    Om inget specifikt, passande bildtema finns returneras tom sträng för att undvika felaktiga bilder.
    """
    # 1. Prioritera specifik sökterm från lokal AI om den är vettig
    if ai_query and isinstance(ai_query, str):
        clean_ai = ai_query.strip().lower()
        # Avfärda om AI gett en intetsägande eller negativ respons
        bad_ai_terms = ["none", "n/a", "inget", "tomt", "bild", "image", "okänd", "null", "news", "sweden", "report"]
        if len(clean_ai) >= 3 and clean_ai not in bad_ai_terms:
            return ai_query.strip()

    t_low = (title or "").lower()
    s_low = (source or "").lower()
    sum_low = (summary or "").lower()
    cat_low = (category or "").lower()

    # 2. Specifika regler för Blåljus och Utryckningar (Polisen, Räddningstjänst, Ambulans)
    if any(term in s_low or term in t_low or term in cat_low for term in ["polis", "blåljus", "räddningstjänst", "olycka"]):
        if any(w in t_low for w in ["brand", "lågor", "eldsvåda", "rökspridning"]):
            return "swedish fire truck firefighter rescue"
        if any(w in t_low for w in ["trafikolycka", "singelolycka", "kollision", "krock", "avåkning"]):
            return "traffic accident rescue car"
        if any(w in t_low for w in ["skottlossning", "skjuten", "mord", "dråp", "knivdåd", "knivskärning"]):
            return "police line do not cross tape"
        if any(w in t_low for w in ["inbrott", "stöld", "rån", "stulen"]):
            return "police investigation car"
        if any(w in t_low for w in ["trafikkontroll", "hastighet", "fartkontroll", "böter", "körkort", "rattfylleri"]):
            return "swedish police car"
        # Standard blåljus: en äkta svensk polisbil
        return "swedish police car"

    if any(w in t_low or w in sum_low for w in ["brand", "lågor", "eldsvåda"]):
        return "swedish fire engine emergency"

    if any(w in t_low or w in cat_low for w in ["domstol", "tingsrätt", "hovrätt", "häktad", "åtal", "dom meddelad"]):
        return "courtroom gavel hammer justice"

    if any(w in t_low or w in cat_low for w in ["ambulans", "akutmottagning", "sjuktransport"]):
        return "ambulance emergency vehicle"

    if any(w in t_low or w in cat_low for w in ["riksdag", "regering", "statsminister", "partiledardebatt"]):
        return "riksdagen building stockholm"

    if any(w in t_low for w in ["elbil", "elbilar", "laddhybrid"]):
        return "electric vehicle highway"

    # VIKTIGT: Returnera tom sträng om inget specifikt tema matchar.
    # Tvinga ALDRIG generiska fallbacksökningar som 'sweden news report' som ger slumpmässiga bilder!
    return ""

def resolve_article_image(
    link: str,
    title: str,
    summary: str = "",
    source: str = "",
    category: str = "",
    ai_query: str = ""
) -> Tuple[Optional[str], str]:
    """
    Associerar en bild till en artikel selektivt och med hög precision:
    1. Open Graph / redaktionell bild från artikellänken (filtrerar bort sajt-logotyper)
    2. Fri bildbank (Unsplash eller Wikimedia Commons) ENDAST vid specifik AI-term eller tydligt tema.
    3. Om ingen passande bild finns returneras None så att artikeln förblir utan bild (visar källa/ikon).

    Returnerar tuple: (bild_url, metod_beskrivning)
    """
    # 1. Försök med redaktionell bild från artikelns webbsida
    if link and link.startswith("http"):
        og_img = fetch_og_image(link)
        if og_img:
            return og_img, "opengraph"

    # 2. Om ingen redaktionell bild finns, kontrollera om vi har ett specifikt tema eller AI-sökord
    query = build_search_query(title, summary, source, category, ai_query)
    if not query:
        # Ingen specifik bild hittades – avstå från bild hellre än att visa fel bild
        return None, "none"

    # 3. Om Unsplash är konfigurerat med nyckel
    unsplash_img = fetch_unsplash_image(query)
    if unsplash_img:
        return unsplash_img, f"unsplash:{query}"

    # 4. Öppen bild via Wikimedia Commons med strikt kvalitetsfiltrering
    wiki_img = fetch_wikimedia_image(query)
    if wiki_img:
        return wiki_img, f"wikimedia:{query}"

    # Avstå från bild om ingen passande hittades
    return None, "none"
