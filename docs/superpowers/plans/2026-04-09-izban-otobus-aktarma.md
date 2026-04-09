# Otobüs-İZBAN Aktarma Optimizasyonu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tek sayfalık vanilla HTML uygulaması — 555/776 otobüs hatları ile Halkapınar-Cumaovası İZBAN aktarmasında minimum bekleme süresini hesaplar ve gösterir.

**Architecture:** Tek `index.html` dosyası, sıfır bağımlılık. 4 API'den veri çeker (2 ESHOT + 2 İZBAN), parametrik sürelere göre aktarma kombinasyonlarını hesaplar, gidiş/dönüş tablolarında gösterir. Tüm hesaplama client-side.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES2020+), fetch API, sessionStorage

**Spec:** `docs/superpowers/specs/2026-04-09-izban-otobus-aktarma-design.md`

---

## File Structure

```
izban/
  index.html    ← Tek dosya: HTML + inline <style> + inline <script>
```

Tek dosya, 5 mantıksal bölüm:
1. **HTML:** Parametre kontrolleri + iki tablo konteyneri + hata/loading alanı
2. **CSS:** Grid layout, tablo stilleri, satır vurgulama (yeşil/soluk/aktif)
3. **JS — Yardımcılar:** `timeToMin()`, `minToTime()`, `findFirstAfter()`
4. **JS — API Katmanı:** `fetchWithCache()`, `loadAllData()`
5. **JS — Hesaplama & Render:** `calculateGidis()`, `calculateDonus()`, `renderTable()`, `highlightRows()`

---

## Task 1: HTML İskeleti + CSS Layout

**Files:**
- Create: `index.html`

- [ ] **Step 1: HTML boilerplate + parametre kontrolleri + tablo konteynerleri oluştur**

