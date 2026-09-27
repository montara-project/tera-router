package services

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"tera-router/server/internal/models"
	"tera-router/server/internal/repositories"

	"github.com/google/uuid"
)

type ProxyPoolService struct {
	repos *repositories.Repositories
	audit *AuditService
}

func (s *ProxyPoolService) Create(ctx context.Context, actor string, p models.ProxyPool) (models.ProxyPool, error) {
	p.ID = uuid.NewString()
	if p.Status == "" {
		p.Status = "active"
	}
	if err := s.repos.ProxyPools.Create(ctx, p); err != nil {
		return models.ProxyPool{}, err
	}
	s.audit.Record(ctx, actor, "proxy_pool.create", p.ID, map[string]string{"url": p.URL})
	return p, nil
}

func (s *ProxyPoolService) List(ctx context.Context) ([]models.ProxyPool, error) {
	return s.repos.ProxyPools.List(ctx)
}

func (s *ProxyPoolService) Get(ctx context.Context, id string) (models.ProxyPool, error) {
	return s.repos.ProxyPools.FindByID(ctx, id)
}

func (s *ProxyPoolService) Update(ctx context.Context, actor string, p models.ProxyPool) (models.ProxyPool, error) {
	if err := s.repos.ProxyPools.Update(ctx, p); err != nil {
		return models.ProxyPool{}, err
	}
	s.audit.Record(ctx, actor, "proxy_pool.update", p.ID, nil)
	return s.repos.ProxyPools.FindByID(ctx, p.ID)
}

func (s *ProxyPoolService) Delete(ctx context.Context, actor, id string) error {
	if err := s.repos.ProxyPools.Delete(ctx, id); err != nil {
		return err
	}
	s.audit.Record(ctx, actor, "proxy_pool.delete", id, nil)
	return nil
}

// Test issues a real request through the proxy and records the outcome,
// mirroring IDRouter's proxy-pool test endpoint.
func (s *ProxyPoolService) Test(ctx context.Context, id string) (models.ProxyPool, error) {
	pool, err := s.repos.ProxyPools.FindByID(ctx, id)
	if err != nil {
		return models.ProxyPool{}, err
	}

	proxyURL, err := url.Parse(pool.URL)
	if err != nil {
		return models.ProxyPool{}, fmt.Errorf("invalid proxy url: %w", err)
	}

	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
	}

	status := "inactive"
	if resp, err := client.Get("https://www.google.com/generate_204"); err == nil {
		resp.Body.Close()
		if resp.StatusCode < 500 {
			status = "active"
		}
	}

	if err := s.repos.ProxyPools.UpdateTestedAt(ctx, pool.ID, time.Now(), status); err != nil {
		return models.ProxyPool{}, err
	}
	return s.repos.ProxyPools.FindByID(ctx, pool.ID)
}

// HealthCheck tests every pool at once, returning how many were tested.
func (s *ProxyPoolService) HealthCheck(ctx context.Context, actor string) (int, error) {
	pools, err := s.repos.ProxyPools.List(ctx)
	if err != nil {
		return 0, err
	}
	for _, pool := range pools {
		if _, err := s.Test(ctx, pool.ID); err != nil {
			return 0, err
		}
	}
	s.audit.Record(ctx, actor, "proxy_pool.health_check", fmt.Sprintf("%d pools", len(pools)), nil)
	return len(pools), nil
}
