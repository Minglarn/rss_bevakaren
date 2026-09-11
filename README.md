# RSS-Bevakaren

![Version](https://img.shields.io/badge/version-2026.09.11.05-blue.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/Minglarn/rss_bevakaren)
![GitHub issues](https://img.shields.io/github/issues/Minglarn/rss_bevakaren)
![GitHub stars](https://img.shields.io/github/stars/Minglarn/rss_bevakaren?style=social)

![Dashboard Screenshot](screenshot_1.jpg)

RSS-Bevakaren är ett modernt, självhostat system för att övervaka, filtrera, prioritera och presentera RSS- och Atom-flöden i realtid. Systemet kombinerar en robust Python-backend, en responsiv React-frontend och en kraftfull lokal AI-motor för automatisk analys, sammanfattning, klickbetesdetektering och händelseprioritering.

---

## Huvudfunktioner

- **Nyhetsklustring och dubletthantering (Topic Clustering):** Intelligent semantisk och heuristisk gruppering av artiklar från olika redaktioner som rapporterar om samma händelse (t.ex. SVT, DN, Aftonbladet). Visar länkade källbrickor och gör det möjligt att markera hela händelser som lästa med ett klick. Styrs centralt via Inställningar -> Utseende och är aktiv som standard.
- **Dagens Briefing & Historikarkiv (AI Digest):** Automatisk morgon- och kvällsrapport (kl 07:00 och 18:00) av nyhetsläget sammanställd via lokal AI. Har en dedikerad flik på desktop med fullständigt historikarkiv, samt ett ultrakompakt expanderbart toppkort i mobilflödet.
- **Interaktiv AI-nyhetschatt & Hybrid RAG:** Fullskärms konversationsgränssnitt som drivs av en lokal LM Studio-instans eller valfritt OpenAI-kompatibelt API. Ställ frågor på naturligt språk ("Vilka allvarliga olyckor har rapporterats senaste dygnet?", "Sammanfatta nyheter inom politik") och få svar med källhänvisningar och direktlänkar.
- **Fleranvändararkitektur:** Säker autentisering med JWT-tokens där varje användare har sina egna flöden, filter och personliga AI-preferenser.
- **Flödeshantering:** Lägg till, organisera och ta bort RSS- och Atom-flöden. Inbyggt stöd för i stort sett alla standard-RSS/Atom-specifikationer och WordPress-flöden.
- **Två visningslägen (AI-flöde & Klassisk RSS):** Välj mellan ett AI-berikat flöde med koncisa sammanfattningar eller en snabb, minimalistisk råtextvy.
- **Klickbetesdetektering och Anti-Klickbete:** Intelligent identifiering av sensationella och undanhållande rubriker. AI-sammanfattningen avslöjar fakta direkt, varningsbrickor flaggar artikeln och klickbete nedprioriteras automatiskt från prio-flödet.
- **AI-skelettladdning & Mjuka övergångar:** Nya artiklar visar en diskret laddningsindikator medan AI-analys pågår och tonar in mjukt utan layoutskiftningar.
- **Robust timeout & Offline-fallback:** Om din lokala LLM (t.ex. LM Studio) är offline eller tar för lång tid faller artiklar automatiskt tillbaka till RSS-originaltexten efter 45 sekunder, eller direkt med ett klick.
- **Dedikerat Prio-flöde:** Realtidsprioritering baserad på dina anpassade regler, bevakade sökord och kategorivikter.
- **Läs hela artiklar och dela:** Skrapa och läs fullständiga artiklar direkt i appen, dela via enhetens inbyggda delningsmeny, SMS eller WhatsApp, samt kopiera länkar med ett klick.
- **PWA & Web Push:** Progressiv webbapplikation med direkta push-notiser på både dator och mobil, även när webbläsaren är stängd.
- **Automatisk nattlig städning:** Automatisk databasrensning för att rensa bort gammal olåst historik efter en konfigurerbar tidsperiod.

---

## AI-motor och prioriteringssystem

RSS-Bevakaren har en inbyggd AI-pipeline som ansluter till lokala språkmodeller (såsom LM Studio, Ollama eller LocalAI) eller valfria OpenAI-kompatibla API-slutpunkter.

### Vad AI-motorn gör

Varje inkommande artikel bearbetas automatiskt i bakgrunden:

1. **Koncisa sammanfattningar:** Skapar en informativ sammanfattning på 1-2 meningar som gör att du förstår kärnan i händelsen på några sekunder.
2. **Klickbetesdetektering (Anti-Klickbete):**
   - Identifierar sensationalism, överdrifter och avsiktliga kunskapsluckor i rubriker.
   - Flaggar artikeln med en tydlig varningsbricka: `Klickbete-varning`.
   - Visar förklaringen direkt i sammanfattningsblocket (*Klickbete-notis: ...*), vilket gör den lättläst även på mobil.
   - **Avslöjar klickbetet:** Sammanfattningen instrueras att omedelbart lyfta fram fakta och besvara rubrikens gåta i den allra första meningen.
   - **Rensar prio-flödet:** Klickbetesartiklar begränsas automatiskt till låg prioritet (maximalt 25 poäng) för att undvika skräp i ditt prio-flöde.
3. **Kategorisering:** Klassificerar artiklar i dina valda kategorier (Teknik, Politik, Blåljus, Ekonomi, Lokalt, Motor, etc.).
4. **Relevanspoäng & Prioritering:** Poängsätter artiklar från 0 till 100 baserat på dina personliga vikter och sökordsregler.
5. **Automatiska taggar:** Extraherar relevanta ämnestaggar för direkt filtrering via hashtaggar.

---

### Hantera AI i Inställningar

Alla AI-alternativ anpassas individuellt per användare under **Inställningar -> AI-analys & Prompt**:

#### 1. Anslutning till LLM / LM Studio
- **API-basadress:** Ange adressen till din lokala LLM-server (t.ex. `http://192.168.1.50:1234/v1`).
- **Anslutningstest & Modellväljare:** Klicka på "Kontrollera anslutning" för att verifiera status. Applikationen hämtar automatiskt alla installerade modeller till en rullgardinsmeny.
- **Självläkande bakgrundskö:** Om LM Studio är upptaget eller avstängt pausar kön automatiskt och utför hälsokontroller var 30:e sekund. När LM Studio åter blir tillgängligt återupptas analysen automatiskt, och artiklarna uppdateras på skärmen i realtid via WebSockets.

#### 2. Kategorivikter (0 - 10)
Under *Kategoriregreglage & Prioritet*, justera prioriteringen för varje ämne:
- Höga värden (8-10) kvalificerar inkommande artiklar direkt till **PRIO-flödet**.
- Lägre värden behåller artiklarna i standardtidslinjen utan att belasta prio-vyn.

#### 3. Bevakade sökord (Garanterad 100% prioritet)
Lägg till viktiga sökord eller platser i *Prioriterade sökord & ämnen* (t.ex. `Stockholm, Nvidia, Försvarsmakten, Riksbanken`).
- Alla artiklar som matchar ett bevakat sökord får **omedelbart 100 poäng och Hög prioritet**, oavsett kategori.

#### 4. Anpassad systemprompt
Granska och redigera den aktiva systemprompten direkt i webbgränssnittet. Du kan justera ton, kategoridefinitioner, klickbeteskriterier eller språkinställningar direkt.

---

## Visningslägen: AI-flöde vs Klassisk RSS

Konfigurera ditt föredragna visningsläge under **Inställningar -> Utseende**:

- **AI-flöde (Sammanfattningar & Taggar):** Visar AI-sammanfattningar, kategoritaggar, klickbetesvarningar och prioritetsindikatorer. Obearbetade artiklar visar ett skelettladdningsläge (*Analyserar med AI...*).
- **Klassiskt RSS-flöde (Råtext utan AI):** Ett snabbt och avskalat flöde som visar ursprunglig ingresstext från RSS-flödet utan AI-bearbetning.

Oavsett inställning finns **PRIO-flödet** alltid tillgängligt i navigeringen för att följa högprioriterade händelser.

---

## Interaktiv AI-nyhetsassistent & Semantisk Hybrid-RAG

RSS-Bevakaren har ett dedikerat konversationsgränssnitt (**AI Chatt**) som nås via menyn. Du kan interagera direkt med dina bevakade nyhetsartiklar via naturligt språk:

### Arkitektur & Funktioner

1. **Konversationsbaserad nyhetsfrågeställning (RAG):**
   - Ställ komplexa frågor på svenska eller engelska (t.ex. *"Vilka allvarliga olyckor har rapporterats senaste dygnet?"*, *"Vad rapporteras om räntan och börsen?"* eller *"Hitta alla artiklar om elbilar och sammanfatta läget"*).
   - Assistenten sammanställer sakliga och sammanhängande översikter baserade direkt på dina inkomna artiklar.

2. **Semantisk vektorsökning (Nomic Embeddings v1.5):**
   - Inkommande artiklar vektoriseras automatiskt med lokala embeddingsmodeller (såsom `text-embedding-nomic-embed-text-v1.5` i LM Studio).
   - Fångar kontextuell betydelse och synonymer (768 dimensioner), vilket överbryggar skillnader mellan användarens frågor och redaktionernas rubriker.

3. **SQLite Vektorlagring & Snabb Cosinuslikhet:**
   - Vektorer sparas i SQLite som binära float32-blobbar (`article_embeddings`-tabellen) med atomära garantier.
   - Vektorrankningen använder optimerade numpy-rutiner för cosinuslikhet över databasarkivet.

4. **Hybrid återfinningsstrategi:**
   - Kombinerar högdimensionell semantisk sökning med textmatchning och nyckelordssökning i SQLite.
   - Garanterar precision för specifika namn, siffror och förkortningar vid sidan av begreppsmässiga träffar.

5. **Tydliga källhänvisningar:**
   - Varje svar visar interaktiva, expanderbara källhänvisningar med information om flöde, rubrik, publiceringsdatum och prioritet.
   - Innehåller direktlänkar för att läsa ursprungsartikeln hos källan.

6. **Dynamiska uppföljningsfrågor:**
   - Efter varje svar analyserar AI:n fakta och formulerar 4 relevanta uppföljningsfrågor.
   - Visas som klickbara snabbvalsbrickor direkt under svaret.

7. **Beständig bakgrundschatt (`AiChatContext`):**
   - Byggd på en global React Context (`AiChatContext`).
   - Svarsgenerering fortsätter utan avbrott även om du byter flik i appen.
   - En pulserande aktivitetsindikator i sidomenyn signalerar när AI bearbetar ett svar.
   - Fullständig konversationshistorik bevaras under sessionen via `sessionStorage`.

8. **Automatisk fallback:**
   - Om embeddingsmodellen inte är aktiv växlar assistenten automatiskt till fulltextsökning på nyckelord utan avbrott.

---

## MQTT-integration & Hemautomation

RSS-Bevakaren har inbyggt stöd för publicering via MQTT. När funktionen aktiveras skickas varje inkommande artikel och prioriterad händelse i realtid till din MQTT-broker (såsom Eclipse Mosquitto, Home Assistant eller Node-RED).

### Konfiguration i docker-compose.yml

Lägg till följande miljövariabler för `backend`-tjänsten i `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      # MQTT-integration (valfritt, inaktiverat som standard)
      - MQTT_ENABLED=true
      - MQTT_BROKER=192.168.1.50
      - MQTT_PORT=1883
      - MQTT_USERNAME=ditt_användarnamn   # Valfritt: lämna tomt om brokern tillåter anonym anslutning
      - MQTT_PASSWORD=ditt_lösenord       # Valfritt: lämna tomt om brokern tillåter anonym anslutning
      - MQTT_TOPIC_PREFIX=rss_bevakaren
      - MQTT_CLIENT_ID=rss_bevakaren_backend
      - MQTT_RETAIN=false
      - MQTT_QOS=0
```

### Ämnesarkitektur (Topic Hierarchy)

MQTT-tjänsten använder en ren och förutsägbar hierarki:

| Ämne (Topic) | Beskrivning | Retained |
|---|---|---|
| `{prefix}/status` | Systemets anslutningsstatus via LWT (Last Will and Testament). Skickar `"online"` vid anslutning och `"offline"` om backend avslutas. | Ja |
| `{prefix}/feeds/{feed_slug}` | Individuell ström för varje bevakat flöde. Specialtecken saneras automatiskt (t.ex. blir `Polisen - Skåne län` till `polisen_skane_lan`). | Konfigurerbart |
| `{prefix}/prio` | Dedikerad kanal för högprioriterade händelser. Artiklar med `priority: high` eller som matchar bevakade sökord publiceras här parallellt. | Konfigurerbart |

#### Rekommenderade prenumerationsmönster
- **Alla händelser:** `rss_bevakaren/#`
- **Alla flödesströmmar:** `rss_bevakaren/feeds/+`
- **Specifikt flöde:** `rss_bevakaren/feeds/polisen_skane_lan`
- **Endast prioriterade larm (Home Assistant / notiser):** `rss_bevakaren/prio`

---

### Detaljerad JSON-dataspecifikation

Varje meddelande som publiceras innehåller en strukturerad JSON-nyttolast med fullständig händelsemetadata:

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

#### Fältreferens

| Fält | Typ | Beskrivning |
|---|---|---|
| `id` | heltal | Unikt artikel-ID i databasen. |
| `title` | sträng | Artikelns fullständiga rubrik. |
| `summary` | sträng | AI-sammanfattning (eller RSS-beskrivning om AI är avstängt). |
| `ai_summary` | sträng | Dedikerad AI-genererad sammanfattningstext. |
| `link` | sträng | Direkt webbadress till originalartikeln. |
| `published_at`| sträng | Publiceringsdatum och tid formaterat i ISO 8601 (UTC). |
| `received_ts` | heltal | UNIX-tidsstämpel (sekunder) när artikeln togs emot. |
| `source_name` | sträng | Visningsnamn på flödeskällan (t.ex. `Polisen`, `CarUp`, `SVT Nyheter`). |
| `source_slug` | sträng | Sanerat ID som matchar flödets MQTT-underämne. |
| `category` | sträng | AI-klassificerad kategori (t.ex. `Blåljus`, `Ekonomi`, `Teknik`, `Lokalt`). |
| `priority` | sträng | Prioritetsklass: `high`, `medium` eller `low`. |
| `prio_score` | heltal | Relevanspoäng från `0` till `100`. Poäng >= 75 publiceras på `prio`. |
| `prio_reason` | sträng | Motivering för poängen (t.ex. `Högprioriterad kategori: Blåljus (9/10)`). |
| `is_prio` | boolean | `true` om artikeln kvalificerar sig som prioriterad. |
| `matched_keywords` | lista[sträng] | Lista med bevakade sökord som matchats. |
| `is_clickbait`| boolean | `true` om AI identifierat klickbetestaktik i rubriken. |
| `clickbait_reason` | sträng | Förklaring av vad rubriken undanhöll och bekräftelse på att fakta lyfts fram. |
| `tags` | lista[sträng] | AI-genererade ämnestaggar för snabb indelning. |
| `image_url` | sträng | Bildadress om flödet tillhandahåller en artikelbild. |

---

### Automatiseringsexempel för Home Assistant

Få direkta aviseringar i mobilen när en högprioriterad händelse inträffar:

```yaml
automation:
  - alias: "RSS Prio Händelselarm"
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

## Arkitektur

Applikationen är uppbyggd som två lätta mikrotjänster:

- **Backend:** Python med FastAPI, SQLAlchemy, schemaläggning för bakgrundsuppgifter, paho-mqtt för meddelandehantering och SQLite för lagring.
- **Frontend:** Modern Single Page Application (SPA) byggd med React, Vite, Framer Motion och Lucide-ikoner.
- **Drift:** Docker-avbilder i flera steg som publiceras till GitHub Container Registry (GHCR).

---

## Drift med Docker Compose

Skapa en `docker-compose.yml`-fil på din server:

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
      - APP_PASSWORD=ditt_säkra_lösenord
      - LM_STUDIO_URL=http://192.168.1.50:1234/v1/chat/completions
      - LM_STUDIO_TIMEOUT=120
      - AI_MAX_ARTICLE_AGE_HOURS=24
      # MQTT-integration (valfritt)
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

Öppna `http://din-server-ip:8093` i webbläsaren och logga in.

---

## Versionshantering

Projektet tillämpar strikt kalenderbaserad versionshantering (CalVer), exempelvis `2026.09.11.05`.
Versionsnumret uppdateras inför varje leverans, vilket garanterar full spårbarhet mellan källkod, container-taggar och ändringslogg.
