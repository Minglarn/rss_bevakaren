import os
import json
import re
import time
import requests
import numpy as np
from typing import Optional, Dict, Any, List, Callable, Tuple

AI_URL = os.environ.get("AI_URL", os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1/chat/completions"))
AI_MODEL = os.environ.get("AI_MODEL", os.environ.get("LM_STUDIO_MODEL", ""))
AI_EMBEDDING_MODEL = os.environ.get("AI_EMBEDDING_MODEL", os.environ.get("LM_STUDIO_EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5"))
AI_TIMEOUT = int(os.environ.get("AI_TIMEOUT", os.environ.get("LM_STUDIO_TIMEOUT", "120")))
AI_MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", os.environ.get("LM_STUDIO_MAX_TOKENS", "8192")))

# Bakåtkompatibla alias för befintliga integrationer
LM_STUDIO_URL = AI_URL
LM_STUDIO_MODEL = AI_MODEL
LM_STUDIO_EMBEDDING_MODEL = AI_EMBEDDING_MODEL
LM_STUDIO_TIMEOUT = AI_TIMEOUT
LM_STUDIO_MAX_TOKENS = AI_MAX_TOKENS

DEFAULT_CATEGORIES_WITH_WEIGHTS = [
    {"name": "Blåljus", "weight": 7},
    {"name": "Lokalt", "weight": 8},
    {"name": "Inrikes", "weight": 6},
    {"name": "Utrikes", "weight": 5},
    {"name": "Politik", "weight": 4},
    {"name": "Ekonomi", "weight": 5},
    {"name": "Teknik", "weight": 9},
    {"name": "Motor", "weight": 7},
    {"name": "Vetenskap & Hälsa", "weight": 7},
    {"name": "Sport", "weight": 1},
    {"name": "Nöje & Kultur", "weight": 5},
    {"name": "Övrigt", "weight": 3}
]

DEFAULT_CATEGORIES = [c["name"] for c in DEFAULT_CATEGORIES_WITH_WEIGHTS]
DEFAULT_CATEGORIES_STR = " | ".join(DEFAULT_CATEGORIES)

DEFAULT_SYSTEM_PROMPT = f"""Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{{
  "category": "Välj den mest passande av följande kategorier: {DEFAULT_CATEGORIES_STR}",
  "urgency_score": 5,
  "substance_score": 5,
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är Clickbait eller undanhåller vem, vad eller var, ska svaret och de faktiska detaljerna avslöjas rakt på sak i första meningen.",
  "short_summary": "Exakt 1 till 1,5 korta meningar på svenska (max 20 ord) som ultrakompakt anger kärnhändelsen och platsen för korta mobilnotiser och låsskärmar.",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": "Om is_clickbait är true: Beskriv kortfattat vad rubriken undanhåller och bekräfta att fakta har lyfts fram i sammanfattningen (t.ex. 'Rubriken undanhåller vad de nya priserna är för att locka klick. Fakta har lyfts fram i sammanfattningen ovan.'). Lämna tomt om false."
}}
Riktlinjer för poängsättning:
- urgency_score (Heltal 1-10): Hur akut, omvälvande eller brådskande är händelsen/nyhetsvärdet?
  1-3: Vardaglig händelse, liten lokal notis, kuriosa eller tidlös artikel.
  4-6: Normal nyhet eller standardhändelse.
  7-8: Stor/betydande händelse med stor samhällspåverkan eller snabb utveckling.
  9-10: Mycket akut, extraordinär eller historisk händelse (t.ex. krigshandling, allvarlig katastrof, regeringskris).
- substance_score (Heltal 1-10): Faktatäthet, informationsdjup och trovärdighet kontra ytlighet.
  1-3: Ytlig notis, lösryckt rykte, ren åsiktspuff eller ClickBait med minimal substans.
  4-6: Normal nyhetsartikel med grundläggande fakta och sammanhang.
  7-8: Genomarbetad analys, granskning, officiell rapport eller faktaspäckad rapportering.
  9-10: Mycket omfattande och grundlig rapport eller unik förstahandsgranskning.
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara Clickbaits där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände", "Här är nya priserna").
- Om is_clickbait sätts till true: Beskriv i clickbait_reason kortfattat vad rubriken döljer och bekräfta att fakta har lyfts fram i sammanfattningen ovan.
- Myndighets- och krisinformation (t.ex. Krisinformation.se, Polisen, Sveriges Domstolar, MSB, SMHI, SOS Alarm, kommuner, officiella larm och VMA) är SAKLIG samhällsinformation och är ALDRIG ClickBait! De ska ALLTID ha is_clickbait: false.
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG Clickbait, även om de är korta eller inte nämner alla detaljer.
- Vid minsta tveksamhet, sätt alltid is_clickbait: false."""

def get_prompt_config_path() -> str:
    """Hittar eller skapar sökvägen till prompt-konfigurationsfilen i delad datamapp."""
    if os.path.exists("/data"):
        return "/data/ai_prompt.json"
    
    local_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    if not os.path.exists(local_data_dir):
        try:
            os.makedirs(local_data_dir, exist_ok=True)
        except Exception:
            pass
    return os.path.join(local_data_dir, "ai_prompt.json")

_cached_prompt: Optional[str] = None
_cached_categories: Optional[List[str]] = None
_cached_mtime: float = 0.0

def load_ai_config() -> Dict[str, Any]:
    """Läser komplett AI-konfiguration (prompt, kategorier och status) från fil."""
    global _cached_prompt, _cached_categories, _cached_mtime
    config_path = get_prompt_config_path()
    
    if not os.path.exists(config_path):
        save_ai_config(DEFAULT_SYSTEM_PROMPT, DEFAULT_CATEGORIES)
        
    try:
        current_mtime = os.path.getmtime(config_path)
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            prompt = data.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
            cats = data.get("categories", DEFAULT_CATEGORIES)
            if "Max två korta" in prompt:
                prompt = prompt.replace("Max två korta", "Max tre korta")
                save_ai_config(prompt, cats)
            if "urgency_score" not in prompt:
                prompt = DEFAULT_SYSTEM_PROMPT
                save_ai_config(prompt, cats)
            _cached_prompt = prompt
            _cached_categories = cats
            _cached_mtime = current_mtime
            
            return {
                "system_prompt": prompt,
                "categories": cats,
                "lm_studio_url": LM_STUDIO_URL,
                "lm_studio_model": get_active_model(),
                "is_healthy": check_lm_studio_health()
            }
    except Exception as e:
        print(f"[AI Service] Fel vid läsning av prompt-fil {config_path}: {e}", flush=True)
        return {
            "system_prompt": _cached_prompt or DEFAULT_SYSTEM_PROMPT,
            "categories": _cached_categories or DEFAULT_CATEGORIES,
            "lm_studio_url": LM_STUDIO_URL,
            "lm_studio_model": get_active_model(),
            "is_healthy": False
        }

def save_ai_config(system_prompt: str, categories: List[str]) -> bool:
    """Sparar uppdaterad systemprompt och kategorier till konfigurationsfilen."""
    global _cached_prompt, _cached_categories, _cached_mtime
    config_path = get_prompt_config_path()
    try:
        clean_cats = [c.strip() for c in categories if c and c.strip()]
        if not clean_cats:
            clean_cats = DEFAULT_CATEGORIES
            
        data = {
            "system_prompt": system_prompt.strip(),
            "categories": clean_cats,
            "note": "Denna fil kan redigeras on-the-fly via webbgränssnittet i Inställningar eller med nano."
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        _cached_prompt = data["system_prompt"]
        _cached_categories = clean_cats
        _cached_mtime = os.path.getmtime(config_path)
        print(f"[AI Service] Sparade uppdaterad AI-konfiguration till {config_path}", flush=True)
        return True
    except Exception as e:
        print(f"[AI Service] Kunde inte spara AI-konfiguration {config_path}: {e}", flush=True)
        return False

def load_system_prompt() -> str:
    """Läser systemprompt on-the-fly från fil så ändringar slår igenom omedelbart."""
    config = load_ai_config()
    return config["system_prompt"]

def load_categories() -> List[str]:
    """Läser in konfigurerade kategorier."""
    config = load_ai_config()
    return config.get("categories", DEFAULT_CATEGORIES)

def get_ai_server_type() -> str:
    """Identifierar vilken typ av AI-server/inferensmotor som används baserat på AI_URL."""
    url = (AI_URL or "").lower()
    if ":11434" in url or "ollama" in url:
        return "Ollama"
    if ":1234" in url or "lmstudio" in url or "lm_studio" in url:
        return "LM Studio"
    if "api.openai.com" in url or "openai" in url:
        return "OpenAI"
    if ":8000" in url or "vllm" in url:
        return "vLLM"
    if ":8080" in url or "llama-server" in url or "llamacpp" in url:
        return "llama.cpp"
    return "AI-motorn"

def get_models_endpoint() -> str:
    """Extraherar /v1/models endpoint baserat på AI_URL."""
    url = AI_URL.strip()
    if "/chat/completions" in url:
        return url.replace("/chat/completions", "/models")
    return "http://localhost:1234/v1/models"

def get_embeddings_endpoint() -> str:
    """Extraherar /v1/embeddings endpoint baserat på LM_STUDIO_URL."""
    url = LM_STUDIO_URL.strip()
    if "/chat/completions" in url:
        return url.replace("/chat/completions", "/embeddings")
    if "/models" in url:
        return url.replace("/models", "/embeddings")
    return "http://localhost:1234/v1/embeddings"

def get_native_chat_endpoint() -> str:
    """Extraherar /api/v1/chat endpoint baserat på LM_STUDIO_URL för realtids-progress och SSE."""
    url = LM_STUDIO_URL.strip()
    if "/v1/" in url:
        base = url.split("/v1/")[0]
        return f"{base}/api/v1/chat"
    elif url.endswith("/v1"):
        base = url[:-3]
        return f"{base}/api/v1/chat"
    match = re.match(r"(https?://[^/]+)", url)
    if match:
        return f"{match.group(1)}/api/v1/chat"
    return "http://localhost:1234/api/v1/chat"

def get_text_embeddings(texts: List[str], is_query: bool = False, model: Optional[str] = None) -> Optional[List[List[float]]]:
    """Genererar embeddings via AI-servern med Nomic prompt-prefix."""
    if not texts:
        return []
    
    endpoint = get_embeddings_endpoint()
    model_name = model or LM_STUDIO_EMBEDDING_MODEL
    
    # Nomic rekommenderar 'search_query: ' för frågor och 'search_document: ' för artiklar
    prefix = "search_query: " if is_query else "search_document: "
    formatted_texts = [f"{prefix}{t.strip()}" if not t.startswith(prefix) else t for t in texts]
    
    payload = {
        "model": model_name,
        "input": formatted_texts
    }
    
    try:
        res = requests.post(endpoint, json=payload, headers={"Content-Type": "application/json"}, timeout=25)
        if res.status_code == 200:
            data = res.json()
            items = data.get("data", [])
            items.sort(key=lambda x: x.get("index", 0))
            return [item["embedding"] for item in items if "embedding" in item]
        else:
            print(f"[AI Embeddings Fel] Servern på {endpoint} svarade med HTTP {res.status_code} för modell '{model_name}': {res.text[:250]}", flush=True)
    except requests.exceptions.ConnectTimeout:
        print(f"[AI Embeddings Fel] Timeout vid anslutning till {endpoint} för modell '{model_name}'.", flush=True)
    except requests.exceptions.ConnectionError:
        print(f"[AI Embeddings Fel] Kunde inte ansluta till {endpoint} (servern är onåbar).", flush=True)
    except Exception as e:
        print(f"[AI Embeddings Fel] Fel vid anrop till {endpoint} för modell '{model_name}': {e}", flush=True)
    
    return None

def save_article_embedding(article_id: int, title: str, text: str, db: Any, model: Optional[str] = None) -> bool:
    """Skapar och sparar vektor-embedding för en artikel i SQLite med säker upsert."""
    if not db or not article_id:
        return False
    try:
        import models
        from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

        content = f"{title or ''}. {text or ''}".strip()
        if not content or len(content) < 5:
            return False
            
        model_name = model or LM_STUDIO_EMBEDDING_MODEL
        embs = get_text_embeddings([content[:1200]], is_query=False, model=model_name)
        if embs and len(embs) > 0 and len(embs[0]) > 0:
            now_ts = int(time.time())
            vec_bytes = np.array(embs[0], dtype=np.float32).tobytes()
            stmt = sqlite_upsert(models.ArticleEmbedding).values(
                article_id=article_id,
                model=model_name,
                vector=vec_bytes,
                created_at=now_ts
            ).on_conflict_do_update(
                index_elements=['article_id'],
                set_={
                    'model': model_name,
                    'vector': vec_bytes,
                    'created_at': now_ts
                }
            )
            db.execute(stmt)
            db.commit()
            _dim = len(embs[0])
            _short_title = (title or "")[:60]
            print(f"[AI Embeddings] Sparad #{article_id} | dim={_dim} | '{_short_title}'", flush=True)
            return True
    except Exception as e:
        print(f"[AI Embeddings] Kunde inte spara embedding för artikel {article_id}: {e}", flush=True)
        try:
            db.rollback()
        except Exception:
            pass
    return False

def batch_embed_articles(articles: List[Any], db: Any, model: Optional[str] = None) -> int:
    """Vektoriserar en lista av artiklar i batchar och sparar till SQLite med säker upsert."""
    if not articles or not db:
        return 0
        
    import models
    from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

    model_name = model or LM_STUDIO_EMBEDDING_MODEL
    saved_count = 0
    batch_size = 15
    
    for i in range(0, len(articles), batch_size):
        chunk = articles[i:i + batch_size]
        items_to_embed = []
        for art in chunk:
            summary = art.ai_summary or art.summary or ""
            content = f"{art.title or ''}. {summary}".strip()[:1200]
            items_to_embed.append((art.id, content))
            
        texts = [item[1] for item in items_to_embed]
        embs = get_text_embeddings(texts, is_query=False, model=model_name)
        if embs and len(embs) == len(chunk):
            try:
                now_ts = int(time.time())
                for idx, (art_id, _) in enumerate(items_to_embed):
                    vec_bytes = np.array(embs[idx], dtype=np.float32).tobytes()
                    stmt = sqlite_upsert(models.ArticleEmbedding).values(
                        article_id=art_id,
                        model=model_name,
                        vector=vec_bytes,
                        created_at=now_ts
                    ).on_conflict_do_update(
                        index_elements=['article_id'],
                        set_={
                            'model': model_name,
                            'vector': vec_bytes,
                            'created_at': now_ts
                        }
                    )
                    db.execute(stmt)
                db.commit()
                saved_count += len(chunk)
                _dim = len(embs[0]) if embs else 0
                print(f"[AI Embeddings] Batch sparad: {len(chunk)} artiklar | dim={_dim} | totalt: {saved_count}", flush=True)
            except Exception as e:
                print(f"[AI Embeddings] Databasfel vid batch-sparning: {e}", flush=True)
                try:
                    db.rollback()
                except Exception:
                    pass
        else:
            # Om LM Studio inte svarade, avbryt loopen för att inte dröja
            break
            
    return saved_count

_health_cache: Dict[str, Any] = {"status": False, "ts": 0.0}
_models_cache: Dict[str, Any] = {"models": [], "ts": 0.0}
HEALTH_CACHE_TTL = 15.0  # sekunder
MODELS_CACHE_TTL = 30.0  # sekunder

_last_health_log_time: float = 0.0
_last_logged_models: Optional[List[str]] = None

def check_lm_studio_health(force_refresh: bool = False) -> bool:
    """Kontrollerar snabbt om AI-servern svarar med TTL-cachning för att undvika trådblockering vid offline eller hög last."""
    global _health_cache, _last_health_log_time
    now = time.time()
    if not force_refresh and (now - _health_cache["ts"]) < HEALTH_CACHE_TTL:
        return _health_cache["status"]

    endpoint = get_models_endpoint()
    try:
        res = requests.get(endpoint, timeout=2.5)
        healthy = (res.status_code == 200)
        _health_cache = {"status": healthy, "ts": now}
        if not healthy and (now - _last_health_log_time) > 60:
            _last_health_log_time = now
            print(f"[AI Server Varning] Hälsokontroll mot {endpoint} gav HTTP {res.status_code}: {res.text[:200]}", flush=True)
        return healthy
    except Exception as e:
        _health_cache = {"status": False, "ts": now}
        if (now - _last_health_log_time) > 60:
            _last_health_log_time = now
            print(f"[AI Server Varning] Hälsokontroll mot {endpoint} misslyckades: {e}", flush=True)
        return False

def get_available_models(force_refresh: bool = False) -> List[str]:
    """Hämtar alla tillgängliga chatt-/textmodeller från AI-servern med TTL-cachning."""
    global _models_cache, _health_cache, _last_logged_models
    now = time.time()
    if not force_refresh and (now - _models_cache["ts"]) < MODELS_CACHE_TTL:
        return list(_models_cache["models"])

    endpoint = get_models_endpoint()
    try:
        res = requests.get(endpoint, timeout=3.5)
        if res.status_code == 200:
            data = res.json()
            models_list = data.get("data", [])
            result = []
            for m in models_list:
                m_id = m.get("id", "")
                if m_id and "embedding" not in m_id.lower() and m_id not in result:
                    result.append(m_id)
            _models_cache = {"models": result, "ts": now}
            _health_cache = {"status": True, "ts": now}
            if _last_logged_models is None or sorted(result) != sorted(_last_logged_models):
                _last_logged_models = list(result)
                print(f"[AI Server] Tillgängliga modeller på {endpoint} ({len(result)} st): {result}", flush=True)
            return result
        else:
            print(f"[AI Server Fel] Kunde inte hämta modeller från {endpoint} (HTTP {res.status_code}): {res.text[:250]}", flush=True)
    except requests.exceptions.ConnectTimeout:
        print(f"[AI Server Fel] Timeout vid anslutning till {endpoint} för att lista modeller.", flush=True)
    except requests.exceptions.ConnectionError as ce:
        print(f"[AI Server Fel] Kunde inte ansluta till AI-servern på {endpoint}: {ce}", flush=True)
    except Exception as e:
        print(f"[AI Server Fel] Fel vid hämtning av modeller från {endpoint}: {e}", flush=True)

    _models_cache["ts"] = now
    return list(_models_cache["models"]) if _models_cache["models"] else []

def get_active_model() -> str:
    """Hämtar konfigurerad modell eller läser in aktiv modell från AI-servern."""
    if AI_MODEL and AI_MODEL.strip():
        return AI_MODEL.strip()
    
    available = get_available_models()
    if available:
        return available[0]
    
    return "local-model"

def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """Robust extrahering av JSON ur modellens svar även om den omslutit med markdown, resonemang eller blivit avhuggen."""
    # Ta bort eventuella resonemangsblock (<think>...</think>) från t.ex. DeepSeek-R1 eller Qwen
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    
    # 1. Direkt JSON-parsning
    try:
        return json.loads(text)
    except Exception:
        pass
    
    # 2. Strippa ev markdown-block ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
            
    # 3. Sök första '{' och sista '}'
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        json_candidate = text[start:end+1]
        try:
            return json.loads(json_candidate)
        except Exception:
            # Försök städa bort eventuella trailing commas: {"a": 1,} -> {"a": 1}
            fixed = re.sub(r",\s*([\]}])", r"\1", json_candidate)
            try:
                return json.loads(fixed)
            except Exception:
                pass
            
    # 4. Fallback: Fältextrahering med regex om JSON har syntaxfel (t.ex. o-escapade citattecken eller avhugget svar)
    result = {}
    cat_m = re.search(r'"category"\s*:\s*"([^"]+)"', text)
    if cat_m:
        result["category"] = cat_m.group(1).strip()

    prio_m = re.search(r'"priority"\s*:\s*"([^"]+)"', text)
    if prio_m:
        result["priority"] = prio_m.group(1).strip()

    score_m = re.search(r'"prio_score"\s*:\s*(\d+)', text)
    if score_m:
        try:
            result["prio_score"] = int(score_m.group(1))
        except Exception:
            pass

    urg_m = re.search(r'"urgency_score"\s*:\s*(\d+)', text)
    if urg_m:
        try:
            result["urgency_score"] = int(urg_m.group(1))
        except Exception:
            pass

    sub_m = re.search(r'"substance_score"\s*:\s*(\d+)', text)
    if sub_m:
        try:
            result["substance_score"] = int(sub_m.group(1))
        except Exception:
            pass

    # Extrahera prio_reason (hanterar även ev citat inuti texten)
    reason_m = re.search(r'"prio_reason"\s*:\s*"(.*?)(?:"\s*,\s*"\w+"\s*:|"$|"[\r\n])', text, re.DOTALL)
    if reason_m:
        result["prio_reason"] = reason_m.group(1).strip()
    else:
        reason_m = re.search(r'"prio_reason"\s*:\s*"([^"]+)"', text)
        if reason_m:
            result["prio_reason"] = reason_m.group(1).strip()

    # Extrahera summary
    summary_m = re.search(r'"summary"\s*:\s*"(.*?)(?:"\s*,\s*"\w+"\s*:|"$|"[\r\n])', text, re.DOTALL)
    if summary_m:
        result["summary"] = summary_m.group(1).strip()
    else:
        summary_m = re.search(r'"summary"\s*:\s*"([^"\r\n]+)', text)
        if summary_m:
            result["summary"] = summary_m.group(1).strip()

    # Extrahera tags
    tags_m = re.search(r'"tags"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if tags_m:
        tags_raw = tags_m.group(1)
        result["tags"] = [t.strip().strip('"\'') for t in tags_raw.split(",") if t.strip().strip('"\'')]
    else:
        result["tags"] = []

    # Extrahera is_clickbait och clickbait_reason
    cb_m = re.search(r'"is_clickbait"\s*:\s*(true|false)', text, re.IGNORECASE)
    if cb_m:
        result["is_clickbait"] = cb_m.group(1).lower() == "true"

    cb_reason_m = re.search(r'"clickbait_reason"\s*:\s*"(.*?)(?:"\s*,\s*"\w+"\s*:|"$|"[\r\n])', text, re.DOTALL)
    if cb_reason_m:
        result["clickbait_reason"] = cb_reason_m.group(1).strip()
    else:
        cb_reason_m = re.search(r'"clickbait_reason"\s*:\s*"([^"]+)"', text)
        if cb_reason_m:
            result["clickbait_reason"] = cb_reason_m.group(1).strip()

    if "category" in result or "priority" in result or "prio_score" in result:
        return result

    return None

def extract_category_names(categories_input: Any) -> List[str]:
    """Extraherar en lista med kategorinamn oavsett om indata är dict, list av dicts eller strängar."""
    if not categories_input:
        return DEFAULT_CATEGORIES
    names = []
    if isinstance(categories_input, list):
        for c in categories_input:
            if isinstance(c, dict) and "name" in c:
                names.append(str(c["name"]).strip())
            elif isinstance(c, str) and c.strip():
                names.append(c.strip())
    elif isinstance(categories_input, dict):
        names = [str(k).strip() for k in categories_input.keys() if str(k).strip()]
    return names if names else DEFAULT_CATEGORIES

def format_short_summary_instruction(max_words: int = 20, max_sentences: int = 1) -> str:
    words = max(5, min(100, int(max_words or 20)))
    sents = max(1, min(3, int(max_sentences or 1)))
    if sents <= 1:
        sent_phrase = "Exakt 1 kort mening"
    elif sents == 2:
        sent_phrase = "Max 1 till 2 korta meningar"
    else:
        sent_phrase = f"Max {sents} korta meningar"
    return f"{sent_phrase} på svenska (max {words} ord) som ultrakompakt anger kärnhändelsen och platsen för korta mobilnotiser och låsskärmar."

def enforce_short_summary_limits(text: str, max_words: int = 20, max_sentences: int = 1) -> str:
    if not text:
        return ""
    words_limit = max(5, min(100, int(max_words or 20)))
    sents_limit = max(1, min(3, int(max_sentences or 1)))
    
    cleaned = text.strip()
    s_parts = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if s.strip()]
    if len(s_parts) > sents_limit:
        cleaned = " ".join(s_parts[:sents_limit])
        
    words = cleaned.split()
    if len(words) > words_limit:
        trimmed = " ".join(words[:words_limit]).rstrip(",:;–- ")
        if not trimmed.endswith("."):
            trimmed += "..."
        cleaned = trimmed
    return cleaned

def build_user_prompt(
    categories: Optional[Any] = None, 
    prio_rules: Optional[str] = None, 
    exclude_rules: Optional[str] = None, 
    prio_threshold: int = 75,
    short_summary_max_words: int = 20,
    short_summary_max_sentences: int = 1
) -> str:
    """Sammanställer en skräddarsydd systemprompt baserat på användarens specifika kategorier och sammanfattningsregler."""
    cats = extract_category_names(categories)
    cats_str = " | ".join(cats)
    short_instr = format_short_summary_instruction(short_summary_max_words, short_summary_max_sentences)
    
    prompt = f"""Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{{
  "category": "Välj den mest passande av följande kategorier: {cats_str}",
  "urgency_score": 5,
  "substance_score": 5,
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är Clickbait eller undanhåller vem, vad eller var, ska svaret och de faktiska detaljerna avslöjas rakt på sak i första meningen.",
  "short_summary": "{short_instr}",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": "Om is_clickbait är true: Beskriv kortfattat vad rubriken undanhåller och bekräfta att fakta har lyfts fram i sammanfattningen (t.ex. 'Rubriken undanhåller vad de nya priserna är för att locka klick. Fakta har lyfts fram i sammanfattningen ovan.'). Lämna tomt om false."
}}
Riktlinjer för poängsättning:
- urgency_score (Heltal 1-10): Hur akut, omvälvande eller brådskande är händelsen/nyhetsvärdet?
  1-3: Vardaglig händelse, liten lokal notis, kuriosa eller tidlös artikel.
  4-6: Normal nyhet eller standardhändelse.
  7-8: Stor/betydande händelse med stor samhällspåverkan eller snabb utveckling.
  9-10: Mycket akut, extraordinär eller historisk händelse (t.ex. krigshandling, allvarlig katastrof, regeringskris).
- substance_score (Heltal 1-10): Faktatäthet, informationsdjup och trovärdighet kontra ytlighet.
  1-3: Ytlig notis, lösryckt rykte, ren åsiktspuff eller ClickBait med minimal substans.
  4-6: Normal nyhetsartikel med grundläggande fakta och sammanhang.
  7-8: Genomarbetad analys, granskning, officiell rapport eller faktaspäckad rapportering.
  9-10: Mycket omfattande och grundlig rapport eller unik förstahandsgranskning.
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara Clickbaits där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände", "Här är nya priserna").
- Om is_clickbait sätts till true: Beskriv i clickbait_reason kortfattat vad rubriken döljer och bekräfta att fakta har lyfts fram i sammanfattningen ovan.
- Myndighets- och krisinformation (t.ex. Krisinformation.se, Polisen, Sveriges Domstolar, MSB, SMHI, SOS Alarm, kommuner, officiella larm och VMA) är SAKLIG samhällsinformation och är ALDRIG ClickBait! De ska ALLTID ha is_clickbait: false.
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG Clickbait, även om de är korta eller inte nämner alla detaljer.
- Vid minsta tveksamhet, sätt alltid is_clickbait: false."""
    return prompt

def ensure_clickbait_in_prompt(
    prompt: Optional[str], 
    categories: Optional[Any] = None,
    short_summary_max_words: int = 20,
    short_summary_max_sentences: int = 1
) -> str:
    """
    Säkerställer att prompten innehåller de moderna, balanserade klickbete-instruktionerna,
    poängmatris för urgency/substance, krav på geografisk plats, 3 meningars sammanfattning
    och anpassat short_summary för korta notiser.
    Om prompten är tom eller saknar de senaste reglerna, genereras en uppdaterad prompt.
    """
    if not prompt or not prompt.strip():
        return build_user_prompt(
            categories=categories,
            short_summary_max_words=short_summary_max_words,
            short_summary_max_sentences=short_summary_max_sentences
        )
    cleaned = prompt.strip()
    if "Max två korta" in cleaned:
        cleaned = cleaned.replace("Max två korta", "Max tre korta")
    if "geografisk plats" not in cleaned.lower():
        return build_user_prompt(categories=categories, short_summary_max_words=short_summary_max_words, short_summary_max_sentences=short_summary_max_sentences)
    if "fakta har lyfts fram" not in cleaned.lower():
        return build_user_prompt(categories=categories, short_summary_max_words=short_summary_max_words, short_summary_max_sentences=short_summary_max_sentences)
    if "urgency_score" not in cleaned:
        return build_user_prompt(categories=categories, short_summary_max_words=short_summary_max_words, short_summary_max_sentences=short_summary_max_sentences)
    if "short_summary" not in cleaned:
        return build_user_prompt(categories=categories, short_summary_max_words=short_summary_max_words, short_summary_max_sentences=short_summary_max_sentences)
    
    # Uppdatera short_summary instruktionen i prompten så den matchar användarens inställning
    new_short_instr = format_short_summary_instruction(short_summary_max_words, short_summary_max_sentences)
    cleaned = re.sub(r'"short_summary":\s*"[^"]*"', f'"short_summary": "{new_short_instr}"', cleaned)

    if "SAKLIGA NYHETER" in cleaned:
        return cleaned
    return build_user_prompt(categories=categories, short_summary_max_words=short_summary_max_words, short_summary_max_sentences=short_summary_max_sentences)

def calculate_priority(
    category: str,
    categories_config: Any,
    matched_keywords: Optional[List[str]] = None,
    urgency_score: Optional[int] = 5,
    substance_score: Optional[int] = 5,
    is_clickbait: bool = False,
    cluster_size: int = 1,
    tags: Optional[List[str]] = None,
    liked_tags: Optional[List[str]] = None,
    disliked_tags: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Beräknar deterministisk prioritet och poäng baserat på en flerdimensionell poängmatris:
    1. Träff på specifika bevakningsord ger ALLTID högsta prioritet (100 poäng, HIGH).
    2. Kategori med vikt 0 ger ALLTID 0 poäng (LOW, ignoreras).
    3. Sammansatt grundpoäng (0-100):
       - Kategorivikt: 30 %
       - Urgency (akuthet / omvälvande nyhetsvärde): 40 %
       - Substance (faktatäthet / informationsdjup): 30 %
    4. Bonus & Avdrag:
       - Flerkällsbekräftelse (kluster): +10p vid 2 källor, +15p vid 3+ källor.
       - Intresseprofil (Gilla): +10p per matchad tagg/kategori (max +20p).
       - Ogillade ämnen (Ogilla): -15p vid match.
       - ClickBait-avdrag: -25p vid ClickBait (max 35p om inte bekräftat blåljus med hög akuthet).
    5. Prioritetsnivå:
       - >= 75: high (PRIO-flödet)
       - >= 45: medium (Ordinarie flöde)
       - < 45: low (Bakgrundsflöde)
    """
    u_val = max(1, min(10, int(urgency_score if urgency_score is not None else 5)))
    s_val = max(1, min(10, int(substance_score if substance_score is not None else 5)))

    if matched_keywords and len(matched_keywords) > 0:
        kw_str = ", ".join(matched_keywords)
        return {
            "priority": "high",
            "prio_score": 100,
            "prio_reason": f"Träff på bevakningsord: {kw_str}",
            "urgency_score": u_val,
            "substance_score": s_val
        }
    
    weights_map = {c["name"].lower(): c["weight"] for c in DEFAULT_CATEGORIES_WITH_WEIGHTS}
    if isinstance(categories_config, list):
        for item in categories_config:
            if isinstance(item, dict) and "name" in item:
                try:
                    weights_map[str(item["name"]).strip().lower()] = int(item.get("weight", 5))
                except Exception:
                    pass
            elif isinstance(item, str):
                weights_map[item.strip().lower()] = weights_map.get(item.strip().lower(), 5)
    elif isinstance(categories_config, dict):
        for k, v in categories_config.items():
            try:
                weights_map[str(k).strip().lower()] = int(v)
            except Exception:
                pass
                
    clean_cat = str(category or "Övrigt").strip()
    weight = weights_map.get(clean_cat.lower(), weights_map.get("övrigt", 3))
    weight = max(0, min(10, weight))

    # Kategori med vikt 0 ignoreras helt
    if weight == 0:
        return {
            "priority": "low",
            "prio_score": 0,
            "prio_reason": f"Ignorerad kategori: {clean_cat} (0/10)",
            "urgency_score": u_val,
            "substance_score": s_val
        }

    # Grundpoäng från matrisen: Kategori 30%, Akuthet 40%, Substans 30%
    base_score = (weight * 10 * 0.30) + (u_val * 10 * 0.40) + (s_val * 10 * 0.30)
    score = base_score

    reasons = [f"Kategori {weight}/10", f"Akuthet {u_val}/10", f"Substans {s_val}/10"]

    # Flerkällsbekräftelse (klusterbonus)
    c_size = int(cluster_size or 1)
    if c_size >= 3:
        score += 15
        reasons.append(f"+15p flerkällsbekräftelse ({c_size} källor)")
    elif c_size == 2:
        score += 10
        reasons.append("+10p flerkällsbekräftelse (2 källor)")

    # Adaptiv intresseprofil (baserat på Gilla / Ogilla)
    # OBS: Endast specifika ämnestaggar används här, inte huvudkategorin,
    # eftersom kategorivikten redan appliceras i grundpoängen.
    article_tag_terms = set()
    if tags:
        for t in tags:
            if t and str(t).strip():
                article_tag_terms.add(str(t).strip().lower())

    liked_set = set()
    if liked_tags:
        liked_set = {str(lt).strip().lower() for lt in liked_tags if lt and str(lt).strip()}
        # Uteslut allmänna kategorinamn så intresseprofilen fokuserar på specifika ämnen
        if clean_cat:
            liked_set.discard(clean_cat.lower())
        liked_matches = [t for t in article_tag_terms if t in liked_set]
        if liked_matches:
            bonus = min(20, len(liked_matches) * 10)
            score += bonus
            reasons.append(f"+{bonus}p intresseprofil ({', '.join(liked_matches[:2])})")

    if disliked_tags:
        disliked_set = {str(dt).strip().lower() for dt in disliked_tags if dt and str(dt).strip()}
        # 1. Ett ämne som användaren har gillat kan ALDRIG straffas som ogillat
        disliked_set = disliked_set - liked_set
        # 2. Artikelns huvudkategori eller användarens inställda kategorier kan ALDRIG straffas
        if clean_cat:
            disliked_set.discard(clean_cat.lower())

        disliked_matches = [t for t in article_tag_terms if t in disliked_set]
        if disliked_matches:
            penalty = 15
            score -= penalty
            reasons.append(f"-{penalty}p ogillat ämne ({', '.join(disliked_matches[:2])})")

    # ClickBait-avdrag
    if is_clickbait:
        score -= 25
        if not (clean_cat.lower() == "blåljus" and u_val >= 8):
            score = min(score, 35)
        reasons.append("ClickBait-avdrag (-25p)")

    final_score = int(round(max(0, min(100, score))))

    if final_score >= 75:
        prio_level = "high"
    elif final_score >= 45:
        prio_level = "medium"
    else:
        prio_level = "low"

    reason_str = f"Poängmatris {final_score}p ({', '.join(reasons)})"

    return {
        "priority": prio_level,
        "prio_score": final_score,
        "prio_reason": reason_str,
        "urgency_score": u_val,
        "substance_score": s_val
    }

def calculate_priority_score(*args, **kwargs) -> Dict[str, Any]:
    """Bakåtkompatibel wrapper och alias för calculate_priority."""
    category = kwargs.get("category") or (args[0] if len(args) > 0 else "Övrigt")
    categories_config = kwargs.get("categories_config") or kwargs.get("categories") or []
    if not categories_config and "user_settings" in kwargs and isinstance(kwargs["user_settings"], dict):
        categories_config = kwargs["user_settings"].get("categories", [])
    urgency_score = kwargs.get("urgency_score", 5)
    substance_score = kwargs.get("substance_score", 5)
    is_clickbait = kwargs.get("is_clickbait", False)
    cluster_size = kwargs.get("cluster_size", 1)
    tags = kwargs.get("tags") or []
    liked_tags = kwargs.get("liked_tags")
    disliked_tags = kwargs.get("disliked_tags")
    matched_keywords = kwargs.get("matched_keywords")

    return calculate_priority(
        category=category,
        categories_config=categories_config,
        matched_keywords=matched_keywords,
        urgency_score=urgency_score,
        substance_score=substance_score,
        is_clickbait=is_clickbait,
        cluster_size=cluster_size,
        tags=tags,
        liked_tags=liked_tags,
        disliked_tags=disliked_tags
    )

def analyze_article(
    title: str, 
    summary: Optional[str] = None, 
    source_title: Optional[str] = None, 
    categories: Optional[List[str]] = None,
    custom_prompt: Optional[str] = None,
    user_categories: Optional[List[str]] = None,
    model_override: Optional[str] = None,
    on_progress: Optional[Callable[[int], None]] = None,
    liked_tags: Optional[List[str]] = None,
    disliked_tags: Optional[List[str]] = None,
    short_summary_max_words: int = 20,
    short_summary_max_sentences: int = 1,
    is_official_source: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Anropar LM Studio och returnerar ett berikat artikelobjekt.
    Stödjer realtids-progress för prompt-bearbetning i GPU.
    Kastar inga ohanterade undantag så anroparen skyddas mot krascher.
    """
    system_prompt = custom_prompt.strip() if (custom_prompt and custom_prompt.strip()) else load_system_prompt()
    model = model_override.strip() if (model_override and model_override.strip()) else get_active_model()
    
    is_official = is_official_source or any(
        k in (source_title or "").lower() for k in ["krisinformation", "polisen", "msb", "sos alarm", "smhi", "kommun", "folkhalsomyndigheten", "regeringen", "domstol", "domstolar"]
    )

    # Bygg en kompakt, informativ användarprompt
    user_prompt_lines = [
        "Analysera följande nyhetsartikel och svara enbart med JSON-objektet:",
        f"Källa: {source_title or 'Okänd källa'}",
        f"Rubrik: {title or 'Utan rubrik'}"
    ]
    if is_official:
        user_prompt_lines.append("Källtyp: Officiell kris- eller myndighetsinformation (Får ALDRIG klassas som ClickBait)")
    if summary and summary.strip():
        # Begränsa texten om den är extremt lång för snabbare svar, men behåll tillräckligt för ort/detaljer
        clean_summary = summary.strip()[:1500]
        user_prompt_lines.append(f"Artikeltext / Ingress: {clean_summary}")
    if categories:
        cats_str = ", ".join(categories)
        if cats_str:
            user_prompt_lines.append(f"Kategorier från källan: {cats_str}")
            
    user_prompt = "\n".join(user_prompt_lines)
    
    t0 = time.time()
    try:
        parsed = None
        dur = 0.0
        raw_message = ""

        print(f"[AI Service] Skickar analys för '{title[:45]}...' till modell '{model}'...", flush=True)

        # 1. Försök först med nativ strömning för realtids-progress av GPU prompt-bearbetning (LM Studio)
        native_url = get_native_chat_endpoint()
        native_payload = {
            "model": model,
            "system_prompt": system_prompt,
            "input": user_prompt,
            "stream": True,
            "temperature": 0.1
        }

        try:
            resp = requests.post(native_url, json=native_payload, stream=True, timeout=LM_STUDIO_TIMEOUT)
            if resp.status_code == 200:
                accumulated = []
                last_reported = -1
                for line in resp.iter_lines():
                    if not line:
                        continue
                    decoded = line.decode('utf-8', errors='ignore')
                    if decoded.startswith("data: "):
                        data_str = decoded[6:].strip()
                        if not data_str:
                            continue
                        try:
                            obj = json.loads(data_str)
                            ev_type = obj.get("type")
                            if ev_type == "prompt_processing.progress":
                                pct = int(round(obj.get("progress", 0.0) * 100))
                                if on_progress and pct != last_reported:
                                    last_reported = pct
                                    on_progress(pct)
                            elif ev_type == "prompt_processing.end":
                                if on_progress and last_reported != 100:
                                    last_reported = 100
                                    on_progress(100)
                            elif ev_type == "message.delta":
                                token = obj.get("content", "")
                                if token:
                                    accumulated.append(token)
                                    if on_progress and last_reported < 100:
                                        last_reported = 100
                                        on_progress(100)
                        except Exception:
                            pass
                if accumulated:
                    raw_message = "".join(accumulated)
                    parsed = extract_json_from_text(raw_message)
                    dur = round(time.time() - t0, 2)
        except Exception:
            # Nativ endpoint stöds främst av LM Studio; vid Ollama används standard OpenAI-endpointen nedan
            pass

        # 2. Standard OpenAI /v1/chat/completions (används för Ollama eller som fallback för LM Studio)
        if not parsed:
            payload = {
                "model": model,
                "temperature": 0.1,
                "max_tokens": LM_STUDIO_MAX_TOKENS,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            }
            headers = {"Content-Type": "application/json"}
            try:
                response = requests.post(LM_STUDIO_URL, json=payload, headers=headers, timeout=LM_STUDIO_TIMEOUT)
                dur = round(time.time() - t0, 2)
                if response.status_code != 200:
                    print(f"[AI Service Fel] AI-servern på {LM_STUDIO_URL} svarade med HTTP {response.status_code} efter {dur}s för modell '{model}': {response.text[:300]}", flush=True)
                    return None
                    
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    print(f"[AI Service Fel] Inga svar returnerades från AI-servern efter {dur}s för modell '{model}': {data}", flush=True)
                    return None
                    
                raw_message = choices[0].get("message", {}).get("content", "")
                parsed = extract_json_from_text(raw_message)
            except requests.exceptions.ConnectTimeout:
                print(f"[AI Service Fel] Timeout vid anslutning till {LM_STUDIO_URL} för modell '{model}'.", flush=True)
                return None
            except requests.exceptions.ReadTimeout:
                print(f"[AI Service Fel] Timeout ({LM_STUDIO_TIMEOUT}s) vid analys av '{title[:40]}' med modell '{model}'. Modellen kan hålla på att läsas in i VRAM eller vara överbelastad.", flush=True)
                return None
            except Exception as fb_err:
                print(f"[AI Service Fel] Anrop mot {LM_STUDIO_URL} för modell '{model}' gav fel efter {round(time.time() - t0, 2)}s: {fb_err}", flush=True)
                return None

        if not parsed:
            print(f"[AI Service Fel] Kunde inte parsa giltig JSON från modell '{model}' ({len(raw_message)} tecken): {raw_message[:300]}", flush=True)
            return None
                
        # Normalisera kategori och matcha mot användarens definierade kategorier
        raw_cat = str(parsed.get("category", "Övrigt")).strip()
        category = "Övrigt"
        valid_cats = extract_category_names(user_categories)
        for valid_cat in valid_cats:
            if valid_cat.lower() == raw_cat.lower() or valid_cat.lower() in raw_cat.lower():
                category = valid_cat
                break
        if category == "Övrigt" and raw_cat and raw_cat.lower() != "övrigt" and len(raw_cat) < 30:
            category = raw_cat

        # Klickbete-hantering
        raw_cb = parsed.get("is_clickbait", False)
        is_clickbait = bool(raw_cb) if isinstance(raw_cb, bool) else (str(raw_cb).lower() in ("true", "1"))
        clickbait_reason = str(parsed.get("clickbait_reason", "")).strip()

        # Myndighets- och krisinformation kan aldrig vara ClickBait
        if is_official:
            is_clickbait = False
            clickbait_reason = ""

        # Extrahera mätvärden för poängmatrisen (urgency och substance)
        raw_u = parsed.get("urgency_score", 5)
        raw_s = parsed.get("substance_score", 5)
        try:
            urgency_score = int(raw_u)
        except Exception:
            urgency_score = 5
        try:
            substance_score = int(raw_s)
        except Exception:
            substance_score = 5

        raw_tags = parsed.get("tags", [])
        if isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if t and str(t).strip()]
        else:
            tags = []

        # Beräkna deterministisk prioritet och poäng baserat på sammansatt poängmatris och intresseprofil
        prio_calc = calculate_priority(
            category=category,
            categories_config=user_categories,
            urgency_score=urgency_score,
            substance_score=substance_score,
            is_clickbait=is_clickbait,
            tags=tags,
            liked_tags=liked_tags,
            disliked_tags=disliked_tags
        )
        priority = prio_calc["priority"]
        prio_score = prio_calc["prio_score"]
        prio_reason = prio_calc["prio_reason"]
            
        ai_summary = str(parsed.get("summary", "")).strip()
        raw_short = parsed.get("short_summary")
        ai_short_summary = str(raw_short).strip() if raw_short else ""
        # Intelligent fallback om modellen bara returnerade summary: ta första meningen
        if not ai_short_summary and ai_summary:
            first_sentence = ai_summary.split(".")[0].strip()
            ai_short_summary = (first_sentence + ".") if first_sentence else ai_summary

        # Tvinga strikt begränsning på max ord och meningar enligt användarens inställning
        ai_short_summary = enforce_short_summary_limits(
            ai_short_summary,
            max_words=short_summary_max_words,
            max_sentences=short_summary_max_sentences
        )

        return {
            "category": category,
            "priority": priority,
            "prio_score": prio_score,
            "prio_reason": prio_reason,
            "urgency_score": urgency_score,
            "substance_score": substance_score,
            "ai_summary": ai_summary,
            "ai_short_summary": ai_short_summary,
            "tags": tags,
            "is_clickbait": 1 if is_clickbait else 0,
            "clickbait_reason": clickbait_reason,
            "duration_s": dur,
            "ai_model": model
        }
    except requests.exceptions.ConnectTimeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Kunde inte upprätta anslutning till AI-servern på {AI_URL} efter {dur}s (ConnectTimeout)", flush=True)
        return None
    except requests.exceptions.ReadTimeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Timeout vid generering: AI-servern svarade inte inom {dur}s (ReadTimeout, gräns {AI_TIMEOUT}s)", flush=True)
        return None
    except requests.exceptions.ConnectionError:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] AI-servern är inte nåbar på {AI_URL} (offline efter {dur}s)", flush=True)
        return None
    except requests.exceptions.Timeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Timeout mot AI-servern efter {dur}s (gräns {AI_TIMEOUT}s)", flush=True)
        return None
    except Exception as e:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Oväntat fel vid analys efter {dur}s: {e}", flush=True)
        return None

def strip_emojis(text: str) -> str:
    """Tar bort eventuella emojis för att garantera att strikta användarregler följs."""
    if not text:
        return ""
    # Unicode emoji-intervall
    emoji_pattern = re.compile(
        "["
        "\U0001F000-\U0001FAFF"  # Emoticons, symboler, piktogram
        "\U00002700-\U000027BF"  # Dingbats
        "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
        "\U0001F600-\U0001F64F"  # Emoticons
        "\U0001F300-\U0001F5FF"  # Misc Symbols and Pictographs
        "\U0001F680-\U0001F6FF"  # Transport and Map
        "\U00002600-\U000026FF"  # Misc symbols
        "]+", 
        flags=re.UNICODE
    )
    return emoji_pattern.sub("", text)

def is_conversational_or_greeting(msg: str) -> bool:
    """Avgör om användarens meddelande är en allmän hälsning, artighetsfras eller presentation utan specifik nyhetsfråga."""
    m = msg.strip().lower()
    # Rensa bort vanliga skiljetecken och citationstecken
    m_clean = re.sub(r'[!?.,:;\"\'\(\)\-–—]', ' ', m)
    m_clean = ' '.join(m_clean.split())
    
    if not m_clean:
        return True
        
    greetings = {
        "hej", "hejsan", "hallå", "halla", "tjena", "tja", "morsning", "morrn", "tjenare", "läget",
        "god morgon", "god dag", "god middag", "god kväll", "godkväll",
        "trevligt att råkas", "trevligt att träffas",
        "hi", "hello", "hey",
        "tack", "tack så mycket", "tackar", "tusen tack", "många tack", "tack ska du ha",
        "vem är du", "vad är du", "vad kan du göra", "vad kan du hjälpa till med",
        "vad gör du", "hur mår du", "hur mår du idag", "hur fungerar du", "hjälp",
        "vad heter du", "presentera dig", "berätta om dig själv", "vad är detta",
        "test", "testar", "okej", "ok", "bra", "toppen", "fint", "perfekt"
    }
    if m_clean in greetings:
        return True
        
    greeting_prefixes = [
        "hej på dig", "hallå där", "tjena mors", "god morgon på dig", "vem skapade dig", "vem har byggt dig"
    ]
    if any(m_clean == p or m_clean.startswith(f"{p} ") for p in greeting_prefixes):
        return True
        
    return False

def is_broad_news_query(msg_lower: str) -> bool:
    """Avgör om frågan är en allmän överblick eller sammanfattning över nyhetsläget."""
    broad_indicators = [
        "vad har hänt", "vad händer", "senaste nytt", "senaste nyheterna", "sammanfatta nyheterna",
        "sammanfatta läget", "dagens nyheter", "nyhetsöversikt", "översikt", "viktigaste händelserna",
        "toppnyheter", "huvudnyheter", "alla händelser", "hur många händelser", "hur många artiklar",
        "vad rapporteras", "dagens viktigaste", "vad är nytt"
    ]
    return any(ind in msg_lower for ind in broad_indicators)

def prepare_chat_context(
    user_id: int,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Any = None
) -> Dict[str, Any]:
    """
    Förbereder kontext, källor och prompter för RAG-chatt.
    Skiljer intelligent mellan enkla hälsningar/konversationer, övergripande nyhetsrapporter och specifika ämnessökningar.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import or_, and_, desc
    import models

    history = history or []
    clean_msg = message.strip()
    msg_lower = clean_msg.lower()

    # 1. Konversationskontroll (Hälsning, presentation eller tack)
    if is_conversational_or_greeting(clean_msg):
        system_prompt = (
            "Du är en skarp, saklig och hjälpsam svenskspråkig nyhetsassistent för RSS-Bevakaren.\n"
            "Användaren har skickat en allmän hälsning, presentation, tack eller konversationsfras.\n\n"
            "Riktlinjer:\n"
            "1. Svara ALLTID på god, vänlig och naturlig svenska.\n"
            "2. Det är STRIKT FÖRBJUDET att använda emojis i hela svaret.\n"
            "3. Hälsa artigt tillbaka och presentera dig kort som RSS-Bevakarens AI-assistent.\n"
            "4. Förklara kort och pedagogiskt vad du kan hjälpa till med (t.ex. att söka och fördjupa dig i sparade nyhetsflöden, hitta artiklar om specifika orter eller händelser samt sammanfatta dagens nyhetsläge).\n"
            "5. Räkna INTE upp några specifika nyhetshändelser, siffror eller artiklar i svaret eftersom användaren inte har ställt någon nyhetsfråga än.\n"
            "6. OBLIGATORISKT - 4 FÖLJDKÖ: Avsluta ALLTID ditt svar med exakt 4 inspirerande och konkreta förslag på nyhetsfrågor som användaren kan ställa för att utforska sina flöden.\n"
            "Formatera dessa 4 frågor allra sist i svaret inneslutna i taggarna <foljdfragor> på följande format:\n"
            "<foljdfragor>\n"
            "- Vad är de viktigaste nyheterna i Sverige och världen idag?\n"
            "- Finns det några akuta blåljushändelser eller olyckor rapporterade?\n"
            "- Sammanfatta de senaste ekonominyheterna och börsläget.\n"
            "- Vilka är de mest omtalade teknik- och vetenskapsnyheterna just nu?\n"
            "</foljdfragor>"
        )

        messages = [{"role": "system", "content": system_prompt}]
        for h in history[-6:]:
            r = h.get("role", "")
            c = h.get("content", "")
            if r in ("user", "assistant") and c:
                messages.append({"role": r, "content": c})
        messages.append({"role": "user", "content": clean_msg})

        return {
            "sources": [],
            "total_period_count": 0,
            "system_prompt": system_prompt,
            "user_query_content": clean_msg,
            "messages": messages,
            "clean_msg": clean_msg,
            "context_str": "",
            "is_conversational": True
        }

    # 2. Identifiera tidsintervall för nyhetsfråga
    now = datetime.now()
    start_ts = None
    end_ts = None

    if "igår" in msg_lower:
        yesterday = now - timedelta(days=1)
        start_ts = int(datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0).timestamp())
        end_ts = int(datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59).timestamp())
    elif "idag" in msg_lower:
        start_ts = int(datetime(now.year, now.month, now.day, 0, 0, 0).timestamp())
    elif "dygn" in msg_lower or "24 timmar" in msg_lower or "24h" in msg_lower:
        start_ts = int((now - timedelta(hours=24)).timestamp())
    elif "vecka" in msg_lower or "veckan" in msg_lower or "7 dagar" in msg_lower:
        start_ts = int((now - timedelta(days=7)).timestamp())
    else:
        start_ts = int((now - timedelta(hours=72)).timestamp())

    # 3. Identifiera sökord (filtrera bort stoppord)
    stopwords = {
        "hur", "många", "vad", "vilka", "vem", "när", "var", "varför", "är", "var", 
        "skedde", "hände", "det", "den", "som", "att", "och", "eller", "i", "på", 
        "av", "med", "om", "till", "från", "för", "ett", "en", "artiklar", "artikel", 
        "nyheter", "händelse", "händelser", "finns", "rapporterats", "senaste", "igår", 
        "idag", "ge", "mig", "alla", "några", "berätta", "visa", "lista", "sammanfatta"
    }
    raw_words = re.findall(r'\b[a-zåäöA-ZÅÄÖ0-9_-]+\b', msg_lower)
    keywords = [w for w in raw_words if len(w) > 2 and w not in stopwords]

    articles = []
    total_period_count = 0
    broad_query = is_broad_news_query(msg_lower)

    if db:
        base_query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == user_id)
        
        time_filters = []
        if start_ts:
            time_filters.append(or_(
                models.Article.published_ts >= start_ts,
                models.Article.received_ts >= start_ts
            ))
        if end_ts:
            time_filters.append(or_(
                models.Article.published_ts <= end_ts,
                models.Article.received_ts <= end_ts
            ))
        if time_filters:
            base_query = base_query.filter(and_(*time_filters))

        try:
            total_period_count = base_query.count()
        except Exception:
            total_period_count = 0

        if broad_query:
            # Övergripande sammanfattningsfråga: Välj de viktigaste och nyaste artiklarna (max 25 st)
            articles = base_query.order_by(
                desc(models.Article.prio_score),
                desc(models.Article.published_ts)
            ).limit(25).all()
        else:
            # Specifik sökning: Semantisk ranking + nyckelordsfilter
            q_embs = get_text_embeddings([clean_msg], is_query=True)
            semantic_success = False

            if q_embs and len(q_embs) > 0 and len(q_embs[0]) > 0:
                try:
                    q_vec = np.array(q_embs[0], dtype=np.float32)
                    q_norm = float(np.linalg.norm(q_vec))

                    candidates = base_query.order_by(desc(models.Article.published_ts)).limit(150).all()
                    if candidates:
                        missing = [c for c in candidates[:15] if not c.embedding]
                        if missing:
                            batch_embed_articles(missing, db)

                        scored_articles = []
                        for art in candidates:
                            sim_score = 0.0
                            if art.embedding and art.embedding.vector:
                                try:
                                    cand_vec = np.frombuffer(art.embedding.vector, dtype=np.float32)
                                    cand_norm = float(np.linalg.norm(cand_vec))
                                    if q_norm > 0 and cand_norm > 0:
                                        sim_score = float(np.dot(q_vec, cand_vec) / (q_norm * cand_norm))
                                except Exception:
                                    pass

                            kw_bonus = 0.0
                            if keywords:
                                text_blob = f"{art.title or ''} {art.summary or ''} {art.ai_summary or ''} {art.category or ''}".lower()
                                for kw in keywords[:5]:
                                    if kw in text_blob:
                                        kw_bonus += 0.12

                            prio_bonus = 0.03 if (art.priority == "high" or (art.prio_score or 0) >= 75) else 0.0
                            total_score = sim_score + kw_bonus + prio_bonus

                            # Kvalitetsspärr: Endast artiklar med faktisk relevans (eller direkt sökordsmatch)
                            if total_score >= 0.50 or kw_bonus > 0:
                                scored_articles.append((total_score, art))

                        if scored_articles:
                            scored_articles.sort(key=lambda x: x[0], reverse=True)
                            articles = [item[1] for item in scored_articles[:25]]
                            semantic_success = True
                except Exception as e:
                    print(f"[AI Chat] Fel vid semantisk ranking: {e}", flush=True)

            if not semantic_success and keywords:
                # Nyckelordsmatchning mot sparade artiklar
                kw_conditions = []
                for kw in keywords[:5]:
                    kw_conditions.extend([
                        models.Article.title.ilike(f"%{kw}%"),
                        models.Article.summary.ilike(f"%{kw}%"),
                        models.Article.ai_summary.ilike(f"%{kw}%"),
                        models.Article.tags.ilike(f"%{kw}%"),
                        models.Article.category.ilike(f"%{kw}%")
                    ])
                articles = base_query.filter(or_(*kw_conditions)).order_by(
                    desc(models.Article.published_ts),
                    desc(models.Article.received_ts)
                ).limit(25).all()

        articles.sort(key=lambda x: (x.published_ts or 0, x.received_ts or 0), reverse=True)

    # 4. Bygg käll-lista (max 25 relevanta artiklar)
    sources = []
    for art in articles[:25]:
        sources.append({
            "id": art.id,
            "title": art.title or "Utan rubrik",
            "source_name": art.feed.title if art.feed else "RSS",
            "published_at": art.published or "",
            "link": art.link or "",
            "summary": art.ai_summary or art.summary or "",
            "category": art.category or "Övrigt",
            "is_prio": bool(art.priority == "high" or (art.prio_score or 0) >= 75)
        })

    # 5. Bygg kontext för modellen
    context_lines = []
    if articles:
        if total_period_count > 0 and broad_query:
            context_lines.append(
                f"[Systemstatistik: Det finns totalt {total_period_count} sparade händelser i databasen för det valda tidsintervallet. "
                f"Nedan listas de {len(sources)} mest relevanta händelserna.]\n"
            )

        for i, art in enumerate(articles[:25], 1):
            source_title = art.feed.title if art.feed else "RSS"
            pub_date = art.published or "Okänt datum"
            cat = art.category or "Övrigt"
            summary_text = (art.ai_summary or art.summary or "").strip()
            context_lines.append(
                f"[Artikel {i}] (ID: {art.id})\n"
                f"Källa: {source_title} | Datum: {pub_date} | Kategori: {cat}\n"
                f"Rubrik: {art.title}\n"
                f"Sammanfattning: {summary_text[:280]}\n"
            )
        context_str = "\n".join(context_lines)
    else:
        context_str = f"Inga sparade artiklar matchade sökningen '{clean_msg}' under det valda tidsintervallet."

    system_prompt = (
        "Du är en skarp, saklig och hjälpsam svenskspråkig nyhetsassistent för RSS-Bevakaren.\n"
        "Din uppgift är att svara på användarens frågor baserat på artiklarna och systemstatistiken i kontexten.\n\n"
        "Riktlinjer:\n"
        "1. Svara ALLTID på god, tydlig och naturlig svenska.\n"
        "2. Det är STRIKT FÖRBJUDET att använda emojis i svaret.\n"
        "3. Basera dina påståenden och fakta på de bifogade artiklarna. Hitta inte på information som saknas.\n"
        "4. Om användaren frågar om totalt antal händelser eller en övergripande rapport, ange den exakta siffran om sådan finns i statistiken "
        "och sammanfatta de viktigaste händelserna med ort/plats och källa.\n"
        "5. Om inga relevanta artiklar finns i kontexten för det sökta ämnet, förklara sakligt och artigt att informationen inte finns bland de sparade artiklarna.\n"
        "6. Använd god styckeindelning och punktlistor vid behov för maximal läsbarhet.\n"
        "7. OBLIGATORISKT - 4 FÖLJDKÖ: Avsluta ALLTID ditt svar med exakt 4 skarpa, naturliga och relevanta följdfrågor baserade på de specifika händelser och detaljer du redovisat (eller förslag på sökningar om inga träffar fanns).\n"
        "Formatera dessa 4 frågor allra sist i svaret inneslutna i taggarna <foljdfragor> på följande format:\n"
        "<foljdfragor>\n"
        "- [Konkret följdfråga 1]\n"
        "- [Konkret följdfråga 2]\n"
        "- [Konkret följdfråga 3]\n"
        "- [Konkret följdfråga 4]\n"
        "</foljdfragor>"
    )

    user_query_content = (
        f"Artiklar från användarens flöden:\n{context_str}\n\n"
        f"Användarens fråga: {clean_msg}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:
        r = h.get("role", "")
        c = h.get("content", "")
        if r in ("user", "assistant") and c:
            messages.append({"role": r, "content": c})
    messages.append({"role": "user", "content": user_query_content})

    return {
        "sources": sources,
        "total_period_count": total_period_count,
        "system_prompt": system_prompt,
        "user_query_content": user_query_content,
        "messages": messages,
        "clean_msg": clean_msg,
        "context_str": context_str,
        "is_conversational": False
    }

def clean_ai_response_and_extract_followups(raw_reply: str, sources: List[Dict[str, Any]], model: str) -> Dict[str, Any]:
    """Extraherar följdfrågor, rensar taggar och emojis ur AI-svaret."""
    clean_reply = strip_emojis(raw_reply or "").strip()

    follow_ups = []
    followup_match = re.search(r"<foljdfragor>(.*?)</foljdfragor>", clean_reply, re.DOTALL | re.IGNORECASE)
    if not followup_match:
        followup_match = re.search(r"<följdfrågor>(.*?)</följdfrågor>", clean_reply, re.DOTALL | re.IGNORECASE)

    if followup_match:
        raw_block = followup_match.group(1).strip()
        clean_reply = re.sub(r"<(?:foljdfragor|följdfrågor)>.*?</(?:foljdfragor|följdfrågor)>", "", clean_reply, flags=re.DOTALL | re.IGNORECASE).strip()
        for line in raw_block.split("\n"):
            cleaned_line = re.sub(r"^[\s*\-•\d\.\)]+", "", line).strip().strip('"\'')
            if len(cleaned_line) > 5 and cleaned_line not in follow_ups:
                if not cleaned_line.endswith("?"):
                    cleaned_line = f"{cleaned_line}?"
                follow_ups.append(cleaned_line)

    follow_ups = follow_ups[:4]

    # Om följdfrågor saknas eller är färre än 4, fyll på med artikelbaserade eller allmänna frågor
    if len(follow_ups) < 4 and sources:
        for s in sources[:4]:
            t = s.get("title", "")
            if t and len(t) > 5:
                q_cand = f"Vad mer rapporteras om {t.lower()}?"
                if q_cand not in follow_ups:
                    follow_ups.append(q_cand)
            if len(follow_ups) >= 4:
                break

    if len(follow_ups) < 4:
        default_followups = [
            "Vad är de viktigaste nyheterna i Sverige och världen idag?",
            "Finns det några akuta blåljushändelser eller olyckor rapporterade?",
            "Sammanfatta de senaste ekonominyheterna och börsläget.",
            "Vilka är de mest omtalade teknik- och vetenskapsnyheterna just nu?"
        ]
        for df in default_followups:
            if df not in follow_ups:
                follow_ups.append(df)
            if len(follow_ups) >= 4:
                break

    return {
        "reply": clean_reply or "Inget svar kunde formuleras.",
        "sources": sources,
        "model": model or "Lokal AI",
        "follow_ups": follow_ups
    }

def chat_with_news(
    user_id: int,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Any = None,
    model_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Standard synkron RAG AI-chatt (JSON-svar).
    """
    history = history or []
    ctx = prepare_chat_context(user_id=user_id, message=message, history=history, db=db)
    sources = ctx["sources"]
    messages = ctx["messages"]
    clean_msg = ctx["clean_msg"]

    model = model_override or AI_MODEL or ""
    q_type = "Hälsning/Konversation" if ctx.get("is_conversational") else f"Nyhetssökning ({len(sources)} källor)"
    print(f"[AI Chat] Mottog chattfråga: '{clean_msg[:45]}...' ({q_type}) till modell '{model}'...", flush=True)

    payload = {
        "model": model,
        "temperature": 0.3,
        "max_tokens": LM_STUDIO_MAX_TOKENS,
        "messages": messages
    }

    t0 = time.time()
    try:
        response = requests.post(AI_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=AI_TIMEOUT)
        dur = round(time.time() - t0, 2)
        if response.status_code != 200:
            print(f"[AI Chat Fel] AI-servern på {AI_URL} svarade med HTTP {response.status_code} efter {dur}s för modell '{model}': {response.text[:300]}", flush=True)
            return {
                "reply": f"Kunde inte generera ett svar från AI-servern (svarade med HTTP {response.status_code}). Kontrollera att servern och modellen '{model}' är aktiva.",
                "sources": sources,
                "model": model or "Okänd",
                "follow_ups": []
            }

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            return {
                "reply": "Inget svar returnerades från den lokala AI-modellen.",
                "sources": sources,
                "model": model or "Okänd",
                "follow_ups": []
            }

        raw_reply = choices[0].get("message", {}).get("content", "")
        used_model = data.get("model", model or "Lokal AI")
        return clean_ai_response_and_extract_followups(raw_reply, sources, used_model)
    except requests.exceptions.ConnectTimeout:
        return {
            "reply": f"Kunde inte upprätta anslutning till AI-servern på {AI_URL}. Kontrollera att servern (Ollama / LM Studio) körs och att nätverksåtkomst är tillåten.",
            "sources": sources,
            "model": model or "Offline",
            "follow_ups": []
        }
    except requests.exceptions.ReadTimeout:
        return {
            "reply": f"AI-servern svarade inte inom tidsgränsen ({AI_TIMEOUT}s). Modellen kan vara överbelastad eller genererar ett för långt svar.",
            "sources": sources,
            "model": model or "Timeout",
            "follow_ups": []
        }
    except requests.exceptions.ConnectionError:
        return {
            "reply": f"AI-servern är offline eller onåbar på {AI_URL}.",
            "sources": sources,
            "model": model or "Offline",
            "follow_ups": []
        }
    except Exception as e:
        return {
            "reply": f"Ett oväntat fel inträffade vid anslutning till AI-motorn: {e}",
            "sources": sources,
            "model": model or "Fel",
            "follow_ups": []
        }

def stream_chat_with_news(
    user_id: int,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Any = None,
    model_override: Optional[str] = None
):
    """
    Strömmande RAG-assistent som skickar SSE-events:
    1. {"type": "sources", "sources": sources, "total_count": total_count}
    2. {"type": "progress", "percent": 0..100, "stage": "prompt"}
    3. {"type": "token", "content": chunk}
    4. {"type": "done", "reply": reply, "sources": sources, "follow_ups": follow_ups, "model": model}
    """
    history = history or []
    ctx = prepare_chat_context(user_id=user_id, message=message, history=history, db=db)
    sources = ctx["sources"]
    total_period_count = ctx["total_period_count"]
    system_prompt = ctx["system_prompt"]
    messages = ctx["messages"]
    clean_msg = ctx["clean_msg"]
    context_str = ctx["context_str"]
    is_conv = ctx.get("is_conversational", False)

    # 1. Skicka direkt källorna och totalantalet händelser till frontend
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'total_count': total_period_count})}\n\n"

    model = model_override or AI_MODEL or ""
    q_type = "Hälsning/Konversation" if is_conv else f"Nyhetssökning ({len(sources)} källor)"
    print(f"[AI Chat] Strömmande chattfråga: '{clean_msg[:45]}...' ({q_type}) till modell '{model}'...", flush=True)

    native_url = get_native_chat_endpoint()

    # Formatera input för LM Studios nativa /api/v1/chat endpoint
    input_parts = []
    if history:
        input_parts.append("Tidigare konversation i samtalet:")
        for h in history[-4:]:
            r = h.get("role", "")
            c = h.get("content", "")
            if r and c:
                input_parts.append(f"- {r}: {c[:250]}")
        input_parts.append("")
    if not is_conv and context_str:
        input_parts.append(f"Artiklar från användarens flöden:\n{context_str}")
    input_parts.append(f"Användarens fråga: {clean_msg}")
    full_input = "\n\n".join(input_parts)

    native_payload = {
        "model": model,
        "system_prompt": system_prompt,
        "input": full_input,
        "stream": True,
        "temperature": 0.3
    }

    accumulated = []
    used_model = model or "Lokal AI"
    stream_successful = False

    try:
        resp = requests.post(native_url, json=native_payload, stream=True, timeout=AI_TIMEOUT)
        if resp.status_code == 200:
            current_event = None
            for line in resp.iter_lines():
                if not line:
                    continue
                decoded = line.decode('utf-8', errors='ignore')
                if decoded.startswith("event: "):
                    current_event = decoded[7:].strip()
                    continue
                if decoded.startswith("data: "):
                    data_str = decoded[6:].strip()
                    if not data_str:
                        continue
                    try:
                        obj = json.loads(data_str)
                        ev_type = obj.get("type") or current_event
                        if ev_type == "prompt_processing.progress":
                            pct = int(round(obj.get("progress", 0.0) * 100))
                            yield f"data: {json.dumps({'type': 'progress', 'percent': pct, 'stage': 'prompt'})}\n\n"
                        elif ev_type == "prompt_processing.end":
                            yield f"data: {json.dumps({'type': 'progress', 'percent': 100, 'stage': 'prompt'})}\n\n"
                        elif ev_type == "message.delta":
                            token = obj.get("content", "")
                            if token:
                                accumulated.append(token)
                                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                        elif ev_type == "chat.start":
                            if obj.get("model_instance_id"):
                                used_model = obj.get("model_instance_id")
                    except Exception:
                        pass
            if accumulated:
                stream_successful = True
    except Exception:
        # Vid Ollama stöds inte LM Studios nativa endpoint; faller vidare till standard OpenAI nedan
        pass

    # Fallback: Om inte nativ endpoint fungerade, använd OpenAI-kompatibla AI_URL
    if not stream_successful or not accumulated:
        try:
            openai_payload = {
                "model": model,
                "temperature": 0.3,
                "max_tokens": LM_STUDIO_MAX_TOKENS,
                "messages": messages,
                "stream": True
            }
            yield f"data: {json.dumps({'type': 'progress', 'percent': 100, 'stage': 'prompt'})}\n\n"

            fb_resp = requests.post(AI_URL, json=openai_payload, stream=True, timeout=AI_TIMEOUT)
            if fb_resp.status_code == 200:
                for line in fb_resp.iter_lines():
                    if not line:
                        continue
                    decoded = line.decode('utf-8', errors='ignore')
                    if decoded.startswith("data: "):
                        data_str = decoded[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            obj = json.loads(data_str)
                            if obj.get("model"):
                                used_model = obj.get("model")
                            choices = obj.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    accumulated.append(content)
                                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        except Exception:
                            pass
            else:
                print(f"[AI Chat Fel] AI-servern på {AI_URL} svarade med HTTP {fb_resp.status_code} för modell '{model}': {fb_resp.text[:300]}", flush=True)
                yield f"data: {json.dumps({'type': 'error', 'message': f'AI-servern svarade med HTTP {fb_resp.status_code}. Kontrollera att modellen är aktiv.'})}\n\n"
                return
        except requests.exceptions.ConnectTimeout:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Kunde inte ansluta till AI-servern på {AI_URL}. Kontrollera att servern är igång.'})}\n\n"
            return
        except requests.exceptions.ReadTimeout:
            yield f"data: {json.dumps({'type': 'error', 'message': f'AI-servern svarade inte inom tidsgränsen ({AI_TIMEOUT}s). Modellen kan hålla på att läsas in i minnet.'})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Ett fel uppstod vid kommunikation med AI-servern: {e}'})}\n\n"
            return

    raw_reply = "".join(accumulated)
    res_obj = clean_ai_response_and_extract_followups(raw_reply, sources, used_model)
    yield f"data: {json.dumps({'type': 'done', 'reply': res_obj['reply'], 'sources': sources, 'follow_ups': res_obj['follow_ups'], 'model': res_obj['model']})}\n\n"

# ==========================================
# NYHETSKLUSTRING OCH DUBLETTHANTERING
# ==========================================

SWEDISH_STOPWORDS = {
    "och", "i", "på", "att", "av", "en", "ett", "det", "som", "är", "för", "med", "till", 
    "den", "har", "om", "inte", "nu", "efter", "mot", "under", "flera", "ska", "de", "vi", 
    "ni", "så", "kan", "men", "denna", "dessa", "där", "då", "bli", "blir", "blev", "vid"
}

def clean_title_tokens(text: str) -> set:
    if not text:
        return set()
    cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
    words = {w for w in cleaned.split() if len(w) > 2 and w not in SWEDISH_STOPWORDS}
    return words

def compute_text_similarity(title1: str, title2: str) -> float:
    """Heuristisk ordöverlappning och Jaccard-likhet mellan två rubriker."""
    set1 = clean_title_tokens(title1)
    set2 = clean_title_tokens(title2)
    if not set1 or not set2:
        return 0.0
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    jaccard = len(intersection) / len(union) if union else 0.0
    if len(intersection) >= 4:
        return max(jaccard, 0.88)
    if len(intersection) >= 3 and jaccard >= 0.40:
        return max(jaccard, 0.85)
    return jaccard

GENERIC_LOCATION_TERMS = {
    'blåljus', 'trafikolycka', 'polis', 'ambulans', 'brand', 'räddningstjänst', 
    'inbrott', 'olycka', 'stöld', 'misshandel', 'rån', 'mord', 'dråp', 'brott', 
    'larm', 'varning', 'vittne', 'krasch', 'singelolycka', 'trafik', 'politik', 
    'ekonomi', 'sport', 'inrikes', 'utrikes', 'teknik', 'motor', 'nyheter', 
    'händelse', 'händelser', 'aktuellt', 'lördag', 'söndag', 'måndag', 'tisdag',
    'onsdag', 'torsdag', 'fredag', 'idag', 'igår', 'september', 'oktober', 'november',
    'december', 'januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti'
}

def extract_article_locations(title: str, text: str = "", tags: Any = None) -> set:
    """Extraherar orter, stadsdelar, vägar och geografiska entiteter ur en artikel."""
    locs = set()
    if tags:
        parsed_tags = tags
        if isinstance(tags, str):
            try:
                parsed_tags = json.loads(tags)
            except Exception:
                parsed_tags = [t.strip() for t in tags.split(',') if t.strip()]
        if isinstance(parsed_tags, list):
            for t in parsed_tags:
                if isinstance(t, str):
                    t_clean = t.strip().lower()
                    if t_clean and t_clean not in GENERIC_LOCATION_TERMS and len(t_clean) > 2:
                        locs.add(t_clean)

    full_text = f"{title or ''}. {text or ''}"
    
    # Polisen-format i titel: t.ex. "12 september 07.28, Trafikolycka, Sollefteå"
    m_police = re.search(r',\s*([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]+(?:\s+[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]+)?)$', title or '')
    if m_police:
        w = m_police.group(1).strip().lower()
        if w not in GENERIC_LOCATION_TERMS and len(w) > 2:
            locs.add(w)

    # Prepositionsmönster: i, på, vid, från, utanför, nära <Plats>
    for m in re.finditer(r'\b(?:i|på|vid|från|utanför|nära|kring)\s+([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-]+)\b', full_text):
        w = m.group(1).strip().lower()
        if w not in GENERIC_LOCATION_TERMS and len(w) > 2:
            locs.add(w)

    # Vägar och motorvägar
    for m in re.finditer(r'\b(?:länsväg|riksväg|e|lv|rv)\s*\d+\b', full_text, re.IGNORECASE):
        cleaned_road = re.sub(r'\s+', ' ', m.group(0).lower())
        locs.add(cleaned_road)

    return locs

def has_location_conflict(locs1: set, locs2: set) -> bool:
    """Returnerar True om båda artiklarna har identifierade platser men saknar gemensam plats (konflikt)."""
    if not locs1 or not locs2:
        return False
    return len(locs1.intersection(locs2)) == 0

def find_or_create_article_cluster(article_id: int, db: Any, similarity_threshold: float = 0.88) -> Tuple[Optional[int], float]:
    """
    Söker efter liknande artiklar inom 36 timmar och kopplar artikeln till ett kluster.
    Validerar geografisk plats (förhindrar att olyckor i olika orter slås ihop)
    och använder semantisk Nomic-embedding om tillgängligt, annars heuristisk textlikhet.
    Returnerar (cluster_id, likhetsgrad).
    """
    if not db or not article_id:
        return None, 0.0
    try:
        import models
        art = db.query(models.Article).filter(models.Article.id == article_id).first()
        if not art:
            return None, 0.0

        if art.cluster_id:
            return art.cluster_id, 1.0

        now_ts = int(time.time())
        cutoff_ts = now_ts - (36 * 3600)
        art_ts = art.received_ts or art.published_ts or now_ts
        min_ts = min(cutoff_ts, art_ts - (36 * 3600))
        max_ts = art_ts + (36 * 3600)

        candidates = db.query(models.Article).filter(
            models.Article.id != article_id,
            models.Article.feed_id != art.feed_id,
            models.Article.received_ts >= min_ts,
            models.Article.received_ts <= max_ts
        ).order_by(models.Article.received_ts.desc()).limit(150).all()

        if not candidates:
            return None, 0.0

        art_vec = None
        art_norm = 0.0
        if art.embedding and art.embedding.vector:
            try:
                art_vec = np.frombuffer(art.embedding.vector, dtype=np.float32)
                art_norm = float(np.linalg.norm(art_vec))
            except Exception:
                art_vec = None

        art_locs = extract_article_locations(art.title or "", art.ai_summary or art.content or "", art.tags)
        is_crime_or_accident = (art.category == "Blåljus") or any(k in (art.title or "").lower() for k in ["olycka", "krasch", "mord", "skjutning", "brand", "rån", "misshandel"])

        best_match = None
        best_sim = 0.0

        for cand in candidates:
            # 1. Geografisk validering: Skilda orter/platser kan aldrig vara samma lokala händelse
            cand_locs = extract_article_locations(cand.title or "", cand.ai_summary or cand.content or "", cand.tags)
            if has_location_conflict(art_locs, cand_locs):
                continue

            # 2. Anpassa tröskel: Blåljus kräver högre precision såvida inte samma plats bekräftats
            has_shared_loc = bool(art_locs and cand_locs and art_locs.intersection(cand_locs))
            if is_crime_or_accident or cand.category == "Blåljus":
                target_threshold = 0.86 if has_shared_loc else 0.91
            elif has_shared_loc:
                target_threshold = max(0.84, similarity_threshold - 0.03)
            else:
                target_threshold = similarity_threshold

            sim = 0.0
            if art_vec is not None and cand.embedding and cand.embedding.vector:
                try:
                    cand_vec = np.frombuffer(cand.embedding.vector, dtype=np.float32)
                    cand_norm = float(np.linalg.norm(cand_vec))
                    if art_norm > 0 and cand_norm > 0:
                        sim = float(np.dot(art_vec, cand_vec) / (art_norm * cand_norm))
                except Exception:
                    sim = 0.0

            # Heuristisk fallback om vektorjämförelse inte räckte eller saknades
            if sim < target_threshold:
                text_sim = compute_text_similarity(art.title or "", cand.title or "")
                if text_sim > sim:
                    sim = text_sim

            if sim >= target_threshold and sim > best_sim:
                best_sim = sim
                best_match = cand

        if best_match:
            cluster_id = best_match.cluster_id
            if not cluster_id:
                cluster_id = best_match.id
                best_match.cluster_id = cluster_id
            
            art.cluster_id = cluster_id
            db.commit()
            return cluster_id, best_sim

    except Exception as e:
        print(f"[Topic Clustering] Fel vid klustring av artikel {article_id}: {e}", flush=True)
        try:
            db.rollback()
        except Exception:
            pass
    return None, 0.0

def cluster_recent_unclustered_articles(db: Any, hours: int = 36, limit: int = 150) -> int:
    """Kör klustring på nyligen inkomna artiklar som saknar cluster_id."""
    if not db:
        return 0
    try:
        import models
        cutoff_ts = int(time.time()) - (hours * 3600)
        articles = db.query(models.Article).filter(
            models.Article.received_ts >= cutoff_ts,
            models.Article.cluster_id == None
        ).order_by(models.Article.received_ts.desc()).limit(limit).all()

        clustered_count = 0
        for art in articles:
            cid, _ = find_or_create_article_cluster(art.id, db)
            if cid:
                clustered_count += 1
        return clustered_count
    except Exception as e:
        print(f"[Topic Clustering] Fel vid massklustring: {e}", flush=True)
        return 0

# ==========================================
# DAGENS BRIEFING (AI DIGEST)
# ==========================================

def generate_daily_digest(db: Any, user_id: int, model: Optional[str] = None, force_rule_based: bool = False) -> Dict[str, Any]:
    """
    Genererar en strukturerad daglig briefing (Morgon/Kvällsrapport) baserat på
    de viktigaste händelserna från de senaste 24 timmarna.
    Använder LM Studio om tillgängligt, annars regelbaserad sammanställning.
    Strikt förbud mot emojis i hela texten.
    """
    if not db or not user_id:
        return {"error": "Ogiltiga parametrar"}

    import models
    now_ts = int(time.time())
    cutoff_24h = now_ts - (24 * 3600)

    # 1. Hämta användarens aktiva flöden och artiklar från senaste 24h
    user_articles = db.query(models.Article).join(models.Feed).filter(
        models.Feed.user_id == user_id,
        models.Feed.include_in_dashboard == 1,
        models.Article.received_ts >= cutoff_24h
    ).order_by(models.Article.prio_score.desc(), models.Article.received_ts.desc()).all()

    if not user_articles:
        cutoff_48h = now_ts - (48 * 3600)
        user_articles = db.query(models.Article).join(models.Feed).filter(
            models.Feed.user_id == user_id,
            models.Feed.include_in_dashboard == 1,
            models.Article.received_ts >= cutoff_48h
        ).order_by(models.Article.prio_score.desc(), models.Article.received_ts.desc()).limit(30).all()

    local_hour = time.localtime(now_ts).tm_hour
    period_name = "Morgonrapport" if 5 <= local_hour < 12 else ("Eftermiddagsrapport" if 12 <= local_hour < 18 else "Kvällsrapport")
    today_str = time.strftime("%Y-%m-%d", time.localtime(now_ts))

    if not user_articles:
        return {
            "title": f"{period_name} ({today_str})",
            "content": "Inga aktuella nyhetshändelser finns tillgängliga för sammanställning just nu. Lägg till eller uppdatera RSS-flöden för att generera en rapport.",
            "digest_type": "empty",
            "article_ids": [],
            "articles": [],
            "created_at": now_ts
        }

    # 2. Intelligent diversifierat urval för bredd och balans:
    # - Max 1 artikel per kluster (samma nyhetshändelse från flera redaktioner)
    # - Max 2 artiklar per källflöde (förhindrar att en enskild sajt dominerar urvalet)
    # - Max 3 artiklar per kategori (förhindrar att t.ex. Formel 1 eller sport kuppar hela rapporten)
    MAX_DIGEST_ITEMS = 10
    MAX_PER_FEED = 2
    MAX_PER_CATEGORY = 3

    seen_clusters = set()
    feed_counts = {}
    category_counts = {}
    top_candidates = []
    remaining_candidates = []

    # Pass 1: Strikt diversifiering
    for art in user_articles:
        if art.cluster_id:
            if art.cluster_id in seen_clusters:
                continue

        f_id = art.feed_id
        cat = (art.category or "Övrigt").strip()

        current_feed_count = feed_counts.get(f_id, 0)
        current_cat_count = category_counts.get(cat, 0)

        if current_feed_count < MAX_PER_FEED and current_cat_count < MAX_PER_CATEGORY:
            if art.cluster_id:
                seen_clusters.add(art.cluster_id)
            feed_counts[f_id] = current_feed_count + 1
            category_counts[cat] = current_cat_count + 1
            top_candidates.append(art)
            if len(top_candidates) >= MAX_DIGEST_ITEMS:
                break
        else:
            remaining_candidates.append(art)

    # Pass 2: Mjuk fallback om vi har färre än 10 artiklar (fyll på med högsta poäng utan dubblettkluster)
    if len(top_candidates) < MAX_DIGEST_ITEMS:
        for art in remaining_candidates:
            if art in top_candidates:
                continue
            if art.cluster_id and art.cluster_id in seen_clusters:
                continue
            f_id = art.feed_id
            if feed_counts.get(f_id, 0) < 3:
                if art.cluster_id:
                    seen_clusters.add(art.cluster_id)
                feed_counts[f_id] = feed_counts.get(f_id, 0) + 1
                top_candidates.append(art)
                if len(top_candidates) >= MAX_DIGEST_ITEMS:
                    break

    covered_ids = [a.id for a in top_candidates]
    covered_articles_summary = [
        {
            "id": a.id,
            "title": a.title,
            "source_title": a.feed.title if a.feed else "",
            "link": a.link,
            "category": a.category or "Övrigt",
            "published": a.published
        }
        for a in top_candidates
    ]

    digest_title = f"{period_name} ({today_str})"

    lm_online = False
    if not force_rule_based:
        lm_online = check_lm_studio_health()

    digest_text = ""
    digest_type = "ai_generated" if lm_online else "rule_based"

    if lm_online:
        items_text = []
        for i, art in enumerate(top_candidates, 1):
            src = art.feed.title if art.feed else "Nyhetskälla"
            summary_part = art.ai_summary or art.summary or ""
            items_text.append(f"{i}. Källa: {src}\nRubrik: {art.title}\nDetaljer: {summary_part[:300]}")

        prompt_input = "\n\n".join(items_text)
        system_msg = (
            "Du är en professionell svensk nyhetsredaktör och analytiker för RSS-bevakaren.\n"
            "Din uppgift är att sammanställa 'Dagens Briefing' baserat på följande aktuella nyhetshändelser.\n"
            "Instruktioner:\n"
            "1. Börja med en inledande övergripande mening som fångar det samlade nyhetsläget.\n"
            "2. Välj ut de 3 till 5 viktigaste händelserna och formulera en koncis punktlista.\n"
            "3. Varje punkt i listan SKA inledas med en fetstilt rubrik följt av 1-2 informativa, sakliga meningar.\n"
            "4. Skriv uteslutande på ren, korrekt svenska.\n"
            "5. Allsidig representation: Se till att rapporten lyfter fram en god och balanserad bredd över de olika ämnena i underlaget istället för att ensidigt fokusera på en nisch.\n"
            "6. STRIKT FÖRBUD MOT EMOJIS: Det är absolut förbjudet att använda några som helst emojis eller symbol-ikoner i svaret."
        )

        try:
            target_model = model or get_active_model()
            payload = {
                "model": target_model,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": f"Här är dagens viktigaste händelser:\n\n{prompt_input}\n\nSkapa en professionell sammanfattning enligt instruktionerna utan några emojis."}
                ],
                "temperature": 0.3,
                "max_tokens": 1200,
                "stream": False
            }
            res = requests.post(LM_STUDIO_URL, json=payload, timeout=60)
            if res.status_code == 200:
                data = res.json()
                choices = data.get("choices", [])
                if choices:
                    digest_text = choices[0].get("message", {}).get("content", "").strip()
        except Exception as e:
            print(f"[Daily Digest] Fel vid anrop till LM Studio: {e}", flush=True)

    if not digest_text:
        digest_type = "rule_based"
        bullet_points = []
        for art in top_candidates[:5]:
            src = art.feed.title if art.feed else "Källa"
            lead = art.title or "Viktig händelse"
            desc = art.ai_summary or (art.summary[:150] + "..." if art.summary else "Se källan för mer information.")
            bullet_points.append(f"- **{lead}** ({src}): {desc}")

        digest_text = (
            f"Sammanställning av dagens centrala nyhetshändelser från dina bevakade källor.\n\n"
            + "\n\n".join(bullet_points)
        )

    # Rensa eventuella emojis ur digest_text
    clean_text = re.sub(r'[\U00010000-\U0010ffff]', '', digest_text)

    try:
        new_digest = models.DailyDigest(
            user_id=user_id,
            title=digest_title,
            content=clean_text,
            digest_type=digest_type,
            article_ids=json.dumps(covered_ids),
            created_at=now_ts
        )
        db.add(new_digest)
        db.commit()
        db.refresh(new_digest)

        return {
            "id": new_digest.id,
            "title": new_digest.title,
            "content": new_digest.content,
            "digest_type": new_digest.digest_type,
            "article_ids": covered_ids,
            "articles": covered_articles_summary,
            "created_at": new_digest.created_at
        }
    except Exception as e:
        print(f"[Daily Digest] Kunde inte spara i databas: {e}", flush=True)
        try:
            db.rollback()
        except Exception:
            pass

    return {
        "id": 0,
        "title": digest_title,
        "content": clean_text,
        "digest_type": digest_type,
        "article_ids": covered_ids,
        "articles": covered_articles_summary,
        "created_at": now_ts
    }

