/* =============================================================
   BlurSnap.Filters
   10 filter kamera real-time berbasis CSS/Canvas filter string.
============================================================= */
window.BlurSnap = window.BlurSnap || {};

BlurSnap.Filters = (function () {
  const list = [
    {
      id: 'natural',
      name: 'Natural',
      css: 'brightness(1.04) contrast(1.03) saturate(1.06)',
      swatch: '#C2255C'
    },
    {
      id: 'cinematic',
      name: 'Cinematic',
      css: 'contrast(1.28) saturate(0.82) brightness(0.94) sepia(0.12)',
      swatch: '#3A1E2A'
    },
    {
      id: 'warmglow',
      name: 'Warm Glow',
      css: 'sepia(0.28) saturate(1.35) brightness(1.08) hue-rotate(-6deg)',
      swatch: '#D98255'
    },
    {
      id: 'cooltone',
      name: 'Cool Tone',
      css: 'saturate(1.12) brightness(1.02) hue-rotate(12deg) contrast(1.06)',
      swatch: '#5C7A99'
    },
    {
      id: 'mononoir',
      name: 'Mono Noir',
      css: 'grayscale(1) contrast(1.35) brightness(1.03)',
      swatch: '#8A8A8A'
    },
    {
      id: 'vivid',
      name: 'Vivid',
      css: 'contrast(1.18) saturate(1.45) brightness(1.03)',
      swatch: '#E8474A'
    },
    {
      id: 'mattefade',
      name: 'Matte Fade',
      css: 'contrast(0.88) saturate(0.82) brightness(1.08) sepia(0.08)',
      swatch: '#C9B8A8'
    },
    {
      id: 'midnight',
      name: 'Midnight',
      css: 'contrast(1.26) saturate(0.8) brightness(0.87) hue-rotate(-4deg)',
      swatch: '#2B3A55'
    },
    {
      id: 'goldenhour',
      name: 'Golden Hour',
      css: 'brightness(1.1) contrast(1.05) saturate(1.2) sepia(0.2) hue-rotate(-4deg)',
      swatch: '#E8A33D'
    },
    {
      id: 'softpastel',
      name: 'Soft Pastel',
      css: 'brightness(1.14) contrast(0.86) saturate(0.85)',
      swatch: '#D8C9F0'
    }
  ];

  let activeId = 'natural';

  function getAll() {
    return list;
  }

  function getById(id) {
    return list.find((f) => f.id === id) || list[0];
  }

  function getActive() {
    return getById(activeId);
  }

  function setActive(id) {
    if (!list.some((f) => f.id === id)) return;
    activeId = id;
    document.dispatchEvent(new CustomEvent('filter:changed', { detail: getActive() }));
  }

  function reset() {
    setActive('natural');
  }

  return { getAll, getById, getActive, setActive, reset };
})();
