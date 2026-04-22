package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/service"
)

type Runner struct {
	interval time.Duration
	service  *service.MonitorService
	logger   *log.Logger
	location *time.Location
}

func NewRunner(interval time.Duration, service *service.MonitorService, logger *log.Logger, location *time.Location) *Runner {
	return &Runner{
		interval: interval,
		service:  service,
		logger:   logger,
		location: location,
	}
}

func (r *Runner) Start(ctx context.Context) {
	if r.interval <= 0 {
		return
	}

	go func() {
		r.runOnce(ctx)

		ticker := time.NewTicker(r.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				r.runOnce(ctx)
			}
		}
	}()
}

func (r *Runner) runOnce(parent context.Context) {
	ctx, cancel := context.WithTimeout(parent, 60*time.Second)
	defer cancel()

	now := time.Now().In(r.location)
	report, err := r.service.SyncCache(ctx, now)
	if err != nil {
		r.logger.Printf("scheduler sync failed: %v", err)
	} else {
		r.logger.Printf("scheduler synced usage=%d providers=%d models=%d at %s", report.UsageDaysSynced, report.ProvidersSynced, report.ModelCatalogItems, report.SyncedAt.Format(time.RFC3339))
	}

	result, err := r.service.CheckThresholds(ctx, now)
	if err != nil {
		r.logger.Printf("scheduler check failed: %v", err)
		return
	}
	r.logger.Printf("scheduler checked %d thresholds for %s", len(result.Results), result.CheckedDate)
}
