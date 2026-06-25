package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sainathmanda7/ai-mock-backend/audio"
	"github.com/sainathmanda7/ai-mock-backend/prompts"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func saveToInterviewFile(speaker, interviewID, text string) {
	filename := "Interview_File.json"
	
	type Record struct {
		UserID      string `json:"user_id"`
		InterviewID string `json:"interview_id"`
		Speaker     string `json:"speaker"`
		Timestamp   string `json:"timestamp"`
		Text        string `json:"text"`
	}

	record := Record{
		UserID:      "user-1",
		InterviewID: interviewID,
		Speaker:     speaker,
		Timestamp:   time.Now().Format(time.RFC3339),
		Text:        text,
	}

	var records []Record
	if file, err := os.ReadFile(filename); err == nil {
		json.Unmarshal(file, &records)
	}
	
	records = append(records, record)
	if data, err := json.MarshalIndent(records, "", "  "); err == nil {
		os.WriteFile(filename, data, 0644)
	}
}

func transcribeAudio(audioBytes []byte, apiKey string) (string, error) {
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Prepend standard 16-bit PCM WAV header for STT processing
	wavHeader := audio.CreateWAVHeader(uint32(len(audioBytes)), 24000, 1, 16)
	fullWavData := append(wavHeader, audioBytes...)
	b64Audio := base64.StdEncoding.EncodeToString(fullWavData)

	payload := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{
						"inlineData": map[string]interface{}{
							"mimeType": "audio/wav",
							"data":     b64Audio,
						},
					},
					{
						"text": "Transcribe the speech in this audio exactly. Do not add any extra commentary, formatting, or prefixes. If there is no speech, output nothing.",
					},
				},
			},
		},
	}

	payloadBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if c, ok := result["candidates"].([]interface{}); ok && len(c) > 0 {
		if cand, ok := c[0].(map[string]interface{}); ok {
			if content, ok := cand["content"].(map[string]interface{}); ok {
				if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
					if part, ok := parts[0].(map[string]interface{}); ok {
						if text, ok := part["text"].(string); ok {
							return strings.TrimSpace(text), nil
						}
					}
				}
			}
		}
	}
	return "", fmt.Errorf("could not parse transcription")
}

func parseProfile(candidateProfileJSON string) (string, int) {
	var profile map[string]interface{}
	candidateName := "there"
	expectedQuestions := 5

	if err := json.Unmarshal([]byte(candidateProfileJSON), &profile); err == nil {
		if name, ok := profile["candidateName"].(string); ok && strings.TrimSpace(name) != "" {
			candidateName = strings.TrimSpace(name)
		}
		if eq, ok := profile["expectedQuestions"].(float64); ok && eq > 0 {
			expectedQuestions = int(eq)
		}
	}
	return candidateName, expectedQuestions
}

func LiveChatHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket Upgrade Error:", err)
		return
	}
	defer conn.Close()

	log.Println("Frontend connected to Live Chat")

	_, initPayload, err := conn.ReadMessage()
	if err != nil {
		log.Println("Failed to read initial payload:", err)
		return
	}
	candidateProfileJSON := string(initPayload)
	log.Println("Received Candidate Profile Handshake")

	apiKey := os.Getenv("GEMINI_API_KEY")
	geminiWSURL := "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=" + apiKey

	geminiConn, _, err := websocket.DefaultDialer.Dial(geminiWSURL, nil)
	if err != nil {
		log.Println("Failed to connect to Gemini Live API:", err)
		return
	}
	defer geminiConn.Close()

	candidateName, expectedQuestions := parseProfile(candidateProfileJSON)
	systemPrompt := prompts.BuildInterviewerSystemPrompt(expectedQuestions, candidateProfileJSON, candidateName)

	setupMsg := map[string]interface{}{
		"setup": map[string]interface{}{
			"model": "models/gemini-3.1-flash-live-preview",
			"generationConfig": map[string]interface{}{
				"responseModalities": []string{"AUDIO"},
			},
			"systemInstruction": map[string]interface{}{
				"parts": []map[string]interface{}{
					{"text": systemPrompt},
				},
			},
		},
	}

	if err := geminiConn.WriteJSON(setupMsg); err != nil {
		log.Println("Failed to send setup message:", err)
		return
	}

	_, _, err = geminiConn.ReadMessage()
	if err != nil {
		log.Println("Failed to read setup response:", err)
		return
	}
	log.Println("Gemini Setup Complete")

	if err := conn.WriteMessage(websocket.TextMessage, []byte("SYSTEM_READY")); err != nil {
		log.Println("Failed to send SYSTEM_READY:", err)
		return
	}

	triggerMsg := map[string]interface{}{
		"clientContent": map[string]interface{}{
			"turns": []map[string]interface{}{
				{
					"role": "user",
					"parts": []map[string]interface{}{
						{"text": "Hello, I'm ready for the interview. Please introduce yourself and begin."},
					},
				},
			},
			"turnComplete": true,
		},
	}
	if err := geminiConn.WriteJSON(triggerMsg); err != nil {
		log.Println("Failed to send trigger message:", err)
		return
	}
	log.Println("Sent initial trigger to Gemini")

	go func() {
		for {
			messageType, p, err := conn.ReadMessage()
			if err != nil {
				log.Println("React disconnected:", err)
				geminiConn.Close()
				break
			}

			// Intercept custom data from React
			var customMsg map[string]interface{}
			if err := json.Unmarshal(p, &customMsg); err == nil {
				// 1. Extract and save the User Transcript
				if transcript, ok := customMsg["userTranscript"].(string); ok && transcript != "" {
					log.Printf("User Transcript: %s\n", transcript)
					saveToInterviewFile("User", "mock-interview-session", transcript)
					
					// Delete it so Gemini doesn't complain about unknown fields
					delete(customMsg, "userTranscript")
					p, _ = json.Marshal(customMsg)
				}
				
				// 2. Ignore legacy events
				if msgType, ok := customMsg["type"].(string); ok && msgType == "user_transcript" {
					continue 
				}
			}

			if err := geminiConn.WriteMessage(messageType, p); err != nil {
				log.Println("Failed to forward to Gemini:", err)
				break
			}
		}
	}()

	var aiAudioBuffer []byte

	for {
		messageType, p, err := geminiConn.ReadMessage()
		if err != nil {
			log.Println("Gemini disconnected:", err)
			break
		}

		// Inspect the Gemini message
		var msg map[string]interface{}
		if json.Unmarshal(p, &msg) == nil {
			if sc, ok := msg["serverContent"].(map[string]interface{}); ok {
				if mt, ok := sc["modelTurn"].(map[string]interface{}); ok {
					if parts, ok := mt["parts"].([]interface{}); ok && len(parts) > 0 {
						if part, ok := parts[0].(map[string]interface{}); ok {
							if inl, ok := part["inlineData"].(map[string]interface{}); ok {
								if dataStr, ok := inl["data"].(string); ok {
									decoded, err := base64.StdEncoding.DecodeString(dataStr)
									if err == nil {
										aiAudioBuffer = append(aiAudioBuffer, decoded...)
									}
								}
							}
						}
					}
				}
				
				if turnComplete, ok := sc["turnComplete"].(bool); ok && turnComplete {
					if len(aiAudioBuffer) > 0 {
						audioToTranscribe := aiAudioBuffer
						aiAudioBuffer = nil // Reset for next turn
						
						// Run STT asynchronously so it doesn't block Live API
						go func() {
							log.Println("AI finished speaking, transcribing audio...")
							text, err := transcribeAudio(audioToTranscribe, apiKey)
							if err == nil && text != "" {
								log.Printf("AI Transcript: %s\n", text)
								saveToInterviewFile("AI", "mock-interview-session", text)
								
								// Send to React
								resp := map[string]string{"type": "ai_transcript", "text": text}
								respBytes, _ := json.Marshal(resp)
								conn.WriteMessage(websocket.TextMessage, respBytes)
							}
						}()
					}
				}
			}
		}

		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Println("Failed to forward to React:", err)
			break
		}
	}
}