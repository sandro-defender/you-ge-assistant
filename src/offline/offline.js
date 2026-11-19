(function () {
  'use strict';

  var hint = document.getElementById('hint');
  var statusText = document.getElementById('statusText');
  var headline = document.getElementById('headline');
  var message = document.getElementById('message');
  var dot = document.getElementById('dot');
  var appName = document.getElementById('appName');
  var currentDomain = document.getElementById('currentDomain');
  var domainLabel = document.getElementById('domainLabel');
  var retryLink = document.getElementById('retryLink');
  var diagnosticsButton = document.getElementById('diagnosticsButton');
  var diagnosticsResult = document.getElementById('diagnosticsResult');
  var recoverySummary = document.getElementById('recoverySummary');
  var recoveryAndroid = document.getElementById('recoveryAndroid');
  var recoveryAndroidLink = document.getElementById('recoveryAndroidLink');
  var recoveryIos = document.getElementById('recoveryIos');
  var recoveryIosLink = document.getElementById('recoveryIosLink');
  var recoveryAndroidApp = document.getElementById('recoveryAndroidApp');
  var recoveryIosApp = document.getElementById('recoveryIosApp');
  if (!hint || !statusText || !headline || !message || !dot) return;

  var COPY = {
    en: {
      titlePrefix: 'Offline — ',
      domainLabel: 'This installation:',
      onlineStatus: 'You are online',
      offlineStatus: 'You are offline',
      offlineHeadline: 'No connection',
      offlineMessage: 'Check your internet connection and try again. Pages you visited recently may still be available.',
      offlineHint: 'Waiting for the network…',
      restoredHeadline: 'Connection restored',
      restoredMessage: 'Reloading the app…',
      restoredHint: 'Connection restored. Reloading…',
      onlineHeadline: 'Connection looks fine',
      onlineMessage: 'The app did not load. Open it again to continue.',
      onlineHint: 'You are online. If the app did not load, try again.',
      retry: 'Try again',
      runDiag: 'Run network diagnostics',
      checkingBtn: 'Checking…',
      retryDiag: 'Retry diagnostics',
      diagUnavailable: 'Diagnostics are unavailable. Check the connection and try again.',
      diagChecking: 'Checking Cloudflare DNS and {host}…',
      diagError: 'Diagnostics could not complete.',
      diagRetryError: 'Diagnostics could not complete. Retry when the connection is available.',
      recoverySummary: 'DNS recovery instructions',
      recoveryAndroid: 'Android: Settings → Network & internet → Private DNS → Provider hostname → enter {dns} → Save. Return to this domain and retry.',
      recoveryAndroidLink: 'Official Android instructions',
      recoveryIos: 'iPhone or iPad: use Cloudflare 1.1.1.1 in DNS-only mode. WARP is not required. Return to this domain and retry.',
      recoveryIosLink: 'Official iOS instructions',
      recoveryAndroidApp: 'Android app',
      recoveryIosApp: 'iPhone app',
    },
    ka: {
      titlePrefix: 'ოფლაინ — ',
      domainLabel: 'მიმდინარე ინსტალაცია:',
      onlineStatus: 'თქვენ ონლაინ ხართ',
      offlineStatus: 'თქვენ ოფლაინ ხართ',
      offlineHeadline: 'კავშირი არ არის',
      offlineMessage: 'შეამოწმეთ ინტერნეტ-კავშირი და სცადეთ ხელახლა. ბოლოს მონახულებული გვერდები შესაძლოა კვლავ ხელმისაწვდომი იყოს.',
      offlineHint: 'ქსელის მოლოდინში…',
      restoredHeadline: 'კავშირი აღდგა',
      restoredMessage: 'აპი იტვირთება ხელახლა…',
      restoredHint: 'კავშირი აღდგა. გადატვირთვა…',
      onlineHeadline: 'კავშირი ნორმალურია',
      onlineMessage: 'აპი ვერ ჩაიტვირთა. გასაგრძელებლად სცადეთ ხელახლა გახსნა.',
      onlineHint: 'ონლაინ ხართ. თუ აპი არ ჩაიტვირთა, სცადეთ ხელახლა.',
      retry: 'ხელახლა ცდა',
      runDiag: 'ქსელის დიაგნოსტიკის გაშვება',
      checkingBtn: 'მიმდინარეობს შემოწმება…',
      retryDiag: 'დიაგნოსტიკის გამეორება',
      diagUnavailable: 'დიაგნოსტიკა მიუწვდომელია. შეამოწმეთ კავშირი და სცადეთ ხელახლა.',
      diagChecking: 'მოწმდება Cloudflare DNS და {host}…',
      diagError: 'დიაგნოსტიკის დასრულება ვერ მოხერხდა.',
      diagRetryError: 'დიაგნოსტიკა ვერ დასრულდა. სცადეთ ხელახლა კავშირის აღდგენისას.',
      recoverySummary: 'DNS აღდგენის ინსტრუქცია',
      recoveryAndroid: 'Android: პარამეტრები → ქსელი და ინტერნეტი → კერძო DNS → პროვაიდერის ჰოსტის სახელი → შეიყვანეთ {dns} → შენახვა. დაბრუნდით ამ დომენზე და სცადეთ ხელახლა.',
      recoveryAndroidLink: 'ოფიციალური Android ინსტრუქცია',
      recoveryIos: 'iPhone ან iPad: გამოიყენეთ Cloudflare 1.1.1.1 მხოლოდ DNS რეჟიმში (WARP არ არის საჭირო). დაბრუნდით ამ დომენზე და სცადეთ ხელახლა.',
      recoveryIosLink: 'ოფიციალური iOS ინსტრუქცია',
      recoveryAndroidApp: 'Android აპი',
      recoveryIosApp: 'iPhone აპი',
    },
    ru: {
      titlePrefix: 'Офлайн — ',
      domainLabel: 'Текущий домен:',
      onlineStatus: 'Вы в сети',
      offlineStatus: 'Вы не в сети',
      offlineHeadline: 'Нет подключения',
      offlineMessage: 'Проверьте подключение к интернету и повторите попытку. Недавно посещённые страницы могут оставаться доступными.',
      offlineHint: 'Ожидание сети…',
      restoredHeadline: 'Подключение восстановлено',
      restoredMessage: 'Перезагрузка приложения…',
      restoredHint: 'Подключение восстановлено. Перезагрузка…',
      onlineHeadline: 'Подключение в порядке',
      onlineMessage: 'Приложение не загрузилось. Откройте его снова, чтобы продолжить.',
      onlineHint: 'Вы в сети. Если приложение не открылось, попробуйте снова.',
      retry: 'Повторить',
      runDiag: 'Запустить сетевую диагностику',
      checkingBtn: 'Проверка…',
      retryDiag: 'Повторить диагностику',
      diagUnavailable: 'Диагностика недоступна. Проверьте подключение и попробуйте снова.',
      diagChecking: 'Проверка Cloudflare DNS и {host}…',
      diagError: 'Не удалось завершить диагностику.',
      diagRetryError: 'Не удалось завершить диагностику. Повторите попытку, когда появится сеть.',
      recoverySummary: 'Инструкция по восстановлению DNS',
      recoveryAndroid: 'Android: Настройки → Сеть и интернет → Персональный DNS-сервер → Имя хоста провайдера → введите {dns} → Сохранить. Вернитесь на этот домен и повторите.',
      recoveryAndroidLink: 'Официальная инструкция для Android',
      recoveryIos: 'iPhone или iPad: используйте Cloudflare 1.1.1.1 в режиме только DNS (WARP не требуется). Вернитесь на этот домен и повторите.',
      recoveryIosLink: 'Официальная инструкция для iOS',
      recoveryAndroidApp: 'Приложение для Android',
      recoveryIosApp: 'Приложение для iPhone',
    },
    fr: {
      titlePrefix: 'Hors ligne — ',
      domainLabel: 'Cette installation :',
      onlineStatus: 'Vous êtes en ligne',
      offlineStatus: 'Vous êtes hors ligne',
      offlineHeadline: 'Aucune connexion',
      offlineMessage: 'Vérifiez votre connexion Internet et réessayez. Les pages consultées récemment peuvent encore être disponibles.',
      offlineHint: 'En attente du réseau…',
      restoredHeadline: 'Connexion rétablie',
      restoredMessage: 'Rechargement de l’application…',
      restoredHint: 'Connexion rétablie. Rechargement…',
      onlineHeadline: 'La connexion semble bonne',
      onlineMessage: 'L’application ne s’est pas chargée. Ouvrez-la à nouveau pour continuer.',
      onlineHint: 'Vous êtes en ligne. Si l’application ne s’est pas chargée, réessayez.',
      retry: 'Réessayer',
      runDiag: 'Lancer le diagnostic réseau',
      checkingBtn: 'Vérification…',
      retryDiag: 'Relancer le diagnostic',
      diagUnavailable: 'Le diagnostic est indisponible. Vérifiez la connexion et réessayez.',
      diagChecking: 'Vérification de Cloudflare DNS et {host}…',
      diagError: 'Le diagnostic n’a pas pu se terminer.',
      diagRetryError: 'Le diagnostic n’a pas pu se terminer. Réessayez dès que le réseau est disponible.',
      recoverySummary: 'Instructions de récupération DNS',
      recoveryAndroid: 'Android : Paramètres → Réseau et Internet → DNS privé → Nom d’hôte du fournisseur → saisissez {dns} → Enregistrer. Revenez sur ce domaine et réessayez.',
      recoveryAndroidLink: 'Instructions officielles Android',
      recoveryIos: 'iPhone ou iPad : utilisez Cloudflare 1.1.1.1 en mode DNS uniquement (WARP inutile). Revenez sur ce domaine et réessayez.',
      recoveryIosLink: 'Instructions officielles iOS',
      recoveryAndroidApp: 'Application Android',
      recoveryIosApp: 'Application iPhone',
    },
    it: {
      titlePrefix: 'Offline — ',
      domainLabel: 'Questa installazione:',
      onlineStatus: 'Sei online',
      offlineStatus: 'Sei offline',
      offlineHeadline: 'Nessuna connessione',
      offlineMessage: 'Controlla la connessione Internet e riprova. Le pagine visitate di recente potrebbero essere ancora disponibili.',
      offlineHint: 'In attesa della rete…',
      restoredHeadline: 'Connessione ripristinata',
      restoredMessage: 'Ricaricamento dell’app…',
      restoredHint: 'Connessione ripristinata. Ricaricamento…',
      onlineHeadline: 'La connessione sembra attiva',
      onlineMessage: 'L’app non si è caricata. Riaprila per continuare.',
      onlineHint: 'Sei online. Se l’app non si è caricata, riprova.',
      retry: 'Riprova',
      runDiag: 'Avvia diagnostica di rete',
      checkingBtn: 'Verifica in corso…',
      retryDiag: 'Riprova diagnostica',
      diagUnavailable: 'La diagnostica non è disponibile. Controlla la connessione e riprova.',
      diagChecking: 'Verifica di Cloudflare DNS e {host}…',
      diagError: 'Impossibile completare la diagnostica.',
      diagRetryError: 'Impossibile completare la diagnostica. Riprova quando la connessione è disponibile.',
      recoverySummary: 'Istruzioni di ripristino DNS',
      recoveryAndroid: 'Android: Impostazioni → Rete e internet → DNS privato → Nome host provider → inserisci {dns} → Salva. Torna su questo dominio e riprova.',
      recoveryAndroidLink: 'Istruzioni ufficiali Android',
      recoveryIos: 'iPhone o iPad: usa Cloudflare 1.1.1.1 in modalità solo DNS (WARP non necessario). Torna su questo dominio e riprova.',
      recoveryIosLink: 'Istruzioni ufficiali iOS',
      recoveryAndroidApp: 'App Android',
      recoveryIosApp: 'App iPhone',
    },
    de: {
      titlePrefix: 'Offline — ',
      domainLabel: 'Diese Installation:',
      onlineStatus: 'Sie sind online',
      offlineStatus: 'Sie sind offline',
      offlineHeadline: 'Keine Verbindung',
      offlineMessage: 'Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut. Kürzlich besuchte Seiten sind möglicherweise noch verfügbar.',
      offlineHint: 'Warte auf Netzwerkverbindung…',
      restoredHeadline: 'Verbindung wiederhergestellt',
      restoredMessage: 'App wird neu geladen…',
      restoredHint: 'Verbindung wiederhergestellt. Wird neu geladen…',
      onlineHeadline: 'Verbindung sieht gut aus',
      onlineMessage: 'Die App konnte nicht geladen werden. Öffnen Sie sie erneut.',
      onlineHint: 'Sie sind online. Wenn die App nicht geladen hat, versuchen Sie es erneut.',
      retry: 'Erneut versuchen',
      runDiag: 'Netzwerkdiagnose starten',
      checkingBtn: 'Prüfung läuft…',
      retryDiag: 'Diagnose wiederholen',
      diagUnavailable: 'Diagnose nicht verfügbar. Verbindung prüfen und erneut versuchen.',
      diagChecking: 'Cloudflare DNS und {host} werden geprüft…',
      diagError: 'Die Diagnose konnte nicht abgeschlossen werden.',
      diagRetryError: 'Die Diagnose konnte nicht abgeschlossen werden. Bei verfügbarer Verbindung erneut versuchen.',
      recoverySummary: 'Anleitung zur DNS-Wiederherstellung',
      recoveryAndroid: 'Android: Einstellungen → Netzwerk & Internet → Privates DNS → Hostname des Anbieters → {dns} eingeben → Speichern. Zurückkehren und erneut testen.',
      recoveryAndroidLink: 'Offizielle Android-Anleitung',
      recoveryIos: 'iPhone oder iPad: Cloudflare 1.1.1.1 im Nur-DNS-Modus nutzen (WARP nicht nötig). Zurückkehren und erneut testen.',
      recoveryIosLink: 'Offizielle iOS-Anleitung',
      recoveryAndroidApp: 'Android-App',
      recoveryIosApp: 'iPhone-App',
    },
    sv: {
      titlePrefix: 'Offline — ',
      domainLabel: 'Den här installationen:',
      onlineStatus: 'Du är online',
      offlineStatus: 'Du är offline',
      offlineHeadline: 'Ingen anslutning',
      offlineMessage: 'Kontrollera internetanslutningen och försök igen. Nyligen besökta sidor kan fortfarande vara tillgängliga.',
      offlineHint: 'Väntar på nätverket…',
      restoredHeadline: 'Anslutningen återställd',
      restoredMessage: 'Laddar om appen…',
      restoredHint: 'Anslutningen återställd. Laddar om…',
      onlineHeadline: 'Anslutningen ser bra ut',
      onlineMessage: 'Appen laddades inte. Öppna den igen för att fortsätta.',
      onlineHint: 'Du är online. Försök igen om appen inte laddades.',
      retry: 'Försök igen',
      runDiag: 'Kör nätverksdiagnostik',
      checkingBtn: 'Kontrollerar…',
      retryDiag: 'Kör diagnostik igen',
      diagUnavailable: 'Diagnostiken är inte tillgänglig. Kontrollera anslutningen och försök igen.',
      diagChecking: 'Kontrollerar Cloudflare DNS och {host}…',
      diagError: 'Diagnostiken kunde inte slutföras.',
      diagRetryError: 'Diagnostiken kunde inte slutföras. Försök igen när anslutningen är tillgänglig.',
      recoverySummary: 'Anvisningar för DNS-återställning',
      recoveryAndroid: 'Android: Inställningar → Nätverk och internet → Privat DNS → Leverantörens värdnamn → ange {dns} → Spara. Återvänd hit och försök igen.',
      recoveryAndroidLink: 'Officiella Android-anvisningar',
      recoveryIos: 'iPhone eller iPad: använd Cloudflare 1.1.1.1 i läget Endast DNS (WARP krävs inte). Återvänd hit och försök igen.',
      recoveryIosLink: 'Officiella iOS-anvisningar',
      recoveryAndroidApp: 'Android-app',
      recoveryIosApp: 'iPhone-app',
    },
    nl: {
      titlePrefix: 'Offline — ',
      domainLabel: 'Deze installatie:',
      onlineStatus: 'Je bent online',
      offlineStatus: 'Je bent offline',
      offlineHeadline: 'Geen verbinding',
      offlineMessage: 'Controleer je internetverbinding en probeer opnieuw. Recent bezochte pagina’s zijn mogelijk nog beschikbaar.',
      offlineHint: 'Wachten op netwerk…',
      restoredHeadline: 'Verbinding hersteld',
      restoredMessage: 'De app wordt opnieuw geladen…',
      restoredHint: 'Verbinding hersteld. Opnieuw laden…',
      onlineHeadline: 'Verbinding lijkt in orde',
      onlineMessage: 'De app is niet geladen. Open deze opnieuw om door te gaan.',
      onlineHint: 'Je bent online. Probeer opnieuw als de app niet is geladen.',
      retry: 'Opnieuw proberen',
      runDiag: 'Netwerkdiagnostiek starten',
      checkingBtn: 'Controleren…',
      retryDiag: 'Diagnostiek opnieuw proberen',
      diagUnavailable: 'Diagnostiek niet beschikbaar. Controleer de verbinding en probeer opnieuw.',
      diagChecking: 'Cloudflare DNS en {host} controleren…',
      diagError: 'Diagnostiek kon niet worden voltooid.',
      diagRetryError: 'Diagnostiek kon niet worden voltooid. Probeer opnieuw zodra de verbinding beschikbaar is.',
      recoverySummary: 'Instructies voor DNS-herstel',
      recoveryAndroid: 'Android: Instellingen → Netwerk en internet → Privé-DNS → Hostnaam provider → voer {dns} in → Opslaan. Keer terug en probeer opnieuw.',
      recoveryAndroidLink: 'Officiële Android-instructies',
      recoveryIos: 'iPhone of iPad: gebruik Cloudflare 1.1.1.1 in modus Alleen DNS (WARP niet nodig). Keer terug en probeer opnieuw.',
      recoveryIosLink: 'Officiële iOS-instructies',
      recoveryAndroidApp: 'Android-app',
      recoveryIosApp: 'iPhone-app',
    },
    no: {
      titlePrefix: 'Frakoblet — ',
      domainLabel: 'Denne installasjonen:',
      onlineStatus: 'Du er på nett',
      offlineStatus: 'Du er frakoblet',
      offlineHeadline: 'Ingen tilkobling',
      offlineMessage: 'Sjekk internettforbindelsen og prøv igjen. Sider du har besøkt nylig kan fortsatt være tilgjengelige.',
      offlineHint: 'Venter på nettverk…',
      restoredHeadline: 'Tilkoblingen gjenopprettet',
      restoredMessage: 'Laster appen på nytt…',
      restoredHint: 'Tilkoblingen gjenopprettet. Laster på nytt…',
      onlineHeadline: 'Tilkoblingen ser fin ut',
      onlineMessage: 'Appen ble ikke lastet inn. Åpne den igjen for å fortsette.',
      onlineHint: 'Du er på nett. Prøv igjen hvis appen ikke ble lastet inn.',
      retry: 'Prøv igjen',
      runDiag: 'Kjør nettverksdiagnostikk',
      checkingBtn: 'Sjekker…',
      retryDiag: 'Kjør diagnostikk på nytt',
      diagUnavailable: 'Diagnostikk er utilgjengelig. Sjekk tilkoblingen og prøv igjen.',
      diagChecking: 'Sjekker Cloudflare DNS og {host}…',
      diagError: 'Diagnostikken kunne ikke fullføres.',
      diagRetryError: 'Diagnostikken kunne ikke fullføres. Prøv igjen når tilkoblingen er tilbake.',
      recoverySummary: 'Instruksjoner for DNS-gjenoppretting',
      recoveryAndroid: 'Android: Innstillinger → Nettverk og internett → Privat DNS → Vertsnavn for leverandør → skriv inn {dns} → Lagre. Gå tilbake og prøv igjen.',
      recoveryAndroidLink: 'Offisielle Android-instruksjoner',
      recoveryIos: 'iPhone eller iPad: bruk Cloudflare 1.1.1.1 i kun DNS-modus (WARP trengs ikke). Gå tilbake og prøv igjen.',
      recoveryIosLink: 'Offisielle iOS-instruksjoner',
      recoveryAndroidApp: 'Android-app',
      recoveryIosApp: 'iPhone-app',
    },
    da: {
      titlePrefix: 'Offline — ',
      domainLabel: 'Denne installation:',
      onlineStatus: 'Du er online',
      offlineStatus: 'Du er offline',
      offlineHeadline: 'Ingen forbindelse',
      offlineMessage: 'Tjek din internetforbindelse og prøv igen. Sider, du har besøgt for nylig, kan stadig være tilgængelige.',
      offlineHint: 'Venter på netværket…',
      restoredHeadline: 'Forbindelse genoprettet',
      restoredMessage: 'Genindlæser appen…',
      restoredHint: 'Forbindelse genoprettet. Genindlæser…',
      onlineHeadline: 'Forbindelsen ser fin ud',
      onlineMessage: 'Appen blev ikke indlæst. Åbn den igen for at fortsætte.',
      onlineHint: 'Du er online. Prøv igen, hvis appen ikke blev indlæst.',
      retry: 'Prøv igen',
      runDiag: 'Kør netværksdiagnostik',
      checkingBtn: 'Tjekker…',
      retryDiag: 'Prøv diagnostik igen',
      diagUnavailable: 'Diagnostik er utilgængelig. Tjek forbindelsen og prøv igen.',
      diagChecking: 'Tjekker Cloudflare DNS og {host}…',
      diagError: 'Diagnostikken kunne ikke fuldføres.',
      diagRetryError: 'Diagnostikken kunne ikke fuldføres. Prøv igen, når forbindelsen er tilbage.',
      recoverySummary: 'Vejledning til DNS-gendannelse',
      recoveryAndroid: 'Android: Indstillinger → Netværk og internet → Privat DNS → Udbyders værtsnavn → indtast {dns} → Gem. Vend tilbage og prøv igen.',
      recoveryAndroidLink: 'Officiel Android-vejledning',
      recoveryIos: 'iPhone eller iPad: brug Cloudflare 1.1.1.1 i kun DNS-tilstand (WARP er ikke nødvendig). Vend tilbage og prøv igen.',
      recoveryIosLink: 'Officiel iOS-vejledning',
      recoveryAndroidApp: 'Android-app',
      recoveryIosApp: 'iPhone-app',
    },
    et: {
      titlePrefix: 'Võrguühenduseta — ',
      domainLabel: 'See paigaldus:',
      onlineStatus: 'Sa oled võrgus',
      offlineStatus: 'Sa oled võrguühenduseta',
      offlineHeadline: 'Ühendus puudub',
      offlineMessage: 'Kontrolli internetiühendust ja proovi uuesti. Hiljuti külastatud lehed võivad endiselt saadaval olla.',
      offlineHint: 'Võrgu ootamine…',
      restoredHeadline: 'Ühendus taastatud',
      restoredMessage: 'Rakenduse uuesti laadimine…',
      restoredHint: 'Ühendus taastatud. Laen uuesti…',
      onlineHeadline: 'Ühendus paistab korras olevat',
      onlineMessage: 'Rakendust ei laaditud. Jätkamiseks ava see uuesti.',
      onlineHint: 'Oled võrgus. Kui rakendus ei laadinud, proovi uuesti.',
      retry: 'Proovi uuesti',
      runDiag: 'Käivita võrgudiagnostika',
      checkingBtn: 'Kontrollin…',
      retryDiag: 'Korda diagnostikat',
      diagUnavailable: 'Diagnostika pole saadaval. Kontrolli ühendust ja proovi uuesti.',
      diagChecking: 'Kontrollin Cloudflare DNS-i ja {host}…',
      diagError: 'Diagnostika ei saanud lõpule jõuda.',
      diagRetryError: 'Diagnostika ei saanud lõpule jõuda. Proovi uuesti, kui ühendus taastub.',
      recoverySummary: 'DNS-i taastamise juhised',
      recoveryAndroid: 'Android: Seaded → Võrk ja internet → Privaatne DNS → Teenusepakkuja hostinimi → sisesta {dns} → Salvesta. Naase ja proovi uuesti.',
      recoveryAndroidLink: 'Ametlikud Androidi juhised',
      recoveryIos: 'iPhone või iPad: kasuta Cloudflare 1.1.1.1 ainult DNS-i režiimis (WARP pole vajalik). Naase ja proovi uuesti.',
      recoveryIosLink: 'Ametlikud iOS-i juhised',
      recoveryAndroidApp: 'Androidi rakendus',
      recoveryIosApp: 'iPhone’i rakendus',
    },
    es: {
      titlePrefix: 'Sin conexión — ',
      domainLabel: 'Esta instalación:',
      onlineStatus: 'Estás en línea',
      offlineStatus: 'Estás sin conexión',
      offlineHeadline: 'Sin conexión',
      offlineMessage: 'Comprueba tu conexión a internet e inténtalo de nuevo. Las páginas visitadas recientemente pueden seguir disponibles.',
      offlineHint: 'Esperando conexión…',
      restoredHeadline: 'Conexión restablecida',
      restoredMessage: 'Recargando la aplicación…',
      restoredHint: 'Conexión restablecida. Recargando…',
      onlineHeadline: 'La conexión parece correcta',
      onlineMessage: 'La aplicación no se cargó. Ábrela de nuevo para continuar.',
      onlineHint: 'Estás en línea. Si no se cargó la app, inténtalo de nuevo.',
      retry: 'Reintentar',
      runDiag: 'Ejecutar diagnóstico de red',
      checkingBtn: 'Comprobando…',
      retryDiag: 'Reintentar diagnóstico',
      diagUnavailable: 'El diagnóstico no está disponible. Comprueba la conexión e inténtalo de nuevo.',
      diagChecking: 'Comprobando Cloudflare DNS y {host}…',
      diagError: 'No se pudo completar el diagnóstico.',
      diagRetryError: 'No se pudo completar el diagnóstico. Reintenta cuando tengas conexión.',
      recoverySummary: 'Instrucciones de recuperación DNS',
      recoveryAndroid: 'Android: Ajustes → Red e Internet → DNS privado → Nombre de host del proveedor → escribe {dns} → Guardar. Vuelve y reintenta.',
      recoveryAndroidLink: 'Instrucciones oficiales de Android',
      recoveryIos: 'iPhone o iPad: usa Cloudflare 1.1.1.1 en modo solo DNS (WARP no es necesario). Vuelve y reintenta.',
      recoveryIosLink: 'Instrucciones oficiales de iOS',
      recoveryAndroidApp: 'App para Android',
      recoveryIosApp: 'App para iPhone',
    },
  };

  var domainConfig = window.YouGeDomain && typeof window.YouGeDomain.resolve === 'function'
    ? window.YouGeDomain.resolve({
        hostname: window.location.hostname,
        origin: window.location.origin,
        protocol: window.location.protocol,
        pathname: window.location.pathname,
      })
    : null;
  var workerBase = '/';
  try {
    var script = document.querySelector('script[src$="offline.js"]');
    workerBase = new URL('./', script ? script.src : window.location.href).pathname;
  } catch (error) {
    workerBase = '/';
  }

  function normalizeShortLocale(raw) {
    var value = String(raw || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    if (value === 'nb' || value === 'nn') value = 'no';
    return value;
  }

  function resolveActiveLocale() {
    try {
      if (window.YouGeAssistant && typeof window.YouGeAssistant.getLocale === 'function') {
        var assistantLang = normalizeShortLocale(window.YouGeAssistant.getLocale());
        if (COPY[assistantLang]) return assistantLang;
      }
    } catch (error) { /* ignore */ }
    if (domainConfig && domainConfig.language && String(domainConfig.language).toLowerCase() !== 'auto') {
      var domainLang = normalizeShortLocale(domainConfig.language);
      if (COPY[domainLang]) return domainLang;
    }
    var rawNav = (Array.isArray(navigator.languages) && navigator.languages.length && navigator.languages[0]) || navigator.language || 'en';
    var navLang = normalizeShortLocale(rawNav);
    return COPY[navLang] ? navLang : 'en';
  }

  var activeLang = resolveActiveLocale();

  function msg(key, params) {
    var table = COPY[activeLang] || COPY.en;
    var text = table[key] != null ? table[key] : (COPY.en[key] || '');
    if (!params) return text;
    return text.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, name) {
      return params[name] != null ? String(params[name]) : '';
    });
  }

  var fallbackName = document.documentElement.getAttribute('data-default-app-name') || 'You.Ge Assistant';
  var resolvedTitleAppName = (domainConfig && domainConfig.domain && domainConfig.domain.configured)
    ? domainConfig.identity.name
    : fallbackName;

  if (domainConfig) {
    if (appName) appName.textContent = resolvedTitleAppName;
    if (domainConfig.domain && domainConfig.domain.configured && domainConfig.pwa.basePath) workerBase = domainConfig.pwa.basePath;
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = domainConfig.branding.themeColor;
    document.documentElement.style.setProperty('--brand', domainConfig.branding.themeColor);
    var icon = document.querySelector('.icon');
    if (icon) {
      try { icon.src = new URL(domainConfig.branding.icon, new URL(workerBase, window.location.origin)).href; } catch (error) { /* keep bundled icon */ }
    }
  }
  if (currentDomain) currentDomain.textContent = window.location.hostname;
  if (retryLink) retryLink.href = workerBase;

  function assistantDiagnosticsEnabled() {
    try {
      var assistant = window.YouGeAssistant;
      if (assistant && typeof assistant.isCapabilityEnabled === 'function') {
        return assistant.isCapabilityEnabled('diagnostics') !== false;
      }
    } catch (error) { /* a broken Assistant must never break the offline shell */ }
    return true;
  }

  var recoveryGuide = document.getElementById('recoveryGuide');
  if (recoveryGuide && domainConfig && domainConfig.features.dnsRecovery === false) recoveryGuide.hidden = true;
  if (diagnosticsButton && domainConfig && domainConfig.features.diagnostics === false) diagnosticsButton.hidden = true;
  if (diagnosticsButton && !assistantDiagnosticsEnabled()) diagnosticsButton.hidden = true;

  var wasOffline = !navigator.onLine;
  var diagRanOnce = false;
  var diagRunning = false;

  function applyStaticCopy() {
    activeLang = resolveActiveLocale();
    if (document.documentElement) {
      document.documentElement.lang = activeLang;
      document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].indexOf(activeLang) !== -1 ? 'rtl' : 'ltr';
    }
    document.title = msg('titlePrefix') + resolvedTitleAppName;
    if (domainLabel) domainLabel.textContent = msg('domainLabel');
    if (retryLink) retryLink.textContent = msg('retry');
    if (diagnosticsButton && !diagRunning) {
      diagnosticsButton.textContent = diagRanOnce ? msg('retryDiag') : msg('runDiag');
    }
    if (recoverySummary) recoverySummary.textContent = msg('recoverySummary');
    if (recoveryAndroid) {
      var template = msg('recoveryAndroid', { dns: '___DNS___' });
      var parts = template.split('___DNS___');
      if (parts.length === 2 && typeof document.createElement === 'function') {
        recoveryAndroid.textContent = '';
        recoveryAndroid.appendChild(document.createTextNode(parts[0]));
        var code = document.createElement('code');
        code.textContent = 'one.one.one.one';
        recoveryAndroid.appendChild(code);
        recoveryAndroid.appendChild(document.createTextNode(parts[1]));
      } else {
        recoveryAndroid.textContent = msg('recoveryAndroid', { dns: 'one.one.one.one' });
      }
    }
    if (recoveryAndroidLink) recoveryAndroidLink.textContent = msg('recoveryAndroidLink');
    if (recoveryIos) recoveryIos.textContent = msg('recoveryIos');
    if (recoveryIosLink) recoveryIosLink.textContent = msg('recoveryIosLink');
    if (recoveryAndroidApp) recoveryAndroidApp.textContent = msg('recoveryAndroidApp');
    if (recoveryIosApp) recoveryIosApp.textContent = msg('recoveryIosApp');
  }

  function setOnline() {
    statusText.textContent = msg('onlineStatus');
    dot.style.background = '#22c55e';
  }

  function setOffline() {
    statusText.textContent = msg('offlineStatus');
    dot.style.background = '#f59e0b';
  }

  function update() {
    applyStaticCopy();
    if (!navigator.onLine) {
      wasOffline = true;
      setOffline();
      headline.textContent = msg('offlineHeadline');
      message.textContent = msg('offlineMessage');
      hint.textContent = msg('offlineHint');
      return;
    }

    setOnline();

    if (wasOffline) {
      headline.textContent = msg('restoredHeadline');
      message.textContent = msg('restoredMessage');
      hint.textContent = msg('restoredHint');
      setTimeout(function () {
        window.location.reload();
      }, 300);
      return;
    }

    headline.textContent = msg('onlineHeadline');
    message.textContent = msg('onlineMessage');
    hint.textContent = msg('onlineHint');
  }

  if (diagnosticsButton) {
    diagnosticsButton.addEventListener('click', function () {
      if (!assistantDiagnosticsEnabled()) return;
      if (!window.YouGeDns || typeof window.YouGeDns.check !== 'function') {
        if (diagnosticsResult) diagnosticsResult.textContent = msg('diagUnavailable');
        return;
      }
      diagRunning = true;
      diagRanOnce = true;
      diagnosticsButton.disabled = true;
      diagnosticsButton.textContent = msg('checkingBtn');
      if (diagnosticsResult) diagnosticsResult.textContent = msg('diagChecking', { host: window.location.hostname });
      window.YouGeDns.check({
        hostname: window.location.hostname,
        origin: window.location.origin,
        basePath: workerBase,
        online: navigator.onLine,
        locale: activeLang,
      }, { locale: activeLang }).then(function (result) {
        if (window.CustomEvent && document.dispatchEvent) {
          document.dispatchEvent(new CustomEvent('youge:dns-result', { detail: result }));
        }
        if (!diagnosticsResult) return;
        diagnosticsResult.textContent = result.message + (result.caveat ? ' ' + result.caveat : '');
      }).catch(function () {
        if (window.CustomEvent && document.dispatchEvent) {
          document.dispatchEvent(new CustomEvent('youge:dns-result', {
            detail: { classification: 'error', message: msg('diagError'), failed: true }
          }));
        }
        if (diagnosticsResult) diagnosticsResult.textContent = msg('diagRetryError');
      }).then(function () {
        diagRunning = false;
        diagnosticsButton.disabled = false;
        diagnosticsButton.textContent = msg('retryDiag');
      });
    });
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  window.addEventListener('languagechange', update);
  document.addEventListener('youge:locale-change', update);
  document.addEventListener('pwa:language', update);
  update();
})();
