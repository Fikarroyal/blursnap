/* =============================================================
   BlurSnap.Gallery
   Menyimpan hasil foto secara lokal memakai IndexedDB, menampilkan
   grid galeri, detail foto, download, dan hapus (single/all).
============================================================= */
window.BlurSnap = window.BlurSnap || {};

BlurSnap.Gallery = (function () {
  const DB_NAME = 'blursnap_gallery_db';
  const STORE = 'photos';
  let db = null;

  let gridEl, emptyEl, detailModal, detailImg, detailRes, detailFilter, detailBlur, detailTime, detailDeleteBtn, detailDownloadBtn, detailCloseBtn, clearBtn;
  let activeDetailId = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(STORE)) {
          const store = idb.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async function addPhoto(dataUrl, meta) {
    await openDb();
    return new Promise((resolve, reject) => {
      const record = {
        dataUrl,
        resolution: meta.resolution || '-',
        filter: meta.filter || '-',
        blur: meta.blur !== undefined ? meta.blur : 0,
        createdAt: meta.createdAt || Date.now()
      };
      const req = tx('readwrite').add(record);
      req.onsuccess = () => { refresh(); resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll() {
    await openDb();
    return new Promise((resolve, reject) => {
      const req = tx('readonly').getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async function getById(id) {
    await openDb();
    return new Promise((resolve, reject) => {
      const req = tx('readonly').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function deletePhoto(id) {
    await openDb();
    return new Promise((resolve, reject) => {
      const req = tx('readwrite').delete(id);
      req.onsuccess = () => { refresh(); resolve(true); };
      req.onerror = () => reject(req.error);
    });
  }

  async function clearAll() {
    await openDb();
    return new Promise((resolve, reject) => {
      const req = tx('readwrite').clear();
      req.onsuccess = () => { refresh(); resolve(true); };
      req.onerror = () => reject(req.error);
    });
  }

  function cacheEls() {
    gridEl = document.getElementById('gallery-grid');
    emptyEl = document.getElementById('gallery-empty');
    detailModal = document.getElementById('photo-detail-modal');
    detailImg = document.getElementById('photo-detail-img');
    detailRes = document.getElementById('detail-resolution');
    detailFilter = document.getElementById('detail-filter');
    detailBlur = document.getElementById('detail-blur');
    detailTime = document.getElementById('detail-time');
    detailDeleteBtn = document.getElementById('photo-detail-delete');
    detailDownloadBtn = document.getElementById('photo-detail-download');
    detailCloseBtn = document.getElementById('photo-detail-close');
    clearBtn = document.getElementById('btn-clear-gallery');
  }

  async function refresh() {
    if (!gridEl) return;
    const photos = await getAll();
    gridEl.innerHTML = '';
    emptyEl.classList.toggle('show', photos.length === 0);

    photos.forEach((p) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'gallery-item';
      item.setAttribute('aria-label', 'Buka detail foto');
      const time = new Date(p.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      item.innerHTML = `<img src="${p.dataUrl}" alt="Foto ${time}" loading="lazy"><div class="gi-overlay"><span>${p.filter} · ${time}</span></div>`;
      item.addEventListener('click', () => openDetail(p.id));
      gridEl.appendChild(item);
    });
  }

  async function openDetail(id) {
    const p = await getById(id);
    if (!p) return;
    activeDetailId = id;
    detailImg.src = p.dataUrl;
    detailRes.textContent = p.resolution;
    detailFilter.textContent = p.filter;
    detailBlur.textContent = p.blur + ' px';
    detailTime.textContent = new Date(p.createdAt).toLocaleString('id-ID');
    detailModal.hidden = false;
  }
  function closeDetail() {
    detailModal.hidden = true;
    activeDetailId = null;
  }

  function downloadPhoto(dataUrl) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `BlurSnap_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function init() {
    cacheEls();
    refresh();

    detailCloseBtn.addEventListener('click', closeDetail);
    detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeDetail(); });

    detailDeleteBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('confirm:request', {
        detail: {
          title: 'Hapus Foto Ini?',
          desc: 'Foto akan dihapus permanen dari galeri lokal.',
          onConfirm: async () => {
            if (activeDetailId !== null) await deletePhoto(activeDetailId);
            closeDetail();
            document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Foto dihapus dari galeri', icon: 'trash-2' } }));
          }
        }
      }));
    });

    detailDownloadBtn.addEventListener('click', async () => {
      const p = await getById(activeDetailId);
      if (p) downloadPhoto(p.dataUrl);
      document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Foto berhasil diunduh', icon: 'download' } }));
    });

    clearBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('confirm:request', {
        detail: {
          title: 'Kosongkan Galeri?',
          desc: 'Semua foto yang tersimpan akan dihapus permanen dan tidak dapat dikembalikan.',
          onConfirm: async () => {
            await clearAll();
            document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', text: 'Galeri berhasil dikosongkan', icon: 'trash-2' } }));
          }
        }
      }));
    });
  }

  return { init, addPhoto, getAll, deletePhoto, clearAll, refresh };
})();
