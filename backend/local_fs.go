package backend

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"golang.org/x/sys/windows"
)

// GetDefaultLocalPath returns user's home or current working directory
func GetDefaultLocalPath() string {
	home, err := os.UserHomeDir()
	if err == nil && home != "" {
		return home
	}
	cwd, err := os.Getwd()
	if err == nil && cwd != "" {
		return cwd
	}
	return "C:\\"
}

// GetLocalDrives returns available drive roots on Windows or "/" on Unix
func GetLocalDrives() []string {
	if runtime.GOOS != "windows" {
		return []string{"/"}
	}

	bitmask, err := windows.GetLogicalDrives()
	if err != nil || bitmask == 0 {
		return []string{"C:\\"}
	}

	var drives []string
	for i := 0; i < 26; i++ {
		if (bitmask & (1 << i)) != 0 {
			letter := rune('A' + i)
			if letter == 'A' || letter == 'B' {
				continue // Skip floppy drives
			}
			drives = append(drives, fmt.Sprintf("%c:\\", letter))
		}
	}
	if len(drives) == 0 {
		drives = append(drives, "C:\\")
	}
	return drives
}

// QuickPath represents a standard shortcut directory like Desktop or Downloads
type QuickPath struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// GetQuickPaths returns common directories for easy navigation
func GetQuickPaths() []QuickPath {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return []QuickPath{}
	}

	candidates := []QuickPath{
		{Name: "Ana Dizin", Path: home},
		{Name: "Masaüstü", Path: filepath.Join(home, "Desktop")},
		{Name: "İndirilenler", Path: filepath.Join(home, "Downloads")},
		{Name: "Belgeler", Path: filepath.Join(home, "Documents")},
	}

	var valid []QuickPath
	for _, p := range candidates {
		if _, err := os.Stat(p.Path); err == nil {
			valid = append(valid, p)
		}
	}
	return valid
}

// ListLocal lists files and directories in a local directory
func ListLocal(dirPath string) ([]FileItem, error) {
	if dirPath == "" {
		dirPath = GetDefaultLocalPath()
	}

	cleanPath := filepath.Clean(dirPath)
	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("yerel dizin okunamadı (%s): %w", cleanPath, err)
	}

	var items []FileItem

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue // skip inaccessible file
		}

		name := entry.Name()
		isDir := entry.IsDir()
		fullPath := filepath.Join(cleanPath, name)
		size := info.Size()

		items = append(items, FileItem{
			Name:        name,
			Path:        fullPath,
			Size:        size,
			HumanSize:   FormatHumanSize(size, isDir),
			IsDir:       isDir,
			ModTime:     info.ModTime().Format("2006-01-02 15:04"),
			Permissions: info.Mode().String(),
			Ext:         ExtractExt(name),
		})
	}

	// Sort: directories first, then alphabetical
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir // directories first
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	return items, nil
}

// CreateLocalDir creates a new directory in local filesystem
func CreateLocalDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// DeleteLocal removes a local file or directory
func DeleteLocal(path string, isDir bool) error {
	if isDir {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

// RenameLocal renames or moves a local file/folder
func RenameLocal(oldPath, newPath string) error {
	return os.Rename(oldPath, newPath)
}

// FileExists checks if a local file exists
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// GetFileSize returns the size of local file in bytes
func GetFileSize(path string) (int64, error) {
	fi, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

// TouchLocal ensures file or dir exists
func TouchLocal(path string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	return f.Close()
}

// ReadLocalTextFile reads up to 5MB of a text file
func ReadLocalTextFile(path string) (string, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(bytes) > 5*1024*1024 {
		return string(bytes[:5*1024*1024]), nil
	}
	return string(bytes), nil
}

// WriteLocalTextFile writes string content to a local file
func WriteLocalTextFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

// GetLocalImageBase64 returns image data as base64 data URI
func GetLocalImageBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	ext := strings.ToLower(filepath.Ext(path))
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

