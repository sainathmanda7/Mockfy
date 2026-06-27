package db

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq" 
)

var DB *sql.DB

func InitNeonDB() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open Neon connection:", err)
	}

	err = DB.Ping()
	if err != nil {
		log.Fatal("Failed to ping Neon database:", err)
	}

	log.Println("Connected to Neon Serverless Postgres!")
}