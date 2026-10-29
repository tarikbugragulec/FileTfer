# FileTfer - Modern FTP & SFTP Masaüstü İstemcisi

FileZilla ve Cyberduck mimarisini temel alan, **Go** ve **Wails v2** ile geliştirilmiş; son derece hafif (~13 MB), yüksek performanslı, modern obsidian/grafit arayüzlü masaüstü FTP/SFTP istemcisi.

---

## 🚀 Öne Çıkan Özellikler

- **Dahili Kod & Metin Editörü (Inline File Editor):**
  - Uzak veya yerel `.txt`, `.json`, `.js`, `.py`, `.html`, `.css`, `.go`, `.sh`, `.sql`, `.env`, `.md` vb. dosyaları çift tıkla doğrudan uygulama içinde açma.
  - Canlı satır/karakter sayacı, monospace JetBrains Mono fontu ve `Ctrl+S` ile doğrudan sunucuya geri kaydetme.
- **Resim Önizleme Lightbox (Image Viewer):**
  - `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico` dosyalarını tek tıkla tam çözünürlüklü önizleme penceresinde açma.
- **Tıklanabilir Hiyerarşik Yol Çubuğu (Interactive Breadcrumb Bar):**
  - Klasör yolları interaktif parçalar halinde listelenir. Aradaki herhangi bir üst klasöre tek tıkla zıplanabilir.
  - Kalem ikonuna tıklanarak veya çift tıklanarak doğrudan metin yazma moduna geçilebilir.
- **Linux Dosya İzinleri Yöneticisi (CHMOD 755/644):**
  - Uzak sunucudaki dosya veya klasörlere sağ tıklayarak görsel CHMOD düzenleyicisi açma (Sahip, Grup, Diğerleri - Oku, Yaz, Çalıştır).
  - Sayısal octal değer kutusu ve "Alt klasörlere özyinelemeli uygula (Recursive)" desteği.
- **Senkronize Gezinme (Synchronized Browsing):**
  - Üst çubuktaki `Senkron` butonu aktif edildiğinde; sol panelde bir klasöre girildiğinde sağ paneldeki aynı isimli klasöre de otomatik geçilir, üst klasöre çıkıldığında her ikisi birden çıkar.
- **Geliştirici Dosya Filtresi (Dev Filters):**
  - Üst çubuktaki `Filtre` butonu ile `node_modules`, `.git`, `.venv`, `__pycache__`, `.idea`, `.vscode` gibi binlerce gereksiz dosyayı gizleyerek listeyi hızlandırma.
- **Uygulama Tercihleri & Ayarlar (Preferences Modal):**
  - Eşzamanlı transfer iş parçacığı sayısı (1 - 10 paralel worker), bağlantı zaman aşımı ve varsayılan filtre ayarları.
- **Modern Obsidian & Grafit Arayüz:**
  - Sıfır ham emoji, şık SVG vektör ikon seti, özel modern dropdown menüler.
- **Paneller Arası Sürükle & Bırak (Drag and Drop):**
  - Yerel panelden sunucu paneline veya tersine doğrudan sürükleyip bırakarak yükleme / indirme.
- **Hızlı Erişim Klasörleri (Quick Path Pills):**
  - Masaüstü, İndirilenler, Belgeler ve Kullanıcı Ev Dizinine tek tıkla geçiş.
- **Klavye Kısayolları (`?` Tuşu):**
  - `F5` / `Ctrl+R` (Yenile), `Backspace` (Üst Dizin), `Delete` (Sil), `F2` (Yeniden Adlandır), `Ctrl+F` (Ara), `Esc` (Kapat).
- **Zarif Bildirim Sistemi (Toast Notifications):**
  - Bağlantı, aktarım, silme ve hata durumlarında sağ altta otomatik kaybolan bildirim kartları.
- **Protokol Desteği:**
  - **SFTP (SSH - Port 22):** Güvenli ve modern bağlantı.
  - **FTP (Standart - Port 21):** Klasik FTP desteği.
  - **FTPS (TLS/SSL):** Açık (Explicit AUTH TLS, Port 21) ve Örtük (Implicit TLS, Port 990) tam şifreli FTP.
- **Arka Plan Transfer Kuyruğu (Queue Engine):**
  - Goroutine iş parçacığı havuzu, anlık transfer hız hesaplama (KB/s, MB/s) ve ilerleme çubuğu.
- **Site Yöneticisi (Site Manager):**
  - Sunucuları etiketleriyle kaydetme (Hazır DLP Test Sunucusu dahil) ve tek tıkla bağlanma.

---

## 📁 Proje Dizin Yapısı

```
FTP/
├── backend/                  # Go Çekirdek Motoru
│   ├── types.go              # Veri modelleri ve tipler
│   ├── client.go             # RemoteClient ortak arayüzü
│   ├── ftp_client.go         # FTP & FTPS implementasyonu
│   ├── sftp_client.go        # SSH / SFTP implementasyonu
│   ├── local_fs.go           # Yerel disk, sürücüler ve hızlı yollar
│   ├── queue.go              # Arka plan goroutine transfer kuyruğu
│   └── bookmarks.go          # Site yöneticisi kayıt motoru
├── frontend/                 # Modern Kullanıcı Arayüzü
│   ├── index.html            # Ana HTML şablonu, modallar ve toast container
│   └── src/
│       ├── style.css         # CSS tokenları, renk paletleri ve ikonlar
│       ├── app.css           # Çift panel, özel dropdown ve bildirim stilleri
│       └── main.js           # Arayüz mantığı, sürükle-bırak, kısayollar
├── build/bin/
│   └── FileTfer.exe          # Üretilen taşınabilir masaüstü uygulaması
├── calistir.bat              # Tek tıkla uygulamayı başlatan script
├── gelistirici_modu.bat      # Canlı geliştirme sunucusunu başlatan script
├── app.go                    # Wails API bağlayıcısı (Backend <-> Frontend)
├── main.go                   # Pencere ve uygulama konfigürasyonu
└── wails.json                # Wails proje ayarları (FileTfer)
```

---

## 🛠️ Nasıl Çalıştırılır ve Geliştirilir?

### 1. Hazır `.exe`yi Çalıştırma
Uygulamayı doğrudan başlatmak için `calistir.bat` dosyasına çift tıklayın veya terminalden çalıştırın:
```powershell
.\calistir.bat
# veya doğrudan:
.\build\bin\FileTfer.exe
```

### 2. Canlı Geliştirme Modu (Hot Reload)
Kodda değişiklik yaptığınızda anında yenilenmesi için `gelistirici_modu.bat` dosyasına tıklayın veya:
```powershell
wails dev
```

### 3. Yeniden Derleme (Production Build)
```powershell
wails build
```
Derlenen `.exe` dosyası doğrudan `build/bin/FileTfer.exe` konumunda oluşturulur.

