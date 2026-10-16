package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"tera-router/server/internal/core"
)

// Web search and fetch drivers. Each provider has its own REST shape, so
// these are plain per-provider functions rather than dialect codecs: the
// gateway hands over a query or a URL and gets back one normalized result
// whichever provider served it.

// Web capability names, matching the catalog's Capabilities values.
const (
	WebSearchCapability = "search"
	WebFetchCapability  = "fetch"
)

// WebResult is one normalized search hit.
type WebResult struct {
	Title         string `json:"title"`
	URL           string `json:"url"`
	Snippet       string `json:"snippet"`
	PublishedDate string `json:"published_date,omitempty"`
}

// WebPage is one normalized fetched page.
type WebPage struct {
	URL     string `json:"url"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

// webSnippetChars caps the page text Exa returns per search hit.
const webSnippetChars = 500

// webProviders lists the providers with a web driver and the capabilities
// each one serves.
var webProviders = map[string][]string{
	"exa":       {WebSearchCapability, WebFetchCapability},
	"tavily":    {WebSearchCapability, WebFetchCapability},
	"firecrawl": {WebSearchCapability, WebFetchCapability},
	"jina-ai":   {WebSearchCapability, WebFetchCapability},
	"brave":     {WebSearchCapability},
	"serper":    {WebSearchCapability},
}

// SupportsWeb reports whether provider has a driver for the web capability.
func SupportsWeb(provider, capability string) bool {
	for _, c := range webProviders[provider] {
		if c == capability {
			return true
		}
	}
	return false
}

// WebSearch runs query on provider and returns at most limit results.
// defaultBase is the catalog base URL; an account base_url overrides it.
func WebSearch(ctx context.Context, provider, defaultBase string, creds core.Credentials, query string, limit int) ([]WebResult, error) {
	c := call{provider: provider, model: WebSearchCapability, accountID: creds.AccountID, creds: creds}
	base := baseURL(defaultBase, creds)
	key := creds.Token()

	var out []WebResult
	switch provider {
	case "exa":
		var resp struct {
			Results []struct {
				Title, URL, Text, PublishedDate string
			} `json:"results"`
		}
		body := map[string]any{"query": query, "numResults": limit, "contents": map[string]any{"text": map[string]any{"maxCharacters": webSnippetChars}}}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "search"), body, map[string]string{"x-api-key": key}, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Results {
			out = append(out, WebResult{Title: r.Title, URL: r.URL, Snippet: r.Text, PublishedDate: r.PublishedDate})
		}
	case "tavily":
		var resp struct {
			Results []struct {
				Title         string `json:"title"`
				URL           string `json:"url"`
				Content       string `json:"content"`
				PublishedDate string `json:"published_date"`
			} `json:"results"`
		}
		body := map[string]any{"query": query, "max_results": limit}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "search"), body, map[string]string{"Authorization": bearer(key)}, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Results {
			out = append(out, WebResult{Title: r.Title, URL: r.URL, Snippet: r.Content, PublishedDate: r.PublishedDate})
		}
	case "firecrawl":
		var resp struct {
			Data struct {
				Web []struct{ Title, URL, Description string } `json:"web"`
			} `json:"data"`
		}
		body := map[string]any{"query": query, "limit": limit}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "search"), body, map[string]string{"Authorization": bearer(key)}, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Data.Web {
			out = append(out, WebResult{Title: r.Title, URL: r.URL, Snippet: r.Description})
		}
	case "jina-ai":
		var resp struct {
			Data []struct{ Title, URL, Description string } `json:"data"`
		}
		headers := map[string]string{"Authorization": bearer(key), "Accept": "application/json", "X-Respond-With": "no-content"}
		endpoint := "https://s.jina.ai/?q=" + url.QueryEscape(query)
		if err := webCall(ctx, c, http.MethodGet, endpoint, nil, headers, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Data {
			out = append(out, WebResult{Title: r.Title, URL: r.URL, Snippet: r.Description})
		}
	case "brave":
		var resp struct {
			Web struct {
				Results []struct {
					Title       string `json:"title"`
					URL         string `json:"url"`
					Description string `json:"description"`
					PageAge     string `json:"page_age"`
				} `json:"results"`
			} `json:"web"`
		}
		// Brave caps count at 20.
		endpoint := joinURL(base, "web/search") + "?q=" + url.QueryEscape(query) + "&count=" + strconv.Itoa(min(limit, 20))
		headers := map[string]string{"X-Subscription-Token": key, "Accept": "application/json"}
		if err := webCall(ctx, c, http.MethodGet, endpoint, nil, headers, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Web.Results {
			out = append(out, WebResult{Title: r.Title, URL: r.URL, Snippet: r.Description, PublishedDate: r.PageAge})
		}
	case "serper":
		var resp struct {
			Organic []struct{ Title, Link, Snippet, Date string } `json:"organic"`
		}
		body := map[string]any{"q": query, "num": limit}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "search"), body, map[string]string{"X-API-KEY": key}, &resp); err != nil {
			return nil, err
		}
		for _, r := range resp.Organic {
			out = append(out, WebResult{Title: r.Title, URL: r.Link, Snippet: r.Snippet, PublishedDate: r.Date})
		}
	default:
		return nil, c.capability(WebSearchCapability)
	}

	if len(out) > limit {
		out = out[:limit]
	}
	if out == nil {
		out = []WebResult{}
	}
	return out, nil
}

// WebFetch retrieves target through provider as markdown/text.
func WebFetch(ctx context.Context, provider, defaultBase string, creds core.Credentials, target string) (WebPage, error) {
	c := call{provider: provider, model: WebFetchCapability, accountID: creds.AccountID, creds: creds}
	base := baseURL(defaultBase, creds)
	key := creds.Token()

	page := WebPage{URL: target}
	switch provider {
	case "exa":
		var resp struct {
			Results []struct{ Title, URL, Text string } `json:"results"`
		}
		body := map[string]any{"urls": []string{target}, "text": true}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "contents"), body, map[string]string{"x-api-key": key}, &resp); err != nil {
			return page, err
		}
		if len(resp.Results) > 0 {
			page.Title, page.Content = resp.Results[0].Title, resp.Results[0].Text
		}
	case "tavily":
		var resp struct {
			Results []struct {
				RawContent string `json:"raw_content"`
			} `json:"results"`
		}
		body := map[string]any{"urls": []string{target}, "format": "markdown"}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "extract"), body, map[string]string{"Authorization": bearer(key)}, &resp); err != nil {
			return page, err
		}
		if len(resp.Results) > 0 {
			page.Content = resp.Results[0].RawContent
		}
	case "firecrawl":
		var resp struct {
			Data struct {
				Markdown string `json:"markdown"`
				Metadata struct {
					Title string `json:"title"`
				} `json:"metadata"`
			} `json:"data"`
		}
		body := map[string]any{"url": target, "formats": []string{"markdown"}}
		if err := webCall(ctx, c, http.MethodPost, joinURL(base, "scrape"), body, map[string]string{"Authorization": bearer(key)}, &resp); err != nil {
			return page, err
		}
		page.Title, page.Content = resp.Data.Metadata.Title, resp.Data.Markdown
	case "jina-ai":
		var resp struct {
			Data struct{ Title, Content string } `json:"data"`
		}
		headers := map[string]string{"Authorization": bearer(key), "Accept": "application/json"}
		if err := webCall(ctx, c, http.MethodGet, "https://r.jina.ai/"+target, nil, headers, &resp); err != nil {
			return page, err
		}
		page.Title, page.Content = resp.Data.Title, resp.Data.Content
	default:
		return page, c.capability(WebFetchCapability)
	}

	// Exa and Tavily answer 200 with the URL listed as failed; an empty page is
	// that failure, so the gateway can fall back to the next provider.
	if page.Content == "" {
		return page, &core.ProviderError{
			Kind: core.ErrUpstream, Provider: provider, Model: WebFetchCapability, AccountID: creds.AccountID,
			Message: "provider returned no content for " + target,
		}
	}
	return page, nil
}

// webCall sends one JSON request (body nil for GET) and decodes the 2xx
// response into out, classifying failures like every other upstream call.
func webCall(ctx context.Context, c call, method, endpoint string, body any, headers map[string]string, out any) error {
	var payload []byte
	if body != nil {
		var err error
		if payload, err = json.Marshal(body); err != nil {
			return c.internal(err)
		}
	}
	resp, err := doRequest(ctx, c, method, endpoint, payload, mergeHeaders(headers, c.creds.Headers))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(resp.body, out); err != nil {
		return c.internal(fmt.Errorf("decode %s response: %w", c.provider, err))
	}
	return nil
}

// capability reports a provider that has no driver for the requested web
// capability.
func (c call) capability(what string) *core.ProviderError {
	return &core.ProviderError{
		Kind: core.ErrCapability, Provider: c.provider, Model: c.model, AccountID: c.accountID,
		Message: "provider does not support web " + what,
	}
}
