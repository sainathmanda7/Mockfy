package github_extractor

import(
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
	"github.com/sainathmanda7/ai-mock-backend/models"
)

func FetchCandidateRepos(githubURL string )([]models.GitHubRepo,error){
	username := strings.TrimPrefix(githubURL, "https://github.com/")
	username = strings.TrimPrefix(username, "http://github.com/")
	username = strings.TrimPrefix(username, "https://github.com")
	username = strings.TrimPrefix(username, "http://github.com")
	username = strings.TrimSuffix(username, "/")
	if username==""{
		return nil,fmt.Errorf("Invalid Github URL provided")
	}

	apiEndpoint := fmt.Sprintf("https://api.github.com/users/%s/repos?sort=update&per_page=5", username)
	client := &http.Client{Timeout: 10 * time.Second}
	req,err := http.NewRequest("GET",apiEndpoint,nil)
	if err!=nil{
		return nil,err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github API returned status: %d", resp.StatusCode)
	}

	// 4. Unpack the JSON response into your Go struct
	var repos []models.GitHubRepo
	err = json.NewDecoder(resp.Body).Decode(&repos)
	if err != nil {
		return nil, fmt.Errorf("failed to decode github response: %v", err)
	}
	return repos,nil
}