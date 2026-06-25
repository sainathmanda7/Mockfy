package models

type GitHubRepo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Language    string `json:"language"`
	URL         string `json:"html_url"`
	Stars       int    `json:"stargazers_count"`
}