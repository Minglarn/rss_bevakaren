import os
import json
import re
import time
from typing import Optional, Dict, Any, List
import paho.mqtt.client as mqtt

# Läs in miljövariabler för MQTT
MQTT_ENABLED_ENV = os.environ.get("MQTT_ENABLED", "false").strip().lower()
MQTT_ENABLED = MQTT_ENABLED_ENV in ("true", "1", "yes", "y", "on")

MQTT_BROKER = os.environ.get("MQTT_BROKER", "").strip()
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883").strip() or 1883)
MQTT_USERNAME = os.environ.get("MQTT_USERNAME", "").strip()
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "").strip()
MQTT_TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "rss_bevakaren").strip().strip("/")
MQTT_CLIENT_ID = os.environ.get("MQTT_CLIENT_ID", f"rss_bevakaren_{int(time.time())}")
MQTT_RETAIN = os.environ.get("MQTT_RETAIN", "false").strip().lower() in ("true", "1", "yes", "on")
MQTT_QOS = int(os.environ.get("MQTT_QOS", "1").strip() or 1)

# Global MQTT-klient
_client: Optional[mqtt.Client] = None
_is_connected: bool = False
_published_article_ids: set = set()
MAX_DEDUP_IDS = 10000

def slugify_feed_title(title: Optional[str]) -> str:
    """
    Konverterar ett flödes titel till en ren och läsbar MQTT-topic-komponent.
    Exempel: 'Polisen - Skåne län' -> 'polisen_skane_lan'
    """
    if not title or not title.strip():
        return "okant_flode"
    
    s = title.strip().lower()
    replacements = {
        'å': 'a', 'ä': 'a', 'ö': 'o',
        'Å': 'a', 'Ä': 'a', 'Ö': 'o',
        'é': 'e', 'è': 'e', 'ü': 'u',
        '–': '-', '—': '-'
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
        
    s = re.sub(r'[^a-z0-9]+', '_', s)
    s = s.strip('_')
    return s if s else "flode"

def _on_connect(client, userdata, flags, rc, properties=None):
    global _is_connected
    if rc == 0 or rc == mqtt.MQTT_ERR_SUCCESS:
        _is_connected = True
        print(f"[MQTT] Ansluten till broker på {MQTT_BROKER}:{MQTT_PORT} (Topic-prefix: '{MQTT_TOPIC_PREFIX}')", flush=True)
        # Publicera online-status som retained meddelande
        status_topic = f"{MQTT_TOPIC_PREFIX}/status"
        client.publish(status_topic, "online", qos=1, retain=True)
    else:
        _is_connected = False
        print(f"[MQTT] Anslutning misslyckades med felkod {rc}", flush=True)

def _on_disconnect(client, userdata, rc, properties=None):
    global _is_connected
    _is_connected = False
    if rc != 0:
        print(f"[MQTT] Oväntad frånkoppling från broker (rc={rc}). Klienten försöker återansluta automatiskt...", flush=True)
    else:
        print("[MQTT] Frånkopplad från broker.", flush=True)

def start_mqtt():
    """Initierar och startar MQTT-klienten i en bakgrundstråd om MQTT_ENABLED är påslaget."""
    global _client, _is_connected
    
    if not MQTT_ENABLED:
        print("[MQTT] MQTT är inaktiverat (MQTT_ENABLED=false). Hoppar över MQTT-klient.", flush=True)
        return
        
    if not MQTT_BROKER:
        print("[MQTT] Varning: MQTT_ENABLED=true men MQTT_BROKER är inte angiven. MQTT startas inte.", flush=True)
        return

    print(f"[MQTT] Initierar MQTT-anslutning mot {MQTT_BROKER}:{MQTT_PORT}...", flush=True)

    try:
        # Kompatibilitet mellan paho-mqtt 1.x och 2.x
        if hasattr(mqtt, "CallbackAPIVersion"):
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID)
        else:
            client = mqtt.Client(client_id=MQTT_CLIENT_ID)
            
        if MQTT_USERNAME:
            client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or None)
            
        # Last Will and Testament (LWT)
        status_topic = f"{MQTT_TOPIC_PREFIX}/status"
        client.will_set(status_topic, payload="offline", qos=1, retain=True)
        
        client.on_connect = _on_connect
        client.on_disconnect = _on_disconnect
        
        # Asynkron anslutning så appen startar direkt även om brokern är tillfälligt nere
        client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        _client = client
    except Exception as e:
        print(f"[MQTT] Fel vid initiering av MQTT-klient: {e}", flush=True)

