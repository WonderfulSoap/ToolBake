package main

import (
	"fmt"
	"os"
	"ya-tool-craft/internal/core/engine"
)

//	@title			My-Golang-Framework
//	@version		1.0
//	@description	This is a sample server
//	@termsOfService	http://swagger.io/terms/

//	@contact.name	WonderfulSoap
//	@contact.url
//	@contact.email

//	@host		localhost:8080
//	@BasePath	/

// @externalDocs.description	OpenAPI
// @externalDocs.url			https://swagger.io/resources/open-api/
func main() {
	engine := engine.NewEngine()

	// if there is env "SERVERLESS" set to true, it runs in serverless mode

	serverlessMode := os.Getenv("SERVERLESS") == "true"
	fmt.Println("[ENGINE] SERVERLESS MODE:", serverlessMode)
	if !serverlessMode {
		fmt.Println("[ENGINE] Not serverless mode, start to run migration and HTTP server")
		engine.RunDBMigration()
		fmt.Println("[ENGINE] Run Migration over")
		engine.Run()
		return
	} else {
		// todo: serverless mode support
	}
}
