# 🎓 Adidas Run - Proje Sunum & Sınav Hazırlık Rehberi (Hoca Kurtaran Rehber)

Bu rehber, yarın hocana projeyi sunarken karşına çıkabilecek **tüm teknik soruları**, **veritabanı (Database) detaylarını** ve hocanın **konuyu kaydırabileceği teorik soruları (JSON, w3schools, Web Standartları vb.)** en basit ve akılda kalıcı şekilde cevaplaman için hazırlanmıştır.

Hocanın bilgisayarında GitHub üzerinden bu dosyayı açıp doğrudan buradan da yararlanabilirsin!

---

## 🎯 1. PROJENİN GENEL MİMARİSİ (SİSTEM NASIL ÇALIŞIYOR?)

Hocan sana **"Bu sistemin mimarisi nedir? Veriler nereye gidiyor?"** derse cevap:

> *"Hocam, bu proje **Sunucu Barındırmayan (Serverless)** modern bir web uygulamasıdır. Klasik bir veritabanı sunucusu (MySQL vb.) kurmak yerine, **Firebase** bulut servislerini kullandık.*
> * * **Frontend (Ön Yüz):** HTML5, Vanilla CSS3 (Cam efekti/Glassmorphism ile Adidas tasarımı) ve JavaScript (ES6+). Harita için açık kaynaklı **Leaflet.js** kütüphanesini kullandık.*
> * * **Backend & Veritabanı:** **Google Firebase Cloud** servisleri. Kullanıcı yönetimi için **Firebase Auth**, gerçek zamanlı konum ve geçmiş takibi için ise **Firebase Realtime Database (NoSQL)** kullandık."*

---

## 💾 2. VERİTABANI (DATABASE) YAPISI & FİREBASE DETAYLARI

Hocanın en çok soracağı ve odaklanacağı kısım burasıdır.

### A) Firebase Realtime Database Nedir?
* **Cevap:** *"Hocam, Firebase Realtime Database, verileri ilişkisel tablolar (SQL) yerine tek bir büyük **JSON Ağacı (NoSQL)** olarak tutan bulut tabanlı bir veritabanıdır.*
* **Neden Realtime (Gerçek Zamanlı)?** *"WebSockets protokolünü kullanır. Yani veritabanında bir veri değiştiği anda, sayfayı yenilemeye gerek kalmadan kullanıcının ekranı otomatik olarak güncellenir. Bu sayede haritada koşan diğer kullanıcıları anlık olarak görebiliyoruz."*

### B) Veritabanı JSON Ağacı Şemamız (Hocaya Gösterilecek Şema)
Veritabanımızda veriler tam olarak şu JSON formatında tutulmaktadır:

