package main

import (
	"FTPClient/backend"
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type dirCacheItem struct {
	items []backend.FileItem
	time  time.Time
}

// App struct
type App struct {
	ctx           context.Context
	client        backend.RemoteClient
	queueMgr      *backend.QueueManager
	bookmarkMgr   *backend.BookmarkManager
	settingsMgr   *backend.SettingsManager
	currentCfg    backend.ConnectionConfig
	clientMu      sync.RWMutex
	remoteCache   map[string]dirCacheItem
	remoteCacheMu sync.RWMutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	a := &App{
		bookmarkMgr: backend.NewBookmarkManager(),
		settingsMgr: backend.NewSettingsManager(),
		remoteCache: make(map[string]dirCacheItem),
	}
	return a
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize QueueManager with event emitting
	a.queueMgr = backend.NewQueueManager(
		func() backend.RemoteClient {
			a.clientMu.RLock()
			defer a.clientMu.RUnlock()
			return a.client
		},
		func(tasks []*backend.TransferTask) {
			runtime.EventsEmit(a.ctx, "transfer_update", tasks)
		},
		func(msgType, text string) {
			a.EmitLog(msgType, text)
		},
	)

	a.EmitLog("info", "FileTfer İstemcisi hazır.")
}

// EmitLog sends a formatted log message to frontend
func (a *App) EmitLog(msgType, text string) {
	if a.ctx == nil {
		return
	}
	msg := backend.LogMessage{
		Timestamp: time.Now().Format("15:04:05"),
		Type:      msgType,
		Text:      text,
	}
	runtime.EventsEmit(a.ctx, "ftp_log", msg)
}

// Connect starts a new FTP, FTPS, or SFTP session
func (a *App) Connect(cfg backend.ConnectionConfig) error {
	a.clientMu.Lock()

	// Disconnect existing if any
	if a.client != nil && a.client.IsConnected() {
		_ = a.client.Disconnect()
	}

	proto := strings.ToLower(cfg.Protocol)
	if proto == "sftp" {
		a.client = backend.NewSFTPClient()
	} else {
		// default ftp or ftps
		a.client = backend.NewFTPClient()
	}
	a.currentCfg = cfg
	clientRef := a.client
	a.clientMu.Unlock()

	err := clientRef.Connect(cfg, func(msgType, text string) {
		a.EmitLog(msgType, text)
	})

	if err != nil {
		a.clientMu.Lock()
		a.client = nil
		a.clientMu.Unlock()
		return err
	}

	runtime.EventsEmit(a.ctx, "connection_state", map[string]interface{}{
		"connected": true,
		"protocol":  clientRef.GetProtocol(),
		"host":      cfg.Host,
		"username":  cfg.Username,
	})

	return nil
}

// Disconnect closes the current connection
func (a *App) Disconnect() error {
	a.clientMu.Lock()
	defer a.clientMu.Unlock()

	if a.client != nil {
		_ = a.client.Disconnect()
		a.client = nil
	}

	runtime.EventsEmit(a.ctx, "connection_state", map[string]interface{}{
		"connected": false,
	})

	return nil
}

// IsConnected returns whether client is connected
func (a *App) IsConnected() bool {
	a.clientMu.RLock()
	defer a.clientMu.RUnlock()
	return a.client != nil && a.client.IsConnected()
}

// GetConnectionStatus returns connection info
func (a *App) GetConnectionStatus() map[string]interface{} {
	a.clientMu.RLock()
	defer a.clientMu.RUnlock()

	connected := a.client != nil && a.client.IsConnected()
	proto := ""
	currentDir := "/"
	if connected {
		proto = a.client.GetProtocol()
		if dir, err := a.client.GetCurrentDir(); err == nil {
			currentDir = dir
		}
	}

	return map[string]interface{}{
		"connected":  connected,
		"protocol":   proto,
		"host":       a.currentCfg.Host,
		"username":   a.currentCfg.Username,
		"currentDir": currentDir,
	}
}

// ListRemote retrieves remote files (with fast memory cache)
func (a *App) ListRemote(remotePath string) ([]backend.FileItem, error) {
	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return nil, fmt.Errorf("uzak sunucuya bağlı değil")
	}

	// Check cache (TTL 45 seconds)
	a.remoteCacheMu.RLock()
	cached, found := a.remoteCache[remotePath]
	a.remoteCacheMu.RUnlock()

	if found && time.Since(cached.time) < 45*time.Second {
		return cached.items, nil
	}

	items, err := client.List(remotePath)
	if err != nil {
		return nil, err
	}

	a.remoteCacheMu.Lock()
	a.remoteCache[remotePath] = dirCacheItem{
		items: items,
		time:  time.Now(),
	}
	a.remoteCacheMu.Unlock()

	return items, nil
}

// ClearRemoteCache clears the remote directory cache
func (a *App) ClearRemoteCache() {
	a.remoteCacheMu.Lock()
	a.remoteCache = make(map[string]dirCacheItem)
	a.remoteCacheMu.Unlock()
}

// ListLocal retrieves local files
func (a *App) ListLocal(localPath string) ([]backend.FileItem, error) {
	return backend.ListLocal(localPath)
}

// GetLocalDrives returns available local drives
func (a *App) GetLocalDrives() []string {
	return backend.GetLocalDrives()
}

// GetDefaultLocalPath returns initial default local directory
func (a *App) GetDefaultLocalPath() string {
	return backend.GetDefaultLocalPath()
}

// GetQuickPaths returns common directories for easy navigation
func (a *App) GetQuickPaths() []backend.QuickPath {
	return backend.GetQuickPaths()
}

