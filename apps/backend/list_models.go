package main

import (
	"context"
	"fmt"
	"os"

	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

func main() {
	godotenv.Load(".env.local")
	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
	if err != nil {
		fmt.Println("Error creating client:", err)
		return
	}
	defer client.Close()

	models := client.ListModels(ctx)
	fmt.Println("--- SUPPORTED LIVE API MODELS ---")
	for {
		m, iterErr := models.Next()
		if iterErr != nil {
			break
		}
		for _, method := range m.SupportedGenerationMethods {
			if method == "bidiGenerateContent" {
				fmt.Println("✅", m.Name)
			}
		}
	}
	fmt.Println("---------------------------------")
}