def stop_mqtt():
    """Stänger ner MQTT-anslutningen och meddelar offline-status."""
    global _client, _is_connected
    if _client is not None:
        try:
            status_topic = f"{MQTT_TOPIC_PREFIX}/status"
            _client.publish(status_topic, "offline", qos=1, retain=True)
            _client.loop_stop()
            _client.disconnect()
            print("[MQTT] Klienten har stoppats.", flush=True)
        except Exception as e:
            print(f"[MQTT] Fel vid nedstängning: {e}", flush=True)
        finally:
            _is_connected = False
            _client = None

def publish_article(
    article: Any,
    feed: Any,
    is_prio: bool = False,
    matched_keywords: Optional[List[str]] = None
):
    """
    Publicerar en artikel till MQTT:
    1. Alltid till flödets topic: {prefix}/feeds/{feed_slug}
    2. Om is_prio är true: Även till {prefix}/prio
    """
    global _client, _is_connected, _published_article_ids
    
    if not MQTT_ENABLED or _client is None:
        return
        
    article_id = getattr(article, "id", None)
    if article_id is not None:
        if article_id in _published_article_ids:
            return
        _published_article_ids.add(article_id)
        if len(_published_article_ids) > MAX_DEDUP_IDS:
            # Rensa de äldsta vid behov
            _published_article_ids.clear()
            _published_article_ids.add(article_id)
            
    feed_title = getattr(feed, "title", None) or "RSS"
    feed_slug = slugify_feed_title(feed_title)
    
    # Extrahera taggar om de finns sparade som sträng eller lista
    tags_val = getattr(article, "tags", None)
    parsed_tags = []
    if isinstance(tags_val, list):
        parsed_tags = tags_val
    elif isinstance(tags_val, str) and tags_val.strip():
        try:
            parsed_tags = json.loads(tags_val)
        except Exception:
            parsed_tags = [t.strip() for t in tags_val.split(",") if t.strip()]

    # Konstruera ren och komplett JSON-nyttolast
    payload = {
        "id": article_id,
        "title": getattr(article, "title", "") or "",
        "source": feed_title,
        "feed_slug": feed_slug,
        "feed_id": getattr(feed, "id", None),
        "category": getattr(article, "category", "") or "Övrigt",
        "summary": getattr(article, "ai_summary", "") or getattr(article, "summary", "") or "",
        "raw_summary": getattr(article, "summary", "") or "",
        "link": getattr(article, "link", "") or "",
        "image_url": getattr(article, "image_url", None),
        "published": getattr(article, "published", "") or "",
        "published_ts": getattr(article, "published_ts", 0) or 0,
        "received_ts": getattr(article, "received_ts", 0) or int(time.time()),
        "is_prio": bool(is_prio),
        "prio_score": getattr(article, "prio_score", 0) or 0,
        "prio_reason": getattr(article, "prio_reason", "") or "",
        "matched_keywords": matched_keywords or [],
        "is_clickbait": bool(getattr(article, "is_clickbait", False)),
        "clickbait_reason": getattr(article, "clickbait_reason", "") or "",
        "tags": parsed_tags
    }
    
    try:
        payload_str = json.dumps(payload, ensure_ascii=False)
    except Exception as e:
        print(f"[MQTT] Serialiseringsfel för artikel {article_id}: {e}", flush=True)
        return
        
    # 1. Publicera till flödets specifika topic
    feed_topic = f"{MQTT_TOPIC_PREFIX}/feeds/{feed_slug}"
    try:
        _client.publish(feed_topic, payload_str, qos=MQTT_QOS, retain=MQTT_RETAIN)
        log_prio_tag = " [PRIO]" if is_prio else ""
        print(f"[MQTT] Publicerade artikel #{article_id}{log_prio_tag} -> '{feed_topic}'", flush=True)
    except Exception as e:
        print(f"[MQTT] Fel vid publicering till '{feed_topic}': {e}", flush=True)
        
    # 2. Om artikeln är PRIO: publicera även till dedikerad prio-topic
    if is_prio:
        prio_topic = f"{MQTT_TOPIC_PREFIX}/prio"
        try:
            _client.publish(prio_topic, payload_str, qos=MQTT_QOS, retain=MQTT_RETAIN)
            print(f"[MQTT] Publicerade PRIO-kopia för #{article_id} -> '{prio_topic}'", flush=True)
        except Exception as e:
            print(f"[MQTT] Fel vid publicering till '{prio_topic}': {e}", flush=True)
