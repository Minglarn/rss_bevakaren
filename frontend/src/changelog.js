export const CHANGELOG_DATA = [
  {
    version: '2026.09.24.18',
    date: '2026-09-24',
    title: 'Full bredd för bildursprung i ultrakompakt vy & åtgärdat trenddiagram',
    badge: 'Senaste',
    highlights: [
      {
        type: 'improvement',
        title: 'Metainformation utnyttjar hela ytan under artikelbilden',
        description: 'I den ultrakompakta vyn har metaraden (källa, bildursprung och ClickBait-indikator) flyttats så att den sträcker sig över hela kortets bredd direkt under rubrik och artikelbild. Detta eliminerar att långa källnamn och bildkällor klipps av med ellips på mobila skärmar.'
      },
      {
        type: 'fix',
        title: 'Korrigerat stapeldiagram för daglig trend och inflöde',
        description: 'Åtgärdat datastrukturen och beräkningen för 14-dagarsdiagrammet i statistikfliken så att staplarna med prio-nyheter, normala artiklar och ClickBait ritas ut fullständigt med korrekta höjder och veckodagar.'
      }
    ]
  },
  {
    version: '2026.09.24.17',
    date: '2026-09-24',
    title: 'Tydlig visning av bildursprung för artiklar',
    highlights: [
      {
        type: 'feature',
        title: 'Källhänvisning för kompletterande och redaktionella bilder',
        description: 'Artiklar visar nu transparent var bilden kommer ifrån i ultrakompakt vy, standardkort samt AI-detaljmodalen (t.ex. "Polisen · Bild: Wikimedia (Illustrativ)", "Bild: Unsplash (Illustrativ)" eller "Foto: Open Graph"). Originalbilder från RSS behåller ren källvisning utan onödig text.'
      },
      {
        type: 'improvement',
        title: 'Backend-spårning och databasstöd för bildkällor',
        description: 'Lagt till kolumnen image_source i artikeltabellen med automatiska migreringar och hantering i AI-bakgrundsprocesser och bildhämtningstjänster.'
      }
    ]
  },
  {
    version: '2026.09.24.16',
    date: '2026-09-24',
    title: 'Beständigt minne för kollapsade sektioner i inställningar',
    highlights: [
      {
        type: 'fix',
        title: 'Kollapsade och expanderade rutor sparas',
        description: 'Sektionernas tillstånd under flikarna Administratör (inklusive Användarkonton och behörigheter), Allmänt, Databas, AI och Statistik sparas nu automatiskt i webbläsarens lokala minne så att valda fällningslägen består mellan sidladdningar och flikbyten.'
      },
      {
        type: 'improvement',
        title: 'Synkroniserad backup och hantering av alla sektioner',
        description: 'Knapparna för att expandera och kollapsa alla sektioner synkroniseras nu direkt mot det sparade tillståndet, och inställningarna inkluderas i systemets fullständiga backupfil.'
      }
    ]
  },
  {
    version: '2026.09.24.15',
    date: '2026-09-24',
    title: 'Korrekt dygnsrytmvisualisering och visning av snitt AI-svarstid',
    highlights: [
      {
        type: 'fix',
        title: 'Korrekt timvisning och dygnsrytm',
        description: 'Åtgärdat datastrukturen och timetiketterna för 24-timmars dygnsrytm i statistikfliken. Staplarna mappar nu korrekt timme för timme (00–23) med tydlig visning av topptimme och aktuell timmarkör.'
      },
      {
        type: 'fix',
        title: 'Snitt AI-svarstid och sparade artiklar i KPI-översikten',
        description: 'Kopplat ihop mätvärdet för genomsnittlig AI-svarstid per artikel och antal sparade artiklar så att värdena läses in och visas korrekt i statistikens nyckeltalskort.'
      }
    ]
  },
  {
    version: '2026.09.24.14',
    date: '2026-09-24',
    title: 'Standardiserad engelsk AbuseIPDB-rapport i webbserverformat (CLF)',
    highlights: [
      {
        type: 'improvement',
        title: 'Engelskt rapportformat i Nginx/Apache CLF-stil',
        description: 'AbuseIPDB-rapporten har anpassats till AbuseIPDB:s globala standard i 100% ren engelska. Den genererar autentiska Combined Log Format (CLF)-rader med exakta tidsstämplar, HTTP-status, anropssökvägar och User-Agents.'
      },
      {
        type: 'feature',
        title: 'IoA Timestamp och flexibel kopiering i administratörsmodalen',
        description: 'Lagt till dedikerad IoA Timestamp (Europe/Stockholm) för direkt kopiering till AbuseIPDB:s attacktid-fält, samt snabbval för att antingen kopiera hela rapporten eller en enradig Nginx-loggrad.'
      }
    ]
  },
  {
    version: '2026.09.24.13',
    date: '2026-09-24',
    title: 'Förbättrad och träffsäker bildmatchning utan generiska felbilder',
    highlights: [
      {
        type: 'improvement',
        title: 'Strikt filtrering av Open Graph-bilder',
        description: 'Webbplatsers generiska delningsbanners, sidlogotyper och placeholders (t.ex. logo, default-share, placeholder) filtreras nu automatiskt bort så att endast äkta, artikelunika foton används.'
      },
      {
        type: 'improvement',
        title: 'Borttagning av generisk bildfallback',
        description: 'Eliminerat tidigare generiska sökningar som gav orelaterade Wikimedia-bilder (t.ex. Einstein-foton och diagram). Om artikeln saknar ett tydligt bildtema eller AI-sökord lämnas den utan bild med en ren typografisk layout och källans ikon.'
      },
      {
        type: 'fix',
        title: 'Automatisk sanering av tidigare felaktiga fallback-bilder',
        description: 'Systemet sanerar automatiskt bort tidigare generiska fallback-bilder ur databasen vid uppstart.'
      }
    ]
  },
  {
    version: '2026.09.24.12',
    date: '2026-09-24',
    title: 'AbuseIPDB-rapport för spärrade IP-adresser och expanderbar README',
    highlights: [
      {
        type: 'feature',
        title: 'AbuseIPDB-rapportunderlag för spärrade IP-adresser',
        description: 'Under Inställningar -> Säkerhet och IP-Jail finns nu knappen "Abuse-rapport" för varje spärrad IP. Den visar detaljerad historik över blockerade anrop (metod, sökväg och tidsstämpel), föreslagna AbuseIPDB-kategorier (t.ex. 18: Brute-Force, 19: Bad Web Bot, 21: Web App Attack), en färdigt formaterad kommentarstext för AbuseIPDB samt direktlänk till rapportformuläret.'
      },
      {
        type: 'documentation',
        title: 'Expanderbara sektioner i README',
        description: 'Hela Snabbstart med Docker Compose, Anslut lokal AI (Ollama & LM Studio) samt Home Assistant Integration har gjorts expanderbara för en renare och mer lättöverskådlig projektdokumentation.'
      }
    ]
  },
  {
    version: '2026.09.24.11',
    date: '2026-09-24',
    title: 'Automatisk bildkomplettering via Open Graph och lokal AI / Wikimedia',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk bildassociering för artiklar utan bild',
        description: 'Artiklar som saknar bild i RSS-flödet berikas nu automatiskt. Steg 1 hämtar artikelns redaktionella foto via Open Graph direkt från källan (t.ex. SVT Nyheter). Steg 2 använder lokal AI för att generera sökord och hämta en matchande fri nyhetsbild från Wikimedia Commons (t.ex. för Polisens händelserapporter).'
      },
      {
        type: 'feature',
        title: 'Styrning och retroaktiv bildkomplettering i Inställningar',
        description: 'Lagt till inställning för att slå på/av automatisk bildkomplettering samt en knapp under Inställningar -> AI för att direkt söka och koppla bilder till befintliga artiklar som saknar bild.'
      }
    ]
  },
  {
    version: '2026.09.24.10',
    date: '2026-09-24',
    title: 'Dokumentation av bot-skydd och säkerhetsarkitektur i README',
    highlights: [
      {
        type: 'documentation',
        title: 'Omfattande säkerhetsavsnitt i README',
        description: 'Lagt till en detaljerad genomgång av applikationens skydd mot botar, crawlers och sårbarhetsskannrar, inklusive honeypots, automatisk IP-bannlysning (IP-Jail), rate limiting och administratörsfunktioner.'
      }
    ]
  },
  {
    version: '2026.09.24.09',
    date: '2026-09-24',
    title: 'Nätverksisolering och skydd mot header-spoofing',
    highlights: [
      {
        type: 'improvement',
        title: 'Nätverksisolering av backend i Docker Compose',
        description: 'Backend-porten har isolerats till 127.0.0.1:8094 för att förhindra direktåtkomst från externa internet-klienter. All extern trafik styrs därmed säkert via Nginx reverse proxy.'
      },
      {
        type: 'improvement',
        title: 'Skydd mot header-spoofing med Trusted Proxies',
        description: 'FastAPI accepterar nu endast X-Real-IP och proxy-headers från betrodda interna nätverk och proxys. Direkta anslutningar från opålitliga nätverk tvingas använda sin faktiska socket-adress, vilket omöjliggör IP-förfalskning.'
      }
    ]
  },
  {
    version: '2026.09.24.08',
    date: '2026-09-24',
    title: 'Automatiskt IP-Jail och administratörsstöd för spärrade adresser',
    highlights: [
      {
        type: 'feature',
        title: 'Automatiskt IP-Jail mot botar och sårbarhetsskannrar',
        description: 'Implementerat automatisk spärrning (IP-Jail) som omedelbart bannlyser klienter i 60 minuter vid scanning efter känsliga filer (gcp-credentials, firebase-admin, .env m.fl.) samt vid upprepade misslyckade inloggningsförsök.'
      },
      {
        type: 'feature',
        title: 'Administratörspanel för IP-Jail & Säkerhet',
        description: 'Ny säkerhetssektion under Administratörsfliken med realtidsöversikt över spärrade IP-adresser, orsak, återstående spärrtid, blockerade förfrågningar samt möjlighet att manuellt spärra eller häva spärrar.'
      },
      {
        type: 'improvement',
        title: 'Tidig avvisning på middleware-nivå',
        description: 'Spärrade IP-adresser avvisas direkt i nätverkslagret med 403 Forbidden innan resurskrävande databasfrågor eller lösenordskryptering utförs, vilket skyddar serverns CPU mot överbelastning.'
      }
    ]
  },
  {
    version: '2026.09.24.07',
    date: '2026-09-24',
    title: 'Avdelare för första kortet och minimerad marginal i ultrakompakt flöde',
    highlights: [
      {
        type: 'improvement',
        title: 'Återställd avdelarlinje för första händelsekortet',
        description: 'Det första kortet i flödet har nu en fullständig avdelarlinje till vänster om tidsangivelsen i linje med övriga kort.'
      },
      {
        type: 'improvement',
        title: 'Minimerad marginal mellan tidsavdelare och rubrik',
        description: 'Trimmade marginaler och padding mellan avdelaren och artikelrubriken för en renare och mer sammanhållen ultrakompakt layout.'
      }
    ]
  },
  {
    version: '2026.09.24.06',
    date: '2026-09-24',
    title: 'Aktiv säkerhetsloggning av bot-skanningar och intrångsförsök',
    highlights: [
      {
        type: 'improvement',
        title: 'Synlig säkerhetsloggning i Nginx för alla sårbarhetsskanningar',
        description: 'Nginx loggar nu alla bot-skanningar och försök att komma åt känsliga filer (.env, gcp-credentials, certifikat och skript) direkt till stdout med besökarens faktiska IP-adress och statuskod 403 Forbidden.'
      },
      {
        type: 'improvement',
        title: 'Utökade honeypot-endpoints i backend',
        description: 'Lagt till bevakning för vanliga bot-vägar såsom /login, /admin/login, /wp-login.php och /administrator i backend med omedelbar säkerhetsloggning av klient-IP och User-Agent samt nekad åtkomst (403 Forbidden).'
      }
    ]
  },
  {
    version: '2026.09.24.05',
    date: '2026-09-24',
    title: 'Blockering av bot-skanningar och utökad säkerhetsloggning vid inloggningsförsök',
    highlights: [
      {
        type: 'improvement',
        title: 'Återställning av äkta klient-IP (Real IP)',
        description: 'Konfigurerat Nginx med real_ip för att återställa besökarens faktiska externa IP-adress bakom reverse proxies och Docker-nätverk istället för interna proxy-adresser.'
      },
      {
        type: 'improvement',
        title: 'Tyst avvisande av automatiserade bot-skanningar',
        description: 'Implementerat skydd i Nginx som tyst svarar 404 utan loggskräp när automatiserade sårbarhetsskannrar och botar letar efter känsliga filer som .env, gcp-credentials, firebase-admin eller servicekonton.'
      },
      {
        type: 'improvement',
        title: 'Säkerhetsloggning vid inloggningsförsök',
        description: 'Backend loggar nu strukturerade säkerhetsmeddelanden vid såväl misslyckade som lyckade inloggningsförsök med käll-IP, användarnamn och User-Agent för enkel identifiering av bot-angrepp och otillåtna intrångsförsök.'
      }
    ]
  },
  {
    version: '2026.09.24.04',
    date: '2026-09-24',
    title: 'Historisk infasning och kronologisk sortering vid import av nya flöden',
    highlights: [
      {
        type: 'improvement',
        title: 'Historisk tidsstämpling vid initial hämtning',
        description: 'Vid första inläsningen av ett nytt flöde sätts mottagningstiden till artikelns faktiska publiceringsdatum så att historiska artiklar placeras på sina rätta historiska datum i Omni-flödet istället för att klumpas ihop under dagens datum.'
      },
      {
        type: 'fix',
        title: 'Kronologisk sortering som tie-breaker',
        description: 'Både backend och frontend sorterar nu på publiceringsdatum i fallande ordning när mottagningstiden är identisk, vilket förhindrar att artiklar visas i omvänd tidsordning.'
      },
      {
        type: 'improvement',
        title: 'Tillåt de senaste artiklarna vid första flödeshämtning',
        description: 'Första hämtningen av ett flöde tillåter nu de 15 senaste artiklarna oavsett ålder så att flöden med låg publiceringsfrekvens inte förblir tomma.'
      }
    ]
  },
  {
    version: '2026.09.24.03',
    date: '2026-09-24',
    title: 'Tidsangivelse synlig för flödets första händelsekort',
    highlights: [
      {
        type: 'fix',
        title: 'Tidsvisning för första händelsen',
        description: 'Säkerställt att tiden visas konsekvent till höger ovanför det första kortet i flödet utan att rita ut en överflödig avdelarlinje mot sidans topp.'
      }
    ]
  },
  {
    version: '2026.09.24.02',
    date: '2026-09-24',
    title: 'Optimerad marginal och utnyttjad bredd för fördjupad sammanfattning',
    highlights: [
      {
        type: 'improvement',
        title: 'Minimerad marginal under tidsavdelaren',
        description: 'Minskat avståndet mellan den inre tidsavdelaren och det expanderade innehållet för ett renare och mer kompakt utseende utan onödig tom yta.'
      },
      {
        type: 'improvement',
        title: 'Återställd enhetlig ram och optimerad textbredd',
        description: 'Tog bort den kraftiga vänsterbården och återställde en diskret enhetlig ram runt sammanfattningsrutan, samtidigt som intern padding trimmats så att texten fyller ut hela boxens bredd och höjd.'
      }
    ]
  },
  {
    version: '2026.09.24.01',
    date: '2026-09-24',
    title: 'Förbättrad placering av tidsavdelare och sömlös fördjupad sammanfattning',
    highlights: [
      {
        type: 'improvement',
        title: 'Tidsavdelare flyttad inuti kortet i ultrakompakt läge',
        description: 'Tid och datum placeras nu konsekvent på den inre avdelaren direkt under kortets ingress och källa, så att tidsangivelsen inte trycks ner under åtgärdsknapparna när kortet expanderas.'
      },
      {
        type: 'improvement',
        title: 'Minimerad ruta-i-ruta-effekt för fördjupad sammanfattning',
        description: 'Fördjupad sammanfattning har omdesignats från en sluten låda med ramar och inre skuggor till en modern och sömlös callout med elegant vänsteraccent i orange och luftig typografi.'
      }
    ]
  },
  {
    version: '2026.09.23.25',
    date: '2026-09-23',
    title: 'Städning och optimering av projektstruktur',
    highlights: [
      {
        type: 'improvement',
        title: 'Borttagning av överflödiga filer och mallar',
        description: 'Tog bort det föråldrade testskriptet test_sqla.py, oanvänd standardmall för App.css och Vite-ikoner i assets-katalogen, den tomma databasfilen backend/rss_bevakaren.db samt frontend/README.md för ett rent och optimerat repository.'
      }
    ]
  },
  {
    version: '2026.09.23.24',
    date: '2026-09-23',
    title: 'Dokumentation av samtliga miljövariabler och uppdaterad embedding-modell',
    highlights: [
      {
        type: 'improvement',
        title: 'Uppdaterad rekommenderad embedding-modell',
        description: 'Rekommenderad modell för vektor-embeddings och semantisk klustring har uppdaterats till text-embedding-baai-bge-m3-568m för överlägsen svensk språkförståelse, med nomic-embed-text kvar som resurssnålt alternativ.'
      },
      {
        type: 'improvement',
        title: 'Komplett specifikation av miljövariabler i docker-compose och dokumentation',
        description: 'Samtliga miljövariabler har dokumenterats i docker-compose.yml och README.md, inklusive APP_ADMIN_USER, AI_EMBEDDING_MODEL, AI_MAX_TOKENS samt MQTT Auto-Discovery-inställningar.'
      }
    ]
  },
  {
    version: '2026.09.23.23',
    date: '2026-09-23',
    title: 'Dold redundant datumavgränsare i ultrakompakt flöde',
    highlights: [
      {
        type: 'improvement',
        title: 'Borttagen överflödig datumbanner i ultrakompakt läge',
        description: 'Dold datumavgränsaren i toppen av flödesgrupperna när ultrakompakt layout används, eftersom varje artikelkort redan har fullständig och integrerad tidsinformation i sin egen avdelare.'
      }
    ]
  },
  {
    version: '2026.09.23.22',
    date: '2026-09-23',
    title: 'Åtgärdad dubbelram runt notiser och förenklad rendering',
    highlights: [
      {
        type: 'fix',
        title: 'Eliminerat dubbla ramar runt notiser',
        description: 'Tog bort överflödig wrapper-div och rensade CSS-selektorer kring Toaster så att notisen visas som en enda ren och snygg ruta med direkt klickstängning.'
      }
    ]
  },
  {
    version: '2026.09.23.21',
    date: '2026-09-23',
    title: 'Toaster flyttad till toppen, dämpat pollingbrus och lyft bottenmeny',
    highlights: [
      {
        type: 'improvement',
        title: 'Notiser flyttade till toppen med direkt klick-avfärdning',
        description: 'Flyttade alla toasts till skärmens överkant (top-center) så att artiklar och klickzoner i flödet aldrig blockeras. Notiser kan nu även avfärdas direkt vid klick.'
      },
      {
        type: 'improvement',
        title: 'Tyst bakgrundssynk utan popup-brus',
        description: 'Dämpade de frekventa "Söker: [flöde]"-notiserna vid automatisk bakgrundspolling. Status visas diskret via puls-indikatorn och notiser visas endast när faktiska nya artiklar anländer.'
      },
      {
        type: 'improvement',
        title: 'Upplyft bottenmeny och utökat säkerhetsavstånd mot skärmkant',
        description: 'Ökade höjden på mobilens bottenmeny och flyttade upp navigeringsikonerna ca 10–12 px med säkerhetsmarginal mot mobilens hem-gest-fält för att förhindra oavsiktlig app-stängning.'
      }
    ]
  },
  {
    version: '2026.09.23.20',
    date: '2026-09-23',
    title: 'Modern och animerad laddningsupplevelse för nyhetsflödet',
    highlights: [
      {
        type: 'improvement',
        title: 'Animerad och elegant laddningsvy',
        description: 'Ersatte den tidigare enkla texten "Laddar nyheter..." med ett modernt, centrerat laddningskort med pulserande ikon, dynamisk shimmer-progressbar, animerade steg och studsande punkter för "Snart klar...".'
      },
      {
        type: 'feature',
        title: 'Förhandsvisning med pulserande artikel-skelett',
        description: 'Lade till eleganta skeleton-kort som pulserar i takt medan nyheter hämtas och analyseras, vilket ger en omedelbar och professionell känsla vid uppstart och byte av vyer.'
      }
    ]
  },
  {
    version: '2026.09.23.19',
    date: '2026-09-23',
    title: 'Justering av ultrakompakta avstånd och robust paginering',
    highlights: [
      {
        type: 'fix',
        title: 'Minskat och balanserat mellanrum i ultrakompakt vy',
        description: 'Justerade padding och marginaler kring den inbäddade avdelaren i det ultrakompakta läget så att onödigt tomrum under linjen elimineras och ger ett jämnt, harmoniskt avstånd mellan artiklarna.'
      },
      {
        type: 'fix',
        title: 'Robust paginering och obegränsad scroll bakåt i tiden',
        description: 'Åtgärdade beräkningen av databas-offset vid klustrade nyheter samt tog bort för tidig avslutning av flödet, vilket gör att äldre artiklar nu kan laddas in oavbrutet utan att flödet stannar mitt på dagen.'
      }
    ]
  },
  {
    version: '2026.09.23.18',
    date: '2026-09-23',
    title: 'Strukturerad Intresseprofil, inbäddat datum i avdelare och buggfix',
    highlights: [
      {
        type: 'improvement',
        title: 'Strukturerad Intresseprofil med dragspelssektioner',
        description: 'Intresseprofilen i inställningarna har byggts om till samma enhetliga layout som övriga flikar med sektioner för översikt & nyckeltal, aktiva intresseämnen, dämpade ämnen, kategoribalans och röstningshistorik.'
      },
      {
        type: 'feature',
        title: 'Inbäddat datum direkt i den horisontella avdelaren',
        description: 'I det ultrakompakta flödesläget har publiceringsdatumet flyttats ner och integrerats direkt i den horisontella avdelaren mellan artiklarna, vilket frigör raden för källnamnet.'
      },
      {
        type: 'fix',
        title: 'Åtgärdad referens i statistikpanelen',
        description: 'Löste ett ReferenceError för maxSourceCount som orsakade krasch vid visning av källvolymer i Statistikfliken.'
      }
    ]
  },
  {
    version: '2026.09.23.17',
    date: '2026-09-23',
    title: 'Statistikpanel i inställningar, nattlig purge-notis och tidslinjering',
    highlights: [
      {
        type: 'feature',
        title: 'Ny flik för Statistik & Insikter',
        description: 'Översikt med KPI-kort, dagligt artikelflöde senaste 14–30 dagarna med prioritetsfärgkodning, dygnsrytm (24h), kategoriandelar och mest aktiva källor.'
      },
      {
        type: 'feature',
        title: 'Nattlig purge-notis till administratör',
        description: 'Automatisk web-push-notis till administratören kl. 03:00 som rapporterar resultat från schemalagd rensning, frigjort utrymme och aktuell databasstatus.'
      },
      {
        type: 'fix',
        title: 'Sammansatt rad för tidsstämpel i ultrakompakt läge',
        description: 'Källnamnet, avgränsaren och tidsangivelsen hålls nu strikt ihop på samma rad med mjuk trunkering på smala mobilskärmar så att tiden inte knuffas ner.'
      }
    ]
  },
  {
    version: '2026.09.23.16',
    date: '2026-09-23',
    title: 'Standardiserad och kolumnanpassad loggformatering i backend',
    highlights: [
      {
        type: 'improvement',
        title: 'Spikrak kolumnlinjering för systemloggar',
        description: 'Loggprefix och taggar i hakparenteser har standardiserats med fast bredd så att artikel- och systemmeddelanden startar på exakt samma kolumn oavsett användarnamn eller tjänst.'
      },
      {
        type: 'fix',
        title: 'Kompakt och enhetlig tagghantering',
        description: 'AI Embeddings har kortats ner till AI Embed och loggtaggarna formateras automatiskt med jämn utfyllnad för användare med olika namnlängder (t.ex. admin och mari).'
      }
    ]
  },
  {
    version: '2026.09.23.15',
    date: '2026-09-23',
    title: 'Enhetlig och strukturerad sektionsdesign i samtliga inställningsflikar',
    highlights: [
      {
        type: 'improvement',
        title: 'Konsekvent dragspelsstruktur i inställningarna',
        description: 'Övriga inställningsflikar (Gränssnitt, Databas & Underhåll, Notiser, AI & Analys samt Administratörspanelen) har nu strukturerats om enligt samma eleganta modell som fliken Allmänt. Varje sektion har en enhetlig header, statusbricka, ikon och snabbkontroll för att expandera eller kollapsa alla sektioner.'
      },
      {
        type: 'improvement',
        title: 'Överskådligare och snabbare navigering',
        description: 'Minskat vertikalt rullande och tydligare gruppering av inställningar, funktioner och verktyg.'
      }
    ]
  },
  {
    version: '2026.09.23.14',
    date: '2026-09-23',
    title: 'Google News-modell för klustrade artiklar',
    highlights: [
      {
        type: 'feature',
        title: 'Öppen Google News-täckning i flödet',
        description: 'Klustrade artiklar döljs inte längre i bakgrunden. Istället visas en dedikerad Google News-sektion med full täckning, källikoner, källnamn, unika rubriker och direktlänkar i både ultrakompakt och standardlayout.'
      },
      {
        type: 'improvement',
        title: 'Direkt översikt över alternativa vinklar',
        description: 'Du ser direkt vilka andra medier och nyhetskällor som rapporterar om samma händelse utan att behöva öppna dolda menyer.'
      }
    ]
  },
  {
    version: '2026.09.23.13',
    date: '2026-09-23',
    title: 'Solid och ogenomskinlig bakgrund i bottenbaren',
    highlights: [
      {
        type: 'improvement',
        title: 'Helt opak och solid bottenbar',
        description: 'Ersatt halvtransparent bakgrund och suddfilter (blur) med 100 % solid bakgrund i mobilens bottenbar (vitt i ljust läge och skiffergrått i mörkt läge). Text och bilder från bakomliggande artiklar lyser inte längre igenom vid scrollning.'
      }
    ]
  },
  {
    version: '2026.09.23.12',
    date: '2026-09-23',
    title: 'Avlägsnad indikatorlinje i bottenbaren',
    highlights: [
      {
        type: 'improvement',
        title: 'Renare bottenbar utan kolliderande topplinje',
        description: 'Tog bort det horisontella strecket ovanför aktiva knappar i mobilens bottenbar. Detta eliminerar visuell krock med indikatorpricken (Badge Dot) och ger en ren, modern och minimalistisk navigationsupplevelse.'
      }
    ]
  },
  {
    version: '2026.09.23.11',
    date: '2026-09-23',
    title: 'Stilrena indikatorprickar och fullständig avveckling av scroll-spårning',
    highlights: [
      {
        type: 'feature',
        title: 'Diskret indikatorprick istället för sifferpanik',
        description: 'I Omni-läget ersätts sifferbrickorna med rena, diskreta accentfärgade indikatorprickar på RSS- och PRIO-ikonerna. Pricken tänds när nya artiklar anlänt sedan förra besöket och släcks automatiskt när du scrollar förbi tidsavdelaren.'
      },
      {
        type: 'improvement',
        title: 'Avvecklade NY-piller för 100 % jank-fritt flöde',
        description: 'Tidsavdelaren Tidigare artiklar markerar gränsen mellan nya och äldre artiklar. Genom att ta bort individuella NY-piller och all per-kort-spårning renderas flödet helt statiskt under scrollning, vilket ger perfekt 60-120 FPS utan mikrostammande.'
      },
      {
        type: 'fix',
        title: 'Eliminerade kapplöpningar och spökbrickor',
        description: 'All komplex hantering av individuella artikel-ID:n i minnet och sessionslagringen har ersatts med ren referenstidslogik mot tidsavdelaren. Skärmuppdateringar och bakgrunds-WebSockets orsakar inte längre att tidigare sedda nyheter felaktigt markeras som nya.'
      }
    ]
  },
  {
    version: '2026.09.23.10',
    date: '2026-09-23',
    title: 'Silkeslen scrollning och bibehållen sessionsstatus vid skärmuppdatering',
    highlights: [
      {
        type: 'fix',
        title: 'Eliminerat scroll-hack vid nya artiklar',
        description: 'Optimerat IntersectionObserver och avvecklat onödiga React-omrenderingar under scrollning. Sedda artiklar batchas och observern rivs inte längre ner för varje passerat kort, vilket ger en silkeslen scrollning i full bildfrekvens.'
      },
      {
        type: 'fix',
        title: 'Bibehållna sedda artiklar vid pull-to-refresh',
        description: 'Sedda artiklar persisteras nu under pågående session i sessionslagringen knutet till aktuell referenstid. Skärmuppdatering (dra ned och släpp) återställer inte längre NY-pillret eller sifferbrickan för redan genomgångna artiklar.'
      },
      {
        type: 'improvement',
        title: 'Säker avregistrering av sessionsavdelaren',
        description: 'Sessionsavdelaren för tidigare artiklar avregistreras omedelbart när den passerats uppåt, vilket förhindrar upprepade sessionsnollställningar vid fram- och tillbakascrollning.'
      }
    ]
  },
  {
    version: '2026.09.23.09',
    date: '2026-09-23',
    title: 'Oändlig scroll för historik och synkroniserad sifferbricka',
    highlights: [
      {
        type: 'feature',
        title: 'Oändlig scrollning bakåt i tiden',
        description: 'Implementerat äkta server-paginering i flödet. Du kan nu scrolla oändligt bakåt i tiden och läsa gårdagens, förrgårdagens och veckans artiklar utan att det tar stopp efter de första artiklarna.'
      },
      {
        type: 'fix',
        title: 'Synkroniserad sifferbricka och NY-märkning',
        description: 'Sifferbrickan (+X) i bottenbaren och sidomenyn är nu direkt kopplad till det faktiska antalet artiklar med NY-märkning på skärmen. Nollställning sker automatiskt när du passerar avdelaren och är ikapp med flödet.'
      },
      {
        type: 'improvement',
        title: 'Begränsning av historiska nya nyheter',
        description: 'Vid längre frånvaro begränsas referenstiden för nya artiklar till max 4 timmar så att inte flera dygns gamla artiklar ackumuleras som nya i sifferbrickan.'
      }
    ]
  },
  {
    version: '2026.09.23.08',
    date: '2026-09-23',
    title: 'Korrigerad nedräkning för NYA artiklar och synkat PRIO-flöde',
    highlights: [
      {
        type: 'fix',
        title: 'Korrigerad avräkning för NYA artiklar (+X)',
        description: 'Åtgärdat fel där antalet nya artiklar raderades vid klick på RSS- eller PRIO-fliken. Sessionens referenstid nollställs nu inte vid vanlig navigering utan artiklarna räknas ner dynamiskt när användaren scrollar förbi dem.'
      },
      {
        type: 'fix',
        title: 'Bibehållen NY-märkning och klockdrifttolerans',
        description: 'Nya artiklar behåller nu sitt NY-piller tills de faktiskt scrollas förbi eller expanderas. Tidsjämförelsen har försetts med 60 sekunders buffert mot klockdifferenser mellan server och klient.'
      },
      {
        type: 'feature',
        title: 'PRIO-flödet anpassat till sessionsreglerna',
        description: 'PRIO-flödet i Omni-läget visar nu sifferbricka med antalet nya prio-artiklar (+X) och synkar nedräkning och Seen on scroll på samma sätt som nyhetsflödet.'
      }
    ]
  },
  {
    version: '2026.09.23.07',
    date: '2026-09-23',
    title: 'Korrigerad initieringsordning i flödesvyn',
    highlights: [
      {
        type: 'fix',
        title: 'Korrigerad hook-initiering för Seen on scroll',
        description: 'Åtgärdat ett initieringsfel (ReferenceError TDZ) i Dashboard där effekten för IntersectionObserver refererade till artikellistan innan dess useMemo-block hade utvärderats.'
      }
    ]
  },
  {
    version: '2026.09.23.06',
    date: '2026-09-23',
    title: 'Kollapsade sektioner i Allmänt samt Seen-on-scroll avräkning',
    highlights: [
      {
        type: 'feature',
        title: 'Kollapsade sektioner i Inställningar -> Allmänt',
        description: 'Samtliga sektioner under fliken Allmänt (Applikationsläge, Systeminformation & Felsökning, Ändringslogg, Installationsguide samt Konto & Utloggning) presenteras nu som eleganta kollapsbara kort. Detta eliminerar onödig vertikal scrollning och ger en ren, samlad överblick.'
      },
      {
        type: 'feature',
        title: 'Seen on scroll - dynamisk avräkning vid läsning',
        description: 'När artiklar med NY-märkning passeras under scrollning kvitteras de direkt som sedda. Deras NY-märkning tonas bort och sifferindikatorn på RSS-ikonen och i sidomenyn räknas automatiskt ner i realtid.'
      },
      {
        type: 'improvement',
        title: 'RSS-ikon i mobilens bottenmeny och mjuk återställning',
        description: 'Den tidigare hus-ikonen i bottenmenyn har ersatts av vår RSS-ikon. Ett klick på ikonen när användaren redan befinner sig i flödet scrollar mjukt till toppen och nollställer sessionens referenstid.'
      }
    ]
  },
  {
    version: '2026.09.23.05',
    date: '2026-09-23',
    title: 'Sortering efter hämtningstidpunkt i Omni-läget',
    highlights: [
      {
        type: 'feature',
        title: 'Hämtningstidpunkt styr flödet i Omni-läget',
        description: 'I Nyhetsbevakaren (Omni-läget) sorteras artiklar nu efter tidpunkten de togs emot av systemet istället för källans publiceringstid. Nya artiklar hamnar alltid överst i flödet även om källan publicerade med äldre tidsstämpel.'
      },
      {
        type: 'improvement',
        title: 'Synkroniserade dagsgrupper och sessionsavdelare',
        description: 'Dagsgrupperingar och tidsavgränsaren för tidigare artiklar styrs nu konsekvent av hämtningstidpunkten, vilket garanterar att alla nya artiklar samlas överst före avgränsaren.'
      }
    ]
  },
  {
    version: '2026.09.23.04',
    date: '2026-09-23',
    title: 'Återställda och mörkare avdelare i artikelflödet',
    highlights: [
      {
        type: 'fix',
        title: 'Återställda avdelare i flödet',
        description: 'Säkerställt att kortbehållaren alltid bevaras intakt oavsett om svepgester är aktiverade eller inte, så att avgränsningslinjerna mellan artiklar aldrig faller bort.'
      },
      {
        type: 'improvement',
        title: 'Starkare och mörkare kontrast',
        description: 'Avdelarna mellan artiklarna i ultrakompakt läge och datumavgränsarna har uppdaterats med en betydligt mörkare och skarpare kontrastfärg för tydlig och ren visuell separation.'
      }
    ]
  },
  {
    version: '2026.09.23.03',
    date: '2026-09-23',
    title: 'Åtgärd för artikelvisning och inaktiverade svepgester i Omni-läge',
    highlights: [
      {
        type: 'fix',
        title: 'Fullständig artikelhämtning i Omni-läge',
        description: 'Åtgärdat en logisk tankevurpa där lästa artiklar tidigare filtrerades bort av servern i Omni-läget trots att läststatus inte används. Flöden med nya artiklar visar nu alltid samtliga artiklar som avsett.'
      },
      {
        type: 'fix',
        title: 'Inaktiverade svepgester i Omni-läge',
        description: 'Svepgester (swipe) i sidled för att markera artiklar som lästa/olästa är nu strikt inaktiverade i Omni-läget för att förhindra oavsiktlig borttagning av artiklar ur nyhetsflödet.'
      },
      {
        type: 'improvement',
        title: 'Anpassade meddelanden för tomma flöden',
        description: 'Meddelanden för flöden utan artiklar har anpassats för att inte referera till lästa eller olästa artiklar när applikationen körs i Omni-läge.'
      }
    ]
  },
  {
    version: '2026.09.23.02',
    date: '2026-09-23',
    title: 'Möjlighet att läsa skrapad fulltext i ultrakompakt läge',
    highlights: [
      {
        type: 'feature',
        title: 'Hämtad artikeltext i expanderat läge',
        description: 'I det ultrakompakta flödesläget kan du nu enkelt fälla ut och läsa hela den skrapade originaltexten direkt i kortet under den fördjupade sammanfattningen.'
      },
      {
        type: 'improvement',
        title: 'Direktvisning och on-demand skrapning',
        description: 'Artiklar som redan är förskrapade visas omedelbart utan väntetid. För övriga artiklar hämtas och extraheras texten direkt vid behov med en tydlig laddningsindikator.'
      }
    ]
  },
  {
    version: '2026.09.23.01',
    date: '2026-09-23',
    title: 'Nyhetsbevakare (Omni-läge) och automatisk sessionsspårning',
    highlights: [
      {
        type: 'feature',
        title: 'Nyhetsbevakare (Omni-läge) som standard',
        description: 'Ett levande nyhetsflöde där du slipper inkorgsstress och manuell avprickning av lästa artiklar. Applikationen håller automatiskt koll på antalet nya artiklar sedan ditt förra besök och presenterar dem med diskreta +X-indikatorer.'
      },
      {
        type: 'feature',
        title: 'Spara och bokmärk artiklar',
        description: 'I Omni-läget ersätts den traditionella läst/oläst-knappen med en smidig spara- och bokmärkesfunktion som gör det enkelt att spara intressanta nyheter att återkomma till.'
      },
      {
        type: 'feature',
        title: 'Automatisk sessionsnollställning och tidsavgränsare',
        description: 'Nya artiklar markeras med en NY-bricka och en visuell avgränsare visar var du senast var i flödet. Sessionen nollställs automatiskt vid inaktivitet utan att kräva manuella knapptryck.'
      },
      {
        type: 'improvement',
        title: 'Valbart driftläge i Inställningar',
        description: 'Under Inställningar -> Allmänt kan du när som helst växla mellan Nyhetsbevakare (Omni-läge) och Klassisk RSS-läsare.'
      }
    ]
  },
  {
    version: '2026.09.22.09',
    date: '2026-09-22',
    title: 'Fix för semantisk rankinglogg i AI-Chatten',
    highlights: [
      {
        type: 'fix',
        title: 'Fixat variabelreferens vid adaptiv tröskelberäkning',
        description: 'Åtgärdat ett undantag i loggutskriften för den adaptiva tröskeln som tidigare orsakade fallback till standardfiltrering. Den adaptiva tröskeln fungerar nu som avsett vid alla AI-chattförfrågningar.'
      }
    ]
  },
  {
    version: '2026.09.22.08',
    date: '2026-09-22',
    title: 'Synkronisering av versionsspårbarhet och adaptiv källfiltrering',
    highlights: [
      {
        type: 'fix',
        title: 'Versionsspårbarhet i Docker och gränssnitt',
        description: 'Uppdaterat versionsnummer i package.json och backend så att rätt CalVer visas i Docker-uppstartsloggen, systeminställningarna och uppdateringsmodalen.'
      },
      {
        type: 'feature',
        title: 'Adaptiv semantisk tröskel i AI-Chatten',
        description: 'Relevanströskeln beräknas nu dynamiskt per anrop (medelvärde + 0,5 × standardavvikelse). Det eliminerar irrelevanta artiklar i källistan och fungerar oavsett embedding-modell.'
      }
    ]
  },
  {
    version: '2026.09.22.07',
    date: '2026-09-22',
    title: 'Adaptiv källfiltrering i AI-Chatten',
    highlights: [
      {
        type: 'fix',
        title: 'Irrelevanta artiklar visas inte langre som kallor',
        description: 'AI-Chatten visade tidigare upp till 25 artiklar som "Källor" aven om de flesta var orelaterade till fragan. Kallistan innehaller nu enbart artiklar med genuin semantisk likhet till fragan.'
      },
      {
        type: 'feature',
        title: 'Adaptiv troskel – fungerar med alla embedding-modeller',
        description: 'Relevanströskeln beraknas nu dynamiskt per anrop som medelvarde + 0,5 × standardavvikelse av alla sim_scores i kandidatpoolen. Det innebar att tröskeln automatiskt anpassar sig oavsett vilken embedding-modell som anvands (t.ex. bge-m3, nomic-embed eller framtida modeller) och logglas tydligt i Docker-loggen for sparbarhet.'
      },
      {
        type: 'improvement',
        title: 'Semantisk precision kvar vid nyckelordstraffar',
        description: 'Artiklar med direkt nyckelordsmatch tillats passera om sim_score ar minst 80% av tröskeln – sa att relevanta artiklar inte missas nar fragordet forekommer ordagrant i rubrik eller sammanfattning.'
      }
    ]
  },
  {

    version: '2026.09.22.06',
    date: '2026-09-22',
    title: 'Embedding-halsokontroll synlig i Docker-loggen',
    highlights: [
      {
        type: 'feature',
        title: 'Embedding-kontroll loggas vid uppstart',
        description: 'Backend loggar nu automatiskt vid uppstart om embedding-modellen svarar korrekt. I Docker-loggen syns endpoint-URL, modellnamn, vektordimensioner och svarstid i ms direkt under [AI Embeddings]-taggen.'
      },
      {
        type: 'improvement',
        title: 'Per-artikel embedding-logg',
        description: 'Varje gang en artikel vektoriseras syns nu en loggad i realtid: artikel-ID, vektordimensioner och rubrik. Detta gor det enkelt att foljda att embedding-floden fungerar korrekt.'
      },
      {
        type: 'improvement',
        title: 'Batch-vektorisering loggas',
        description: 'Nar gamla artiklar utan embedding behandlas i batch loggas nu antal artiklar, vektordimensioner och totalt antal sparade vektorer per omgang.'
      }
    ]
  },
  {
    version: '2026.09.22.05',
    date: '2026-09-22',
    title: 'Driftsäker paginering och fix för infinite scroll i mobil PWA',
    highlights: [
      {
        type: 'fix',
        title: 'Åtgärdat fastnande vid scroll i mobil PWA',
        description: 'Ersatt den tidigare instabila scroll-observern med en dubblerad mekanism bestående av en stabil sentinel-observer och scroll-fallback. Alla olästa artiklar laddas nu in omedelbart utan att stanna på en snurrande cirkel.'
      },
      {
        type: 'improvement',
        title: 'Ökad initial visningsmängd',
        description: 'Ökat antalet initialt visade artiklar från 30 till 60 så att normalstora flöden är fullt tillgängliga direkt vid sidladdning utan fördröjning.'
      }
    ]
  },
  {
    version: '2026.09.22.04',
    date: '2026-09-22',
    title: 'Vit bakgrundspanel och fullbreddsbild i ultrakompakt läge',
    highlights: [
      {
        type: 'improvement',
        title: 'Vit bakgrundspanel på mobil skärm',
        description: 'Det ultrakompakta flödet på mobil har nu samma eleganta vita bakgrundspanel som på datorn. Detta ger distinkta avgränsningar och eliminerar den blåvita bakgrundstonen.'
      },
      {
        type: 'feature',
        title: 'Bild expanderas till full artikelbredd',
        description: 'När ett ultrakompakt artikelkort fälls ut döljs den lilla thumbnailen och bilden expanderas i full bredd högst upp i den utfällda vyn.'
      },
      {
        type: 'improvement',
        title: 'Fokuserad fördjupad sammanfattning vid expansion',
        description: 'Vid expansion av ett ultrakompakt kort visas nu direkt den fördjupade AI-sammanfattningen tillsammans med den expanderade bilden och åtgärdsknappar, utan tung och onödig laddning av hela artikeltexten.'
      }
    ]
  },
  {
    version: '2026.09.22.03',
    date: '2026-09-22',
    title: 'Stöd för vattenfalls-layout i skrivbordsläge för ultrakompakt flöde',
    highlights: [
      {
        type: 'fix',
        title: 'Korrekt layoutprioritet för datorflödet',
        description: 'Datorläget prioriterar nu alltid kompakt vattenfall som standard och överskuggas inte längre av eventuella sparade mobilpreferenser.'
      },
      {
        type: 'feature',
        title: 'Fullt vattenfall- och kolumnstöd för ultrakompakt flöde på desktop',
        description: 'När ultrakompakt flöde används på dator med 2, 3 eller 4 kolumner fördelas artiklarna nu i eleganta vattenfalls-kolumner som fyller hela skärmbredden istället för en smal spalt.'
      }
    ]
  },
  {
    version: '2026.09.22.02',
    date: '2026-09-22',
    title: 'Förbättringar i ultrakompakt läge: styckeindelning och skärpa',
    highlights: [
      {
        type: 'improvement',
        title: 'Bevarad styckeindelning och radbrytningar vid expansion',
        description: 'Artiklar som fälls ut i det ultrakompakta läget bevarar nu originalets alla styckeavstånd och radbrytningar (pre-line) istället för att flyta ihop till en massiv textklump.'
      },
      {
        type: 'improvement',
        title: 'Kraftigare och tydligare avdelare',
        description: 'Skiljelinjen mellan artiklarna i det ultrakompakta läget har gjorts distinktare och kraftigare för ett renare tidningsliknande flöde.'
      },
      {
        type: 'improvement',
        title: 'Optimal kontrast och skärpa för lästa artiklar',
        description: 'Justerat opaciteten för lästa artiklar från 55% till 85% samt dämpat rubrikfärgen så att texten förblir skarp och behaglig att läsa utan att bli transparent.'
      }
    ]
  },
  {
    version: '2026.09.22.01',
    date: '2026-09-22',
    title: 'Ultrakompakt artikelkort och enhetsseparerad flödeslayout',
    highlights: [
      {
        type: 'feature',
        title: 'Nytt ultrakompakt artikelkort för mobilen',
        description: 'Ett stilrent och ultrakompakt kortformat med fet rubrik, kort notissammanfattning (ai_short_summary), relativ publiceringstid och kvadratisk bild-thumbnail till höger i ren radlayout.'
      },
      {
        type: 'feature',
        title: 'Oberoende layoutval för mobil och dator',
        description: 'Möjlighet att välja olika flödeslayouter för mobil och dator på samma användarkonto. Mobilskärmar kan nu exempelvis använda ultrakompakt läge medan datorn visar kompakt vattenfall.'
      }
    ]
  },
  {
    version: '2026.09.21.11',
    date: '2026-09-21',
    title: 'Förenklad loggning för MQTT Auto-Discovery',
    highlights: [
      {
        type: 'improvement',
        title: 'Kompakt och ren loggning vid Home Assistant Auto-Discovery',
        description: 'Tog bort enskilda loggrader för varje publicerat RSS-flöde och prio-sensor vid MQTT-anslutning. Loggningen sammanfattas nu med en ren bekräftelserad att Auto-Discovery är OK.'
      }
    ]
  },
  {
    version: '2026.09.21.10',
    date: '2026-09-21',
    title: 'Admin-hantering av flöden och steglöst reglage för ordgräns i sammanfattningar',
    highlights: [
      {
        type: 'feature',
        title: 'Administration av flöden per användare',
        description: 'Administratörer kan nu visa, lägga till och ta bort RSS-flöden direkt för andra registrerade användare i systemet via Admin-fliken.'
      },
      {
        type: 'improvement',
        title: 'Mjukt och steglöst ordgräns-reglage (5 till 50 ord)',
        description: 'Reglaget för max antal ord i korta AI-sammanfattningar stöder nu finjustering från 5 till 50 ord i steg om 1 ord, kompletterat med snabbvalsknappar för 5, 10, 20, 35 och 50 ord.'
      }
    ]
  },
  {
    version: '2026.09.21.09',
    date: '2026-09-21',
    title: 'Förbättrad flödesikonavkänning och stöd för RSS-underdomäner och medie-CDN',
    highlights: [
      {
        type: 'improvement',
        title: 'Korrekt hantering av tekniska underdomäner',
        description: 'Favicon-tjänster anropas nu mot sajtens huvuddomän när flödeslänkar använder tekniska underdomäner som feeds.*, vilket eliminerar 404-fel för källor som Ars Technica och BBC News.'
      },
      {
        type: 'fix',
        title: 'Smartare mediadomän- och CDN-validering',
        description: 'Säkerhetskontrollen för sparade flödesikoner godkänner nu officiella mediadomäner och bildnätverk som bbcimg.co.uk utan att felaktigt markera dem som felmatchade.'
      }
    ]
  },
  {
    version: '2026.09.21.08',
    date: '2026-09-21',
    title: 'Korrigering av inställning för max ordgräns i korta AI-sammanfattningar',
    highlights: [
      {
        type: 'fix',
        title: 'Beständighet för gränsen för korta sammanfattningar',
        description: 'Åtgärdat problem där reglaget för max antal ord och meningar i korta notiser återställdes till standardvärdet (20 ord) när övriga AI-inställningar sparades eller uppdaterades.'
      },
      {
        type: 'improvement',
        title: 'Mjukare reglage och direkta snabbval',
        description: 'Skjutreglaget för antal ord har frikopplats från blockerande nätverksanrop under dragning, och snabbknappar för 10 ord, 20 ord och 45 ord har lagts till för omedelbara val.'
      }
    ]
  },
  {
    version: '2026.09.21.07',
    date: '2026-09-21',
    title: 'Ollama driftoptimering och minskat loggbrus vid AI-inferens',
    highlights: [
      {
        type: 'improvement',
        title: 'Dokumentation och driftoptimering för Ollama',
        description: 'Utförlig dokumentation för miljövariablerna OLLAMA_KEEP_ALIVE=-1 och OLLAMA_MAX_LOADED_MODELS=2 för att motverka oavsiktliga urladdningar av modeller och VRAM-växling.'
      },
      {
        type: 'improvement',
        title: 'Minskat loggbrus vid AI-anrop',
        description: 'Borttaget URL-brus från loggutskrifter vid sammanfattningsanalys och AI-chatt för renare och mer lättlästa backend-loggar.'
      }
    ]
  },
  {
    version: '2026.09.21.06',
    date: '2026-09-21',
    title: 'Dedikerad Admin-panel och rollbaserad behörighetskontroll (RBAC)',
    highlights: [
      {
        type: 'feature',
        title: 'Dedikerad Admin-flik i Inställningar',
        description: 'En säker administratörsflik har införts i inställningarna som enbart visas för användare med administratörsrättigheter.'
      },
      {
        type: 'security',
        title: 'Rollbaserad behörighet och skyddade API-endpoints',
        description: 'Kritiska systemoperationer som databasrensning, tömning av databasen, databasoptimering (VACUUM) samt val av AI-modell är nu strikt behörighetsskyddade i backend med HTTP 403-spärr.'
      },
      {
        type: 'feature',
        title: 'Komplett användaradministration',
        description: 'Administratörer kan nu direkt i gränssnittet lista befintliga användare, skapa nya användarkonton, återställa lösenord, tilldela administratörsstatus och ta bort konton.'
      }
    ]
  },
  {
    version: '2026.09.21.05',
    date: '2026-09-21',
    title: 'Initieringsfix för ikonsanering och minskat loggbrus för AI',
    highlights: [
      {
        type: 'bugfix',
        title: 'Löst startfel för ikonsanering i databasinitieringen',
        description: 'Funktionen get_icons_dir() flyttades före databasmigreringarna vilket eliminerar NameError vid uppstart och säkerställer att felaktigt korskopplade flödesikoner kan saneras korrekt.'
      },
      {
        type: 'improvement',
        title: 'Minskat loggbrus för AI-modeller och rensade dubbletter',
        description: 'Tillgängliga AI-modeller loggas nu enbart när en förändring sker mot föregående kontroll istället för var 30:e sekund, och överflödig dubblettlogg vid artikelanalys har tagits bort.'
      }
    ]
  },
  {
    version: '2026.09.21.04',
    date: '2026-09-21',
    title: 'Dynamisk AI-motoridentifiering och korrekta statusmeddelanden',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk detektering av inferensmotor (Ollama, LM Studio)',
        description: 'Systemet identifierar nu automatiskt om den anslutna AI-servern är Ollama, LM Studio, OpenAI eller annan motor, och exponerar servertypen dynamiskt till gränssnittet.'
      },
      {
        type: 'improvement',
        title: 'Dynamiska och korrekta status- och förloppstexter i Nyhetschatten',
        description: 'Den tidigare hårdkodade texten "LM Studio" i chattens bearbetningsindikator och fotnot har ersatts med den faktiskt identifierade inferensmotorn, så att det inte står felaktigt LM Studio när Ollama eller annan motor används.'
      },
      {
        type: 'improvement',
        title: 'Neutral och konsekvent AI-terminologi i inställningar och onboarding',
        description: 'Gränssnittet i inställningar, onboarding och sammanfattningar anpassar nu etiketter och notistexter efter den aktiva motorn istället för att förutsätta LM Studio.'
      }
    ]
  },
  {
    version: '2026.09.21.03',
    date: '2026-09-21',
    title: 'Intelligent konversation i Nyhetschatten och transparent AI-loggning',
    highlights: [
      {
        type: 'feature',
        title: 'Intelligent avsiktsigenkänning i Nyhetschatten',
        description: 'Enkla hälsningar, presentationer och artighetsfraser svaras nu på naturligt och pedagogiskt utan att dumpa in dussintals irrelevanta artikelkällor. Källor visas endast vid faktiska nyhetsfrågor.'
      },
      {
        type: 'feature',
        title: 'Transparent loggning för AI-modeller och felkoder',
        description: 'Utförlig statusloggning vid uppstart och anrop för att omedelbart synliggöra vilka modeller som är tillgängliga, eventuella felkoder (såsom saknade modeller i Ollama eller anslutningsproblem) samt inferenstider.'
      },
      {
        type: 'documentation',
        title: 'Enhetlig modellrekommendation: google/gemma-4-12b-qat',
        description: 'Standardiserat dokumentation och startkonfiguration så att google/gemma-4-12b-qat rekommenderas som primär modell för både Ollama och LM Studio.'
      }
    ]
  },
  {
    version: '2026.09.21.02',
    date: '2026-09-21',
    title: 'Dokumentation för samtidig text- och embeddingkörning i Ollama',
    highlights: [
      {
        type: 'documentation',
        title: 'Multi-modellstöd för Ollama',
        description: 'Tydliggjort hur Ollama kan köra en generativ modell (t.ex. Gemma 2) och en text embedding-modell (t.ex. nomic-embed-text) parallellt i VRAM, minneskrav samt hur RSS-Bevakaren dirigerar förfrågningarna.'
      }
    ]
  },
  {
    version: '2026.09.21.01',
    date: '2026-09-21',
    title: 'Standardiserade AI-variabler och Ollama-dokumentation',
    highlights: [
      {
        type: 'feature',
        title: 'Standardiserade miljövariabler för lokal AI',
        description: 'Infört AI_URL, AI_MODEL och AI_TIMEOUT som ersätter de tidigare LM Studio-specifika variablerna. Fullständig bakåtkompatibilitet bibehålls för befintliga installationer.'
      },
      {
        type: 'documentation',
        title: 'Utförlig integrationsguide för Ollama & LM Studio',
        description: 'Uppdaterat README och docker-compose med tydliga instruktioner för att ansluta Ollama via dess inbyggda OpenAI-kompatibla API, inklusive nätverkskonfiguration och modellhantering.'
      }
    ]
  },
  {
    version: '2026.09.20.19',
    date: '2026-09-20',
    title: 'Historiskt importtak och förtydligad flödesinläsning',
    highlights: [
      {
        type: 'feature',
        title: 'Åsidosättning av tidsbegränsning vid importtak',
        description: 'När ett flöde läggs till med ett angivet maxantal artiklar åsidosätter systemet den generella skyddsgränsen för artikelålder så att äldre historiska artiklar hämtas in upp till angivet antal.'
      },
      {
        type: 'design',
        title: 'Utgråat importtak och förklarande gränssnitt',
        description: 'Förtydligat fältet för Max artiklar vid skapande av flöde med en pedagogisk hjälprad. I flödeslistan och mobilkorten visas inställningen som en utgråad, informativ bricka då regeln främst avser den initiala inläsningen.'
      }
    ]
  },
  {
    version: '2026.09.20.18',
    date: '2026-09-20',
    title: 'Balanserade marginaler och förbättrad läsbarhet',
    highlights: [
      {
        type: 'design',
        title: 'Ökade marginaler och andrum',
        description: 'Justerat marginaler och inre avstånd (padding) till nästan standardnivå i AI-analysfönstret för en mer harmonisk, luftig och behaglig läsupplevelse utan att förlora den integrerade strukturen.'
      }
    ]
  },
  {
    version: '2026.09.20.17',
    date: '2026-09-20',
    title: 'Kompakt och renodlat AI-analysfönster',
    highlights: [
      {
        type: 'improvement',
        title: 'Integrerad prioritetspoäng',
        description: 'Bantat bort det stora fullbreddskortet för totalpoäng och integrerat poängen och prioriteringsbrickan direkt i toppen av poängmatrisen.'
      },
      {
        type: 'improvement',
        title: 'Borttagning av duplicerad information',
        description: 'Rensat bort rutan Hämtad till systemet (som redan finns under artikelrubriken) och tagit bort den upprepade grundberäkningsraden.'
      },
      {
        type: 'design',
        title: '3-kolumns diagnostik och slanka marginaler',
        description: 'Jämn 3-kolumnsfördelning för AI-diagnostiken och tightade marginaler för en modern och samlad vy utan onödig tom rymd.'
      }
    ]
  },
  {
    version: '2026.09.20.16',
    date: '2026-09-20',
    title: 'Stabilitetsfix för AI-analysfönstret',
    highlights: [
      {
        type: 'fix',
        title: 'Åtgärdat React Hook Error #310',
        description: 'Ersatt villkorlig useMemo-hook med en ren hjälpfunktion i AI-analysfönstret, vilket eliminerar renderingskraschen när modalen öppnas eller renderas om.'
      }
    ]
  },
  {
    version: '2026.09.20.15',
    date: '2026-09-20',
    title: 'Moderniserad och sammanslagen poängmatris i AI-analysen',
    highlights: [
      {
        type: 'improvement',
        title: 'Sammanslagen poängmatris och beräkning',
        description: 'Slagit ihop de tre analyspelarna och modellens beräkningsmotivering till ett enhetligt, visuellt integrerat kort. Eliminerat duplicerad text och skapat färgkodade brickor för intresseprofiler, bonusar och ClickBait-avdrag.'
      },
      {
        type: 'design',
        title: 'Komprimerad och modern modal-layout',
        description: 'Minskat onödiga marginaler och mellanrum i AI-analysfönstret för ett tightare och mer lättöverskådligt gränssnitt med fullt stöd för både ljust och mörkt tema.'
      }
    ]
  },
  {
    version: '2026.09.20.14',
    date: '2026-09-20',
    title: 'Namnkorrigering och optimerad MQTT-nyttolast',
    highlights: [
      {
        type: 'fix',
        title: 'Namnstandardisering',
        description: 'Sidopanelen och app-manifestet har uppdaterats för att genomgående visa det officiella namnet RSS-Bevakaren.'
      },
      {
        type: 'improvement',
        title: 'Optimerad MQTT-nyttolast',
        description: 'Rensat bort de överflödiga ikon-nycklarna feed_icon_path och icon till förmån för renodlad användning av den publika HTTPS-adressen feed_icon.'
      },
      {
        type: 'docs',
        title: 'Tydligare AI- och flödesstöd',
        description: 'Uppdaterat README med ny instrumentpanelsbild, bekräftat WordPress-stöd och tydliggjort anslutning till externa lokala AI-motorer som LM Studio och Ollama.'
      }
    ]
  },
  {
    version: '2026.09.20.13',
    date: '2026-09-20',
    title: 'Förhandsvisning och kollapserbar kod för Home Assistant button-card',
    highlights: [
      {
        type: 'docs',
        title: 'Kortförhandsvisning och smidigare dokumentation',
        description: 'Lagt till en skärmbild av Home Assistant-kortet och gjort YAML-koden för custom:button-card kollapserbar i README.md för förbättrad läsbarhet.'
      }
    ]
  },
  {
    version: '2026.09.20.12',
    date: '2026-09-20',
    title: 'Fleranvändarkonfiguration i Docker Compose',
    highlights: [
      {
        type: 'docs',
        title: 'Tydlig fleranvändarsyntax i compose',
        description: 'Tydliggjort hur flera konton definieras med kommatecken i APP_USERNAME och APP_PASSWORD i såväl docker-compose.yml som snabbstarten i README.md.'
      }
    ]
  },
  {
    version: '2026.09.20.11',
    date: '2026-09-20',
    title: 'Generiska användarnamn i Home Assistant-dokumentationen',
    highlights: [
      {
        type: 'docs',
        title: 'Tydligare fleranvändarexempel',
        description: 'Förtydligat i README.md att exemplen för Home Assistant Auto-Discovery är generiska mallar (användare1, användare2) som dynamiskt anpassas efter systemets faktiska användarnamn.'
      }
    ]
  },
  {
    version: '2026.09.20.10',
    date: '2026-09-20',
    title: 'Säkerhetsgranskning och hårdning av hemligheter',
    highlights: [
      {
        type: 'improvement',
        title: 'Förebyggande av hemlighetsläckor',
        description: 'Genomfört fullständig säkerhetsgranskning av kodbasen: rensat specifika IP-adresser i docker-compose.yml, implementerat dynamiskt genererad och persistent JWT-hemlighet samt förstärkt .gitignore för databaser och nycklar.'
      }
    ]
  },
  {
    version: '2026.09.20.09',
    date: '2026-09-20',
    title: 'Moderniserad och pedagogisk dokumentation',
    highlights: [
      {
        type: 'docs',
        title: 'Överskådlig README',
        description: 'Strukturerat om README.md för bättre läsbarhet: direkt Snabbstart, samlad Docker Compose, ny dashboard-skärmbild och utfällbara sektioner för avancerade tekniska detaljer.'
      }
    ]
  },
  {
    version: '2026.09.20.08',
    date: '2026-09-20',
    title: 'Stöd för artikelbild i Home Assistant button-card',
    highlights: [
      {
        type: 'improvement',
        title: 'Artikelbild i kortet',
        description: 'Lagt till visning av artikelns huvudbild (image_url) i Home Assistant custom:button-card med anpassad maxhöjd och responsiv bildskalning.'
      }
    ]
  },
  {
    version: '2026.09.20.07',
    date: '2026-09-20',
    title: 'Feber tillagd i den inbyggda RSS-katalogen',
    highlights: [
      {
        type: 'feature',
        title: 'Feber i katalogen',
        description: 'Lagt till Feber (https://feber.se/rss/) under kategorin Teknik & IT i den inbyggda svenska RSS-katalogen för enkel snabbprenumeration.'
      }
    ]
  },
  {
    version: '2026.09.20.06',
    date: '2026-09-20',
    title: 'Felsäkert Home Assistant button-card med null-skydd',
    highlights: [
      {
        type: 'improvement',
        title: 'Felsäker mallhantering i Home Assistant',
        description: 'Lagt till defensiva kontroller för entity och attributes i custom:button-card för att förhindra ButtonCardJSTemplateError om entiteten inte har laddats eller är otillgänglig.'
      }
    ]
  },
  {
    version: '2026.09.20.05',
    date: '2026-09-20',
    title: 'Home Assistant MQTT Auto-Discovery med stöd för flera användare',
    highlights: [
      {
        type: 'feature',
        title: 'Home Assistant MQTT Auto-Discovery',
        description: 'Sensorer registreras automatiskt i Home Assistant utan behov av manuell YAML-konfiguration. Stöd för både enskilda flöden och prioriterade händelser.'
      },
      {
        type: 'feature',
        title: 'Fleranvändarstöd och enhetsisolering',
        description: 'Varje användare i RSS-bevakaren tilldelas en egen isolerad Device i Home Assistant med unika sensorer och topics utan risk för krockar.'
      },
      {
        type: 'improvement',
        title: 'Automatisk livscykel och tillgänglighet',
        description: 'Flöden som raderas i RSS-bevakaren avregistreras automatiskt i Home Assistant. Tillgänglighetsstatus (online/offline) speglas direkt.'
      }
    ]
  },
  {
    version: '2026.09.20.04',
    date: '2026-09-20',
    title: 'Standardisering av Home Assistant button-card med temavariabler',
    highlights: [
      {
        type: 'improvement',
        title: 'Responsivt Home Assistant-kort',
        description: 'Uppdaterat custom:button-card att använda standardiserade CSS-temavariabler (--ha-card-background, --primary-text-color, --primary-color m.fl.) så att kortet anpassar sig sömlöst efter både ljust och mörkt tema.'
      }
    ]
  },
  {
    version: '2026.09.20.03',
    date: '2026-09-20',
    title: 'Dokumentation för Home Assistant button-card och utökad MQTT-specifikation',
    highlights: [
      {
        type: 'docs',
        title: 'Komplett Home Assistant-integration',
        description: 'Uppdaterat README med sensor-konfiguration och fullständigt custom:button-card med källans officiella flödesikon och anpassad layout.'
      },
      {
        type: 'docs',
        title: 'Uppdaterad MQTT-dataspecifikation',
        description: 'Dokumenterat de nya fälten feed_icon, feed_icon_path, feed_domain och icon i fältreferenstabellen och exempelnyttolasten.'
      }
    ]
  },
  {
    version: '2026.09.20.02',
    date: '2026-09-20',
    title: 'Flödesikon inkluderad i MQTT-nyttolasten för Home Assistant',
    highlights: [
      {
        type: 'feature',
        title: 'Flödesikon i MQTT',
        description: 'Lagt till feed_icon (publik 128px favicon), feed_icon_path och feed_domain i MQTT-meddelanden för direkt visning i Home Assistant och externa klienter.'
      },
      {
        type: 'improvement',
        title: 'Säker och nätverksoberoende ikonhantering',
        description: 'Använder högupplöst HTTPS-favicon som fungerar oavsett om Home Assistant körs lokalt på samma nätverk eller nås via fjärranslutning.'
      }
    ]
  },
  {
    version: '2026.09.20.01',
    date: '2026-09-20',
    title: 'Automatisk återställning och omladdning av flödesikoner',
    highlights: [
      {
        type: 'fix',
        title: 'Automatisk domänvalidering för flödesikoner',
        description: 'Säkerställt att externa ikoner valideras mot flödets faktiska domän innan de sparas eller laddas ner, vilket eliminerar risken för omkastade ikoner.'
      },
      {
        type: 'feature',
        title: 'Knapp för att hämta om ikoner',
        description: 'Lagt till en knapp "Hämta om ikoner" i flödeshanteraren som nollställer felaktiga ikoner och hämtar nya, rena favicons från respektive domän.'
      },
      {
        type: 'improvement',
        title: 'Automatisk databassanering vid uppstart',
        description: 'Backend upptäcker och nollställer automatiskt flödesikoner som sparats med fel domän vid serverstart.'
      }
    ]
  },
  {
    version: '2026.09.19.24',
    date: '2026-09-19',
    title: 'Buggfix vid borttagning av ClickBait-varning',
    highlights: [
      {
        type: 'fix',
        title: 'Borttagning av ClickBait-varning',
        description: 'Löste fel där borttagning av ClickBait-varning orsakade AttributeError vid omberäkning av artikelprioritet. Korrigerat parametrar och implementerat en bakåtkompatibel wrapper för prioritetsberäkning.'
      }
    ]
  },
  {
    version: '2026.09.19.23',
    date: '2026-09-19',
    title: 'Kritisk buggfix för polling-isolering och databasrensning',
    highlights: [
      {
        type: 'fix',
        title: 'Isolering av flödesinläsning',
        description: 'Löste problem där artiklar från föregående flöde kunde sparas under efterföljande flöden om tidsintervallet inte passerats.'
      },
      {
        type: 'fix',
        title: 'Automatisk databasrensning vid uppstart',
        description: 'Rensar automatiskt bort felaktigt korskopplade artiklar och tillhörande embeddings så att gamla artiklar inte dyker upp som olästa i fel flöden.'
      }
    ]
  },
  {
    version: '2026.09.19.22',
    date: '2026-09-19',
    title: 'Enhetlig och kolumnjusterad loggning med användarkoppling',
    highlights: [
      {
        type: 'improvement',
        title: 'Kolumnjusterade logg-taggar',
        description: 'Standardiserat loggtyperna (AI  , POLL, MQTT, SCRP, ICON) till exakt fyra tecken så att loggarna linjeras perfekt i prydliga kolumner.'
      },
      {
        type: 'improvement',
        title: 'Användarkoppling på alla händelser',
        description: 'Säkerställt att skrapnings- och administrationshändelser kopplas till den aktiva användaren eller markeras som system.'
      },
      {
        type: 'improvement',
        title: 'Skydd mot raderade flöden vid bakgrundspollning',
        description: 'Hanterat samtidig borttagning av flöden under pågående polling-loop så att inga onödiga felmeddelanden loggas.'
      }
    ]
  },
  {
    version: '2026.09.19.21',
    date: '2026-09-19',
    title: 'Realtidssynkning mellan enheter och balanserad sidopanel',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Realtidssynk av lässtatus mellan enheter',
        description: 'När du markerar en artikel som läst eller oläst i mobilen synkas detta nu omedelbart till desktop och andra aktiva enheter i realtid via WebSocket, och räknarna uppdateras automatiskt.'
      },
      {
        type: 'improvement',
        title: 'Automatisk synk vid flik-aktivering',
        description: 'När webbläsarfliken på desktop blir aktiv uppdateras flöden och olästräknare automatiskt i bakgrunden.'
      },
      {
        type: 'improvement',
        title: 'Balanserade marginaler i sidopanelen',
        description: 'Ökat marginaler, avstånd och flödesikoner i sidopanelen med 20 % för optimal balans mellan läsbarhet och kompakt layout.'
      }
    ]
  },
  {
    version: '2026.09.19.20',
    date: '2026-09-19',
    title: 'Uppdatering av flödeskatalog i OPML',
    badge: '',
    highlights: [
      {
        type: 'improvement',
        title: 'Rensning av flöden',
        description: 'Tagit bort inaktuella källor (swed24 och SpaceNews) från den fördefinierade svenska RSS-katalogen.'
      }
    ]
  },
  {
    version: '2026.09.19.19',
    date: '2026-09-19',
    title: 'Kompakt sidopanel med 50% minskade marginaler och paddings',
    badge: '',
    highlights: [
      {
        type: 'improvement',
        title: 'Kompaktare sidopanelslayout',
        description: 'Minskat vertikala marginaler, paddings och radhöjder i sidopanelen med över 50% så att avsevärt fler flöden ryms på skärmen utan onödig scrollning.'
      },
      {
        type: 'improvement',
        title: 'Trimmade navigeringslänkar och rubriker',
        description: 'Optimerat avstånd och ikonstorlekar för huvudmeny, sektionsrubriker och utloggningsknappen.'
      }
    ]
  },
  {
    version: '2026.09.19.18',
    date: '2026-09-19',
    title: 'Renodlad ClickBait-hantering och kompakt åtgärdsknapp',
    badge: '',
    highlights: [
      {
        type: 'improvement',
        title: 'Borttaget kryss i toppbaren',
        description: 'ClickBait-indikatorn i artikelkortets toppbar visar nu enbart status utan dubblerad klickfunktion eller kryss.'
      },
      {
        type: 'improvement',
        title: 'Kompakt knapp i ClickBait-rutan',
        description: 'Möjligheten att ta bort ClickBait-varningen finns nu samlad i artikelns röda ruta med en renodlad, kompakt knapp som ger mer utrymme för förklaringstexten.'
      }
    ]
  },
  {
    version: '2026.09.19.17',
    date: '2026-09-19',
    title: 'Optimerad verktygsrad och förstorade flödesikoner i Hantera flöden',
    badge: '',
    highlights: [
      {
        type: 'improvement',
        title: 'Integrerad verktygsrad (Toolbar)',
        description: 'Flikväljaren och åtgärdsknapparna (Exportera, Importera, Lägg till eget flöde) är nu samlade på samma rad i en balanserad layout som anpassar sig snyggt på smala skärmar och mobil.'
      },
      {
        type: 'feature',
        title: 'Dubbelt så stora flödesikoner',
        description: 'Ikonerna för varje källa har förstorats till 40x40 px med en stilren ikonbadge som fyller hela radens höjd och ger tydlig identitet åt varje flöde.'
      }
    ]
  },
  {
    version: '2026.09.19.16',
    date: '2026-09-19',
    title: 'Korrigerat officiell flödesadress för Amelia',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Officiellt RSS-flöde för Amelia',
        description: 'Uppdaterat flödesadressen för Amelia till officiella https://feeds.expressen.se/amelia i både flödeskatalogen och introduktionsguiden.'
      }
    ]
  },
  {
    version: '2026.09.19.15',
    date: '2026-09-19',
    title: 'Finjustering av flödeskatalogen: nya kategorier, rensade dubbletter och myndighetsuppdatering',
    badge: '',
    highlights: [
      {
        type: 'improvement',
        title: 'Rensad Amelia-dubblett',
        description: 'Tog bort dubblettinmatningen för Amelia under Livsstil & Kvinnor och behöll det officiella primärflödet.'
      },
      {
        type: 'feature',
        title: 'Nya kategorier: Omvärld & Internationellt, Formel 1 & Motorsport samt Livsstil & Senior',
        description: 'Skapat dedikerade kategorier för internationell nyhetsrapportering (BBC och Reuters), renodlad banracing samt seniorfokuserade publikationer (News55 och Senioren).'
      },
      {
        type: 'improvement',
        title: 'Omplacering av fordon, maritimt och flyg',
        description: 'Båtliv, Flygrevyn, Electrek och CleanTechnica har flyttats till Motor & Fordon, vilket ger en mer fokuserad sektion för svensk Energi & Hållbarhet samt Natur & Friluftsliv.'
      },
      {
        type: 'improvement',
        title: 'Myndighetsuppdatering för Krisinformation.se',
        description: 'Uppdaterat källbeskrivningen till Myndigheten för civilt försvar (MCF).'
      }
    ]
  },
  {
    version: '2026.09.19.14',
    date: '2026-09-19',
    title: 'Komplett omkategorisering av flödeskatalogen i 20 specifika ämnesområden',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: '20 tematiska flödeskategorier',
        description: 'Samtliga 318 flöden i katalogen är nu strukturerade i 20 tydliga kategorier (t.ex. Lokalt & Regionalt, Riksnyheter, Ekonomi & Bransch, Arbetsliv & Fackligt, Kultur & Samtid, Bygg & Industri).'
      },
      {
        type: 'improvement',
        title: 'Eliminerat ospecificerat i katalogen',
        description: 'Inga flöden hamnar längre i osorterade samlingskategorier eller Övrigt, vilket gör det enkelt att filtrera fram lokaltidningar och nischade fackmagasin direkt.'
      }
    ]
  },
  {
    version: '2026.09.19.13',
    date: '2026-09-19',
    title: 'Ny flödeskategori: Livsstil & Kvinnor med 7 ledande källor',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Flödeskategori Livsstil & Kvinnor',
        description: 'Lagt till en ny kategori i flödeskatalogen med Amelia, Femina, ELLE Sverige, Damernas Värld, MåBra, The Everygirl och Women 2.0.'
      },
      {
        type: 'feature',
        title: 'Integrerad i introduktionsguiden',
        description: 'Paketet är valbart direkt i onboarding-guidens rekommenderade flödespaket.'
      }
    ]
  },
  {
    version: '2026.09.19.12',
    date: '2026-09-19',
    title: 'Redesign av Hantera flöden: tabellvy, mobilkort och max antal artiklar',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Modern tabellvy på desktop',
        description: 'Enhetlig kolumnheader som eliminerar repetitiva versaltexter på varje rad och linjerar alla reglage med millimeterprecision.'
      },
      {
        type: 'feature',
        title: 'Responsiva kort för smala skärmar och mobil',
        description: 'På mobiler och smala skärmar transformeras flöden till tydliga, touchvänliga kort med separerad rubriksektion och ergonomisk kontrollpanel.'
      },
      {
        type: 'feature',
        title: 'Max antal artiklar att hämta in',
        description: 'Stöd för att begränsa hur många artiklar som hämtas in per flöde (override) med flexibel inmatning och lagring i databasen.'
      }
    ]
  },
  {
    version: '2026.09.19.11',
    date: '2026-09-19',
    title: 'Nytt officiellt flöde: Sveriges Domstolar med inaktiv ClickBait-kontroll',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Sveriges Domstolar tillagt i flödeskatalogen',
        description: 'Lagt till det officiella flödet för domstolsbeslut och nyheter från Sveriges Domstolar i katalogen och introduktionsguiden.'
      },
      {
        type: 'feature',
        title: 'Automatisk vitlistning som myndighetskälla',
        description: 'Sveriges Domstolar konfigureras automatiskt med avstängd ClickBait-kontroll och omfattas av det deterministiska systemskyddet för officiella myndigheter.'
      }
    ]
  },
  {
    version: '2026.09.19.10',
    date: '2026-09-19',
    title: 'Funktion för att ta bort ClickBait-varning samt skydd för myndighetsflöden',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Ta bort ClickBait-varning direkt på artikeln',
        description: 'Möjlighet att avfärda ClickBait-varningen för en enskild artikel direkt i gränssnittet. Varningen och den röda indikatorn tas bort samtidigt som artikelns prioritetspoäng och nivå återställs utan ClickBait-avdrag.'
      },
      {
        type: 'feature',
        title: 'Automatiskt ClickBait-skydd för myndighetsflöden',
        description: 'Artiklar från officiella myndighetskällor (såsom Krisinformation.se, Polisen och MSB) skyddas i både AI-prompt och systemlogik från att felaktigt flaggas som ClickBait.'
      },
      {
        type: 'feature',
        title: 'ClickBait-kontroll per flöde',
        description: 'Lagt till inställning i flödeshanteraren för att aktivera eller inaktivera ClickBait-granskning för individuella RSS-flöden.'
      }
    ]
  },
  {
    version: '2026.09.19.09',
    date: '2026-09-19',
    title: 'Dedikerad kategori för Blåljus & Krisinformation och uppdaterat Krisinformation-flöde',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Kategori Blåljus & Krisinformation i flödeskatalogen',
        description: 'Strukturerat om flödeskatalogen (OPML) med en renodlad kategori för Blåljus & Krisinformation innehållande Krisinformation (MSB) och Polisen Händelser.'
      },
      {
        type: 'feature',
        title: 'Uppdaterat Krisinformation-flöde',
        description: 'Säkerställt att källan Krisinformation använder det officiella nyhetsflödet https://www.krisinformation.se/nyheter/?rss=true både i katalogen och i introduktionsguiden.'
      }
    ]
  },
  {
    version: '2026.09.19.08',
    date: '2026-09-19',
    title: 'Nya lokala flöden i katalogen: Trosa kommun och evenemang',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Kommun & Lokalt i flödeskatalogen',
        description: 'Lagt till en dedikerad kategori för Kommun & Lokalt i den inbyggda flödeskatalogen (OPML), innehållande Trosa Evenemang, TROSA Notiser och TROSA Nyheter.'
      },
      {
        type: 'feature',
        title: 'Rekommenderat paket i introduktionsguiden',
        description: 'Gjort Trosa-flödena tillgängliga som ett valbart paket direkt i installations- och välkomstguiden vid nyinstallation.'
      }
    ]
  },
  {
    version: '2026.09.19.07',
    date: '2026-09-19',
    title: 'Intelligent käll- och kategoridiversifiering för morgon- och kvällsrapporter',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Källtak (Max 2 artiklar per källa)',
        description: 'Infört strikt källdiversifiering vid urval till rapporter. Förhindrar att en enskild nyhetssajt eller nischkanal dominerar urvalet, även om källan publicerat många högt poängsatta artiklar under natten.'
      },
      {
        type: 'feature',
        title: 'Kategoribalans (Max 3 artiklar per kategori)',
        description: 'Infört ett kategoritak som garanterar en balanserad representation över olika ämnesområden (Inrikes, Utrikes, Teknik, Ekonomi, Blåljus m.fl.) så att ingen enskild nisch (t.ex. motorsport eller sport) kan ta över rapporten.'
      },
      {
        type: 'ai',
        title: 'Förbättrad redaktionell prompt',
        description: 'Instruerat AI-modellen att sammanställa en bred och allsidig briefing som lyfter fram hela nyhetsläget och undviker ensidig fixering vid enskilda nischer.'
      }
    ]
  },
  {
    version: '2026.09.19.06',
    date: '2026-09-19',
    title: 'Centrerad inloggningsvy, helskärmsbakgrund och svenskt gränssnitt',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Horisontell och vertikal helskärmscentrering',
        description: 'Åtgärdade flex-kollaps i inloggningsvyn där formuläret trycktes fast till vänster i en smal kolumn. Inloggningsrutan expanderar nu till full bredd och centreras harmoniskt i mitten av skärmen.'
      },
      {
        type: 'ui',
        title: 'Sömlös bakgrundsfärg',
        description: 'Eliminerat den skarpa vertikala bakgrundskanten genom att låta inloggningsskärmen omfamna applikationens globala, mjuka gradienter över 100 % av skärmytan.'
      },
      {
        type: 'ui',
        title: 'Svenska texter och symboler',
        description: 'Översatt hela inloggningsrutan till ren svenska (RSS-Bevakaren, Användarnamn, Lösenord och Logga in) med modern laddningsindikator.'
      }
    ]
  },
  {
    version: '2026.09.19.05',
    date: '2026-09-19',
    title: 'Interaktiv installationsguide (Onboarding Wizard) med skippa-funktion',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Flerstegsguide för nyinstallationer',
        description: 'En visuell och pedagogisk kom-igång-guide som hjälper nya användare att snabbt välja svenska flödespaket, kontrollera lokal AI-anslutning och forma sin personliga nyhetsprofil.'
      },
      {
        type: 'feature',
        title: 'Frågebatteri för personlig intresseprofil och kategoriviktning',
        description: 'Alla kategorier startar på ett neutralt mellanläge (6/10). Genom 4 enkla frågor genereras en skräddarsydd profil där favoritområden lyfts och oönskade ämnen dämpas automatiskt.'
      },
      {
        type: 'feature',
        title: 'Möjlighet att när som helst skippa guiden och köra om den från Inställningar',
        description: 'Tydlig möjlighet att hoppa över introduktionen i samtliga steg utan att tvingas göra val, samt en dedikerad knapp i Inställningar för att återköra guiden vid behov.'
      }
    ]
  },
  {
    version: '2026.09.19.04',
    date: '2026-09-19',
    title: 'Komplett säkerhetskopiering av SAMTLIGA inställningar i hela systemet',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Fullständiga notis- och AI-inställningar',
        description: 'Säkerhetskopian inkluderar nu alla notispreferenser (PRIO-filtrering, kompakt/fullständig sammanfattning, max ord och meningar, rubrik- och bildval, driftnotiser samt notiser per enskilt flöde) tillsammans med alla AI-systemprompter, regler, kategorivikter och nyckelord.'
      },
      {
        type: 'feature',
        title: 'Gränssnitts- och layoutpreferenser',
        description: 'Även applikationens visuella inställningar (färgtema, kortstil, flödeslayout, swipe-gester på mobilen, kolumnval och expanderade sektioner) sparas och återställs automatiskt vid import på valfri enhet.'
      }
    ]
  },
  {
    version: '2026.09.19.03',
    date: '2026-09-19',
    title: 'Total export och återställning av alla inställningar',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Komplett säkerhetskopiering till JSON',
        description: 'Exportera samtliga konfigurationer i ett klick: AI-systemprompt, prioriterings- och exkluderingsregler, poängtrösklar, kategorivikter, intresseprofilens taggar, bevakade nyckelord och prenumererade flöden med alla dess inställningar.'
      },
      {
        type: 'feature',
        title: 'Återställning i inställningsvyn',
        description: 'Ett nytt dedikerat verktyg under Databas & system gör det enkelt att ladda upp och återskapa hela din anpassade miljö på en ny enhet eller efter ominstallation.'
      }
    ]
  },
  {
    version: '2026.09.19.02',
    date: '2026-09-19',
    title: 'Filimport av flöden via OPML och JSON',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Import av OPML 2.0- och XML-filer',
        description: 'Importera flöden direkt från valfri RSS-läsare. Om filen kommer från RSS-Bevakaren återskapas även aktiveringsstatus, dashboard-val, notiser och hämtningsintervall automatiskt.'
      },
      {
        type: 'feature',
        title: 'Import av JSON-säkerhetskopior',
        description: 'Möjlighet att ladda upp och återställa en tidigare exporterad JSON-backup med alla anpassade inställningar intakta.'
      },
      {
        type: 'feature',
        title: 'Smart dublettskydd och sammanfattning',
        description: 'Flöden som redan bevakas hoppas över för att undvika dubbletter, och användaren får en tydlig rapport om hur många flöden som lades till.'
      }
    ]
  },
  {
    version: '2026.09.19.01',
    date: '2026-09-19',
    title: 'Export av flöden med aktiveringsstatus och inställningar',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Export till standardiserad OPML 2.0',
        description: 'Exportera samtliga prenumererade RSS-flöden till en universell OPML 2.0-fil berikad med anpassade attribut för aktiveringsstatus, dashboard-synlighet, notiser, AI-skrapning och polling-intervall.'
      },
      {
        type: 'feature',
        title: 'Fullständig JSON-databackup',
        description: 'Möjlighet att ladda ner en komplett strukturerad JSON-säkerhetskopia av alla flöden och dess anpassade inställningar direkt från flödeshanteraren.'
      }
    ]
  },
  {
    version: '2026.09.18.11',
    date: '2026-09-18',
    title: 'Klickbar borttagning av gillade ämnen i intresseprofilen',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Symmetrisk hantering för gillade ämnen',
        description: 'Lade till en kryssknapp vid alla ämnen under "Detta är du intresserad av". Klicka på krysset för att omedelbart ta bort perifera ämnen som råkat följa med från en gillad artikel, så att de inte ger oönskad intressebonus.'
      },
      {
        type: 'feature',
        title: 'Återställning av borttagna gillade ämnen',
        description: 'En ny sektion under intresserade ämnen visar vilka ämnen som tagits bort, med möjlighet att enkelt återaktivera dem med en ångra-knapp.'
      }
    ]
  },
  {
    version: '2026.09.18.10',
    date: '2026-09-18',
    title: 'Smartare intresseprofil med tröskelregel och vitlistning',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Tröskelregel för dämpade ämnen',
        description: 'Ett ämne måste nu ha ogillats i minst 2 artiklar innan det aktiverar ett automatiskt -15p straffavdrag. Detta förhindrar att enstaka artiklar felaktigt dämpar bredare intressen som råkade omnämnas.'
      },
      {
        type: 'feature',
        title: 'Direkt borttagning och vitlistning i gränssnittet',
        description: 'Lade till en kryssknapp vid alla ämnen i listan över dämpade ämnen. Klicka på krysset för att omedelbart ta bort och vitlista ämnet från framtida straffavdrag.'
      }
    ]
  },
  {
    version: '2026.09.18.09',
    date: '2026-09-18',
    title: 'Förenklad ClickBait-indikering i notiser',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Varningstriangel i notisens titel',
        description: 'Förenklat ClickBait-markeringen i push-notiser. Istället för textblock på två ställen visas nu en varningstriangel direkt i notisens titel, samtidigt som brödtexten hålls ren och fokuserad på sammanfattningen.'
      }
    ]
  },
  {
    version: '2026.09.18.08',
    date: '2026-09-18',
    title: 'Korrigerad ikonimport och säkrad stabilitet för artikelkort',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Återställd ikonimport för klocksymbolen',
        description: 'Lade till den saknade importen av Clock-ikonen i artikelkorten, vilket åtgärdar JavaScript-körtidsfelet och garanterar stabil rendering av publiceringstiden.'
      }
    ]
  },
  {
    version: '2026.09.18.07',
    date: '2026-09-18',
    title: 'Optimerad kortlayout med ren toppbar och Detaljer-dialog',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Publiceringstid placerad under titeln',
        description: 'Publiceringstiden (Publ: xx:xx) har flyttats från topplisten till precis under artikelns rubrik. Detta ger ett mer naturligt redaktionellt läsflöde.'
      },
      {
        type: 'feature',
        title: 'Hämtningstidpunkt flyttad till Detaljer',
        description: 'Tidpunkten då artikeln hämtades in av systemet har flyttats från kortets topplist och visas nu snyggt och strukturerat inuti detaljdialogen.'
      },
      {
        type: 'feature',
        title: 'Resonemang har döpts om till Detaljer',
        description: 'Knappen i taggraden och tillhörande informationsdialog heter nu "Detaljer" och samlar källinformation, tidsstämplar, diagnostik och djupgående AI-analys.'
      }
    ]
  },
  {
    version: '2026.09.18.06',
    date: '2026-09-18',
    title: 'Kompakt artikelkort med AI-ikon och resonemang i taggraden',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Ren och kompakt sammanfattningsruta',
        description: 'Den tidigare övre listen inuti den insjunkna sammanfattningsrutan har tagits bort. Sammanfattningen startar nu direkt och ger ett betydligt mer kompakt och stilrent intryck.'
      },
      {
        type: 'feature',
        title: 'AI-ikon och resonemang i taggraden',
        description: 'Ordet "AI-sammanfattning" har ersatts av en elegant AI-ikon på samma rad som kategorier och taggar. Även "Resonemang"-knappen har flyttats ner till taggraden så att alla metadata och analysverktyg samlas på ett ställe.'
      }
    ]
  },
  {
    version: '2026.09.18.05',
    date: '2026-09-18',
    title: 'Lokal ikonlagring för flöden och automatisk städning vid radering',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Lokal lagring av flödesikoner',
        description: 'Flödesikoner laddas nu automatiskt ner till serverns lokala datamapp och konverteras till högkvalitativa PNG-ikoner. Detta eliminerar externa nätverksspärrar och CORS-problem så att flödesikonen alltid syns direkt i mobil- och webbpushnotiser.'
      },
      {
        type: 'feature',
        title: 'Automatisk radering av ikon vid borttagning av flöde',
        description: 'När ett RSS-flöde tas bort från systemet raderas även dess tillhörande lokala ikonfil automatiskt från disken.'
      }
    ]
  },
  {
    version: '2026.09.18.04',
    date: '2026-09-18',
    title: 'Anpassningsbar längd för korta sammanfattningar (max ord och meningar)',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Inställning för max ord och meningar i korta notiser',
        description: 'Du kan nu finjustera längden på de korta notissammanfattningarna under Inställningar. Välj maximalt antal ord (10–50 ord) samt maximalt antal meningar (1 till 2 meningar) för att anpassa notiserna perfekt efter din klocka eller mobil.'
      },
      {
        type: 'feature',
        title: 'Dynamisk prompt- och efterbehandlingsstyrning',
        description: 'AI-motorn anpassar automatiskt sin promptinstruktion efter dina valda gränser, och en strikt efterkontroll garanterar att notiserna aldrig överskrider dina definierade maxgränser.'
      }
    ]
  },
  {
    version: '2026.09.18.03',
    date: '2026-09-18',
    title: 'Korrigerad notislogik för alla flöden samt säkrad flödesikonvisning',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Exakt notisstyrning via PRIO-inställningen',
        description: 'När PRIO-notiser är påslaget skickas uteslutande notiser för högt prioriterade artiklar och bevakningsord. När PRIO-notiser är avslaget skickas notiser för samtliga nya artiklar från de flöden som är aktiverade i Notiser per flöde.'
      },
      {
        type: 'fix',
        title: 'Borttagning av överdrivna tids- och burst-spärrar',
        description: 'Tog bort en 2-timmars tidsspärr på RSS-publiceringsdatum som felaktigt blockerade artiklar med tidszonsavvikelser, samt utökade burst-gränsen så att inkommande flödesnotiser inte stryps i onödan.'
      },
      {
        type: 'fix',
        title: 'Säkrad ikonvisning i webbpush (CORS och PNG-stöd)',
        description: 'Tog bort en blockerande HEAD-förfrågan i Service Workern som orsakade CORS-fel mot externa ikoner och tvingade fram standardikonen. Uppdaterade även ikongenereringen till högupplösta PNG-ikoner som stöds fullt ut av alla mobila notissystem.'
      }
    ]
  },
  {
    version: '2026.09.18.02',
    date: '2026-09-18',
    title: 'Dubbla AI-sammanfattningar: Kompakt notissammanfattning och MQTT-expansion',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Dubbla AI-sammanfattningar (kort och lång)',
        description: 'Språkmodellen genererar nu automatiskt två nivåer av sammanfattning: en fullständig sammanfattning på upp till 3 meningar för läsning i appen, samt en ultrakompakt sammanfattning på 1–1,5 meningar optimerad för mobilnotiser och smartklockor.'
      },
      {
        type: 'ui',
        title: 'Val av notistyp under Inställningar',
        description: 'Lagt till en väljare under Notiser där du kan välja om du föredrar kompakta notiser (rymmer alltid på låsskärmen) eller fullständiga notiser.'
      },
      {
        type: 'feature',
        title: 'MQTT-stöd för short_summary och utökad dokumentation',
        description: 'Den kompakta sammanfattningen exponeras nu även direkt i MQTT-nyttolasten som short_summary för Home Assistant och smarta displayer. Dokumentationen i README.md har uppdaterats med de nya fälten.'
      }
    ]
  },
  {
    version: '2026.09.18.01',
    date: '2026-09-18',
    title: 'Driftnotiser för AI-motorn (LM Studio) till administratören',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Automatiska driftnotiser vid AI-avbrott',
        description: 'Systemet övervakar nu anslutningen till LM Studio och skickar en direkt push-notis till administratören om AI-motorn är onåbar i mer än 45 sekunder, samt en bekräftelsenotis när anslutningen återställts.'
      },
      {
        type: 'backend',
        title: 'Intelligent tidsfönster (Debounce)',
        description: 'För att undvika falsklarm vid korta omstarter eller modellbyten skickas driftnotisen först efter 45 sekunder av kontinuerligt avbrott, och endast en notis per avbrottsperiod.'
      },
      {
        type: 'ui',
        title: 'Inställning för driftnotiser',
        description: 'Lagt till en administratörsbrytare i Inställningar under fliken AI-analys för att enkelt slå på eller stänga av driftnotiserna.'
      }
    ]
  },
  {
    version: '2026.09.17.08',
    date: '2026-09-17',
    title: 'Visuell Intresseprofil: "Detta är du intresserad av" och "Detta är du inte intresserad av"',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Visuell Intresseprofil under Inställningar',
        description: 'Lagt till en helt ny dedikerad flik under Inställningar som visualiserar vilka ämnen och taggar du är intresserad av (positiv profil) och vilka du vill undvika (negativ profil), baserat på dina gillade och ogillade artiklar.'
      },
      {
        type: 'ui',
        title: 'Styrkestaplar, ämneskapslar och kategoribalans',
        description: 'Interaktiva färgkodade ämneskapslar och horisontella styrkestaplar som i realtid visar hur dina röster skapar intressebonusar (+10p till +20p) eller avdrag (-15p), samt en komplett fördelningsvy över dina favoritkategorier.'
      },
      {
        type: 'backend',
        title: 'API-endpoint för intresseprofilanalys',
        description: 'Ny endpoint /api/user/interest-profile som automatiskt aggregerar frekvenser, poängpåverkan och kategoribalans från användarens sparade artikelröster och AI-taggar.'
      }
    ]
  },
  {
    version: '2026.09.17.07',
    date: '2026-09-17',
    title: 'Automatisk visning av lästa artiklar i filtren Gillade, Låsta och Ogillade',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Gillade och Låsta artiklar döljs inte längre som lästa',
        description: 'Justerat frontend-filtret så att artiklar du gillat, låst eller ogillat alltid visas direkt när du aktiverar respektive filter, utan att du manuellt behöver klicka i "Visa lästa".'
      },
      {
        type: 'backend',
        title: 'Global täckning för Gillade och Låsta i backend',
        description: 'Säkerställt att backend inkluderar alla gillade, låsta och ogillade artiklar över alla användarens flöden även om ett specifikt källflöde har inställningen "include_in_dashboard" avaktiverad.'
      }
    ]
  },
  {
    version: '2026.09.17.06',
    date: '2026-09-17',
    title: 'Särskiljning av Gilla (AI-träning) och Lås (skydd mot rensning)',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Gilla tränar AI utan att låsa artikeln',
        description: 'Att gilla en artikel tränar nu uteslutande din personliga intresseprofil för att lyfta fram liknande ämnen, utan att automatiskt låsa artikeln. Artikellåsning styrs nu helt självständigt via den dedikerade Lås-knappen.'
      },
      {
        type: 'backend',
        title: 'Oberoende röst- och låstillstånd i backend',
        description: 'Tog bort den automatiska tilldelningen av is_locked vid röstning i /articles/{article_id}/vote, vilket gör att artikelns låsstatus bevaras intakt oavsett om man gillar, ogillar eller tar bort sin röst.'
      }
    ]
  },
  {
    version: '2026.09.17.05',
    date: '2026-09-17',
    title: 'Mobiloptimerad briefingvy med artikelkortsdesign och snabbväljare',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Artikelkortsdesign för briefingar',
        description: 'Byggt om hela briefingvyn till att använda applikationens moderna artikelkort (feed-card card-modern) med toppbar, färggradienter för morgon- och kvällsrapporter, källbrickor och modern knapprad.'
      },
      {
        type: 'ui',
        title: 'Minskade marginaler och maximal läsbarhet på mobil',
        description: 'Eliminerat de tidigare klumpiga marginalerna (från 28px till kompakta, eleganta marginaler), vilket ger briefingtexten full bredd och gör rapporten mycket mer lättläst på mobilskärmar.'
      },
      {
        type: 'feature',
        title: 'Horisontell snabbväljare för briefings',
        description: 'Lagt till en svepbar remsa med pillerknappar längst upp för att direkt växla mellan tidigare morgon- och kvällsrapporter med ett enda klick utan att behöva scrolla längst ner.'
      }
    ]
  },
  {
    version: '2026.09.17.04',
    date: '2026-09-17',
    title: 'Rättning av kvarlämnad händelselyssnare i nyhetsflödet',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Åtgärdat ReferenceError för fetchLatestDigest',
        description: 'Tog bort en kvarlämnad händelselyssnare och beroende i Dashboard-komponenten som anropade fetchLatestDigest efter att briefing-rutan brutits ut till ett eget fristående flöde.'
      }
    ]
  },
  {
    version: '2026.09.17.03',
    date: '2026-09-17',
    title: 'Förenklad AI-sammanfattningsruta och renare artikelkort',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Borttagning av överflödiga informationsrutor',
        description: 'Tog bort de separata rutorna för Akuthet, Substans och tidsåtgång från artikelkortet, eftersom fullständiga poäng, mätare och diagnostik redan presenteras i resonemangsdialogen.'
      },
      {
        type: 'ui',
        title: 'Resonemangsknappen flyttad till rubrikraden',
        description: 'Placerat "Resonemang"-knappen direkt på samma rad som "AI-sammanfattning", vilket sparar vertikalt utrymme och ger kortet ett mycket mer kompakt och elegant utseende.'
      }
    ]
  },
  {
    version: '2026.09.17.02',
    date: '2026-09-17',
    title: 'Dedikerat briefing-flöde för morgon- och kvällsrapporter',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Borttagning av briefing-rutan i nyhetsflödet',
        description: 'Den tidigare expanderbara morgonrapport-bannern längst upp i nyhetsflödet har tagits bort för ett renare, snabbare och mer fokuserat flöde.'
      },
      {
        type: 'feature',
        title: 'Morgon- och kvällsrapport som eget flöde',
        description: 'Briefingar betraktas nu som ett helt självständigt flöde tillgängligt i sidomenyn och i mobilens flödesmeny, med full historik och direkt arkivbläddring.'
      },
      {
        type: 'feature',
        title: 'Uppläsning med talsyntes och kopiering',
        description: 'Lagt till direkt uppläsning av rapporten via svensk talsyntes samt möjlighet att kopiera hela sammanställningen till urklipp med ett klick.'
      }
    ]
  },
  {
    version: '2026.09.17.01',
    date: '2026-09-17',
    title: 'Re-analys synkronisering, realtidsuppdatering och omedelbar UI-respons',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Omedelbar uppdatering av artikelkort och resonemang',
        description: 'Kopplat ihop re-analysens API-svar så att både artikelkortet och resonemangsmodalen uppdateras direkt i React-state med nya poäng, ny sammanfattning, taggar och modell.'
      },
      {
        type: 'ui',
        title: 'Visuell laddningsindikator vid omkörning av AI',
        description: 'Artikelkortet visar nu animerat laddningsskelett med progressbar under re-analysen ("Kör ny AI-analys..."), så att det syns direkt i kortet att bearbetning pågår.'
      },
      {
        type: 'backend',
        title: 'WebSocket-notifiering och databasmigrering',
        description: 'Lagt till AI_UPDATED och STATS_UPDATE över WebSocket vid manuell re-analys, samt säkerställt automatisk SQLite-migrering för urgency_score och substance_score.'
      },
      {
        type: 'fix',
        title: 'Användarfeedback via notiser',
        description: 'Lagt till direkta bekräftelse- och felnotiser (toast) vid körning av manuell AI-analys så att eventuella anslutningsfel eller timeouts från LM Studio presenteras tydligt.'
      }
    ]
  },
  {
    version: '2026.09.16.20',
    date: '2026-09-16',
    title: 'AI-chatt Markdown-stöd, insjunken AI-ruta och modellvisning i resonemang',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Fullständigt Markdown-stöd i AI-chatten',
        description: 'Implementerat stöd för alla rubriknivåer (#, ##, ###, ####), horisontella avdelare (---), punktlistor, numrerade listor, inline-kod, kodblock och fetstil så att AI-svar visas strukturerat istället för råtext.'
      },
      {
        type: 'ui',
        title: 'Insjunken ruta (Well) för AI-sammanfattningen',
        description: 'Givit artikelkortet mer djup genom att placera AI-sammanfattningen i en mjukt insjunken ruta med mikroskugga och små marginaler. Ersatt den tidigare linjeavdelaren mot taggarna.'
      },
      {
        type: 'feature',
        title: 'AI-modell i resonemangsmodalen',
        description: 'Lagt till visning av vilken AI-modell som utfört analysen direkt i modalen för resonemang och diagnostik, samt sparat modellinformation i databasen.'
      }
    ]
  },
  {
    version: '2026.09.16.19',
    date: '2026-09-16',
    title: 'Minskade kortmarginaler, stabiliserad scroll och nytt fliknamn',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Halverade marginaler och tightare kortlayout',
        description: 'Minskat padding i toppbaren och bottenbaren med 50% samt reducerat marginalen under taggarna för en renare och mer kompakt presentation.'
      },
      {
        type: 'ui',
        title: 'Eliminerat tomt glapp under taggar',
        description: 'Justerat rutnätslayouten så att kort anpassar sig naturligt efter sitt eget innehåll istället för att tvingas till onödig höjd av grannkort.'
      },
      {
        type: 'fix',
        title: 'Stabiliserad oändlig scrollning utan ryck',
        description: 'Tagit bort positioneringsanimering från korten under scroll, ökat sidomfånget till 30 artiklar och lagt till mjuk förladdning (rootMargin: 400px) så att flödet inte hoppar till när du scrollar.'
      },
      {
        type: 'ui',
        title: 'Döpt om fliken till Nyhetsflöde',
        description: 'Ersatt det engelska namnet "Dashboard" med det naturliga svenska namnet "Nyhetsflöde" i sidomenyn.'
      }
    ]
  },
  {
    version: '2026.09.16.18',
    date: '2026-09-16',
    title: 'Datumspärr, solid vy för ogillade och renare knapprad',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Sanitetsspärr för framtida datum',
        description: 'Implementerat automatisk spärr i både backend och frontend som klämmer artiklars publiceringstid till aktuell tidpunkt om källans flöde anger ett framtida datum (t.ex. vid felaktig tidszon eller schemalagda artiklar).'
      },
      {
        type: 'ui',
        title: 'Solid bakgrund för ogillade artiklar',
        description: 'Tagit bort den dämpande 0.55-transparensen på ogillade artiklar så att korten förblir helt solida och lättlästa även vid visning av lästa nyheter.'
      },
      {
        type: 'ui',
        title: 'Förenklad bottenrad med 5 tydliga knappar',
        description: 'Rensat bort de redundanta valen "AI" (finns redan i sammanfattningen) och "Läs hela" (kortet expanderas vid klick på kortkroppen), vilket ger mer plats åt Gilla, Ogilla, Läst, Lås och Dela.'
      },
      {
        type: 'ui',
        title: 'Symmetrisk höjd och större knappar',
        description: 'Bottenraden är nu symmetriskt lika hög som toppraden (42px desktop / 38px mobil) med större touch-targets (32-34px knappar) för bekvämare klickning på mobila enheter.'
      }
    ]
  },
  {
    version: '2026.09.16.17',
    date: '2026-09-16',
    title: 'Nya standardvikter, persistent MQTT och modelldokumentation',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Uppdaterade standardvikter för kategorier',
        description: 'Justerat standardvikterna i backend och inställningar: Blåljus (7/10), Lokalt (8/10), Inrikes (6/10), Utrikes (5/10), Politik (4/10), Ekonomi (5/10), Teknik (9/10), Motor (7/10), Vetenskap & Hälsa (7/10), Sport (1/10), Nöje & Kultur (5/10) samt Övrigt (3/10).'
      },
      {
        type: 'feature',
        title: 'Persistent MQTT med retain som standard',
        description: 'MQTT_RETAIN är nu aktiverat som standard (true), vilket innebär att publicerade artikelhändelser ligger kvar i MQTT-brokern över omstarter. Vid omstart/stopp rapporteras status automatiskt som offline via LWT (Last Will and Testament).'
      },
      {
        type: 'docs',
        title: 'Dokumentation av testade AI-modeller',
        description: 'Tydliggörande i dokumentationen kring modeller för eget bruk och test: google/gemma-4-12b-qat för textanalys samt text-embedding-nomic-embed-text-v1.5 för vektorembeddings.'
      }
    ]
  },
  {
    version: '2026.09.16.16',
    date: '2026-09-16',
    title: 'Snabbfilter för ogillade artiklar',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Nytt snabbfilter "Ogillade" i toppmenyn',
        description: 'Lagt till en röd filterknapp "Ogillade" bredvid "Gillade" och "Låsta". Gör det enkelt att direkt filtrera fram alla artiklar du röstat ner, granska dem och återställa eller ändra rösten med ett klick.'
      }
    ]
  },
  {
    version: '2026.09.16.15',
    date: '2026-09-16',
    title: 'Solid bakgrund i AI-resonemangsdialogen',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Helt solid och ogenomskinlig modalbakgrund',
        description: 'AI-resonemangsdialogen har nu en 100 % solid och ogenomskinlig bakgrund (#ffffff i ljust läge, #1e293b / #0f172a i mörkt läge) så att underliggande sidinnehåll inte lyser igenom.'
      }
    ]
  },
  {
    version: '2026.09.16.14',
    date: '2026-09-16',
    title: 'Rättning av källikonsvisning i AI-resonemangsdialogen',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Åtgärdat fel med createElement vid öppning av AI-info',
        description: 'Rättat en bugg där källnamnet av misstag behandlades som en React-komponent istället för en källikon-URL, vilket orsakade ett InvalidCharacterError i webbläsaren.'
      }
    ]
  },
  {
    version: '2026.09.16.13',
    date: '2026-09-16',
    title: 'Korrekt isolering av huvudkategorier från ogillade ämnen',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Huvudkategorier skyddas mot felaktigt ogillat-avdrag',
        description: 'Huvudkategorier som användaren har valt (t.ex. Teknik 9/10) kan inte längre felaktigt straffas med "-15p ogillat ämne". Gilla- och Ogilla-systemet baseras nu strikt på specifika ämnestaggar, och gillade taggar har alltid företräde framför ogillade.'
      }
    ]
  },
  {
    version: '2026.09.16.12',
    date: '2026-09-16',
    title: 'Visuell temaanpassning för AI-resonemangsdialogen',
    badge: '',
    highlights: [
      {
        type: 'ui',
        title: 'Fullständig temaintegration och luftig layout',
        description: 'AI-resonemangsdialogen har byggts om för att följa applikationens formspråk till 100 %. Klumpiga inkapslade rutor har ersatts av rena sektioner, mjuka gradienter, progress-staplar och fullt stöd för mörkt tema och mobilens bottenark.'
      },
      {
        type: 'improvement',
        title: 'Dedikerad CSS och globala färgvariabler',
        description: 'Skapat AIReasoningModal.css och säkerställt att CSS-variabler som bakgrund och hovringsfärger är definierade över samtliga färgteman.'
      }
    ]
  },
  {
    version: '2026.09.16.11',
    date: '2026-09-16',
    title: 'AI-transparens och detaljerat resonemang via (I)-knapp',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Ny informationsdialog för AI-resonemang och poäng',
        description: 'En ny (I)-knapp på alla händelsekort öppnar en utförlig diagnostikvy som förklarar exakt hur AI-modellen har poängsatt artikeln: uppdelning av kategori, akuthet, substans, eventuella bonusar/avdrag samt modellens motivering.'
      },
      {
        type: 'feature',
        title: 'Visning av analystid och AI-metadata',
        description: 'Dialogen visar nu även tidsåtgång för analysen (i sekunder), ClickBait-granskning och genererade ämnestaggar.'
      }
    ]
  },
  {
    version: '2026.09.16.10',
    date: '2026-09-16',
    title: 'Automatisk sparning vid val av AI-modell i inställningar',
    badge: '',
    highlights: [
      {
        type: 'fix',
        title: 'Direkt sparning av vald AI-modell',
        description: 'Att välja en LM Studio-modell i dropdownen under AI-analys sparar nu inställningen omedelbart till databasen och ger visuell bekräftelse, istället för att endast ändra lokalt gränssnittstillstånd.'
      },
      {
        type: 'improvement',
        title: 'Svenska statusmeddelanden för LM Studio-anslutning',
        description: 'Samtliga status- och felmeddelanden vid kontroll av anslutning till LM Studio har översatts till svenska.'
      }
    ]
  },
  {
    version: '2026.09.16.09',
    date: '2026-09-16',
    title: 'Produktionslansering av ny prioriteringsmodell och Gilla-system (Main)',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Borttagning av statisk PRIO-knapp på händelsekort',
        description: 'Den tidigare statiska PRIO-knappen med eldsflamma och dess separata dialog har avlägsnats från artikelkorten till förmån för det nya dynamiska Gilla- och Ogilla-systemet.'
      },
      {
        type: 'release',
        title: 'Lansering till Main-grenen',
        description: 'Hela paketet med sammansatt poängmatris (Kategori 30%, Akuthet 40%, Substans 30%), adaptiv intresseprofil och favoritfilter är nu produktionssatt på huvudgrenen.'
      }
    ]
  },
  {
    version: '2026.09.16.08',
    date: '2026-09-16',
    title: 'Gilla- och Ogilla-system med adaptiv intresseprofil och favoritsamling (Steg 2)',
    badge: '',
    highlights: [
      {
        type: 'feature',
        title: 'Direkt röstning med Gilla och Ogilla på artikelkort',
        description: 'Varje artikelkort har nu diskreta knappar för Gilla och Ogilla. När du gillar en artikel sparas och låses den automatiskt mot nattlig rensning, medan ogillade artiklar dämpas i flödet.'
      },
      {
        type: 'feature',
        title: 'Adaptiv intresseprofil i AI-prioriteringen',
        description: 'Artiklar du gillar skapar automatiskt en positiv intresseprofil. Framtida inkommande artiklar som matchar taggar från dina gillade artiklar tilldelas en personlig intressebonus (+10 poäng), medan taggar från ogillade artiklar dämpas (-15 poäng).'
      },
      {
        type: 'feature',
        title: 'Nytt snabbfilter för Gillade artiklar i översikten',
        description: 'Ett nytt dedikerat filter i menyn låter dig snabbt visa alla dina sparade favoriter med ett klick.'
      }
    ]
  },
  {
    version: '2026.09.16.07',
    date: '2026-09-16',
    title: 'Tydliggörande av poängmatris och kategoriviktning i gränssnitt och dokumentation',
    highlights: [
      {
        type: 'improvement',
        title: 'Uppdaterade etiketter och förklaringar i inställningar',
        description: 'Kategorireglagens etiketter har uppdaterats för att tydligt återspegla deras roll i den nya poängmatrisen (Kategoriintresse 0–30p), vilket förhindrar missförstånd om att reglaget ensamt styrde 100 % av slutpoängen.'
      },
      {
        type: 'improvement',
        title: 'Omfattande dokumentation i README',
        description: 'Enkel och pedagogisk sammanfattning av poängmodellen, hur totalpoäng 0–100 beräknas, hur standardkategorier fungerar och hur användaren lägger till egna skräddarsydda kategorier.'
      }
    ]
  },
  {
    version: '2026.09.16.06',
    date: '2026-09-16',
    title: 'Sammansatt poängmatris för smart artikelprioritering (Steg 1)',
    highlights: [
      {
        type: 'feature',
        title: 'Flerdimensionell poängmatris i AI-analysen',
        description: 'Övergång från ensidig kategoriviktning till en sammansatt matris som väger samman ämneskategori (30 %), händelsens akuthet/nyhetsvärde (40 %) och innehållets faktasubstans (30 %). Förhindrar att ytliga notiser i högt prioriterade kategorier blir felaktigt prioriterade.'
      },
      {
        type: 'feature',
        title: 'Flerkällsbekräftelse och ClickBait-filtrering',
        description: 'Artiklar som ingår i bekräftade kluster från 2 eller fler oberoende källor tilldelas automatisk klusterbonus (+10 till +15 poäng). Artiklar som flaggas som ClickBait får automatiskt poängavdrag (-25 poäng).'
      },
      {
        type: 'improvement',
        title: 'Detaljerad prioritetsredovisning och mätvärden',
        description: 'Både backend och frontend sparar och visualiserar nu akuthet (1-10) och substans (1-10) transparent i artikelns analysinformation.'
      }
    ]
  },
  {
    version: '2026.09.16.05',
    date: '2026-09-16',
    title: 'Korrigerad sparning och autosynk av kategoriviktningar i AI-analys',
    highlights: [
      {
        type: 'fix',
        title: 'Korrekt serialisering av kategorier och vikter i backend',
        description: 'Åtgärdat en bugg där kategoriobjekt från Pydantic inte tolkades som ordlistor av normaliseringsfunktionen, vilket ledde till att anpassade vikter rensades och återställdes till standard. Backend hanterar nu alla modellformat utan förlust.'
      },
      {
        type: 'improvement',
        title: 'Direkt sparning och autosynk vid reglagejustering',
        description: 'Kategoriviktningar sparas nu automatiskt när reglaget släpps (på desktop och mobil), vid tillägg, borttagning eller återställning. Dessutom har en direkt "Spara viktningar"-knapp lagts till i sektionens rubrik.'
      }
    ]
  },
  {
    version: '2026.09.16.04',
    date: '2026-09-16',
    title: 'Garanterad ikonvisning för flöden och push-notiser',
    highlights: [
      {
        type: 'fix',
        title: 'Säkrad ikonvisning i webbpush och systemnotiser',
        description: 'Webbläsare och operativsystem stöder inte SVG i notiser. Systemet har nu försetts med en högupplöst PNG-standardikon samt automatisk fallback i Service Worker vid brutna externa ikonlänkar så att notiser aldrig blir utan ikon.'
      },
      {
        type: 'improvement',
        title: 'Universell fallback och absolut URL-hantering',
        description: 'Flöden vars källor anger relativa ikonsökvägar eller saknar fungerande favicon mappas nu korrekt till källans domän eller standardikonen i såväl kort, sidomeny som notisinställningar.'
      }
    ]
  },
  {
    version: '2026.09.16.03',
    date: '2026-09-16',
    title: 'Ny modern flödesikon och responsiva bildproportioner',
    highlights: [
      {
        type: 'improvement',
        title: 'Ny modern standardikon för flöden och källor',
        description: 'Ersatt den gamla generiska globen med en ny, modern och krispig vektorikon i SVG med mjuk gradient. Automatiska favicons hämtas nu via DuckDuckGo vilket ger korrekta ikoner för bland annat Polisen och svenska myndigheter.'
      },
      {
        type: 'fix',
        title: 'Responsiva 16:9-proportioner för bilder i artikelkort',
        description: 'Åtgärdat problemet där bilder i breda layouter (t.ex. 2 kort i bredd på stor skärm) tvingades in i en fast höjd och klipptes av på toppen och botten. Bilderna anpassar sig nu dynamiskt i fullt 16:9-widescreenformat.'
      }
    ]
  },
  {
    version: '2026.09.16.02',
    date: '2026-09-16',
    title: 'Strikt kronologisk sortering och deduplicerade datumgrupper',
    highlights: [
      {
        type: 'fix',
        title: 'Strikt kronologisk sortering efter publiceringstid',
        description: 'Artiklar sorteras nu konsekvent efter sin faktiska publiceringstid (både i backend och frontend) istället för enbart hämtningstidpunkt. Detta förhindrar att nyheter i samma flöde eller i läget "Visa lästa" visas huller om buller.'
      },
      {
        type: 'fix',
        title: 'Deduplicering av datumrubriker',
        description: 'Datumgrupperingen i flödesvyn samlar nu samtliga artiklar för samma dygn under en och samma sammanhållna datumavgränsare i strikt fallande ordning, vilket eliminerar att samma dag (t.ex. Tisdag 15 september) skapas och visas flera gånger.'
      }
    ]
  },
  {
    version: '2026.09.16.01',
    date: '2026-09-16',
    title: 'Prestandalyft för AI-kö och oberoende databashantering',
    highlights: [
      {
        type: 'fix',
        title: 'Asynkron frånkoppling av databassessioner under AI-analys',
        description: 'Databassessionen hålls inte längre öppen under nätverksanrop mot LM Studio eller vid skrapning av brödtext. Detta eliminerar helt att databasen låses när en stor kö av artiklar ska analyseras efter att lokal AI varit offline.'
      },
      {
        type: 'improvement',
        title: 'SQLite WAL-läge (Write-Ahead Logging) och utökad busy-timeout',
        description: 'Aktiverat SQLite WAL-läge och 30 sekunders busy-timeout. Frontend kan nu läsa och hämta artiklar i realtid utan att någonsin blockeras av pågående AI-skrivningar eller bakgrundsjobb.'
      },
      {
        type: 'improvement',
        title: 'TTL-cachning av LM Studio-status och modeller',
        description: 'Hälsokontroller och modellhämtning mot LM Studio cachas med en kort TTL så att konfigurationsanrop från gränssnittet svarar på under en millisekund även om LM Studio är offline eller hårt belastad.'
      }
    ]
  },
  {
    version: '2026.09.15.09',
    date: '2026-09-15',
    title: 'Strikt flödesisolering och realtidsräknare för olästa',
    highlights: [
      {
        type: 'fix',
        title: 'Fullständig källisolering vid byte av flöde',
        description: 'Åtgärdat buggen där artiklar från föregående flöde låg kvar vid flödesbyte i läget "Visa lästa". Korten nollställs nu omedelbart vid flikbyte, race conditions mellan asynkrona anrop har eliminerats och flödesvyn garanterar att endast artiklar från det aktiva flödet visas.'
      },
      {
        type: 'fix',
        title: 'Realtidsuppdatering av olästa i sidopanelen',
        description: 'Flyttat WebSocket-uppkopplingen till applikationens toppnivå så att den alltid är aktiv. Sidopanelens och bottenmenyns räknare för olästa artiklar uppdateras nu omedelbart i realtid så fort nya artiklar anländer från bakgrundspollning eller initial inläsning.'
      }
    ]
  },
  {
    version: '2026.09.15.08',
    date: '2026-09-15',
    title: 'Bevarad färgprofil för lästa artiklar',
    highlights: [
      {
        type: 'improvement',
        title: 'Full färgprofil utan gråskalefilter',
        description: 'Tog bort det gråa filtret helt från lästa artiklar. När "Visa lästa" är aktiverat visas artiklarna nu med fulla temafärger, källikoner och bilder, vilket bevarar applikationens visuella identitet och estetik.'
      }
    ]
  },
  {
    version: '2026.09.15.07',
    date: '2026-09-15',
    title: 'Strikt kontroll av publiceringstid vid inläsning',
    highlights: [
      {
        type: 'improvement',
        title: 'Strikt tidsfilter mot verklig publiceringstid',
        description: 'Vid avläsning av RSS-flöden ignoreras nu artiklar vars faktiska publiceringstid är äldre än det inställda tidsfönstret (t.ex. 48 timmar). Detta förhindrar att över 100 historiska artiklar väller in i databasen när ett nytt flöde registreras.'
      },
      {
        type: 'improvement',
        title: 'Fokuserad AI-analys på aktuella artiklar',
        description: 'Bakgrundsjobbet för AI bearbetar uteslutande färska artiklar inom tidsfönstret, vilket avlastar den lokala AI-modellen och säkerställer att inkommande nyheter snabbt sammanfattas, taggas och blir sökbara.'
      }
    ]
  },
  {
    version: '2026.09.15.06',
    date: '2026-09-15',
    title: 'Omedelbar filtrering av lästa artiklar',
    highlights: [
      {
        type: 'fix',
        title: 'Omedelbart dolt läge vid markering som läst',
        description: 'När artiklar markeras som lästa filtreras de nu bort omedelbart i gränssnittet utan krav på sidomladdning. Den tidigare felaktiga logiken som enbart gjorde korten svartvita i standardläget har åtgärdats.'
      },
      {
        type: 'improvement',
        title: 'Korrekt gråskala i "Visa lästa"-läget',
        description: 'Lästa artiklar visas nu med gråskala och dämpad opacitet enbart när användaren aktivt har aktiverat "Visa lästa".'
      }
    ]
  },
  {
    version: '2026.09.15.05',
    date: '2026-09-15',
    title: 'Renare TopBar och isolerad kortexpandering vid notiser',
    highlights: [
      {
        type: 'improvement',
        title: 'Flytt av PRIO-brickan till tagg- och kategoriraden',
        description: 'PRIO-brickan har flyttats från artikelkortets övre list (TopBar) ner till raden för kategorier och taggar. Detta ger en ren och sammanhållen övre list på en enda rad med publiceringstid, hämtningstid och källans namn.'
      },
      {
        type: 'fix',
        title: 'Isolerad kortexpandering vid klick på notis',
        description: 'Korrigerade hanteringen av expanderade kort vid direktöppning från notiser. Expandering binds nu uteslutande till artikelns unika ID istället för listpositionen, vilket eliminerar buggen där efterföljande artiklar i flödet öppnades i expanderat läge.'
      }
    ]
  },
  {
    version: '2026.09.15.04',
    date: '2026-09-15',
    title: 'Publiceringstider och förfinad händelseklustring',
    highlights: [
      {
        type: 'feature',
        title: 'Tydlig visning av ursprunglig publiceringstid',
        description: 'Korten visar nu källans faktiska publiceringstid (Publ: TT:MM) som primär tidsangivelse. Om artikeln hämtades in vid en senare tidpunkt visas även en kompletterande bricka för hämtad tid. Även i det expanderade läget presenteras båda tidsstämplarna tydligt.'
      },
      {
        type: 'fix',
        title: 'Självständiga kort för artiklar från samma källa',
        description: 'Klustringsalgoritmen har korrigerats så att artiklar från samma nyhetskälla inte längre klumpas ihop bakom ett enda kort. Varje artikel visas som sitt eget kort så att alla inkomna händelser förblir synliga i PRIO-flödet.'
      },
      {
        type: 'fix',
        title: 'Korrekt klustermarkering vid Läst-klick',
        description: 'När ett kort med sammanförda källor markeras som läst sätts samtliga relaterade artiklar i samma händelsekluster som lästa. Detta förhindrar att en underliggande artikel dyker upp som ett nytt separat kort efter klicket.'
      }
    ]
  },
  {
    version: '2026.09.15.03',
    date: '2026-09-15',
    title: 'Realtidssynkronisering av olästa artiklar för PRIO och samtliga flöden',
    highlights: [
      {
        type: 'fix',
        title: 'Realtidsuppdatering av PRIO-räknaren vid AI-bearbetning',
        description: 'När artiklar analyseras av AI och klassificeras som PRIO skickas nu en omedelbar synkroniseringssignal till gränssnittet. Antalet olästa på PRIO-flödet uppdateras direkt i realtid utan att användaren behöver ladda om sidan.'
      },
      {
        type: 'fix',
        title: 'Konsekvent räkning av faktiskt olästa artiklar i samtliga flöden',
        description: 'Räknarna för samtliga flöden i sidomenyn baseras nu konsekvent på faktiskt olästa artiklar (is_read = 0). Flöden nollställs inte längre felaktigt enbart för att man öppnar dem, och synkroniseras omedelbart vid nya artiklar, AI-berikning samt när artiklar markeras som lästa.'
      },
      {
        type: 'improvement',
        title: 'Selektiv "Markera alla som lästa" i PRIO-flödet',
        description: 'Knappen "Markera alla som lästa" i PRIO-fliken begränsar nu åtgärden till enbart de visade PRIO-artiklarna istället för att oavsiktligt markera samtliga artiklar i hela databasen som lästa.'
      }
    ]
  },
  {
    version: '2026.09.15.02',
    date: '2026-09-15',
    title: 'Källspecifika ikoner i pushnotiser',
    highlights: [
      {
        type: 'improvement',
        title: 'Flödets ikon i pushnotiser',
        description: 'Webbpush-notiser skickar nu automatiskt med respektive nyhetskällas egen logotyp eller högupplösta favicon (128px) som notisikon. Detta ersätter den tidigare dubblerade RSS-bevakaren-ikonen och gör att källor som SVT, SweClockers, TechCrunch m.fl. känns igen direkt vid en snabb anblick.'
      }
    ]
  },
  {
    version: '2026.09.15.01',
    date: '2026-09-15',
    title: 'Robust sessionshantering: 30 dagars giltighet, rullande session och global 401-avlyssnare',
    highlights: [
      {
        type: 'fix',
        title: 'Global 401-avlyssnare mot zombiesessioner',
        description: 'En global interceptor känner nu av om backend svarar med 401 Unauthorized vid utgångna säkerhetsnycklar. Istället för att användaren fastnar i ett tomt läge där inga artiklar läses in, rensas sessionen säkert och inloggningsskärmen visas med ett tydligt meddelande.'
      },
      {
        type: 'improvement',
        title: 'Automatisk förlängning (Sliding session) och 30 dagars livslängd',
        description: 'Livslängden på inloggningsnycklar har utökats från 7 till 30 dagar. Dessutom förlängs sessionen automatiskt i bakgrunden vid regelbunden användning via en ny refresh-endpoint, så att aktiva användare slipper bli utloggade stup i kvarten.'
      },
      {
        type: 'fix',
        title: 'Verifiering av säkerhetsnyckel vid appstart',
        description: 'Applikationen kontrollerar nu JWT-nyckelns bäst-före-datum direkt när den öppnas i webbläsaren. Utgångna sessioner fångas omedelbart innan trasiga API-förfrågningar skickas.'
      }
    ]
  },
  {
    version: '2026.09.14.06',
    date: '2026-09-14',
    title: 'Expanderbara sektioner för notisinställningar och snabbknapp för flödesnotiser',
    highlights: [
      {
        type: 'improvement',
        title: 'Expanderbara och kollapsbara sektioner i Notiser',
        description: 'Notisinställningarna har grupperats i prydliga dragspelssektioner (PWA-status, Registrerade enheter, Prioritering och innehåll, Bevakade nyckelord samt Notiser per flöde) med snabbknappar för att fälla ut eller ihop samtliga sektioner, och kom-ihåg-läge via webbläsaren.'
      },
      {
        type: 'improvement',
        title: 'Snabbknappar för att slå på eller slå av samtliga flödesnotiser',
        description: 'Under sektionen Notiser per flöde finns nu knapparna "Slå på alla" och "Slå av alla". Ett klick aktiverar eller inaktiverar pushnotiser för alla sparade flöden samtidigt. Vid massaktivering spärras befintliga artiklar för att förhindra notis-spam.'
      }
    ]
  },
  {
    version: '2026.09.14.05',
    date: '2026-09-14',
    title: 'Slumpad hämtning (10-30 min), renodlad katalog, skyddsgräns i inställningar och dold intern URL',
    highlights: [
      {
        type: 'improvement',
        title: 'Slumpmässigt hämtningsintervall (10-30 minuter)',
        description: 'Nya och masstillagda flöden tilldelas nu ett slumpat intervall mellan 10 och 30 minuter istället för 60 minuter, vilket effektivt sprider ut serverbelastningen och förhindrar att många källor anropas simultant.'
      },
      {
        type: 'fix',
        title: 'Strikt kategoristruktur i flödeskatalogen',
        description: 'Allmän svensk press i katalogen har nu en explicit kategoriomslutning och renodlad listrendering med unika nycklar, vilket eliminerar felaktig visning av andra flöden i specialiserade ämnesområden.'
      },
      {
        type: 'improvement',
        title: 'Konfigurerbar skyddsgräns för artikelålder',
        description: 'Skyddsgränsen för att automatiskt hoppa över äldre artiklar vid AI-analys kan nu ställas in direkt under Inställningar -> AI-analys (mellan 6 timmar och 7 dagar, standard 24 timmar).'
      },
      {
        type: 'improvement',
        title: 'Dold intern anslutningsadress och städad navigering',
        description: 'Visningen av den interna IP-adressen för LM Studio har tagits bort från gränssnittet. Duplicerad länk till Hantera flöden i sidomenyn har avlägsnats och behållits enbart under Inställningar.'
      }
    ]
  },
  {
    version: '2026.09.14.04',
    date: '2026-09-14',
    title: 'Omstrukturerad flödeskatalog med kategorikort, masstillägg och förhandsgranskning',
    highlights: [
      {
        type: 'improvement',
        title: 'Dedikerad katalogflik och kategorinavigering',
        description: 'Flödeshanteraren har delats upp i två renodlade huvudflikar: "Mina flöden" och "Flödeskatalog & Upptäck". Katalogen erbjuder interaktiva ämneskort med källräknare för omedelbar filtrering.'
      },
      {
        type: 'improvement',
        title: 'Masstillägg och snabbprenumeration per kategori',
        description: 'Stöd för att välja flera flöden med kryssrutor och lägga till samtliga samtidigt via en flytande åtgärdspanel, eller lägga till alla källor i en specifik kategori med ett enda klick.'
      },
      {
        type: 'improvement',
        title: 'Live förhandsgranskning och smarta filter',
        description: 'Möjlighet att förhandsgranska de senaste artiklarna direkt ur flödet innan tillägg, samt filter för att dölja redan prenumererade källor.'
      }
    ]
  },
  {
    version: '2026.09.14.03',
    date: '2026-09-14',
    title: 'Strukturerade inställningar för utseende samt komplett svensk UI-översättning',
    highlights: [
      {
        type: 'improvement',
        title: 'Expanderbara sektioner för Utseende-inställningar',
        description: 'Inställningssidan för Utseende har strukturerats upp med logiska och ihopfällbara rutor för Tema & Flödeslayout, Artikelkort & Mobilupplevelse samt Nyhetsklustring & AI-hämtning. Detta minskar behovet av vertikal scrollning och ger snabbare överblick.'
      },
      {
        type: 'improvement',
        title: 'Fullständig svensk översättning av Databas, Notiser och AI',
        description: 'Samtliga sektioner under Databas, Notiser och AI har översatts till ren svenska, inklusive korrekta å, ä och ö, uppdaterade statusbrickor, hjälpinformation och knapptexter.'
      }
    ]
  },
  {
    version: '2026.09.14.02',
    date: '2026-09-14',
    title: 'Mjuk och följsam expansion av artikelkort enligt branschstandard',
    highlights: [
      {
        type: 'improvement',
        title: 'Mjuk och naturlig animation vid expansion',
        description: 'Artikelkorten expanderar och fälls nu ihop med en avvägd övergång (320 ms / 240 ms) och en mjuk ease-out-kurva. Detta ersätter de tidigare abrupta hoppen med en behaglig och följsam läsupplevelse.'
      },
      {
        type: 'improvement',
        title: 'Sömlös ihopvikning och bildövergång',
        description: 'Med AnimatePresence och höjdanimation viks artikeln ihop lika mjukt som den vecklas ut, och fullbreddsbilden tonas fram utan hackiga layoutskiftningar.'
      }
    ]
  },
  {
    version: '2026.09.14.01',
    date: '2026-09-14',
    title: 'Notis-knappar, filter för låsta artiklar och fullständig svensk översättning',
    highlights: [
      {
        type: 'feature',
        title: 'Filterknapp för Låsta artiklar',
        description: 'En ny filterknapp "Låsta" har lagts till i verktygsraden. Med ett enkelt klick filtreras flödet fram så att endast dina sparade och skyddade artiklar visas, oavsett om de är lästa eller olästa.'
      },
      {
        type: 'improvement',
        title: 'Markera som läst direkt i notisen',
        description: 'Webb-notiser för nya artiklar har nu en direkt knapp för "Markera som läst". När knappen klickas stängs notisen och artikeln markeras som läst i bakgrunden utan att webbläsaren eller applikationen behöver öppnas.'
      },
      {
        type: 'improvement',
        title: 'Svensk översättning av dialoger och knappar',
        description: 'Prioriteringsdialogen för Prio-flödet samt filterknapparna i gränssnittet ("Visa lästa", "Dölj lästa", "Sök nyheter", "Markera alla som lästa") har översatts till ren svenska.'
      }
    ]
  },
  {
    version: '2026.09.13.11',
    date: '2026-09-13',
    title: 'Kompakt vattenfalls-layout (Masonry) för desktopflödet',
    highlights: [
      {
        type: 'improvement',
        title: 'Kompakt Vattenfall (Masonry)',
        description: 'Desktopflödet renderas nu i en dynamisk fler-kolumnlayout där varje artikelkort anpassar sig naturligt till sitt faktiska innehåll. De stora tomma hålrummen inuti kort och artificiella radglapp har eliminerats helt.'
      },
      {
        type: 'improvement',
        title: 'Oberoende kolumnflöde',
        description: 'Artiklarna fördelas jämnt över kolumnerna per dag. När ett kort expanderas fälls det ut mjukt i sin egen kolumn utan att tvinga intilliggande kort på samma rad att sträckas ut i onödan.'
      }
    ]
  },
  {
    version: '2026.09.13.10',
    date: '2026-09-13',
    title: 'Åtgärdad saknad import av Calendar-ikon',
    highlights: [
      {
        type: 'fix',
        title: 'Åtgärdad Calendar ReferenceError-krasch',
        description: 'Lade till den saknade importen av Calendar-ikonen från lucide-react i Dashboard, vilket omedelbart åtgärdar webbläsarkraschen vid rendering av datumavskiljare.'
      }
    ]
  },
  {
    version: '2026.09.13.09',
    date: '2026-09-13',
    title: 'Återförsök vid AI-fel och stabil svepning på samtliga artikelkort',
    highlights: [
      {
        type: 'fix',
        title: 'Smidig swipe på alla kort inklusive det första',
        description: 'Avlägsnade felaktig pointer-blockering och tilldelade unika nycklar till samtliga swipe-kort. Det första kortet i flödet reagerar nu omedelbart och följsamt på horisontella sveprörelser.'
      },
      {
        type: 'improvement',
        title: 'Automatisk retry-mekanism för AI-analys',
        description: 'Om analys via LM Studio misslyckas för en artikel görs nu upp till 3 automatiska återförsök med tidsfördröjning istället för att artikeln avbryts direkt. Tidigare misslyckade artiklar återställs automatiskt för ny analys.'
      }
    ]
  },
  {
    version: '2026.09.13.08',
    date: '2026-09-13',
    title: 'Expanderbar bild till fullbredd vid klick på artikelkort',
    highlights: [
      {
        type: 'improvement',
        title: 'Fullbreddsbild vid expansion i kompakt läge',
        description: 'När ett artikelkort expanderas (via knappen eller klick på tumnageln) förstoras bilden automatiskt från den lilla sidotumnageln till en stor, högupplöst fullbreddsbild. Detta underlättar läsningen och bildgranskningen särskilt på mobila skärmar.'
      },
      {
        type: 'improvement',
        title: 'Svenska ingress- och källnotiser',
        description: 'Översatte resterande engelska ledtexter och knappar i händelsevyn till ren svenska.'
      }
    ]
  },
  {
    version: '2026.09.13.07',
    date: '2026-09-13',
    title: 'Helt transparent bottenrad utan gråa knappbakgrunder',
    highlights: [
      {
        type: 'fix',
        title: 'Konsekvent genomskinliga bottenknappar',
        description: 'Ersatte HTML-knapptaggen för Flöden med ett renodlat ankarelement samt nollställde samtliga bakgrundsdeklarationer så att varken Flöden eller övriga knappar får gråa eller opaka bakgrundsplattor.'
      },
      {
        type: 'improvement',
        title: 'Svenska navigationstexter i bottenmenyn',
        description: 'Översatte My Feeds och underliggande länkar till svenska (Mina flöden, Alla flöden och Prio-flöde).'
      }
    ]
  },
  {
    version: '2026.09.13.06',
    date: '2026-09-13',
    title: 'Kompakt layout med sidotumnagel samt Clickbait-standardisering',
    highlights: [
      {
        type: 'improvement',
        title: 'Sidotumnagel i kompakt läge (Väg 2)',
        description: 'Artikelbilder visas nu som eleganta tumnaglar vid sidan av rubriken i kompakt läge, vilket ger spikraka och harmoniska rader utan tomma hål mellan raderna.'
      },
      {
        type: 'improvement',
        title: 'Standardisering till Clickbait',
        description: 'Samtliga benämningar för klickbete har uppdaterats konsekvent till det etablerade begreppet Clickbait i hela gränssnittet och analysen.'
      }
    ]
  },
  {
    version: '2026.09.13.05',
    date: '2026-09-13',
    title: 'Åtgärdad bakgrundsfärg för knappen Flöden i mörkt tema',
    highlights: [
      {
        type: 'fix',
        title: 'Transparent bakgrund på Flöden-knappen',
        description: 'Knappen Flöden i den mobila bottenraden har nu transparent bakgrund i alla teman istället för webbläsarens vita standardknapp-bakgrund vid mörkt tema.'
      }
    ]
  },
  {
    version: '2026.09.13.04',
    date: '2026-09-13',
    title: 'Kompakt & dynamisk flödeslayout i desktop samt val i Inställningar',
    highlights: [
      {
        type: 'improvement',
        title: 'Kompakt flödeslayout (ingen dödyta)',
        description: 'Kort i flödet anpassar nu sin höjd dynamiskt efter sitt faktiska innehåll med balanserad bildhöjd och knappar direkt under innehållet, vilket eliminerar stora tomma ytor.'
      },
      {
        type: 'feature',
        title: 'Inställningsval för flödeslayout',
        description: 'Lagt till inställning under Gränssnitt för att enkelt växla mellan ny kompakt layout och den klassiska sträckta layouten (original UI).'
      }
    ]
  },
  {
    version: '2026.09.13.03',
    date: '2026-09-13',
    title: 'Åtgärdat glapp och osynliga kort vid swipe av översta artikelkortet',
    highlights: [
      {
        type: 'fix',
        title: 'Stabil nyckelhantering för artikelflödet',
        description: 'Ersatt index-baserade nycklar med unika artikel-ID:n i listan. Detta förhindrar att efterföljande artikel ärver ut-toningsläge och blir osynlig när det översta kortet sveps bort.'
      },
      {
        type: 'improvement',
        title: 'Mjuk positionsövergång vid borttagning',
        description: 'Korten under glider nu mjukt och naturligt uppåt när ett överliggande kort försvinner, vilket eliminerar alla visuella tomrum och glapp i flödet.'
      }
    ]
  },
  {
    version: '2026.09.13.02',
    date: '2026-09-13',
    title: 'Mjuk swipe-fade och naturlig ut-toning vid markering av artikelkort',
    highlights: [
      {
        type: 'improvement',
        title: 'Mjuk ut-toning vid swipe (Fade Out)',
        description: 'När ett kort sveps och släpps glider det vidare i svepriktningen och tonar ut mjukt under 220 millisekunder istället för att försvinna tvärt, vilket ger en silkeslen övergång.'
      }
    ]
  },
  {
    version: '2026.09.13.01',
    date: '2026-09-13',
    title: 'Omgjord ämnesradar för trendande nyckelord samt optimerad layout i Insiktsvyn',
    highlights: [
      {
        type: 'improvement',
        title: 'Uppflyttad kvalitetsradar och ClickBait-topp',
        description: 'Högsta kvalitetsindex och ClickBait-toppen visas nu direkt efter KPI-korten för omedelbar tillgång till källornas redaktionella profil.'
      },
      {
        type: 'feature',
        title: 'Ny smart ämnesradar för trendande nyckelord',
        description: 'Helt omarbetad ämnesanalys med tidsviktning och källspridning som lyfter fram de mest omtalade nyhetsämnena just nu, normaliserade taggar och rensning av brus.'
      }
    ]
  },
  {
    version: '2026.09.12.38',
    date: '2026-09-12',
    title: 'Felrättning för variabelreferens i källstatistik och insikter',
    highlights: [
      {
        type: 'fix',
        title: 'Återställd variabeltilldelning för mest/minst aktiv källa',
        description: 'Åtgärdat NameError där most_active och least_active saknades vid sammanställning av källanalysen, samt säkrat fallback-strukturen för kategorier och taggar.'
      }
    ]
  },
  {
    version: '2026.09.12.37',
    date: '2026-09-12',
    title: 'Kategori- och tagginsikter i Insiktsvyn',
    highlights: [
      {
        type: 'feature',
        title: 'Kategorifördelning & Ämnesanalys',
        description: 'Översikt med volymer, progress-bars, sortering och fördelning av olästa artiklar, prio-andel samt ClickBait-grad per ämneskategori i nyhetsflödet.'
      },
      {
        type: 'feature',
        title: 'Trendande taggar & Taggmoln',
        description: 'Interaktivt taggmoln med frekvensanalys över AI-genererade ämnesord och direkt sökfiltrering för snabb överblick av aktuella nyhetsämnen.'
      },
      {
        type: 'improvement',
        title: 'Språkanpassning för ClickBait',
        description: 'Standardiserat terminologin till ClickBait genomgående i Insikter och källstatistiken enligt applikationens språkregler.'
      }
    ]
  },
  {
    version: '2026.09.12.36',
    date: '2026-09-12',
    title: 'Stöd för att ångra och avbryta swipe genom att dra tillbaka kortet',
    highlights: [
      {
        type: 'fix',
        title: 'Ångra-funktion vid tillbakadragning',
        description: 'Om du passerat tröskeln men ångrar dig och drar kortet tillbaka mot mitten, avbryts åtgärden automatiskt med en diskret haptisk signal och ingen artikel markeras som läst när du släpper.'
      },
      {
        type: 'fix',
        title: 'Riktningsmedveten hastighetsdetektering',
        description: 'Hastighetsbaserade svep (flick) kräver nu att rörelsen rör sig utåt bort från mitten, vilket eliminerar oavsiktliga triggningar när kortet dras snabbt tillbaka mot utgångsläget.'
      }
    ]
  },
  {
    version: '2026.09.12.35',
    date: '2026-09-12',
    title: 'Finslipad mobil swipe-fysik med realtidshaptik och scrollprioritet',
    highlights: [
      {
        type: 'feature',
        title: 'Realtidshaptik vid tröskelpassering',
        description: 'Vibrationsfeedback triggas nu i exakt samma ögonblick som tröskeln passeras under dragningen, vilket ger ett tydligt mekaniskt klick i fingret innan man släpper.'
      },
      {
        type: 'feature',
        title: 'Scroll-prioritet och naturlig motståndsfri rörelse',
        description: 'Vertikal scroll prioriteras nu konsekvent framför horisontellt drag, vilket eliminerar ryckighet vid vanlig flödessurfing. Dynamisk visuell skalning och hastighetsbaserat kast (velocity swipe).'
      },
      {
        type: 'feature',
        title: 'Valbart reglage för swipe-gester i inställningar',
        description: 'Lade till en inställning i Inställningar -> Allmänt där swipe-gester för mobilkort enkelt kan aktiveras eller inaktiveras helt.'
      }
    ]
  },
  {
    version: '2026.09.12.34',
    date: '2026-09-12',
    title: 'Ökad swipe-tröskel och felrättning i Insikter',
    highlights: [
      {
        type: 'fix',
        title: 'Ökad swipe-tröskel till 125 px',
        description: 'Justerade tröskelvärdet för att markera artiklar som lästa/olästa från 75 px till 125 px för att helt förhindra oavsiktliga markeringar under snabb vertikal scrollning.'
      },
      {
        type: 'fix',
        title: 'Åtgärdat referensfel i Insikter-vyn',
        description: 'Lade till den saknade importen av ExternalLink-ikonen i inställningskomponenten vilket löser kraschen vid visning av källflödesdiagrammet.'
      }
    ]
  },
  {
    version: '2026.09.12.33',
    date: '2026-09-12',
    title: 'Swipe-snabbhantering för mobil samt Källstatistik och Insikter',
    highlights: [
      {
        type: 'feature',
        title: 'Swipe-gester för snabb markering som läst/oläst',
        description: 'Svep artikelkortet åt höger eller vänster för att snabbt markera som läst eller oläst med haptisk vibration och grön bakgrundsindikator. Fullt anpassat för både höger- och vänsterhänta användare. Låsning sker fortsatt tryggt och uteslutande via Lås-knappen.'
      },
      {
        type: 'feature',
        title: 'Insikter och källstatistik med inaktivitetsdetektor',
        description: 'Ny dedikerad flik "Insikter" i Inställningar med volymdiagram över mest och minst aktiva flöden, varningar för flöden som eventuellt har slutat uppdatera sig, samt kvalitetsradar och klickbetesanalys per nyhetskälla.'
      }
    ]
  },
  {
    version: '2026.09.12.32',
    date: '2026-09-12',
    title: 'Enkel slimmad toast-design utan dubbla rutor',
    highlights: [
      {
        type: 'ui',
        title: 'Borttagning av dubbla rutor i toasts',
        description: 'Åtgärdade kapslad CSS-styling där både toastens wrapper och inre status-behållare fick ramar och bakgrunder. Toasts renderas nu som en enda ren, slimmad och elegant ruta med 8 px rundade hörn.'
      },
      {
        type: 'ui',
        title: 'Svensk översättning av flödesuppdateringar och delningsmeddelanden',
        description: 'Översatte flödesuppdaterings-toast till svenska ("X nya händelser från [flöde]!") och delningsnotis till "Kopierad till urklipp!".'
      }
    ]
  },
  {
    version: '2026.09.12.31',
    date: '2026-09-12',
    title: 'Kompaktare text i söknings-toast',
    highlights: [
      {
        type: 'ui',
        title: 'Kortare toast-text vid flödessökning',
        description: 'Ändrade notistexten vid avsökning av nya artiklar från "Söker nya händelser: [flöde]..." till det mer kompakta "Söker: [flöde]" så att notisen konsekvent ryms på en rad.'
      }
    ]
  },
  {
    version: '2026.09.12.30',
    date: '2026-09-12',
    title: 'Renodlat kortformat och borttagning av redundant källikon i taggraden',
    highlights: [
      {
        type: 'ui',
        title: 'Renare artikelkort utan plottrighet',
        description: 'Tog bort den extra källikonen från taggraden längst ner i artikelkortet. Källikonen visas nu uteslutande på sin naturliga och tydliga plats i toppbaren (22 px hög med vit bakgrund) bredvid källnamnet.'
      }
    ]
  },
  {
    version: '2026.09.12.29',
    date: '2026-09-12',
    title: 'Finjusterad toast-positionering strax ovanför mobilens bottenmeny',
    highlights: [
      {
        type: 'ui',
        title: 'Toast placerad strax över bottenmenyn',
        description: 'Justerade bottenavståndet för toasts på mobila skärmar så att notiser lägger sig strax över mobilens bottenmeny (8 px ovanför menyn) istället för att hamna för högt upp på skärmen.'
      }
    ]
  },
  {
    version: '2026.09.12.28',
    date: '2026-09-12',
    title: 'Automatisk statuskontroll och synkronisering av pushnotiser vid app-start och PWA-uppdateringar',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk verifiering av enhetens push-prenumeration',
        description: 'Appen kontrollerar och återskapar nu automatiskt enhetens push-prenumeration vid omstart och PWA-uppdateringar om behörighet redan är beviljad. Användaren behöver aldrig mer klicka manuellt på Aktivera pushnotiser efter en uppdatering.'
      },
      {
        type: 'performance',
        title: 'Intelligent synkronisering utan server-brus',
        description: 'Implementerade 24-timmars cache och endpoint-verifiering. Vanliga sidladdningar och pull-to-refresh skickar noll onödiga nätverksanrop mot servern när prenumerationen redan är aktiv och synkad.'
      }
    ]
  },
  {
    version: '2026.09.12.27',
    date: '2026-09-12',
    title: 'Större källogotyper och kompaktare inställningsikon i bottenmenyn',
    highlights: [
      {
        type: 'ui',
        title: 'Framträdande källogo och källbricka i artikelkort',
        description: 'Ökade källikonens höjd i toppbaren till 22px för att fylla ut raden, samt introducerade en distinkt 34x34px källbricka med källnamn och snabbfiltrering på taggraden längst ner till höger.'
      },
      {
        type: 'ui',
        title: 'Endast ikon för Inställningar i mobilens bottenmeny',
        description: 'Tog bort texten INSTÄLLNINGAR under kugghjulet i bottenmenyn på mobilen för ett renare uttryck och mer utrymme för övriga flikar.'
      }
    ]
  },
  {
    version: '2026.09.12.26',
    date: '2026-09-12',
    title: 'Flödesikoner i artikelkort och tydligare aktiv flik i bottenmenyn',
    highlights: [
      {
        type: 'feature',
        title: 'Flödesikoner och logotyper i artikelkorten',
        description: 'Implementerade stöd för källspecifika ikoner/logotyper (ur RSS <image>, Atom <icon>/<logo> samt automatisk favicon-fallback) i både moderna och klassiska kort samt i klusterkällor och sidomeny.'
      },
      {
        type: 'ui',
        title: 'Tydlig aktiv flik i mobilens bottenmeny',
        description: 'Förstärkte aktivt flikläge i mobilmenyn med en mjuk bakgrundskapsel, topp-indikatorlinje, fet text och uppskalad ikon så att den aktiva vyn syns tydligt.'
      }
    ]
  },
  {
    version: '2026.09.12.25',
    date: '2026-09-12',
    title: 'UI-förbättring: Ny toast-design i botten av skärmen',
    highlights: [
      {
        type: 'ui',
        title: 'Placering i botten ovanför navigeringen',
        description: 'Flyttade toasts till skärmens nederkant (ovanför bottenmenyn på mobilen och centrerat i botten på datorn) för att inte skymma toppinnehåll.'
      },
      {
        type: 'ui',
        title: 'Mörk fyrkantig stil med hög synlighet',
        description: 'Bytte ut den runda pillerformen mot en distinkt mörk rektangulär design med subtil ram, större typsnitt, hög kontrast och automatisk begränsning till max 2 rader text.'
      }
    ]
  },
  {
    version: '2026.09.12.24',
    date: '2026-09-12',
    title: 'Frikoppling av push-synk vid flödesuppdatering och pull-to-refresh',
    highlights: [
      {
        type: 'feature',
        title: 'Branschstandard för Web Push-initiering',
        description: 'Tog bort automatisk push-prenumerationskontroll från appens startflöde och omladdning. Att dra nedåt i mobilflödet för att uppdatera nyheter rör inte längre push-servrarna.'
      },
      {
        type: 'ui',
        title: 'Isolerad pushhantering till inställningar',
        description: 'Pushnotis-kontroller och enhetslistning körs nu uteslutande när användaren faktiskt navigerar till Notisfliken under Inställningar.'
      }
    ]
  },
  {
    version: '2026.09.12.23',
    date: '2026-09-12',
    title: 'Stabila enhets-ID:n för Web Push och eliminering av enhetsdubbletter',
    highlights: [
      {
        type: 'feature',
        title: 'Klientbaserat stabilt enhets-ID',
        description: 'Införde unika beständiga enhets-ID:n per webbläsare i localStorage som skickas med i alla anrop, vilket säkerställer att återkommande sessioner återanvänder samma enhetspost.'
      },
      {
        type: 'fix',
        title: 'Eliminerade återregistrering och tokengenerering vid refresh',
        description: 'Tog bort den opålitliga byte-jämförelsen mot PushManager på mobila Chromium-enheter. Befintliga pushprenumerationer återanvänds nu stabilt utan att kasta bort FCM-token vid siduppdatering.'
      },
      {
        type: 'feature',
        title: 'Automatisk sanering av gamla enhetsregistreringar',
        description: 'Backend genomför nu automatisk sammanslagning och städning av föräldralösa registreringar från samma webbläsare så att listan över aktiva enheter hålls ren och korrekt.'
      }
    ]
  },
  {
    version: '2026.09.12.22',
    date: '2026-09-12',
    title: 'Geografisk platsvalidering vid händelseklustring och UI-förbättringar',
    highlights: [
      {
        type: 'feature',
        title: 'Geografisk platskontroll vid klustring',
        description: 'Införde automatisk orts- och platsvalidering som förhindrar att händelser på olika platser i landet (t.ex. Sollefteå vs Östermalm) slås ihop, samt skärpte AI-embedding-tröskeln för blåljusartiklar.'
      },
      {
        type: 'ui',
        title: 'Korrigerat z-index och marginal för sidfältsknappen',
        description: 'Höjde z-index för sidofältets minimeringsknapp och ökade vänsteravståndet i den klistrade toppbaren på desktop så att sökfältet inte klipper eller överlappar knappen.'
      },
      {
        type: 'ui',
        title: 'Optimerad ändringsloggs-modal på mobil',
        description: 'Byggde om modalen till en ren och luftig bottom-sheet på mobila skärmar, eliminerade ruta-i-ruta-effekten och gav alla notiser ordentligt med läsutrymme.'
      },
      {
        type: 'ui',
        title: 'Renodlat rapport-kort i mobilflödet',
        description: 'Tog bort ordet "Briefing" ur rubriken så att endast "Morgonrapport" eller "Kvällsrapport" med datum visas, samt ökade kortets höjd och klickzon med ca 30% för bättre läsbarhet och ergonomi.'
      },
      {
        type: 'feature',
        title: 'Realtidsklustring av artiklar',
        description: 'Synkroniserade embedding och topic-klustring med AI-bearbetningen så att sammanhängande nyhetsartiklar klustras ihop direkt i gränssnittet utan att användaren behöver byta flik.'
      },
      {
        type: 'fix',
        title: 'Tydlig [POLL] loggning i Docker',
        description: 'Återinförde [POLL: användare] prefixet vid varje flödesavstämning och loggar nu tydligt både när det finns nya artiklar (med antal och ID-intervall) och när det är 0 nya artiklar.'
      }
    ]
  },
  {
    version: '2026.09.12.17',
    date: '2026-09-12',
    title: 'Fast klistrad toppbar och diskret feed-polling-avisering',
    highlights: [
      {
        type: 'ui',
        title: 'Fast klistrad toppbar (Sticky header)',
        description: 'Gjorde verktygsraden med sök och "markera alla som lästa" permanent fastklistrad i toppen av skärmen så att den alltid finns till hands när man scrollar i flödet och prio-fliken.'
      },
      {
        type: 'ui',
        title: 'Diskret polling-avisering på svenska',
        description: 'Gjorde feed-hämtningens popup till en kompakt, diskret liten piller-avisering på svenska med kortare visningstid och automatisk stängning så fort hämtningen slutförts.'
      }
    ]
  },
  {
    version: '2026.09.12.16',
    date: '2026-09-12',
    title: 'Tydliga och responsiva knappar för inställningsflikar',
    highlights: [
      {
        type: 'ui',
        title: 'Responsiva flikknappar',
        description: 'Byggde om inställningsflikarna till strukturerade och tryckvänliga knappar med enhetliga ikoner för alla flikar (Allmänt, Hantera flöden, Utseende, Databas, Notiser, AI-analys).'
      },
      {
        type: 'ui',
        title: 'Svenska texter i systeminformation',
        description: 'Översatte alla kvarvarande engelska texter och felsökningsknappar i inställningsfliken till svenska.'
      }
    ]
  },
  {
    version: '2026.09.12.15',
    date: '2026-09-12',
    title: 'Enradig och kompakt AI-analyslogg i Docker',
    highlights: [
      {
        type: 'ui',
        title: 'Enradig AI-logg',
        description: 'Formaterade om loggutskriften för AI-analyserade artiklar så att användare, källa, ID, kategori, prioritet, svarstid och titel ryms på en enda koncis rad.'
      }
    ]
  },
  {
    version: '2026.09.12.14',
    date: '2026-09-12',
    title: 'Renodlad och koncis RSS-flödesloggning i Docker',
    highlights: [
      {
        type: 'fix',
        title: 'Renare format för flödesinläsning',
        description: 'Tog bort det tekniska "Polling feed"-meddelandet och behöll det rena formatet "Loading and parsing RSS feed: [Källa]" i containerns loggström.'
      }
    ]
  },
  {
    version: '2026.09.12.13',
    date: '2026-09-12',
    title: 'Sanering av överflödig logginformation i backend',
    highlights: [
      {
        type: 'fix',
        title: 'Borttagen redundant RSS-loggning',
        description: 'Tog bort den överflödiga "Loading and parsing RSS feed"-loggen från rss_parser.py som dubblerade "Polling feed"-informationen i containerns loggström.'
      }
    ]
  },
  {
    version: '2026.09.12.12',
    date: '2026-09-12',
    title: 'Statisk toppbar och borttagen text "Dagens Nyheter"',
    highlights: [
      {
        type: 'ui',
        title: 'Borttagen text "Dagens Nyheter"',
        description: 'Tog bort den statiska rubriken "DAGENS NYHETER" från flödeshuvudet eftersom flödet kan innehålla artiklar från tidigare dagar.'
      },
      {
        type: 'ui',
        title: 'Fast toppbar (icke-klibbande)',
        description: 'Ändrade verktygsfältet (toppbaren) så att den sitter fast i sidans topp och inte klibbar/följer med när användaren scrollar ner i flödet eller prio-fliken.'
      }
    ]
  },
  {
    version: '2026.09.12.11',
    date: '2026-09-12',
    title: 'Förstärkt svärta och kontrast för taggavdelaren',
    highlights: [
      {
        type: 'ui',
        title: 'Ökad svärta på kortets avdelare',
        description: 'Förstärkte kontrasten och opaciteten på avdelaren mellan sammanfattningen och taggarna så att den syns distinkt och tydligt i både ljust och mörkt läge.'
      }
    ]
  },
  {
    version: '2026.09.12.10',
    date: '2026-09-12',
    title: 'Återaktiverat Briefing-kort på mobil med ren titelsättning',
    highlights: [
      {
        type: 'fix',
        title: 'Återinfört expanderbart Briefing-kort i mobilflödet',
        description: 'Återaktiverade det kompakta AI-briefing-kortet i mobilvyn med uppdatering och expandering, med rubriken renodlad till Briefing istället för Dagens Briefing.'
      }
    ]
  },
  {
    version: '2026.09.12.09',
    date: '2026-09-12',
    title: 'Sömlös hörnpassning för moderna händelsekort',
    highlights: [
      {
        type: 'fix',
        title: 'Eliminerat pixelglapp i kortets övre hörn',
        description: 'Justerade hörnradie (border-top-left-radius) och harmoniserade toppkantens färg med kortets tema för att ta bort subpixel-glipan mellan kortets ram och toppbaren.'
      }
    ]
  },
  {
    version: '2026.09.12.08',
    date: '2026-09-12',
    title: 'Mobil rubrikstorlek och elegant avdelare för taggar',
    highlights: [
      {
        type: 'ui',
        title: 'Ökad rubrikstorlek i mobilvy',
        description: 'Justerade händelsekortens titel på mobila skärmar till 0.98rem med tydligare tyngd (font-weight: 600) och radavstånd för förbättrad läsbarhet.'
      },
      {
        type: 'ui',
        title: 'Snygg avdelare mellan sammanfattning och taggar',
        description: 'Införde en stilren och diskret gradient-avdelare som harmoniskt separerar AI-sammanfattningen från kategorier och taggar.'
      }
    ]
  },
  {
    version: '2026.09.12.07',
    date: '2026-09-12',
    title: 'UI-optimering: Proportioner och yta för kortets topp- och bottenrad',
    highlights: [
      {
        type: 'ui',
        title: 'Ökad höjd och luftighet i kortets toppbar (+30%)',
        description: 'Justerade padding och min-height i moderna händelsekortens toppbar så att tidsblock, källnamn och ikoner får en balanserad och stabil presentation.'
      },
      {
        type: 'ui',
        title: 'Kompaktare bottenrad (-30%)',
        description: 'Minskade bottenbarens höjd och knapparnas vertikala utrymme med 30 procent för att spara skärmyta och ge fokus åt nyhetsinnehållet.'
      },
      {
        type: 'fix',
        title: 'Rensat källnamn och borttagen dubblettkategori',
        description: 'Tog bort kategoriknappen ur kortets toppbar eftersom den redan visas bland taggarna, vilket ger källans namn fullt utrymme utan avklippning.'
      }
    ]
  },
  {
    version: '2026.09.12.06',
    date: '2026-09-12',
    title: 'Åtgärd för horisontell scrollbar och breddpassning på mobil',
    highlights: [
      {
        type: 'fix',
        title: 'Korrigerad toppbar-marginal på mobil',
        description: 'Justerade toppbarens negativa sidomarginal på mobiler för att exakt matcha containerns nya minimala sidopadding, vilket eliminerar elementets utstick.'
      },
      {
        type: 'fix',
        title: 'Globalt skydd mot horisontellt spill',
        description: 'Applicerade strikt breddkontroll och overflow-x: hidden på root, app-container och huvudvy så att oönskade scrollbars i botten förhindras.'
      },
      {
        type: 'ui',
        title: 'Optimerad flex-krympning i bottenraden',
        description: 'Säkerställde att knapparna i kortets bottenrad kan skala och krympa mjukt även på extra smala mobilskärmar utan att pressa ut kortets totala bredd.'
      }
    ]
  },
  {
    version: '2026.09.12.05',
    date: '2026-09-12',
    title: 'Touch-vänlig bottenrad för händelsekort med namngivna knappar',
    highlights: [
      {
        type: 'ui',
        title: 'Dedikerad bottenrad i källans temafärg',
        description: 'Åtgärdsikonerna har flyttats från den trånga toppbaren till en rymlig bottenrad (bottombar) som matchar toppbaren i källans temafärg.'
      },
      {
        type: 'ui',
        title: 'Tydliga och namngivna knappar för mobil',
        description: 'Ersatt svårtryckta miniatyrikoner med rymliga touch-knappar med textetiketter ("Läst/Oläst", "Lås/Lås upp", "Dela", "Läs hela"), optimerade för enhandsanvändning på mobil.'
      },
      {
        type: 'ui',
        title: 'Renare och luftigare toppbar',
        description: 'Toppbaren fokuserar nu enbart på tidsbricka, källnamn och kategoritaggar utan trängsel.'
      }
    ]
  },
  {
    version: '2026.09.12.04',
    date: '2026-09-12',
    title: 'Modernt händelsekort, färgad toppbar och stilväljare',
    highlights: [
      {
        type: 'feature',
        title: 'Ny modern kortdesign med färgad toppbar och 4px accentlist',
        description: 'En helt ny modern kortlayout med källfärg i toppbaren och en 4px vertikal accentlist längs kanten. AI-sammanfattningen och händelserubriken använder 100% av kortets bredd.'
      },
      {
        type: 'feature',
        title: 'Maximerad mobilvy och minimerad sidobredd',
        description: 'Sidomarginaler och döda zoner i mobilläget har minskats med över 65-90%, vilket ger väsentligt mer läsyta för text och nyheter på mindre skärmar.'
      },
      {
        type: 'feature',
        title: 'Stilväljare i Inställningar (Klassisk eller Modernt)',
        description: 'Välj själv hur händelsekorten ska presenteras under Inställningar -> Utseende: Klassisk vy med sidopanel eller Modernt format med färgad toppbar och full bredd.'
      },
      {
        type: 'fix',
        title: 'Komplett svensk lokalisering i nyhetsflödet',
        description: 'Åtgärdat engelska texter såsom "TODAY\'S NEWS" till "DAGENS NYHETER", datumavdelare till svenskt format (sv-SE) samt "Läs hela händelsen".'
      }
    ]
  },
  {
    version: '2026.09.12.03',
    date: '2026-09-12',
    title: 'Nya källor i katalogen: Krisinformation och Sjöräddningen',
    highlights: [
      {
        type: 'feature',
        title: 'Krisinformation och Sjöräddningen tillagda i katalogen',
        description: 'Katalogen har utökats med två viktiga blåljus- och säkerhetskällor: Krisinformation (MSB) och Sjöräddningen Hela landet (SSRS). Båda kan nu enkelt utforskas och läggas till med ett klick.'
      }
    ]
  },
  {
    version: '2026.09.12.02',
    date: '2026-09-12',
    title: 'Användaruppdelad MQTT-arkitektur och garanterad flödespublicering',
    highlights: [
      {
        type: 'feature',
        title: 'Dedikerade MQTT-ämnen per användare',
        description: 'MQTT-strukturen är nu helt uppdelad per användare: flöden publiceras på {prefix}/{användare}/feeds/{feed_slug} och prioriterade händelser på {prefix}/{användare}/prio.'
      },
      {
        type: 'feature',
        title: 'Användarkontext i JSON-nyttolasten',
        description: 'Varje meddelande innehåller nu fälten user och user_id vilket gör det enkelt för Home Assistant och hemautomation att filtrera och dirigera notiser per person.'
      },
      {
        type: 'fix',
        title: 'Frikopplad MQTT-leverans för alla användare',
        description: 'Åtgärdade en logisk spärr där användare utan AI-prioritering eller med många samtidiga artiklar inte fick sina flöden skickade till MQTT. Samtliga användares flöden och bevakningsord levereras nu tillförlitligt i realtid.'
      }
    ]
  },
  {
    version: '2026.09.12.01',
    date: '2026-09-12',
    title: 'Sanering av RSS-katalogen och fullständig svensk flödeshantering',
    highlights: [
      {
        type: 'feature',
        title: 'Total genomsökning och sanering av RSS-katalogen',
        description: 'Samtliga 287 svenska källor i katalogen har kontrollerats och validerats mot aktiva endpoints. 17 trasiga och nedlagda flöden har rensats bort och 31 källor har uppdaterats till sina nya permanenta adresser.'
      },
      {
        type: 'ui',
        title: 'Komplett svensk flödeshanterare',
        description: 'Dialogrutan och formulären för att utforska katalogflöden och hantera egna källor har översatts till svenska utan några engelska fragment.'
      }
    ]
  },
  {
    version: '2026.09.11.07',
    date: '2026-09-11',
    title: 'Automatisk artikel-skrapning före AI-analys och svensk Utseende-flik',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk artikel-skrapning före AI-analys',
        description: 'Systemet hämtar nu automatiskt webbsidans faktiska brödtext innan AI-sammanfattningen genereras. Detta gör att AI-modellen har tillgång till hela händelsen och kan avslöja vad klickbeten döljer (t.ex. orsaker eller namn) direkt i första meningen.'
      },
      {
        type: 'performance',
        title: 'Blixtsnabb artikelöppning via sparad brödtext',
        description: 'Den skrapade texten sparas nu direkt i databasen, vilket innebär att artiklar öppnas omedelbart vid klick i flödet utan att behöva skrapas på nytt.'
      },
      {
        type: 'ui',
        title: 'Fullständig svensk Utseende-flik med ny switch',
        description: 'Fliken Utseende är nu helt på svenska, och du kan enkelt slå av eller på automatisk artikel-skrapning för AI direkt i gränssnittet.'
      }
    ]
  },
  {
    version: '2026.09.11.06',
    date: '2026-09-11',
    title: 'Automatisk tyst synkronisering av pushnotiser och förtydligad status',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk tyst återsynkronisering',
        description: 'Webbläsaren kontrollerar nu automatiskt vid appstart och Service Worker-uppdateringar att pushprenumerationen matchar serverns VAPID-nyckel och återregistrerar tyst vid behov, så att du aldrig behöver förnya manuellt efter en appuppdatering.'
      },
      {
        type: 'ui',
        title: 'Tydlig statusindikator i inställningar',
        description: 'När pushnotiser är aktiva visas en grön statusindikator "Aktiv och synkroniserad" istället för en missvisande förnyelseknapp. En manuell knapp för att förnya prenumerationen finns kvar diskret vid eventuell felsökning.'
      },
      {
        type: 'ui',
        title: 'Svenska texter i hela notishanteraren',
        description: 'Alla texter, knappar, bekräftelsedialoger och listor över anslutna enheter i notisfliken är nu helt på svenska.'
      }
    ]
  },
  {
    version: '2026.09.11.05',
    date: '2026-09-11',
    title: 'Fullständig svensk dokumentation i README.md och versionsspårbarhet',
    highlights: [
      {
        type: 'docs',
        title: 'Fullständig svensk README.md',
        description: 'Hela projektets dokumentation, arkitektur, funktioner, MQTT-specifikation och driftsinstruktioner har översatts till ren och tydlig svenska.'
      }
    ]
  },
  {
    version: '2026.09.11.04',
    date: '2026-09-11',
    title: 'Automatisk schemaläggning (kl 07:00 & 18:00) och ny Briefing-flik med Historik',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk schemalagd generering i bakgrunden',
        description: 'Backend kör nu en kontinuerlig schemaläggningsloop som automatiskt genererar en färsk morgonrapport kl 07:00 och en kvällsrapport kl 18:00 via lokal AI (LM Studio), så att rapporten alltid ligger klar när du öppnar appen.'
      },
      {
        type: 'ui',
        title: 'Dedikerad flik för Briefing på desktop',
        description: 'Skapat en egen flik i sidomenyn på desktop för Dagens Briefing, vilket ger en ren och ostörd läsupplevelse och håller det ordinarie Dashboard-flödet fritt från onödiga element.'
      },
      {
        type: 'feature',
        title: 'Historik & Arkiv över tidigare rapporter',
        description: 'I den nya Briefing-fliken kan du bläddra bland alla tidigare genererade morgon- och kvällsrapporter och se vad som hände under tidigare dagar med fullständiga källhänvisningar.'
      },
      {
        type: 'ui',
        title: 'Bibehållet mobilkort med direktlänk till historik',
        description: 'På mobila enheter ligger det slimmade, ultrakompakta toppkortet kvar i flödet med en smidig länk för att öppna den fullständiga historikvyn vid behov.'
      }
    ]
  },
  {
    version: '2026.09.11.03',
    date: '2026-09-11',
    title: 'Ultrakompakt mobilvy och fullt Markdown-stöd i Dagens Briefing',
    highlights: [
      {
        type: 'ui',
        title: 'Ultrakompakt och slimmad mobilvy',
        description: 'Dagens Briefing har bantats ned till en extremt slimmad och diskret list i hopfällt läge som inte stjäl vertikal yta från nyhetsflödet på mobiler. Teasertext har tagits bort i hopfällt läge för maximal skärmeffektivitet.'
      },
      {
        type: 'feature',
        title: 'Fullständigt Markdown-stöd vid expandering',
        description: 'Briefingen tolkar och renderar nu fetstil, rubriker, numrerade listor och snygga punktlistor strukturerat istället för rå text, vilket ger ett luftigt och lättläst format.'
      },
      {
        type: 'fix',
        title: 'Permanent synlighet i huvudflödet',
        description: 'Dagens Briefing ligger nu placerad ovanför artikellistan och förblir alltid tillgänglig även när alla artiklar är markerade som lästa.'
      }
    ]
  },
  {
    version: '2026.09.11.02',
    date: '2026-09-11',
    title: 'Nyhetsklustring och Dagens Briefing (AI Digest toppkort)',
    highlights: [
      {
        type: 'feature',
        title: 'Nyhetsklustring och dubletthantering (Topic Clustering)',
        description: 'Artiklar från olika källor som rapporterar om samma nyhetshändelse grupperas nu automatiskt ihop via semantiska vektorer eller text-heuristik. Flödet blir rent och överskådligt med källbrickor som visar vilka andra redaktioner som rapporterar om händelsen.'
      },
      {
        type: 'feature',
        title: 'Dagens Briefing som expanderbart toppkort',
        description: 'Ett stilrent expanderbart toppkort överst i nyhetsflödet som ger en snabb morgon- eller kvällsrapport av dagens viktigaste händelser. Kan expanderas för att läsa punkterna och klicka sig direkt till berörda artiklar.'
      },
      {
        type: 'improvement',
        title: 'Full funktionalitet även utan lokal AI',
        description: 'Klustringen har inbyggd heuristisk textmatchning som fångar liknande rubriker och händelser även om LM Studio är avstängt, och briefingkortet erbjuder regelbaserad sammanställning.'
      }
    ]
  },
  {
    version: '2026.09.11.01',
    date: '2026-09-11',
    title: 'Strömlinjeformad mobil bottombar och centraliserad administration',
    highlights: [
      {
        type: 'ui',
        title: 'Ny mobil bottombar med 5 dedikerade knappar',
        description: 'Mobilmenyn har förenklats till exakt 5 knappar: HOME, PRIO, CHATT, FEEDS och SETTINGS. Detta ger generösare touch-ytor och en ren layout utan trängsel på smala skärmar.'
      },
      {
        type: 'improvement',
        title: 'Flödeshantering integrerad som flik i Inställningar',
        description: 'Hantera RSS-flöden har flyttats in som en egen underflik i Inställningar (Settings -> Hantera flöden) med direktlänkning och bibehållen full funktionalitet.'
      },
      {
        type: 'improvement',
        title: 'Utloggning flyttad till Allmänt i Inställningar',
        description: 'Utloggningsknappen har flyttats från menyraden till Inställningar -> Allmänt under ett eget användarkort som visar inloggad profil.'
      }
    ]
  },
  {
    version: '2026.09.10.02',
    date: '2026-09-10',
    title: 'Realtids-progressbar i händelsekort och noll fördröjning till AI-analys',
    highlights: [
      {
        type: 'feature',
        title: 'Realtids-progressbar i varje händelsekort',
        description: 'Nya artiklar i flödet visar nu en dynamisk progressbar (0 till 100 procent) under AI-berikningen. Den återspeglar prompt-bearbetningen och förberedelsen i LM Studio i realtid med fasindikator och procenttal.'
      },
      {
        type: 'improvement',
        title: 'Eliminerad fördröjning för inkommande artiklar',
        description: 'Bakgrundsmotorn har uppgraderats med en händelsedriven signal (asyncio.Event). När nya artiklar sparas från RSS väcks AI-analysen omedelbart utan att vänta ut sovcykler.'
      },
      {
        type: 'ui',
        title: 'Svenska texter och mjuk laddningsanimering',
        description: 'Laddningsytan på artiklarna har försvenskats helt och fått en mjuk glidande animationslinje medan artikeln väntar i analyskön.'
      }
    ]
  },
  {
    version: '2026.09.10.01',
    date: '2026-09-10',
    title: 'Optimerade marginaler och bredare layout i AI-chatten',
    highlights: [
      {
        type: 'improvement',
        title: 'Minskade marginaler mot skärmkant och rullist',
        description: 'Justerade yttre padding och behållarens marginaler i AI-chatten så att frågekort och konversationsbubblor utnyttjar skärmytan maximalt utan onödigt tomrum mot skärmkanterna.'
      }
    ]
  },
  {
    version: '2026.09.09.16',
    date: '2026-09-09',
    title: 'Bredare layout och förbättrad marginal för GPU-progressbar',
    highlights: [
      {
        type: 'improvement',
        title: 'Minst 55-65% bredd för laddningsbubblan',
        description: 'Assistentbubblan och progressbaren täcker nu minst 55-65% av chattfönstrets bredd, vilket ger en luftig och tydlig vy där text och procentangivelse separeras snyggt.'
      }
    ]
  },
  {
    version: '2026.09.09.15',
    date: '2026-09-09',
    title: 'Realtids-progressbar och strömmande AI-svar från LM Studio',
    highlights: [
      {
        type: 'feature',
        title: 'Realtids-progressbar för GPU prompt processing',
        description: 'AI-chatten visar nu en direkt progressbar (0 till 100 procent) i takt med att LM Studio läser in och bearbetar artikelunderlaget i grafikkortets minne, hämtat direkt via LM Studios nativa händelseström.'
      },
      {
        type: 'feature',
        title: 'Ord-för-ord token-strömning (SSE)',
        description: 'Svaret strömmas nu fram i realtid direkt när första ordet beräknas, vilket eliminerar all väntetid och ger en omedelbar och dynamisk chattupplevelse.'
      }
    ]
  },
  {
    version: '2026.09.09.14',
    date: '2026-09-09',
    title: 'Global AiChatContext för flikbyte och utökad dokumentation',
    highlights: [
      {
        type: 'feature',
        title: 'Global AiChatContext med oavbruten fliknavigering',
        description: 'AI-chatten körs nu via en global React Context. Förfrågningar och svar genereras oavbrutet i bakgrunden även om du växlar till Dashboard eller hanterar flöden under tiden.'
      },
      {
        type: 'improvement',
        title: 'Aktivitetsindikator för AI i sidomenyn',
        description: 'En diskret pulserande indikator visas på länken till AI Chatt i sidomenyn så snart assistenten arbetar med att ta fram svar i bakgrunden.'
      },
      {
        type: 'documentation',
        title: 'Komplett arkitektur och dokumentation i README.md',
        description: 'Uppdaterat README.md med en dedikerad teknisk genomgång av AI-Chatten, semantisk hybrid-RAG med Nomic Embeddings v1.5, SQLite-vektorlagring samt dynamiska följdfrågor.'
      }
    ]
  },
  {
    version: '2026.09.09.13',
    date: '2026-09-09',
    title: 'Dynamiska AI-genererade följdfrågor i nyhetschatten',
    highlights: [
      {
        type: 'feature',
        title: '4 kontextuella följdfrågor genererade av AI',
        description: 'AI-assistenten formulerar nu automatiskt 4 skarpa och naturliga följdfrågor baserade på de specifika händelser och detaljer som den just rapporterat om.'
      },
      {
        type: 'improvement',
        title: 'Interaktiva klickbara frågechips',
        description: 'Följdfrågorna visas som eleganta klickbara knappar direkt under varje svar, vilket gör det enkelt att direkt klicka sig vidare och fördjupa dialogen kring aktuella nyheter.'
      }
    ]
  },
  {
    version: '2026.09.09.12',
    date: '2026-09-09',
    title: 'Atomisk SQLite UPSERT för vektorer och eliminerad kollision vid parallell bearbetning',
    highlights: [
      {
        type: 'fix',
        title: 'Atomisk SQLite UPSERT med on_conflict_do_update',
        description: 'Ersatte standard ORM-inlägg med atomisk sqlite_upsert i både save_article_embedding och batch_embed_articles, vilket eliminerar UNIQUE constraint race conditions vid batch-sparning.'
      },
      {
        type: 'improvement',
        title: 'Säker sessionshantering vid bakgrundsvektorisering',
        description: 'Implementerade safe_bg_save_embedding som garanterar ren och säker stängning av databassessioner vid asynkron artikelanalys.'
      }
    ]
  },
  {
    version: '2026.09.09.11',
    date: '2026-09-09',
    title: 'Semantisk vektorsökning (Hybrid RAG) med Nomic Embeddings och LM Studio',
    highlights: [
      {
        type: 'feature',
        title: 'Semantisk vektorsökning med Nomic Embeddings',
        description: 'Integrerat stöd för text-embedding-nomic-embed-text-v1.5 via LM Studio. Alla artiklar vektoriseras med 768 dimensioner i SQLite vilket ger djup förståelse för synonymer, ämnen och geografiska sammanhang.'
      },
      {
        type: 'feature',
        title: 'Hybrid RAG med Cosinus-likhet och exakt databasräkning',
        description: 'Sökningar i AI-chatten kombinerar nu semantisk cosinus-likhet med SQL-tidsfilter och nyckelordsbonus. Systemet skickar dessutom med exakt SQL COUNT-statistik så att modellen aldrig missar eller felräknar totalantalet händelser under ett dygn.'
      },
      {
        type: 'improvement',
        title: 'Automatisk bakgrundsvektorisering och mjuk fallback',
        description: 'Nya artiklar vektoriseras automatiskt i bakgrunden utan att fördröja gränssnittet. Om embeddingmodellen i LM Studio är offline faller systemet mjukt tillbaka på fulltextsökning.'
      }
    ]
  },
  {
    version: '2026.09.09.10',
    date: '2026-09-09',
    title: 'Snabbprompter per kategori, följdfrågor i chatten och 75 artiklar i AI-kontext',
    highlights: [
      {
        type: 'feature',
        title: 'Snabbprompter för alla kategorier',
        description: 'Lagt till 12 skräddarsydda snabbfrågor som täcker alla huvudkategorier (Blåljus, Ekonomi, Teknik, Politik, PRIO, Lokalt, Motor, Utrikes, Inrikes, Vetenskap med flera).'
      },
      {
        type: 'feature',
        title: 'Följdfrågor efter varje svar och rullbar kategorirad',
        description: 'Under varje svar från AI visas nu dynamiska förslag på relevanta följdfrågor, och ovanför inmatningsfältet finns en smidig horisontellt rullbar rad med alla kategorifrågor.'
      },
      {
        type: 'improvement',
        title: 'Utökat artikelkontext till 75 artiklar',
        description: 'Ökat antalet analyserade artiklar från 25 till 75 i AI-kontexten. Detta möjliggör heltäckande frågor och korrekta sammanräkningar över dygn eller kategorier utan att händelser klipps bort.'
      }
    ]
  },
  {
    version: '2026.09.09.09',
    date: '2026-09-09',
    title: 'Dedikerad AI Nyhetschatt kopplad till LM Studio',
    highlights: [
      {
        type: 'feature',
        title: 'Interaktiv AI-chatt för nyhetsflödet',
        description: 'Lagt till en helt ny vy (/chat) där du kan föra dialog och ställa analytiska frågor på naturlig svenska direkt till dina sparade RSS-artiklar (t.ex. "Hur många olyckor inträffade igår?" eller "Sammanfatta händelser kring räntan").'
      },
      {
        type: 'feature',
        title: 'Källhänvisningar och klickbara källkort',
        description: 'Under varje AI-svar listas de specifika artiklarna som svaret baserats på med källa, datum, sammanfattning och direktlänk till originalhändelsen.'
      },
      {
        type: 'improvement',
        title: 'Startsida med färdiga prompt-förslag',
        description: 'En välkomnande hero-sektion med klickbara promptkort för att snabbt starta analyser över senaste dygnet, trafik, ekonomi eller blåljushändelser.'
      }
    ]
  },
  {
    version: '2026.09.09.08',
    date: '2026-09-09',
    title: 'Avlägsnad Reason-rad, slimmad klickbetesnotis och kategori i taggraden',
    highlights: [
      {
        type: 'improvement',
        title: 'Borttagning av intern Reason-rad',
        description: 'Tog bort den interna poäng- och prioriteringsraden Reason: ... från händelsekorten för ett renare och mindre rörigt gränssnitt.'
      },
      {
        type: 'improvement',
        title: 'Slimmad och diskret klickbetesnotis',
        description: 'Ersatte den bastanta röda klickbetesboxen med en stilren och diskret förklaringsrad placerad direkt under sammanfattningen, vilket ger ett naturligt textflöde.'
      },
      {
        type: 'feature',
        title: 'Kategorin integrerad i taggraden',
        description: 'Huvudkategorin visas nu som första tagg i taggraden med distinkt orange stil, vilket samlar alla ämnesetiketter på ett och samma ställe.'
      }
    ]
  },
  {
    version: '2026.09.09.07',
    date: '2026-09-09',
    title: 'Omfattande dokumentation av MQTT och versionsuppdatering',
    highlights: [
      {
        type: 'improvement',
        title: 'Komplett MQTT-dokumentation och nyttolastspecifikation',
        description: 'Uppdaterat README.md med en detaljerad specifikation över samtliga JSON-fält som publiceras över MQTT, ämneshierarki, subskriptionsmönster samt färdiga automationsmallar för Home Assistant.'
      }
    ]
  },
  {
    version: '2026.09.09.06',
    date: '2026-09-09',
    title: 'Separering av klickbetestext och kategoriinformation i händelsekort',
    highlights: [
      {
        type: 'fix',
        title: 'Borttagning av duplicerad klickbetesmotivering',
        description: 'Reason-raden i händelsekorten visar nu uteslutande kategoriinformation (t.ex. Normalprioriterad kategori: Ekonomi 5/10) istället för att duplicera klickbetesförklaringen som redan presenteras i den dedikerade klickbetesrutan.'
      },
      {
        type: 'improvement',
        title: 'Rensning av befintlig data och framtida analys',
        description: 'AI-tjänsten och gränssnittet rensar automatiskt bort klickbetestext från prio_reason, och en databasmigrering städar befintliga sparade artiklar så att vyn hålls ren och konsekvent.'
      }
    ]
  },
  {
    version: '2026.09.09.05',
    date: '2026-09-09',
    title: 'MQTT-stöd med separata flödestopics och prio-kanal',
    highlights: [
      {
        type: 'feature',
        title: 'Pub/Sub-integration mot MQTT-broker',
        description: 'Möjlighet att skicka inkommande artiklar direkt till valfri MQTT-broker (t.ex. Home Assistant eller Node-RED). Konfigureras smidigt via miljövariabler i docker-compose.yml.'
      },
      {
        type: 'improvement',
        title: 'Separata ämnen per flöde och dedikerad prio-topic',
        description: 'Alla artiklar publiceras till sitt specifika källflöde under rss_bevakaren/feeds/{flöde_namn}. Om en artikel dessutom klassificeras som högprioriterad eller matchar prio-nyckelord skickas den parallellt till rss_bevakaren/prio.'
      }
    ]
  },
  {
    version: '2026.09.09.04',
    date: '2026-09-09',
    title: 'Faktaförtydligande i klickbetesnotiser och uppdaterad default-prompt',
    highlights: [
      {
        type: 'improvement',
        title: 'Tydlig koppling mellan klickbete och fakta i sammanfattningen',
        description: 'Systemprompten har uppdaterats som standard så att AI:n i clickbait_reason alltid specificerar exakt vad rubriken undanhöll och bekräftar att fakta har lyfts fram i sammanfattningen ovan, så att användaren slipper klicka sig vidare.'
      },
      {
        type: 'improvement',
        title: 'Uppdatering av standardprompt och automatisk migrering',
        description: 'Sparat den nya prompten i data/ai_prompt.json och backend/ai_service.py samt uppdaterat ensure_clickbait_in_prompt så att den nya klickbetesstrukturen appliceras automatiskt.'
      }
    ]
  },
  {
    version: '2026.09.09.03',
    date: '2026-09-09',
    title: 'Full-bleed maskable ikon och cache-busting för notiser',
    highlights: [
      {
        type: 'fix',
        title: 'Android maskable-ikon utan vit bakgrund',
        description: 'Genererat en full-bleed maskable-ikon (maskable-icon-512x512.png) med 100% färgfylld blå bakgrund (#2563eb) och RSS-symbolen centrerad i Androids säkra zon. Detta eliminerar den vita bakgrunden som Androids adaptiva system annars applicerar på hemskärmen.'
      },
      {
        type: 'improvement',
        title: 'Versionering och cache-busting för badge och push-ikoner',
        description: 'Lagt till versionsparametrar på badge.png och pwa-192x192.png i serviceworkern, push-payloaden och Nginx så att telefonen omedelbart hämtar de nya transparenta ikonerna istället för gamla cachade filer.'
      }
    ]
  },
  {
    version: '2026.09.09.02',
    date: '2026-09-09',
    title: 'Transparent bakgrund för applikationsikonen',
    highlights: [
      {
        type: 'improvement',
        title: 'Borttagning av vit kvadrat runt appikonen',
        description: 'Applikationsikonerna (favicon, pwa-ikoner och hemmaskärmsikoner för Android och iOS) har uppdaterats till äkta 32-bitars RGBA med 100% transparenta hörn runt den blå rundade kvadraten. Detta tar bort den oönskade vita bakgrundsramen på mobilens hemskärm och i webbläsaren.'
      },
      {
        type: 'improvement',
        title: 'Uppdaterat webbmanifest och Apple Touch-ikon',
        description: 'manifest.json och index.html har kompletterats med länkar och stöd för ändamålen any och maskable samt dedikerad apple-touch-icon för optimal presentation på både Android och iOS.'
      }
    ]
  },
  {
    version: '2026.09.09.01',
    date: '2026-09-09',
    title: 'Transparent badge-ikon för Android-statusbaren',
    highlights: [
      {
        type: 'fix',
        title: 'Fixat vit fyrkant i telefonens toppmeny',
        description: 'Ersatt den solida bakgrunden i badge.png med en ren vit RSS-silhuett på 100% transparent bakgrund (96x96 px) enligt Androids specifikation för statusfältsikoner. Nu visas RSS-vågikonen skarpt i mobilens toppbar istället för en vit ruta.'
      },
      {
        type: 'improvement',
        title: 'Tydligare ikonhantering i web-push och serviceworker',
        description: 'Serviceworkern och backend har uppdaterats för att explicit ange appens färgikon som notification-icon och den transparenta silhuetten som statusfälts-badge.'
      }
    ]
  },
  {
    version: '2026.09.08.20',
    date: '2026-09-08',
    title: 'Obligatorisk geografisk plats i AI-sammanfattningar',
    highlights: [
      {
        type: 'improvement',
        title: 'Obligatorisk geografisk förankring',
        description: 'Systemprompten har uppdaterats med strikt instruktion att alltid inkludera specifik geografisk plats (ort, kommun, stad eller land) i sammanfattningen om den framgår i artikeln (t.ex. Lekebergs kommun eller centrala Malmö).'
      },
      {
        type: 'improvement',
        title: 'Borttagning av onödig metainformation',
        description: 'AI-modellen instrueras att helt undvika meta-fraser som "rapporterar Expressen" eller "enligt tidningen" för att spara utrymme och uteslutande fokusera på de faktiska händelseomständigheterna.'
      }
    ]
  },
  {
    version: '2026.09.08.19',
    date: '2026-09-08',
    title: 'Flytt av versionsinfo och ändringslogg till General',
    highlights: [
      {
        type: 'improvement',
        title: 'Korrekt placering av ändringslogg och versionsruta',
        description: 'Kortet för applikationsversion och knappen "Vad är nytt" har flyttats från fliken Notifications till fliken General där den logiskt hör hemma tillsammans med övrig systeminformation.'
      }
    ]
  },
  {
    version: '2026.09.08.18',
    date: '2026-09-08',
    title: 'Europeiska tidsstämplar i databasöversikten',
    highlights: [
      {
        type: 'improvement',
        title: 'Europeiskt datum- och tidsformat',
        description: 'Tidsstämplar under fliken Database och enhetslistan är nu anpassade efter europeisk standard med 24-timmarsklocka och dag-först (t.ex. 19 Jun 2024, 10:53 och 8 Sep 2026, 19:53) istället för amerikanskt format med AM/PM.'
      }
    ]
  },
  {
    version: '2026.09.08.17',
    date: '2026-09-08',
    title: 'Enhetligt tema på reglage och borttagning av manuell purge-ruta',
    highlights: [
      {
        type: 'improvement',
        title: 'Enhetligt tema på reglage och switchar',
        description: 'Reglaget för den automatiska schemalagda nattliga rensningen följer nu applikationens genomgående design och stilmall (toggle-switch).'
      },
      {
        type: 'improvement',
        title: 'Borttagning av överflödig manuell rensningsruta',
        description: 'Den tidigare manuella rensningsrutan under fliken Database har tagits bort till förmån för den helautomatiska nattliga schemaläggningen.'
      },
      {
        type: 'improvement',
        title: 'Responsiv uppdateringsknapp för databasstatistik',
        description: 'Knappen Refresh Statistics har försetts med laddningsindikator, spinner och toast-bekräftelse vid uppdatering, samt robustare felhantering mot backend.'
      }
    ]
  },
  {
    version: '2026.09.08.16',
    date: '2026-09-08',
    title: 'Automatisk schemalagd purge samt skydd mot notis-bombning',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk schemalagd databasrensning (Purge)',
        description: 'Underhåll av databasen sker nu automatiskt varje natt kl 03:00 i bakgrunden. Rensar olåsta artiklar äldre än det inställda antalet dagar (standard 30 dagar) för att optimera prestanda och lagring.'
      },
      {
        type: 'feature',
        title: 'Skydd mot notis-bombning vid flödesaktivering',
        description: 'När ett flöde eller dess notiser aktiveras sker en tyst initial inläsning där befintliga artiklar markeras utan att skicka pushnotiser. Dessutom spärras historiska artiklar äldre än 2 timmar från pushnotiser.'
      },
      {
        type: 'improvement',
        title: 'Burst-skydd och synkroniserad databasinställning',
        description: 'Om fler än två nya artiklar anländer i ett och samma anrop begränsas pushnotiserna till de två allra nyaste händelserna för att undvika överhopning av meddelanden på mobil och dator. Inställningar för nattlig schemaläggning styrs direkt från Database-fliken.'
      }
    ]
  },
  {
    version: '2026.09.08.15',
    date: '2026-09-08',
    title: 'Engelsk översättning av notiser & ny databasöversikt',
    highlights: [
      {
        type: 'feature',
        title: 'Översikt och hälsostatistik för databasen',
        description: 'Fliken Database i inställningarna har fått en omfattande realtidsöversikt med KPI-kort för totalt antal artiklar (lästa/olästa), databasens filstorlek, datum och rubrik för äldsta samt nyaste artikeln, låsta artiklar, AI-analyser och detekterade klickbeten.'
      },
      {
        type: 'feature',
        title: 'Kategorifördelning och flödesstatus',
        description: 'Visar de vanligaste nyhetskategorierna i databasen med visuella staplar samt sammanställning av aktiva flöden och flöden med aktiverade pushnotiser.'
      },
      {
        type: 'improvement',
        title: 'Engelsk översättning för notisinställningar',
        description: 'Samtliga rubriker, förklaringar, knappar, statusbrickor, bekräftelsedialoger och toast-meddelanden under fliken Notifications är nu översatta till engelska för ett enhetligt gränssnitt.'
      }
    ]
  },
  {
    version: '2026.09.08.14',
    date: '2026-09-08',
    title: 'Anpassningsbart innehåll i Pushnotiser',
    highlights: [
      {
        type: 'feature',
        title: 'Skicka med artikelrubrik (Titel på/av)',
        description: 'Välj om artikelns fullständiga rubrik ska inkluderas i notisens titel eller om du endast vill se källan och händelsetypen för mer diskreta notiser.'
      },
      {
        type: 'feature',
        title: 'Skicka med artikelbild (Bild på/av)',
        description: 'Möjlighet att slå av eller på stora förhandsvisningsbilder i mobilen och datorns notiscenter för att spara data eller minska skärmytan.'
      },
      {
        type: 'feature',
        title: 'Skicka med AI-sammanfattning (Sammanfattning på/av)',
        description: 'Välj om den informativa 3-meningars AI-analysen ska skickas som notistext eller om du föredrar kort ingress/standardtext.'
      }
    ]
  },
  {
    version: '2026.09.08.13',
    date: '2026-09-08',
    title: 'Tydligare röd sidobord och indikering för klickbete',
    highlights: [
      {
        type: 'improvement',
        title: 'Röd sidobord vid klickbete',
        description: 'Artiklar som klassats som klickbete av AI får nu en tydlig röd färg på kortets vänstra sidobord istället för källans standardfärg, vilket gör dem omedelbart synliga i flödet.'
      },
      {
        type: 'improvement',
        title: 'Matchande röd ram och skuggeffekt',
        description: 'Klickbete-kort förses med en diskret röd ytterkant och glöd som harmonierar med varningsbadgen och sammanfattningsrutan.'
      }
    ]
  },
  {
    version: '2026.09.08.12',
    date: '2026-09-08',
    title: 'Logisk notishierarki: Flödesklockan styr pushnotiser',
    highlights: [
      {
        type: 'improvement',
        title: 'Överordnad flödesklocka för notiser',
        description: 'Om notiser är avstängda för ett specifikt flöde skickas nu inga pushnotiser alls från den källan, vilket förhindrar oönskade notiser från flöden du valt att tysta.'
      },
      {
        type: 'improvement',
        title: 'Bibehållen analys för PRIO-flödet',
        description: 'Även när notiser är avstängda för ett flöde analyseras artiklarna som vanligt av AI och visas i appens PRIO-vy om de uppnår relevanströskeln.'
      }
    ]
  },
  {
    version: '2026.09.08.11',
    date: '2026-09-08',
    title: 'Strukturerad och renodlad loggning i Docker',
    highlights: [
      {
        type: 'improvement',
        title: 'Adaptivt och strukturerat loggformat (Förslag B)',
        description: 'Prio-händelser och bevakningsord visas nu som tydliga inramade block i Docker-loggen med användare, källa, svarstid och leveransstatus, medan vanliga artiklar loggas i ett rent 2-raders format.'
      },
      {
        type: 'improvement',
        title: 'Borttaget tekniskt brus i backend-loggen',
        description: 'Tog bort chattiga debug-utskrifter från LM Studio-anrop och interna loopar så att containerloggen är ren, överskådlig och behaglig att följa.'
      },
      {
        type: 'improvement',
        title: 'Kompakt och tydlig RSS-pollning',
        description: 'Pollningsloggen visar nu källa, antal nya artiklar samt id-intervall, och döljer tysta sökningar utan nya artiklar.'
      }
    ]
  },
  {
    version: '2026.09.08.10',
    date: '2026-09-08',
    title: 'Rika Push-notiser med AI-sammanfattning & Artikelbild',
    highlights: [
      {
        type: 'feature',
        title: 'AI-sammanfattning direkt i notisen',
        description: 'Pushnotiser innehåller nu den informativa 3-meningars AI-sammanfattningen som text istället för att bara upprepa rubriken, så att du direkt ser vad som hänt.'
      },
      {
        type: 'feature',
        title: 'Stora artikelbilder i notisen',
        description: 'Om artikeln innehåller en bild skickas den med och förhandsvisas i storformat direkt i telefonens notiscenter.'
      },
      {
        type: 'improvement',
        title: 'Borttagen duplicerad app-ikon',
        description: 'Tog bort den redundanta blå ikonen till höger i notiskortet på Android för en ren och snygg presentation.'
      }
    ]
  },
  {
    version: '2026.09.08.09',
    date: '2026-09-08',
    title: 'AI-sammanfattning utökad till 3 meningar',
    highlights: [
      {
        type: 'improvement',
        title: '3 korta informativa meningar som standard',
        description: 'AI-promptens standardinstruktion har uppdaterats från max två till max tre informativa meningar för att ge en mer heltäckande sammanfattning av artiklar utan att bli för långrandig.'
      },
      {
        type: 'improvement',
        title: 'Automatisk migrering av sparade promptar',
        description: 'Befintliga systempromptar i databasen och konfigurationsfilen uppdateras automatiskt till 3 meningar så att förändringen slår igenom omedelbart.'
      }
    ]
  },
  {
    version: '2026.09.08.08',
    date: '2026-09-08',
    title: 'Utökad Push-diagnostik, Enhetshantering & Doze-fix',
    highlights: [
      {
        type: 'improvement',
        title: 'Hög prioritet (Urgency: high) & TTL på alla push-notiser',
        description: 'Webb-pushnotiser skickas nu med RFC 8030 Urgency: high och TTL 24 timmar, vilket förhindrar att mobilens energisparläge eller Doze mode fördröjer eller tappar notiser när skärmen är släckt.'
      },
      {
        type: 'feature',
        title: 'Översikt & hantering av anslutna push-enheter',
        description: 'Under Inställningar visas nu samtliga registrerade webbläsare och enheter (mobil, dator) med senast aktiva tidpunkt, möjlighet att ta bort enskilda enheter eller rensa alla gamla enheter med ett klick.'
      },
      {
        type: 'improvement',
        title: 'Tydlig serverdiagnostik med HTTP-status per enhet',
        description: 'Backend loggar nu exakt vilken enhet som tar emot notisen samt HTTP-svarskoden från FCM/push-tjänsten (t.ex. HTTP 201 OK eller automatisk radering vid HTTP 410 Gone).'
      },
      {
        type: 'fix',
        title: 'Mjukare clickbait-filter för sakliga nyheter',
        description: 'Uppdaterat systemprompten så att sakliga rapporteringar aldrig felaktigt stämplas som clickbait.'
      }
    ]
  },
  {
    version: '2026.09.08.07',
    date: '2026-09-08',
    title: 'Fix för PRIO-notiser & räknare vid start',
    highlights: [
      {
        type: 'fix',
        title: 'PRIO-notiser skickas nu korrekt',
        description: 'Breddat villkoret för PRIO-notiser så att även artiklar med hög poäng från kategorier och AI-analys skickar notis omedelbart utan att blockeras av enskilda flödesinställningar.'
      },
      {
        type: 'fix',
        title: 'Omedelbar oläst-räknare för PRIO vid start',
        description: 'Åtgärdade en bugg där PRIO-räknaren i menyn visade noll vid appstart tills man bytte vy fram och tillbaka.'
      }
    ]
  },
  {
    version: '2026.09.08.06',
    date: '2026-09-08',
    title: 'Robust Web Push & Notisfilter för PRIO-flödet',
    highlights: [
      {
        type: 'feature',
        title: 'Endast notiser för PRIO-flödet',
        description: 'Ny inställning som gör att du kan välja att endast få pushnotiser för viktiga händelser (PRIO) och bevakningsord, vilket förhindrar notis-spam från stora nyhetssajter som Expressen och Aftonbladet.'
      },
      {
        type: 'fix',
        title: 'Åtgärdad registrering av mobilnotiser',
        description: 'Förbättrad återanslutning av Web Push i mobilen som automatiskt rensar gamla tokens och säkerställer registrering på servern.'
      },
      {
        type: 'improvement',
        title: 'Direkt testknapp & förbättrade push-loggar',
        description: 'Möjlighet att skicka en direkt testnotis från inställningarna, samt detaljerad serverloggning om vilka enheter som tar emot notiser.'
      }
    ]
  },
  {
    version: '2026.09.08.05',
    date: '2026-09-08',
    title: 'Användarnamn i push-logg & Systemtema-stöd',
    highlights: [
      {
        type: 'improvement',
        title: 'Tydligare push-loggning i backend',
        description: 'Push-notifieringsloggar visar nu användarens faktiska användarnamn i stället för ett numeriskt ID.'
      },
      {
        type: 'feature',
        title: 'Automatiskt systemtema (Auto / System)',
        description: 'Applikationen kan nu automatiskt följa operativsystemets inställning för ljust eller mörkt tema på både mobil och dator.'
      }
    ]
  },
  {
    version: '2026.09.08.04',
    date: '2026-09-08',
    title: 'Förbättrad design av ändringslogg (Tema & Desktopvy)',
    highlights: [
      {
        type: 'improvement',
        title: 'Fullt temastöd (Ljust & Mörkt)',
        description: 'Ändringsloggen anpassar sig nu perfekt efter det valda temat i applikationen med korrekt kontrast och färgåtergivning.'
      },
      {
        type: 'improvement',
        title: 'Bredare layout och ökad läsbarhet på desktop',
        description: 'Dialogrutan utnyttjar skärmens bredd bättre och textstorlekarna har höjts väsentligt för en behagligare läsupplevelse.'
      }
    ]
  },
  {
    version: '2026.09.08.03',
    date: '2026-09-08',
    title: 'Förbättrad loggning vid webbskrapning',
    highlights: [
      {
        type: 'improvement',
        title: 'Renare backend-loggar',
        description: 'Långa webbadresser i skrapningsloggen har ersatts med det faktiska flödesnamnet för bättre läsbarhet och överskådlighet.'
      }
    ]
  },
  {
    version: '2026.09.08.02',
    date: '2026-09-08',
    title: 'Vad är nytt-dialog och Clickbait-skydd',
    highlights: [
      {
        type: 'feature',
        title: 'Automatisk versionsinformation',
        description: 'Applikationen informerar nu automatiskt vid varje ny version om nytillkomna funktioner och buggfixar. Du kan även när som helst öppna ändringsloggen via versionsnumret i sidomenyn.'
      },
      {
        type: 'feature',
        title: 'AI Clickbait-detektering & Anti-Clickbait',
        description: 'Artiklar analyseras för att identifiera sensationalistiska och undanhållande rubriker. Klickbeten flaggas med varningstext, punkteras i första meningen av sammanfattningen och spärras automatiskt från PRIO-flödet.'
      },
      {
        type: 'improvement',
        title: 'Synkroniserad AI-promptmall',
        description: 'Inställningsvyn och backend-analysen är nu fullt synkroniserade med clickbait-instruktionerna. Äldre sparade prompter migreras automatiskt.'
      }
    ]
  },
  {
    version: '2026.09.07.27',
    date: '2026-09-07',
    title: 'Engelsk dokumentation och stabilitet',
    highlights: [
      {
        type: 'improvement',
        title: 'Komplett engelsk dokumentation',
        description: 'README-dokumentationen har översatts till engelska med detaljerade guider för Docker Compose, flerfunktionsstöd och arkitektur.'
      }
    ]
  },
  {
    version: '2026.09.07.26',
    date: '2026-09-07',
    title: 'AI Shimmer-animering & Timeout-återhämtning',
    highlights: [
      {
        type: 'feature',
        title: 'Skeleton Shimmer i artikelflödet',
        description: 'Tydlig visuell indikering visar när en artikel analyseras av AI i bakgrunden.'
      },
      {
        type: 'improvement',
        title: 'Robust felhantering',
        description: 'Förbättrad återhämtning vid timeout eller otillgänglig lokal AI-modell utan att blockera övriga artiklar.'
      }
    ]
  }
];
