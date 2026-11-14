(function () {
  'use strict';

  var checklistIds = ['handover', 'briefing', 'priorities'];
  var storagePrefix = 'staff-space-example:';

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

    if (dateNode) {
      dateNode.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()).toUpperCase();
    }

    function updateConnection() {
      if (!connectionStatus || !connectionLabel) return;
      var online = navigator.onLine;
      connectionStatus.classList.toggle('is-offline', !online);
      connectionLabel.textContent = online ? 'Connected' : 'Working offline';
      connectionStatus.setAttribute('aria-label', online ? 'You are online' : 'You are offline');
    }

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    var checkInKey = storagePrefix + 'check-in:' + localDateKey();
    var checkedIn = read(checkInKey) === '1';

    function renderShift() {
      if (!shiftToggle || !shiftState) return;
      shiftState.textContent = checkedIn ? 'On shift' : 'Not checked in';
      shiftState.classList.toggle('is-active', checkedIn);
      shiftToggle.setAttribute('aria-pressed', String(checkedIn));
      shiftToggle.innerHTML = checkedIn
        ? 'End sample shift <span aria-hidden="true">→</span>'
        : 'Check in <span aria-hidden="true">→</span>';
      if (shiftFootnote) {
        shiftFootnote.textContent = !storageAvailable
          ? 'Browser storage is unavailable; this sample status may not persist.'
          : checkedIn
            ? 'Sample status saved on this device.'
            : 'Sample action — nothing is sent to a server.';
      }
    }

    if (shiftToggle) {
      shiftToggle.addEventListener('click', function () {
        checkedIn = !checkedIn;
        if (!write(checkInKey, checkedIn ? '1' : '0')) storageAvailable = false;
        renderShift();
        announce(checkedIn ? 'You are checked in for this sample shift.' : 'Sample shift ended.');
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

      if (countNode) countNode.textContent = complete + ' of ' + checklistIds.length + ' done';
      if (progress) progress.setAttribute('aria-valuenow', String(complete));
      if (progressFill) progressFill.style.width = (complete / checklistIds.length) * 100 + '%';
      if (checklistFootnote) {
        checklistFootnote.textContent = storageAvailable
          ? 'Your checklist is saved privately in this browser.'
          : 'Browser storage is unavailable; checklist changes may not persist.';
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
        announce(input.checked ? 'Checklist item completed.' : 'Checklist item reopened.');
      });
    });
    updateChecklist();

  });
})();
