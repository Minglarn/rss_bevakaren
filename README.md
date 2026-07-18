# RSS-Bevakaren

Ett modernt system för att övervaka och presentera RSS-flöden i realtid. Byggt med en stilren design (inspirerad av PolisInfo), robust Python-backend och en responsiv React-frontend.

## Funktioner
- **Multi-användare:** Säker inloggning via JWT-autentisering. Varje användare har sina egna flöden och inställningar.
- **RSS-Hantering:** Lägg till och ta bort RSS-flöden som ska övervakas.
- **Dashboard:** Presenterar de senaste nyheterna från dina valda flöden i ett samlat gränssnitt.
- **Nyckelordsbevakning:** (Pågående) Möjlighet att lägga in sökord. Vid träff i flöden skickas notiser.
- **PWA & WebPush:** (Pågående) Byggd för att fungera som en Progressiv Webbapp med stöd för notiser.

## Arkitektur
Systemet bygger på en Docker-baserad mikrotjänstarkitektur:
- **Backend:** Python med FastAPI, SQLAlchemy och SQLite.
- **Frontend:** React (byggt med Vite), React Router och Axios.
- **Infrastruktur:** Byggd för publicering via GitHub Container Registry (GHCR) med en produktionsklar `docker-compose.yml`.

## Utveckling (Lokal körning)
1. Klona repositoryt.
2. För backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
   *Standard inloggning skapas automatiskt: `admin` / `admin`*
3. För frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Produktionskörning
Applikationen driftsätts enklast via `docker-compose.yml` som laddar ner förbyggda bilder från GHCR.
```bash
docker-compose up -d
```

## Versionshantering
Projektet använder CalVer (ex. 2026.07.1).
