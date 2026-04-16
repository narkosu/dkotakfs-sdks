package dkotakfs

import "time"

// --- File types ---

// ChunkMeta describes a single stored chunk of a file.
type ChunkMeta struct {
	FID  string `json:"fid"`
	Size int64  `json:"size"`
}

// FileMeta is the full metadata record returned by the server for a stored file.
type FileMeta struct {
	UserID      string      `json:"user_id,omitempty"`
	Bucket      string      `json:"bucket"`
	Name        string      `json:"name"`
	Size        int64       `json:"size"`
	Checksum    string      `json:"checksum"`
	Chunks      []ChunkMeta `json:"chunks"`
	ContentType string      `json:"content_type"`
	CreatedAt   time.Time   `json:"created_at"`
}

// UploadResponse is returned by a successful file upload.
type UploadResponse struct {
	Message  string `json:"message"`
	Filename string `json:"filename"`
	Bucket   string `json:"bucket"`
	Size     int64  `json:"size"`
	Checksum string `json:"checksum"`
	Chunks   int    `json:"chunks"`
}

// ListResponse is returned by the file-listing endpoint.
type ListResponse struct {
	Bucket string     `json:"bucket"`
	Count  int        `json:"count"`
	Files  []FileMeta `json:"files"`
}

// QuotaInfo describes storage usage for the authenticated user.
type QuotaInfo struct {
	TotalQuota     int64 `json:"total_quota"`
	UsedQuota      int64 `json:"used_quota"`
	RemainingQuota int64 `json:"remaining_quota"`
}

// --- Auth types ---

// LoginResponse is returned by /api/v1/auth/login.
type LoginResponse struct {
	Token     string `json:"token"`
	UserID    string `json:"user_id"`
	ExpiresIn int    `json:"expires_in"`
}

// --- API Key types ---

// APIKey represents a stored API key (without the plaintext token).
type APIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// CreateAPIKeyResponse is returned once when a key is first created.
// The Token field contains the full key — it will never be returned again.
type CreateAPIKeyResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	KeyPrefix string    `json:"key_prefix"`
	Token     string    `json:"token"`
	CreatedAt time.Time `json:"created_at"`
}

// ListAPIKeysResponse is returned by the list-keys endpoint.
type ListAPIKeysResponse struct {
	Keys []APIKey `json:"keys"`
}
