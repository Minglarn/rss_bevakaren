# RSS-Bevakaren

![Version](https://img.shields.io/badge/version-2026.09.07.16-blue.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/Minglarn/rss_bevakaren)
![GitHub issues](https://img.shields.io/github/issues/Minglarn/rss_bevakaren)
![GitHub stars](https://img.shields.io/github/stars/Minglarn/rss_bevakaren?style=social)

![Dashboard Screenshot](screenshot_1.jpg)

RSS-Bevakaren är ett modernt, självhostat system för att övervaka, filtrera, prioritera och presentera RSS-flöden i realtid. Systemet kombinerar en robust Python-backend, ett responsivt React-gränssnitt och en kraftfull AI-motor för automatisk analys, sammanfattning och prioritering av nyheter.

---

## Huvudfunktioner

- **Fleranvändarsystem:** Säkert inloggningssystem med JWT-autentisering där varje användare har sina egna flöden, filter och personliga AI-inställningar.
- **Flödeshantering:** Lägg till, organisera och ta bort RSS-flöden. Inbyggt stöd för i princip alla RSS- och Atom-format samt WordPress-flöden.
- **Två Visningslägen (AI & Klassisk RSS):** Välj själv under inställningarna om du vill ha ett AI-berikat nyhetsflöde eller en minimalistisk och snabb klassisk RSS-vy.
- **Dedikerat Prio-flöde:** Automatisk identifiering av högprioriterade nyheter baserat på dina personliga regler, nyckelord och kategorivikter.
- **Artikelläsning & Sparande:** Läs hela artiklar direkt i applikationen, markera som läst/oläst eller lås fast viktiga artiklar för att skydda dem från automatisk rensning.
- **PWA & WebPush:** Progressiv webbapplikation med blixtsnabba push-notiser både på dator och mobil, även när applikationen är stängd.
- **Automatiskt Underhåll:** Inbyggd rensningsfunktion för att gallra bort gammal historik efter ett valbart antal dagar.

---

## AI-Motorn och Prio-systemet

RSS-Bevakaren har en inbyggd AI-motor som kan kopplas mot en lokal språkmodell (t.ex. via LM Studio, Ollama eller LocalAI) eller valfri OpenAI-kompatibel tjänst.

### Vad AI-motorn gör

Varje ny artikel som hämtas kan automatiskt skickas genom AI-analysen:
1. **Kärnfull sammanfattning:** Skapar en 1-2 meningars sammanfattning på svenska som snabbt låter dig avgöra om artikeln är intressant.
2. **Klassificering:** Delar in artikeln i en av följande fasta kategorier:
   - INRIKES
   - UTRIKES
   - EKONOMI
   - POLITIK
   - SPORT
   - NÖJE & KULTUR
   - TEKNIK
   - BILAR
   - BLÅLJUS
   - ÖVRIGT
3. **Relevanspoäng & Prioritering:** Artikeln tilldelas en prioritetspoäng (0-100) och motivering baserat på dina inställningar.
4. **Automatiska Taggar:** Genererar relevanta ämnestaggar för artikeln.

---

### Så hanterar du AI-delen i Inställningar

AI-konfigurationen är helt personlig och styrs via fliken **AI** i **Inställningar**.

#### 1. Anslutning till LLM / LM Studio
- **API Bas-URL:** Ange adressen till din lokala LLM-server, exempelvis `http://192.168.1.50:1234/v1`.
- **API Nyckel:** Valfritt (kan lämnas tomt eller sättas till t.ex. `lm-studio`).
- **Testa anslutning & Modellval:** Klicka på "Testa anslutning". Systemet verifierar uppkopplingen och hämtar automatiskt in en lista över alla installerade modeller i en rullgardinsmeny där du enkelt väljer aktiv modell.
- **Temperatur:** Justera kreativiteten (rekommenderat: 0.1 - 0.3 för konsekvent faktapresentation).

#### 2. Kategoriviktning (0 - 10)
Under sektionen *Kategoriviktning för prioritering* finns skjutreglage för varje kategori:
- Sätt ett högre värde (t.ex. 8-10) på ämnen du bryr dig mest om (t.ex. Blåljus, Teknik).
- Artiklar som tilldelas en kategori med vikt **8 eller högre** kvalificerar sig automatiskt in i **Prio-flödet**.
- Lägre värderade kategorier visas fortfarande i det vanliga flödet men tynger inte ner Prio-flödet.

#### 3. Bevakningsord (Absolut Prioritet)
I fältet för *Bevakningsord* kan du ange kommaseparerade ord eller fraser (exempelvis: `Trosa, Stockholm, Nvidia, Cybersäkerhet`).
- Alla artiklar vars rubrik eller text matchar något av dessa ord får **omedelbart 100 poäng och högsta prioritet**, oavsett vilken kategori de tillhör.

#### 4. Promptmall och Systeminstruktioner
Du kan finjustera systemprompten direkt i gränssnittet för att ge modellen instruktioner om tonläge, språk och bedömningskriterier. Standardmallen levereras färdigkonfigurerad för optimalt resultat och snabb JSON-respons.

---

## Visningslägen: AI-flöde vs Klassisk RSS

Under **Inställningar -> UI** kan du välja hur du vill att det ordinarie nyhetsflödet (Dashboard) ska presenteras:

- **AI-flöde (Sammanfattningar & taggar):** Alla artiklar i nyhetsflödet visar AI-sammanfattning, ämnestaggar och kategori. Artiklar med hög prioritet markeras med en distinkt ram och prioriteringsbricka.
- **Klassisk RSS (Rå text utan AI):** Avskalad vy för dig som föredrar att läsa källans originalingress utan AI-bearbetning.

Oavsett vilket läge du väljer för Dashboard finns alltid fliken **Prio Flöde** tillgänglig i sidomenyn, där enbart de viktigaste nyheterna samlas.

---

## Arkitektur

Systemet är uppbyggt av två mikrotjänster:

- **Backend:** Python med FastAPI, SQLAlchemy, APScheduler för asynkrona bakgrundsjobb, och SQLite som databas.
- **Frontend:** Modern SPA byggd med React, Vite, Framer Motion för följsamma animeringar och Lucide Icons.
- **Driftsättning:** Optimerade flerstegs Docker-byggen publicerade på GitHub Container Registry (GHCR).

---

## Driftsättning med Docker Compose

Skapa en fil med namnet `docker-compose.yml` på din server:

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
      - APP_PASSWORD=ditt_hemliga_losenord
    restart: unless-stopped

  frontend:
    image: ghcr.io/minglarn/rss_bevakaren_frontend:latest
    ports:
      - "8093:80"
    environment:
      - TZ=Europe/Stockholm
      - VITE_API_URL=http://din-server-ip:8094
    restart: unless-stopped
    depends_on:
      - backend
```

Starta tjänsterna:
```bash
docker-compose pull
docker-compose up -d
```

Öppna din webbläsare på `http://din-server-ip:8093` och logga in.

---

## Versionshantering

Projektet använder Calendar Versioning (CalVer), exempelvis `2026.09.07.16`.
Versionsnumret uppdateras vid varje release och garanterar full spårbarhet mellan källkod och Docker-avbildningar.
