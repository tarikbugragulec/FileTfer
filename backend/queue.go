package backend

import (
	"fmt"
	"path"
	"path/filepath"
	"sync"
	"time"
)

// QueueManager manages background file uploads and downloads
type QueueManager struct {
	tasks      []*TransferTask
	taskMap    map[string]*TransferTask
	taskChan   chan *TransferTask
	clientFunc func() RemoteClient
	onUpdate   func(tasks []*TransferTask)
	onLog      func(msgType, text string)
	mu         sync.RWMutex
	workerOnce sync.Once
}

// NewQueueManager creates a new queue manager
func NewQueueManager(clientFunc func() RemoteClient, onUpdate func(tasks []*TransferTask), onLog func(msgType, text string)) *QueueManager {
	qm := &QueueManager{
		tasks:      make([]*TransferTask, 0),
		taskMap:    make(map[string]*TransferTask),
		taskChan:   make(chan *TransferTask, 1000),
		clientFunc: clientFunc,
		onUpdate:   onUpdate,
		onLog:      onLog,
	}
	qm.startWorkers(4) // 4 parallel worker goroutines for high performance
	return qm
}

func (qm *QueueManager) startWorkers(workerCount int) {
	qm.workerOnce.Do(func() {
		for i := 0; i < workerCount; i++ {
			go qm.worker()
		}
	})
}

func (qm *QueueManager) worker() {
	for task := range qm.taskChan {
		qm.mu.Lock()
		if task.Status == "cancelled" {
			qm.mu.Unlock()
			continue
		}
		task.Status = "active"
		task.StartedAt = time.Now()
		qm.mu.Unlock()
		qm.notify()

		client := qm.clientFunc()
		if client == nil || !client.IsConnected() {
			qm.mu.Lock()
			task.Status = "failed"
			task.ErrorMsg = "Aktarım başlatılamadı: sunucu bağlantısı yok"
			qm.mu.Unlock()
			qm.notify()
			continue
		}

		lastUpdate := time.Now()
		lastBytes := int64(0)

		progressCallback := func(transferred, total int64) {
			now := time.Now()
			// Update stats at most every 120ms or on completion
			if now.Sub(lastUpdate) >= 120*time.Millisecond || (total > 0 && transferred >= total) {
				deltaSec := now.Sub(lastUpdate).Seconds()
				deltaBytes := transferred - lastBytes

				speedStr := ""
				if deltaSec > 0 && deltaBytes > 0 {
					speedBytesPerSec := float64(deltaBytes) / deltaSec
					speedStr = fmt.Sprintf("%s/s", FormatHumanSize(int64(speedBytesPerSec), false))
				}

				qm.mu.Lock()
				task.Transferred = transferred
				if total > 0 {
					task.Size = total
					task.Percentage = (float64(transferred) / float64(total)) * 100.0
					if task.Percentage > 100.0 {
						task.Percentage = 100.0
					}
				}
				if speedStr != "" {
					task.Speed = speedStr
				}
				qm.mu.Unlock()

				lastUpdate = now
				lastBytes = transferred
				qm.notify()
			}
		}

		var err error
		if task.Direction == "upload" {
			err = client.Upload(task.LocalPath, task.RemotePath, progressCallback)
		} else {
			err = client.Download(task.RemotePath, task.LocalPath, progressCallback)
		}

		qm.mu.Lock()
		if err != nil {
			task.Status = "failed"
			task.ErrorMsg = err.Error()
			task.Speed = "0 B/s"
			if qm.onLog != nil {
				qm.onLog("error", fmt.Sprintf("Aktarım başarısız (%s): %v", task.Name, err))
			}
		} else {
			task.Status = "completed"
			task.Percentage = 100.0
			task.Transferred = task.Size
			task.Speed = "Tamamlandı"
			if qm.onLog != nil {
				qm.onLog("success", fmt.Sprintf("Aktarım tamamlandı: %s", task.Name))
			}
		}
		qm.mu.Unlock()
		qm.notify()
	}
}

// AddUpload adds an upload task to the queue
func (qm *QueueManager) AddUpload(localPath, remoteDir string, size int64) string {
	fileName := filepath.Base(localPath)
	remotePath := path.Join(remoteDir, fileName)
	id := fmt.Sprintf("up_%d_%s", time.Now().UnixNano(), fileName)

	task := &TransferTask{
		ID:         id,
		Name:       fileName,
		Direction:  "upload",
		LocalPath:  localPath,
		RemotePath: remotePath,
		Size:       size,
		Status:     "queued",
		Speed:      "Bekliyor...",
	}

	qm.mu.Lock()
	qm.tasks = append(qm.tasks, task)
	qm.taskMap[id] = task
	qm.mu.Unlock()

	qm.notify()
	qm.taskChan <- task
	return id
}

// AddDownload adds a download task to the queue
func (qm *QueueManager) AddDownload(remotePath, localDir string, size int64) string {
	fileName := path.Base(remotePath)
	localPath := filepath.Join(localDir, fileName)
	id := fmt.Sprintf("down_%d_%s", time.Now().UnixNano(), fileName)

	task := &TransferTask{
		ID:         id,
		Name:       fileName,
		Direction:  "download",
		LocalPath:  localPath,
		RemotePath: remotePath,
		Size:       size,
		Status:     "queued",
		Speed:      "Bekliyor...",
	}

	qm.mu.Lock()
	qm.tasks = append(qm.tasks, task)
	qm.taskMap[id] = task
	qm.mu.Unlock()

	qm.notify()
	qm.taskChan <- task
	return id
}

// CancelTask marks a task as cancelled
func (qm *QueueManager) CancelTask(id string) {
	qm.mu.Lock()
	if task, exists := qm.taskMap[id]; exists {
		if task.Status == "queued" || task.Status == "active" {
			task.Status = "cancelled"
			task.Speed = "İptal edildi"
		}
	}
	qm.mu.Unlock()
	qm.notify()
}

// ClearFinished removes completed, failed or cancelled tasks
func (qm *QueueManager) ClearFinished() {
	qm.mu.Lock()
	var newTasks []*TransferTask
	for _, t := range qm.tasks {
		if t.Status == "queued" || t.Status == "active" {
			newTasks = append(newTasks, t)
		} else {
			delete(qm.taskMap, t.ID)
		}
	}
	qm.tasks = newTasks
	qm.mu.Unlock()
	qm.notify()
}

// GetTasks returns a copy of current tasks
func (qm *QueueManager) GetTasks() []*TransferTask {
	qm.mu.RLock()
	defer qm.mu.RUnlock()
	tasksCopy := make([]*TransferTask, len(qm.tasks))
	copy(tasksCopy, qm.tasks)
	return tasksCopy
}

func (qm *QueueManager) notify() {
	if qm.onUpdate != nil {
		qm.mu.RLock()
		tasksCopy := make([]*TransferTask, len(qm.tasks))
		copy(tasksCopy, qm.tasks)
		qm.mu.RUnlock()
		qm.onUpdate(tasksCopy)
	}
}
