package dkotakfs

import (
	"encoding/json"
	"fmt"
)

// APIError represents an error response from the KotakFS server.
type APIError struct {
	StatusCode int
	Message    string
	Detail     string
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("kotakfs [%d]: %s — %s", e.StatusCode, e.Message, e.Detail)
	}
	return fmt.Sprintf("kotakfs [%d]: %s", e.StatusCode, e.Message)
}

// parseAPIError parses the server's JSON error envelope:
//
//	{"error": {"code": 400, "message": "...", "detail": "..."}}
func parseAPIError(statusCode int, body []byte) *APIError {
	var envelope struct {
		Error struct {
			Message string `json:"message"`
			Detail  string `json:"detail"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &envelope); err == nil && envelope.Error.Message != "" {
		return &APIError{
			StatusCode: statusCode,
			Message:    envelope.Error.Message,
			Detail:     envelope.Error.Detail,
		}
	}
	// Fallback: raw body as message.
	return &APIError{StatusCode: statusCode, Message: string(body)}
}
