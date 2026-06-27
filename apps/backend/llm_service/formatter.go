package llm_service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/sainathmanda7/ai-mock-backend/models"
	"github.com/sainathmanda7/ai-mock-backend/prompts"
)

// FormatCandidateProfile sends raw data to Gemini and returns strict JSON
func FormatCandidateProfile(rawResume string, githubRepos []models.GitHubRepo) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY environment variable is not set")
	}

	githubContext := "Candidate's Top GitHub Repositories:\n"
	for _, repo := range githubRepos {
		githubContext += fmt.Sprintf("- %s (Language: %s): %s\n", repo.Name, repo.Language, repo.Description)
	}

	userPrompt := fmt.Sprintf("RAW RESUME TEXT:\n%s\n\nGITHUB DATA:\n%s", rawResume, githubContext)

	reqBody := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": prompts.FormatterSystemPrompt},
			},
		},
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": userPrompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"responseMimeType": "application/json",
			"responseSchema": map[string]interface{}{
				"type": "OBJECT",
				"properties": map[string]interface{}{
					"candidateName": map[string]interface{}{"type": "STRING"},
					"summary": map[string]interface{}{"type": "STRING"},
					"skills": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"languages": map[string]interface{}{"type": "ARRAY", "items": map[string]interface{}{"type": "STRING"}},
							"frameworks": map[string]interface{}{"type": "ARRAY", "items": map[string]interface{}{"type": "STRING"}},
							"tools": map[string]interface{}{"type": "ARRAY", "items": map[string]interface{}{"type": "STRING"}},
						},
					},
					"experience": map[string]interface{}{
						"type": "ARRAY",
						"items": map[string]interface{}{
							"type": "OBJECT",
							"properties": map[string]interface{}{
								"company": map[string]interface{}{"type": "STRING"},
								"role": map[string]interface{}{"type": "STRING"},
								"duration": map[string]interface{}{"type": "STRING"},
								"bullets": map[string]interface{}{"type": "ARRAY", "items": map[string]interface{}{"type": "STRING"}},
							},
						},
					},
				},
				"required": []string{"candidateName", "summary", "skills", "experience"},
			},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %v", err)
	}

	// Fallback mechanism to handle differing Gemini API Key generations without excessive logging
	body, err := tryGeminiRequest(jsonBytes, apiKey, "header")
	if err == nil {
		return extractTextFromResponse(body)
	}

	body, err = tryGeminiRequest(jsonBytes, apiKey, "query")
	if err == nil {
		return extractTextFromResponse(body)
	}

	return "", fmt.Errorf("failed to authenticate with Gemini API: %v", err)
}

func tryGeminiRequest(jsonBytes []byte, apiKey string, method string) ([]byte, error) {
	var url string
	if method == "query" {
		url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey
	} else {
		url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	if method == "header" {
		req.Header.Set("x-goog-api-key", apiKey)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http post failed: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return bodyBytes, nil
}

func extractTextFromResponse(body []byte) (string, error) {
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response json: %v", err)
	}

	candidates, ok := result["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return "", fmt.Errorf("no candidates in response")
	}

	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid candidate format")
	}

	content, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no content in candidate")
	}

	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return "", fmt.Errorf("no parts in content")
	}

	firstPart, ok := parts[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid part format")
	}

	text, ok := firstPart["text"].(string)
	if !ok {
		return "", fmt.Errorf("no text string in part")
	}

	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text), nil
}