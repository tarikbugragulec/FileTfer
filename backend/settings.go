package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// SettingsManager manages user application settings
type SettingsManager struct {
	filePath string
	mu       sync.Mutex
	settings AppSettings
}

// NewSettingsManager creates a new settings manager
func NewSettingsManager() *SettingsManager {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = "."
	}
	appDir := filepath.Join(dir, "FileTfer")
	_ = os.MkdirAll(appDir, 0755)

	sm := &SettingsManager{
		filePath: filepath.Join(appDir, "settings.json"),
		settings: DefaultAppSettings(),
	}

	// Load existing settings if any
	if data, err := os.ReadFile(sm.filePath); err == nil {
		_ = json.Unmarshal(data, &sm.settings)
	} else {
		// Save defaults
		_ = sm.SaveSettings(sm.settings)
	}

	return sm
}

// GetSettings returns current application settings
func (sm *SettingsManager) GetSettings() AppSettings {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.settings
}

// SaveSettings updates and persists application settings
func (sm *SettingsManager) SaveSettings(settings AppSettings) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if settings.MaxWorkers <= 0 {
		settings.MaxWorkers = 4
	}
	if settings.MaxWorkers > 10 {
		settings.MaxWorkers = 10
	}
	if settings.DefaultTimeoutSec <= 0 {
		settings.DefaultTimeoutSec = 15
	}

	sm.settings = settings
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(sm.filePath, data, 0644)
}