// CreateRemoteDir creates directory on remote
func (a *App) CreateRemoteDir(remotePath string) error {
	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return fmt.Errorf("uzak sunucuya bağlı değil")
	}
	a.ClearRemoteCache()
	return client.Mkdir(remotePath)
}

// CreateLocalDir creates directory on local
func (a *App) CreateLocalDir(localPath string) error {
	return backend.CreateLocalDir(localPath)
}

// DeleteRemote removes remote file or folder
func (a *App) DeleteRemote(remotePath string, isDir bool) error {
	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return fmt.Errorf("uzak sunucuya bağlı değil")
	}
	a.ClearRemoteCache()
	return client.Delete(remotePath, isDir)
}

// DeleteLocal removes local file or folder
func (a *App) DeleteLocal(localPath string, isDir bool) error {
	return backend.DeleteLocal(localPath, isDir)
}

// RenameRemote renames remote file/folder
func (a *App) RenameRemote(oldPath, newPath string) error {
	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return fmt.Errorf("uzak sunucuya bağlı değil")
	}
	a.ClearRemoteCache()
	return client.Rename(oldPath, newPath)
}

// RenameLocal renames local file/folder
func (a *App) RenameLocal(oldPath, newPath string) error {
	return backend.RenameLocal(oldPath, newPath)
}

// QueueUpload adds a file to upload queue
func (a *App) QueueUpload(localPath, remoteDir string, size int64) string {
	if a.queueMgr == nil {
		return ""
	}
	return a.queueMgr.AddUpload(localPath, remoteDir, size)
}

// QueueDownload adds a file to download queue
func (a *App) QueueDownload(remotePath, localDir string, size int64) string {
	if a.queueMgr == nil {
		return ""
	}
	return a.queueMgr.AddDownload(remotePath, localDir, size)
}

// GetTransferTasks returns current transfer queue
func (a *App) GetTransferTasks() []*backend.TransferTask {
	if a.queueMgr == nil {
		return []*backend.TransferTask{}
	}
	return a.queueMgr.GetTasks()
}

// CancelTransfer cancels an ongoing or queued task
func (a *App) CancelTransfer(id string) {
	if a.queueMgr != nil {
		a.queueMgr.CancelTask(id)
	}
}

// ClearFinishedTransfers clears completed tasks
func (a *App) ClearFinishedTransfers() {
	if a.queueMgr != nil {
		a.queueMgr.ClearFinished()
	}
}

// GetSavedSites returns all saved site bookmarks
func (a *App) GetSavedSites() ([]backend.SiteProfile, error) {
	return a.bookmarkMgr.GetSites()
}

// SaveSite saves a new or updated site
func (a *App) SaveSite(site backend.SiteProfile) error {
	return a.bookmarkMgr.SaveSite(site)
}

// DeleteSite removes a saved site
func (a *App) DeleteSite(id string) error {
	return a.bookmarkMgr.DeleteSite(id)
}

// SelectLocalFolderDialog opens a native folder selection dialog
func (a *App) SelectLocalFolderDialog() string {
	res, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Yerel Klasör Seçin",
	})
	if err != nil {
		return ""
	}
	return res
}

// GetFileContent reads text file content for editor
func (a *App) GetFileContent(targetPath string, isRemote bool) (string, error) {
	if !isRemote {
		return backend.ReadLocalTextFile(targetPath)
	}

	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return "", fmt.Errorf("uzak sunucuya bağlı değil")
	}

	data, err := client.ReadFile(targetPath)
	if err != nil {
		return "", err
	}
	if len(data) > 5*1024*1024 {
		return string(data[:5*1024*1024]), nil
	}
	return string(data), nil
}

// SaveFileContent writes edited text back to local or remote file
func (a *App) SaveFileContent(targetPath string, isRemote bool, content string) error {
	if !isRemote {
		return backend.WriteLocalTextFile(targetPath, content)
	}

	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return fmt.Errorf("uzak sunucuya bağlı değil")
	}

	return client.WriteFile(targetPath, []byte(content))
}

// GetImageBase64 reads an image file and returns base64 data URI
func (a *App) GetImageBase64(targetPath string, isRemote bool) (string, error) {
	if !isRemote {
		return backend.GetLocalImageBase64(targetPath)
	}

	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return "", fmt.Errorf("uzak sunucuya bağlı değil")
	}

	data, err := client.ReadFile(targetPath)
	if err != nil {
		return "", err
	}

	ext := strings.ToLower(filepath.Ext(targetPath))
	mimeType := "image/png"
	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".gif":
		mimeType = "image/gif"
	case ".svg":
		mimeType = "image/svg+xml"
	case ".webp":
		mimeType = "image/webp"
	case ".ico":
		mimeType = "image/x-icon"
	}
	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, encoded), nil
}

// Chmod modifies file permissions on remote server
func (a *App) Chmod(remotePath string, mode string, recursive bool) error {
	a.clientMu.RLock()
	client := a.client
	a.clientMu.RUnlock()

	if client == nil || !client.IsConnected() {
		return fmt.Errorf("uzak sunucuya bağlı değil")
	}

	return client.Chmod(remotePath, mode, recursive)
}

// GetSettings returns application settings
func (a *App) GetSettings() backend.AppSettings {
	if a.settingsMgr == nil {
		return backend.DefaultAppSettings()
	}
	return a.settingsMgr.GetSettings()
}

// SaveSettings saves and updates application settings
func (a *App) SaveSettings(settings backend.AppSettings) error {
	if a.settingsMgr == nil {
		return nil
	}
	return a.settingsMgr.SaveSettings(settings)
}

