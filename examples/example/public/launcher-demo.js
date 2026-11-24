/* Interactive launcher demo. Rendering and action state come from the real SDK
 * classic bundle and assistant-widget.js; this file only supplies host controls. */
(function () {
  'use strict';

  var api = window.YouGeAssistant;
  if (!api || typeof api.configure !== 'function') {
    document.getElementById('state-readout-detail').textContent = 'The SDK state runtime did not load. Check the example server/build.';
    return;
  }

  var scenario = 'idle';
  var scenarioSequence = 0;
  var pwa = window.__launcherDemoPwa;
  var form = {
    enabled: document.getElementById('animation-enabled'),
    shape: document.getElementById('launcher-shape'),
    fit: document.getElementById('logo-fit'),
    zoom: document.getElementById('logo-zoom'),
    color: document.getElementById('outline-color'),
    speed: document.getElementById('outline-speed'),
    intensity: document.getElementById('outline-intensity'),
  };
  var readout = {
    panel: document.querySelector('.demo-state-readout'),
    icon: document.getElementById('state-readout-icon'),
    title: document.getElementById('state-readout-title'),
    detail: document.getElementById('state-readout-detail'),
    count: document.getElementById('state-readout-count'),
  };

  function launcherConfig() {
    var current = api.getConfig().launcher;
    return Object.assign({}, current, {
      logo: './launcher-demo-logo.svg',
      size: 68,
      appearance: Object.assign({}, current.appearance, {
        shape: form.shape.value,
        logoFit: form.fit.value,
        logoScale: Number(form.zoom.value),
        logoSize: 90,
        logoPosition: { x: 50, y: 50 },
        logoBorderRadius: '50%',
        border: { width: 1, color: '#d2c8f3', style: 'solid' },
      }),
      animation: Object.assign({}, current.animation, {
        enabled: form.enabled.checked,
        type: 'electric-border',
        preset: 'plasma',
        color: form.color.value,
        speed: Number(form.speed.value),
        intensity: Number(form.intensity.value),
        trigger: 'action-available',
        triggerCategories: ['installation', 'connectivity', 'recovery'],
        stopWhenViewed: false,
      }),
    });
  }

  function applyAppearance() {
    api.configure({ launcher: launcherConfig() });
    document.getElementById('logo-zoom-value').textContent = Number(form.zoom.value).toFixed(2) + '×';
    document.getElementById('outline-speed-value').textContent = Number(form.speed.value).toFixed(2) + '×';
    document.getElementById('outline-intensity-value').textContent = Math.round(Number(form.intensity.value) * 100) + '%';
  }

  function announceInstallability(canInstall, installed) {
    if (pwa) pwa.setState({ canInstall: canInstall, installed: installed, standalone: installed });
    window.PWA = canInstall || installed ? pwa : null;
    document.dispatchEvent(new Event(installed ? 'pwa:installed' : 'pwa:installable'));
  }

  function setScenario(next) {
    scenario = next;
    scenarioSequence += 1;
    var installAvailable = next === 'install' || next === 'multiple';
    var offline = next === 'network' || next === 'multiple';

    // Each selection gets a fresh project-scoped lifecycle record, so an earlier
    // demo dismissal/view cannot leak into the next scenario.
    announceInstallability(installAvailable, false);
    api.configure({
      projectId: 'launcher-studio-demo-' + scenarioSequence,
      launcher: launcherConfig(),
    });
    api.setConnectivity(!offline);
    render(api.getState());
  }

  function render(state) {
    if (!state) return;
    var attention = state.appearance && state.appearance.launcher && state.appearance.launcher.attention;
    var eligible = attention && Array.isArray(attention.eligibleActionIds) ? attention.eligibleActionIds : [];
    var notices = Array.isArray(state.notifications) ? state.notifications : [];
    var relevantNotices = notices.filter(function (notice) {
      var ids = Array.isArray(notice.actionIds) ? notice.actionIds : [notice.actionId];
      return ids.some(function (id) { return eligible.indexOf(id) !== -1; });
    });
    var active = Boolean(attention && attention.active);
    var installLive = eligible.indexOf('install') !== -1;
    var networkLive = eligible.indexOf('diagnostics') !== -1 || eligible.indexOf('recovery') !== -1;

    readout.panel.dataset.active = String(active);
    readout.icon.textContent = active ? '✦' : (scenario === 'resolved' ? '✓' : '◌');
    readout.count.textContent = eligible.length + (eligible.length === 1 ? ' ELIGIBLE ACTION' : ' ELIGIBLE ACTIONS');
    if (scenario === 'resolved' && !active) {
      readout.title.textContent = 'All resolved';
      readout.detail.textContent = 'The SDK has no remaining actionable notices. The launcher is resting.';
    } else if (!active) {
      readout.title.textContent = scenario === 'install' ? 'Installation completed' : 'All clear';
      readout.detail.textContent = 'No eligible actions. The launcher is resting.';
    } else if (installLive && networkLive) {
      readout.title.textContent = 'One cue · multiple actions';
      readout.detail.textContent = eligible.length + ' eligible action IDs across ' + relevantNotices.length + ' live notices. Resolve one condition; the other keeps attention active.';
    } else if (installLive) {
      readout.title.textContent = 'Installation available';
      readout.detail.textContent = 'The SDK published the native install action. The launcher outline is active.';
    } else {
      readout.title.textContent = 'Network recovery available';
      readout.detail.textContent = 'The SDK has published diagnostics and recovery actions for the reported offline state.';
    }

    document.querySelectorAll('[data-scenario]').forEach(function (button) {
      var selected = button.dataset.scenario === scenario;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('complete-install').disabled = !installLive;
    document.getElementById('resolve-network').disabled = !networkLive;
    document.getElementById('resolve-all').disabled = !eligible.length;
  }

  document.querySelectorAll('[data-scenario]').forEach(function (button) {
    button.addEventListener('click', function () { setScenario(button.dataset.scenario); });
  });

  [form.enabled, form.shape, form.fit, form.zoom, form.color, form.speed, form.intensity].forEach(function (control) {
    control.addEventListener('input', applyAppearance);
    control.addEventListener('change', applyAppearance);
  });

  document.getElementById('complete-install').addEventListener('click', function () {
    if (!api.completeAction('install')) return;
    // Model the result of a successful host/browser install through the PWA
    // adapter; this removes the genuine SDK notice but leaves network attention.
    announceInstallability(false, true);
  });

  document.getElementById('resolve-network').addEventListener('click', function () {
    api.setConnectivity(true);
  });

  document.getElementById('resolve-all').addEventListener('click', function () {
    var state = api.getState();
    var ids = state && state.appearance && state.appearance.launcher && state.appearance.launcher.attention
      ? state.appearance.launcher.attention.eligibleActionIds.slice()
      : [];
    ids.forEach(function (id) { api.completeAction(id); });
    announceInstallability(false, true);
    api.setConnectivity(true);
    scenario = 'resolved';
    render(api.getState());
  });

  document.addEventListener('youge:action', function (event) {
    var action = event && event.detail;
    if (!action) return;
    if (action.id === 'diagnostics') {
      readout.detail.textContent = 'Diagnostics was requested through the real SDK action; this visual demo makes no network request.';
    }
  });

  api.subscribe(render);
  // Start with no PWA adapter installed and an explicitly healthy connectivity
  // snapshot. The first inactive state is therefore genuinely idle in the SDK.
  window.PWA = null;
  announceInstallability(false, false);
  api.setConnectivity(true);
  applyAppearance();
  render(api.getState());
})();
