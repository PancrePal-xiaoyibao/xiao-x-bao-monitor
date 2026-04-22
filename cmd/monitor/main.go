package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/alert"
	"github.com/liueic/xiao-x-bao-monitor/internal/api"
	"github.com/liueic/xiao-x-bao-monitor/internal/config"
	"github.com/liueic/xiao-x-bao-monitor/internal/litellm"
	"github.com/liueic/xiao-x-bao-monitor/internal/provider"
	"github.com/liueic/xiao-x-bao-monitor/internal/scheduler"
	"github.com/liueic/xiao-x-bao-monitor/internal/service"
	"github.com/liueic/xiao-x-bao-monitor/internal/storage"
)

func main() {
	logger := log.New(os.Stdout, "", log.LstdFlags|log.Lmicroseconds)

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("load config: %v", err)
	}

	if err := ensureDataDir(cfg.Storage.Path); err != nil {
		logger.Fatalf("prepare data dir: %v", err)
	}

	store, err := storage.NewSQLiteStore(cfg.Storage.Path)
	if err != nil {
		logger.Fatalf("init sqlite store: %v", err)
	}
	defer store.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := store.Init(ctx); err != nil {
		logger.Fatalf("prepare sqlite schema: %v", err)
	}

	client := litellm.NewClient(cfg.LiteLLM)
	mailer := alert.NewSMTPMailer(cfg.Mail)
	providerResolver := provider.NewResolver(cfg.Provider.Path)
	monitorService := service.NewMonitorService(client, store, mailer, cfg.Location, providerResolver, cfg.Sync.LookbackDays)

	initialSyncCtx, cancelInitialSync := context.WithTimeout(ctx, 60*time.Second)
	initialReport, err := monitorService.SyncCache(initialSyncCtx, time.Now().In(cfg.Location))
	cancelInitialSync()
	if err != nil {
		logger.Printf("initial cache sync failed: %v", err)
	} else {
		logger.Printf("initial cache sync completed: usage=%d providers=%d models=%d", initialReport.UsageDaysSynced, initialReport.ProvidersSynced, initialReport.ModelCatalogItems)
	}

	if cfg.Scheduler.Enabled {
		scheduler.NewRunner(cfg.Scheduler.Interval, monitorService, logger, cfg.Location).Start(ctx)
	}

	server := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           api.NewHandler(monitorService, logger, cfg.Location),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Printf("monitor API listening on %s", cfg.HTTP.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatalf("http server failed: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Printf("graceful shutdown failed: %v", err)
	}
}

func ensureDataDir(path string) error {
	dir := filepath.Dir(path)
	if dir == "." || dir == "" {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}
