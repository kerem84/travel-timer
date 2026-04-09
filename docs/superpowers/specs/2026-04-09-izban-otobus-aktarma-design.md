# Otobüs-İZBAN Aktarma Optimizasyonu — Tasarım Dokümanı

**Tarih:** 2026-04-09
**Durum:** Onay bekliyor

---

## 1. Amaç

Kişisel kullanım için, 555 ve 776 otobüs hatları ile Halkapınar-Cumaovası İZBAN güzergahında minimum bekleme süresini sağlayan aktarma saatlerini gösteren tek sayfalık bir web uygulaması.

## 2. Rota

```
GİDİŞ:  555 otobüs → Halkapınar İZBAN (ID:21) → Cumaovası İZBAN (ID:32) → 776 otobüs
DÖNÜŞ:  776 otobüs → Cumaovası İZBAN (ID:32) → Halkapınar İZBAN (ID:21) → 555 otobüs
```

## 3. Veri Kaynakları

| Kaynak | Endpoint | Veri |
|--------|----------|------|
| ESHOT 555 saatleri | `https://acikveri.bizizmir.com/api/3/action/datastore_search?resource_id=c6fa6046-f755-47d7-b69e-db6bb06a8b5a&filters={"HAT_NO":555}&limit=500` | GIDIS_SAATI, DONUS_SAATI, SIRA |
| ESHOT 776 saatleri | `https://acikveri.bizizmir.com/api/3/action/datastore_search?resource_id=c6fa6046-f755-47d7-b69e-db6bb06a8b5a&filters={"HAT_NO":776}&limit=500` | GIDIS_SAATI, DONUS_SAATI, SIRA |
| İZBAN Halkapınar→Cumaovası | `https://openapi.izmir.bel.tr/api/izban/sefersaatleri/21/32` | HareketSaati, VarisSaati |
| İZBAN Cumaovası→Halkapınar | `https://openapi.izmir.bel.tr/api/izban/sefersaatleri/32/21` | HareketSaati, VarisSaati |

Tüm API'ler anonim erişimli, JSON dönüş yapar.

## 4. Parametrik Süreler (UI'dan Ayarlanabilir)

| Parametre | Varsayılan | Açıklama |
|-----------|-----------|----------|
| 555 → Halkapınar süresi | 40 dk | 555 kalkışından Halkapınar İZBAN'a tahmini varış |
| Halkapınar yürüyüş | 5 dk | İZBAN girişine yürüyüş süresi |
| Cumaovası yürüyüş | 5 dk | İZBAN çıkışından otobüs durağına yürüyüş |
| 776 → Cumaovası süresi | 75 dk | 776 kalkışından Cumaovası İZBAN'a tahmini varış |

Herhangi bir parametre değiştiğinde tablolar reaktif olarak yeniden hesaplanır.

## 5. Hesaplama Algoritması

### 5.1 GİDİŞ (555 → İZBAN → 776)

```
her 555_GIDIS_SAATI için:
  halkapinar_varis = 555_GIDIS_SAATI + param.otobus555Suresi
  izban_hazir = halkapinar_varis + param.halkapinarYuruyus

  izban_sefer = Halkapınar→Cumaovası seferlerinden ilk >= izban_hazir
  eğer bulunamazsa → satırı atla

  izban_bekleme = izban_sefer.HareketSaati - izban_hazir
  cumaovasi_varis = izban_sefer.VarisSaati

  otobus_hazir = cumaovasi_varis + param.cumaovasiYuruyus

  otobus_776 = 776_GIDIS seferlerinden ilk >= otobus_hazir
  eğer bulunamazsa → satırı atla

  otobus_bekleme = otobus_776.saat - otobus_hazir
  toplam_bekleme = izban_bekleme + otobus_bekleme
```

### 5.2 DÖNÜŞ (776 → İZBAN → 555)

```
her 776_GIDIS_SAATI için:
  cumaovasi_varis = 776_GIDIS_SAATI + param.otobus776Suresi
  izban_hazir = cumaovasi_varis + param.cumaovasiYuruyus

  izban_sefer = Cumaovası→Halkapınar seferlerinden ilk >= izban_hazir
  eğer bulunamazsa → satırı atla

  izban_bekleme = izban_sefer.HareketSaati - izban_hazir
  halkapinar_varis = izban_sefer.VarisSaati

  otobus_hazir = halkapinar_varis + param.halkapinarYuruyus

  otobus_555 = 555_DONUS seferlerinden ilk >= otobus_hazir
  eğer bulunamazsa → satırı atla

  otobus_bekleme = otobus_555.saat - otobus_hazir
  toplam_bekleme = izban_bekleme + otobus_bekleme
```

### 5.3 Saat Karşılaştırması

Tüm saatler "HH:MM" string formatında gelir. Karşılaştırma için dakikaya çevrilir (`saat*60 + dakika`). Gece yarısını geçen seferler (örn: 23:39→00:32) için +1440 dk offset uygulanır.

## 6. UI Tasarımı

### 6.1 Üst Kısım — Parametre Kontrolleri

4 adet number input, her birinin yanında label ve birim (dk). Değer değişince anlık güncelleme (`input` event).

### 6.2 Alt Kısım — İki Tablo Yan Yana

**Gidiş Tablosu:**

| 555 Kalkış | Halkapınar Varış | İZBAN Kalkış | İZBAN Bekleme | Cumaovası Varış | 776 Kalkış | 776 Bekleme | Toplam Bekleme |
|---|---|---|---|---|---|---|---|

**Dönüş Tablosu:**

| 776 Kalkış | Cumaovası Varış | İZBAN Kalkış | İZBAN Bekleme | Halkapınar Varış | 555 Kalkış | 555 Bekleme | Toplam Bekleme |
|---|---|---|---|---|---|---|---|

### 6.3 Görsel İşaretleme

- En düşük toplam bekleme süresine sahip satırlar yeşil vurgu
- Şu anki saate en yakın sefer ayrı renk ile işaretli
- Geçmiş seferler soluk (opacity: 0.4)
- Varsayılan sıralama: otobüs kalkış saatine göre artan

## 7. Teknik Kararlar

### 7.1 Dosya Yapısı

```
izban/
  index.html    ← Tek dosya: HTML + CSS + JS inline
```

Sıfır bağımlılık, sıfır build step.

### 7.2 CORS Stratejisi

1. Doğrudan `fetch()` — İzmir Belediyesi API'leri genelde CORS açık
2. Başarısızsa: ücretsiz CORS proxy fallback (allorigins.win vb.)
3. Son çare: Vite dev server proxy

### 7.3 Cache

`sessionStorage` ile API yanıtları cache'lenir. Aynı sekmede sayfa yenilendiğinde tekrar çağrı yapılmaz. Yeni sekme = taze veri.

### 7.4 Hata Yönetimi

- API erişilemezse: kullanıcıya mesaj göster, hangi API'nin başarısız olduğunu belirt
- Veri boşsa: "Bu hat için sefer bulunamadı" mesajı
- Uygun İZBAN/otobüs seferi bulunamazsa: satır tabloda gösterilmez

## 8. Kapsam Dışı

- Gerçek zamanlı otobüs konum takibi
- Birden fazla hat/istasyon kombinasyonu
- Harita görselleştirmesi
- Mobil uygulama
- Ücret hesaplama
