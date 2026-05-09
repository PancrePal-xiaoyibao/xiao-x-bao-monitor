package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/model"
	"github.com/liueic/xiao-x-bao-monitor/internal/service"
)

const maxRequestBodySize = 1 << 20 // 1MB

type Handler struct {
	service  *service.MonitorService
	logger   *log.Logger
	location *time.Location
}

func NewHandler(service *service.MonitorService, logger *log.Logger, location *time.Location) http.Handler {
	handler := &Handler{
		service:  service,
		logger:   logger,
		location: location,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handler.healthz)
	mux.HandleFunc("GET /api/v1/monitor/snapshot", handler.getMonitorSnapshot)
	mux.HandleFunc("GET /api/v1/usage/daily", handler.getDailyUsage)
	mux.HandleFunc("GET /api/v1/models", handler.getModels)
	mux.HandleFunc("GET /api/v1/providers", handler.getProviders)

	if dir := os.Getenv("FRONTEND_DIST"); dir != "" {
		mux.Handle("/", spaHandler(os.DirFS(dir)))
	}

	return recoverMiddleware(withCORS(loggingMiddleware(logger, mux)))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) getMonitorSnapshot(w http.ResponseWriter, r *http.Request) {
	response, err := h.service.GetMonitorSnapshot(r.Context())
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) getDailyUsage(w http.ResponseWriter, r *http.Request) {
	query := model.DailyActivityQuery{
		StartDate: strings.TrimSpace(r.URL.Query().Get("start_date")),
		EndDate:   strings.TrimSpace(r.URL.Query().Get("end_date")),
		Model:     strings.TrimSpace(r.URL.Query().Get("model")),
		Period:    strings.TrimSpace(r.URL.Query().Get("period")),
	}
	if timezoneText := strings.TrimSpace(r.URL.Query().Get("timezone")); timezoneText != "" {
		timezone, err := strconv.Atoi(timezoneText)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid timezone")
			return
		}
		query.Timezone = &timezone
	}

	response, err := h.service.GetUsageOverview(r.Context(), query)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) getModels(w http.ResponseWriter, r *http.Request) {
	response, err := h.service.GetModelCatalog(r.Context(), strings.TrimSpace(r.URL.Query().Get("litellm_model_id")))
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) getProviders(w http.ResponseWriter, r *http.Request) {
	response, err := h.service.GetSupportedProviders(r.Context())
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrUserFilterUnsupported):
		writeError(w, http.StatusBadRequest, "unsupported filter")
	case strings.Contains(err.Error(), "validation:"),
		strings.Contains(err.Error(), "invalid"),
		strings.Contains(err.Error(), "required"),
		strings.Contains(err.Error(), "must be"),
		strings.Contains(err.Error(), "unsupported"):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		h.logger.Printf("request failed: %v", err)
		writeError(w, http.StatusBadGateway, "upstream service unavailable")
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func loggingMiddleware(logger *log.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).String())
	})
}

func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("panic while handling %s %s: %v", r.Method, r.URL.Path, recovered)
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	allowedOrigin := os.Getenv("CORS_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "*"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func spaHandler(root fs.FS) http.Handler {
	fileServer := http.FileServerFS(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(root, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
