package backend

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jlaffaye/ftp"
)

// FTPClient implements RemoteClient for standard FTP and FTPS
type FTPClient struct {
	conn      *ftp.ServerConn
	cfg       ConnectionConfig
	connected bool
	logFn     func(msgType, text string)
	mu        sync.Mutex
}

// NewFTPClient creates a new FTP/FTPS client
func NewFTPClient() *FTPClient {
	return &FTPClient{}
}

func (c *FTPClient) log(msgType, text string) {
	if c.logFn != nil {
		c.logFn(msgType, text)
	}
}

// Connect establishes connection with FTP/FTPS server
func (c *FTPClient) Connect(cfg ConnectionConfig, logFn func(msgType, text string)) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cfg = cfg
	c.logFn = logFn

	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	if cfg.Port == 0 {
		addr = fmt.Sprintf("%s:21", cfg.Host)
	}

	c.log("info", fmt.Sprintf("%s adresine bağlanılıyor...", addr))

	var options []ftp.DialOption
	options = append(options, ftp.DialWithTimeout(timeout))

	if strings.ToLower(cfg.Protocol) == "ftps" {
		tlsConf := &tls.Config{
			InsecureSkipVerify: true, // Allow self-signed certs typical for FTP
			ServerName:         cfg.Host,
			ClientSessionCache: tls.NewLRUClientSessionCache(64),
		}
		if cfg.Port == 990 {
			c.log("info", "Örtük (Implicit) TLS/SSL bağlantısı başlatılıyor (Port 990)...")
			options = append(options, ftp.DialWithTLS(tlsConf))
		} else {
			c.log("info", "Açık (Explicit AUTH TLS) şifreli bağlantı başlatılıyor (Port 21)...")
			options = append(options, ftp.DialWithExplicitTLS(tlsConf))
		}
	}

	conn, err := ftp.Dial(addr, options...)
	if err != nil {
		c.log("error", fmt.Sprintf("Bağlantı kurulamadı: %v", err))
		return fmt.Errorf("FTP bağlantı hatası: %w", err)
	}

	c.conn = conn
	c.log("response", "Sunucuya bağlanıldı. Kimlik doğrulanıyor...")

	username := cfg.Username
	if username == "" {
		username = "anonymous"
	}

	c.log("command", fmt.Sprintf("USER %s", username))
	err = c.conn.Login(username, cfg.Password)
	if err != nil {
		c.conn.Quit()
		c.conn = nil
		c.log("error", fmt.Sprintf("Kimlik doğrulama başarısız (Kullanıcı adı veya parola hatalı): %v", err))
		return fmt.Errorf("kullanıcı adı veya parola hatalı: %w", err)
	}

	c.connected = true
	c.log("success", "Oturum başarıyla açıldı!")

	currentDir, err := c.conn.CurrentDir()
	if err == nil {
		c.log("info", fmt.Sprintf("Mevcut uzak dizin: %s", currentDir))
	}

	return nil
}

// Disconnect terminates the connection
func (c *FTPClient) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		c.log("command", "QUIT")
		_ = c.conn.Quit()
		c.conn = nil
	}
	c.connected = false
	c.log("info", "Sunucu bağlantısı kesildi.")
	return nil
}

// IsConnected returns connection status
func (c *FTPClient) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected && c.conn != nil
}

// GetProtocol returns active protocol
func (c *FTPClient) GetProtocol() string {
	if strings.ToLower(c.cfg.Protocol) == "ftps" {
		return "FTPS"
	}
	return "FTP"
}

// GetCurrentDir returns current working directory on server
func (c *FTPClient) GetCurrentDir() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return "", fmt.Errorf("sunucuya bağlı değil")
	}

	dir, err := c.conn.CurrentDir()
	if err != nil {
		return "/", nil
	}
	return dir, nil
}

// List retrieves file and folder list for a remote path
func (c *FTPClient) List(remotePath string) ([]FileItem, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil, fmt.Errorf("sunucuya bağlı değil")
	}

	if remotePath == "" {
		remotePath = "/"
	}

	c.log("command", fmt.Sprintf("LIST %s", remotePath))
	entries, err := c.conn.List(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Dizin listesi alınamadı: %v", err))
		return nil, fmt.Errorf("uzak dizin listelenemedi: %w", err)
	}

	var items []FileItem

	for _, entry := range entries {
		if entry.Name == "." || entry.Name == ".." {
			continue
		}

		isDir := entry.Type == ftp.EntryTypeFolder
		entryPath := path.Join(remotePath, entry.Name)

		items = append(items, FileItem{
			Name:        entry.Name,
			Path:        entryPath,
			Size:        int64(entry.Size),
			HumanSize:   FormatHumanSize(int64(entry.Size), isDir),
			IsDir:       isDir,
			ModTime:     entry.Time.Format("2006-01-02 15:04"),
			Permissions: entry.Target, // or mode
			Ext:         ExtractExt(entry.Name),
		})
	}

	// Sort folders first, then alphabetical
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	c.log("response", fmt.Sprintf("%d öğe başarıyla listelendi.", len(items)))
	return items, nil
}

