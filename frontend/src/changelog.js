export const CHANGELOG_DATA = [
  {
    version: '2026.09.08.20',
    date: '2026-09-08',
    title: 'Obligatorisk geografisk plats i AI-sammanfattningar',
    badge: 'Senaste',
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
