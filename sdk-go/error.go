package dkotakfs

import "fmt"

type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("kotakfs error: %d - %s", e.StatusCode, e.Message)
}
