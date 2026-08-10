/* =============================================================
   BlurSnap.Settings
   Menyimpan dan memuat preferensi pengguna dari localStorage.
============================================================= */
window.BlurSnap = window.BlurSnap || {};

BlurSnap.Settings = (function () {
  const STORAGE_KEY = 'blursnap_settings_v1';

  const defaults = {
    defaultCamera: 'user',      // 'user' = depan, 'environment' = belakang
    mirror: true,
    gestureEnabled: true,
    showLandmarks: false,
    autoBlur: true,
    sensitivity: 'high',        // low | medium | high
    countdown: 0,                // 0 | 3 | 5 | 10
    photoQuality: 'standard',   // low | standard | high | ultra
    resolution: 'hd',           // sd | hd | fhd | 2k | 4k
    theme: 'system'             // dark | light | system
  };

  let current = { ...defaults };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) current = { ...defaults, ...JSON.parse(raw) };
    } catch (e) {
      console.warn('BlurSnap: gagal memuat pengaturan tersimpan', e);
    }
    return { ...current };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('BlurSnap: gagal menyimpan pengaturan', e);
    }
  }

  function get(key) {
    return key ? current[key] : { ...current };
  }

  function set(key, value) {
    current[key] = value;
    save();
    document.dispatchEvent(new CustomEvent('settings:changed', { detail: { key, value } }));
  }

  function reset() {
    current = { ...defaults };
    save();
    document.dispatchEvent(new CustomEvent('settings:reset', { detail: { ...current } }));
    return { ...current };
  }

  /* Terapkan tema dark/light/system ke elemen <html> */
  function applyTheme(themeValue) {
    const val = themeValue || current.theme;
    let resolved = val;
    if (val === 'system') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  }

  return { load, save, get, set, reset, applyTheme, defaults };
})();
