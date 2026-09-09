import os
import json
import re
import time
import requests
from typing import Optional, Dict, Any, List

LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1/chat/completions")
LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "")
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
    model_override: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Anropar LM Studio och returnerar ett berikat artikelobjekt.
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
    
    t0 = time.time()
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

        # Klickbete-hantering: För högprioriterade kategorier (som Blåljus eller vikt >= 8)
        # ska en tillspetsad rubrik inte sänka en allvarlig händelse till low.
        if is_clickbait:
            is_critical = (category.lower() == "blåljus" or prio_score >= 75)
            if is_critical:
                priority = "high"
                prio_score = max(75, prio_score)
                if not prio_reason:
                    prio_reason = f"Kategori: {category} (Klickbete-varning: {clickbait_reason})" if clickbait_reason else f"Kategori: {category}"
                else:
                    prio_reason += f" (Klickbete-varning: {clickbait_reason})" if clickbait_reason else ""
            else:
                prio_score = min(prio_score, 25)
                priority = "low"
                if not prio_reason:
                    prio_reason = f"Klickbete: {clickbait_reason}" if clickbait_reason else "Klickbete"
                else:
                    prio_reason += f" (Klickbete: {clickbait_reason})" if clickbait_reason else ""

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
