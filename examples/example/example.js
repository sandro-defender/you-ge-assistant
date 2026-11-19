(function () {
  'use strict';

  var checklistIds = ['handover', 'briefing', 'priorities'];
  var storagePrefix = 'staff-space-example:';

  var COPY = {
    en: {
      connected: 'Connected',
      workingOffline: 'Working offline',
      onlineAria: 'You are online',
      offlineAria: 'You are offline',
      onShift: 'On shift',
      notCheckedIn: 'Not checked in',
      endShift: 'End sample shift',
      checkIn: 'Check in',
      storageUnavailableShift: 'Browser storage is unavailable; this sample status may not persist.',
      savedShift: 'Sample status saved on this device.',
      sampleShiftAction: 'Sample action — nothing is sent to a server.',
      checkedInToast: 'You are checked in for this sample shift.',
      shiftEndedToast: 'Sample shift ended.',
      doneCount: '{complete} of {total} done',
      checklistSaved: 'Your checklist is saved privately in this browser.',
      storageUnavailableList: 'Browser storage is unavailable; checklist changes may not persist.',
      itemCompletedToast: 'Checklist item completed.',
      itemReopenedToast: 'Checklist item reopened.',
    },
    ka: {
      connected: 'დაკავშირებულია',
      workingOffline: 'ოფლაინ რეჟიმში',
      onlineAria: 'თქვენ ონლაინ ხართ',
      offlineAria: 'თქვენ ოფლაინ ხართ',
      onShift: 'ცვლაში ხართ',
      notCheckedIn: 'შესული არ ხართ',
      endShift: 'საცდელი ცვლის დასრულება',
      checkIn: 'შემოსვლა',
      storageUnavailableShift: 'ბრაუზერის საცავი მიუწვდომელია; საცდელი სტატუსი შეიძლება არ შეინახოს.',
      savedShift: 'საცდელი სტატუსი შენახულია ამ მოწყობილობაზე.',
      sampleShiftAction: 'საცდელი ქმედება — სერვერზე არაფერი იგზავნება.',
      checkedInToast: 'შემოხვედით ამ საცდელ ცვლაში.',
      shiftEndedToast: 'საცდელი ცვლა დასრულდა.',
      doneCount: '{complete} / {total} დასრულებული',
      checklistSaved: 'თქვენი სია კონფიდენციალურად ინახება ამ ბრაუზერში.',
      storageUnavailableList: 'ბრაუზერის საცავი მიუწვდომელია; ცვლილებები შეიძლება არ შეინახოს.',
      itemCompletedToast: 'დავალება დასრულდა.',
      itemReopenedToast: 'დავალება ხელახლა გაიხსნა.',
    },
    ru: {
      connected: 'Подключено',
      workingOffline: 'Работа офлайн',
      onlineAria: 'Вы в сети',
      offlineAria: 'Вы не в сети',
      onShift: 'На смене',
      notCheckedIn: 'Смена не начата',
      endShift: 'Завершить смену',
      checkIn: 'Начать смену',
      storageUnavailableShift: 'Хранилище браузера недоступно; статус может не сохраниться.',
      savedShift: 'Демо-статус сохранён на этом устройстве.',
      sampleShiftAction: 'Демо-действие — на сервер ничего не отправляется.',
      checkedInToast: 'Вы отметились на этой тестовой смене.',
      shiftEndedToast: 'Тестовая смена завершена.',
      doneCount: 'Выполнено {complete} из {total}',
      checklistSaved: 'Ваш список сохранён локально в этом браузере.',
      storageUnavailableList: 'Хранилище браузера недоступно; изменения могут не сохраниться.',
      itemCompletedToast: 'Пункт списка выполнен.',
      itemReopenedToast: 'Пункт списка открыт снова.',
    },
    fr: {
      connected: 'Connecté',
      workingOffline: 'Mode hors ligne',
      onlineAria: 'Vous êtes en ligne',
      offlineAria: 'Vous êtes hors ligne',
      onShift: 'En service',
      notCheckedIn: 'Non pointé',
      endShift: 'Terminer le service',
      checkIn: 'Pointer l’arrivée',
      storageUnavailableShift: 'Le stockage du navigateur est indisponible ; cet état peut ne pas persister.',
      savedShift: 'Statut enregistré localement sur cet appareil.',
      sampleShiftAction: 'Action de démonstration — rien n’est envoyé au serveur.',
      checkedInToast: 'Vous êtes pointé pour ce service de démonstration.',
      shiftEndedToast: 'Service de démonstration terminé.',
      doneCount: '{complete} sur {total} terminées',
      checklistSaved: 'Votre liste est enregistrée localement dans ce navigateur.',
      storageUnavailableList: 'Le stockage du navigateur est indisponible ; les modifications peuvent ne pas persister.',
      itemCompletedToast: 'Tâche terminée.',
      itemReopenedToast: 'Tâche rouverte.',
    },
    it: {
      connected: 'Connesso',
      workingOffline: 'Lavoro offline',
      onlineAria: 'Sei online',
      offlineAria: 'Sei offline',
      onShift: 'In turno',
      notCheckedIn: 'Non registrato',
      endShift: 'Termina turno di prova',
      checkIn: 'Inizia turno',
      storageUnavailableShift: 'Archiviazione non disponibile; lo stato potrebbe non persistere.',
      savedShift: 'Stato salvato su questo dispositivo.',
      sampleShiftAction: 'Azione di esempio — nulla viene inviato al server.',
      checkedInToast: 'Turno di esempio avviato.',
      shiftEndedToast: 'Turno di esempio terminato.',
      doneCount: '{complete} di {total} completate',
      checklistSaved: 'La lista è salvata privatamente in questo browser.',
      storageUnavailableList: 'Archiviazione non disponibile; le modifiche potrebbero non persistere.',
      itemCompletedToast: 'Voce completata.',
      itemReopenedToast: 'Voce riaperta.',
    },
    de: {
      connected: 'Verbunden',
      workingOffline: 'Offline-Betrieb',
      onlineAria: 'Sie sind online',
      offlineAria: 'Sie sind offline',
      onShift: 'Im Dienst',
      notCheckedIn: 'Nicht eingecheckt',
      endShift: 'Beispielschicht beenden',
      checkIn: 'Einchecken',
      storageUnavailableShift: 'Browser-Speicher nicht verfügbar; Status bleibt evtl. nicht erhalten.',
      savedShift: 'Beispielstatus auf diesem Gerät gespeichert.',
      sampleShiftAction: 'Beispielaktion — es wird nichts an einen Server gesendet.',
      checkedInToast: 'Für diese Beispielschicht eingecheckt.',
      shiftEndedToast: 'Beispielschicht beendet.',
      doneCount: '{complete} von {total} erledigt',
      checklistSaved: 'Ihre Checkliste wird lokal in diesem Browser gespeichert.',
      storageUnavailableList: 'Browser-Speicher nicht verfügbar; Änderungen bleiben evtl. nicht erhalten.',
      itemCompletedToast: 'Eintrag abgeschlossen.',
      itemReopenedToast: 'Eintrag wieder geöffnet.',
    },
    sv: {
      connected: 'Ansluten',
      workingOffline: 'Arbetar offline',
      onlineAria: 'Du är online',
      offlineAria: 'Du är offline',
      onShift: 'I tjänst',
      notCheckedIn: 'Ej incheckad',
      endShift: 'Avsluta exempelskift',
      checkIn: 'Checka in',
      storageUnavailableShift: 'Webbläsarens lagring är otillgänglig; status kan gå förlorad.',
      savedShift: 'Exempelstatus sparad på denna enhet.',
      sampleShiftAction: 'Exempelåtgärd — inget skickas till en server.',
      checkedInToast: 'Du är incheckad för detta exempelskift.',
      shiftEndedToast: 'Exempelskift avslutat.',
      doneCount: '{complete} av {total} klara',
      checklistSaved: 'Din checklista sparas privat i denna webbläsare.',
      storageUnavailableList: 'Webbläsarens lagring är otillgänglig; ändringar kan gå förlorade.',
      itemCompletedToast: 'Punkt slutförd.',
      itemReopenedToast: 'Punkt öppnad igen.',
    },
    nl: {
      connected: 'Verbonden',
      workingOffline: 'Offline werken',
      onlineAria: 'Je bent online',
      offlineAria: 'Je bent offline',
      onShift: 'Ingeschakeld',
      notCheckedIn: 'Niet ingecheckt',
      endShift: 'Voorbeelddienst beëindigen',
      checkIn: 'Inchecken',
      storageUnavailableShift: 'Browseropslag niet beschikbaar; status blijft mogelijk niet behouden.',
      savedShift: 'Voorbeeldstatus opgeslagen op dit apparaat.',
      sampleShiftAction: 'Voorbeeldactie — niets wordt naar een server gestuurd.',
      checkedInToast: 'Je bent ingecheckt voor deze voorbeelddienst.',
      shiftEndedToast: 'Voorbeelddienst beëindigd.',
      doneCount: '{complete} van {total} voltooid',
      checklistSaved: 'Je checklist wordt privé opgeslagen in deze browser.',
      storageUnavailableList: 'Browseropslag niet beschikbaar; wijzigingen blijven mogelijk niet behouden.',
      itemCompletedToast: 'Item voltooid.',
      itemReopenedToast: 'Item heropend.',
    },
    no: {
      connected: 'Tilkoblet',
      workingOffline: 'Jobber frakoblet',
      onlineAria: 'Du er tilkoblet',
      offlineAria: 'Du er frakoblet',
      onShift: 'På vakt',
      notCheckedIn: 'Ikke sjekket inn',
      endShift: 'Avslutt eksempelvakt',
      checkIn: 'Sjekk inn',
      storageUnavailableShift: 'Nettleserlagring er utilgjengelig; status lagres kanskje ikke.',
      savedShift: 'Eksempelstatus lagret på denne enheten.',
      sampleShiftAction: 'Eksempelhandling — ingenting sendes til en server.',
      checkedInToast: 'Du er sjekket inn for denne eksempelvakten.',
      shiftEndedToast: 'Eksempelvakt avsluttet.',
      doneCount: '{complete} av {total} fullført',
      checklistSaved: 'Sjekklisten din lagres privat i denne nettleseren.',
      storageUnavailableList: 'Nettleserlagring er utilgjengelig; endringer lagres kanskje ikke.',
      itemCompletedToast: 'Punkt fullført.',
      itemReopenedToast: 'Punkt åpnet igjen.',
    },
    da: {
      connected: 'Forbundet',
      workingOffline: 'Arbejder offline',
      onlineAria: 'Du er online',
      offlineAria: 'Du er offline',
      onShift: 'På vagt',
      notCheckedIn: 'Ikke tjekket ind',
      endShift: 'Afslut eksempelvagt',
      checkIn: 'Tjek ind',
      storageUnavailableShift: 'Browserlagring er utilgængelig; status gemmes muligvis ikke.',
      savedShift: 'Eksempelstatus gemt på denne enhed.',
      sampleShiftAction: 'Eksempelhandling — intet sendes til en server.',
      checkedInToast: 'Du er tjekket ind på denne eksempelvagt.',
      shiftEndedToast: 'Eksempelvagt afsluttet.',
      doneCount: '{complete} af {total} udført',
      checklistSaved: 'Din tjekliste gemmes privat i denne browser.',
      storageUnavailableList: 'Browserlagring er utilgængelig; ændringer gemmes muligvis ikke.',
      itemCompletedToast: 'Punkt fuldført.',
      itemReopenedToast: 'Punkt genåbnet.',
    },
    et: {
      connected: 'Ühendatud',
      workingOffline: 'Töötan võrguühenduseta',
      onlineAria: 'Olete võrgus',
      offlineAria: 'Olete võrguühenduseta',
      onShift: 'Vahetuses',
      notCheckedIn: 'Sisenemata',
      endShift: 'Lõpeta näidisvahetus',
      checkIn: 'Alusta vahetust',
      storageUnavailableShift: 'Brauseri salvestusruum pole saadaval; olek ei pruugi säilida.',
      savedShift: 'Näidisolek salvestatud selles seadmes.',
      sampleShiftAction: 'Näidistegevus — serverisse midagi ei saadeta.',
      checkedInToast: 'Olete selle näidisvahetusega liitunud.',
      shiftEndedToast: 'Näidisvahetus lõppes.',
      doneCount: '{complete} / {total} tehtud',
      checklistSaved: 'Teie nimekiri salvestatakse privaatselt selles brauseris.',
      storageUnavailableList: 'Brauseri salvestusruum pole saadaval; muudatused ei pruugi säilida.',
      itemCompletedToast: 'Ülesanne tehtud.',
      itemReopenedToast: 'Ülesanne uuesti avatud.',
    },
    es: {
      connected: 'Conectado',
      workingOffline: 'Trabajando sin conexión',
      onlineAria: 'Estás en línea',
      offlineAria: 'Estás sin conexión',
      onShift: 'En turno',
      notCheckedIn: 'Sin registrar',
      endShift: 'Finalizar turno de prueba',
      checkIn: 'Registrar entrada',
      storageUnavailableShift: 'Almacenamiento no disponible; el estado podría no persistir.',
      savedShift: 'Estado guardado en este dispositivo.',
      sampleShiftAction: 'Acción de prueba — nada se envía a un servidor.',
      checkedInToast: 'Entrada registrada para este turno de prueba.',
      shiftEndedToast: 'Turno de prueba finalizado.',
      doneCount: '{complete} de {total} completadas',
      checklistSaved: 'Tu lista se guarda de forma privada en este navegador.',
      storageUnavailableList: 'Almacenamiento no disponible; los cambios podrían no persistir.',
      itemCompletedToast: 'Elemento completado.',
      itemReopenedToast: 'Elemento reabierto.',
    },
  };

  function resolveActiveLocale() {
    var raw = '';
    if (window.YouGeAssistant && typeof window.YouGeAssistant.getLocale === 'function') {
      raw = window.YouGeAssistant.getLocale();
    }
    if (!raw && window.PWA && typeof window.PWA.getLanguage === 'function') {
      raw = window.PWA.getLanguage();
    }
    if (!raw && typeof navigator !== 'undefined') {
      raw = (Array.isArray(navigator.languages) && navigator.languages[0]) || navigator.language || '';
    }
    if (!raw && document && document.documentElement && typeof document.documentElement.getAttribute === 'function') {
      raw = document.documentElement.getAttribute('lang') || '';
    }
    var base = String(raw || 'en').trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'nb' || base === 'nn') base = 'no';
    return COPY[base] ? base : 'en';
  }

  function msg(key, vars) {
    var code = resolveActiveLocale();
    var dict = COPY[code] || COPY.en;
    var text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : COPY.en[key];
    if (!vars) return text;
    return String(text)
      .replace(/\{complete\}/g, String(vars.complete))
      .replace(/\{total\}/g, String(vars.total));
  }

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageReadable() {
    try {
      window.localStorage.getItem(storagePrefix + '__availability__');
      return true;
    } catch (error) {
      return false;
    }
  }

  function localDateKey() {
    var date = new Date();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function announce(message) {
    if (window.PWA && typeof window.PWA.notify === 'function') {
      window.PWA.notify(message);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var dateNode = document.getElementById('today-date');
    var connectionStatus = document.getElementById('connection-status');
    var connectionLabel = document.getElementById('connection-label');
    var shiftToggle = document.getElementById('shift-toggle');
    var shiftState = document.getElementById('shift-state');
    var shiftFootnote = document.getElementById('shift-footnote');
    var countNode = document.getElementById('task-count');
    var progress = document.getElementById('task-progress');
    var progressFill = document.getElementById('task-progress-fill');
    var checklistFootnote = document.querySelector('.panel-footnote');
    var storageAvailable = storageReadable();

    function renderDate() {
      if (!dateNode) return;
      var active = resolveActiveLocale();
      try {
        dateNode.textContent = new Intl.DateTimeFormat(active || undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(new Date()).toUpperCase();
      } catch (err) {
        dateNode.textContent = new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }).format(new Date()).toUpperCase();
      }
    }
    renderDate();

    function updateConnection() {
      if (!connectionStatus || !connectionLabel) return;
      var online = navigator.onLine;
      connectionStatus.classList.toggle('is-offline', !online);
      connectionLabel.textContent = online ? msg('connected') : msg('workingOffline');
      connectionStatus.setAttribute('aria-label', online ? msg('onlineAria') : msg('offlineAria'));
    }

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    var checkInKey = storagePrefix + 'check-in:' + localDateKey();
    var checkedIn = read(checkInKey) === '1';

    function renderShift() {
      if (!shiftToggle || !shiftState) return;
      shiftState.textContent = checkedIn ? msg('onShift') : msg('notCheckedIn');
      shiftState.classList.toggle('is-active', checkedIn);
      shiftToggle.setAttribute('aria-pressed', String(checkedIn));
      shiftToggle.innerHTML = (checkedIn ? msg('endShift') : msg('checkIn')) + ' <span aria-hidden="true">→</span>';
      if (shiftFootnote) {
        shiftFootnote.textContent = !storageAvailable
          ? msg('storageUnavailableShift')
          : checkedIn
            ? msg('savedShift')
            : msg('sampleShiftAction');
      }
    }

    if (shiftToggle) {
      shiftToggle.addEventListener('click', function () {
        checkedIn = !checkedIn;
        if (!write(checkInKey, checkedIn ? '1' : '0')) storageAvailable = false;
        renderShift();
        announce(checkedIn ? msg('checkedInToast') : msg('shiftEndedToast'));
      });
    }
    renderShift();

    function updateChecklist() {
      var complete = 0;
      checklistIds.forEach(function (id) {
        var input = document.querySelector('[data-checklist-item="' + id + '"]');
        if (!input) return;
        var item = input.closest('li');
        if (input.checked) complete += 1;
        if (item) item.classList.toggle('is-complete', input.checked);
      });

      if (countNode) countNode.textContent = msg('doneCount', { complete: complete, total: checklistIds.length });
      if (progress) progress.setAttribute('aria-valuenow', String(complete));
      if (progressFill) progressFill.style.width = (complete / checklistIds.length) * 100 + '%';
      if (checklistFootnote) {
        checklistFootnote.textContent = storageAvailable
          ? msg('checklistSaved')
          : msg('storageUnavailableList');
      }
    }

    checklistIds.forEach(function (id) {
      var input = document.querySelector('[data-checklist-item="' + id + '"]');
      if (!input) return;
      var itemKey = storagePrefix + 'checklist:' + localDateKey() + ':' + id;
      input.checked = read(itemKey) === '1';
      input.addEventListener('change', function () {
        if (!write(itemKey, input.checked ? '1' : '0')) storageAvailable = false;
        updateChecklist();
        announce(input.checked ? msg('itemCompletedToast') : msg('itemReopenedToast'));
      });
    });
    updateChecklist();

    function refreshAllLocaleStrings() {
      renderDate();
      updateConnection();
      renderShift();
      updateChecklist();
    }

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('youge:locale-change', refreshAllLocaleStrings);
      window.addEventListener('languagechange', refreshAllLocaleStrings);
    }
    if (window.YouGeAssistant && typeof window.YouGeAssistant.subscribe === 'function') {
      window.YouGeAssistant.subscribe(function () {
        refreshAllLocaleStrings();
      });
    }
  });
})();