def get_latest_daily_digest(db: Any, user_id: int, max_age_hours: int = 18) -> Optional[Dict[str, Any]]:
    """Hämtar den senaste sparade briefingen om den är nyare än max_age_hours."""
    if not db or not user_id:
        return None
    try:
        import models
        cutoff = int(time.time()) - (max_age_hours * 3600)
        digest = db.query(models.DailyDigest).filter(
            models.DailyDigest.user_id == user_id,
            models.DailyDigest.created_at >= cutoff
        ).order_by(models.DailyDigest.created_at.desc()).first()

        if not digest:
            return None

        art_ids = []
        try:
            art_ids = json.loads(digest.article_ids or "[]")
        except Exception:
            art_ids = []

        articles_summary = []
        if art_ids:
            arts = db.query(models.Article).filter(models.Article.id.in_(art_ids)).all()
            articles_summary = [
                {
                    "id": a.id,
                    "title": a.title,
                    "source_title": a.feed.title if a.feed else "",
                    "link": a.link,
                    "category": a.category or "Övrigt",
                    "published": a.published
                }
                for a in arts
            ]

        return {
            "id": digest.id,
            "title": digest.title,
            "content": digest.content,
            "digest_type": digest.digest_type,
            "article_ids": art_ids,
            "articles": articles_summary,
            "created_at": digest.created_at
        }
    except Exception as e:
        print(f"[Daily Digest] Fel vid hämtning av senaste digest: {e}", flush=True)
        return None

