package backend

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// SFTPClient implements RemoteClient for SSH File Transfer Protocol (SFTP)
type SFTPClient struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	cfg        ConnectionConfig
	connected  bool
	logFn      func(msgType, text string)
	mu         sync.Mutex
}

// NewSFTPClient creates a new SFTP client instance
func NewSFTPClient() *SFTPClient {
	return &SFTPClient{}
}

func (c *SFTPClient) log(msgType, text string) {
	if c.logFn != nil {
		c.logFn(msgType, text)
	}
}

// Connect establishes an SSH & SFTP connection
func (c *SFTPClient) Connect(cfg ConnectionConfig, logFn func(msgType, text string)) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cfg = cfg
	c.logFn = logFn

	timeout := time.Duration(cfg.Timeout) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	port := cfg.Port
	if port == 0 {
		port = 22
	}
	addr := fmt.Sprintf("%s:%d", cfg.Host, port)

	c.log("info", fmt.Sprintf("SSH sunucusuna bağlanılıyor: %s (Port %d)...", cfg.Host, port))

	var authMethods []ssh.AuthMethod
	if cfg.Password != "" {
		authMethods = append(authMethods, ssh.Password(cfg.Password))
	}

	if cfg.KeyPath != "" {
		keyBytes, err := os.ReadFile(cfg.KeyPath)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(keyBytes)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			} else {
				c.log("error", fmt.Sprintf("Özel anahtar çözümlenemedi: %v", err))
			}
		}
	}

	if len(authMethods) == 0 {
		authMethods = append(authMethods, ssh.Password(""))
	}

	username := cfg.Username
	if username == "" {
		username = "root"
	}

	sshConfig := &ssh.ClientConfig{
		User:            username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Standard for desktop SFTP clients unless strict mode enabled
		Timeout:         timeout,
	}

	c.log("command", fmt.Sprintf("SSH el sıkışması ve kimlik doğrulama: %s", username))
	sshConn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		c.log("error", fmt.Sprintf("SSH bağlantısı kurulamadı: %v", err))
		return fmt.Errorf("SFTP bağlantı hatası: %w", err)
	}
	c.sshClient = sshConn

	c.log("info", "SFTP alt sistemi (subsystem) başlatılıyor...")
	sftpClient, err := sftp.NewClient(sshConn)
	if err != nil {
		sshConn.Close()
		c.sshClient = nil
		c.log("error", fmt.Sprintf("SFTP başlatılamadı: %v", err))
		return fmt.Errorf("SFTP alt sistem hatası: %w", err)
	}
	c.sftpClient = sftpClient

	c.connected = true
	c.log("success", "SFTP oturumu başarıyla açıldı!")

	wd, err := c.sftpClient.Getwd()
	if err == nil {
		c.log("info", fmt.Sprintf("Varsayılan SFTP dizini: %s", wd))
	}

	return nil
}

// Disconnect terminates the SFTP and SSH connections
func (c *SFTPClient) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.sftpClient != nil {
		_ = c.sftpClient.Close()
		c.sftpClient = nil
	}
	if c.sshClient != nil {
		_ = c.sshClient.Close()
		c.sshClient = nil
	}
	c.connected = false
	c.log("info", "SFTP bağlantısı sonlandırıldı.")
	return nil
}

// IsConnected returns connection status
func (c *SFTPClient) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected && c.sftpClient != nil
}

// GetProtocol returns active protocol
func (c *SFTPClient) GetProtocol() string {
	return "SFTP"
}

// GetCurrentDir returns current working directory
func (c *SFTPClient) GetCurrentDir() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return "", fmt.Errorf("sunucuya bağlı değil")
	}

	wd, err := c.sftpClient.Getwd()
	if err != nil || wd == "" {
		return "/", nil
	}
	return wd, nil
}

// List retrieves file and folder list for a remote path
func (c *SFTPClient) List(remotePath string) ([]FileItem, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return nil, fmt.Errorf("sunucuya bağlı değil")
	}

	if remotePath == "" {
		remotePath = "/"
	}

	c.log("command", fmt.Sprintf("sftp> ls -la %s", remotePath))
	entries, err := c.sftpClient.ReadDir(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Dizin okunamadı: %v", err))
		return nil, fmt.Errorf("SFTP listeleme hatası: %w", err)
	}

	var items []FileItem

	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." {
			continue
		}

		isDir := entry.IsDir()
		fullPath := path.Join(remotePath, name)
		size := entry.Size()

		items = append(items, FileItem{
			Name:        name,
			Path:        fullPath,
			Size:        size,
			HumanSize:   FormatHumanSize(size, isDir),
			IsDir:       isDir,
			ModTime:     entry.ModTime().Format("2006-01-02 15:04"),
			Permissions: entry.Mode().String(),
			Ext:         ExtractExt(name),
		})
	}

	// Sort folders first, then alphabetical
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	c.log("response", fmt.Sprintf("%d dosya/klasör listelendi.", len(items)))
	return items, nil
}

