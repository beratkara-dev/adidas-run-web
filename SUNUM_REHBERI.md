# 📊 Adidas Run - Proje Teknik Altyapı ve Sunum Dokümantasyonu

Bu doküman, **Adidas Run Web** uygulamasının yazılım mimarisini, veritabanı şemasını, veri modellerini ve kullanılan web teknolojilerinin endüstriyel standartlarını detaylandırmak üzere hazırlanmış **resmi teknik başvuru kılavuzudur**.

---

## 🎯 1. PROJE MİMARİSİ VE SİSTEM TASARIMI

Adidas Run, modern web standartlarına uygun olarak tasarlanmış, sunucusuz (**Serverless**) bir mimariye sahip gerçek zamanlı bir aktivite takip uygulamasıdır.

* **Frontend (Ön Yüz):** Semantik HTML5 standartları, modern Vanilla CSS3 (Glassmorphism/Cam efekti tasarımı) ve JavaScript (ES6+ Modüler Yapı). Harita arayüzü ve coğrafi görselleştirmeler için açık kaynaklı **Leaflet.js** kütüphanesi entegre edilmiştir.
* **Backend & Veri Katmanı:** **Google Firebase Bulut Servisleri**. Kullanıcı kimlik doğrulama, oturum yönetimi ve şifreleme katmanı için **Firebase Authentication**; gerçek zamanlı konum paylaşımı, kullanıcı etkileşimi, dinamik günlük görevler ve geçmiş takibi için **Firebase Realtime Database (NoSQL)** mimarisi tercih edilmiştir.

---

## 💾 2. VERİTABANI MİMARİSİ VE VERİ YAPILANDIRMASI

### A) Firebase Realtime Database Altyapısı
Uygulamada kullanılan NoSQL veritabanı, verileri ilişkisel tablolar (SQL) yerine tek bir hiyerarşik **JSON Ağacı (NoSQL)** yapısında depolar.
* **Gerçek Zamanlı İletişim (Realtime):** Veritabanı istemcilerle **WebSockets** protokolü üzerinden sürekli açık bir bağlantı kurar. Veri üzerinde yapılan herhangi bir değişiklik (Insert, Update, Delete) milisaniyeler seviyesinde tüm bağlı istemcilere otomatik olarak dağıtılır. Bu sayede haritada aktif koşan diğer kullanıcıların konumları sayfayı yenilemeden anlık olarak senkronize edilir.

### B) Mantıksal Veri Modeli (JSON Schema)
Sistemdeki tüm kullanıcı profilleri, aktiviteler, günlük görevler ve geçmiş koşu rotaları veritabanında aşağıdaki veri modeline uygun olarak yapılandırılmıştır:

```json
{
  "users": {
    "KULLANICI_BENZERSİZ_UID_KODU": {
      "name": "Berat",
      "avatar": "https://api.dicebear.com/...",
      "level": 3,
      "xp": 450,
      "lat": 41.0082,
      "lng": 28.9784,
      "dist": "4.20",
      "platform": "Web",
      "lastActive": 1779388626398,
      "healthData": {
        "age": 22,
        "gender": "male",
        "height": 180,
        "weight": 75
      },
      "dailyQuest": {
        "type": "distance",
        "target": 2.0,
        "current": 1.2,
        "completed": false,
        "date": "21.05.2026",
        "reward": 150
      },
      "history": [
        {
          "date": "21.05.2026",
          "distance": "2.50",
          "time": "00:15:30",
          "calories": "180",
          "pace": "6:12",
          "path": [
            [41.0082, 28.9784],
            [41.0090, 28.9800]
          ],
          "timestamp": 1779388620000
        }
      ]
    }
  }
}
```

### C) Firebase SDK Veri Erişim Metotları
Veritabanı okuma ve yazma süreçleri, `app.js` içerisinde Firebase veri erişim API'leri kullanılarak asenkron olarak gerçekleştirilir:

| Firebase API Fonksiyonu | Fonksiyonel Amacı | Projedeki Uygulama Noktası |
| :--- | :--- | :--- |
| **`ref()`** | Veritabanındaki hedef veri düğümünün adresini/yolunu işaret eder. | `ref(db, 'users/' + myUserId)` |
| **`set()`** | Hedef düğümdeki mevcut veriyi tamamen silerek yeni veriyi kaydeder. | İlk kullanıcı kaydı ve rota geçmişi yazım işlemlerinde. |
| **`update()`** | Mevcut veri yapısını bozmadan, sadece belirtilen anahtarları günceller. | Anlık koordinat değişiklikleri, XP artışları ve seviye güncellemelerinde. |
| **`get()`** | Verilen düğümdeki veriyi tek seferlik asenkron (Promise) olarak çeker. | Oturum açılışında kullanıcı profilinin ve sağlık verilerinin yüklenmesinde. |
| **`onValue()`** | Belirtilen düğümü sürekli dinleyerek gerçek zamanlı akış tetikler. | Haritadaki diğer aktif kullanıcıların konum değişimlerini izlemede. |

---

## 🔑 3. KULLANICI KİMLİK DOĞRULAMA VE GÜVENLİK (FIREBASE AUTH)

Uygulamanın kullanıcı güvenliği ve oturum yönetimi, güvenli kimlik doğrulama standartlarına dayanır:

