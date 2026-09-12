import os
import json
import re
import time
import requests
import numpy as np
from typing import Optional, Dict, Any, List, Callable

LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1/chat/completions")
LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "")
LM_STUDIO_EMBEDDING_MODEL = os.environ.get("LM_STUDIO_EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
LM_STUDIO_TIMEOUT = int(os.environ.get("LM_STUDIO_TIMEOUT", "120"))
LM_STUDIO_MAX_TOKENS = int(os.environ.get("LM_STUDIO_MAX_TOKENS", "8192"))

DEFAULT_CATEGORIES_WITH_WEIGHTS = [
    {"name": "Blåljus", "weight": 10},
    {"name": "Lokalt", "weight": 8},
    {"name": "Inrikes", "weight": 6},
    {"name": "Utrikes", "weight": 5},
    {"name": "Politik", "weight": 4},
    {"name": "Ekonomi", "weight": 5},
    {"name": "Teknik", "weight": 9},
    {"name": "Motor", "weight": 7},
    {"name": "Vetenskap & Hälsa", "weight": 6},
    {"name": "Sport", "weight": 1},
    {"name": "Nöje & Kultur", "weight": 0},
    {"name": "Övrigt", "weight": 3}
]

DEFAULT_CATEGORIES = [c["name"] for c in DEFAULT_CATEGORIES_WITH_WEIGHTS]
DEFAULT_CATEGORIES_STR = " | ".join(DEFAULT_CATEGORIES)

DEFAULT_SYSTEM_PROMPT = f"""Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{{
  "category": "Välj den mest passande av följande kategorier: {DEFAULT_CATEGORIES_STR}",
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är klickbete eller undanhåller vem, vad eller var, ska svaret och de faktiska detaljerna avslöjas rakt på sak i första meningen.",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": "Om is_clickbait är true: Beskriv kortfattat vad rubriken undanhåller och bekräfta att fakta har lyfts fram i sammanfattningen (t.ex. 'Rubriken undanhåller vad de nya priserna är för att locka klick. Fakta har lyfts fram i sammanfattningen ovan.'). Lämna tomt om false."
}}
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara klickbeten där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände", "Här är nya priserna").
- Om is_clickbait sätts till true: Beskriv i clickbait_reason kortfattat vad rubriken döljer och bekräfta att fakta har lyfts fram i sammanfattningen ovan.
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG klickbete, även om de är korta eller inte nämner alla detaljer.
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

def get_models_endpoint() -> str:
    """Extraherar /v1/models endpoint baserat på LM_STUDIO_URL."""
    url = LM_STUDIO_URL.strip()
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
    """Genererar embeddings via LM Studio med Nomic prompt-prefix."""
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
            print(f"[AI Embeddings] LM Studio HTTP {res.status_code}: {res.text[:150]}", flush=True)
    except Exception as e:
        print(f"[AI Embeddings] Fel vid anrop till {endpoint}: {e}", flush=True)
    
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

def check_lm_studio_health() -> bool:
    """Kontrollerar snabbt om LM Studio svarar."""
    try:
        endpoint = get_models_endpoint()
        res = requests.get(endpoint, timeout=3)
        return res.status_code == 200
    except Exception:
        return False

def get_available_models() -> List[str]:
    """Hämtar alla tillgängliga chatt-/textmodeller från LM Studio."""
    try:
        endpoint = get_models_endpoint()
        res = requests.get(endpoint, timeout=4)
        if res.status_code == 200:
            data = res.json()
            models_list = data.get("data", [])
            # Filtrera bort embedding-modeller och returnera unika modell-id:n
            result = []
            for m in models_list:
                m_id = m.get("id", "")
                if m_id and "embedding" not in m_id.lower() and m_id not in result:
                    result.append(m_id)
            return result
    except Exception as e:
        print(f"[AI Service] Kunde inte hämta modeller från LM Studio: {e}", flush=True)
    return []

def get_active_model() -> str:
    """Hämtar konfigurerad modell eller läser in aktiv modell från LM Studio."""
    if LM_STUDIO_MODEL and LM_STUDIO_MODEL.strip():
        return LM_STUDIO_MODEL.strip()
    
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

def build_user_prompt(categories: Optional[Any] = None, prio_rules: Optional[str] = None, exclude_rules: Optional[str] = None, prio_threshold: int = 75) -> str:
    """Sammanställer en skräddarsydd systemprompt baserat på användarens specifika kategorier."""
    cats = extract_category_names(categories)
    cats_str = " | ".join(cats)
    
    prompt = f"""Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{{
  "category": "Välj den mest passande av följande kategorier: {cats_str}",
  "summary": "Max tre korta, informativa meningar på svenska som sammanfattar kärnhändelsen. OBLIGATORISKT: 1. Ange ALLTID geografisk plats (ort, kommun, stad eller land) om det framgår i artikeln (t.ex. 'i Lekebergs kommun' eller 'i centrala Malmö'). 2. Undvik helt metasnack som 'rapporterar Expressen' eller 'enligt tidningen' – fokusera enbart på själva händelsen. 3. Om rubriken är klickbete eller undanhåller vem, vad eller var, ska svaret och de faktiska detaljerna avslöjas rakt på sak i första meningen.",
  "tags": ["tagg1", "tagg2"],
  "is_clickbait": false,
  "clickbait_reason": "Om is_clickbait är true: Beskriv kortfattat vad rubriken undanhåller och bekräfta att fakta har lyfts fram i sammanfattningen (t.ex. 'Rubriken undanhåller vad de nya priserna är för att locka klick. Fakta har lyfts fram i sammanfattningen ovan.'). Lämna tomt om false."
}}
Riktlinjer för is_clickbait (Var mycket restriktiv):
- Sätt ENDAST is_clickbait till true vid uppenbara klickbeten där rubriken avsiktligt döljer själva händelsen eller ämnet med vaga formuleringar eller pronomen (t.ex. "Här slår han till", "Det här ska du aldrig göra", "Chockbeskedet", "Du anar inte vad som hände", "Här är nya priserna").
- Om is_clickbait sätts till true: Beskriv i clickbait_reason kortfattat vad rubriken döljer och bekräfta att fakta har lyfts fram i sammanfattningen ovan.
- SAKLIGA NYHETER ska ALLTID ha is_clickbait: false! Rubriker som beskriver vad som faktiskt hänt (t.ex. "Knarkcontainer på väg till Sverige stoppades", "Skottlossning i Malmö", "Regeringen presenterar budgeten", "Brand i villa") är sakliga nyheter och är ALDRIG klickbete, även om de är korta eller inte nämner alla detaljer.
- Vid minsta tveksamhet, sätt alltid is_clickbait: false."""
    return prompt

def ensure_clickbait_in_prompt(prompt: Optional[str], categories: Optional[Any] = None) -> str:
    """
    Säkerställer att prompten innehåller de moderna, balanserade klickbete-instruktionerna,
    krav på geografisk plats, 3 meningars sammanfattning samt förtydligande i clickbait_reason.
    Om prompten är tom eller saknar de senaste reglerna, genereras en uppdaterad prompt.
    """
    if not prompt or not prompt.strip():
        return build_user_prompt(categories=categories)
    cleaned = prompt.strip()
    if "Max två korta" in cleaned:
        cleaned = cleaned.replace("Max två korta", "Max tre korta")
    if "geografisk plats" not in cleaned.lower():
        return build_user_prompt(categories=categories)
    if "fakta har lyfts fram" not in cleaned.lower():
        return build_user_prompt(categories=categories)
    if "SAKLIGA NYHETER" in cleaned:
        return cleaned
    return build_user_prompt(categories=categories)

def calculate_priority(
    category: str,
    categories_config: Any,
    matched_keywords: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Beräknar deterministisk prioritet och poäng:
    1. Träff på specifika bevakningsord ger ALLTID högsta prioritet (100 poäng).
    2. Kategori-vikt (0-10) styr grundpoäng:
       - 8-10: high (80-100p) -> Direkt till PRIO-flödet
       - 5-7: medium (50-70p) -> Ordinarie flöde
       - 1-4: low (10-40p) -> Ordinarie flöde
       - 0: low (0p) -> Ignoreras helt från PRIO
    """
    if matched_keywords and len(matched_keywords) > 0:
        kw_str = ", ".join(matched_keywords)
        return {
            "priority": "high",
            "prio_score": 100,
            "prio_reason": f"Träff på bevakningsord: {kw_str}"
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
    score = weight * 10
    
    if weight >= 8:
        return {
            "priority": "high",
            "prio_score": max(75, score),
            "prio_reason": f"Högprioriterad kategori: {clean_cat} ({weight}/10)"
        }
    elif weight >= 5:
        return {
            "priority": "medium",
            "prio_score": score,
            "prio_reason": f"Normalprioriterad kategori: {clean_cat} ({weight}/10)"
        }
    elif weight >= 1:
        return {
            "priority": "low",
            "prio_score": score,
            "prio_reason": f"Lågprioriterad kategori: {clean_cat} ({weight}/10)"
        }
    else:
        return {
            "priority": "low",
            "prio_score": 0,
            "prio_reason": f"Ignorerad kategori: {clean_cat} (0/10)"
        }

def analyze_article(
    title: str, 
    summary: Optional[str] = None, 
    source_title: Optional[str] = None, 
    categories: Optional[List[str]] = None,
    custom_prompt: Optional[str] = None,
    user_categories: Optional[List[str]] = None,
    model_override: Optional[str] = None,
    on_progress: Optional[Callable[[int], None]] = None
) -> Optional[Dict[str, Any]]:
    """
    Anropar LM Studio och returnerar ett berikat artikelobjekt.
    Stödjer realtids-progress för prompt-bearbetning i GPU.
    Kastar inga ohanterade undantag så anroparen skyddas mot krascher.
    """
    system_prompt = custom_prompt.strip() if (custom_prompt and custom_prompt.strip()) else load_system_prompt()
    model = model_override.strip() if (model_override and model_override.strip()) else get_active_model()
    
    # Bygg en kompakt, informativ användarprompt
    user_prompt_lines = [
        "Analysera följande nyhetsartikel och svara enbart med JSON-objektet:",
        f"Källa: {source_title or 'Okänd källa'}",
        f"Rubrik: {title or 'Utan rubrik'}"
    ]
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

        # 1. Försök först med nativ strömning för realtids-progress av GPU prompt-bearbetning
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
        except Exception as e:
            print(f"[AI Service] Nativ /api/v1/chat gav fel ({e}), testar standard OpenAI fallback...", flush=True)

        # 2. Fallback till standard OpenAI /v1/chat/completions om nativ endpoint misslyckades eller inte gav giltig JSON
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
                    print(f"[AI Service] LM Studio HTTP {response.status_code} efter {dur}s: {response.text[:200]}", flush=True)
                    return None
                    
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    print(f"[AI Service] Inga val returnerades från LM Studio efter {dur}s: {data}", flush=True)
                    return None
                    
                raw_message = choices[0].get("message", {}).get("content", "")
                parsed = extract_json_from_text(raw_message)
            except Exception as fb_err:
                print(f"[AI Service] Fallback-anrop gav fel efter {round(time.time() - t0, 2)}s: {fb_err}", flush=True)
                return None

        if not parsed:
            print(f"[AI Service] Kunde inte parsa JSON från svaret ({len(raw_message)} tecken): {raw_message[:500]}", flush=True)
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

        # Beräkna deterministisk prioritet och poäng baserat på kategori-vikt
        prio_calc = calculate_priority(category, user_categories)
        priority = prio_calc["priority"]
        prio_score = prio_calc["prio_score"]
        prio_reason = prio_calc["prio_reason"]
            
        ai_summary = str(parsed.get("summary", "")).strip()
        
        raw_tags = parsed.get("tags", [])
        if isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if t and str(t).strip()]
        else:
            tags = []
            
        # Klickbete-hantering
        raw_cb = parsed.get("is_clickbait", False)
        is_clickbait = bool(raw_cb) if isinstance(raw_cb, bool) else (str(raw_cb).lower() in ("true", "1"))
        clickbait_reason = str(parsed.get("clickbait_reason", "")).strip()

        if is_clickbait:
            is_critical = (category.lower() == "blåljus" or prio_score >= 75)
            if is_critical:
                priority = "high"
                prio_score = max(75, prio_score)
            else:
                prio_score = min(prio_score, 25)
                priority = "low"

        return {
            "category": category,
            "priority": priority,
            "prio_score": prio_score,
            "prio_reason": prio_reason,
            "ai_summary": ai_summary,
            "tags": tags,
            "is_clickbait": 1 if is_clickbait else 0,
            "clickbait_reason": clickbait_reason,
            "duration_s": dur
        }
    except requests.exceptions.ConnectTimeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Kunde inte upprätta anslutning till LM Studio på {LM_STUDIO_URL} efter {dur}s (ConnectTimeout)", flush=True)
        return None
    except requests.exceptions.ReadTimeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Timeout vid generering: LM Studio svarade inte inom {dur}s (ReadTimeout, gräns {LM_STUDIO_TIMEOUT}s)", flush=True)
        return None
    except requests.exceptions.ConnectionError:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] LM Studio är inte nåbart på {LM_STUDIO_URL} (offline efter {dur}s)", flush=True)
        return None
    except requests.exceptions.Timeout:
        dur = round(time.time() - t0, 2)
        print(f"[AI Service] Timeout mot LM Studio efter {dur}s (gräns {LM_STUDIO_TIMEOUT}s)", flush=True)
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

