package backend

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

// ConnectionConfig holds connection parameters
type ConnectionConfig struct {
	Protocol    string `json:"protocol"` // "ftp", "ftps", "sftp"
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	KeyPath     string `json:"keyPath"`
	PassiveMode bool   `json:"passiveMode"`
	Timeout     int    `json:"timeout"` // in seconds
}

// FileItem represents a file or folder (local or remote)
type FileItem struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	HumanSize   string `json:"humanSize"`
	IsDir       bool   `json:"isDir"`
	ModTime     string `json:"modTime"`
	Permissions string `json:"permissions"`
	Ext         string `json:"ext"`
}

// FormatHumanSize formats bytes into human-readable B, KB, MB, GB
func FormatHumanSize(bytes int64, isDir bool) string {
	if isDir {
		return "<DIR>"
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// TransferTask represents a file transfer item in the queue
type TransferTask struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Direction   string  `json:"direction"` // "upload" or "download"
	LocalPath   string  `json:"localPath"`
	RemotePath  string  `json:"remotePath"`
	Size        int64   `json:"size"`
	Transferred int64   `json:"transferred"`
	Percentage  float64 `json:"percentage"`
	Speed       string  `json:"speed"`
	Status      string  `json:"status"` // "queued", "active", "completed", "failed", "cancelled"
	ErrorMsg    string  `json:"errorMsg"`
	StartedAt   time.Time
}

// LogMessage represents a line in the FileZilla-style console log
type LogMessage struct {
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"` // "info", "command", "response", "error", "success"
	Text      string `json:"text"`
}

// SiteProfile represents a saved connection in Site Manager
type SiteProfile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Protocol string `json:"protocol"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// ExtractExt returns the lowercase file extension without dot
func ExtractExt(filename string) string {
	ext := filepath.Ext(filename)
	return strings.ToLower(strings.TrimPrefix(ext, "."))
}

// AppSettings holds user preferences
type AppSettings struct {
	MaxWorkers        int      `json:"maxWorkers"`
	FilterHiddenFiles bool     `json:"filterHiddenFiles"`
	FilterDevFiles    bool     `json:"filterDevFiles"`
	DevFilterPatterns []string `json:"devFilterPatterns"`
	SyncBrowsing      bool     `json:"syncBrowsing"`
	DefaultTimeoutSec int      `json:"defaultTimeoutSec"`
}

// DefaultAppSettings returns default settings
func DefaultAppSettings() AppSettings {
	return AppSettings{
		MaxWorkers:        4,
		FilterHiddenFiles: false,
		FilterDevFiles:    false,
		DevFilterPatterns: []string{"node_modules", ".git", ".DS_Store", "Thumbs.db", ".venv", "__pycache__", ".idea", ".vscode"},
		SyncBrowsing:      false,
		DefaultTimeoutSec: 15,
	}
}