```json
{
  "users": {
    "KULLANICI_BENZERSİZ_ID_KODU (UID)": {
      "name": "Berat",
      "avatar": "https://api.dicebear.com/...",
      "level": 3,
      "xp": 450,
      "lat": 41.0082,
      "lng": 28.9784,
      "dist": "4.20",
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

### C) Veritabanı Kod Metotlarımız (Hoca Kod Sorarsa)
Veritabanı işlemlerini `app.js` dosyasında şu **Firebase SDK** fonksiyonları ile yönetiyoruz:

| Fonksiyon | Ne İşe Yarar? | Projedeki Örneği |
| :--- | :--- | :--- |
| **`ref()`** | Veritabanındaki veri düğümünün adresini (yolunu) belirtir. | `ref(db, 'users/' + myUserId)` |
| **`set()`** | Belirtilen adresteki veriyi tamamen sıfırlayıp yenisini yazar. | Kayıt olurken veya rota kaydederken kullanılır. |
| **`update()`** | Mevcut verileri bozmadan sadece içindeki belirli alanları günceller. | Anlık konum (`lat`, `lng`) veya XP güncellerken kullanılır. |
| **`get()`** | Veriyi veritabanından tek seferlik (statik) olarak okur. | Kullanıcı giriş yaptığında geçmiş koşularını yüklerken kullanılır. |
| **`onValue()`** | Veritabanındaki değişikliği sürekli dinler, veri değiştikçe tetiklenir. | Haritada diğer koşan arkadaşları anlık çizdirmek için dinleyicidir. |

---

## 🔑 3. KULLANICI KİMLİK DOĞRULAMA (FIREBASE AUTH)

Hocan **"Giriş ve Kayıt nasıl yapılıyor? Şifreleri güvenli mi tutuyorsun?"** derse cevap:

1. **Şifre Güvenliği:** *"Hocam, kullanıcı şifrelerini asla düz metin (plain-text) olarak veritabanına kaydetmiyoruz. Firebase Auth altyapısı şifreleri sunucu tarafında **SHA-256 / scrypt** algoritmalarıyla otomatik olarak tuzlayıp şifreler (Hash). Biz bile şifrelerin gerçeğini göremeyiz."*
2. **Kullanılan Kod Yapısı:**
   * **Giriş:** `signInWithEmailAndPassword(auth, email, password)`
   * **Kayıt:** `createUserWithEmailAndPassword(auth, email, password)`
   * **Oturum Takibi:** `onAuthStateChanged(auth, (user) => { ... })` ile tarayıcı kapatılıp açılsa bile kullanıcının oturumu açık kalır.

---

## ⚠️ 4. ALAKASIZ VE TEORİK HOCA SORULARI (KONU SAPARSA KURTARMA REHBERİ)

Hocan w3schools veya web standartları gibi alakasız yerlere geçerse, sakin ol ve şu profesyonel tanımları yap:

### Soru: "JSON Nedir? Yapısını anlat."
* **Cevap:** *"JSON, **J**ava**S**cript **O**bject **N**otation (JavaScript Nesne Gösterimi) kelimelerinin kısaltmasıdır. Sistemler arası veri alışverişi yapmak için kullanılan, insan tarafından okunması kolay, hafif ve metin tabanlı bir standarttır.*
* **Yazım Kuralları (Syntax):**
  * Veriler **Anahtar-Değer (Key-Value)** çiftleri halinde tutulur: `"isim": "Berat"`
  * Veriler virgüllerle ayrılır.
  * Süslü parantezler `{ }` nesneleri (objeleri), köşeli parantezler `[ ]` dizileri (array) temsil eder.
  * Anahtar isimleri her zaman **çift tırnak (`" "`)** içinde yazılmalıdır.

### Soru: "W3C Nedir? Web Standartları Nelerdir?"
* **Cevap:** *"W3C, **World Wide Web Consortium**'dur. Web'in kurucusu **Tim Berners-Lee** tarafından kurulmuştur. Web sayfalarının tüm tarayıcılarda (Chrome, Safari, Edge) aynı ve kararlı çalışması için standartlar (HTML5, CSS3 yönergeleri) belirler. Kodlarımızı W3C standartlarına uygun yazmak SEO ve erişilebilirlik açısından kritiktir."*

### Soru: "SQL (İlişkisel) ile NoSQL (İlişkisel Olmayan) Veritabanı Arasındaki Fark Nedir?"
* **Cevap:** 
  * *"**SQL (MySQL, PostgreSQL):** Tablolardan oluşur. Satır ve sütunlar vardır. Tablolar birbirine yabancı anahtarlarla (Foreign Key) bağlıdır. Katı şemalara sahiptir.*
  * ***NoSQL (Firebase, MongoDB):** Belge (Document) veya JSON ağacı tabanlıdır. İlişkiler yoktur, veriler iç içe (nested) gömülü olarak tutulur. Şemasızdır (Schema-less), yani her kullanıcı kaydına isteğe bağlı olarak farklı alanlar (örneğin sadece bazılarına sağlık verisi) ekleyebiliriz. Çok daha hızlı ve yatayda kolay ölçeklenebilirdir."*

### Soru: "Haritayı nasıl çizdiniz? GPS verisi nasıl geliyor?"
* **Cevap:** 
  * *"Hocam, harita alt yapısı için açık kaynaklı ve performans dostu **Leaflet.js** kütüphanesini kullandık. Harita karolarını (Map Tiles) **OpenStreetMap** üzerinden çekiyoruz.*
  * *Konum bilgisi ise tarayıcının yerleşik **W3C Geolocation API**'si yardımıyla cihazın GPS/Wi-Fi çiplerinden anlık enlem (latitude) ve boylam (longitude) olarak `navigator.geolocation.watchPosition` metoduyla çekilip veritabanına ve haritaya aktarılıyor."*

---

## ⚡ 5. SUNUM ESNASINDA HOCAYA GÖSTERİLECEK 3 EFSANE ÖZELLİK

Hocanın gözünü boyamak ve tam puan almak için sunumda şu 3 özelliği ön plana çıkar:

1. **İnteraktif Rota Replay (Tekrar Oynatım):** 
   * *"Hocam, geçmişteki bir koşuma tıkladığımda haritada koştuğum yolları Leaflet üzerinde neon çizgilerle çiziyor. Üstelik 'Tekrar Oynat' tuşuna basarak, sanki o an koşuyormuşum gibi haritada markerın hareketini animasyonlu simüle edebiliyorum."*
2. **Dinamik Sesli ve Ödüllü Günlük Görev:** 
   * *"Hocam, her gün tarihe özel rastgele bir görev atanıyor. Görev bittiğinde Firebase veritabanı anlık güncelleniyor, kullanıcı seviye atlıyor ve tarayıcının ses motoru (TTS) Türkçe olarak kullanıcıyı tebrik ediyor."*
3. **Anlık Diğer Kullanıcılar (Realtime Multi-user):** 
   * *"Hocam, eğer sisteme başka bir tarayıcıdan veya telefondan biri giriş yapıp koşmaya başlarsa, Firebase Realtime Database sayesinde haritamızda onun avatarı anlık olarak beliriyor ve onun hareketlerini sayfayı yenilemeden canlı izleyebiliyoruz!"*

---

🎉 **Yarınki sunumunda başarılar Berat! Sakin ol, bu rehberi hocanın bilgisayarında aç ve projeyi gururla anlat. Tam puan senin!** 💪🏆
