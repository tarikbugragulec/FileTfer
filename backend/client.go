package backend

// ProgressCallback is called as bytes are transferred
type ProgressCallback func(transferred, total int64)

// RemoteClient represents an active FTP, FTPS, or SFTP connection
type RemoteClient interface {
	Connect(cfg ConnectionConfig, logFn func(msgType, text string)) error
	Disconnect() error
	IsConnected() bool
	GetProtocol() string
	GetCurrentDir() (string, error)
	List(remotePath string) ([]FileItem, error)
	Upload(localPath, remotePath string, onProgress ProgressCallback) error
	Download(remotePath, localPath string, onProgress ProgressCallback) error
	Delete(remotePath string, isDir bool) error
	Rename(oldPath, newPath string) error
	Mkdir(remotePath string) error
	Chmod(remotePath string, mode string, recursive bool) error
	ReadFile(remotePath string) ([]byte, error)
	WriteFile(remotePath string, data []byte) error
}

