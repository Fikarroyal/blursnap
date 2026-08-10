window.BlurSnap = window.BlurSnap || {};

BlurSnap.Editor = (function () {
  let els = {};
  let baseImage = null;      // Image asli hasil capture (tidak berubah)
  let currentMeta = {};
  let workCanvas = document.createElement('canvas');
  let sharpenTimer = null;

  const vals = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, sharpness: 0, blur: 0 };

  function cacheEls() {
    els = {
      root: document.getElementById('preview-editor'),
      after: document.getElementById('preview-image-after'),
      close: document.getElementById('btn-preview-close'),
      brightness: document.getElementById('edit-brightness'),
      contrast: document.getElementById('edit-contrast'),
      saturation: document.getElementById('edit-saturation'),
      exposure: document.getElementById('edit-exposure'),
      sharpness: document.getElementById('edit-sharpness'),
      blur: document.getElementById('edit-blur'),
      resetBtn: document.getElementById('btn-editor-reset'),
      retake: document.getElementById('btn-retake'),
      save: document.getElementById('btn-save-gallery'),
      download: document.getElementById('btn-download'),
      share: document.getElementById('btn-share'),
      tabs: document.querySelectorAll('.editor-tab'),
      bodyAdjust: document.getElementById('editor-body-adjust'),
      bodyInfo: document.getElementById('editor-body-info'),
      metaResolution: document.getElementById('meta-resolution'),
      metaFilter: document.getElementById('meta-filter'),
      metaBlur: document.getElementById('meta-blur'),
      metaTime: document.getElementById('meta-time')
    };
  }

  function init() {
    cacheEls();

    els.close.addEventListener('click', close);

    ['brightness', 'contrast', 'saturation', 'exposure', 'blur'].forEach((key) => {
      els[key].addEventListener('input', (e) => {
        vals[key] = Number(e.target.value);
        renderCanvas(false);
      });
    });
    els.sharpness.addEventListener('input', (e) => {
      vals.sharpness = Number(e.target.value);
      clearTimeout(sharpenTimer);
      sharpenTimer = setTimeout(() => renderCanvas(true), 180);
    });

    els.resetBtn.addEventListener('click', () => {
      Object.keys(vals).forEach((k) => (vals[k] = 0));
      els.brightness.value = 0; els.contrast.value = 0; els.saturation.value = 0;
      els.exposure.value = 0; els.sharpness.value = 0; els.blur.value = 0;
      renderCanvas(true);
    });

    els.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        els.tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const isInfo = tab.dataset.tab === 'info';
        els.bodyAdjust.hidden = isInfo;
        els.bodyInfo.hidden = !isInfo;
      });
    });

    els.retake.addEventListener('click', () => {
      close();
      document.dispatchEvent(new CustomEvent('editor:retake'));
    });

    els.save.addEventListener('click', async () => {
      const finalUrl = workCanvas.toDataURL('image/jpeg', 0.92);
      await BlurSnap.Gallery.addPhoto(finalUrl, currentMeta);
      document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Foto berhasil disimpan ke galeri', icon: 'check-circle' } }));
    });

    els.download.addEventListener('click', () => downloadCurrent());

    els.share.addEventListener('click', () => shareCurrent());
  }

  function open(dataUrl, meta) {
    currentMeta = meta || {};
    Object.keys(vals).forEach((k) => (vals[k] = 0));
    els.brightness.value = 0; els.contrast.value = 0; els.saturation.value = 0;
    els.exposure.value = 0; els.sharpness.value = 0; els.blur.value = 0;

    els.metaResolution.textContent = currentMeta.resolution || '-';
    els.metaFilter.textContent = currentMeta.filter || '-';
    els.metaBlur.textContent = (currentMeta.blur !== undefined ? currentMeta.blur + ' px' : '-');
    els.metaTime.textContent = currentMeta.createdAt ? new Date(currentMeta.createdAt).toLocaleString('id-ID') : '-';

    baseImage = new Image();
    baseImage.onload = () => renderCanvas(true);
    baseImage.src = dataUrl;

    els.root.hidden = false;
  }

  function close() {
    els.root.hidden = true;
  }

  function renderCanvas(withSharpen) {
    if (!baseImage) return;
    const w = baseImage.naturalWidth, h = baseImage.naturalHeight;
    workCanvas.width = w; workCanvas.height = h;
    const wctx = workCanvas.getContext('2d');

    const brightness = 1 + (vals.brightness / 100) + (vals.exposure / 150);
    const contrast = 1 + (vals.contrast / 100);
    const saturate = 1 + (vals.saturation / 100);
    const blurPx = vals.blur;

    wctx.filter = `brightness(${Math.max(0.1, brightness)}) contrast(${Math.max(0.1, contrast)}) saturate(${Math.max(0, saturate)}) blur(${blurPx}px)`;
    wctx.drawImage(baseImage, 0, 0, w, h);
    wctx.filter = 'none';

    if (withSharpen && vals.sharpness > 0) {
      applySharpen(wctx, w, h, vals.sharpness / 100);
    }

    els.after.src = workCanvas.toDataURL('image/jpeg', 0.9);
  }

  /* Konvolusi unsharp-mask sederhana untuk sharpness nyata (bukan sekadar CSS) */
  function applySharpen(ctx, w, h, amount) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;
    const out = new Uint8ClampedArray(src.length);
    const k = amount * 1.1;
    const center = 1 + 4 * k;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          out[idx] = src[idx]; out[idx + 1] = src[idx + 1]; out[idx + 2] = src[idx + 2]; out[idx + 3] = src[idx + 3];
          continue;
        }
        for (let c = 0; c < 3; c++) {
          const sum =
            src[((y - 1) * w + x) * 4 + c] * -k +
            src[(y * w + (x - 1)) * 4 + c] * -k +
            src[(y * w + x) * 4 + c] * center +
            src[(y * w + (x + 1)) * 4 + c] * -k +
            src[((y + 1) * w + x) * 4 + c] * -k;
          out[idx + c] = sum;
        }
        out[idx + 3] = src[idx + 3];
      }
    }
    imgData.data.set(out);
    ctx.putImageData(imgData, 0, 0);
  }

  function buildFilename(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `BlurSnap_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
  }

  function downloadCurrent() {
    const url = workCanvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('jpg');
    document.body.appendChild(a);
    a.click();
    a.remove();
    document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Foto berhasil diunduh', icon: 'download' } }));
  }

  async function shareCurrent() {
    try {
      const blob = await (await fetch(workCanvas.toDataURL('image/jpeg', 0.92))).blob();
      const file = new File([blob], buildFilename('jpg'), { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'BlurSnap AI' });
      } else {
        downloadCurrent();
        document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', text: 'Share tidak didukung, foto diunduh sebagai gantinya', icon: 'info' } }));
      }
    } catch (e) {
      /* pengguna membatalkan share atau tidak didukung — abaikan */
    }
  }

  return { init, open, close };
})();
