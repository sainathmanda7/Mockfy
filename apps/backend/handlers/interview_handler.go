package handlers

import (
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/sainathmanda7/ai-mock-backend/extract_text_from_pdf"
	"github.com/sainathmanda7/ai-mock-backend/github_extractor"
	"github.com/sainathmanda7/ai-mock-backend/llm_service"
)

func StartInterviewHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in StartInterviewHandler: %v", r)
			http.Error(w, "Internal Server Error (Panic)", http.StatusInternalServerError)
		}
	}()

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		log.Printf("Failed to parse multipart form: %v", err)
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	githubURL := r.FormValue("github_url")
	file, fileHeader, err := r.FormFile("resume")
	if err != nil {
		log.Printf("Missing resume file in request: %v", err)
		http.Error(w, "Failed to retrieve resume from request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Failed to read uploaded file %s: %v", fileHeader.Filename, err)
		http.Error(w, "Failed to read file bytes", http.StatusInternalServerError)
		return
	}

	rawResumeText, err := extract_text_from_pdf.ExtractText(fileBytes, fileHeader.Size)
	if err != nil {
		log.Printf("PDF parsing failed for %s: %v", fileHeader.Filename, err)
		http.Error(w, "Failed to parse PDF text", http.StatusInternalServerError)
		return
	}

	repos, err := github_extractor.FetchCandidateRepos(githubURL)
	if err != nil {
		log.Printf("Failed to fetch GitHub repos for %s: %v (continuing without repo context)", githubURL, err)
	}

	cleanJSONString, err := llm_service.FormatCandidateProfile(rawResumeText, repos)
	if err != nil {
		log.Printf("LLM formatting failed: %v", err)
		http.Error(w, "Failed to generate candidate profile", http.StatusInternalServerError)
		return
	}

	log.Printf("Successfully generated candidate profile for %s", githubURL)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(cleanJSONString))
}

func cleanWhitespace(input string) string {
	return strings.Join(strings.Fields(input), " ")
}