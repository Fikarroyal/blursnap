/* =============================================================
   BlurSnap.Blur
   Mengelola intensitas blur (0-30px), preset, dan status gesture-blur.
============================================================= */
window.BlurSnap = window.BlurSnap || {};

BlurSnap.Blur = (function () {
  let intensity = 0;
  let mode = 'gesture-on'; // 'gesture-on' | 'manual' | 'gesture-off'
  let gestureActive = false; // apakah blur sedang dipicu oleh gesture

  // Nilai diturunkan supaya efek blur lebih halus di semua tingkatan,
  // termasuk pada titik paling minim (preset 'soft' & default gesture-on).
  const presets = { soft: 3, balanced: 6, strong: 10, cinematic: 16 };
  const MAX_INTENSITY = 20;

  function setIntensity(value, silent) {
    intensity = Math.max(0, Math.min(MAX_INTENSITY, Math.round(value)));
    if (!silent) {
      document.dispatchEvent(new CustomEvent('blur:changed', { detail: intensity }));
    }
    return intensity;
  }

  function get() {
    return intensity;
  }

  function applyPreset(name) {
    if (presets[name] === undefined) return;
    setIntensity(presets[name]);
  }

  function reset() {
    setIntensity(0);
  }

  function setMode(val) {
    if (['gesture-on', 'manual', 'gesture-off'].includes(val)) mode = val;
  }
  function getMode() { return mode; }

  function setGestureActive(val) {
    gestureActive = !!val;
  }
  function isGestureActive() {
    return gestureActive;
  }

  /* Intensitas blur yang benar-benar tampil di live preview, tergantung mode:
     - gesture-on : blur hanya aktif saat gesture terdeteksi (pakai slider, atau preset
       'balanced' bila slider masih 0 agar efeknya tetap terlihat)
     - manual / gesture-off : blur murni mengikuti nilai slider, tidak peduli gesture */
  function effectiveIntensity() {
    if (mode === 'gesture-on') {
      if (!gestureActive) return 0;
      return intensity > 0 ? intensity : presets.soft;
    }
    return intensity;
  }

  /* Gabungan CSS filter (filter aktif + blur efektif) dipakai untuk preview & canvas */
  function combinedCss(customIntensity) {
    const f = BlurSnap.Filters.getActive();
    const b = customIntensity !== undefined ? customIntensity : effectiveIntensity();
    return `${f.css} blur(${b}px)`;
  }

  return {
    setIntensity, get, applyPreset, reset, presets,
    setMode, getMode,
    setGestureActive, isGestureActive, effectiveIntensity,
    combinedCss
  };
})();
