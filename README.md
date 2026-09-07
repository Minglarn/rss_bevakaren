# RSS-Bevakaren

![Version](https://img.shields.io/badge/version-2026.09.07.27-blue.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/Minglarn/rss_bevakaren)
![GitHub issues](https://img.shields.io/github/issues/Minglarn/rss_bevakaren)
![GitHub stars](https://img.shields.io/github/stars/Minglarn/rss_bevakaren?style=social)

![Dashboard Screenshot](screenshot_1.jpg)

RSS-Bevakaren is a modern, self-hosted system for monitoring, filtering, prioritizing, and presenting RSS feeds in real time. The system combines a robust Python backend, a responsive React frontend, and a powerful local AI engine for automated analysis, summarization, clickbait detection, and news prioritization.

---

## Key Features

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

## Architecture

The application is structured into two lightweight microservices:

- **Backend:** Python with FastAPI, SQLAlchemy, APScheduler for background tasks, and SQLite for persistence.
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
      - DATABASE_URL=sqlite:////data/rss.db
      - APP_USERNAME=admin
      - APP_PASSWORD=your_secure_password
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

This project strictly adheres to Calendar Versioning (CalVer), for example `2026.09.07.27`.
Version numbers are updated on every release, ensuring complete traceability across source code, container tags, and release notes.
