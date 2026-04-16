// Package dkotakfs provides a Go client for the KotakFS distributed file storage API.
//
// Authenticate with a JWT (from Login) or a long-lived API key (ksk_live_…):
//
//	c := dkotakfs.New("http://localhost:8888", "ksk_live_…")
//	resp, err := c.Upload(ctx, "my-bucket", "hello.txt", content)
package dkotakfs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is a KotakFS API client. It is safe for concurrent use.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// New creates a client with a 60-second default HTTP timeout.
// token may be a JWT (from Login) or an API key (ksk_live_…).
func New(baseURL, token string) *Client {
	return NewWithTimeout(baseURL, token, 60*time.Second)
}

// NewWithTimeout is like New but uses the given HTTP timeout.
func NewWithTimeout(baseURL, token string, timeout time.Duration) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		token:      token,
		httpClient: &http.Client{Timeout: timeout},
	}
}

// Login authenticates with username/password and returns a new Client that
// uses the resulting JWT, plus the LoginResponse so callers can inspect the
// token or expiry.
//
// This is a convenience constructor for interactive / dashboard flows.
// For long-running services prefer API keys created via CreateAPIKey.
func Login(ctx context.Context, baseURL, username, password string) (*Client, *LoginResponse, error) {
	baseURL = strings.TrimRight(baseURL, "/")
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/v1/auth/login",
		bytes.NewReader(body))
	if err != nil {
		return nil, nil, fmt.Errorf("dkotakfs: build login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	hc := &http.Client{Timeout: 30 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("dkotakfs: login request: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, nil, parseAPIError(resp.StatusCode, raw)
	}

	var lr LoginResponse
	if err := json.Unmarshal(raw, &lr); err != nil {
		return nil, nil, fmt.Errorf("dkotakfs: decode login response: %w", err)
	}
	return New(baseURL, lr.Token), &lr, nil
}

// WithToken returns a shallow copy of the client using a different token.
// Useful for switching from a JWT to an API key after creation.
func (c *Client) WithToken(token string) *Client {
	cp := *c
	cp.token = token
	return &cp
}

// ── internal helpers ─────────────────────────────────────────────────────────

// do executes an HTTP request, attaches the Bearer token, and returns the
// response.  The caller is responsible for closing resp.Body on success.
// HTTP 4xx/5xx responses are converted to *APIError.
func (c *Client) do(ctx context.Context, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, fmt.Errorf("dkotakfs: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dkotakfs: %s %s: %w", method, path, err)
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		return nil, parseAPIError(resp.StatusCode, raw)
	}
	return resp, nil
}

// decodeJSON reads and JSON-decodes resp.Body, then closes it.
func decodeJSON(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(v); err != nil {
		return fmt.Errorf("dkotakfs: decode response: %w", err)
	}
	return nil
}
