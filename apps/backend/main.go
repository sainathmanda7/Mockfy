package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"github.com/sainathmanda7/ai-mock-backend/db"
	"github.com/sainathmanda7/ai-mock-backend/handlers"
)

func main() {
	if err := godotenv.Overload(".env.local"); err != nil {
		log.Println("Note: .env.local not found, relying on system environment variables")
	}

	db.InitNeonDB()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/start-interview", handlers.StartInterviewHandler)
	mux.HandleFunc("/api/chat", handlers.LiveChatHandler)
	mux.HandleFunc("/api/evaluate-interview", handlers.EvaluateInterviewHandler)

	// Endpoint to list all past interviews
	mux.HandleFunc("/api/interviews", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS for your React frontend
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Query Neon for the history, sorting by newest first
		rows, err := db.DB.Query("SELECT id, candidate_name, created_at, profile_data FROM interviews ORDER BY created_at DESC")
		if err != nil {
			log.Println("Failed to query interviews:", err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type InterviewRecord struct {
			ID            int             `json:"id"`
			CandidateName string          `json:"candidate_name"`
			CreatedAt     string          `json:"created_at"`
			ProfileData   json.RawMessage `json:"profile_data"` // json.RawMessage preserves the raw JSON structure
		}

		var history []InterviewRecord
		for rows.Next() {
			var record InterviewRecord
			var createdAtTime interface{} // To safely handle timestamp parsing
			
			err := rows.Scan(&record.ID, &record.CandidateName, &createdAtTime, &record.ProfileData)
			if err != nil {
				log.Println("Error scanning row:", err)
				continue
			}
			
			record.CreatedAt = fmt.Sprintf("%v", createdAtTime)
			history = append(history, record)
		}

		// Return empty array instead of null if table is empty
		if history == nil {
			history = []InterviewRecord{}
		}

		json.NewEncoder(w).Encode(history)
	})

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type", "Accept"},
	})

	handler := c.Handler(mux)

	log.Println("Server listening on port 8080...")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server crashed: %v", err)
	}
}