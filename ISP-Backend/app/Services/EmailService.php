<?php

namespace App\Services;

use App\Models\SmtpSetting;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class EmailService
{
    public function send(string $to, string $subject, string $html, ?string $fromName = null): array
    {
        $smtp = $this->resolveSmtpConfig();

        if (!$smtp) {
            Log::warning('EmailService: No SMTP configuration found');
            return ['success' => false, 'error' => 'SMTP not configured'];
        }

        $fromName = $fromName ?? ($smtp['from_name'] ?? 'Smart ISP');
        $fromAddress = $smtp['from_email'] ?? $smtp['username'] ?? config('mail.from.address', 'noreply@example.com');

        $this->applyMailConfig($smtp, $fromAddress, $fromName);

        try {
            Mail::mailer('smtp')->html($html, function ($message) use ($to, $subject, $fromName, $fromAddress) {
                $message->to($to)
                    ->subject($subject)
                    ->from($fromAddress, $fromName);
            });

            return ['success' => true, 'provider' => 'smtp'];
        } catch (\Exception $e) {
            Log::error('Email send failed: ' . $e->getMessage(), [
                'to' => $to,
                'host' => $smtp['host'] ?? null,
                'port' => $smtp['port'] ?? null,
                'encryption' => $smtp['encryption'] ?? null,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function resolveSmtpConfig(): ?array
    {
        $tenantConfig = $this->resolveTenantScopedSmtp();
        if ($tenantConfig) {
            return $tenantConfig;
        }

        $smtp = SmtpSetting::where('status', 'active')->first();
        if (!$smtp?->host || !$smtp?->username) {
            return null;
        }

        $password = $smtp->decrypted_password;
        if (!$password) {
            return null;
        }

        $host = trim((string) $smtp->host);

        return [
            'host' => $host,
            'port' => (int) ($smtp->port ?: 587),
            'username' => trim((string) $smtp->username),
            'password' => $this->normalizePassword($host, (string) $password),
            'encryption' => strtolower((string) ($smtp->encryption ?: 'tls')),
            'from_email' => trim((string) ($smtp->from_email ?: $smtp->username)),
            'from_name' => trim((string) ($smtp->from_name ?: 'Smart ISP')),
        ];
    }

    private function resolveTenantScopedSmtp(): ?array
    {
        if (!is_tenant_context()) {
            return null;
        }

        $settings = SystemSetting::query()
            ->whereIn('setting_key', [
                'smtp_host',
                'smtp_port',
                'smtp_user',
                'smtp_password',
                'smtp_from_email',
                'smtp_from_name',
                'smtp_encryption',
            ])
            ->pluck('setting_value', 'setting_key');

        $host = trim((string) ($settings['smtp_host'] ?? ''));
        $username = trim((string) ($settings['smtp_user'] ?? ''));
        $password = (string) ($settings['smtp_password'] ?? '');

        if (!$host || !$username || !$password) {
            return null;
        }

        return [
            'host' => $host,
            'port' => (int) ($settings['smtp_port'] ?? 587),
            'username' => $username,
            'password' => $this->normalizePassword($host, $password),
            'encryption' => strtolower((string) ($settings['smtp_encryption'] ?? 'tls')),
            'from_email' => trim((string) ($settings['smtp_from_email'] ?? $username)),
            'from_name' => trim((string) ($settings['smtp_from_name'] ?? 'Smart ISP')),
        ];
    }

    private function normalizePassword(string $host, string $password): string
    {
        return str_contains(strtolower($host), 'gmail')
            ? preg_replace('/\s+/', '', $password) ?? ''
            : $password;
    }

    private function applyMailConfig(array $smtp, string $fromAddress, string $fromName): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $smtp['host'],
            'mail.mailers.smtp.port' => $smtp['port'],
            'mail.mailers.smtp.username' => $smtp['username'],
            'mail.mailers.smtp.password' => $smtp['password'],
            'mail.mailers.smtp.encryption' => $smtp['encryption'] === 'none' ? null : $smtp['encryption'],
            'mail.from.address' => $fromAddress,
            'mail.from.name' => $fromName,
        ]);

        try {
            $mailManager = app('mail.manager');

            if (method_exists($mailManager, 'forgetMailers')) {
                $mailManager->forgetMailers();
            }

            if (method_exists($mailManager, 'purge')) {
                $mailManager->purge('smtp');
            }
        } catch (\Throwable $e) {
            Log::debug('EmailService: Failed to reset mail manager', ['message' => $e->getMessage()]);
        }
    }
}