// Upload uploads a local file via SFTP
func (c *SFTPClient) Upload(localPath, remotePath string, onProgress ProgressCallback) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("yerel dosya açılamadı: %w", err)
	}
	defer localFile.Close()

	fi, err := localFile.Stat()
	if err != nil {
		return err
	}
	totalSize := fi.Size()

	c.log("command", fmt.Sprintf("sftp> put %s -> %s (%s)", filepath.Base(localPath), remotePath, FormatHumanSize(totalSize, false)))

	// Create remote file
	remoteFile, err := c.sftpClient.Create(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Uzak dosya oluşturulamadı: %v", err))
		return fmt.Errorf("SFTP hedef dosya hatası: %w", err)
	}
	defer remoteFile.Close()

	writer := &progressWriter{
		writer:   remoteFile,
		total:    totalSize,
		callback: onProgress,
	}

	buf := make([]byte, 256*1024)
	_, err = io.CopyBuffer(writer, localFile, buf)
	if err != nil {
		c.log("error", fmt.Sprintf("Yükleme sırasında hata: %v", err))
		return fmt.Errorf("SFTP aktarım hatası: %w", err)
	}

	c.log("success", fmt.Sprintf("Dosya yüklendi: %s", path.Base(remotePath)))
	return nil
}

// Download downloads a remote file via SFTP
func (c *SFTPClient) Download(remotePath, localPath string, onProgress ProgressCallback) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("sftp> get %s -> %s", remotePath, filepath.Base(localPath)))

	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Uzak dosya açılamadı: %v", err))
		return fmt.Errorf("SFTP dosya okunamadı: %w", err)
	}
	defer remoteFile.Close()

	fi, err := remoteFile.Stat()
	var totalSize int64 = 0
	if err == nil {
		totalSize = fi.Size()
	}

	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return err
	}

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("yerel hedef dosya oluşturulamadı: %w", err)
	}
	defer localFile.Close()

	writer := &progressWriter{
		writer:   localFile,
		total:    totalSize,
		callback: onProgress,
	}

	buf := make([]byte, 256*1024)
	_, err = io.CopyBuffer(writer, remoteFile, buf)
	if err != nil {
		c.log("error", fmt.Sprintf("İndirme sırasında hata: %v", err))
		return fmt.Errorf("SFTP indirme hatası: %w", err)
	}

	c.log("success", fmt.Sprintf("Dosya başarıyla indirildi: %s", filepath.Base(localPath)))
	return nil
}

// Delete removes a remote file or folder
func (c *SFTPClient) Delete(remotePath string, isDir bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	if isDir {
		c.log("command", fmt.Sprintf("sftp> rmdir %s", remotePath))
		err := c.sftpClient.RemoveDirectory(remotePath)
		if err != nil {
			c.log("error", fmt.Sprintf("Klasör silinemedi: %v", err))
			return err
		}
	} else {
		c.log("command", fmt.Sprintf("sftp> rm %s", remotePath))
		err := c.sftpClient.Remove(remotePath)
		if err != nil {
			c.log("error", fmt.Sprintf("Dosya silinemedi: %v", err))
			return err
		}
	}

	c.log("success", fmt.Sprintf("Silindi: %s", remotePath))
	return nil
}

// Rename renames or moves a remote file or directory
func (c *SFTPClient) Rename(oldPath, newPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("sftp> rename %s -> %s", oldPath, newPath))
	err := c.sftpClient.Rename(oldPath, newPath)
	if err != nil {
		c.log("error", fmt.Sprintf("Yeniden adlandırma hatası: %v", err))
		return err
	}

	c.log("success", fmt.Sprintf("Yeniden adlandırıldı: %s -> %s", oldPath, newPath))
	return nil
}

// Mkdir creates a directory on the remote server
func (c *SFTPClient) Mkdir(remotePath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	c.log("command", fmt.Sprintf("sftp> mkdir %s", remotePath))
	err := c.sftpClient.MkdirAll(remotePath)
	if err != nil {
		c.log("error", fmt.Sprintf("Klasör oluşturulamadı: %v", err))
		return err
	}

	c.log("success", fmt.Sprintf("Klasör oluşturuldu: %s", remotePath))
	return nil
}

// Chmod changes permissions on the remote SFTP server
func (c *SFTPClient) Chmod(remotePath string, modeStr string, recursive bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	var modeVal uint32
	_, err := fmt.Sscanf(modeStr, "%o", &modeVal)
	if err != nil {
		return fmt.Errorf("geçersiz chmod değeri (örn: 0755): %w", err)
	}

	mode := os.FileMode(modeVal)
	c.log("command", fmt.Sprintf("sftp> chmod %s %s (recursive: %v)", modeStr, remotePath, recursive))

	if recursive {
		walker := c.sftpClient.Walk(remotePath)
		for walker.Step() {
			if err := walker.Err(); err != nil {
				continue
			}
			_ = c.sftpClient.Chmod(walker.Path(), mode)
		}
		c.log("success", fmt.Sprintf("İzinler özyinelemeli uygulandı: %s (%s)", remotePath, modeStr))
		return nil
	}

	err = c.sftpClient.Chmod(remotePath, mode)
	if err != nil {
		c.log("error", fmt.Sprintf("CHMOD hatası: %v", err))
		return err
	}
	c.log("success", fmt.Sprintf("İzinler güncellendi: %s (%s)", remotePath, modeStr))
	return nil
}

// ReadFile reads the entire content of a remote file
func (c *SFTPClient) ReadFile(remotePath string) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return nil, fmt.Errorf("sunucuya bağlı değil")
	}

	file, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	return io.ReadAll(file)
}

// WriteFile writes data to a remote file
func (c *SFTPClient) WriteFile(remotePath string, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.sftpClient == nil {
		return fmt.Errorf("sunucuya bağlı değil")
	}

	file, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(data)
	return err
}

