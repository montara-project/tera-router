package handlers

import "tera-router/server/internal/app"

type Handlers struct {
	Health *healthHandler
}

func New(app *app.Application) *Handlers {
	return &Handlers{
		Health: &healthHandler{app: app},
	}
}
