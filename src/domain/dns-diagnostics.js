/*!
 * dns-diagnostics.js — on-demand Cloudflare DNS-over-HTTPS diagnostics.
 * This cannot inspect the device's configured DNS resolver or prove DNS blocking.
 */
(function (root) {
  'use strict';

  var ENDPOINT = 'https://cloudflare-dns.com/dns-query';
  var inflight = new Map();
  var fetchIdentities = new WeakMap();
  var nextFetchIdentity = 0;
  var STATUS = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
  var HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
  var IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  var IPV6_BRACKET_PATTERN = /^\[[0-9a-f:.]+\]$/i;

  var DNS_MESSAGES = {
    en: {
      fetchUnavailable: 'Fetch is unavailable in this browser.',
      cancelled: 'Diagnostics were cancelled before they finished.',
      cancelledBeforeStart: 'Diagnostics were cancelled before any request was made.',
      cancelledByCaller: 'Diagnostics were cancelled by the caller.',
      disabled: 'Network diagnostics are disabled for this project.',
      invalidHostname: 'The current hostname is not a valid DNS name.',
      invalidOrigin: 'The current origin could not be validated.',
      invalidBasePath: 'The deployment base path could not be validated.',
      inconclusive: 'Results are inconclusive. Retry the diagnostics.',
      caveat: 'JavaScript cannot inspect your device’s normal DNS resolver. A DoH result does not prove that the browser resolver is blocked.',
      offlineFailure: 'The browser reports no network connection, and the application host did not respond.',
      backendUnavailable: 'The application host responds, but its configured backend health endpoint did not.',
      targetPublicIp: 'This app is served from the IP address {host}. Public Cloudflare DNS resolves DNS names, not IP literals, so the DNS lookup was skipped. ',
      targetPrivate: 'This app is served from a private or local-only IP address, so public Cloudflare DNS checks were skipped. ',
      targetLocalhost: 'This is a local development host, so public Cloudflare DNS checks were skipped. ',
      localHostOk: 'The application host responded.',
      localHostFailPrivate: 'The application host did not respond; verify the server is running on that address and port.',
      localHostFailPublicIp: 'The application host did not respond; verify the server address, port and TLS configuration.',
      localHostFailLocalhost: 'The application host did not respond; verify that the local development server is running.',
      nxdomainConflict: 'Cloudflare reports NXDOMAIN while this app responded. The results conflict; check DNS propagation and retry.',
      nxdomainFail: 'Cloudflare DNS returned NXDOMAIN for the current hostname.',
      noErrorMissingRecords: 'Cloudflare returned NOERROR but no A or AAAA address records for this hostname.',
      normalConnectivity: 'Cloudflare DNS resolved this hostname and the application host responded.',
      dnsResolvedAppDown: 'Cloudflare DNS resolved this hostname, but the application host did not respond. DNS interference is one possible explanation; IP routing, TLS, CDN, firewall, or server problems can produce the same result.',
      dohUnavailableAppOk: 'The application host responded, but Cloudflare DNS-over-HTTPS could not be reached or validated.',
      dohAndAppOffline: 'The browser reports no network connection; neither the application nor the DoH endpoint responded.',
      dohAndAppUnreachable: 'The browser reports a connection, but the application host and Cloudflare DNS-over-HTTPS did not respond. Network, CORS, TLS, routing, or server availability may be involved.',
      mixedDns: 'DNS checks returned mixed results. Retry; this is not enough evidence to identify DNS interference.',
      dnsErrorStatus: 'Cloudflare DNS returned an error status: {statuses}.',
    },
    ka: {
      fetchUnavailable: 'ამ ბრაუზერში Fetch მიუწვდომელია.',
      cancelled: 'დიაგნოსტიკა დასრულებამდე გაუქმდა.',
      cancelledBeforeStart: 'დიაგნოსტიკა მოთხოვნის გაგზავნამდე გაუქმდა.',
      cancelledByCaller: 'დიაგნოსტიკა გამომძახებელმა გააუქმა.',
      disabled: 'ქსელის დიაგნოსტიკა ამ პროექტისთვის გამორთულია.',
      invalidHostname: 'მიმდინარე ჰოსტის სახელი სწორი DNS სახელი არ არის.',
      invalidOrigin: 'მიმდინარე წყაროს (origin) გადამოწმება ვერ მოხერხდა.',
      invalidBasePath: 'აპის საბაზო მისამართის გადამოწმება ვერ მოხერხდა.',
      inconclusive: 'შედეგები არასაკმარისია. სცადეთ დიაგნოსტიკის ხელახლა გაშვება.',
      caveat: 'JavaScript ვერ ამოწმებს მოწყობილობის სტანდარტულ DNS რეზოლვერს. DoH შედეგი არ ადასტურებს ბრაუზერის DNS-ის ბლოკირებას.',
      offlineFailure: 'ბრაუზერი აფიქსირებს ინტერნეტის არარსებობას და აპის სერვერმა არ უპასუხა.',
      backendUnavailable: 'აპის სერვერი პასუხობს, თუმცა ბექენდის სტატუსის მისამართმა არ უპასუხა.',
      targetPublicIp: 'ეს აპი გაშვებულია IP მისამართიდან {host}. საჯარო Cloudflare DNS ამუშავებს დომენებს და არა IP მისამართებს, ამიტომ DNS შემოწმება გამოიტოვა. ',
      targetPrivate: 'ეს აპი გაშვებულია კერძო ან ლოკალური ქსელის IP მისამართიდან, ამიტომ საჯარო Cloudflare DNS შემოწმება გამოიტოვა. ',
      targetLocalhost: 'ეს არის ლოკალური დეველოპმენტის ჰოსტი, ამიტომ საჯარო Cloudflare DNS შემოწმება გამოიტოვა. ',
      localHostOk: 'აპის სერვერმა უპასუხა.',
      localHostFailPrivate: 'აპის სერვერმა არ უპასუხა; შეამოწმეთ მუშაობს თუ არა სერვერი ამ მისამართსა და პორტზე.',
      localHostFailPublicIp: 'აპის სერვერმა არ უპასუხა; შეამოწმეთ სერვერის მისამართი, პორტი და TLS კონფიგურაცია.',
      localHostFailLocalhost: 'აპის სერვერმა არ უპასუხა; შეამოწმეთ ჩართულია თუ არა ლოკალური სერვერი.',
      nxdomainConflict: 'Cloudflare-მა დააბრუნა NXDOMAIN, თუმცა ამ აპმა უპასუხა. შედეგები ეწინააღმდეგება; შეამოწმეთ DNS განახლება და სცადეთ ხელახლა.',
      nxdomainFail: 'Cloudflare DNS-მა მიმდინარე ჰოსტისთვის დააბრუნა NXDOMAIN.',
      noErrorMissingRecords: 'Cloudflare-მა დააბრუნა NOERROR, მაგრამ A ან AAAA ჩანაწერები ვერ მოიძებნა.',
      normalConnectivity: 'Cloudflare DNS-მა წარმატებით გადაამოწმა ჰოსტი და აპის სერვერმა უპასუხა.',
      dnsResolvedAppDown: 'Cloudflare DNS-მა ჰოსტი იპოვა, მაგრამ აპის სერვერმა არ უპასუხა. მიზეზი შეიძლება იყოს DNS ჩარევა, IP მარშრუტიზაცია, TLS, CDN, ფაიერვოლი ან სერვერის ხარვეზი.',
      dohUnavailableAppOk: 'აპის სერვერმა უპასუხა, მაგრამ Cloudflare DNS-over-HTTPS მიუწვდომელია ან ვერ დამოწმდა.',
      dohAndAppOffline: 'ბრაუზერი ოფლაინ რეჟიმშია; არც აპის სერვერმა და არც DoH სერვისმა არ უპასუხა.',
      dohAndAppUnreachable: 'ბრაუზერი აფიქსირებს კავშირს, თუმცა არც აპის სერვერმა და არც Cloudflare DoH-მა არ უპასუხა. მიზეზი შეიძლება იყოს ქსელი, CORS, TLS, მარშრუტიზაცია ან სერვერი.',
      mixedDns: 'DNS შემოწმებამ შერეული შედეგები დააბრუნა. სცადეთ ხელახლა — ეს არ არის საკმარისი DNS ჩარევის დასადგენად.',
      dnsErrorStatus: 'Cloudflare DNS-მა დააბრუნა შეცდომის სტატუსი: {statuses}.',
    },
    ru: {
      fetchUnavailable: 'Fetch недоступен в этом браузере.',
      cancelled: 'Диагностика была отменена до завершения.',
      cancelledBeforeStart: 'Диагностика была отменена до отправки запросов.',
      cancelledByCaller: 'Диагностика отменена вызывающим кодом.',
      disabled: 'Сетевая диагностика отключена для этого проекта.',
      invalidHostname: 'Текущее имя хоста не является корректным DNS-именем.',
      invalidOrigin: 'Не удалось подтвердить текущий источник (origin).',
      invalidBasePath: 'Не удалось подтвердить базовый путь развёртывания.',
      inconclusive: 'Результаты неоднозначны. Повторите диагностику.',
      caveat: 'JavaScript не может проверить системный DNS-резолвер устройства. Ответ DoH не доказывает блокировку браузерного резолвера.',
      offlineFailure: 'Браузер сообщает об отсутствии сети, а сервер приложения не ответил.',
      backendUnavailable: 'Хост приложения отвечает, но настроенный эндпоинт здоровья бэкенда не ответил.',
      targetPublicIp: 'Приложение открыто по IP-адресу {host}. Публичный Cloudflare DNS разрешает доменные имена, а не IP-адреса, поэтому проверка DNS пропущена. ',
      targetPrivate: 'Приложение работает на частном или локальном IP-адресе, поэтому проверка через публичный Cloudflare DNS пропущена. ',
      targetLocalhost: 'Это локальный хост разработки, поэтому проверка через публичный Cloudflare DNS пропущена. ',
      localHostOk: 'Хост приложения ответил.',
      localHostFailPrivate: 'Хост приложения не ответил; проверьте, запущен ли сервер на этом адресе и порту.',
      localHostFailPublicIp: 'Хост приложения не ответил; проверьте адрес сервера, порт и настройки TLS.',
      localHostFailLocalhost: 'Хост приложения не ответил; проверьте, запущен ли локальный сервер разработки.',
      nxdomainConflict: 'Cloudflare вернул NXDOMAIN, но приложение ответило. Результаты противоречивы; проверьте распространение DNS и повторите.',
      nxdomainFail: 'Cloudflare DNS вернул NXDOMAIN для текущего хоста.',
      noErrorMissingRecords: 'Cloudflare вернул NOERROR, но для этого хоста нет записей A или AAAA.',
      normalConnectivity: 'Cloudflare DNS разрешил это имя хоста, и сервер приложения ответил.',
      dnsResolvedAppDown: 'Cloudflare DNS разрешил имя хоста, но сервер приложения не ответил. Причиной может быть вмешательство в DNS, маршрутизация, TLS, CDN, брандмауэр или сбой сервера.',
      dohUnavailableAppOk: 'Хост приложения ответил, но не удалось связаться с Cloudflare DNS-over-HTTPS.',
      dohAndAppOffline: 'Браузер сообщает об отсутствии подключения; ни приложение, ни DoH не ответили.',
      dohAndAppUnreachable: 'Браузер сообщает о наличии сети, но ни хост приложения, ни Cloudflare DoH не ответили. Возможны проблемы сети, CORS, TLS, маршрутизации или сервера.',
      mixedDns: 'Проверки DNS дали смешанный результат. Повторите; этих данных недостаточно для вывода о блокировке DNS.',
      dnsErrorStatus: 'Cloudflare DNS вернул статус ошибки: {statuses}.',
    },
    fr: {
      fetchUnavailable: 'Fetch est indisponible dans ce navigateur.',
      cancelled: 'Le diagnostic a été annulé avant la fin.',
      cancelledBeforeStart: 'Le diagnostic a été annulé avant toute requête.',
      cancelledByCaller: 'Le diagnostic a été annulé par l’appelant.',
      disabled: 'Le diagnostic réseau est désactivé pour ce projet.',
      invalidHostname: 'Le nom d’hôte actuel n’est pas un nom DNS valide.',
      invalidOrigin: 'L’origine actuelle n’a pas pu être validée.',
      invalidBasePath: 'Le chemin de base du déploiement n’a pas pu être validé.',
      inconclusive: 'Les résultats ne sont pas concluants. Relancez le diagnostic.',
      caveat: 'JavaScript ne peut pas inspecter le résolveur DNS habituel de votre appareil. Un résultat DoH ne prouve pas un blocage du résolveur du navigateur.',
      offlineFailure: 'Le navigateur indique l’absence de connexion réseau et l’hôte de l’application n’a pas répondu.',
      backendUnavailable: 'L’hôte de l’application répond, mais son point de contrôle backend configuré n’a pas répondu.',
      targetPublicIp: 'Cette application est servie depuis l’adresse IP {host}. Cloudflare DNS public résout des noms de domaine, pas des adresses IP ; la requête DNS a été ignorée. ',
      targetPrivate: 'Cette application utilise une adresse IP privée ou locale ; les vérifications Cloudflare DNS publiques ont été ignorées. ',
      targetLocalhost: 'Il s’agit d’un hôte de développement local ; les vérifications Cloudflare DNS publiques ont été ignorées. ',
      localHostOk: 'L’hôte de l’application a répondu.',
      localHostFailPrivate: 'L’hôte de l’application n’a pas répondu ; vérifiez que le serveur tourne sur cette adresse et ce port.',
      localHostFailPublicIp: 'L’hôte de l’application n’a pas répondu ; vérifiez l’adresse IP, le port et la configuration TLS.',
      localHostFailLocalhost: 'L’hôte de l’application n’a pas répondu ; vérifiez que le serveur de développement local est démarré.',
      nxdomainConflict: 'Cloudflare renvoie NXDOMAIN alors que l’application a répondu. Vérifiez la propagation DNS et réessayez.',
      nxdomainFail: 'Cloudflare DNS a renvoyé NXDOMAIN pour ce nom d’hôte.',
      noErrorMissingRecords: 'Cloudflare a renvoyé NOERROR mais aucun enregistrement A ou AAAA pour cet hôte.',
      normalConnectivity: 'Cloudflare DNS a résolu ce nom d’hôte et l’application a répondu.',
      dnsResolvedAppDown: 'Cloudflare DNS a résolu ce nom d’hôte, mais l’application n’a pas répondu. Une interférence DNS, le routage IP, TLS, le CDN, le pare-feu ou le serveur peuvent être en cause.',
      dohUnavailableAppOk: 'L’application a répondu, mais Cloudflare DNS-over-HTTPS est injoignable ou invalide.',
      dohAndAppOffline: 'Le navigateur signale une absence de connexion ; ni l’application ni le point DoH n’ont répondu.',
      dohAndAppUnreachable: 'Le navigateur est en ligne, mais ni l’application ni Cloudflare DoH n’ont répondu (réseau, CORS, TLS, routage ou serveur).',
      mixedDns: 'Les vérifications DNS ont donné des résultats mixtes. Réessayez pour confirmer.',
      dnsErrorStatus: 'Cloudflare DNS a renvoyé un statut d’erreur : {statuses}.',
    },
    it: {
      fetchUnavailable: 'Fetch non è disponibile in questo browser.',
      cancelled: 'La diagnostica è stata annullata prima del completamento.',
      cancelledBeforeStart: 'La diagnostica è stata annullata prima di qualsiasi richiesta.',
      cancelledByCaller: 'La diagnostica è stata annullata dal chiamante.',
      disabled: 'La diagnostica di rete è disattivata per questo progetto.',
      invalidHostname: 'Il nome host attuale non è un nome DNS valido.',
      invalidOrigin: 'Impossibile convalidare l’origine corrente.',
      invalidBasePath: 'Impossibile convalidare il percorso base della distribuzione.',
      inconclusive: 'Risultati non conclusivi. Riprova la diagnostica.',
      caveat: 'JavaScript non può ispezionare il resolver DNS normale del dispositivo. Un risultato DoH non dimostra il blocco del resolver del browser.',
      offlineFailure: 'Il browser segnala assenza di connessione e l’host dell’app non ha risposto.',
      backendUnavailable: 'L’host dell’app risponde, ma l’endpoint di stato del backend configurato no.',
      targetPublicIp: 'Questa app è servita dall’indirizzo IP {host}. Il DNS pubblico Cloudflare risolve nomi DNS, non indirizzi IP, quindi la ricerca DNS è stata saltata. ',
      targetPrivate: 'Questa app è servita da un indirizzo IP privato o locale, quindi i controlli Cloudflare DNS pubblici sono stati saltati. ',
      targetLocalhost: 'Questo è un host di sviluppo locale, quindi i controlli Cloudflare DNS pubblici sono stati saltati. ',
      localHostOk: 'L’host dell’applicazione ha risposto.',
      localHostFailPrivate: 'L’host dell’app non ha risposto; verifica che il server sia avviato su quell’indirizzo e porta.',
      localHostFailPublicIp: 'L’host dell’app non ha risposto; verifica indirizzo, porta e configurazione TLS.',
      localHostFailLocalhost: 'L’host dell’app non ha risposto; verifica che il server di sviluppo locale sia attivo.',
      nxdomainConflict: 'Cloudflare segnala NXDOMAIN ma l’app ha risposto. Controlla la propagazione DNS e riprova.',
      nxdomainFail: 'Cloudflare DNS ha restituito NXDOMAIN per il nome host corrente.',
      noErrorMissingRecords: 'Cloudflare ha restituito NOERROR ma nessun record A o AAAA per questo host.',
      normalConnectivity: 'Cloudflare DNS ha risolto l’host e l’applicazione ha risposto.',
      dnsResolvedAppDown: 'Cloudflare DNS ha risolto l’host, ma l’applicazione non ha risposto. Possibile interferenza DNS, routing IP, TLS, CDN, firewall o errore del server.',
      dohUnavailableAppOk: 'L’app ha risposto, ma Cloudflare DNS-over-HTTPS non è raggiungibile o valido.',
      dohAndAppOffline: 'Il browser segnala nessuna connessione; né l’app né DoH hanno risposto.',
      dohAndAppUnreachable: 'Il browser è connesso, ma né l’app né Cloudflare DoH hanno risposto (rete, CORS, TLS, routing o server).',
      mixedDns: 'I controlli DNS hanno dato esiti misti. Riprova; non basta per stabilire un’interferenza DNS.',
      dnsErrorStatus: 'Cloudflare DNS ha restituito uno stato di errore: {statuses}.',
    },
    de: {
      fetchUnavailable: 'Fetch ist in diesem Browser nicht verfügbar.',
      cancelled: 'Die Diagnose wurde vor Abschluss abgebrochen.',
      cancelledBeforeStart: 'Die Diagnose wurde vor Beginn der Anfragen abgebrochen.',
      cancelledByCaller: 'Die Diagnose wurde vom Aufrufer abgebrochen.',
      disabled: 'Die Netzwerkdiagnose ist für dieses Projekt deaktiviert.',
      invalidHostname: 'Der aktuelle Hostname ist kein gültiger DNS-Name.',
      invalidOrigin: 'Die aktuelle Origin konnte nicht validiert werden.',
      invalidBasePath: 'Der Basispfad der Bereitstellung konnte nicht validiert werden.',
      inconclusive: 'Ergebnisse nicht eindeutig. Diagnose erneut starten.',
      caveat: 'JavaScript kann den System-DNS-Resolver des Geräts nicht einsehen. Ein DoH-Ergebnis beweist keine Blockierung des Browser-Resolvers.',
      offlineFailure: 'Der Browser meldet keine Netzwerkverbindung und der App-Host hat nicht geantwortet.',
      backendUnavailable: 'Der App-Host antwortet, aber der konfigurierte Backend-Endpunkt nicht.',
      targetPublicIp: 'Diese App wird über die IP-Adresse {host} bereitgestellt. Öffentliches Cloudflare DNS löst Hostnamen auf, keine IP-Adressen, daher wurde die DNS-Abfrage übersprungen. ',
      targetPrivate: 'Diese App läuft über eine private oder lokale IP-Adresse; öffentliche Cloudflare-DNS-Prüfungen wurden übersprungen. ',
      targetLocalhost: 'Dies ist ein lokaler Entwicklungs-Host; öffentliche Cloudflare-DNS-Prüfungen wurden übersprungen. ',
      localHostOk: 'Der Anwendungs-Host hat geantwortet.',
      localHostFailPrivate: 'Der Anwendungs-Host hat nicht geantwortet; prüfen Sie Adresse und Port des Servers.',
      localHostFailPublicIp: 'Der Anwendungs-Host hat nicht geantwortet; prüfen Sie Adresse, Port und TLS-Konfiguration.',
      localHostFailLocalhost: 'Der Anwendungs-Host hat nicht geantwortet; prüfen Sie, ob der lokale Entwicklungsserver läuft.',
      nxdomainConflict: 'Cloudflare meldet NXDOMAIN, obwohl diese App geantwortet hat. DNS-Propagation prüfen und erneut testen.',
      nxdomainFail: 'Cloudflare DNS hat NXDOMAIN für den aktuellen Hostnamen zurückgegeben.',
      noErrorMissingRecords: 'Cloudflare meldet NOERROR, aber keine A- oder AAAA-Einträge für diesen Hostnamen.',
      normalConnectivity: 'Cloudflare DNS hat diesen Hostnamen aufgelöst und die Anwendung hat geantwortet.',
      dnsResolvedAppDown: 'Cloudflare DNS hat den Hostnamen aufgelöst, aber der Anwendungs-Host antwortet nicht. Mögliche Ursachen: DNS-Störung, Routing, TLS, CDN, Firewall oder Serverfehler.',
      dohUnavailableAppOk: 'Die Anwendung hat geantwortet, aber Cloudflare DNS-over-HTTPS war nicht erreichbar oder ungültig.',
      dohAndAppOffline: 'Der Browser meldet keine Verbindung; weder die App noch der DoH-Endpunkt antworteten.',
      dohAndAppUnreachable: 'Der Browser meldet eine Verbindung, aber App-Host und Cloudflare DoH antworteten nicht (Netzwerk, CORS, TLS, Routing oder Server).',
      mixedDns: 'DNS-Prüfungen lieferten gemischte Ergebnisse. Erneut versuchen; dies reicht noch nicht als Nachweis für DNS-Störungen.',
      dnsErrorStatus: 'Cloudflare DNS lieferte einen Fehlerstatus: {statuses}.',
    },
    sv: {
      fetchUnavailable: 'Fetch är inte tillgängligt i den här webbläsaren.',
      cancelled: 'Diagnostiken avbröts innan den hann slutföras.',
      cancelledBeforeStart: 'Diagnostiken avbröts innan någon begäran skickades.',
      cancelledByCaller: 'Diagnostiken avbröts av anroparen.',
      disabled: 'Nätverksdiagnostik är inaktiverad för det här projektet.',
      invalidHostname: 'Det aktuella värdnamnet är inte ett giltigt DNS-namn.',
      invalidOrigin: 'Nuvarande origin kunde inte verifieras.',
      invalidBasePath: 'Applikationens bassökväg kunde inte verifieras.',
      inconclusive: 'Resultaten är osäkra. Försök köra diagnostiken igen.',
      caveat: 'JavaScript kan inte inspektera enhetens vanliga DNS-resolver. Ett DoH-resultat bevisar inte att webbläsarens resolver är blockerad.',
      offlineFailure: 'Webbläsaren rapporterar ingen nätverksanslutning och appvärden svarade inte.',
      backendUnavailable: 'Appvärden svarar, men den konfigurerade hälsokontrollen för backend svarade inte.',
      targetPublicIp: 'Appen körs från IP-adressen {host}. Publik Cloudflare DNS slår upp domännamn, inte IP-adresser, så DNS-uppslagningen hoppades över. ',
      targetPrivate: 'Appen körs från en privat eller lokal IP-adress, så publika Cloudflare DNS-kontroller hoppades över. ',
      targetLocalhost: 'Detta är en lokal utvecklingsvärd, så publika Cloudflare DNS-kontroller hoppades över. ',
      localHostOk: 'Appvärden svarade.',
      localHostFailPrivate: 'Appvärden svarade inte; kontrollera att servern körs på adressen och porten.',
      localHostFailPublicIp: 'Appvärden svarade inte; kontrollera serveradress, port och TLS-konfiguration.',
      localHostFailLocalhost: 'Appvärden svarade inte; kontrollera att den lokala utvecklingsservern är igång.',
      nxdomainConflict: 'Cloudflare rapporterar NXDOMAIN medan appen svarade. Kontrollera DNS-spridning och försök igen.',
      nxdomainFail: 'Cloudflare DNS returnerade NXDOMAIN för det aktuella värdnamnet.',
      noErrorMissingRecords: 'Cloudflare returnerade NOERROR men inga A- eller AAAA-poster för värdnamnet.',
      normalConnectivity: 'Cloudflare DNS slog upp värdnamnet och appvärden svarade.',
      dnsResolvedAppDown: 'Cloudflare DNS slog upp värdnamnet, men appvärden svarade inte. Orsaken kan vara DNS-påverkan, IP-routing, TLS, CDN, brandvägg eller serverfel.',
      dohUnavailableAppOk: 'Appvärden svarade, men Cloudflare DNS-over-HTTPS kunde inte nås eller valideras.',
      dohAndAppOffline: 'Webbläsaren rapporterar ingen anslutning; varken appen eller DoH-tjänsten svarade.',
      dohAndAppUnreachable: 'Webbläsaren rapporterar anslutning, men varken appvärden eller Cloudflare DoH svarade (nätverk, CORS, TLS, routing eller server).',
      mixedDns: 'DNS-kontrollerna gav blandade resultat. Försök igen; underlaget räcker inte för att avgöra DNS-störning.',
      dnsErrorStatus: 'Cloudflare DNS returnerade felstatus: {statuses}.',
    },
    nl: {
      fetchUnavailable: 'Fetch is niet beschikbaar in deze browser.',
      cancelled: 'De diagnostiek is afgebroken voordat deze klaar was.',
      cancelledBeforeStart: 'De diagnostiek is afgebroken voordat er een verzoek werd verstuurd.',
      cancelledByCaller: 'De diagnostiek is afgebroken door de aanroeper.',
      disabled: 'Netwerkdiagnostiek is uitgeschakeld voor dit project.',
      invalidHostname: 'De huidige hostnaam is geen geldige DNS-naam.',
      invalidOrigin: 'De huidige origin kon niet worden gevalideerd.',
      invalidBasePath: 'Het basispad van de implementatie kon niet worden gevalideerd.',
      inconclusive: 'De resultaten zijn niet doorslaggevend. Voer de diagnostiek opnieuw uit.',
      caveat: 'JavaScript kan de normale DNS-resolver van je apparaat niet bekijken. Een DoH-resultaat bewijst niet dat de browser-resolver geblokkeerd is.',
      offlineFailure: 'De browser meldt geen netwerkverbinding en de applicatiehost reageerde niet.',
      backendUnavailable: 'De applicatiehost reageert, maar het ingestelde backend-gezondheidseindpunt reageerde niet.',
      targetPublicIp: 'Deze app wordt aangeboden vanaf het IP-adres {host}. Publieke Cloudflare DNS vertaalt domeinnamen, geen IP-adressen, dus de DNS-opzoeking is overgeslagen. ',
      targetPrivate: 'Deze app draait op een privé- of lokaal IP-adres; publieke Cloudflare DNS-controles zijn overgeslagen. ',
      targetLocalhost: 'Dit is een lokale ontwikkelhost; publieke Cloudflare DNS-controles zijn overgeslagen. ',
      localHostOk: 'De applicatiehost reageerde.',
      localHostFailPrivate: 'De applicatiehost reageerde niet; controleer of de server op dat adres en die poort draait.',
      localHostFailPublicIp: 'De applicatiehost reageerde niet; controleer serveradres, poort en TLS-configuratie.',
      localHostFailLocalhost: 'De applicatiehost reageerde niet; controleer of de lokale ontwikkelserver draait.',
      nxdomainConflict: 'Cloudflare meldt NXDOMAIN terwijl deze app wel antwoordde. Controleer DNS-propagatie en probeer opnieuw.',
      nxdomainFail: 'Cloudflare DNS gaf NXDOMAIN terug voor de huidige hostnaam.',
      noErrorMissingRecords: 'Cloudflare gaf NOERROR terug maar zonder A- of AAAA-records voor deze hostnaam.',
      normalConnectivity: 'Cloudflare DNS heeft deze hostnaam opgelost en de applicatiehost reageerde.',
      dnsResolvedAppDown: 'Cloudflare DNS heeft deze hostnaam opgelost, maar de applicatiehost reageerde niet. DNS-verstoring, routering, TLS, CDN, firewall of serverproblemen kunnen de oorzaak zijn.',
      dohUnavailableAppOk: 'De applicatiehost reageerde, maar Cloudflare DNS-over-HTTPS was niet bereikbaar of ongeldig.',
      dohAndAppOffline: 'De browser meldt geen netwerkverbinding; noch de app noch DoH reageerde.',
      dohAndAppUnreachable: 'De browser meldt wel verbinding, maar de applicatiehost en Cloudflare DoH reageerden niet (netwerk, CORS, TLS, routering of server).',
      mixedDns: 'DNS-controles gaven gemengde resultaten. Probeer opnieuw; er is onvoldoende bewijs voor DNS-verstoring.',
      dnsErrorStatus: 'Cloudflare DNS gaf een foutstatus terug: {statuses}.',
    },
    no: {
      fetchUnavailable: 'Fetch er ikke tilgjengelig i denne nettleseren.',
      cancelled: 'Diagnostikken ble avbrutt før den var ferdig.',
      cancelledBeforeStart: 'Diagnostikken ble avbrutt før noen forespørsel ble sendt.',
      cancelledByCaller: 'Diagnostikken ble avbrutt av kaller.',
      disabled: 'Nettverksdiagnostikk er deaktivert for dette prosjektet.',
      invalidHostname: 'Gjeldende vertsnavn er ikke et gyldig DNS-navn.',
      invalidOrigin: 'Gjeldende origin kunne ikke valideres.',
      invalidBasePath: 'Applikasjonens basesti kunne ikke valideres.',
      inconclusive: 'Resultatene er usikre. Prøv å kjøre diagnostikken på nytt.',
      caveat: 'JavaScript kan ikke inspisere enhetens vanlige DNS-resolver. Et DoH-resultat beviser ikke at nettleserens resolver er blokkert.',
      offlineFailure: 'Nettleseren rapporterer ingen nettverkstilkobling, og appverten svarte ikke.',
      backendUnavailable: 'Appverten svarer, men det konfigurerte helseendepunktet for backend gjorde ikke det.',
      targetPublicIp: 'Denne appen kjører på IP-adressen {host}. Offentlig Cloudflare DNS slår opp domenenavn, ikke IP-adresser, så DNS-oppslaget ble hoppet over. ',
      targetPrivate: 'Denne appen kjører på en privat eller lokal IP-adresse, så offentlige Cloudflare DNS-sjekker ble hoppet over. ',
      targetLocalhost: 'Dette er en lokal utviklingsvert, så offentlige Cloudflare DNS-sjekker ble hoppet over. ',
      localHostOk: 'Appverten svarte.',
      localHostFailPrivate: 'Appverten svarte ikke; bekreft at serveren kjører på den adressen og porten.',
      localHostFailPublicIp: 'Appverten svarte ikke; bekreft serveradresse, port og TLS-oppsett.',
      localHostFailLocalhost: 'Appverten svarte ikke; bekreft at den lokale utviklingsserveren kjører.',
      nxdomainConflict: 'Cloudflare rapporterer NXDOMAIN mens denne appen svarte. Sjekk DNS-spredning og prøv igjen.',
      nxdomainFail: 'Cloudflare DNS returnerte NXDOMAIN for gjeldende vertsnavn.',
      noErrorMissingRecords: 'Cloudflare returnerte NOERROR, men ingen A- eller AAAA-poster for vertsnavnet.',
      normalConnectivity: 'Cloudflare DNS løste vertsnavnet og appverten svarte.',
      dnsResolvedAppDown: 'Cloudflare DNS løste vertsnavnet, men appverten svarte ikke. DNS-påvirkning, ruting, TLS, CDN, brannmur eller serverfeil kan gi dette resultatet.',
      dohUnavailableAppOk: 'Appverten svarte, men Cloudflare DNS-over-HTTPS kunne ikke nås eller valideres.',
      dohAndAppOffline: 'Nettleseren rapporterer ingen tilkobling; verken appen eller DoH-endepunktet svarte.',
      dohAndAppUnreachable: 'Nettleseren rapporterer tilkobling, men verken appverten eller Cloudflare DoH svarte (nettverk, CORS, TLS, ruting eller server).',
      mixedDns: 'DNS-sjekker ga blandede resultater. Prøv igjen; dette er ikke nok til å påvise DNS-forstyrrelse.',
      dnsErrorStatus: 'Cloudflare DNS returnerte en feilstatus: {statuses}.',
    },
    da: {
      fetchUnavailable: 'Fetch er ikke tilgængelig i denne browser.',
      cancelled: 'Diagnostikken blev annulleret, før den blev færdig.',
      cancelledBeforeStart: 'Diagnostikken blev annulleret, før der blev sendt nogen anmodning.',
      cancelledByCaller: 'Diagnostikken blev annulleret af kalderen.',
      disabled: 'Netværksdiagnostik er deaktiveret for dette projekt.',
      invalidHostname: 'Det aktuelle værtsnavn er ikke et gyldigt DNS-navn.',
      invalidOrigin: 'Den aktuelle oprindelse (origin) kunne ikke valideres.',
      invalidBasePath: 'Applikationens basissti kunne ikke valideres.',
      inconclusive: 'Resultaterne er uafklarede. Kør diagnostikken igen.',
      caveat: 'JavaScript kan ikke undersøge enhedens normale DNS-resolver. Et DoH-resultat beviser ikke, at browserens resolver er blokeret.',
      offlineFailure: 'Browseren rapporterer ingen netværksforbindelse, og applikationsværten svarede ikke.',
      backendUnavailable: 'Applikationsværten svarer, men dens konfigurerede backend-tjek gjorde ikke.',
      targetPublicIp: 'Denne app betjenes fra IP-adressen {host}. Offentlig Cloudflare DNS slår domænenavne op, ikke IP-adresser, så DNS-opslaget blev sprunget over. ',
      targetPrivate: 'Denne app betjenes fra en privat eller lokal IP-adresse, så offentlige Cloudflare DNS-tjek blev sprunget over. ',
      targetLocalhost: 'Dette er en lokal udviklingsvært, så offentlige Cloudflare DNS-tjek blev sprunget over. ',
      localHostOk: 'Applikationsværten svarede.',
      localHostFailPrivate: 'Applikationsværten svarede ikke; bekræft, at serveren kører på den adresse og port.',
      localHostFailPublicIp: 'Applikationsværten svarede ikke; bekræft serveradresse, port og TLS-konfiguration.',
      localHostFailLocalhost: 'Applikationsværten svarede ikke; bekræft, at den lokale udviklingsserver kører.',
      nxdomainConflict: 'Cloudflare melder NXDOMAIN, mens appen svarede. Tjek DNS-udbredelse og prøv igen.',
      nxdomainFail: 'Cloudflare DNS returnerede NXDOMAIN for det aktuelle værtsnavn.',
      noErrorMissingRecords: 'Cloudflare returnerede NOERROR, men ingen A- eller AAAA-poster for dette værtsnavn.',
      normalConnectivity: 'Cloudflare DNS slog værtsnavnet op, og applikationsværten svarede.',
      dnsResolvedAppDown: 'Cloudflare DNS slog værtsnavnet op, men applikationsværten svarede ikke. DNS-indblanding, routing, TLS, CDN, firewall eller serverfejl kan være årsagen.',
      dohUnavailableAppOk: 'Applikationsværten svarede, men Cloudflare DNS-over-HTTPS kunne ikke nås eller valideres.',
      dohAndAppOffline: 'Browseren melder ingen forbindelse; hverken appen eller DoH-endepunktet svarede.',
      dohAndAppUnreachable: 'Browseren melder forbindelse, men hverken applikationsværten eller Cloudflare DoH svarede (netværk, CORS, TLS, routing eller server).',
      mixedDns: 'DNS-tjek gav blandede resultater. Prøv igen; dette er ikke tilstrækkeligt til at fastslå DNS-indblanding.',
      dnsErrorStatus: 'Cloudflare DNS returnerede en fejlstatus: {statuses}.',
    },
    et: {
      fetchUnavailable: 'Fetch pole selles brauseris saadaval.',
      cancelled: 'Diagnostika tühistati enne lõpule jõudmist.',
      cancelledBeforeStart: 'Diagnostika tühistati enne päringute tegemist.',
      cancelledByCaller: 'Diagnostika tühistas väljakutsuja.',
      disabled: 'Võrgudiagnostika on selles projektis keelatud.',
      invalidHostname: 'Praegune hostinimi ei ole kehtiv DNS-nimi.',
      invalidOrigin: 'Praegust allikat (origin) ei õnnestunud kontrollida.',
      invalidBasePath: 'Rakenduse baasteed ei õnnestunud kontrollida.',
      inconclusive: 'Tulemused pole selged. Proovi diagnostikat uuesti.',
      caveat: 'JavaScript ei saa kontrollida seadme tavalist DNS-lahendajat. DoH tulemus ei tõesta brauseri lahendaja blokeerimist.',
      offlineFailure: 'Brauser teatab võrguühenduse puudumisest ja rakenduse host ei vastanud.',
      backendUnavailable: 'Rakenduse host vastab, kuid seadistatud taustateenuse kontroll ei vastanud.',
      targetPublicIp: 'Rakendust teenindatakse IP-aadressilt {host}. Avalik Cloudflare DNS lahendab domeeninimesid, mitte IP-aadresse, seega jäeti DNS-päring vahele. ',
      targetPrivate: 'Rakendust teenindatakse privaatselt või kohalikult IP-aadressilt, seega jäeti avalikud Cloudflare DNS-kontrollid vahele. ',
      targetLocalhost: 'See on kohalik arendushost, seega jäeti avalikud Cloudflare DNS-kontrollid vahele. ',
      localHostOk: 'Rakenduse host vastas.',
      localHostFailPrivate: 'Rakenduse host ei vastanud; kontrolli, kas server töötab sellel aadressil ja pordil.',
      localHostFailPublicIp: 'Rakenduse host ei vastanud; kontrolli serveri aadressi, porti ja TLS-seadistust.',
      localHostFailLocalhost: 'Rakenduse host ei vastanud; kontrolli, kas kohalik arendusserver töötab.',
      nxdomainConflict: 'Cloudflare teatab NXDOMAIN, samas kui rakendus vastas. Kontrolli DNS-levi ja proovi uuesti.',
      nxdomainFail: 'Cloudflare DNS tagastas praegusele hostinimele NXDOMAIN.',
      noErrorMissingRecords: 'Cloudflare tagastas NOERROR, kuid sellel hostinimel puuduvad A- või AAAA-kirjed.',
      normalConnectivity: 'Cloudflare DNS lahendas selle hostinime ja rakenduse host vastas.',
      dnsResolvedAppDown: 'Cloudflare DNS lahendas selle hostinime, kuid rakenduse host ei vastanud. Põhjuseks võib olla DNS-sekkumine, IP-marsruutimine, TLS, CDN, tulemüür või serveritõrge.',
      dohUnavailableAppOk: 'Rakenduse host vastas, kuid Cloudflare DNS-over-HTTPS polnud kättesaadav ega kontrollitav.',
      dohAndAppOffline: 'Brauser teatab võrguühenduse puudumisest; ei rakendus ega DoH-otspunkt vastanud.',
      dohAndAppUnreachable: 'Brauser teatab ühendusest, kuid ei rakenduse host ega Cloudflare DoH vastanud (võrk, CORS, TLS, marsruutimine või server).',
      mixedDns: 'DNS-kontrollid andsid vastakaid tulemusi. Proovi uuesti; sellest ei piisa DNS-sekkumise tuvastamiseks.',
      dnsErrorStatus: 'Cloudflare DNS tagastas vea oleku: {statuses}.',
    },
    es: {
      fetchUnavailable: 'Fetch no está disponible en este navegador.',
      cancelled: 'El diagnóstico se canceló antes de terminar.',
      cancelledBeforeStart: 'El diagnóstico se canceló antes de realizar ninguna solicitud.',
      cancelledByCaller: 'El diagnóstico fue cancelado por el llamador.',
      disabled: 'El diagnóstico de red está desactivado para este proyecto.',
      invalidHostname: 'El nombre de host actual no es un nombre DNS válido.',
      invalidOrigin: 'No se pudo validar el origen actual.',
      invalidBasePath: 'No se pudo validar la ruta base del despliegue.',
      inconclusive: 'Los resultados no son concluyentes. Vuelve a ejecutar el diagnóstico.',
      caveat: 'JavaScript no puede inspeccionar el resolutor DNS habitual del dispositivo. Un resultado DoH no demuestra que el resolutor del navegador esté bloqueado.',
      offlineFailure: 'El navegador indica que no hay conexión de red y el servidor de la aplicación no respondió.',
      backendUnavailable: 'El servidor de la aplicación responde, pero el punto de salud del backend configurado no respondió.',
      targetPublicIp: 'Esta aplicación se sirve desde la dirección IP {host}. El DNS público de Cloudflare resuelve nombres de dominio, no direcciones IP, por lo que se omitió la consulta DNS. ',
      targetPrivate: 'Esta aplicación se sirve desde una dirección IP privada o local, por lo que se omitieron las comprobaciones públicas de Cloudflare DNS. ',
      targetLocalhost: 'Este es un host de desarrollo local, por lo que se omitieron las comprobaciones públicas de Cloudflare DNS. ',
      localHostOk: 'El servidor de la aplicación respondió.',
      localHostFailPrivate: 'El servidor de la aplicación no respondió; verifica que el servidor esté ejecutándose en esa dirección y puerto.',
      localHostFailPublicIp: 'El servidor de la aplicación no respondió; verifica la dirección, el puerto y la configuración TLS.',
      localHostFailLocalhost: 'El servidor de la aplicación no respondió; verifica que el servidor local de desarrollo esté iniciado.',
      nxdomainConflict: 'Cloudflare informa NXDOMAIN mientras esta aplicación respondió. Comprueba la propagación DNS e inténtalo de nuevo.',
      nxdomainFail: 'Cloudflare DNS devolvió NXDOMAIN para el nombre de host actual.',
      noErrorMissingRecords: 'Cloudflare devolvió NOERROR pero no hay registros A ni AAAA para este host.',
      normalConnectivity: 'Cloudflare DNS resolvió este nombre de host y la aplicación respondió.',
      dnsResolvedAppDown: 'Cloudflare DNS resolvió este nombre de host, pero la aplicación no respondió. Puede deberse a interferencia DNS, enrutamiento IP, TLS, CDN, firewall o fallo del servidor.',
      dohUnavailableAppOk: 'La aplicación respondió, pero no se pudo contactar ni validar Cloudflare DNS-over-HTTPS.',
      dohAndAppOffline: 'El navegador indica falta de conexión; ni la aplicación ni el servicio DoH respondieron.',
      dohAndAppUnreachable: 'El navegador indica conexión, pero ni la aplicación ni Cloudflare DoH respondieron (red, CORS, TLS, enrutamiento o servidor).',
      mixedDns: 'Las comprobaciones DNS arrojaron resultados mixtos. Reintenta; no basta para confirmar interferencia DNS.',
      dnsErrorStatus: 'Cloudflare DNS devolvió un estado de error: {statuses}.',
    },
  };

  function resolveDiagLocale(explicitLocale) {
    var candidate = explicitLocale;
    if (!candidate || String(candidate).toLowerCase() === 'auto') {
      try {
        if (root.YouGeAssistant && typeof root.YouGeAssistant.getLocale === 'function') {
          candidate = root.YouGeAssistant.getLocale();
        } else if (root.YouGePWA && root.YouGePWA.wording && root.YouGePWA.wording.language) {
          candidate = root.YouGePWA.wording.language;
        }
      } catch (error) { /* ignore */ }
    }
    if (!candidate || String(candidate).toLowerCase() === 'auto') {
      try {
        var nav = root.navigator;
        candidate = (nav && Array.isArray(nav.languages) && nav.languages[0]) || (nav && nav.language) || 'en';
      } catch (error) {
        candidate = 'en';
      }
    }
    var shortCode = String(candidate || 'en').trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    if (shortCode === 'nb' || shortCode === 'nn') shortCode = 'no';
    return DNS_MESSAGES[shortCode] ? shortCode : 'en';
  }

  function diagMsg(lang, key, params) {
    var dict = DNS_MESSAGES[lang] || DNS_MESSAGES.en;
    var template = dict[key] != null ? dict[key] : (DNS_MESSAGES.en[key] || '');
    if (!params) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, name) {
      return params[name] != null ? String(params[name]) : '';
    });
  }

  /**
   * Assistant capability backstop.
   *
   * The DoH transport is the single place where diagnostic network traffic is
   * produced, so it is also the last line of enforcement: when the page's
   * Assistant reports `modules.diagnostics: false`, no request is made even if
   * a caller (a renderer, a delegated handler, an application script) reaches
   * this engine directly. Fails open when no Assistant is present.
   */
  function assistantDiagnosticsDisabled() {
    try {
      var assistant = root.YouGeAssistant;
      if (assistant && typeof assistant.isCapabilityEnabled === 'function') {
        return assistant.isCapabilityEnabled('diagnostics') === false;
      }
    } catch (error) { /* a broken Assistant must never break the engine */ }
    return false;
  }

  function makeError(kind, message) {
    var error = new Error(message || kind);
    error.kind = kind;
    return error;
  }

  function isIpv4Literal(host) {
    if (!IPV4_PATTERN.test(host)) return false;
    return host.split('.').every(function (part) {
      var octet = Number(part);
      return octet >= 0 && octet <= 255;
    });
  }

  function isIpv6Literal(host) {
    if (!IPV6_BRACKET_PATTERN.test(host)) return false;
    try {
      return new URL('http://' + host).hostname.toLowerCase() === host;
    } catch (error) {
      return false;
    }
  }

  function ipv4Octets(host) {
    if (!isIpv4Literal(host)) return null;
    return host.split('.').map(function (part) { return Number(part); });
  }

  function inIpv4Range(octets, first, second, bits) {
    var value = ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    var base = ((first << 24) >>> 0) + (second << 16);
    var size = Math.pow(2, 32 - bits);
    return value >= base && value < base + size;
  }

  function ipv4Kind(host) {
    var octets = ipv4Octets(host);
    if (!octets) return '';
    // Loopback is 127.0.0.0/8; it is the one range browsers can serve a
    // development app from without any network interface.
    if (octets[0] === 127) return 'loopback';
    if (inIpv4Range(octets, 10, 0, 8) ||
        inIpv4Range(octets, 172, 16, 12) ||
        inIpv4Range(octets, 192, 168, 16) ||
        inIpv4Range(octets, 169, 254, 16) ||
        inIpv4Range(octets, 100, 64, 10)) return 'private';
    return 'public-ip';
  }

  // Expands a validated IPv6 literal into its eight 16-bit groups so that
  // compressed and fully written spellings classify identically.
  function expandIpv6(literal) {
    var text = literal.toLowerCase();
    var tail = [];
    var tailMatch = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
    if (tailMatch) {
      var embedded = tailMatch[1].split('.').map(Number);
      tail = [((embedded[0] << 8) | embedded[1]).toString(16), ((embedded[2] << 8) | embedded[3]).toString(16)];
      text = text.slice(0, tailMatch.index).replace(/:$/, '');
    }
    var halves = text.split('::');
    var head = halves[0] ? halves[0].split(':') : [];
    var rest = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    rest = rest.concat(tail);
    var missing = 8 - head.length - rest.length;
    var groups = head.concat(new Array(missing > 0 ? missing : 0).fill('0'), rest);
    if (groups.length !== 8) return null;
    return groups.map(function (group) { return parseInt(group || '0', 16) || 0; });
  }

  function ipv6Kind(host) {
    if (!isIpv6Literal(host)) return '';
    var groups = expandIpv6(host.slice(1, -1));
    if (!groups) return 'public-ip';
    var first = groups[0];
    var onlyLastSet = groups.slice(0, 7).every(function (group) { return group === 0; });
    if (onlyLastSet && groups[7] === 1) return 'loopback';
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms keep their IPv4
    // meaning, so ::ffff:127.0.0.1 is loopback and ::ffff:8.8.8.8 is public.
    if (groups.slice(0, 5).every(function (group) { return group === 0; }) &&
        (groups[5] === 0xffff || groups[5] === 0)) {
      var mapped = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
      return ipv4Kind(mapped.join('.'));
    }
    if ((first & 0xfe00) === 0xfc00) return 'private';
    if ((first & 0xffc0) === 0xfe80) return 'private';
    if ((first & 0xffc0) === 0xfec0) return 'private';
    return 'public-ip';
  }

  // Host classification. The kinds are separate because they mean different
  // things to the user:
  //   localhost — the browser resolves it locally by specification.
  //   loopback  — 127.0.0.0/8 and ::1; a local development address.
  //   private   — RFC1918, carrier-grade NAT and link-local ranges (plus their
  //               IPv6 equivalents). Local-only, but reached over a network
  //               interface rather than the loopback device, so it is not
  //               reported as loopback.
  //   public-ip — any other IP literal. A production-style target that happens
  //               not to be a DNS name: public DoH still cannot resolve it,
  //               but it is never described as a development host.
  // An empty string means "ordinary DNS hostname" (public DoH applies).
  function hostKind(host) {
    if (!host) return '';
    if (host === 'localhost' || host.slice(-10) === '.localhost') return 'localhost';
    var ipv4 = ipv4Kind(host);
    if (ipv4) return ipv4;
    return ipv6Kind(host);
  }

  // Every non-hostname kind is never resolved by public DNS, so querying
  // Cloudflare DoH for it would only produce misleading NXDOMAIN noise.
  function skipsPublicDoh(kind) {
    return Boolean(kind);
  }

  function describeTarget(host, kind, lang) {
    if (kind === 'public-ip') {
      return diagMsg(lang || 'en', 'targetPublicIp', { host: host });
    }
    if (kind === 'private') {
      return diagMsg(lang || 'en', 'targetPrivate');
    }
    return diagMsg(lang || 'en', 'targetLocalhost');
  }

  // Validate path segments before URL normalization (including encoded separators).
  function safeProbePath(value, base) {
    if (typeof value !== 'string' || !value || value.trim() !== value ||
        /[\u0000-\u001f\u007f\\]/.test(value) || /^(?:[a-z][a-z0-9+.-]*:|\/\/|[?#])/i.test(value)) return null;
    try {
      var path = value.split(/[?#]/)[0];
      if (path.split('/').some(function (part) {
        var decoded = decodeURIComponent(part);
        return decoded === '..' || /[\/\\%\u0000-\u001f\u007f]/.test(decoded);
      })) return null;
      var url = new URL(value, base);
      return url.origin === base.origin && url.pathname.indexOf(base.pathname) === 0 ? url.href : null;
    } catch (error) { return null; }
  }

  function safeProbeBase(value, origin) {
    if (typeof value !== 'string' || !value || value.trim() !== value || value.charAt(0) !== '/' ||
        value.charAt(1) === '/' || /[?#\\\u0000-\u001f\u007f]/.test(value)) return null;
    try {
      if (value.split('/').some(function (part) {
        var decoded = decodeURIComponent(part);
        return decoded === '.' || decoded === '..' || /[\/\\%\u0000-\u001f\u007f]/.test(decoded);
      })) return null;
      var base = new URL(value.charAt(value.length - 1) === '/' ? value : value + '/', origin);
      return base.origin === origin ? base : null;
    } catch (error) { return null; }
  }

  // The response consumer (including body parsing) runs inside the same timeout
  // and AbortController scope as the request itself, so a stalled body cannot
  // outlive `timeoutMs`. An optional caller signal rides the same controller:
  // a caller abort reuses the existing abort path but rejects with a distinct
  // `cancelled` kind, so cancellation is never reported as a timeout or an
  // ordinary probe failure, and the caller listener is always released.
  function timeoutRequest(fetchImpl, url, options, timeoutMs, AbortControllerImpl, consume, callerSignal) {
    if (callerSignal && callerSignal.aborted) {
      return Promise.reject(makeError('cancelled', 'Request cancelled by the caller'));
    }
    var controller = AbortControllerImpl ? new AbortControllerImpl() : null;
    var timer;
    var onCallerAbort = null;
    var requestOptions = Object.assign({}, options);
    if (controller) requestOptions.signal = controller.signal;
    var request = Promise.resolve().then(function () { return fetchImpl(url, requestOptions); });
    if (typeof consume === 'function') request = request.then(consume);
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(makeError('timeout', 'Request timed out'));
      }, timeoutMs);
    });
    var races = [request, timeout];
    if (callerSignal && typeof callerSignal.addEventListener === 'function') {
      races.push(new Promise(function (_, reject) {
        onCallerAbort = function () {
          if (typeof callerSignal.removeEventListener === 'function') {
            callerSignal.removeEventListener('abort', onCallerAbort);
          }
          if (controller) {
            try { controller.abort(); } catch (error) { /* the request is already over */ }
          }
          reject(makeError('cancelled', 'Request cancelled by the caller'));
        };
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }));
    }
    return Promise.race(races).finally(function () {
      clearTimeout(timer);
      if (onCallerAbort && typeof callerSignal.removeEventListener === 'function') {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    });
  }

  // Resolves with the run's own result, or short-circuits to a cancelled result
  // the moment the caller aborts. The underlying run keeps settling on its own
  // (its requests are aborted), so no rejection ever goes unhandled.
  function untilCancelled(promise, signal, buildCancelledResult) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      function cleanup() {
        if (onAbort && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
      }
      var onAbort = function () {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(buildCancelledResult());
      };
      if (!signal || typeof signal.addEventListener !== 'function') {
        promise.then(resolve, reject);
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
    });
  }

  function fetchIdentity(fetchImpl) {
    if (!fetchImpl || (typeof fetchImpl !== 'function' && typeof fetchImpl !== 'object')) return 'none';
    if (!fetchIdentities.has(fetchImpl)) fetchIdentities.set(fetchImpl, ++nextFetchIdentity);
    return fetchIdentities.get(fetchImpl);
  }

  function create(options) {
    options = options || {};
    var fetchImpl = options.fetch || root.fetch;
    var AbortControllerImpl = options.AbortController || root.AbortController;
    var timeoutMs = Number(options.timeoutMs) > 0 ? Math.min(15000, Number(options.timeoutMs)) : 5000;
    var retries = options.retries == null ? 1 : Math.max(0, Math.min(2, Number(options.retries) || 0));
    if (typeof fetchImpl !== 'function') {
      var noFetchLang = resolveDiagLocale(options.locale);
      return { check: function () { return Promise.resolve({ classification: 'unknown', locale: noFetchLang, message: diagMsg(noFetchLang, 'fetchUnavailable') }); } };
    }

    function checkedResponse(consume) {
      return function (response) {
        if (!response || typeof response.ok !== 'boolean') throw makeError('invalid_response', 'The server returned an invalid response.');
        if (!response.ok) {
          var statusError = makeError('http_error', 'HTTP ' + response.status);
          statusError.status = response.status;
          throw statusError;
        }
        return consume ? consume(response) : response;
      };
    }

    function fetchWithRetry(url, requestOptions, isDns, consume, callerSignal) {
      var attempt = 0;
      function run() {
        return timeoutRequest(fetchImpl, url, requestOptions, timeoutMs, AbortControllerImpl, checkedResponse(consume), callerSignal).catch(function (error) {
          if (error instanceof TypeError && !error.kind) error.kind = 'network_or_cors';
          // A caller cancellation is final: never retried, never reclassified.
          if (error.kind === 'cancelled') throw error;
          var retryable = error.kind === 'timeout' || error.kind === 'network_or_cors' ||
            (error.kind === 'http_error' && error.status >= 500);
          if (retryable && attempt < retries) {
            attempt += 1;
            return run();
          }
          if (!error.kind) error.kind = isDns ? 'network_or_cors' : 'application_unavailable';
          throw error;
        });
      }
      return run();
    }

    function parseDnsBody(type, response) {
      return Promise.resolve().then(function () { return response.json(); }).catch(function () {
        throw makeError('invalid_response', 'Cloudflare returned invalid JSON.');
      }).then(function (body) {
        if (!body || !Number.isInteger(body.Status) || body.Status < 0 || body.Status > 5 || !Array.isArray(body.Answer || [])) {
          throw makeError('invalid_response', 'Cloudflare returned an invalid DNS response.');
        }
        var expectedType = type === 'A' ? 1 : 28;
        var answers = (body.Answer || []).filter(function (answer) {
          return answer && Number.isInteger(Number(answer.type)) && Number(answer.type) === expectedType &&
            typeof answer.data === 'string' && answer.data.length > 0;
        });
        return { type: type, status: body.Status, statusText: STATUS[body.Status], answers: answers };
      });
    }

    function query(hostname, type, callerSignal) {
      var url = new URL(ENDPOINT);
      url.searchParams.set('name', hostname);
      url.searchParams.set('type', type);
      return fetchWithRetry(url.href, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/dns-json' },
      }, true, function (response) {
        return parseDnsBody(type, response);
      }, callerSignal);
    }

    function probe(url, callerSignal) {
      return fetchWithRetry(url, {
        method: 'GET',
        mode: 'same-origin',
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/manifest+json, application/json, */*' },
      }, false, function (response) {
        return { ok: true, status: response.status };
      }, callerSignal).catch(function (error) {
        // A cancelled probe must not be summarized as a failed probe.
        if (error && error.kind === 'cancelled') throw error;
        return { ok: false, kind: error.kind || 'application_unavailable', status: error.status || null };
      });
    }

    function cancelledResult(host, origin, online, message, lang) {
      var effectiveLang = lang || 'en';
      return {
        hostname: host,
        origin: origin,
        locale: effectiveLang,
        resolver: 'Cloudflare DNS (1.1.1.1)',
        endpoint: ENDPOINT,
        checkedAt: new Date().toISOString(),
        classification: 'cancelled',
        status: 'cancelled',
        cancelled: true,
        failed: false,
        message: message || diagMsg(effectiveLang, 'cancelled'),
        online: online,
        dohAvailable: false,
        dohSkipped: false,
        applicationHostAvailable: false,
        possibleDnsInterference: false,
        dns: [],
        dnsErrors: [],
        app: { ok: false, kind: 'cancelled', status: null },
        backend: null,
      };
    }

    function disabledResult(host, origin, online, lang) {
      var effectiveLang = lang || 'en';
      return {
        hostname: host,
        origin: origin,
        locale: effectiveLang,
        resolver: 'Cloudflare DNS (1.1.1.1)',
        endpoint: ENDPOINT,
        checkedAt: new Date().toISOString(),
        classification: 'disabled',
        status: 'disabled',
        failed: false,
        message: diagMsg(effectiveLang, 'disabled'),
        online: online,
        dohAvailable: false,
        dohSkipped: false,
        applicationHostAvailable: false,
        possibleDnsInterference: false,
        dns: [],
        dnsErrors: [],
        app: { ok: false, kind: 'disabled', status: null },
        backend: null,
      };
    }

    function check(context, runOptions) {
      context = context || {};
      var optionsIn = runOptions && typeof runOptions === 'object' ? runOptions : {};
      var lang = resolveDiagLocale(optionsIn.locale || context.locale || options.locale);
      var callerSignal = optionsIn.signal && typeof optionsIn.signal === 'object' ? optionsIn.signal : null;
      var host = String(context.hostname || '').toLowerCase().replace(/\.$/, '');
      // Checked before any request, DNS lookup or probe is built.
      if (assistantDiagnosticsDisabled()) {
        return Promise.resolve(disabledResult(host, context.origin || (root.location && root.location.origin),
          context.online !== false, lang));
      }
      if (callerSignal && callerSignal.aborted) {
        return Promise.resolve(cancelledResult(host, context.origin || (root.location && root.location.origin),
          context.online !== false, diagMsg(lang, 'cancelledBeforeStart'), lang));
      }
      if (IPV6_BRACKET_PATTERN.test(host)) {
        try { host = new URL('http://' + host).hostname.toLowerCase(); } catch (error) { /* rejected below */ }
      }
      var kind = hostKind(host);
      if (!kind && !HOST_PATTERN.test(host)) {
        return Promise.resolve({ hostname: host, locale: lang, classification: 'unknown', hostKind: 'invalid', message: diagMsg(lang, 'invalidHostname') });
      }
      var localHost = skipsPublicDoh(kind);
      var origin;
      try {
        var originUrl = new URL(context.origin || root.location.origin, root.location && root.location.href);
        if ((originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') || originUrl.username || originUrl.password) throw new Error('Invalid origin');
        origin = originUrl.origin;
        if (new URL(origin).hostname.toLowerCase() !== host) throw new Error('Origin hostname mismatch');
        if (root.location && root.location.hostname &&
            (host !== root.location.hostname.toLowerCase().replace(/\.$/, '') || origin !== root.location.origin)) {
          throw new Error('Diagnostics must target the active origin');
        }
      } catch (error) {
        return Promise.resolve({ hostname: host, locale: lang, classification: 'unknown', message: diagMsg(lang, 'invalidOrigin') });
      }
      var probeBaseUrl = safeProbeBase(context.basePath || '/', origin);
      if (!probeBaseUrl) {
        return Promise.resolve({ hostname: host, locale: lang, classification: 'unknown', message: diagMsg(lang, 'invalidBasePath') });
      }
      var basePath = probeBaseUrl.pathname;
      // Invalid app paths fall back within the deployment, never the origin root.
      var appProbeUrl = safeProbePath(context.appProbePath || 'manifest.webmanifest', probeBaseUrl) ||
        new URL('manifest.webmanifest', probeBaseUrl).href;
      var backendProbeUrl = context.backendProbePath ? safeProbePath(context.backendProbePath, probeBaseUrl) || '' : '';
      var key = [host, origin, basePath, appProbeUrl, backendProbeUrl, context.online !== false,
        timeoutMs, retries, lang, fetchIdentity(fetchImpl), fetchIdentity(AbortControllerImpl)].join('|');
      var buildCancelled = function () {
        return cancelledResult(host, origin, context.online !== false, null, lang);
      };
      if (inflight.has(key)) {
        var shared = inflight.get(key);
        // Deduplication stays single-flight for ordinary callers. A caller that
        // brought a signal only observes the shared run, so its own cancellation
        // can never abort requests another caller is waiting for.
        return callerSignal ? untilCancelled(shared, callerSignal, buildCancelled) : shared;
      }

      var dnsPromise = localHost ? Promise.resolve([]) : Promise.all([query(host, 'A', callerSignal), query(host, 'AAAA', callerSignal)].map(function (promise) {
        return promise.then(function (value) { return { value: value }; }, function (error) { return { error: error }; });
      }));
      var appPromise = probe(appProbeUrl, callerSignal);
      var backendPromise = backendProbeUrl ? probe(backendProbeUrl, callerSignal) : Promise.resolve(null);
      var resultPromise = Promise.all([dnsPromise, appPromise, backendPromise]).then(function (parts) {
        var dns = parts[0];
        var app = parts[1];
        var backend = parts[2];
        var validDns = dns.filter(function (item) { return item.value; }).map(function (item) { return item.value; });
        var dnsErrors = dns.filter(function (item) { return item.error; }).map(function (item) { return item.error; });
        var answers = validDns.reduce(function (all, item) { return all.concat(item.answers); }, []);
        var statuses = validDns.map(function (item) { return item.status; });
        var online = context.online !== false;
        var classification = 'unknown';
        var message = diagMsg(lang, 'inconclusive');
        var caveat = diagMsg(lang, 'caveat');

        if (!online && !app.ok) {
          classification = 'general_internet_failure';
          message = diagMsg(lang, 'offlineFailure');
        } else if (backend && !backend.ok && app.ok) {
          classification = 'backend_unavailable';
          message = diagMsg(lang, 'backendUnavailable');
        } else if (localHost) {
          // Public DoH cannot resolve loopback, private or IP-literal hosts, so
          // the same-origin probe result is the only meaningful signal. The
          // wording follows the host kind: only `localhost` and loopback are a
          // development host, and a public IP literal says so plainly.
          var target = describeTarget(host, kind, lang);
          if (app.ok) {
            classification = 'normal_connectivity';
            message = target + diagMsg(lang, 'localHostOk');
          } else {
            classification = 'application_host_unavailable';
            message = target + (kind === 'private'
              ? diagMsg(lang, 'localHostFailPrivate')
              : (kind === 'public-ip'
                ? diagMsg(lang, 'localHostFailPublicIp')
                : diagMsg(lang, 'localHostFailLocalhost')));
          }
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 3; })) {
          classification = app.ok ? 'inconclusive' : 'dns_resolution_failure';
          message = app.ok
            ? diagMsg(lang, 'nxdomainConflict')
            : diagMsg(lang, 'nxdomainFail');
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 0; }) && !answers.length) {
          classification = 'dns_records_missing';
          message = diagMsg(lang, 'noErrorMissingRecords');
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 0; }) && answers.length) {
          if (app.ok) {
            classification = 'normal_connectivity';
            message = diagMsg(lang, 'normalConnectivity');
          } else {
            classification = 'application_host_unavailable';
            message = diagMsg(lang, 'dnsResolvedAppDown');
          }
        } else if (!validDns.length && app.ok) {
          classification = 'cloudflare_doh_unavailable';
          message = diagMsg(lang, 'dohUnavailableAppOk');
        } else if (!validDns.length && !app.ok && !online) {
          classification = 'general_internet_failure';
          message = diagMsg(lang, 'dohAndAppOffline');
        } else if (!validDns.length && !app.ok) {
          // Reached only while online (the offline case is classified above), so
          // both the DoH endpoint and the application host are unreachable with
          // no DNS evidence: that is a connectivity failure with a known cause
          // set, not an inconclusive result.
          classification = 'application_host_unavailable';
          message = diagMsg(lang, 'dohAndAppUnreachable');
        } else if (validDns.length && dnsErrors.length) {
          classification = app.ok ? 'inconclusive' : 'possible_dns_interference';
          message = diagMsg(lang, 'mixedDns');
        } else if (statuses.some(function (status) { return status !== 0 && status !== 3; })) {
          classification = 'cloudflare_doh_unavailable';
          message = diagMsg(lang, 'dnsErrorStatus', { statuses: validDns.map(function (item) { return item.statusText; }).join(', ') });
        }

        return {
          hostname: host,
          origin: origin,
          locale: lang,
          // Additive field: the classification the wording above is based on —
          // 'localhost' | 'loopback' | 'private' | 'public-ip' | 'hostname'.
          hostKind: kind || 'hostname',
          resolver: 'Cloudflare DNS (1.1.1.1)',
          endpoint: ENDPOINT,
          checkedAt: new Date().toISOString(),
          classification: classification,
          message: message,
          caveat: caveat,
          online: online,
          dohAvailable: validDns.length > 0,
          dohSkipped: localHost,
          applicationHostAvailable: app.ok,
          possibleDnsInterference: classification === 'application_host_unavailable' && answers.length > 0 && online,
          dns: validDns.map(function (item) { return { type: item.type, status: item.status, statusText: item.statusText, answers: item.answers }; }),
          dnsErrors: dnsErrors.map(function (error) { return { kind: error.kind || 'unknown', message: error.message }; }),
          app: app,
          backend: backend,
        };
      }).catch(function (error) {
        // Probes aborted by the caller reject; report cancellation separately
        // from a probe failure instead of surfacing it as an error result.
        if (error && error.kind === 'cancelled') {
          return cancelledResult(host, origin, context.online !== false, diagMsg(lang, 'cancelledByCaller'), lang);
        }
        throw error;
      }).finally(function () { inflight.delete(key); });
      if (!callerSignal) {
        inflight.set(key, resultPromise);
        return resultPromise;
      }
      // A run started by a cancelled caller is isolated from the dedup map: it
      // is abandoned the moment the caller aborts, so a later retry has to start
      // a fresh check instead of latching onto a run nobody awaits.
      return untilCancelled(resultPromise, callerSignal, buildCancelled);
    }

    return { check: check };
  }

  root.YouGeDns = {
    endpoint: ENDPOINT,
    create: create,
    // `options` contains both the legacy factory settings (fetch, timeoutMs,
    // retries, AbortController) and the per-run signal. Keep passing it to
    // `create()` for existing callers, and also pass it to `check()` so the
    // documented global cancellation API is not silently dropped.
    check: function (context, options) { return create(options).check(context, options); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
