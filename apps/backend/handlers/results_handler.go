package handlers

import (
	"fmt"
	"net/http"

	"github.com/sainathmanda7/ai-mock-backend/llm_service"
)

func EvaluateInterviewHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	fmt.Println("Evaluating interview log...")
	evaluationJSON, err := llm_service.EvaluateInterview()
	if err != nil {
		fmt.Println("LLM Error:", err)
		http.Error(w, "Failed to evaluate interview", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(evaluationJSON))
}
