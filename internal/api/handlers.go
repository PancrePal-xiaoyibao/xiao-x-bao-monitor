package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/model"
	"github.com/liueic/xiao-x-bao-monitor/internal/service"
)

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
	mux.HandleFunc("GET /api/v1/usage/daily", handler.getDailyUsage)
	mux.HandleFunc("GET /api/v1/usage/logs", handler.getSpendLogs)
	mux.HandleFunc("GET /api/v1/models", handler.getModels)
	mux.HandleFunc("GET /api/v1/providers", handler.getProviders)
	mux.HandleFunc("GET /api/v1/thresholds", handler.listThresholds)
	mux.HandleFunc("POST /api/v1/thresholds", handler.createThreshold)
	mux.HandleFunc("PUT /api/v1/thresholds/{id}", handler.updateThreshold)
	mux.HandleFunc("DELETE /api/v1/thresholds/{id}", handler.deleteThreshold)
	mux.HandleFunc("POST /api/v1/alerts/check", handler.checkAlerts)
	mux.HandleFunc("GET /api/v1/alerts/history", handler.listAlertHistory)
	return recoverMiddleware(loggingMiddleware(logger, mux))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) getDailyUsage(w http.ResponseWriter, r *http.Request) {
	query := model.DailyActivityQuery{
		StartDate: strings.TrimSpace(r.URL.Query().Get("start_date")),
		EndDate:   strings.TrimSpace(r.URL.Query().Get("end_date")),
		UserID:    strings.TrimSpace(r.URL.Query().Get("user_id")),
		APIKey:    strings.TrimSpace(r.URL.Query().Get("api_key")),
		Model:     strings.TrimSpace(r.URL.Query().Get("model")),
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

func (h *Handler) getSpendLogs(w http.ResponseWriter, r *http.Request) {
	query := model.SpendLogsQuery{
		APIKey:       strings.TrimSpace(r.URL.Query().Get("api_key")),
		UserID:       strings.TrimSpace(r.URL.Query().Get("user_id")),
		RequestID:    strings.TrimSpace(r.URL.Query().Get("request_id")),
		TeamID:       strings.TrimSpace(r.URL.Query().Get("team_id")),
		StartDate:    strings.TrimSpace(r.URL.Query().Get("start_date")),
		EndDate:      strings.TrimSpace(r.URL.Query().Get("end_date")),
		StatusFilter: strings.TrimSpace(r.URL.Query().Get("status_filter")),
		Model:        strings.TrimSpace(r.URL.Query().Get("model")),
		ModelID:      strings.TrimSpace(r.URL.Query().Get("model_id")),
		KeyAlias:     strings.TrimSpace(r.URL.Query().Get("key_alias")),
		EndUser:      strings.TrimSpace(r.URL.Query().Get("end_user")),
		ErrorCode:    strings.TrimSpace(r.URL.Query().Get("error_code")),
		ErrorMessage: strings.TrimSpace(r.URL.Query().Get("error_message")),
		Page:         parseIntOrDefault(r.URL.Query().Get("page"), 1),
		PageSize:     parseIntOrDefault(r.URL.Query().Get("page_size"), 50),
	}

	if minSpendText := strings.TrimSpace(r.URL.Query().Get("min_spend")); minSpendText != "" {
		value, err := strconv.ParseFloat(minSpendText, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid min_spend")
			return
		}
		query.MinSpend = &value
	}
	if maxSpendText := strings.TrimSpace(r.URL.Query().Get("max_spend")); maxSpendText != "" {
		value, err := strconv.ParseFloat(maxSpendText, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid max_spend")
			return
		}
		query.MaxSpend = &value
	}

	response, err := h.service.GetSpendLogs(r.Context(), query)
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

func (h *Handler) listThresholds(w http.ResponseWriter, r *http.Request) {
	response, err := h.service.ListThresholds(r.Context())
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) createThreshold(w http.ResponseWriter, r *http.Request) {
	var request model.Threshold
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	response, err := h.service.CreateThreshold(r.Context(), request)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) updateThreshold(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid threshold id")
		return
	}

	var request model.Threshold
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	request.ID = id

	response, err := h.service.UpdateThreshold(r.Context(), request)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) deleteThreshold(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid threshold id")
		return
	}

	if err := h.service.DeleteThreshold(r.Context(), id); err != nil {
		h.writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) checkAlerts(w http.ResponseWriter, r *http.Request) {
	dateText := strings.TrimSpace(r.URL.Query().Get("date"))
	var alertDate time.Time
	var err error
	if dateText == "" {
		alertDate = time.Now().In(h.location)
	} else {
		alertDate, err = time.ParseInLocation("2006-01-02", dateText, h.location)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid date, expected YYYY-MM-DD")
			return
		}
	}

	response, err := h.service.CheckThresholds(r.Context(), alertDate)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) listAlertHistory(w http.ResponseWriter, r *http.Request) {
	limit := parseIntOrDefault(r.URL.Query().Get("limit"), 50)
	response, err := h.service.ListAlertEvents(r.Context(), limit)
	if err != nil {
		h.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeError(w, http.StatusNotFound, "resource not found")
	case errors.Is(err, service.ErrSpendLogsNotSupported):
		writeError(w, http.StatusNotImplemented, err.Error())
	case errors.Is(err, service.ErrUserFilterUnsupported):
		writeError(w, http.StatusBadRequest, err.Error())
	case strings.Contains(err.Error(), "validation:"),
		strings.Contains(err.Error(), "invalid"),
		strings.Contains(err.Error(), "required"),
		strings.Contains(err.Error(), "must be"),
		strings.Contains(err.Error(), "unsupported"):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		h.logger.Printf("request failed: %v", err)
		writeError(w, http.StatusBadGateway, err.Error())
	}
}

func decodeJSON(r *http.Request, out any) error {
	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(out); err != nil {
		return err
	}
	return nil
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

func parseIntOrDefault(value string, fallback int) int {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
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
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
