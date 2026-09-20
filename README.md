# RSS-Bevakaren

![Version](https://img.shields.io/badge/version-2026.09.20.03-blue.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/Minglarn/rss_bevakaren)
![GitHub issues](https://img.shields.io/github/issues/Minglarn/rss_bevakaren)
![GitHub stars](https://img.shields.io/github/stars/Minglarn/rss_bevakaren?style=social)

![Dashboard Screenshot](screenshot_1.jpg)

RSS-Bevakaren är ett modernt, självhostat system för att övervaka, filtrera, prioritera och presentera RSS- och Atom-flöden i realtid. Systemet kombinerar en robust Python-backend, en responsiv React-frontend och en kraftfull lokal AI-motor för automatisk analys, sammanfattning, ClickBait-detektering och händelseprioritering.

---

## Huvudfunktioner

- **Interaktiv installationsguide (Onboarding Wizard):** Flerstegsguide vid nyinstallation som hjälper användaren att välja rekommenderade svenska flödespaket, kontrollera lokal AI-anslutning och forma sin personliga nyhetsprofil och kategoriviktning utifrån ett enkelt frågebatteri (med möjlighet att skippa eller köra om när som helst).
- **Gilla- & Ogilla-system (Adaptiv intresseprofil):** Interaktiv röstning direkt på händelsekorten (Tumme upp / Tumme ner). Att gilla en artikel tränar upp en personlig intresseprofil som prioriterar upp framtida liknande ämnen (+10p bonus per matchande tagg). Att ogilla en artikel sänker poängen (-15p) för liknande ämnen. Artikellåsning (skydd mot databasrensning) styrs separat via den dedikerade Lås-knappen.
- **Favoritfilter ("Gillade"):** Ett dedikerat filter i navigeringsfältet för att omedelbart visa alla dina gillade och sparade artiklar.
- **Nyhetsklustring och dubletthantering (Topic Clustering):** Intelligent semantisk och heuristisk gruppering av artiklar från olika redaktioner som rapporterar om samma händelse (t.ex. SVT, DN, Aftonbladet). Visar länkade källbrickor och gör det möjligt att markera hela händelser som lästa med ett klick. Styrs centralt via Inställningar -> Utseende och är aktiv som standard.
- **Dagens Briefing & Eget Rapportflöde (AI Digest):** Automatisk morgon- och kvällsrapport (kl 07:00 och 18:00) av nyhetsläget sammanställd via lokal AI. Fungerar som ett eget renodlat flöde på desktop och mobil med full historik, arkivbläddring, talsyntesuppläsning och direkt kopiering.
- **Interaktiv AI-nyhetschatt & Hybrid RAG:** Fullskärms konversationsgränssnitt som drivs av en lokal LM Studio-instans eller valfritt OpenAI-kompatibelt API. Ställ frågor på naturligt språk ("Vilka allvarliga olyckor har rapporterats senaste dygnet?", "Sammanfatta nyheter inom politik") och få svar med källhänvisningar och direktlänkar.
- **Fleranvändararkitektur:** Säker autentisering med JWT-tokens där varje användare har sina egna flöden, filter och personliga AI-preferenser.
- **Flödeshantering:** Lägg till, organisera och ta bort RSS- och Atom-flöden. Inbyggt stöd för i stort sett alla standard-RSS/Atom-specifikationer och WordPress-flöden.
- **Två visningslägen (AI-flöde & Klassisk RSS):** Välj mellan ett AI-berikat flöde med koncisa sammanfattningar eller en snabb, minimalistisk råtextvy.
- **Clickbait-detektering och Anti-Clickbait:** Intelligent identifiering av sensationella och undanhållande rubriker. AI-sammanfattningen avslöjar fakta direkt, varningsbrickor flaggar artikeln och Clickbait nedprioriteras automatiskt från prio-flödet.
- **AI-skelettladdning & Mjuka övergångar:** Nya artiklar visar en diskret laddningsindikator medan AI-analys pågår och tonar in mjukt utan layoutskiftningar.
- **Robust timeout & Offline-fallback:** Om din lokala LLM (t.ex. LM Studio) är offline eller tar för lång tid faller artiklar automatiskt tillbaka till RSS-originaltexten efter 45 sekunder, eller direkt med ett klick.
- **Dedikerat Prio-flöde:** Realtidsprioritering baserad på dina anpassade regler, bevakade sökord och kategorivikter.
- **Läs hela artiklar och dela:** Skrapa och läs fullständiga artiklar direkt i appen, dela via enhetens inbyggda delningsmeny, SMS eller WhatsApp, samt kopiera länkar med ett klick.
- **PWA & Web Push:** Progressiv webbapplikation med direkta push-notiser på både dator och mobil, även när webbläsaren är stängd.
- **Automatisk nattlig städning:** Automatisk databasrensning för att rensa bort gammal olåst historik efter en konfigurerbar tidsperiod.

---

## AI-motor och prioriteringssystem

RSS-Bevakaren har en inbyggd AI-pipeline som ansluter till lokala språkmodeller (såsom LM Studio, Ollama eller LocalAI) eller valfria OpenAI-kompatibla API-slutpunkter.

### Rekommenderade modeller (eget bruk och verifierat test)

Systemet är anpassat och optimerat för följande lokala modeller:

- **Språkmodell (LLM för analys, sammanfattning och ClickBait-detektering):** `google/gemma-4-12b-qat`  
  Ger snabb inferens och god förståelse för svenskt nyhetsspråk samt ClickBait-identifiering.
- **Embeddingsmodell (Semantisk vektorsökning och hybrid-RAG):** `text-embedding-nomic-embed-text-v1.5`  
  Levererar 768-dimensionella vektorer med stark förmåga att matcha användarfrågor mot artikelinnehåll.

### Hur poängsystemet och prioriteringen fungerar

Prioriteringen i RSS-Bevakaren styrs inte enbart av en enskild kategori, utan av en **sammansatt poängmatris (0–100 poäng)**. Detta förhindrar att vardagliga smånotiser i dina favoritkategorier felaktigt blir högprioriterade, samtidigt som stora och bekräftade nyheter alltid lyfts fram.

Varje inkommande artikel poängsätts enligt tre huvudkomponenter:

1. **Ditt kategori-intresse (30 % av poängen):**
   - Styrs av ditt personliga reglage (0–10) för artiklarnas kategori.
   - En kategori med vikt 8 ger 24 poäng som grundplatta ($8 \times 10 \times 0.30$).
2. **Händelsens akuthet och nyhetsvärde (40 % av poängen):**
   - Bedöms av AI:n i realtid (`urgency_score`, 1–10).
   - Skiljer vardagliga händelser (1–3) från stora samhällshändelser eller extraordinära brytpunkter (8–10).
3. **Innehållets faktasubstans och djup (30 % av poängen):**
   - Bedöms av AI:n (`substance_score`, 1–10).
   - Skiljer ytliga notiser och rykten (1–3) från faktatäta rapporter och genomarbetade analyser (7–10).

$$\text{Grundpoäng} = (\text{Kategorivikt} \times 10 \times 0.30) + (\text{Akuthet} \times 10 \times 0.40) + (\text{Substans} \times 10 \times 0.30)$$

#### Specialregler och bonusar
- **PRIO-tröskel ($\ge 75$ poäng):** Artiklar som når 75 poäng eller mer får status `HIGH` och visas i det dedikerade PRIO-flödet med orange märkning.
- **Intresseprofil (Gilla):** Om du har gillat tidigare artiklar inom samma ämne/tagg läggs en personlig intressebonus på **+10 poäng** till (upp till **+20 poäng** vid flera träffar).
- **Oönskade ämnen (Ogilla):** Om artikeln matchar ett ämne/tagg du tidigare har ogillat görs ett avdrag på **-15 poäng**.
- **Flerkällsbekräftelse (Kluster):** Om samma händelse rapporteras av **2 oberoende källor** läggs **+10 poäng** till. Om **3 eller fler källor** rapporterar läggs **+15 poäng** till. Detta lyfter automatiskt bekräftade stora händelser.
- **ClickBait-avdrag (-25 poäng):** Artiklar med sensationella eller undanhållande rubriker får ett automatiskt avdrag på 25 poäng för att hålla PRIO-flödet rent från skräp.
- **Bevakningsord (Garanterad 100 % PRIO):** Om artikeln matchar ett av dina egna bevakningsord får den omedelbart **100 poäng och Hög prioritet**, oavsett kategori.
- **Ignorerad kategori (Vikt 0):** Om du sätter en kategoris vikt till 0 blockeras den alltid (0 poäng) och når aldrig PRIO.

#### Konkret exempel: Egen kategori "Elpriser" vs Bevakningsord
Om du till exempel lägger till den egna kategorin **Elpriser** med intressevikt **9**:

1. **Hur AI vet att den ska kontrollera detta:**
   - Kategorin *Elpriser* skickas med i systemprompten till språkmodellen.
   - När en artikel om spotpriser, elskatt eller reaktorstopp anländer förstår AI:n innebörden och tilldelar artikeln kategorin `Elpriser`.
2. **Hur poängen räknas ut:**
   - **Kategorivikt:** 9 ger $9 \times 10 \times 0.30 = \mathbf{27\text{ poäng}}$.
   - **Akuthet:** Om det är en stor händelse med akuthet 8 får den $8 \times 10 \times 0.40 = \mathbf{32\text{ poäng}}$.
   - **Substans:** En faktatät artikel med substans 8 ger $8 \times 10 \times 0.30 = \mathbf{24\text{ poäng}}$.
   - **Resultat:** $27 + 32 + 24 = \mathbf{83\text{ poäng}}$ -> Artikeln passerar tröskeln ($\ge 75$) och får orange **PRIO**-bricka.
   - Är det däremot bara en liten vardagsnotis om elpriser (Akuthet 2, Substans 3) blir poängen $27 + 8 + 9 = \mathbf{44\text{ poäng}}$ och hamnar i det normala flödet.
3. **Kategori vs Bevakningsord:**
   - **Kategori (Elpriser):** Semantisk förståelse. Artikeln behöver inte innehålla det exakta ordet "elpriser" för att fångas upp.
   - **Bevakningsord (Elpriser):** Hård regel. Om ordet "elpriser" bokstavligen förekommer i texten får artikeln **100 poäng och direkt pushnotis** utan att ens behöva invänta AI-bedömning.

---

### Hur kategorier definieras (Standard och Egna)

Under **Inställningar -> AI-analys & Prompt -> Kategoriviktning och prioritet**:

1. **Standardkategorier:**
   Systemet levereras med en genomtänkt uppsättning standardkategorier med förvalda intressevikter:
   - *Teknik* (9/10)
   - *Lokalt* (8/10)
   - *Blåljus* (7/10)
   - *Motor* (7/10)
   - *Vetenskap & Hälsa* (7/10)
   - *Inrikes* (6/10)
   - *Ekonomi* (5/10)
   - *Utrikes* (5/10)
   - *Nöje & Kultur* (5/10)
   - *Politik* (4/10)
   - *Övrigt* (3/10)
   - *Sport* (1/10)

2. **Lägga till helt egna kategorier:**
   - Du kan när som helst lägga till egna kategorier via formuläret *"Lägg till kategori"* (t.ex. `Försvar`, `Klimat`, `Fastigheter`, `AI & Rymd`).
   - När du lägger till en kategori uppdateras språkmodellens systemprompt automatiskt i bakgrunden, vilket gör att AI:n omedelbart börjar klassificera nya artiklar mot dina egna kategorier.
   - Du ställer in din önskade vikt (0–10) med reglaget för din nya kategori.
   - Du kan även ta bort kategorier du inte vill ha eller när som helst klicka *"Återställ standardvikter"*.
   - **Anpassad systemprompt:** Granska och redigera den aktiva systemprompten direkt i webbgränssnittet. Du kan justera ton, kategoridefinitioner, ClickBait-kriterier eller språkinställningar direkt.

---

## Installationsguide (Onboarding Wizard)

När applikationen startas första gången för en ny användare öppnas en interaktiv flerstegsguide automatiskt:

1. **Rekommenderade svenska flöden:** Välj bland kurerade temapaket (*Riksnyheter*, *Teknik & IT*, *Ekonomi & Finans*, *Blåljus & Krisinformation*, samt *Motor & Elbilar*). Du kan välja hela paket eller enskilda redaktioner med ett klick.
2. **Lokal AI-kontroll:** Testar anslutningen till din lokala språkmodell (LM Studio) i realtid, visar tillgängliga modeller och låter dig välja önskat format för push-notiser (kompakt 1-mening vs fullständig sammanfattning).
3. **Frågebatteri för personlig intresseprofil:** Alla kategorier startar på en neutral baslinje (6/10 inom standardspannet 5–7). Fyra enkla frågor anpassar automatiskt kategorivikterna och prioritetströskeln efter vad du vill läsa respektive dämpa.
4. **Förhandsgranskning & Finjustering:** Visar den framräknade profilen i ett överskådligt reglagekort där du kan finjustera innan bevakningen aktiveras.
5. **Skippa eller kör om:** Guiden har en tydlig *"Hoppa över introduktionen"*-knapp i alla steg som sparar standardinställningar. Guiden kan när som helst startas om från **Inställningar** (under flikarna *Allmänt* eller *AI-analys*).

---

## Visningslägen: AI-flöde vs Klassisk RSS

Konfigurera ditt föredragna visningsläge under **Inställningar -> Utseende**:

- **AI-flöde (Sammanfattningar & Taggar):** Visar AI-sammanfattningar, kategoritaggar, Clickbait-varningar och prioritetsindikatorer. Obearbetade artiklar visar ett skelettladdningsläge (*Analyserar med AI...*).
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

RSS-Bevakaren har inbyggt stöd för publicering via MQTT. När funktionen aktiveras skickas varje inkommande artikel och prioriterad händelse i realtid till din MQTT-broker (såsom Eclipse Mosquitto, Home Assistant eller Node-RED). Systemet är fullt uppdelat per användare, vilket gör att varje användare får sina egna dedikerade ämnen (topics).

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
      - MQTT_RETAIN=true                  # Behåll senaste meddelandet i brokern (persistent över omstarter)
      - MQTT_QOS=0
```

### Ämnesarkitektur (Topic Hierarchy)

MQTT-tjänsten använder en ren och förutsägbar hierarki uppdelad per användare:

| Ämne (Topic) | Beskrivning | Retained |
|---|---|---|
| `{prefix}/status` | Systemets globala anslutningsstatus via LWT (Last Will and Testament). Skickar `"online"` vid anslutning och `"offline"` om backend avslutas eller startar om. | Ja |
| `{prefix}/{användare}/feeds/{feed_slug}` | Individuell ström för varje användares bevakade flöden (t.ex. `rss_bevakaren/admin/feeds/polisen_skane_lan` eller `rss_bevakaren/wife/feeds/svt_nyheter`). Specialtecken saneras automatiskt. | Ja (standard: true) |
| `{prefix}/{användare}/prio` | Dedikerad kanal för användarens högprioriterade händelser. Artiklar med hög prioritet eller som matchar användarens egna bevakningsord publiceras här. | Ja (standard: true) |

När `MQTT_RETAIN=true` är aktiverat ligger de senaste artikelhändelserna kvar i MQTT-brokern över omstarter, vilket gör att anslutna system (såsom Home Assistant) omedelbart har tillgång till det senaste meddelandet utan att vänta på nya artiklar. Vid avstängning eller omstart skickar LWT-mekanismen automatiskt `"offline"` till `{prefix}/status`.

#### Rekommenderade prenumerationsmönster
- **Allt för specifik användare:** `rss_bevakaren/admin/#`
- **Endast admins prioriterade larm:** `rss_bevakaren/admin/prio`
- **Alla flöden för en specifik användare:** `rss_bevakaren/admin/feeds/+`
- **Prioriterade larm för ALLA användare:** `rss_bevakaren/+/prio`
- **Samtliga händelser i hela systemet:** `rss_bevakaren/#`

---

### Detaljerad JSON-dataspecifikation

Varje meddelande som publiceras innehåller en strukturerad JSON-nyttolast med fullständig händelse- och användarmetadata:

```json
{
  "id": 1420,
  "user": "admin",
  "user_id": 1,
  "title": "Chocksiffrorna: Nu höjs bilskatten med 1300%",
  "source": "CarUp",
  "feed_slug": "carup",
  "feed_id": 4,
  "feed_icon": "https://www.google.com/s2/favicons?domain=carup.se&sz=128",
  "feed_icon_path": "/api/feed-icons/4.png",
  "feed_domain": "carup.se",
  "icon": "https://www.google.com/s2/favicons?domain=carup.se&sz=128",
  "summary": "Nya EU-siffror visar att laddhybrider släpper ut betydligt mer koldioxid än vad biltillverkarna tidigare uppgett. Detta innebär att tusentals nya bilar kommer att drabbas av betydligt högre skatter baserat på de faktiska utsläppen.",
  "short_summary": "Nya EU-siffror medför kraftigt höjd fordonsskatt för laddhybrider.",
  "raw_summary": "Nya EU-siffror visar att laddhybrider släpper ut mer...",
  "link": "https://carup.se/chocksiffrorna-nu-hojs-bilskatten-med-1300/",
  "image_url": "https://carup.se/wp-content/uploads/2026/09/laddhybrid-skatt.jpg",
  "published": "Tue, 09 Sep 2026 17:15:00 +0200",
  "published_ts": 1788983700,
  "received_ts": 1788983750,
  "is_prio": true,
  "prio_score": 85,
  "prio_reason": "Träff på bevakningsord: bilskatt",
  "matched_keywords": ["bilskatt"],
  "is_clickbait": true,
  "clickbait_reason": "Rubriken döljer att det handlar om justerade utsläppsvärden för laddhybrider.",
  "category": "Ekonomi",
  "tags": ["bilskatt", "laddhybrider", "utsläpp", "EU", "ekonomi"]
}
```

#### Fältreferens

| Fält | Typ | Beskrivning |
|---|---|---|
| `id` | heltal | Unikt artikel-ID i databasen. |
| `user` | sträng | Sanerat användarnamn som äger flödet/bevakningen (t.ex. `admin`, `wife`). |
| `user_id` | heltal | Användarens numeriska ID i databasen. |
| `title` | sträng | Artikelns fullständiga rubrik. |
| `source` | sträng | Visningsnamn på flödeskällan (t.ex. `Polisen`, `CarUp`, `SVT Nyheter`). |
| `feed_slug` | sträng | Sanerat ID som matchar flödets MQTT-underämne. |
| `feed_id` | heltal | Numeriskt ID för det bevakade flödet. |
| `feed_icon` | sträng | Högupplöst publik favicon-URL (128x128 PNG) för källan (fungerar direkt i Home Assistant och appar). |
| `feed_icon_path` | sträng | Lokal relativ sökväg till källans sparade PNG-ikon (`/api/feed-icons/{id}.png`). |
| `feed_domain` | sträng | Flödets rena domännamn (t.ex. `polisen.se`, `carup.se`). |
| `icon` | sträng | Alias till `feed_icon` för maximal kompatibilitet i dashboards. |
| `summary` | sträng | AI-sammanfattning upp till 3 meningar (eller RSS-beskrivning om AI är avstängt). |
| `short_summary` | sträng | Kompakt AI-sammanfattning (1–1,5 meningar, max 20 ord) optimerad för snabba mobilnotiser och displayer. |
| `raw_summary` | sträng | Ursprunglig sammanfattning/ingress från källans RSS-flöde. |
| `link` | sträng | Direkt webbadress till originalartikeln. |
| `image_url` | sträng | Bildadress om flödet tillhandahåller en artikelbild. |
| `published` | sträng | Publiceringsdatum som sträng från källan. |
| `published_ts`| heltal | UNIX-tidsstämpel för publicering. |
| `received_ts` | heltal | UNIX-tidsstämpel (sekunder) när artikeln togs emot. |
| `is_prio` | boolean | `true` om artikeln kvalificerar sig som prioriterad (eller matchat bevakningsord). |
| `prio_score` | heltal | Relevanspoäng från `0` till `100`. |
| `prio_reason` | sträng | Motivering för poängen eller träff på bevakningsord. |
| `matched_keywords` | lista[sträng] | Lista med bevakade sökord som matchats för användaren. |
| `is_clickbait`| boolean | `true` om AI identifierat Clickbait-taktik i rubriken. |
| `clickbait_reason` | sträng | Förklaring av vad rubriken undanhöll och bekräftelse på att fakta lyfts fram. |
| `category` | sträng | AI-klassificerad kategori (t.ex. `Blåljus`, `Ekonomi`, `Teknik`, `Lokalt`). |
| `tags` | lista[sträng] | AI-genererade ämnestaggar för snabb indelning. |

---

### Home Assistant Integration

#### 1. MQTT-sensor (configuration.yaml)
Konfigurera en sensor som lyssnar på ditt personliga PRIO-flöde och sparar artikelattributen:

```yaml
mqtt:
  sensor:
    - name: "RSS Senaste Prio"
      state_topic: "rss_bevakaren/admin/prio"
      value_template: "{{ value_json.title }}"
      json_attributes_topic: "rss_bevakaren/admin/prio"
```

#### 2. Snyggt Dashboard-kort med Flödesikon (custom:button-card)
Detta kort visar källans officiella logotyp/ikon i topplisten, prioritetspoäng, rubrik, publiceringstid, AI-sammanfattning, kategori och taggar. Klick på kortet öppnar artikeln direkt hos källan:

```yaml
type: custom:button-card
entity: sensor.rss_senaste_prio
show_name: false
show_icon: false
show_state: false
tap_action:
  action: url
  url_path: "[[[ return entity.attributes.link; ]]]"
styles:
  card:
    - background-color: "#171d2c"
    - border: "2px solid #7c4dff"
    - border-radius: "14px"
    - padding: "0px"
    - overflow: "hidden"
    - color: "#ffffff"
    - text-align: "left"
    - cursor: "pointer"
  grid:
    - grid-template-areas: '"main"'
    - grid-template-columns: "1fr"
    - grid-template-rows: "1fr"
custom_fields:
  main: >
    [[[
      const a = entity.attributes;
      if (!a.title) return '<div style="padding:16px; color:#888;">Ingen händelse mottagen än.</div>';
      
      let tagsHtml = '';
      if (a.tags && Array.isArray(a.tags)) {
        tagsHtml = a.tags.map(t => `<span style="background:#1a2538; color:#7e9bbd; border:1px solid #2b3e5c; font-size:11px; padding:3px 9px; border-radius:12px; margin-right:5px; margin-bottom:5px; display:inline-block; white-space:nowrap;"># ${t}</span>`).join('');
      }

      const iconHtml = a.feed_icon 
        ? `<img src="${a.feed_icon}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: contain; background: rgba(255,255,255,0.12); padding: 2px;" />` 
        : `<span>RSS</span>`;

      return `
        <div>
          <!-- Top Header med flödesikon -->
          <div style="background-color: #7c4dff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 14px; color: #ffffff;">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${iconHtml}
              <span>${a.source || 'RSS'}</span>
            </div>
            ${a.prio_score ? `<span style="background: rgba(0,0,0,0.25); padding: 2px 8px; border-radius: 10px; font-size: 11px;">${a.prio_score}p</span>` : ''}
          </div>

          <!-- Body -->
          <div style="padding: 14px;">
            <div style="font-size: 16px; font-weight: 700; line-height: 1.35; margin-bottom: 6px; color: #ffffff; white-space: normal;">
              ${a.title}
            </div>
            
            <div style="font-size: 12px; color: #8292a8; margin-bottom: 12px; white-space: normal;">
              Publ: ${a.published || ''}
            </div>

            <div style="background: #0f1522; padding: 12px; border-radius: 8px; font-size: 13.5px; line-height: 1.5; color: #d6e2f0; border: 1px solid #202b40; margin-bottom: 12px; white-space: normal; word-break: break-word;">
              ${a.summary || ''}
            </div>

            <!-- Tags -->
            <div style="display: flex; flex-wrap: wrap; align-items: center; margin-bottom: 4px; white-space: normal;">
              <span style="background:#241e17; color:#f59e0b; border:1px solid #573807; font-size:11px; padding:3px 9px; border-radius:12px; margin-right:5px; margin-bottom:5px; font-weight:600; display:inline-block; white-space:nowrap;">
                ${a.category || ''}
              </span>
              ${tagsHtml}
            </div>
          </div>

          <!-- Bottom Footer -->
          <div style="background-color: #7c4dff; padding: 8px; text-align: center; font-size: 13px; font-weight: 600; color: #ffffff; white-space: normal;">
            Klicka för att öppna artikeln
          </div>
        </div>
      `;
    ]]]
```

#### 3. Automatisering: Direkta pushnotiser vid PRIO
Få direkta aviseringar i Home Assistant Companion-appen när en högprioriterad händelse publiceras:

```yaml
automation:
  - alias: "RSS Prio Händelselarm (Admin)"
    trigger:
      - platform: mqtt
        topic: "rss_bevakaren/admin/prio"
    action:
      - service: notify.notify
        data:
          title: "{{ trigger.payload_json.source }}: {{ trigger.payload_json.title }}"
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
      - MQTT_RETAIN=true
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
