export const CHANGELOG_DATA = [
  {
    version: '2026.09.08.07',
    date: '2026-09-08',
    title: 'Fix för PRIO-notiser & räknare vid start',
    badge: 'Senaste',
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
