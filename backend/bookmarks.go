package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// BookmarkManager handles saving and loading site manager profiles
type BookmarkManager struct {
	filePath string
	mu       sync.Mutex
}

// NewBookmarkManager creates a new bookmark manager
func NewBookmarkManager() *BookmarkManager {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = "."
	}
	appDir := filepath.Join(dir, "FileTfer")
	_ = os.MkdirAll(appDir, 0755)

	bm := &BookmarkManager{
		filePath: filepath.Join(appDir, "sites.json"),
	}

	if _, err := os.Stat(bm.filePath); os.IsNotExist(err) {
		defaultSites := []SiteProfile{
			{
				ID:       "dlptest-public",
				Name:     "DLP Test Sunucusu (Genel Test)",
				Host:     "ftp.dlptest.com",
				Port:     21,
				Protocol: "ftps",
				Username: "dlpuser",
				Password: "xc8IycnK7MvzRBWRR7272j1lr",
			},
		}
		data, _ := json.MarshalIndent(defaultSites, "", "  ")
		_ = os.WriteFile(bm.filePath, data, 0644)
	}

	return bm
}

// GetSites returns all saved sites
func (bm *BookmarkManager) GetSites() ([]SiteProfile, error) {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	data, err := os.ReadFile(bm.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []SiteProfile{}, nil
		}
		return nil, err
	}

	var sites []SiteProfile
	if err := json.Unmarshal(data, &sites); err != nil {
		return []SiteProfile{}, nil
	}
	return sites, nil
}

// SaveSite adds or updates a site profile
func (bm *BookmarkManager) SaveSite(site SiteProfile) error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	var sites []SiteProfile
	data, err := os.ReadFile(bm.filePath)
	if err == nil {
		_ = json.Unmarshal(data, &sites)
	}

	updated := false
	for i, s := range sites {
		if s.ID == site.ID {
			sites[i] = site
			updated = true
			break
		}
	}
	if !updated {
		sites = append(sites, site)
	}

	bytes, err := json.MarshalIndent(sites, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(bm.filePath, bytes, 0644)
}

// DeleteSite removes a site profile by ID
func (bm *BookmarkManager) DeleteSite(id string) error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	var sites []SiteProfile
	data, err := os.ReadFile(bm.filePath)
	if err != nil {
		return nil
	}
	_ = json.Unmarshal(data, &sites)

	var filtered []SiteProfile
	for _, s := range sites {
		if s.ID != id {
			filtered = append(filtered, s)
		}
	}

	bytes, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(bm.filePath, bytes, 0644)
}
