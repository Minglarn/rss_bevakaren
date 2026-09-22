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
MQTT_RETAIN = os.environ.get("MQTT_RETAIN", "true").strip().lower() in ("true", "1", "yes", "on")
MQTT_QOS = int(os.environ.get("MQTT_QOS", "1").strip() or 1)

# Home Assistant MQTT Auto-Discovery inställningar
MQTT_DISCOVERY_ENABLED_ENV = os.environ.get("MQTT_DISCOVERY_ENABLED", "true").strip().lower()
MQTT_DISCOVERY_ENABLED = MQTT_DISCOVERY_ENABLED_ENV in ("true", "1", "yes", "y", "on")
MQTT_DISCOVERY_PREFIX = os.environ.get("MQTT_DISCOVERY_PREFIX", "homeassistant").strip().strip("/")

# Global MQTT-klient
_client: Optional[mqtt.Client] = None
_is_connected: bool = False
_published_feed_articles: set = set()
_published_prio_articles: set = set()
MAX_DEDUP_IDS = 10000

def slugify_username(username: Optional[str]) -> str:
    """
    Konverterar ett användarnamn till en ren och läsbar MQTT-topic-komponent.
    Exempel: 'Admin' -> 'admin', 'Kalle Anka' -> 'kalle_anka'
    """
    if not username or not str(username).strip():
        return "default"
    
    s = str(username).strip().lower()
    replacements = {
        'å': 'a', 'ä': 'a', 'ö': 'o',
        'Å': 'a', 'Ä': 'a', 'Ö': 'o',
        'é': 'e', 'è': 'e', 'ü': 'u',
        '–': '-', '—': '-'
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
        
    s = re.sub(r'[^a-z0-9_]+', '_', s)
    s = s.strip('_')
    return s if s else "default"

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

def get_ha_device_dict(user_slug: str, username: str) -> Dict[str, Any]:
    """
    Genererar en isolerad Home Assistant Device-definition per RSS-bevakaren-användare.
    Detta gör att varje användare i Home Assistant får en egen Device med sina egna flöden och prio-sensorer.
    """
    return {
        "identifiers": [f"rss_bevakaren_{user_slug}"],
        "name": f"RSS-Bevakaren ({username})",
        "model": "RSS-Bevakaren AI",
        "manufacturer": "RSS-Bevakaren",
        "sw_version": "2026.09.20.05"
    }

def publish_ha_discovery_prio(username: Optional[str] = None, user_id: Optional[int] = None):
    """
    Publicerar Home Assistant MQTT Auto-Discovery för användarens personliga prio-sensor.
    Topic: {discovery_prefix}/sensor/rss_{user_slug}/prio/config
    """
    global _client, _is_connected
    if not MQTT_ENABLED or not MQTT_DISCOVERY_ENABLED or _client is None:
        return
        
    resolved_username = username or (f"user_{user_id}" if user_id else "default")
    user_slug = slugify_username(resolved_username)
    discovery_topic = f"{MQTT_DISCOVERY_PREFIX}/sensor/rss_{user_slug}/prio/config"
    state_topic = f"{MQTT_TOPIC_PREFIX}/{user_slug}/prio"
    avail_topic = f"{MQTT_TOPIC_PREFIX}/status"

    config_payload = {
        "name": "Senaste Prio",
        "object_id": f"rss_{user_slug}_prio",
        "unique_id": f"rss_{user_slug}_prio",
        "state_topic": state_topic,
        "value_template": "{{ value_json.title }}",
        "json_attributes_topic": state_topic,
        "icon": "mdi:star",
        "availability_topic": avail_topic,
        "payload_available": "online",
        "payload_not_available": "offline",
        "device": get_ha_device_dict(user_slug, resolved_username)
    }

    try:
        _client.publish(discovery_topic, json.dumps(config_payload, ensure_ascii=False), qos=1, retain=True)
    except Exception as e:
        print(f"[MQTT: {user_slug}] Fel vid HA Discovery för prio: {e}", flush=True)

def publish_ha_discovery_for_feed(
    feed: Any,
    username: Optional[str] = None,
    user_id: Optional[int] = None
):
    """
    Publicerar Home Assistant MQTT Auto-Discovery för ett specifikt flöde tillhörande en specifik användare.
    Topic: {discovery_prefix}/sensor/rss_{user_slug}/{feed_slug}/config
    """
    global _client, _is_connected
    if not MQTT_ENABLED or not MQTT_DISCOVERY_ENABLED or _client is None:
        return

    resolved_user_id = user_id or getattr(feed, "user_id", None)
    resolved_username = username
    if not resolved_username and hasattr(feed, "owner") and feed.owner:
        resolved_username = getattr(feed.owner, "username", None)
    resolved_username = resolved_username or (f"user_{resolved_user_id}" if resolved_user_id else "default")
    user_slug = slugify_username(resolved_username)

    feed_id = getattr(feed, "id", None)
    feed_title = getattr(feed, "title", None) or "RSS"
    feed_slug = slugify_feed_title(feed_title)
    
    unique_id = f"rss_{user_slug}_{feed_slug}_{feed_id}" if feed_id else f"rss_{user_slug}_{feed_slug}"
    object_id = f"rss_{user_slug}_{feed_slug}"
    
    discovery_topic = f"{MQTT_DISCOVERY_PREFIX}/sensor/rss_{user_slug}/{feed_slug}/config"
    state_topic = f"{MQTT_TOPIC_PREFIX}/{user_slug}/feeds/{feed_slug}"
    avail_topic = f"{MQTT_TOPIC_PREFIX}/status"

    config_payload = {
        "name": feed_title,
        "object_id": object_id,
        "unique_id": unique_id,
        "state_topic": state_topic,
        "value_template": "{{ value_json.title }}",
        "json_attributes_topic": state_topic,
        "icon": "mdi:rss",
        "availability_topic": avail_topic,
        "payload_available": "online",
        "payload_not_available": "offline",
        "device": get_ha_device_dict(user_slug, resolved_username)
    }

    try:
        _client.publish(discovery_topic, json.dumps(config_payload, ensure_ascii=False), qos=1, retain=True)
    except Exception as e:
        print(f"[MQTT: {user_slug}] Fel vid HA Discovery för '{feed_title}': {e}", flush=True)

def remove_ha_discovery_for_feed(
    feed_title: str,
    username: Optional[str] = None,
    user_id: Optional[int] = None,
    feed_id: Optional[int] = None
):
    """
    Raderar en flödessensor från Home Assistant genom att skicka ett tomt retain-meddelande till dess discovery-topic.
    """
    global _client, _is_connected
    if not MQTT_ENABLED or not MQTT_DISCOVERY_ENABLED or _client is None:
        return

    resolved_username = username or (f"user_{user_id}" if user_id else "default")
    user_slug = slugify_username(resolved_username)
    feed_slug = slugify_feed_title(feed_title)
    
    discovery_topic = f"{MQTT_DISCOVERY_PREFIX}/sensor/rss_{user_slug}/{feed_slug}/config"
    try:
        _client.publish(discovery_topic, "", qos=1, retain=True)
        print(f"[MQTT: {user_slug}] Avregistrerade HA Auto-Discovery för '{feed_title}' -> '{discovery_topic}'", flush=True)
    except Exception as e:
        print(f"[MQTT: {user_slug}] Fel vid avregistrering av HA Discovery för '{feed_title}': {e}", flush=True)

def sync_all_ha_discoveries(db_session=None):
    """
    Synkroniserar Home Assistant Auto-Discovery för samtliga användare och deras flöden.
    Körs automatiskt vid MQTT-anslutning samt kan anropas explicit.
    """
    global _client, _is_connected
    if not MQTT_ENABLED or not MQTT_DISCOVERY_ENABLED or _client is None or not _is_connected:
        return

    should_close = False
    if db_session is None:
        try:
            import database
            db_session = database.SessionLocal()
            should_close = True
        except Exception as e:
            print(f"[MQTT] Kunde inte öppna DB-session för HA Auto-Discovery sync: {e}", flush=True)
            return

    try:
        import models
        users = db_session.query(models.User).all()
        total_feeds = 0
        for u in users:
            u_name = u.username or f"user_{u.id}"
            publish_ha_discovery_prio(username=u_name, user_id=u.id)
            user_feeds = db_session.query(models.Feed).filter(models.Feed.user_id == u.id).all()
            total_feeds += len(user_feeds)
            for f in user_feeds:
                publish_ha_discovery_for_feed(feed=f, username=u_name, user_id=u.id)
        print("[MQTT] Auto-Discovery är OK.", flush=True)
    except Exception as e:
        print(f"[MQTT] Fel vid synkronisering av HA Auto-Discovery: {e}", flush=True)
    finally:
        if should_close and db_session:
            db_session.close()

def _on_connect(client, userdata, flags, rc, properties=None):
    global _is_connected
    if rc == 0 or rc == mqtt.MQTT_ERR_SUCCESS:
        _is_connected = True
        print(f"[MQTT] Ansluten till broker på {MQTT_BROKER}:{MQTT_PORT} (Topic-prefix: '{MQTT_TOPIC_PREFIX}')", flush=True)
        # Publicera online-status som retained meddelande
        status_topic = f"{MQTT_TOPIC_PREFIX}/status"
        client.publish(status_topic, "online", qos=1, retain=True)
        # Synkronisera Home Assistant Auto-Discovery för alla användare och flöden
        if MQTT_DISCOVERY_ENABLED:
            sync_all_ha_discoveries()
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
    username: Optional[str] = None,
    user_id: Optional[int] = None,
    is_prio: bool = False,
    matched_keywords: Optional[List[str]] = None,
    is_update: bool = False
):
    """
    Publicerar en artikel till användarens specifika MQTT-ämnen:
    1. Användarens flödestopic: {prefix}/{användare}/feeds/{feed_slug}
    2. Om is_prio är true: Även till användarens prio-topic: {prefix}/{användare}/prio
    """
    global _client, _is_connected, _published_feed_articles, _published_prio_articles
    
    if not MQTT_ENABLED or _client is None:
        return
        
    resolved_user_id = user_id or getattr(feed, "user_id", None)
    resolved_username = username
    if not resolved_username and hasattr(feed, "owner") and feed.owner:
        resolved_username = getattr(feed.owner, "username", None)
        
    user_slug = slugify_username(resolved_username or (f"user_{resolved_user_id}" if resolved_user_id else "default"))
    article_id = getattr(article, "id", None)
    dedup_key = f"{user_slug}:{article_id}" if article_id is not None else None
    
    already_published_feed = (dedup_key in _published_feed_articles) if dedup_key else False
    already_published_prio = (dedup_key in _published_prio_articles) if dedup_key else False

    # Om varken uppdatering eller ny prio och artikeln redan skickats till feed, hoppa över
    if already_published_feed and not is_update and (not is_prio or already_published_prio):
        return

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

    # Lös ut flödesdomän och ikon för Home Assistant och externa klienter
    feed_domain = ""
    target_url = getattr(feed, "url", "") or getattr(article, "link", "") or ""
    if target_url:
        try:
            from urllib.parse import urlparse
            feed_domain = urlparse(target_url).netloc.lower().replace("www.", "")
        except Exception:
            pass

    feed_icon = ""
    saved_icon = getattr(feed, "icon_url", None)
    if saved_icon and str(saved_icon).strip().startswith(("http://", "https://")):
        s_clean = str(saved_icon).strip()
        icon_domain = ""
        try:
            from urllib.parse import urlparse
            icon_domain = urlparse(s_clean).netloc.lower().replace("www.", "")
        except Exception:
            pass
        is_safe_cdn = any(cdn in icon_domain for cdn in ["google", "wordpress", "wp.com", "feedburner", "ytimg", "cloudinary"])
        if not feed_domain or not icon_domain or is_safe_cdn or feed_domain in icon_domain or icon_domain in feed_domain:
            feed_icon = s_clean

    if not feed_icon and feed_domain:
        feed_icon = f"https://www.google.com/s2/favicons?domain={feed_domain}&sz=128"

    feed_id = getattr(feed, "id", None)

    # Konstruera ren och komplett JSON-nyttolast med användarkontext
    payload = {
        "id": article_id,
        "user": user_slug,
        "user_id": resolved_user_id,
        "title": getattr(article, "title", "") or "",
        "source": feed_title,
        "feed_slug": feed_slug,
        "feed_id": feed_id,
        "feed_icon": feed_icon,
        "feed_domain": feed_domain,
        "category": getattr(article, "category", "") or "Övrigt",
        "summary": getattr(article, "ai_summary", "") or getattr(article, "summary", "") or "",
        "short_summary": getattr(article, "ai_short_summary", "") or "",
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
        print(f"[MQTT] Serialiseringsfel för artikel {article_id} (användare: {user_slug}): {e}", flush=True)
        return

    # Registrera i dedubbleringsmängder
    if dedup_key:
        _published_feed_articles.add(dedup_key)
        if len(_published_feed_articles) > MAX_DEDUP_IDS:
            _published_feed_articles.clear()
            _published_feed_articles.add(dedup_key)
        if is_prio:
            _published_prio_articles.add(dedup_key)
            if len(_published_prio_articles) > MAX_DEDUP_IDS:
                _published_prio_articles.clear()
                _published_prio_articles.add(dedup_key)
        
    feed_pub_ok = False
    prio_pub_ok = False

    # 1. Publicera till användarens specifika flödestopic
    if not already_published_feed or is_update:
        feed_topic = f"{MQTT_TOPIC_PREFIX}/{user_slug}/feeds/{feed_slug}"
        try:
            _client.publish(feed_topic, payload_str, qos=MQTT_QOS, retain=MQTT_RETAIN)
            feed_pub_ok = True
        except Exception as e:
            print(f"[MQTT: {user_slug}] Fel vid publicering till '{feed_topic}': {e}", flush=True)
        
    # 2. Om artikeln är PRIO: publicera även till användarens specifika prio-topic
    should_pub_prio = is_prio and (not already_published_prio or is_update)
    if should_pub_prio:
        prio_topic = f"{MQTT_TOPIC_PREFIX}/{user_slug}/prio"
        try:
            _client.publish(prio_topic, payload_str, qos=MQTT_QOS, retain=MQTT_RETAIN)
            prio_pub_ok = True
        except Exception as e:
            print(f"[MQTT: {user_slug}] Fel vid publicering till '{prio_topic}': {e}", flush=True)

    # Samlad, strukturerad och koncis loggrad per artikel
    if feed_pub_ok or prio_pub_ok:
        action_verb = "Uppdaterade berikad" if is_update else "Publicerade"
        topics_desc = []
        if feed_pub_ok:
            topics_desc.append(f"'feeds/{feed_slug}'")
        if prio_pub_ok:
            topics_desc.append("'prio'")
        dest_str = " & ".join(topics_desc)
        prio_badge = " [PRIO]" if is_prio else ""
        print(f"[MQTT: {user_slug}] {action_verb} #{article_id}{prio_badge} -> {dest_str}", flush=True)
