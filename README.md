# Adidas Run Web 🏃‍♂️💨

Adidas Run Android uygulamasının modern, şık ve fonksiyonel web versiyonu. Gerçek zamanlı konum takibi, koşu geçmişi ve oyunlaştırma (gamification) özelliklerini tarayıcınıza taşır.

## ✨ Özellikler

- **Gerçek Zamanlı Takip:** `Geolocation API` ile mesafe, süre, tempo ve kalori hesaplama.
- **Premium Tasarım:** Adidas estetiğine uygun karanlık mod, cam efekti (glassmorphism) ve neon detaylar.
- **Harita Entegrasyonu:** `Leaflet.js` ile koşu rotasını anlık olarak harita üzerinde çizme.
- **Oyunlaştırma:** Koştukça XP kazanma ve seviye atlama sistemi.
- **Koşu Geçmişi:** Son 5 koşuyu `localStorage` kullanarak tarayıcıda saklama.
- **Profil Yönetimi:** Kullanıcı ismi değiştirme ve dinamik avatar oluşturma.

## 🛠️ Teknolojiler

- **HTML5 & CSS3:** Modern ve responsive arayüz tasarımı.
- **Vanilla JavaScript:** Mantık ve konum işleme.
- **Leaflet.js:** Harita motoru.
- **Google Fonts:** Inter & Outfit tipografisi.

## 🚀 Nasıl Çalıştırılır?

Bu uygulama konum servislerini kullandığı için güvenli bir bağlantı (**HTTPS**) veya yerel bir sunucu (**localhost**) gerektirir.

1. Bu projeyi bilgisayarınıza indirin.
2. `web_app` klasörüne girin.
3. Yerel bir sunucu başlatın (Örn: `python -m http.server 8000` veya VS Code Live Server).
4. Tarayıcınızdan `http://localhost:8000` adresine gidin.

## 📱 Mobil Erişim

Telefonunuzdan test etmek için, projeyi **GitHub Pages**, **Netlify** veya **Vercel** gibi bir servise ücretsiz olarak yükleyebilirsiniz. Bu servisler otomatik olarak **HTTPS** sağladığı için konum servisleri sorunsuz çalışacaktır.

---
*Bu proje bir okul ödevi kapsamında geliştirilmiştir.*
