import os
import json
import re
import requests
from typing import Optional, Dict, Any, List

# Miljövariabler
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1/chat/completions")
LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "")
LM_STUDIO_TIMEOUT = int(os.environ.get("LM_STUDIO_TIMEOUT", "25"))

DEFAULT_SYSTEM_PROMPT = """Du är en neutral nyhetsanalytiker och klassificerare. Analysera artikeln och svara ENDAST med ett strikt JSON-objekt utan markdown-block eller omslutande text:
{
  "category": "Teknik | Politik | Blåljus | Lokalt | Ekonomi | Nöje | Övrigt",
  "priority": "high | medium | low",
  "prio_score": 1-100,
  "prio_reason": "Kort motivering till prioritetsnivån på svenska",
  "summary": "Max två korta, informativa meningar på svenska som sammanfattar kärnhändelsen.",
  "tags": ["tagg1", "tagg2"]
}

Prioriteringsregler:
- 'high' (score >= 75): Handlar specifikt om Tesla/elbilar, lokalpolitik/viktiga lokala samhällshändelser, eller kritiska blåljus/samhällsvarningar.
- 'medium' (score 40-74): Allmän teknik, ekonomi, bredare inrikespolitik.
- 'low' (score < 40): Nöje, skvaller, kändisar, vardagliga sportnotiser eller mat/recept."""

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
_cached_mtime: float = 0.0

def load_system_prompt() -> str:
    """Läser systemprompt on-the-fly från fil så ändringar i nano slår igenom omedelbart."""
    global _cached_prompt, _cached_mtime
    config_path = get_prompt_config_path()
    
    # Skapa default config-fil om den inte existerar
    if not os.path.exists(config_path):
        try:
            initial_data = {
                "system_prompt": DEFAULT_SYSTEM_PROMPT,
                "note": "Denna fil kan redigeras on-the-fly med t.ex. nano utan att starta om Docker/containern."
            }
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(initial_data, f, ensure_ascii=False, indent=2)
            print(f"[AI Service] Skapade standard prompt-fil på: {config_path}", flush=True)
        except Exception as e:
            print(f"[AI Service] Kunde inte skapa prompt-fil {config_path}: {e}", flush=True)
            return DEFAULT_SYSTEM_PROMPT

    try:
        current_mtime = os.path.getmtime(config_path)
        if _cached_prompt and current_mtime == _cached_mtime:
            return _cached_prompt
        
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            prompt = data.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
            _cached_prompt = prompt
            _cached_mtime = current_mtime
            print(f"[AI Service] Laddade uppdaterad systemprompt från {config_path}", flush=True)
            return prompt
    except Exception as e:
        print(f"[AI Service] Fel vid inläsning av prompt-fil {config_path}: {e}", flush=True)
        return _cached_prompt or DEFAULT_SYSTEM_PROMPT

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

def get_active_model() -> str:
    """Hämtar konfigurerad modell eller läser in aktiv modell från LM Studio."""
    if LM_STUDIO_MODEL and LM_STUDIO_MODEL.strip():
        return LM_STUDIO_MODEL.strip()
    
    try:
        endpoint = get_models_endpoint()
        res = requests.get(endpoint, timeout=3)
        if res.status_code == 200:
            data = res.json()
            models_list = data.get("data", [])
            if models_list and len(models_list) > 0:
                model_id = models_list[0].get("id")
                if model_id:
                    return model_id
    except Exception:
        pass
    
    return "local-model"

def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """Robust extrahering av JSON ur modellens svar även om den omslutit med markdown."""
    text = text.strip()
    
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
            pass
            
    return None

def analyze_article(title: str, summary: Optional[str] = None, source_title: Optional[str] = None, categories: Optional[List[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Anropar LM Studio och returnerar ett berikat artikelobjekt.
    Kastar inga ohanterade undantag så anroparen skyddas mot krascher.
    """
    system_prompt = load_system_prompt()
    model = get_active_model()
    
    # Bygg en kompakt, informativ användarprompt
    user_prompt_lines = [
        "Analysera följande nyhetsartikel och svara enbart med JSON-objektet:",
        f"Källa: {source_title or 'Okänd källa'}",
        f"Rubrik: {title or 'Utan rubrik'}"
    ]
    if summary and summary.strip():
        # Begränsa ingressen om den är extremt lång för snabbare svar
        clean_summary = summary.strip()[:1000]
        user_prompt_lines.append(f"Ingress / Sammanfattning: {clean_summary}")
    if categories:
        cats_str = ", ".join(categories)
        if cats_str:
            user_prompt_lines.append(f"Kategorier från källan: {cats_str}")
            
    user_prompt = "\n".join(user_prompt_lines)
    
    payload = {
        "model": model,
        "temperature": 0.1,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(LM_STUDIO_URL, json=payload, headers=headers, timeout=LM_STUDIO_TIMEOUT)
        if response.status_code != 200:
            print(f"[AI Service] LM Studio HTTP {response.status_code}: {response.text[:200]}", flush=True)
            return None
            
        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            print(f"[AI Service] Inga val returnerades från LM Studio: {data}", flush=True)
            return None
            
        raw_message = choices[0].get("message", {}).get("content", "")
        parsed = extract_json_from_text(raw_message)
        
        if not parsed:
            print(f"[AI Service] Kunde inte parsa JSON från svaret: {raw_message[:200]}", flush=True)
            return None
            
        # Normalisera och validera fälten
        category = str(parsed.get("category", "Övrigt")).strip()
        priority = str(parsed.get("priority", "low")).strip().lower()
        if priority not in ["high", "medium", "low"]:
            priority = "low"
            
        try:
            prio_score = int(parsed.get("prio_score", 10))
            prio_score = max(1, min(100, prio_score))
        except (ValueError, TypeError):
            prio_score = 75 if priority == "high" else (50 if priority == "medium" else 20)
            
        prio_reason = str(parsed.get("prio_reason", "")).strip()
        ai_summary = str(parsed.get("summary", "")).strip()
        
        raw_tags = parsed.get("tags", [])
        if isinstance(raw_tags, list):
            tags = [str(t).strip() for t in raw_tags if t and str(t).strip()]
        else:
            tags = []
            
        return {
            "category": category,
            "priority": priority,
            "prio_score": prio_score,
            "prio_reason": prio_reason,
            "ai_summary": ai_summary,
            "tags": tags
        }
    except requests.exceptions.ConnectionError:
        print(f"[AI Service] LM Studio är inte nåbart på {LM_STUDIO_URL} (offline)", flush=True)
        return None
    except requests.exceptions.Timeout:
        print(f"[AI Service] Timeout mot LM Studio efter {LM_STUDIO_TIMEOUT}s", flush=True)
        return None
    except Exception as e:
        print(f"[AI Service] Oväntat fel vid analys: {e}", flush=True)
        return None
