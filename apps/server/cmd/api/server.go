package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"tera-router/server/internal/app"
	"tera-router/server/internal/config"
	"tera-router/server/internal/gateway"
	"tera-router/server/internal/middlewares"

	sentryfiber "github.com/gofiber/contrib/v3/sentry"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/gofiber/fiber/v3/middleware/static"
)

func serve(app *app.Application) error {
	// Sentry
	sentryHandler := sentryfiber.New(sentryfiber.Config{
		Repanic:         true,
		WaitForDelivery: true,
		Timeout:         5 * time.Second,
	})

	// Fiber Configuration
	server := fiber.New(fiber.Config{
		// 32 MiB: agent conversations (long tool-call histories, inline
		// base64 screenshots) routinely exceed the dashboard's 2 MiB.
		BodyLimit:    32 * 1024 * 1024,
		IdleTimeout:  time.Minute,
		ReadTimeout:  20 * time.Second,
		WriteTimeout: 3 * time.Minute,
		TrustProxy:   true,
		ErrorHandler: middlewares.ErrorHandler,
	})

	// Middleware
	server.Use(recover.New())
	server.Use(logger.New())
	server.Use(helmet.New())
	server.Use(requestid.New())
	// Compress must never touch inference traffic: buffering an SSE body
	// defeats streaming, and the encoder would delay every chunk.
	server.Use(compress.New(compress.Config{
		Next: func(c fiber.Ctx) bool { return gateway.IsGatewayPath(c.Path()) },
	}))
	server.Use(sentryHandler)

	// CORS
	server.Use(cors.New(cors.Config{
		AllowOrigins: strings.Split(app.Config.App.CORSAllowedOrigins, ","),
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "x-api-key", "anthropic-version"},
		MaxAge:       3600,
	}))

	// Rate Limit: the dashboard is throttled per client IP. Inference traffic
	// is exempt — coding agents legitimately burst from one address, and the
	// gateway applies its own in-flight concurrency limit instead.
	server.Use(middlewares.RateLimit(
		app.Config.App.Env == config.EnvDevelopment,
		gateway.IsGatewayPath,
		app.Config.App.RateLimitExemptIPs,
	))

	server.Use(static.New("./public"))

	// Initial Routes
	gw := routes(server, app) // Create channel to listen for interrupt signals
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		app.Logger.Info("server started on port", "port", app.Config.App.Port)
		listerPort := fmt.Sprintf(":%d", app.Config.App.Port)

		if err := server.Listen(listerPort); err != nil {
			app.Logger.Error("failed to start server", "error", err)
		}
	}()

	// Wait for interrupt signal
	<-c
	app.Logger.Info("Received interrupt signal, shutting down...")

	// Stop server
	if err := server.Shutdown(); err != nil {
		app.Logger.Error("failed to stop server", "error", err)
	}

	// Requests already answered may still be metering asynchronously; wait for
	// those writes so an exit cannot drop the accounting for served traffic.
	gw.Drain()

	return nil
}
