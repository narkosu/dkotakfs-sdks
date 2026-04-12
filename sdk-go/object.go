package dkotakfs

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
)

func (c *Client) Upload(bucket, filename string, file io.Reader) (*UploadResponse, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, err
	}

	_ = writer.WriteField("bucket", bucket)
	writer.Close()

	req, err := http.NewRequest("POST", c.BaseURL+"/api/v1/objects", body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, &APIError{StatusCode: resp.StatusCode, Message: string(respBody)}
	}

	var result UploadResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	return &result, err
}

func (c *Client) GetURL(bucket, filename string) string {
	return c.BaseURL + "/api/v1/objects?bucket=" + bucket + "&filename=" + filename
}

func (c *Client) Delete(bucket, filename string) error {
	req, _ := http.NewRequest("DELETE",
		c.BaseURL+"/api/v1/objects?bucket="+bucket+"&filename="+filename,
		nil,
	)

	req.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return &APIError{StatusCode: resp.StatusCode, Message: "delete failed"}
	}

	return nil
}

func (c *Client) List(bucket string) (*ListResponse, error) {
	req, _ := http.NewRequest("GET",
		c.BaseURL+"/api/v1/objects/list?bucket="+bucket,
		nil,
	)

	req.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ListResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	return &result, err
}
