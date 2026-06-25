package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"github.com/sainathmanda7/ai-mock-backend/handlers"
)

func main() {
	if err := godotenv.Overload(".env.local"); err != nil {
		log.Println("Note: .env.local not found, relying on system environment variables")
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/start-interview", handlers.StartInterviewHandler)
	mux.HandleFunc("/api/chat", handlers.LiveChatHandler)
	mux.HandleFunc("/api/evaluate-interview", handlers.EvaluateInterviewHandler)

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