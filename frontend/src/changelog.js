export const CHANGELOG_DATA = [
  {
    version: '2026.09.12.11',
    date: '2026-09-12',
    title: 'Förstärkt svärta och kontrast för taggavdelaren',
    badge: 'Senaste',
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
