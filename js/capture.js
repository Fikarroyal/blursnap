window.BlurSnap = window.BlurSnap || {};

BlurSnap.Capture = (function () {
  let countdownValue = 0; // 0 | 3 | 5 | 10

  function setCountdown(v) { countdownValue = Number(v) || 0; }
  function getCountdown() { return countdownValue; }

  async function runCountdown(overlayEl, numberEl) {
    if (countdownValue <= 0) return;
    overlayEl.hidden = false;
    for (let i = countdownValue; i >= 1; i--) {
      numberEl.textContent = i;
      numberEl.style.animation = 'none';
      void numberEl.offsetWidth;
      numberEl.style.animation = '';
      await new Promise((r) => setTimeout(r, 1000));
    }
    overlayEl.hidden = true;
  }

  function triggerFlash(flashEl) {
    flashEl.classList.remove('flashing');
    void flashEl.offsetWidth;
    flashEl.classList.add('flashing');
  }

  /* Menggambar frame video ke canvas sesuai resolusi + filter + blur aktif */
  function capture(videoEl, canvasEl) {
    const resKey = BlurSnap.Camera.getResolutionKey();
    const resMap = BlurSnap.Camera.getResMap();
    const targetRes = resMap[resKey] || resMap.hd;
    const vw = videoEl.videoWidth || targetRes.width;
    const vh = videoEl.videoHeight || targetRes.height;

    canvasEl.width = vw;
    canvasEl.height = vh;
    const ctx = canvasEl.getContext('2d');
    ctx.save();
    if (BlurSnap.Camera.isMirrored()) {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = BlurSnap.Blur.combinedCss();
    ctx.drawImage(videoEl, 0, 0, vw, vh);
    ctx.restore();

    const qualityMap = { low: 0.6, standard: 0.8, high: 0.9, ultra: 0.97 };
    const quality = qualityMap[BlurSnap.Settings.get('photoQuality')] || 0.85;
    const dataUrl = canvasEl.toDataURL('image/jpeg', quality);

    return {
      dataUrl,
      meta: {
        resolution: `${vw}×${vh}`,
        filter: BlurSnap.Filters.getActive().name,
        blur: BlurSnap.Blur.get(),
        createdAt: Date.now()
      }
    };
  }

  return { setCountdown, getCountdown, runCountdown, triggerFlash, capture };
})();