`index.html` dosyasını oluştur. İçeriği:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>555/776 – İZBAN Aktarma Saatleri</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a; color: #e0e0e0;
      padding: 24px; max-width: 1600px; margin: 0 auto;
    }
    h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 20px; color: #fff; }

    /* Parametre kontrolleri */
    .params {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
      background: #141414; border: 1px solid #222; border-radius: 8px;
      padding: 16px; margin-bottom: 24px;
    }
    .param-group label {
      display: block; font-size: 0.75rem; color: #888;
      margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .param-group input {
      width: 100%; padding: 8px 12px; border: 1px solid #333;
      border-radius: 6px; background: #1a1a1a; color: #fff;
      font-size: 1rem; text-align: center;
    }
    .param-group input:focus { outline: none; border-color: #4a9eff; }
    .param-group .unit {
      font-size: 0.7rem; color: #555; text-align: center; margin-top: 2px;
    }

    /* Tablolar */
    .tables {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .table-section h2 {
      font-size: 1rem; font-weight: 500; margin-bottom: 12px;
      padding-bottom: 8px; border-bottom: 1px solid #222;
    }
    .table-section h2.gidis { color: #4a9eff; }
    .table-section h2.donus { color: #ff9f43; }

    table {
      width: 100%; border-collapse: collapse; font-size: 0.8rem;
    }
    th {
      text-align: left; padding: 8px 6px; font-size: 0.65rem;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: #666; border-bottom: 1px solid #222; white-space: nowrap;
    }
    td {
      padding: 7px 6px; border-bottom: 1px solid #1a1a1a;
      font-variant-numeric: tabular-nums;
    }
    tr.past { opacity: 0.35; }
    tr.best td { background: rgba(46, 204, 113, 0.12); }
    tr.best td:last-child { color: #2ecc71; font-weight: 600; }
    tr.now td { background: rgba(74, 158, 255, 0.10); }
    tr.now td:first-child {
      box-shadow: inset 3px 0 0 #4a9eff;
    }

    /* Durum mesajları */
    #status {
      text-align: center; padding: 40px; color: #666; font-size: 0.9rem;
    }
    #status.error { color: #e74c3c; }

    @media (max-width: 1000px) {
      .params { grid-template-columns: repeat(2, 1fr); }
      .tables { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <h1>555 / 776 — İZBAN Aktarma Saatleri</h1>

  <div class="params">
    <div class="param-group">
      <label>555 → Halkapınar</label>
      <input type="number" id="p-555-sure" value="40" min="0" max="120">
      <div class="unit">dakika</div>
    </div>
    <div class="param-group">
      <label>Halkapınar yürüyüş</label>
      <input type="number" id="p-halk-yuru" value="5" min="0" max="30">
      <div class="unit">dakika</div>
    </div>
    <div class="param-group">
      <label>Cumaovası yürüyüş</label>
      <input type="number" id="p-cuma-yuru" value="5" min="0" max="30">
      <div class="unit">dakika</div>
    </div>
    <div class="param-group">
      <label>776 → Cumaovası</label>
      <input type="number" id="p-776-sure" value="75" min="0" max="180">
      <div class="unit">dakika</div>
    </div>
  </div>

  <div id="status">Veriler yükleniyor...</div>

  <div class="tables" id="tables" style="display:none;">
    <div class="table-section">
      <h2 class="gidis">GİDİŞ — 555 → İZBAN → 776</h2>
      <table>
        <thead>
          <tr>
            <th>555 Kalkış</th>
            <th>Halkapınar</th>
            <th>İZBAN Kalkış</th>
            <th>İZBAN Bkl</th>
            <th>Cumaovası</th>
            <th>776 Kalkış</th>
            <th>776 Bkl</th>
            <th>Toplam</th>
          </tr>
        </thead>
        <tbody id="tbody-gidis"></tbody>
      </table>
    </div>
    <div class="table-section">
      <h2 class="donus">DÖNÜŞ — 776 → İZBAN → 555</h2>
      <table>
        <thead>
          <tr>
            <th>776 Kalkış</th>
            <th>Cumaovası</th>
            <th>İZBAN Kalkış</th>
            <th>İZBAN Bkl</th>
            <th>Halkapınar</th>
            <th>555 Kalkış</th>
            <th>555 Bkl</th>
            <th>Toplam</th>
          </tr>
        </thead>
        <tbody id="tbody-donus"></tbody>
      </table>
    </div>
  </div>

<script>
// JS buraya eklenecek (Task 2+)
</script>

</body>
</html>
```

- [ ] **Step 2: Tarayıcıda aç, doğrula**

`index.html` dosyasını tarayıcıda aç. Şunları kontrol et:
- Koyu tema görünür
- 4 parametre inputu yan yana, varsayılan değerler: 40, 5, 5, 75
- "Veriler yükleniyor..." mesajı görünür
- Tablolar gizli (henüz veri yok)
- Responsive: 1000px altında 2 sütuna düşer

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: HTML iskeleti + CSS layout + parametre kontrolleri"
```

---

## Task 2: Zaman Yardımcı Fonksiyonları

**Files:**
- Modify: `index.html` — `<script>` bloğu içine ekle

- [ ] **Step 1: Zaman dönüştürme ve arama fonksiyonlarını yaz**

`<script>` bloğunun içine (`// JS buraya eklenecek (Task 2+)` satırını silerek):

```javascript
// ── Zaman Yardımcıları ──

/** "HH:MM" → toplam dakika (int). "06:30" → 390 */
function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** toplam dakika → "HH:MM". 390 → "06:30" */
function minToTime(m) {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Sıralı dakika dizisinde (minutes[]) verilen eşik değerinden (threshold)
 * büyük veya eşit ilk elemanın index'ini döndürür.
 * Gece yarısı geçişini handle eder: eğer threshold > 1440 ise,
 * dizideki elemanlar +1440 offset ile karşılaştırılır.
 * Bulunamazsa -1 döner.
 */
function findFirstAfter(minutes, threshold) {
  for (let i = 0; i < minutes.length; i++) {
    let val = minutes[i];
    // Gece yarısı geçişi: threshold 1440+ ise ve val küçükse, val'e +1440 ekle
    if (threshold >= 1440 && val < 720) val += 1440;
    if (val >= threshold) return i;
  }
  return -1;
}

/**
 * Bekleme süresini hesapla (dakika cinsinden).
 * Gece yarısı geçişini handle eder.
 */
function waitMinutes(departure, ready) {
  let diff = departure - ready;
  if (diff < 0) diff += 1440;
  return diff;
}
```

- [ ] **Step 2: Konsol üzerinden doğrula**

Tarayıcı konsolunda test et:
```javascript
console.assert(timeToMin("06:30") === 390);
console.assert(timeToMin("00:00") === 0);
console.assert(timeToMin("23:59") === 1439);
console.assert(minToTime(390) === "06:30");
console.assert(minToTime(0) === "00:00");
console.assert(minToTime(1500) === "01:00"); // 1440+60 wrap
console.assert(findFirstAfter([360, 390, 420], 385) === 1);
console.assert(findFirstAfter([360, 390, 420], 500) === -1);
console.assert(waitMinutes(400, 390) === 10);
console.assert(waitMinutes(30, 1410) === 60); // gece yarısı geçişi
```

Hepsi pass etmeli (assert hata vermemeli).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: zaman yardımcı fonksiyonları (timeToMin, minToTime, findFirstAfter, waitMinutes)"
```

---

## Task 3: API Katmanı (Fetch + Cache + CORS Fallback)

**Files:**
- Modify: `index.html` — `<script>` bloğuna, yardımcı fonksiyonlardan sonra ekle

- [ ] **Step 1: API fetch fonksiyonlarını yaz**

Yardımcı fonksiyonlardan sonra ekle:

```javascript
// ── API Katmanı ──

const ESHOT_BASE = 'https://acikveri.bizizmir.com/api/3/action/datastore_search';
const ESHOT_RESOURCE = 'c6fa6046-f755-47d7-b69e-db6bb06a8b5a';
const IZBAN_BASE = 'https://openapi.izmir.bel.tr/api/izban/sefersaatleri';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * URL'yi fetch et. CORS hatası alırsa proxy üzerinden dene.
 * sessionStorage cache kullanır.
 */
async function fetchWithCache(url, cacheKey) {
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.warn(`Doğrudan fetch başarısız (${cacheKey}), CORS proxy deneniyor...`, e.message);
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    data = await res.json();
  }

  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

/**
 * ESHOT hat saatlerini çek. { gidis: number[], donus: number[] } döner.
 * gidis/donus dizileri dakika cinsinden, sıralı.
 */
async function fetchEshot(hatNo) {
  const url = `${ESHOT_BASE}?resource_id=${ESHOT_RESOURCE}&filters={"HAT_NO":${hatNo}}&limit=500`;
  const data = await fetchWithCache(url, `eshot_${hatNo}`);
  const records = data.result.records;

  const gidis = records
    .map(r => r.GIDIS_SAATI)
    .filter(Boolean)
    .map(timeToMin)
    .sort((a, b) => a - b);

  const donus = records
    .map(r => r.DONUS_SAATI)
    .filter(Boolean)
    .map(timeToMin)
    .sort((a, b) => a - b);

  return { gidis, donus };
}

/**
 * İZBAN sefer saatlerini çek.
 * { hareket: number[], varis: number[], seferler: {h: number, v: number}[] } döner.
 */
async function fetchIzban(kalkisId, varisId) {
  const url = `${IZBAN_BASE}/${kalkisId}/${varisId}`;
  const data = await fetchWithCache(url, `izban_${kalkisId}_${varisId}`);

  const seferler = data.SeferSaatleri.map(s => ({
    h: timeToMin(s.HareketSaati),
    v: timeToMin(s.VarisSaati)
  })).sort((a, b) => a.h - b.h);

  return seferler;
}

/** 4 API'yi paralel çek. Hata mesajıyla reject eder. */
async function loadAllData() {
  const [eshot555, eshot776, izbanGidis, izbanDonus] = await Promise.all([
    fetchEshot(555),
    fetchEshot(776),
    fetchIzban(21, 32),
    fetchIzban(32, 21)
  ]);
  return { eshot555, eshot776, izbanGidis, izbanDonus };
}
```

- [ ] **Step 2: Konsol üzerinden API çağrılarını doğrula**

Tarayıcı konsolunda:
```javascript
loadAllData().then(d => {
  console.log('555 gidiş sefer sayısı:', d.eshot555.gidis.length);
  console.log('776 gidiş sefer sayısı:', d.eshot776.gidis.length);
  console.log('İZBAN gidiş sefer sayısı:', d.izbanGidis.length);
  console.log('İZBAN dönüş sefer sayısı:', d.izbanDonus.length);
}).catch(e => console.error('API hatası:', e));
```

Beklenen: Her birinden 0'dan büyük sefer sayısı. İZBAN yaklaşık 40-50 sefer, ESHOT değişken.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: API katmanı (ESHOT + İZBAN fetch, CORS fallback, sessionStorage cache)"
```

---

## Task 4: Hesaplama Fonksiyonları (Gidiş + Dönüş)

**Files:**
- Modify: `index.html` — `<script>` bloğuna, API katmanından sonra ekle

- [ ] **Step 1: Gidiş ve dönüş hesaplama fonksiyonlarını yaz**

```javascript
// ── Hesaplama ──

/** Parametre değerlerini DOM'dan oku */
function getParams() {
  return {
    sure555:    parseInt(document.getElementById('p-555-sure').value) || 0,
    halkYuru:   parseInt(document.getElementById('p-halk-yuru').value) || 0,
    cumaYuru:   parseInt(document.getElementById('p-cuma-yuru').value) || 0,
    sure776:    parseInt(document.getElementById('p-776-sure').value) || 0,
  };
}

/**
 * GİDİŞ hesabı: 555 → Halkapınar İZBAN → Cumaovası → 776
 * Her 555 gidiş seferi için en uygun İZBAN ve 776 seferini bulur.
 * Dönüş: satır dizisi, her satır = { cols: string[8], toplamBekleme: number, busKalkisMin: number }
 */
function calculateGidis(data, params) {
  const rows = [];
  const { gidis: bus555 } = data.eshot555;
  const { gidis: bus776 } = data.eshot776;
  const izbanSeferler = data.izbanGidis;
  const izbanHareket = izbanSeferler.map(s => s.h);

  for (const kalkis555 of bus555) {
    const halkVaris = kalkis555 + params.sure555;
    const izbanHazir = halkVaris + params.halkYuru;

    // İlk uygun İZBAN seferi
    const izbanIdx = findFirstAfter(izbanHareket, izbanHazir);
    if (izbanIdx === -1) continue;

    const izbanSefer = izbanSeferler[izbanIdx];
    const izbanBekleme = waitMinutes(izbanSefer.h, izbanHazir);
    const cumaVaris = izbanSefer.v;

    const otobusHazir = cumaVaris + params.cumaYuru;

    // İlk uygun 776 seferi
    const busIdx = findFirstAfter(bus776, otobusHazir);
    if (busIdx === -1) continue;

    const bus776Kalkis = bus776[busIdx];
    const busBekleme = waitMinutes(bus776Kalkis, otobusHazir);
    const toplamBekleme = izbanBekleme + busBekleme;

    rows.push({
      cols: [
        minToTime(kalkis555),
        minToTime(halkVaris),
        minToTime(izbanSefer.h),
        `${izbanBekleme} dk`,
        minToTime(cumaVaris),
        minToTime(bus776Kalkis),
        `${busBekleme} dk`,
        `${toplamBekleme} dk`
      ],
      toplamBekleme,
      busKalkisMin: kalkis555
    });
  }

  return rows;
}

/**
 * DÖNÜŞ hesabı: 776 → Cumaovası İZBAN → Halkapınar → 555
 * Her 776 gidiş seferi için en uygun İZBAN ve 555 dönüş seferini bulur.
 * Dönüş: satır dizisi, her satır = { cols: string[8], toplamBekleme: number, busKalkisMin: number }
 */
function calculateDonus(data, params) {
  const rows = [];
  const { gidis: bus776 } = data.eshot776;
  const { donus: bus555 } = data.eshot555;
  const izbanSeferler = data.izbanDonus;
  const izbanHareket = izbanSeferler.map(s => s.h);

  for (const kalkis776 of bus776) {
    const cumaVaris = kalkis776 + params.sure776;
    const izbanHazir = cumaVaris + params.cumaYuru;

    const izbanIdx = findFirstAfter(izbanHareket, izbanHazir);
    if (izbanIdx === -1) continue;

    const izbanSefer = izbanSeferler[izbanIdx];
    const izbanBekleme = waitMinutes(izbanSefer.h, izbanHazir);
    const halkVaris = izbanSefer.v;

    const otobusHazir = halkVaris + params.halkYuru;

    const busIdx = findFirstAfter(bus555, otobusHazir);
    if (busIdx === -1) continue;

    const bus555Kalkis = bus555[busIdx];
    const busBekleme = waitMinutes(bus555Kalkis, otobusHazir);
    const toplamBekleme = izbanBekleme + busBekleme;

    rows.push({
      cols: [
        minToTime(kalkis776),
        minToTime(cumaVaris),
        minToTime(izbanSefer.h),
        `${izbanBekleme} dk`,
        minToTime(halkVaris),
        minToTime(bus555Kalkis),
        `${busBekleme} dk`,
        `${toplamBekleme} dk`
      ],
      toplamBekleme,
      busKalkisMin: kalkis776
    });
  }

  return rows;
}
```

- [ ] **Step 2: Konsol üzerinden doğrula**

Tarayıcı konsolunda (loadAllData tamamlandıktan sonra):
```javascript
loadAllData().then(data => {
  const params = getParams();
  const gidis = calculateGidis(data, params);
  const donus = calculateDonus(data, params);
  console.log('Gidiş satır sayısı:', gidis.length, 'Örnek:', gidis[0]?.cols);
  console.log('Dönüş satır sayısı:', donus.length, 'Örnek:', donus[0]?.cols);
});
```

Beklenen: Her iki hesaplamadan da satırlar dönmeli, `cols` dizisi 8 elemanlı olmalı.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: gidiş + dönüş aktarma hesaplama algoritmaları"
```

---

## Task 5: Tablo Render + Görsel İşaretleme

**Files:**
- Modify: `index.html` — `<script>` bloğuna, hesaplama fonksiyonlarından sonra ekle

- [ ] **Step 1: Tablo render ve satır vurgulama fonksiyonlarını yaz**

```javascript
// ── Render ──

/**
 * Satır dizisini <tbody> elementine render eder.
 * Görsel işaretleme uygular: best (en düşük bekleme), now (şu ana en yakın), past (geçmiş).
 */
function renderTable(tbodyId, rows) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" style="text-align:center;color:#666;padding:20px;">Uygun aktarma bulunamadı</td>';
    tbody.appendChild(tr);
    return;
  }

  // Şu anki dakika
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // En düşük toplam bekleme
  const minBekleme = Math.min(...rows.map(r => r.toplamBekleme));

  // Şu ana en yakın gelecek sefer
  let closestIdx = -1;
  let closestDiff = Infinity;
  rows.forEach((r, i) => {
    const diff = r.busKalkisMin - nowMin;
    if (diff >= 0 && diff < closestDiff) {
      closestDiff = diff;
      closestIdx = i;
    }
  });

  rows.forEach((row, i) => {
    const tr = document.createElement('tr');

    // Geçmiş seferler
    if (row.busKalkisMin < nowMin) tr.classList.add('past');
    // En iyi (en düşük bekleme)
    if (row.toplamBekleme === minBekleme) tr.classList.add('best');
    // Şu ana en yakın
    if (i === closestIdx) tr.classList.add('now');

    tr.innerHTML = row.cols.map(c => `<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  });

  // En yakın sefere scroll
  if (closestIdx >= 0) {
    const target = tbody.children[closestIdx];
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: tablo render + görsel işaretleme (best/now/past)"
```

---

## Task 6: Uygulama Entegrasyonu (Init + Reaktif Güncelleme)

**Files:**
- Modify: `index.html` — `<script>` bloğuna, render fonksiyonlarından sonra ekle

- [ ] **Step 1: Init ve event binding fonksiyonlarını yaz**

```javascript
// ── Uygulama ──

let appData = null;

function updateTables() {
  if (!appData) return;
  const params = getParams();
  const gidisRows = calculateGidis(appData, params);
  const donusRows = calculateDonus(appData, params);
  renderTable('tbody-gidis', gidisRows);
  renderTable('tbody-donus', donusRows);
}

async function init() {
  const statusEl = document.getElementById('status');
  const tablesEl = document.getElementById('tables');

  try {
    appData = await loadAllData();

    statusEl.style.display = 'none';
    tablesEl.style.display = '';

    updateTables();

    // Parametreler değişince anlık güncelle
    document.querySelectorAll('.params input').forEach(input => {
      input.addEventListener('input', updateTables);
    });

  } catch (err) {
    statusEl.textContent = `API hatası: ${err.message}`;
    statusEl.classList.add('error');
    console.error('Init hatası:', err);
  }
}

init();
```

- [ ] **Step 2: `<script>` bloğundaki eski placeholder yorumunu temizle**

`// JS buraya eklenecek (Task 2+)` satırı kaldırılmış olmalı (Task 2'de kaldırıldı). Eğer hâlâ varsa sil.

- [ ] **Step 3: Tam entegrasyon testi — tarayıcıda aç ve doğrula**

`index.html` dosyasını tarayıcıda aç. Kontrol listesi:

1. "Veriler yükleniyor..." mesajı gösterilir, sonra tablolar gelir
2. Gidiş tablosunda satırlar var (555 kalkış → 776 kalkış zinciri)
3. Dönüş tablosunda satırlar var (776 kalkış → 555 dönüş zinciri)
4. En düşük beklemeli satırlar yeşil vurgulu
5. Şu anki saate en yakın sefer mavi kenar ile işaretli
6. Geçmiş seferler soluk görünür
7. Parametre inputlarından birini değiştir (ör: 555→Halkapınar'ı 45'e çek) → tablolar anında güncellenir
8. Sayfa yenilenmesinde veri cache'den gelir (Network tab'da API çağrısı yapılmaz)

Eğer CORS hatası alınırsa: konsol logunda "CORS proxy deneniyor..." mesajı görünmeli, ardından proxy üzerinden veri gelmeli.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: uygulama entegrasyonu — init, reaktif parametre güncelleme, tam çalışan uygulama"
```

---

## Spec Kapsam Kontrolü

| Spec Bölümü | Task |
|---|---|
| §1 Amaç | Tüm tasklar birlikte |
| §2 Rota (555↔776, Halkapınar↔Cumaovası) | Task 4 (hesaplama) |
| §3 Veri Kaynakları (4 API) | Task 3 (API katmanı) |
| §4 Parametrik Süreler (40, 5, 5, 75 dk) | Task 1 (HTML) + Task 6 (binding) |
| §5.1 Gidiş algoritması | Task 4 (calculateGidis) |
| §5.2 Dönüş algoritması | Task 4 (calculateDonus) |
| §5.3 Saat karşılaştırması / gece yarısı | Task 2 (timeToMin, findFirstAfter, waitMinutes) |
| §6.1 Parametre kontrolleri | Task 1 (HTML inputlar) |
| §6.2 İki tablo yan yana | Task 1 (HTML) + Task 5 (render) |
| §6.3 Görsel işaretleme (yeşil/mavi/soluk) | Task 5 (renderTable) |
| §7.2 CORS stratejisi | Task 3 (fetchWithCache) |
| §7.3 Cache (sessionStorage) | Task 3 (fetchWithCache) |
| §7.4 Hata yönetimi | Task 3 (hata fırlatma) + Task 6 (status mesajı) |
