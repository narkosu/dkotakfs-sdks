package dkotakfs

type UploadResponse struct {
	Filename string `json:"filename"`
	Bucket   string `json:"bucket"`
}

type ListResponse struct {
	Files []string `json:"files"`
}
