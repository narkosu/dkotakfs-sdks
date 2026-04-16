package dkotakfs

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
)

// Upload uploads a file to the given bucket.
// filename is the name the file will be stored under.
// content is read exactly once; wrap a []byte in bytes.NewReader if needed.
//
// Uses: POST /api/v1/objects
func (c *Client) Upload(ctx context.Context, bucket, filename string, content io.Reader) (*UploadResponse, error) {
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)

	part, err := mw.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err = io.Copy(part, content); err != nil {
		return nil, err
	}
	_ = mw.WriteField("filename", filename)
	_ = mw.WriteField("bucket", bucket)
	mw.Close()

	resp, err := c.do(ctx, http.MethodPost, "/api/v1/objects", &body, mw.FormDataContentType())
	if err != nil {
		return nil, err
	}
	var result UploadResponse
	return &result, decodeJSON(resp, &result)
}

// Download fetches a file and returns its content as an io.ReadCloser.
// The caller must close the returned reader.
// Response headers (Content-Type, Content-Length, X-Checksum-SHA256) are
// available on the returned http.Response via the second return value.
//
// Uses: GET /api/v1/objects
func (c *Client) Download(ctx context.Context, bucket, filename string) (io.ReadCloser, *http.Response, error) {
	q := url.Values{"bucket": {bucket}, "filename": {filename}}
	resp, err := c.do(ctx, http.MethodGet, "/api/v1/objects?"+q.Encode(), nil, "")
	if err != nil {
		return nil, nil, err
	}
	return resp.Body, resp, nil
}

// Delete removes a file from a bucket.
//
// Uses: DELETE /api/v1/objects
func (c *Client) Delete(ctx context.Context, bucket, filename string) error {
	q := url.Values{"bucket": {bucket}, "filename": {filename}}
	resp, err := c.do(ctx, http.MethodDelete, "/api/v1/objects?"+q.Encode(), nil, "")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// List returns all files in a bucket.
//
// Uses: GET /api/v1/objects/list
func (c *Client) List(ctx context.Context, bucket string) (*ListResponse, error) {
	q := url.Values{"bucket": {bucket}}
	resp, err := c.do(ctx, http.MethodGet, "/api/v1/objects/list?"+q.Encode(), nil, "")
	if err != nil {
		return nil, err
	}
	var result ListResponse
	return &result, decodeJSON(resp, &result)
}

// Rename renames a file within a bucket.
//
// Uses: PUT /api/v1/objects/rename
func (c *Client) Rename(ctx context.Context, bucket, oldName, newName string) error {
	q := url.Values{"bucket": {bucket}, "old_name": {oldName}, "new_name": {newName}}
	resp, err := c.do(ctx, http.MethodPut, "/api/v1/objects/rename?"+q.Encode(), nil, "")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Quota returns storage usage for the authenticated user.
//
// Uses: GET /api/v1/quota
func (c *Client) Quota(ctx context.Context) (*QuotaInfo, error) {
	resp, err := c.do(ctx, http.MethodGet, "/api/v1/quota", nil, "")
	if err != nil {
		return nil, err
	}
	var result QuotaInfo
	return &result, decodeJSON(resp, &result)
}

// CreateFolder creates a virtual folder inside a bucket.
//
// Uses: POST /api/v1/folders
func (c *Client) CreateFolder(ctx context.Context, bucket, folder string) error {
	q := url.Values{"bucket": {bucket}, "folder": {folder}}
	resp, err := c.do(ctx, http.MethodPost, "/api/v1/folders?"+q.Encode(), nil, "")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// DeleteFolder removes a virtual folder and all its contents from a bucket.
//
// Uses: DELETE /api/v1/folders
func (c *Client) DeleteFolder(ctx context.Context, bucket, folder string) error {
	q := url.Values{"bucket": {bucket}, "folder": {folder}}
	resp, err := c.do(ctx, http.MethodDelete, "/api/v1/folders?"+q.Encode(), nil, "")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Autocomplete returns file name suggestions matching prefix.
//
// Uses: GET /api/v1/autocomplete
func (c *Client) Autocomplete(ctx context.Context, prefix string) ([]string, error) {
	q := url.Values{"prefix": {prefix}}
	resp, err := c.do(ctx, http.MethodGet, "/api/v1/autocomplete?"+q.Encode(), nil, "")
	if err != nil {
		return nil, err
	}
	var result []string
	return result, decodeJSON(resp, &result)
}