def get_daily_digests_history(db: Any, user_id: int, limit: int = 30) -> List[Dict[str, Any]]:
    """Hämtar historik över tidigare sparade briefings för användaren."""
    if not db or not user_id:
        return []
    try:
        import models
        digests = db.query(models.DailyDigest).filter(
            models.DailyDigest.user_id == user_id
        ).order_by(models.DailyDigest.created_at.desc()).limit(limit).all()

        results = []
        for d in digests:
            art_ids = []
            try:
                art_ids = json.loads(d.article_ids or "[]")
            except Exception:
                art_ids = []

            articles_summary = []
            if art_ids:
                arts = db.query(models.Article).filter(models.Article.id.in_(art_ids)).all()
                articles_summary = [
                    {
                        "id": a.id,
                        "title": a.title,
                        "source_title": a.feed.title if a.feed else "",
                        "link": a.link,
                        "category": a.category or "Övrigt",
                        "published": a.published
                    }
                    for a in arts
                ]

            results.append({
                "id": d.id,
                "title": d.title,
                "content": d.content,
                "digest_type": d.digest_type,
                "article_ids": art_ids,
                "articles": articles_summary,
                "created_at": d.created_at
            })
        return results
    except Exception as e:
        print(f"[Daily Digest] Fel vid hämtning av digest-historik: {e}", flush=True)
        return []


