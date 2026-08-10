window.BlurSnap = window.BlurSnap || {};

BlurSnap.Gesture = (function () {
  const SENSITIVITY = {
    low:    { threshold: 0.82, holdMs: 900, releaseMs: 450 },
    medium: { threshold: 0.68, holdMs: 600, releaseMs: 350 },
    high:   { threshold: 0.52, holdMs: 350, releaseMs: 300 }
  };

  // Pasangan titik landmark untuk menggambar rangka tangan
  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17]
  ];

  let videoEl = null, canvasEl = null, ctx = null;
  let hands = null;
  let running = false, rafId = null;
  let lastFrameTime = 0;
  const frameInterval = 1000 / 22; // target ~22 FPS deteksi
  let fpsCounter = 0, fpsLastCheck = 0;

  let sensitivity = 'medium';
  let showLandmarks = false;
  let enabled = true;

  let holdStart = null, releaseStart = null, active = false;
  let mediapipeReady = false;

  function init(videoElement, canvasElement) {
    videoEl = videoElement;
    canvasEl = canvasElement;
    ctx = canvasEl.getContext('2d');

    if (typeof Hands === 'undefined') {
      mediapipeReady = false;
      document.dispatchEvent(new CustomEvent('gesture:unsupported'));
      return false;
    }
    try {
      hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({
        // Deteksi hingga 4 tangan sekaligus supaya beberapa orang dalam satu
        // frame bisa terdeteksi bersamaan, bukan cuma 1 tangan/orang.
        maxNumHands: 4,
        modelComplexity: 1,
        // Threshold diturunkan supaya tangan yang tampak lebih kecil di
        // frame (posisi lebih jauh dari kamera, ±2m tergantung resolusi
        // & pencahayaan) tetap bisa terdeteksi dan dilacak.
        minDetectionConfidence: 0.42,
        minTrackingConfidence: 0.35
      });
      hands.onResults(onResults);
      mediapipeReady = true;
      return true;
    } catch (e) {
      mediapipeReady = false;
      document.dispatchEvent(new CustomEvent('gesture:unsupported'));
      return false;
    }
  }

  function isReady() { return mediapipeReady; }

  function setSensitivity(level) {
    if (SENSITIVITY[level]) sensitivity = level;
  }
  function setShowLandmarks(val) {
    showLandmarks = !!val;
    if (!showLandmarks) clearCanvas();
  }
  function setEnabled(val) {
    enabled = !!val;
    if (!enabled) resetState();
  }

  function start() {
    if (!mediapipeReady || running) return;
    running = true;
    fpsLastCheck = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    resetState();
    clearCanvas();
  }
  function resetState() {
    holdStart = null; releaseStart = null;
    if (active) {
      active = false;
      document.dispatchEvent(new CustomEvent('gesture:lost'));
    }
  }

  async function loop(ts) {
    if (!running) return;
    if (ts - lastFrameTime >= frameInterval) {
      lastFrameTime = ts;
      if (enabled && videoEl && videoEl.readyState >= 2) {
        try { await hands.send({ image: videoEl }); } catch (e) { /* frame drop, aman diabaikan */ }
      } else if (!enabled) {
        document.dispatchEvent(new CustomEvent('gesture:confidence', { detail: 0 }));
      }
      fpsCounter++;
    }
    if (ts - fpsLastCheck >= 1000) {
      document.dispatchEvent(new CustomEvent('gesture:fps', { detail: fpsCounter }));
      fpsCounter = 0;
      fpsLastCheck = ts;
    }
    rafId = requestAnimationFrame(loop);
  }

  function onResults(results) {
    if (!enabled) return;
    const handsList = (results.multiHandLandmarks && results.multiHandLandmarks.length)
      ? results.multiHandLandmarks
      : [];
    let confidence = 0;

    if (handsList.length > 0) {
      // Ambil confidence tertinggi di antara semua tangan/orang yang
      // terdeteksi — blur aktif kalau salah satu dari mereka melakukan
      // gesture ✌, tidak harus semuanya.
      confidence = handsList.reduce(
        (max, lm) => Math.max(max, computePeaceConfidence(lm)), 0
      );
      if (showLandmarks) drawLandmarks(handsList);
      else clearCanvas();
    } else if (showLandmarks) {
      clearCanvas();
    }

    updateStateMachine(confidence);
    document.dispatchEvent(new CustomEvent('gesture:confidence', { detail: confidence }));
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function ratio(x, lo, hi) { return clamp01((x - lo) / (hi - lo)); }

  /* Menghitung skor 0-1 seberapa mirip pose tangan dengan gesture ✌ */
  function computePeaceConfidence(lm) {
    const wrist = lm[0];
    const scale = dist(wrist, lm[9]) || 0.001; // jarak pergelangan ke pangkal jari tengah = skala tangan

    const indexTip = lm[8];
    const middleTip = lm[12];
    const ringTip = lm[16];
    const pinkyTip = lm[20];

    /* Rotation-invariant: pakai rasio jarak Euclidean ke pergelangan,
       BUKAN posisi Y mentah. Versi lama mengasumsikan tangan berdiri
       tegak lurus ke atas (jari extended = Y makin kecil), sehingga
       gagal saat tangan dimiringkan atau ditempelkan di dekat pipi
       (pose selfie yang sangat umum untuk gesture ✌). Rasio jarak
       tetap valid berapa pun rotasi/kemiringan tangan di bidang gambar. */
    const indexReach = dist(indexTip, wrist) / scale;
    const middleReach = dist(middleTip, wrist) / scale;
    const ringReach = dist(ringTip, wrist) / scale;
    const pinkyReach = dist(pinkyTip, wrist) / scale;

    const indexScore = ratio(indexReach, 1.15, 1.7);
    const middleScore = ratio(middleReach, 1.15, 1.7);
    const ringCurlScore = ratio(1.15 - ringReach, 0, 0.45);
    const pinkyCurlScore = ratio(1.15 - pinkyReach, 0, 0.45);
    const spreadScore = ratio(dist(indexTip, middleTip) / scale, 0.22, 0.55);

    return clamp01(
      indexScore * 0.25 +
      middleScore * 0.25 +
      ringCurlScore * 0.2 +
      pinkyCurlScore * 0.2 +
      spreadScore * 0.1
    );
  }

  function updateStateMachine(confidence) {
    const cfg = SENSITIVITY[sensitivity];
    const now = performance.now();

    if (confidence >= cfg.threshold) {
      releaseStart = null;
      if (!active) {
        if (holdStart === null) holdStart = now;
        if (now - holdStart >= cfg.holdMs) {
          active = true;
          holdStart = null;
          document.dispatchEvent(new CustomEvent('gesture:detected'));
        }
      }
    } else {
      holdStart = null;
      if (active) {
        if (releaseStart === null) releaseStart = now;
        if (now - releaseStart >= cfg.releaseMs) {
          active = false;
          releaseStart = null;
          document.dispatchEvent(new CustomEvent('gesture:lost'));
        }
      }
    }
  }

  function clearCanvas() {
    if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  function syncCanvasSize() {
    if (!canvasEl || !videoEl) return;
    const rect = videoEl.getBoundingClientRect();
    canvasEl.width = rect.width;
    canvasEl.height = rect.height;
  }

  /* Video ditampilkan dengan object-fit:cover, jadi frame asli terpotong.
     Hitung skala + offset yang sama seperti perilaku cover agar titik
     landmark (dinormalisasi ke frame asli) sejajar dengan tampilan video. */
  function mapPoint(pt, w, h) {
    const vw = videoEl.videoWidth || w;
    const vh = videoEl.videoHeight || h;
    const scale = Math.max(w / vw, h / vh);
    const offsetX = (vw * scale - w) / 2;
    const offsetY = (vh * scale - h) / 2;
    return { x: pt.x * vw * scale - offsetX, y: pt.y * vh * scale - offsetY };
  }

  function drawLandmarks(handsList) {
    syncCanvasSize();
    clearCanvas();
    const w = canvasEl.width, h = canvasEl.height;

    handsList.forEach((lm) => {
      const pts = lm.map((pt) => mapPoint(pt, w, h));

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(232,116,154,0.85)';
      CONNECTIONS.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      });

      ctx.fillStyle = 'rgba(194,37,92,0.95)';
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function isActive() { return active; }

  return {
    init, isReady, start, stop, setSensitivity, setShowLandmarks, setEnabled,
    isActive, syncCanvasSize
  };
})();