1. **Şifreleme Altyapısı (Hashing):** İstemci şifreleri hiçbir şekilde sunucularda veya veritabanında düz metin (plain-text) olarak saklanmaz. Firebase Authentication, şifreleri sunucu tarafında **SHA-256 ve scrypt** algoritmalarıyla otomatik olarak tuzlayıp (salt) kriptografik olarak özetler.
2. **Asenkron Oturum Kontrolü:** İstemci tarafında oturum durumu `onAuthStateChanged` asenkron dinleyicisi ile takip edilir. Oturum açıldığında elde edilen JWT (JSON Web Token) tabanlı güvenli anahtarlar tarayıcının güvenli depolama birimlerinde saklanarak kalıcı oturum yönetimi sağlanır.

---

## 🌐 4. WEB TEKNOLOJİLERİ VE STANDARTLARI (W3C & NoSQL)

### A) JSON (JavaScript Object Notation) Veri Formatı Standartları
JSON, sistemler arası veri transferinde hafiflik ve esneklik sağlayan metin tabanlı bir veri değişim formatıdır.
* Veriler **Anahtar-Değer (Key-Value)** yapısıyla temsil edilir.
* Süslü parantezler nesneleri `{ }`, köşeli parantezler ise sıralı dizileri `[ ]` ifade eder.
* JSON standartlarına göre, anahtar adları **her zaman çift tırnak (`" "`)** ile yazılmalıdır; tek tırnak kullanımı geçersizdir.

### B) W3C Standartları ve Web Erişilebilirliği
**W3C (World Wide Web Consortium)**, web teknolojilerinin (HTML5, CSS3, XML vb.) tüm tarayıcılarda uyumlu, kararlı ve erişilebilir çalışması için standartlar geliştiren uluslararası bir kuruluştur. Projemiz W3C standartlarına uygun semantik etiketleme ve responsive (mobil uyumlu) yerleşim mimarisine sahiptir.

### C) SQL (İlişkisel) ve NoSQL (İlişkisel Olmayan) Karşılaştırması
* **SQL Veritabanları (İlişkisel):** Katı şemalara sahiptir. Tablolar, satırlar ve sütunlar bulunur. Veriler birbiriyle birincil/yabancı anahtarlar yardımıyla ilişkilendirilir. Dikey ölçekleme (vertical scaling) odaklıdır.
* **NoSQL Veritabanları (İlişkisel Olmayan):** Şemasız (Schema-less) bir yapıdadır. Veriler belgelerde (Document) veya hiyerarşik ağaçlarda saklanır. Yatay ölçeklenebilirliği (horizontal scaling) son derece yüksektir ve esnek veri modellerini destekler.

### D) Coğrafi Bilgi Sistemi (GIS) Altyapısı ve Geolocation
* Harita görselleştirmesi, performans odaklı açık kaynaklı **Leaflet.js** kütüphanesi ve **OpenStreetMap** karo sunucuları (Map Tiles) aracılığıyla sunulur.
* Kullanıcının anlık konumu, tarayıcının yerleşik **W3C Geolocation API**'si yardımıyla cihazın GPS veya ağ donanımlarından asenkron koordinatlar olarak çekilir.

---

## ⚡ 5. UYGULAMANIN İLERİ DÜZEY FONKSİYONEL ÖZELLİKLERİ

Uygulama, standart bir aktivite takip aracından farklı olarak aşağıdaki gelişmiş yazılım bileşenlerini barındırır:

1. **İnteraktif Aktivite Rota Oynatıcısı (Replay Engine):** Kaydedilen geçmiş koşu koordinat dizileri (`pathPoints`) Leaflet motorunda çizilerek görselleştirilir. "Tekrar Oynat" fonksiyonu, bu koordinat matrisini belirli zaman aralıklarıyla asenkron döngüye sokarak harita üzerinde marker hareketini dinamik olarak simüle eder.
2. **Gerçek Zamanlı Günlük Görev Motoru:** Her güne özel atanan dinamik görevler, koşu esnasında W3C Geolocation API'den gelen verilerle anlık tetiklenerek güncellenir. Görev tamamlandığında Firebase üzerinde asenkron veri güncellenir, XP eklenir ve tarayıcının yerleşik **SpeechSynthesis (Text-to-Speech)** motoru Türkçe başarı tebriği seslendirir.
3. **Gerçek Zamanlı Çoklu Platform ve Kullanıcı Desteği (Cross-Platform Synchronization):** Veritabanındaki `platform` parametresi sayesinde, uygulamaya **Web tarayıcısından** katılan bir kullanıcı ile arkadaşının **Android Mobil uygulamasından** katılan diğer bir kullanıcı harita üzerinde birbirlerini canlı olarak takip edebilir. Marker detaylarına tıklandığında kullanıcının hangi platformda (`[WEB]` veya `[MOBİL]`) aktif olduğu gerçek zamanlı olarak gösterilir.

---

### Sonuç
Bu proje; modern web teknolojileri (HTML5, CSS3, ES6+ JavaScript), bulut tabanlı NoSQL veritabanı mimarisi (Google Firebase) ve açık kaynaklı coğrafi bilgi sistemleri (Leaflet) entegrasyonu ile endüstriyel standartlara tam uyumlu olarak geliştirilmiştir.