// progressWriter wraps an io.Writer to report progress
type progressWriter struct {
	writer      io.Writer
	transferred int64
	total       int64
	callback    ProgressCallback
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	n, err := pw.writer.Write(p)
	if n > 0 {
		pw.transferred += int64(n)
		if pw.callback != nil {
			pw.callback(pw.transferred, pw.total)
		}
	}
	return n, err
}

// progressReader wraps an io.Reader to report progress
type progressReader struct {
	reader      io.Reader
	transferred int64
	total       int64
	callback    ProgressCallback
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	if n > 0 {
		pr.transferred += int64(n)
		if pr.callback != nil {
			pr.callback(pr.transferred, pr.total)
		}
	}
	return n, err
}

// Upload uploads a local file to the FTP server
func (c *FTPClient) Upload(localPath, remotePath string, onProgress ProgressCallback) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("yerel dosya açılamadı: %w", err)
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		return err
	}
	totalSize := fi.Size()

	c.log("command", fmt.Sprintf("STOR %s (%s)", remotePath, FormatHumanSize(totalSize, false)))

	reader := &progressReader{
		reader:   file,
		total:    totalSize,
		callback: onProgress,
	}

	err = c.conn.Stor(remotePath, reader)
	if err != nil {
		c.log("error", fmt.Sprintf("Yükleme başarısız: %v", err))
		return fmt.Errorf("dosya yükleme hatası: %w", err)
	}

	c.log("success", fmt.Sprintf("Dosya başarıyla yüklendi: %s", filepath.Base(localPath)))
	return nil
}

// Download downloads a remote file to the local disk
func (c *FTPClient) Download(remotePath, localPath string, onProgress ProgressCallback) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("RETR %s", remotePath))
	resp, err := c.conn.Retr(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("İndirme başlatılamadı: %v", err))
		return fmt.Errorf("dosya indirme hatası: %w", err)
	}
	defer resp.Close()

	// Ensure destination directory exists
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return err
	}

	outFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("yerel hedef dosya oluşturulamadı: %w", err)
	}
	defer outFile.Close()

	writer := &progressWriter{
		writer:   outFile,
		total:    0, // FTP RETR response might not have known size ahead of time
		callback: onProgress,
	}

	buf := make([]byte, 256*1024)
	_, err = io.CopyBuffer(writer, resp, buf)
	if err != nil {
		c.log("error", fmt.Sprintf("İndirme sırasında hata: %v", err))
		return fmt.Errorf("aktarım hatası: %w", err)
	}

	c.log("success", fmt.Sprintf("Dosya başarıyla indirildi: %s", path.Base(remotePath)))
	return nil
}

// Delete removes a file or directory on the remote server
func (c *FTPClient) Delete(remotePath string, isDir bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	if isDir {
		c.log("command", fmt.Sprintf("RMD %s", remotePath))
		err := c.conn.RemoveDirRecur(remotePath)
		if err != nil {
			c.log("error", fmt.Sprintf("Klasör silinemedi: %v", err))
			return err
		}
	} else {
		c.log("command", fmt.Sprintf("DELE %s", remotePath))
		err := c.conn.Delete(remotePath)
		if err != nil {
			c.log("error", fmt.Sprintf("Dosya silinemedi: %v", err))
			return err
		}
	}

	c.log("success", fmt.Sprintf("Silindi: %s", remotePath))
	return nil
}

// Rename renames or moves a remote file or folder
func (c *FTPClient) Rename(oldPath, newPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("RNFR %s -> RNTO %s", oldPath, newPath))
	err := c.conn.Rename(oldPath, newPath)
	if err != nil {
		c.log("error", fmt.Sprintf("Yeniden adlandırılamadı: %v", err))
		return err
	}

	c.log("success", fmt.Sprintf("Yeniden adlandırıldı: %s -> %s", oldPath, newPath))
	return nil
}

// Mkdir creates a new directory on the remote server
func (c *FTPClient) Mkdir(remotePath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("MKD %s", remotePath))
	err := c.conn.MakeDir(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Klasör oluşturulamadı: %v", err))
		return err
	}

	c.log("success", fmt.Sprintf("Klasör oluşturuldu: %s", remotePath))
	return nil
}

// Chmod attempts to change permissions on FTP server
func (c *FTPClient) Chmod(remotePath string, modeStr string, recursive bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("info", fmt.Sprintf("CHMOD %s %s (Standart FTP protokolünde CHMOD sunucu yapılandırmasına bağlıdır)", modeStr, remotePath))
	return nil
}

// ReadFile reads the entire content of a remote file
func (c *FTPClient) ReadFile(remotePath string) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil, fmt.Errorf("sunucuya bağlı değil")
	}

	resp, err := c.conn.Retr(remotePath)
	if err != nil {
		return nil, err
	}
	defer resp.Close()

	return io.ReadAll(resp)
}

// WriteFile writes data to a remote file
func (c *FTPClient) WriteFile(remotePath string, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	reader := bytes.NewReader(data)
	return c.conn.Stor(remotePath, reader)
}

