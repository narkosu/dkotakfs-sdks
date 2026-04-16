package dkotakfs

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
)

// CreateAPIKey creates a new API key for the authenticated user.
//
// The returned CreateAPIKeyResponse.Token contains the full key — save it
// immediately, it will never be returned again.
//
// This endpoint requires a JWT (not an API key).
// Uses: POST /api/v1/keys
func (c *Client) CreateAPIKey(ctx context.Context, name string) (*CreateAPIKeyResponse, error) {
	body, _ := json.Marshal(map[string]string{"name": name})
	resp, err := c.do(ctx, http.MethodPost, "/api/v1/keys", bytes.NewReader(body), "application/json")
	if err != nil {
		return nil, err
	}
	var result CreateAPIKeyResponse
	return &result, decodeJSON(resp, &result)
}

// ListAPIKeys returns all active (non-revoked) API keys for the authenticated user.
// The plaintext token is never included; only the key prefix is returned.
//
// This endpoint requires a JWT (not an API key).
// Uses: GET /api/v1/keys
func (c *Client) ListAPIKeys(ctx context.Context) (*ListAPIKeysResponse, error) {
	resp, err := c.do(ctx, http.MethodGet, "/api/v1/keys", nil, "")
	if err != nil {
		return nil, err
	}
	var result ListAPIKeysResponse
	return &result, decodeJSON(resp, &result)
}

// RevokeAPIKey immediately revokes the API key with the given id.
// Only the key's owner can revoke it.
//
// This endpoint requires a JWT (not an API key).
// Uses: DELETE /api/v1/keys/:id
func (c *Client) RevokeAPIKey(ctx context.Context, id string) error {
	resp, err := c.do(ctx, http.MethodDelete, "/api/v1/keys/"+id, nil, "")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
