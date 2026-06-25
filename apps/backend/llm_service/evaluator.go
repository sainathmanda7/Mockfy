package llm_service

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// EvaluateInterview reads the Interview_File.json and passes it to Gemini for scoring.
func EvaluateInterview() (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY environment variable is not set")
	}

	// Read the JSON file
	fileBytes, err := os.ReadFile("Interview_File.json")
	if err != nil {
		return "", fmt.Errorf("failed to read Interview_File.json: %v", err)
	}

	systemPrompt := `You are an expert Senior Technical Recruiter and Interview Evaluator.
Your job is to read a transcript of a technical interview (provided as a JSON log) and evaluate the candidate's performance.

You MUST return your evaluation EXACTLY matching this JSON schema:
{
  "score": number, // out of 100
  "feedbackSummary": "string",
  "strengths": ["string"],
  "areasForImprovement": ["string"]
}

Base your score heavily on the candidate's technical accuracy, communication clarity, and depth of explanation.`

	userPrompt := fmt.Sprintf("INTERVIEW TRANSCRIPT:\n%s", string(fileBytes))

	reqBody := map[string]interface{}{
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": systemPrompt},
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
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %v", err)
	}

	// Try Method 1
	body, err := tryGeminiRequest(jsonBytes, apiKey, "header")
	if err == nil {
		return extractTextFromResponse(body)
	}

	// Try Method 2
	body, err = tryGeminiRequest(jsonBytes, apiKey, "query")
	if err == nil {
		return extractTextFromResponse(body)
	}

	return "", fmt.Errorf("failed to evaluate interview via Gemini API: %v", err)
}