def prepare_chat_context(
    user_id: int,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Any = None
) -> Dict[str, Any]:
    """
    Förbereder kontext, källor och prompter för RAG-chatt via semantisk sökning i SQLite.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import or_, and_, desc
    import models

    history = history or []
    clean_msg = message.strip()
    msg_lower = clean_msg.lower()

    # 1. Identifiera tidsintervall
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

    # 2. Identifiera sökord (filtrera bort vanliga stoppord)
    stopwords = {
        "hur", "många", "vad", "vilka", "vem", "när", "var", "varför", "är", "var", 
        "skedde", "hände", "det", "den", "som", "att", "och", "eller", "i", "på", 
        "av", "med", "om", "till", "från", "för", "ett", "en", "artiklar", "artikel", 
        "nyheter", "händelse", "händelser", "finns", "rapporterats", "senaste", "igår", 
        "idag", "ge", "mig", "alla", "några", "berätta", "visa", "lista", "sammanfatta"
    }
    raw_words = re.findall(r'\b[a-zåäöA-ZÅÄÖ0-9_-]+\b', msg_lower)
    keywords = [w for w in raw_words if len(w) > 2 and w not in stopwords]

    # 3. Databasfråga mot användarens flöden med semantisk Hybrid RAG
    articles = []
    total_period_count = 0
    if db:
        base_query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == user_id)
        
        # Applicera tidsintervall
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

        # Försök semantisk vektorsökning via LM Studio Nomic Embeddings
        q_embs = get_text_embeddings([clean_msg], is_query=True)
        semantic_success = False

        if q_embs and len(q_embs) > 0 and len(q_embs[0]) > 0:
            try:
                q_vec = np.array(q_embs[0], dtype=np.float32)
                q_norm = float(np.linalg.norm(q_vec))

                # Hämta kandidatartiklar för tidsperioden (upp till 200 artiklar)
                candidates = base_query.order_by(desc(models.Article.published_ts), desc(models.Article.received_ts)).limit(200).all()

                if candidates:
                    missing = [c for c in candidates[:20] if not c.embedding]
                    if missing:
                        batch_embed_articles(missing, db)

                    scored_articles = []
                    for art in candidates:
                        sim_score = 0.40
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
                                    kw_bonus += 0.08

                        prio_bonus = 0.04 if (art.priority == "high" or (art.prio_score or 0) >= 75) else 0.0
                        total_score = sim_score + kw_bonus + prio_bonus
                        scored_articles.append((total_score, art))

                    scored_articles.sort(key=lambda x: x[0], reverse=True)
                    articles = [item[1] for item in scored_articles[:60]]
                    semantic_success = True
            except Exception as e:
                print(f"[AI Chat] Fel vid semantisk ranking: {e}", flush=True)

        if not semantic_success:
            if keywords:
                kw_conditions = []
                for kw in keywords[:5]:
                    kw_conditions.extend([
                        models.Article.title.ilike(f"%{kw}%"),
                        models.Article.summary.ilike(f"%{kw}%"),
                        models.Article.ai_summary.ilike(f"%{kw}%"),
                        models.Article.tags.ilike(f"%{kw}%"),
                        models.Article.category.ilike(f"%{kw}%")
                    ])
                kw_query = base_query.filter(or_(*kw_conditions)).order_by(desc(models.Article.published_ts), desc(models.Article.received_ts))
                articles = kw_query.limit(80).all()

            if len(articles) < 20:
                existing_ids = {a.id for a in articles}
                fallback_query = db.query(models.Article).join(models.Feed).filter(models.Feed.user_id == user_id)
                if time_filters:
                    fallback_query = fallback_query.filter(and_(*time_filters))
                fallback_articles = fallback_query.order_by(desc(models.Article.published_ts), desc(models.Article.received_ts)).limit(80).all()
                for fa in fallback_articles:
                    if fa.id not in existing_ids:
                        articles.append(fa)
                        existing_ids.add(fa.id)
                    if len(articles) >= 80:
                        break

            articles.sort(key=lambda x: (x.published_ts or 0, x.received_ts or 0), reverse=True)

    # 4. Skapa käll-lista för frontend (upp till 60 artiklar)
    sources = []
    for art in articles[:60]:
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
    if total_period_count > 0:
        context_lines.append(
            f"[Systemstatistik: Det finns totalt {total_period_count} händelser i databasen för det valda tidsintervallet. "
            f"Nedan listas de {len(sources)} mest relevanta händelserna för användarens fråga sorterade efter semantisk relevans.]\n"
        )

    for i, art in enumerate(articles[:60], 1):
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

    context_str = "\n".join(context_lines) if context_lines else "Inga sparade artiklar matchade det angivna tidsintervallet."

    system_prompt = (
        "Du är en skarp, saklig och hjälpsam svenskspråkig nyhetsassistent för RSS-Bevakaren.\n"
        "Din uppgift är att svara på användarens frågor uteslutande baserat på artiklarna och systemstatistiken i kontexten.\n\n"
        "Riktlinjer:\n"
        "1. Svara ALLTID på god, tydlig och naturlig svenska.\n"
        "2. Det är STRIKT FÖRBJUDET att använda emojis i svaret.\n"
        "3. Basera dina påståenden och siffror på de bifogade artiklarna. Hitta inte på information som saknas.\n"
        f"4. Om användaren frågar om totalt antal händelser för tidsperioden (t.ex. 'vad har hänt idag', 'hur många olyckor', 'alla händelser'), "
        f"ange alltid den exakta totalsiffran från systemstatistiken ({total_period_count} st sparade händelser i flödena för tidsintervallet) "
        "och sammanfatta sedan de mest relevanta händelserna med ort/plats och källa.\n"
        "5. Om artiklarna inte innehåller svar på frågan, förklara sakligt och artigt att informationen inte finns bland de sparade artiklarna.\n"
        "6. Använd god styckeindelning och punktlistor vid behov för maximal läsbarhet.\n"
        "7. OBLIGATORISKT - 4 FÖLJDKÖ: Avsluta ALLTID ditt svar med exakt 4 skarpa, naturliga och relevanta följdfrågor baserade på de specifika händelser och detaljer du just redovisat, så att användaren enkelt kan fördjupa sig.\n"
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

    # 6. Sätt ihop meddelandehistorik
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
        "context_str": context_str
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

    if len(follow_ups) < 2 and sources:
        for s in sources[:4]:
            t = s.get("title", "")
            if t and len(t) > 5:
                q_cand = f"Vad mer rapporteras om {t.lower()}?"
                if q_cand not in follow_ups:
                    follow_ups.append(q_cand)
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

    model = model_override or LM_STUDIO_MODEL or ""
    payload = {
        "model": model,
        "temperature": 0.3,
        "max_tokens": LM_STUDIO_MAX_TOKENS,
        "messages": messages
    }

    t0 = time.time()
    try:
        response = requests.post(LM_STUDIO_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=LM_STUDIO_TIMEOUT)
        dur = round(time.time() - t0, 2)
        if response.status_code != 200:
            print(f"[AI Chat] LM Studio HTTP {response.status_code} efter {dur}s: {response.text[:200]}", flush=True)
            return {
                "reply": "Kunde inte generera ett svar från den lokala AI-modellen (LM Studio svarade med felkod). Kontrollera att LM Studio är igång.",
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
            "reply": f"Kunde inte upprätta anslutning till LM Studio på {LM_STUDIO_URL}. Kontrollera att LM Studio är startat och att servern körs.",
            "sources": sources,
            "model": model or "Offline",
            "follow_ups": []
        }
    except requests.exceptions.ReadTimeout:
        return {
            "reply": f"LM Studio svarade inte inom tidsgränsen ({LM_STUDIO_TIMEOUT}s). Modellen kan vara överbelastad eller genererar ett för långt svar.",
            "sources": sources,
            "model": model or "Timeout",
            "follow_ups": []
        }
    except requests.exceptions.ConnectionError:
        return {
            "reply": f"LM Studio är offline eller onåbar på {LM_STUDIO_URL}.",
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

    # 1. Skicka direkt källorna och totalantalet händelser till frontend
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'total_count': total_period_count})}\n\n"

    model = model_override or LM_STUDIO_MODEL or ""
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
        resp = requests.post(native_url, json=native_payload, stream=True, timeout=LM_STUDIO_TIMEOUT)
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
    except Exception as e:
        print(f"[AI Chat Stream] Nativa /api/v1/chat gav fel ({e}), testar standard OpenAI /v1/chat/completions fallback...", flush=True)

    # Fallback: Om inte nativ endpoint fungerade, använd OpenAI-kompatibla LM_STUDIO_URL
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

            fb_resp = requests.post(LM_STUDIO_URL, json=openai_payload, stream=True, timeout=LM_STUDIO_TIMEOUT)
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
        except requests.exceptions.ConnectTimeout:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Kunde inte ansluta till LM Studio på {LM_STUDIO_URL}. Kontrollera att servern är igång.'})}\n\n"
            return
        except requests.exceptions.ReadTimeout:
            yield f"data: {json.dumps({'type': 'error', 'message': f'LM Studio svarade inte inom tidsgränsen ({LM_STUDIO_TIMEOUT}s).'})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Ett fel uppstod: {e}'})}\n\n"
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

def find_or_create_article_cluster(article_id: int, db: Any, similarity_threshold: float = 0.84) -> Tuple[Optional[int], float]:
    """
    Söker efter liknande artiklar inom 36 timmar och kopplar artikeln till ett kluster.
    Använder semantisk Nomic-embedding om tillgängligt, annars heuristisk textlikhet.
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

        best_match = None
        best_sim = 0.0

        for cand in candidates:
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
            if sim < similarity_threshold:
                text_sim = compute_text_similarity(art.title or "", cand.title or "")
                if text_sim > sim:
                    sim = text_sim

            if sim >= similarity_threshold and sim > best_sim:
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

    # Gruppera så vi tar max en artikel per kluster för bredd i urvalet
    seen_clusters = set()
    top_candidates = []
    for art in user_articles:
        if art.cluster_id:
            if art.cluster_id in seen_clusters:
                continue
            seen_clusters.add(art.cluster_id)
        top_candidates.append(art)
        if len(top_candidates) >= 10:
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
            "5. STRIKT FÖRBUD MOT EMOJIS: Det är absolut förbjudet att använda några som helst emojis eller symbol-ikoner i svaret."
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


