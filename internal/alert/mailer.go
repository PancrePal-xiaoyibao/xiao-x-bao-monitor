package alert

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/config"
)

type Mailer interface {
	Send(ctx context.Context, subject, body string, recipients []string) error
}

type SMTPMailer struct {
	cfg config.MailConfig
}

func NewSMTPMailer(cfg config.MailConfig) *SMTPMailer {
	return &SMTPMailer{cfg: cfg}
}

func (m *SMTPMailer) Send(ctx context.Context, subject, body string, recipients []string) error {
	if !m.cfg.Enabled() {
		return errors.New("SMTP mailer is not configured")
	}
	if len(recipients) == 0 {
		return errors.New("no alert recipients configured")
	}

	address := net.JoinHostPort(m.cfg.Host, strconv.Itoa(m.cfg.Port))
	client, conn, err := m.openClient(ctx, address)
	if err != nil {
		return err
	}
	defer conn.Close()
	defer client.Quit()

	if m.cfg.Username != "" {
		if ok, _ := client.Extension("AUTH"); ok {
			auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth: %w", err)
			}
		}
	}

	if err := client.Mail(m.cfg.From); err != nil {
		return fmt.Errorf("smtp from: %w", err)
	}
	for _, recipient := range recipients {
		if err := client.Rcpt(strings.TrimSpace(recipient)); err != nil {
			return fmt.Errorf("smtp recipient %s: %w", recipient, err)
		}
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}

	message := buildMessage(m.cfg.From, recipients, subject, body)
	if _, err := writer.Write(message); err != nil {
		writer.Close()
		return fmt.Errorf("write smtp body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("close smtp body: %w", err)
	}
	return nil
}

func (m *SMTPMailer) openClient(ctx context.Context, address string) (*smtp.Client, net.Conn, error) {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	if m.cfg.Port == 465 {
		conn, err := tls.DialWithDialer(dialer, "tcp", address, &tls.Config{
			ServerName: m.cfg.Host,
			MinVersion: tls.VersionTLS12,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("dial SMTPS server: %w", err)
		}
		client, err := smtp.NewClient(conn, m.cfg.Host)
		if err != nil {
			conn.Close()
			return nil, nil, fmt.Errorf("create SMTPS client: %w", err)
		}
		return client, conn, nil
	}

	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, nil, fmt.Errorf("dial SMTP server: %w", err)
	}
	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("create SMTP client: %w", err)
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{
			ServerName: m.cfg.Host,
			MinVersion: tls.VersionTLS12,
		}); err != nil {
			client.Close()
			conn.Close()
			return nil, nil, fmt.Errorf("starttls: %w", err)
		}
	}
	return client, conn, nil
}

func buildMessage(from string, recipients []string, subject, body string) []byte {
	var buffer bytes.Buffer
	buffer.WriteString("From: " + from + "\r\n")
	buffer.WriteString("To: " + strings.Join(recipients, ", ") + "\r\n")
	buffer.WriteString("Subject: " + subject + "\r\n")
	buffer.WriteString("MIME-Version: 1.0\r\n")
	buffer.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	buffer.WriteString("\r\n")
	buffer.WriteString(body)
	return buffer.Bytes()
}
