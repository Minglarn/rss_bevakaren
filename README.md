# RSS-Bevakaren

![Version](https://img.shields.io/badge/version-2026.09.11.01-blue.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/Minglarn/rss_bevakaren)
![GitHub issues](https://img.shields.io/github/issues/Minglarn/rss_bevakaren)
![GitHub stars](https://img.shields.io/github/stars/Minglarn/rss_bevakaren?style=social)

![Dashboard Screenshot](screenshot_1.jpg)

RSS-Bevakaren is a modern, self-hosted system for monitoring, filtering, prioritizing, and presenting RSS feeds in real time. The system combines a robust Python backend, a responsive React frontend, and a powerful local AI engine for automated analysis, summarization, clickbait detection, and news prioritization.

---

## Key Features

- **Interactive AI News Chat:** Fullscreen conversational chat interface powered by your local LM Studio instance. Ask natural language questions ("How many accidents occurred yesterday?", "Summarize breaking news in politics") and receive answers with expandable citations and links to original articles.
- **Multi-User Architecture:** Secure authentication with JWT tokens where each user has their own feeds, filters, and personal AI preferences.
- **Feed Management:** Add, organize, and remove RSS and Atom feeds. Built-in support for nearly all standard RSS/Atom specifications and WordPress feeds.
- **Two Display Modes (AI Feed & Classic RSS):** Choose between an AI-enriched feed with concise summaries or a fast, minimalist raw RSS view.
- **Clickbait Detection & Anti-Clickbait:** Intelligent identification of sensationalist and withholding headlines. AI summaries bust the clickbait right away, warning badges flag the article, and clickbait is automatically demoted from your priority stream.
- **AI Skeleton Shimmer & Smooth Transitions:** New articles display a discreet loading shimmer while AI processing takes place and smoothly fade in without disruptive layout shifts.
- **Robust Timeout & Offline Fallback:** If your local LLM engine (e.g. LM Studio) is offline or times out, articles automatically fall back to the original RSS text after 45 seconds, or instantly with a single click.
- **Dedicated Prio Feed:** Real-time prioritization based on your customized rules, monitored keywords, and category weights.
- **Full Article Reading & Sharing:** Scrape and read complete articles directly within the app, share via device native share menu, SMS, or WhatsApp, and copy links with one tap.
- **PWA & Web Push:** Progressive Web App with instant push notifications on both desktop and mobile devices, even when the application is closed.
- **Automatic Housekeeping:** Automatic database cleanup to prune old history after a configurable retention period.

---

## AI Engine and Priority System

RSS-Bevakaren includes a built-in AI processing pipeline that connects to local LLMs (such as LM Studio, Ollama, or LocalAI) or any OpenAI-compatible API endpoint.

### What the AI Engine Does

Every incoming article passes through the background AI pipeline:

1. **Concise Summaries:** Generates a 1-2 sentence informative summary that lets you digest the core event in seconds.
2. **Clickbait Detection (Anti-Clickbait):**
   - Detects sensationalism, exaggerated claims, and intentional curiosity gaps.
   - Flags the article with a clear warning badge: `Clickbait warning`.
   - Displays the explanation directly inside the summary block (*Clickbait notice: ...*), making it effortless to read on mobile without hovering.
   - **Busts the Clickbait:** The summary is instructed to immediately reveal the core facts and answer the headline's mystery in the very first sentence.
   - **Cleans the Prio Feed:** Clickbait articles are automatically capped at low priority (maximum 25 points), preventing spam from cluttering your Prio Feed.
3. **Categorization:** Classifies articles into your chosen categories (Technology, Politics, Emergency, Economy, Local, Motor, etc.).
4. **Relevance Scoring & Prioritization:** Scores articles from 0 to 100 based on your personal weights and keyword rules.
5. **Automated Tags:** Extracts relevant topical tags for instant hashtag filtering.

---

### Managing AI in Settings

All AI options are customizable per user under **Settings -> AI Analysis & Prompt**:

#### 1. LLM / LM Studio Connection
- **API Base URL:** Enter the address of your local LLM server (e.g., `http://192.168.1.50:1234/v1`).
- **Connection Test & Model Selector:** Click "Check connection" to verify status. The app automatically fetches all installed models into a dropdown menu.
- **Self-Healing Background Queue:** If LM Studio is busy or shut down, the queue quietly pauses and performs health checks every 30 seconds. Once LM Studio becomes available again, processing resumes automatically, and articles update on your screen in real time via WebSockets.

#### 2. Category Weights (0 - 10)
Under *Category Sliders & Priority*, adjust the priority of each topic:
- High values (8-10) qualify incoming articles directly for the **Prio Feed**.
- Lower values keep articles in the standard timeline without cluttering your prioritized view.

#### 3. Monitored Keywords (Guaranteed 100% Priority)
Add critical keywords or locations in *Prioritized Keywords & Topics* (e.g. `Stockholm, Nvidia, Defense, Central Bank`).
- Any article containing a matched keyword receives an **immediate 100 points score and High priority**, regardless of its category.

#### 4. Custom System Prompt
Review and edit the active system prompt directly in the web UI. You can adjust the tone, category definitions, clickbait criteria, or language preferences on the fly.

---

## Display Modes: AI Feed vs Classic RSS

Configure your preferred viewing mode under **Settings -> User Interface**:

- **AI Feed (Summaries & Tags):** Displays AI summaries, category tags, clickbait warnings, and priority indicators. Unprocessed articles display a skeleton loading state (*Analyzing with AI...*).
- **Classic RSS (Raw text without AI):** Streamlined and fast feed displaying the original RSS feed ingress text without AI manipulation.

Regardless of your dashboard setting, the **Prio Feed** remains accessible in the sidebar navigation to track high-priority events.

---

## Interactive AI News Assistant & Semantic Hybrid RAG

RSS-Bevakaren features a dedicated, fullscreen conversational AI interface (**AI Chatt**) accessible from the sidebar. You can interact directly with your monitored news articles using natural language queries powered by your local LM Studio instance or any OpenAI-compatible API endpoint.

### Architecture & Key Features

1. **Conversational News Q&A (RAG):**
   - Ask complex, natural questions in Swedish or English (e.g., *"Vilka allvarliga olyckor har rapporterats senaste dygnet?"*, *"Vad rapporteras om räntan och börsen?"* eller *"Hitta alla artiklar om elbilar och sammanfatta läget"*).
   - The assistant synthesizes clear, coherent overviews directly backed by your RSS dispatches.

2. **Semantic Vector Search (Nomic Embeddings v1.5):**
   - Incoming articles are automatically vectorized using high-performance local embedding models (such as `text-embedding-nomic-embed-text-v1.5` running concurrently in LM Studio).
   - Captures contextual semantics, synonyms, and conceptual intent (768 dimensions), bridging phrasing gaps between user questions and publisher headlines.

3. **SQLite Vector Storage & Fast Cosine Similarity:**
   - Vector embeddings are persisted natively in SQLite as binary float32 blobs (`article_embeddings` table) with atomic UPSERT guarantees.
   - Vector ranking leverages optimized numpy cosine similarity routines across the database archive.

4. **Hybrid Retrieval Strategy:**
   - Blends high-dimensional semantic search with SQLite keyword/FTS text matching.
   - Guarantees precision for specific names, numbers, regional terms, and abbreviations alongside conceptual semantic matches.

5. **Transparent Source Citations:**
   - Every answer displays interactive, expandable source citations detailing the feed origin, article headline, publication date, and priority score.
   - Includes direct external links to read the complete original story on the publisher's site.

6. **Dynamic AI-Generated Follow-Up Questions:**
   - After formulating each response, the AI automatically analyzes the retrieved facts and generates 4 sharp, contextual follow-up questions.
   - Rendered as interactive prompt chips directly below the response for effortless one-tap deep dives.

7. **Persistent Background Chat (`AiChatContext`):**
   - Built upon a global React Context (`AiChatContext`).
   - Query generation continues uninterrupted even when switching between Dashboard, Prio Feed, or Feed Settings.
   - A pulsing activity indicator in the sidebar navigation signals when the AI is processing in the background.
   - Full conversation history is retained during the browser session via `sessionStorage`.

8. **Offline & Graceful Fallback:**
   - If embedding models are not active in LM Studio, the assistant automatically switches to full-text keyword retrieval without disrupting the chat experience.

---

## MQTT Integration & Home Automation

RSS-Bevakaren includes built-in, native MQTT publishing support. When enabled, every incoming article and prioritized dispatch is immediately pushed in real time to your MQTT broker (such as Eclipse Mosquitto, Home Assistant, or Node-RED).

### Configuration in docker-compose.yml

Add the following environment variables to the `backend` service in `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      # MQTT Integration (optional, disabled by default)
      - MQTT_ENABLED=true
      - MQTT_BROKER=192.168.1.50
      - MQTT_PORT=1883
      - MQTT_USERNAME=your_username    # Optional: leave empty if broker allows anonymous
      - MQTT_PASSWORD=your_password    # Optional: leave empty if broker allows anonymous
      - MQTT_TOPIC_PREFIX=rss_bevakaren
      - MQTT_CLIENT_ID=rss_bevakaren_backend
      - MQTT_RETAIN=false
      - MQTT_QOS=0
```

### Topic Architecture

The MQTT service uses a clean, predictable Pub/Sub hierarchy:

| Topic | Description | Retained |
|---|---|---|
| `{prefix}/status` | System connection status via LWT (Last Will and Testament). Sends `"online"` on connect and `"offline"` if the backend terminates. | Yes |
| `{prefix}/feeds/{feed_slug}` | Individual stream for each monitored feed source. Swedish characters are automatically sanitized (e.g. `Polisen - Skåne län` becomes `polisen_skane_lan`). | Configurable |
| `{prefix}/prio` | Dedicated high-priority channel. Articles flagged as `priority: high` or matching your monitored keywords are published here in parallel. | Configurable |

#### Recommended Subscription Patterns
- **All events:** `rss_bevakaren/#`
- **All feed streams:** `rss_bevakaren/feeds/+`
- **Single specific feed:** `rss_bevakaren/feeds/polisen_skane_lan`
- **Priority alarms only (Home Assistant / notifications):** `rss_bevakaren/prio`

---

### Detailed JSON Payload Specification

Every message published to a feed topic or to the prio topic contains a structured JSON payload with full event metadata:

```json
{
  "id": 1420,
  "title": "Chocksiffrorna: Nu höjs bilskatten med 1300%",
  "summary": "Nya EU-siffror visar att laddhybrider släpper ut betydligt mer koldioxid än vad biltillverkarna tidigare uppgett. Detta innebär att tusentals nya bilar kommer att drabbas av betydligt högre skatter baserat på de faktiska utsläppen.",
  "ai_summary": "Nya EU-siffror visar att laddhybrider släpper ut betydligt mer koldioxid än vad biltillverkarna tidigare uppgett. Detta innebär att tusentals nya bilar kommer att drabbas av betydligt högre skatter baserat på de faktiska utsläppen.",
  "link": "https://carup.se/chocksiffrorna-nu-hojs-bilskatten-med-1300/",
  "published_at": "2026-09-09T17:15:00Z",
  "received_ts": 1788983700,
  "source_name": "CarUp",
  "source_slug": "carup",
  "category": "Ekonomi",
  "priority": "low",
  "prio_score": 25,
  "prio_reason": "Normalprioriterad kategori: Ekonomi (5/10)",
  "is_prio": false,
  "matched_keywords": [],
  "is_clickbait": true,
  "clickbait_reason": "Rubriken använder sensationella ord som 'Chocksiffrorna' och 'höjs med 1300%' för att locka klick utan att direkt förklara att det handlar om korrigerade utsläppsvärden för laddhybrider. Fakta har lyfts fram i sammanfattningen ovan.",
  "tags": ["bilskatt", "laddhybrider", "utsläpp", "EU", "ekonomi"],
  "image_url": "https://carup.se/wp-content/uploads/2026/09/laddhybrid-skatt.jpg"
}
```

#### Field Reference Table

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique article ID in the database. |
| `title` | string | Full title of the news article or feed item. |
| `summary` | string | Concise AI summary (or original RSS description if AI is disabled). |
| `ai_summary` | string | Dedicated AI-generated summary text. |
| `link` | string | Direct web URL to original source article. |
| `published_at`| string | Publication date and time formatted in ISO 8601 (UTC). |
| `received_ts` | integer | UNIX timestamp (seconds) when article was ingested by backend. |
| `source_name` | string | Display name of the source feed (e.g. `Polisen`, `CarUp`, `SVT Nyheter`). |
| `source_slug` | string | Sanitized identifier matching the feed's MQTT sub-topic. |
| `category` | string | AI-classified category (e.g. `Blåljus`, `Ekonomi`, `Teknik`, `Lokalt`). |
| `priority` | string | Priority classification: `high`, `medium`, or `low`. |
| `prio_score` | integer | Relevance score from `0` to `100`. Scores >= 75 qualify for `rss_bevakaren/prio`. |
| `prio_reason` | string | Category or rule justification for the score (e.g. `Högprioriterad kategori: Blåljus (9/10)`). |
| `is_prio` | boolean | `true` if the item qualifies as priority (score >= 75 or keyword match). |
| `matched_keywords` | array[string] | List of user-monitored keywords triggering immediate priority (e.g. `["Stockholm", "Brand"]`). |
| `is_clickbait`| boolean | `true` if AI identified sensationalist or mystery-withholding headline tactics. |
| `clickbait_reason` | string | Explanation of what the headline withheld and confirmation that facts were extracted. |
| `tags` | array[string] | AI-generated topical tags for instant classification. |
| `image_url` | string | Lead image URL if provided by the RSS feed. |

---

### Home Assistant Automation Example

Receive instant alerts on your phone whenever a high-priority dispatch is published:

```yaml
automation:
  - alias: "RSS Prio Dispatch Alert"
    trigger:
      - platform: mqtt
        topic: "rss_bevakaren/prio"
    action:
      - service: notify.notify
        data:
          title: "{{ trigger.payload_json.source_name }}: {{ trigger.payload_json.title }}"
          message: "{{ trigger.payload_json.summary }}"
          data:
            url: "{{ trigger.payload_json.link }}"
            clickAction: "{{ trigger.payload_json.link }}"
            tag: "rss_prio_{{ trigger.payload_json.id }}"
```

---

## Architecture

The application is structured into two lightweight microservices:

- **Backend:** Python with FastAPI, SQLAlchemy, APScheduler for background tasks, paho-mqtt for Pub/Sub messaging, and SQLite for persistence.
- **Frontend:** Modern Single Page Application (SPA) built with React, Vite, Framer Motion, and Lucide Icons.
- **Deployment:** Multi-stage Docker images published to GitHub Container Registry (GHCR).

---

## Deployment with Docker Compose

Create a `docker-compose.yml` file on your server:

```yaml
services:
  backend:
    image: ghcr.io/minglarn/rss_bevakaren_backend:latest
    ports:
      - "8094:8000"
    volumes:
      - ./data:/data
    environment:
      - TZ=Europe/Stockholm
      - DATABASE_URL=sqlite:////data/rss.db
      - APP_USERNAME=admin
      - APP_PASSWORD=your_secure_password
      - LM_STUDIO_URL=http://192.168.1.50:1234/v1/chat/completions
      - LM_STUDIO_TIMEOUT=120
      - AI_MAX_ARTICLE_AGE_HOURS=24
      # MQTT integration (optional)
      - MQTT_ENABLED=false
      - MQTT_BROKER=192.168.1.50
      - MQTT_PORT=1883
      - MQTT_TOPIC_PREFIX=rss_bevakaren
    restart: unless-stopped

  frontend:
    image: ghcr.io/minglarn/rss_bevakaren_frontend:latest
    ports:
      - "8093:80"
    environment:
      - TZ=Europe/Stockholm
      - VITE_API_URL=http://your-server-ip:8094
    restart: unless-stopped
    depends_on:
      - backend
```

Launch the services:
```bash
docker-compose pull
docker-compose up -d
```

Navigate to `http://your-server-ip:8093` in your browser and sign in.

---

## Versioning

This project strictly adheres to Calendar Versioning (CalVer), for example `2026.09.09.09`.
Version numbers are updated on every release, ensuring complete traceability across source code, container tags, and release notes.
