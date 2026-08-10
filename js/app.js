/* =============================================================
   BlurSnap App — orkestrator utama.
   Menghubungkan Settings, Filters, Blur, Camera, Gesture, Capture,
   Editor, dan Gallery ke elemen-elemen UI di index.html.
============================================================= */
window.BlurSnap = window.BlurSnap || {};

(function () {
  const els = {};
  const COUNTDOWN_OPTIONS = [0, 3, 5, 10];
  let countdownIdx = 0;
  let onboardSlideIndex = 0;
  let isCapturing = false;
  const CIRC = 106.8; // 2 * PI * r(17), lihat #ring-fill di style.css

  function q(id) { return document.getElementById(id); }

  function cacheEls() {
    els.splash = q('splash-screen');
    els.onboardingScreen = q('onboarding-screen');
    els.onboardingTrack = q('onboarding-track');
    els.onboardingSlides = Array.from(document.querySelectorAll('.onboarding-slide'));
    els.onboardingSkip = q('onboarding-skip');
    els.onboardingNext = q('onboarding-next');
    els.onboardingDots = Array.from(document.querySelectorAll('#onboarding-dots .dot'));

    els.permissionScreen = q('permission-screen');
    els.permissionRetry = q('permission-retry');
    els.incompatibleScreen = q('incompatible-screen');

    els.appShell = q('app-shell');
    els.video = q('camera-video');
    els.landmarkCanvas = q('landmark-canvas');
    els.captureCanvas = q('capture-canvas');
    els.cameraFrame = q('camera-frame');
    els.cameraEmptyState = q('camera-empty-state');

    els.resolutionBadge = q('resolution-badge');
    els.fpsBadge = q('fps-badge');

    els.gestureStatus = q('gesture-status');
    els.gestureText = q('gesture-text');
    els.ringFill = q('ring-fill');

    els.countdownOverlay = q('countdown-overlay');
    els.countdownNumber = q('countdown-number');
    els.flashOverlay = q('flash-overlay');

    els.quickFilterStrip = q('quick-filter-strip');
    els.filterGallery = q('filter-gallery');

    els.btnSwitchCamera = q('btn-switch-camera');
    els.btnCapture = q('btn-capture');
    els.btnQuickPanel = q('btn-quick-panel');
    els.btnCountdown = q('btn-countdown');
    els.countdownLabel = q('countdown-label');
    els.btnGridToggle = q('btn-grid-toggle');
    els.cameraGrid = q('camera-grid');
    els.btnFullscreen = q('btn-fullscreen');
    els.btnLandmarksToggle = q('btn-landmarks-toggle');

    els.blurSlider = q('blur-slider');
    els.blurValue = q('blur-value');
    els.presetChips = Array.from(document.querySelectorAll('.preset-chip'));
    els.blurModeSegmented = Array.from(document.querySelectorAll('#blur-mode-segmented .segment'));
    els.sensitivitySegmented = Array.from(document.querySelectorAll('#sensitivity-segmented .segment'));

    els.resolutionSelect = q('resolution-select');
    els.qualitySelect = q('quality-select');
    els.infoResolution = q('info-resolution');
    els.infoRatio = q('info-ratio');
    els.infoSize = q('info-size');

    els.settingDefaultCamera = q('setting-default-camera');
    els.settingMirror = q('setting-mirror');
    els.settingGestureEnabled = q('setting-gesture-enabled');
    els.settingShowLandmarks = q('setting-show-landmarks');
    els.settingAutoBlur = q('setting-auto-blur');
    els.settingCountdown = q('setting-countdown');
    els.settingPhotoQuality = q('setting-photo-quality');
    els.themeSegmented = Array.from(document.querySelectorAll('#theme-segmented .segment'));
    els.themeToggleDesktop = q('theme-toggle-desktop');
    els.btnResetSettings = q('btn-reset-settings');

    els.modalBackdrop = q('modal-backdrop');
    els.modalTitle = q('modal-title');
    els.modalDesc = q('modal-desc');
    els.modalConfirm = q('modal-confirm');
    els.modalCancel = q('modal-cancel');

    els.toastContainer = q('toast-container');
  }

  /* ============================= UTIL ============================= */
  function refreshIcons() { if (window.lucide) lucide.createIcons(); }

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function showToast({ type = 'info', text = '', icon }) {
    const map = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span data-lucide="${icon || map[type] || 'info'}"></span><span>${text}</span>`;
    els.toastContainer.appendChild(el);
    refreshIcons();
    setTimeout(() => el.remove(), 3000);
  }

  function showConfirm({ title, desc, onConfirm }) {
    els.modalTitle.textContent = title;
    els.modalDesc.textContent = desc;
    els.modalBackdrop.hidden = false;
    els.modalConfirm.onclick = async () => {
      els.modalBackdrop.hidden = true;
      await onConfirm();
    };
    els.modalCancel.onclick = () => { els.modalBackdrop.hidden = true; };
  }

  /* ============================= NAVIGASI ============================= */
  function switchView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = q('view-' + name);
    if (target) target.classList.add('active');
    document.querySelectorAll('[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
  }

  function wireNav() {
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    els.themeToggleDesktop.addEventListener('click', () => {
      const resolved = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      BlurSnap.Settings.set('theme', resolved);
      BlurSnap.Settings.applyTheme(resolved);
      syncThemeUI(resolved);
    });
  }

  /* ============================= SPLASH & ONBOARDING ============================= */
  function runSplashSequence() {
    setTimeout(() => {
      els.splash.hidden = true;
      const onboarded = localStorage.getItem('blursnap_onboarded_v1');
      if (!onboarded) startOnboarding();
      else launchMainApp();
    }, 2200);
  }

  function startOnboarding() {
    onboardSlideIndex = 0;
    updateOnboardingUI();
    els.onboardingScreen.hidden = false;
  }
  function updateOnboardingUI() {
    els.onboardingSlides.forEach((s, i) => s.classList.toggle('active', i === onboardSlideIndex));
    els.onboardingDots.forEach((d, i) => d.classList.toggle('active', i === onboardSlideIndex));
    els.onboardingNext.textContent = onboardSlideIndex === 2 ? 'Get Started' : 'Lanjut';
  }
  function finishOnboarding() {
    localStorage.setItem('blursnap_onboarded_v1', '1');
    els.onboardingScreen.hidden = true;
    launchMainApp();
  }
  function wireOnboarding() {
    els.onboardingNext.addEventListener('click', () => {
      if (onboardSlideIndex < 2) { onboardSlideIndex++; updateOnboardingUI(); }
      else finishOnboarding();
    });
    els.onboardingSkip.addEventListener('click', finishOnboarding);
  }

  /* ============================= MAIN APP LAUNCH ============================= */
  async function launchMainApp() {
    els.appShell.hidden = false;

    if (!BlurSnap.Camera.isSupported()) {
      showIncompatible();
      return;
    }

    BlurSnap.Camera.init(els.video);
    const gestureReady = BlurSnap.Gesture.init(els.video, els.landmarkCanvas);
    BlurSnap.Gesture.setSensitivity(BlurSnap.Settings.get('sensitivity'));
    BlurSnap.Gesture.setShowLandmarks(BlurSnap.Settings.get('showLandmarks'));
    BlurSnap.Gesture.setEnabled(BlurSnap.Settings.get('gestureEnabled'));
    if (!gestureReady) {
      els.gestureText.textContent = 'Deteksi gesture tidak tersedia di perangkat ini';
      els.gestureStatus.querySelector('.confidence-ring').style.visibility = 'hidden';
    }

    await startCameraFlow();
  }

  async function startCameraFlow() {
    const facing = BlurSnap.Settings.get('defaultCamera') || 'user';
    const resKey = BlurSnap.Settings.get('resolution') || 'hd';
    await BlurSnap.Camera.start({ facingMode: facing, resolution: resKey });
  }

  function showIncompatible() {
    els.appShell.hidden = true;
    els.onboardingScreen.hidden = true;
    els.incompatibleScreen.hidden = false;
  }

  /* ============================= CAMERA EVENTS ============================= */
  function wireCameraEvents() {
    document.addEventListener('camera:loading', () => { els.cameraEmptyState.hidden = false; });

    document.addEventListener('camera:started', (e) => {
      els.cameraEmptyState.hidden = true;
      els.permissionScreen.hidden = true;
      const { actualRes, facingMode, capabilities, fallbackUsed } = e.detail;

      const mirror = BlurSnap.Settings.get('mirror') && facingMode === 'user';
      BlurSnap.Camera.applyMirror(mirror);
      els.landmarkCanvas.classList.toggle('mirrored', mirror);

      updateResolutionInfo(actualRes);
      updateResolutionCapability(capabilities);
      updateVideoFilter();

      if (BlurSnap.Gesture.isReady() && BlurSnap.Settings.get('gestureEnabled')) {
        BlurSnap.Gesture.start();
      }

      if (fallbackUsed) {
        showToast({ type: 'warning', text: 'Resolusi tidak didukung, memakai resolusi terdekat', icon: 'alert-triangle' });
      }
    });

    document.addEventListener('camera:error', () => {
      els.cameraEmptyState.hidden = true;
      els.permissionScreen.hidden = false;
    });

    document.addEventListener('camera:unsupported', showIncompatible);

    document.addEventListener('camera:switched', () => {
      showToast({ type: 'success', text: 'Kamera berhasil diganti', icon: 'flip-horizontal' });
    });

    els.permissionRetry.addEventListener('click', async () => {
      els.permissionScreen.hidden = true;
      await startCameraFlow();
    });

    window.addEventListener('resize', () => BlurSnap.Gesture.syncCanvasSize());
  }

  function updateResolutionInfo(actualRes) {
    const resMap = BlurSnap.Camera.getResMap();
    const key = BlurSnap.Camera.getResolutionKey();
    const shortLabel = (resMap[key] && resMap[key].label.split(' · ')[0]) || key.toUpperCase();
    els.resolutionBadge.textContent = `${shortLabel} · ${actualRes.width}×${actualRes.height}`;
    els.infoResolution.textContent = `${actualRes.width}×${actualRes.height}`;

    const g = gcd(actualRes.width, actualRes.height) || 1;
    els.infoRatio.textContent = `${actualRes.width / g}:${actualRes.height / g}`;

    const factorMap = { low: 0.05, standard: 0.09, high: 0.14, ultra: 0.22 };
    const factor = factorMap[BlurSnap.Settings.get('photoQuality')] || 0.09;
    const estKB = Math.round((actualRes.width * actualRes.height * factor) / 1024);
    els.infoSize.textContent = estKB > 1024 ? `~${(estKB / 1024).toFixed(1)} MB` : `~${estKB} KB`;
  }

  function updateResolutionCapability(capabilities) {
    const maxW = capabilities && capabilities.width && capabilities.width.max;
    if (!maxW) return;
    Array.from(els.resolutionSelect.options).forEach((opt) => {
      const res = BlurSnap.Camera.getResMap()[opt.value];
      if (!res) return;
      const unsupported = res.width > maxW;
      opt.disabled = unsupported;
      if (unsupported && !opt.dataset.marked) {
        opt.textContent += ' (tidak didukung)';
        opt.dataset.marked = '1';
      }
    });
  }

  /* ============================= GESTURE EVENTS ============================= */
  function wireGestureEvents() {
    document.addEventListener('gesture:confidence', (e) => {
      const conf = e.detail;
      els.ringFill.style.strokeDashoffset = CIRC - CIRC * conf;
    });

    document.addEventListener('gesture:detected', () => {
      els.gestureStatus.classList.add('active');
      els.gestureText.textContent = 'Peace Gesture Detected — Blur Active';
      BlurSnap.Blur.setGestureActive(true);
      updateVideoFilter();
    });

    document.addEventListener('gesture:lost', () => {
      const autoOff = BlurSnap.Settings.get('autoBlur');
      els.gestureStatus.classList.remove('active');
      if (autoOff) {
        BlurSnap.Blur.setGestureActive(false);
        els.gestureText.textContent = 'Show ✌🏻 \u00A0Gesture to Activate Blur';
      } else {
        els.gestureText.textContent = 'Gesture Lost — Blur Still Active';
      }
      updateVideoFilter();
    });

    // Tambahkan spasi tambahan atau gunakan \u00A0 agar spasi tidak hilang
    els.gestureText.textContent = 'Show ✌🏻 \u00A0Gesture to Activate Blur';

    document.addEventListener('gesture:fps', (e) => {
      els.fpsBadge.textContent = `${e.detail} FPS`;
    });

    document.addEventListener('gesture:unsupported', () => {
      showToast({ type: 'warning', text: 'MediaPipe Hands gagal dimuat — gesture nonaktif', icon: 'alert-triangle' });
    });
  }

  /* ============================= BLUR / FILTER PREVIEW ============================= */
  function updateVideoFilter() {
    els.video.style.filter = BlurSnap.Blur.combinedCss();
  }

  function populateFilterUI() {
    const filters = BlurSnap.Filters.getAll();
    els.filterGallery.innerHTML = '';
    els.quickFilterStrip.innerHTML = '';

    filters.forEach((f) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'filter-card' + (f.id === BlurSnap.Filters.getActive().id ? ' active' : '');
      card.dataset.filterId = f.id;
      card.innerHTML = `<span class="swatch" style="background:${f.swatch}"></span><span class="fc-name">${f.name}</span>`;
      card.addEventListener('click', () => BlurSnap.Filters.setActive(f.id));
      els.filterGallery.appendChild(card);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'qf-chip' + (f.id === BlurSnap.Filters.getActive().id ? ' active' : '');
      chip.dataset.filterId = f.id;
      chip.setAttribute('role', 'tab');
      chip.innerHTML = `<span class="qf-swatch" style="background:${f.swatch}"></span><span class="qf-label">${f.name}</span>`;
      chip.addEventListener('click', () => BlurSnap.Filters.setActive(f.id));
      els.quickFilterStrip.appendChild(chip);
    });
  }

  function wireFilterEvents() {
    document.addEventListener('filter:changed', (e) => {
      document.querySelectorAll('.filter-card, .qf-chip').forEach((el) => {
        el.classList.toggle('active', el.dataset.filterId === e.detail.id);
      });
      updateVideoFilter();
    });
    document.addEventListener('blur:changed', updateVideoFilter);
  }

  /* ============================= FILTERS VIEW CONTROLS ============================= */
  function wireBlurControls() {
    els.blurSlider.addEventListener('input', (e) => {
      BlurSnap.Blur.setIntensity(Number(e.target.value));
      els.blurValue.textContent = `${e.target.value} px`;
      syncPresetHighlight();
    });

    els.presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const preset = chip.dataset.preset;
        if (preset === 'reset') BlurSnap.Blur.reset();
        else BlurSnap.Blur.applyPreset(preset);
        els.blurSlider.value = BlurSnap.Blur.get();
        els.blurValue.textContent = `${BlurSnap.Blur.get()} px`;
        syncPresetHighlight();
      });
    });

    els.blurModeSegmented.forEach((seg) => {
      seg.addEventListener('click', () => {
        const mode = seg.dataset.blurMode;
        BlurSnap.Blur.setMode(mode);
        els.blurModeSegmented.forEach((s) => s.classList.toggle('active', s === seg));
        BlurSnap.Gesture.setEnabled(BlurSnap.Settings.get('gestureEnabled') && mode !== 'gesture-off');
        updateVideoFilter();
      });
    });

    els.sensitivitySegmented.forEach((seg) => {
      seg.addEventListener('click', () => {
        const level = seg.dataset.sensitivity;
        BlurSnap.Gesture.setSensitivity(level);
        BlurSnap.Settings.set('sensitivity', level);
        els.sensitivitySegmented.forEach((s) => s.classList.toggle('active', s === seg));
      });
    });
  }

  function syncPresetHighlight() {
    const val = BlurSnap.Blur.get();
    els.presetChips.forEach((chip) => {
      const preset = chip.dataset.preset;
      chip.classList.toggle('active', preset !== 'reset' && BlurSnap.Blur.presets[preset] === val);
    });
  }

  function wireResolutionControls() {
    els.resolutionSelect.addEventListener('change', async (e) => {
      const result = await BlurSnap.Camera.setResolution(e.target.value);
      if (result.success) BlurSnap.Settings.set('resolution', e.target.value);
    });
    els.qualitySelect.addEventListener('change', (e) => {
      BlurSnap.Settings.set('photoQuality', e.target.value);
      els.settingPhotoQuality.value = e.target.value;
      const track = BlurSnap.Camera.getStream() && BlurSnap.Camera.getStream().getVideoTracks()[0];
      const settings = track && track.getSettings ? track.getSettings() : null;
      if (settings) updateResolutionInfo({ width: settings.width, height: settings.height });
    });
  }

  /* ============================= CAMERA VIEW CONTROLS ============================= */
  function applyCountdownValue(val) {
    const idx = COUNTDOWN_OPTIONS.indexOf(val);
    countdownIdx = idx >= 0 ? idx : 0;
    BlurSnap.Capture.setCountdown(val);
    els.countdownLabel.textContent = val === 0 ? 'Off' : `${val}s`;
    els.btnCountdown.classList.toggle('active-state', val !== 0);
    els.settingCountdown.value = String(val);
  }

  function wireCameraControls() {
    els.btnSwitchCamera.addEventListener('click', async () => {
      els.btnSwitchCamera.disabled = true;
      await BlurSnap.Camera.switchCamera();
      els.btnSwitchCamera.disabled = false;
    });

    els.btnCapture.addEventListener('click', doCapture);

    els.btnQuickPanel.addEventListener('click', () => switchView('filters'));

    els.btnCountdown.addEventListener('click', () => {
      countdownIdx = (countdownIdx + 1) % COUNTDOWN_OPTIONS.length;
      applyCountdownValue(COUNTDOWN_OPTIONS[countdownIdx]);
      BlurSnap.Settings.set('countdown', COUNTDOWN_OPTIONS[countdownIdx]);
    });

    els.btnGridToggle.addEventListener('click', () => {
      const showing = els.cameraGrid.hidden;
      els.cameraGrid.hidden = !showing;
      els.btnGridToggle.classList.toggle('active-state', showing);
    });

    els.btnFullscreen.addEventListener('click', () => BlurSnap.Camera.toggleFullscreen(els.cameraFrame));

    document.addEventListener('camera:fullscreenchange', (e) => {
      const active = !!(e.detail && e.detail.active);
      const icon = els.btnFullscreen.querySelector('[data-lucide]');
      if (icon) icon.setAttribute('data-lucide', active ? 'minimize' : 'maximize');
      els.btnFullscreen.classList.toggle('active-state', active);
      refreshIcons();
    });

    els.btnLandmarksToggle.addEventListener('click', () => {
      const val = !els.btnLandmarksToggle.classList.contains('active-state');
      BlurSnap.Gesture.setShowLandmarks(val);
      BlurSnap.Settings.set('showLandmarks', val);
      els.btnLandmarksToggle.classList.toggle('active-state', val);
      els.settingShowLandmarks.checked = val;
    });
  }

  async function doCapture() {
    if (isCapturing) return;
    isCapturing = true;
    els.btnCapture.disabled = true;
    try {
      await BlurSnap.Capture.runCountdown(els.countdownOverlay, els.countdownNumber);
      BlurSnap.Capture.triggerFlash(els.flashOverlay);
      const result = BlurSnap.Capture.capture(els.video, els.captureCanvas);
      BlurSnap.Editor.open(result.dataUrl, result.meta);
      showToast({ type: 'success', text: 'Foto berhasil diambil', icon: 'camera' });
    } finally {
      isCapturing = false;
      els.btnCapture.disabled = false;
    }
  }

  document.addEventListener('editor:retake', () => switchView('camera'));

  /* ============================= SETTINGS VIEW ============================= */
  function syncSettingsUI() {
    const s = BlurSnap.Settings.get();
    els.settingDefaultCamera.value = s.defaultCamera;
    els.settingMirror.checked = s.mirror;
    els.settingGestureEnabled.checked = s.gestureEnabled;
    els.settingShowLandmarks.checked = s.showLandmarks;
    els.settingAutoBlur.checked = s.autoBlur;
    els.settingPhotoQuality.value = s.photoQuality;
    els.qualitySelect.value = s.photoQuality;
    els.resolutionSelect.value = s.resolution;
    applyCountdownValue(s.countdown);

    els.sensitivitySegmented.forEach((seg) => seg.classList.toggle('active', seg.dataset.sensitivity === s.sensitivity));
    syncThemeUI(s.theme);
  }

  function syncThemeUI(theme) {
    els.themeSegmented.forEach((seg) => seg.classList.toggle('active', seg.dataset.themeOpt === theme));
    const resolved = document.documentElement.getAttribute('data-theme');
    const iconEl = els.themeToggleDesktop.querySelector('[data-lucide]');
    if (iconEl) { iconEl.setAttribute('data-lucide', resolved === 'light' ? 'sun' : 'moon'); refreshIcons(); }
  }

  function wireSettingsControls() {
    els.settingDefaultCamera.addEventListener('change', async (e) => {
      BlurSnap.Settings.set('defaultCamera', e.target.value);
      await BlurSnap.Camera.start({ facingMode: e.target.value, resolution: BlurSnap.Camera.getResolutionKey() });
    });
    els.settingMirror.addEventListener('change', (e) => {
      BlurSnap.Settings.set('mirror', e.target.checked);
      const isFront = BlurSnap.Camera.getFacing() === 'user';
      BlurSnap.Camera.applyMirror(e.target.checked && isFront);
      els.landmarkCanvas.classList.toggle('mirrored', e.target.checked && isFront);
    });
    els.settingGestureEnabled.addEventListener('change', (e) => {
      BlurSnap.Settings.set('gestureEnabled', e.target.checked);
      BlurSnap.Gesture.setEnabled(e.target.checked && BlurSnap.Blur.getMode() !== 'gesture-off');
      if (e.target.checked) BlurSnap.Gesture.start();
    });
    els.settingShowLandmarks.addEventListener('change', (e) => {
      BlurSnap.Settings.set('showLandmarks', e.target.checked);
      BlurSnap.Gesture.setShowLandmarks(e.target.checked);
      els.btnLandmarksToggle.classList.toggle('active-state', e.target.checked);
    });
    els.settingAutoBlur.addEventListener('change', (e) => BlurSnap.Settings.set('autoBlur', e.target.checked));
    els.settingCountdown.addEventListener('change', (e) => applyCountdownValue(Number(e.target.value)));
    els.settingPhotoQuality.addEventListener('change', (e) => {
      BlurSnap.Settings.set('photoQuality', e.target.value);
      els.qualitySelect.value = e.target.value;
    });

    els.themeSegmented.forEach((seg) => {
      seg.addEventListener('click', () => {
        const val = seg.dataset.themeOpt;
        BlurSnap.Settings.set('theme', val);
        BlurSnap.Settings.applyTheme(val);
        syncThemeUI(val);
      });
    });

    els.btnResetSettings.addEventListener('click', () => {
      showConfirm({
        title: 'Reset Semua Pengaturan?',
        desc: 'Semua preferensi akan dikembalikan ke nilai bawaan aplikasi.',
        onConfirm: async () => {
          const d = BlurSnap.Settings.reset();
          syncSettingsUI();
          BlurSnap.Settings.applyTheme();
          BlurSnap.Gesture.setSensitivity(d.sensitivity);
          BlurSnap.Gesture.setShowLandmarks(d.showLandmarks);
          BlurSnap.Gesture.setEnabled(d.gestureEnabled);
          const isFront = BlurSnap.Camera.getFacing() === 'user';
          BlurSnap.Camera.applyMirror(d.mirror && isFront);
          showToast({ type: 'success', text: 'Pengaturan direset ke default', icon: 'rotate-ccw' });
        }
      });
    });
  }

  /* ============================= MODALS ============================= */
  function wireModals() {
    els.modalBackdrop.addEventListener('click', (e) => { if (e.target === els.modalBackdrop) els.modalBackdrop.hidden = true; });
    document.addEventListener('confirm:request', (e) => showConfirm(e.detail));
    document.addEventListener('toast', (e) => showToast(e.detail));
  }

  /* ============================= KEYBOARD SHORTCUTS (desktop) ============================= */
  function wireKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (!els.appShell || els.appShell.hidden) return;
      if (e.code === 'Space') { e.preventDefault(); doCapture(); }
      else if (e.key === 'f' || e.key === 'F') els.btnSwitchCamera.click();
      else if (e.key === 'g' || e.key === 'G') els.btnGridToggle.click();
    });
  }

  /* ============================= INIT ============================= */
  function init() {
    cacheEls();
    refreshIcons();

    BlurSnap.Settings.load();
    BlurSnap.Settings.applyTheme();
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (BlurSnap.Settings.get('theme') === 'system') BlurSnap.Settings.applyTheme('system');
      });
    }

    wireNav();
    wireOnboarding();
    wireCameraEvents();
    wireGestureEvents();
    wireFilterEvents();
    wireCameraControls();
    wireBlurControls();
    wireResolutionControls();
    wireSettingsControls();
    wireModals();
    wireKeyboardShortcuts();

    BlurSnap.Editor.init();
    BlurSnap.Gallery.init();

    populateFilterUI();
    syncSettingsUI();

    runSplashSequence();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
