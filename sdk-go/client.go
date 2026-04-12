package dkotakfs

import (
	"net/http"
	"time"
)

type Client struct {
	BaseURL string
	Token   string
	client  *http.Client
}

func New(baseURL, token string) *Client {
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}
