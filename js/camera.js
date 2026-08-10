window.BlurSnap = window.BlurSnap || {};

BlurSnap.Camera = (function () {
  const RES_MAP = {
    sd:  { width: 640,  height: 480,  label: 'SD · 640×480' },
    hd:  { width: 1280, height: 720,  label: 'HD · 1280×720' },
    fhd: { width: 1920, height: 1080, label: 'Full HD · 1920×1080' },
    '2k':{ width: 2560, height: 1440, label: '2K · 2560×1440' },
    '4k':{ width: 3840, height: 2160, label: '4K · 3840×2160' }
  };

  let videoEl = null;
  let currentStream = null;
  let currentFacing = 'user';
  let currentResKey = 'hd';
  let mirrored = true;

  function init(videoElement) {
    videoEl = videoElement;
  }

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function stopStream() {
    if (currentStream) {
      currentStream.getTracks().forEach((t) => t.stop());
      currentStream = null;
    }
  }

  async function start(opts = {}) {
    if (!isSupported()) {
      document.dispatchEvent(new CustomEvent('camera:unsupported'));
      return { success: false, unsupported: true };
    }
    const facingMode = opts.facingMode || currentFacing;
    const resKey = opts.resolution || currentResKey;
    const res = RES_MAP[resKey] || RES_MAP.hd;

    stopStream();
    document.dispatchEvent(new CustomEvent('camera:loading'));

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: res.width },
        height: { ideal: res.height }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = stream;
      currentFacing = facingMode;
      currentResKey = resKey;

      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
      applyMirror(mirrored);

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};
      const actualRes = { width: settings.width || res.width, height: settings.height || res.height };
      const capabilities = track.getCapabilities ? (track.getCapabilities() || {}) : {};

      const fallbackUsed = Math.abs((actualRes.width || 0) - res.width) > 160;

      document.dispatchEvent(new CustomEvent('camera:started', {
        detail: { resKey, actualRes, requestedRes: res, capabilities, fallbackUsed, facingMode }
      }));

      return { success: true, actualRes, fallbackUsed };
    } catch (err) {
      document.dispatchEvent(new CustomEvent('camera:error', { detail: err }));
      return { success: false, error: err };
    }
  }

  async function switchCamera() {
    const next = currentFacing === 'user' ? 'environment' : 'user';
    const result = await start({ facingMode: next, resolution: currentResKey });
    if (result.success) {
      document.dispatchEvent(new CustomEvent('camera:switched', { detail: { facingMode: next } }));
    }
    return result;
  }

  async function setResolution(resKey) {
    return start({ facingMode: currentFacing, resolution: resKey });
  }

  function applyMirror(val) {
    mirrored = !!val;
    if (videoEl) videoEl.classList.toggle('mirrored', mirrored);
  }
  function isMirrored() { return mirrored; }

  function getVideoElement() { return videoEl; }
  function getStream() { return currentStream; }
  function getFacing() { return currentFacing; }
  function getResolutionKey() { return currentResKey; }
  function getResMap() { return RES_MAP; }

  /* ===========================================================
     FULLSCREEN
     Fullscreen API standar bekerja di desktop & kebanyakan browser
     Android, tapi Safari iOS/iPadOS TIDAK mendukungnya sama sekali
     untuk elemen selain <video> — requestFullscreen()/
     webkitRequestFullscreen() akan undefined di sana, sehingga tombol
     fullscreen sebelumnya diam saja di iPhone. Di bawah ini fallback
     "pseudo-fullscreen" berbasis CSS (position:fixed penuh layar)
     dipakai otomatis kalau API native tidak tersedia/gagal.
  =========================================================== */
  let pseudoFullscreenActive = false;
  let exitBtnEl = null;

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement ||
      document.mozFullScreenElement || document.msFullscreenElement || null;
  }

  function requestNativeFullscreen(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
      el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!fn) return null;
    try {
      const result = fn.call(el);
      return (result && typeof result.then === 'function') ? result : Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function exitNativeFullscreen() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
      document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) { /* aman diabaikan */ } }
  }

  function enterPseudoFullscreen(frameEl) {
    pseudoFullscreenActive = true;
    frameEl.classList.add('pseudo-fullscreen');
    document.documentElement.classList.add('pseudo-fullscreen-lock');

    // Tombol fullscreen asli ada di luar .camera-frame dan akan tertutup
    // saat frame ini position:fixed penuh layar, jadi disisipkan tombol
    // keluar kecil di dalam frame supaya pengguna tetap bisa keluar.
    if (!exitBtnEl) {
      exitBtnEl = document.createElement('button');
      exitBtnEl.type = 'button';
      exitBtnEl.className = 'pseudo-fullscreen-exit';
      exitBtnEl.setAttribute('aria-label', 'Keluar dari fullscreen');
      exitBtnEl.innerHTML = '<span data-lucide="x"></span>';
      exitBtnEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        exitPseudoFullscreen(frameEl);
      });
    }
    frameEl.appendChild(exitBtnEl);
    if (window.lucide) window.lucide.createIcons();
    document.dispatchEvent(new CustomEvent('camera:fullscreenchange', { detail: { active: true } }));
  }

  function exitPseudoFullscreen(frameEl) {
    pseudoFullscreenActive = false;
    frameEl.classList.remove('pseudo-fullscreen');
    document.documentElement.classList.remove('pseudo-fullscreen-lock');
    if (exitBtnEl && exitBtnEl.parentNode) exitBtnEl.parentNode.removeChild(exitBtnEl);
    document.dispatchEvent(new CustomEvent('camera:fullscreenchange', { detail: { active: false } }));
  }

  function isFullscreenActive() {
    return !!(getFullscreenElement() || pseudoFullscreenActive);
  }

  function toggleFullscreen(frameEl) {
    if (pseudoFullscreenActive) {
      exitPseudoFullscreen(frameEl);
      return;
    }
    if (getFullscreenElement()) {
      exitNativeFullscreen();
      return;
    }
    const req = requestNativeFullscreen(frameEl);
    if (!req) {
      // API fullscreen tidak tersedia sama sekali (khas Safari iOS) -> fallback CSS
      enterPseudoFullscreen(frameEl);
      return;
    }
    req.catch(() => enterPseudoFullscreen(frameEl));
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
    document.addEventListener(evt, () => {
      document.dispatchEvent(new CustomEvent('camera:fullscreenchange', { detail: { active: !!getFullscreenElement() } }));
    });
  });

  return {
    init, isSupported, start, switchCamera, setResolution, stopStream,
    applyMirror, isMirrored, getVideoElement, getStream, getFacing,
    getResolutionKey, getResMap, toggleFullscreen, isFullscreenActive, RES_MAP
  };
})();
