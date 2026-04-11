<?php

namespace App\Services;

class TenantEmailService
{
    /**
     * Send email using tenant SMTP first, then centralized SMTP fallback.
     */
    public function send(string $to, string $subject, string $html, ?string $fromName = null): array
    {
        return app(EmailService::class)->send($to, $subject, $html, $fromName);
    }

    /**
     * Send tenant welcome email with credentials.
     */
    public function sendTenantCredentials(array $tenant, string $adminEmail, string $adminName, string $password, string $loginUrl): array
    {
        $html = $this->buildCredentialsEmail($tenant, $adminName, $adminEmail, $password, $loginUrl);
        return $this->send($adminEmail, "Welcome to Smart ISP — Your Login Credentials", $html);
    }

    /**
     * Send password reset notification.
     */
    public function sendPasswordReset(string $email, string $name, string $newPassword, string $loginUrl): array
    {
        $html = <<<HTML
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1a1a1a;">Password Reset</h2>
            <p>Hello <strong>{$name}</strong>,</p>
            <p>Your password has been reset by the administrator.</p>
            <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:20px 0;">
                <p style="margin:5px 0;"><strong>New Password:</strong> {$newPassword}</p>
                <p style="margin:5px 0;"><strong>Login URL:</strong> <a href="{$loginUrl}">{$loginUrl}</a></p>
            </div>
            <p style="color:#e53e3e;font-size:14px;">⚠️ You will be required to change your password on first login.</p>
            <p style="color:#666;font-size:12px;margin-top:30px;">— Smart ISP System</p>
        </div>
        HTML;

        return $this->send($email, "Password Reset — Smart ISP", $html);
    }

    /**
     * Build the tenant credentials email HTML.
     */
    private function buildCredentialsEmail(array $tenant, string $adminName, string $adminEmail, string $password, string $loginUrl): string
    {
        $tenantName = $tenant['name'] ?? 'Your ISP';
        $subdomain  = $tenant['subdomain'] ?? '';

        return <<<HTML
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="text-align:center;padding:20px 0;border-bottom:2px solid #4f46e5;">
                <h1 style="color:#4f46e5;margin:0;">Smart ISP</h1>
                <p style="color:#666;margin:5px 0;">ISP Billing & Management Platform</p>
            </div>

            <div style="padding:20px 0;">
                <h2 style="color:#1a1a1a;">Welcome, {$adminName}!</h2>
                <p>Your ISP management system <strong>"{$tenantName}"</strong> has been set up successfully.</p>

                <div style="background:#f0f4ff;padding:20px;border-radius:8px;border-left:4px solid #4f46e5;margin:20px 0;">
                    <h3 style="color:#4f46e5;margin-top:0;">Your Login Credentials</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <tr>
                            <td style="padding:8px 0;color:#666;width:130px;">Login URL</td>
                            <td style="padding:8px 0;"><a href="{$loginUrl}" style="color:#4f46e5;">{$loginUrl}</a></td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;color:#666;">Email / Username</td>
                            <td style="padding:8px 0;font-weight:bold;">{$adminEmail}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px 0;color:#666;">Password</td>
                            <td style="padding:8px 0;font-weight:bold;font-family:monospace;font-size:16px;">{$password}</td>
                        </tr>
                    </table>
                </div>

                <div style="background:#fef3c7;padding:15px;border-radius:8px;margin:15px 0;">
                    <p style="margin:0;color:#92400e;font-size:14px;">
                        ⚠️ <strong>Important:</strong> You will be required to change your password on first login for security.
                    </p>
                </div>

                <h3 style="color:#1a1a1a;">Getting Started</h3>
                <ol style="color:#444;line-height:1.8;">
                    <li>Click the login URL above</li>
                    <li>Enter your credentials</li>
                    <li>Change your password</li>
                    <li>Start adding customers and packages</li>
                </ol>
            </div>

            <div style="border-top:1px solid #eee;padding-top:15px;margin-top:20px;">
                <p style="color:#999;font-size:12px;text-align:center;">
                    This is an automated email from Smart ISP Platform.<br>
                    Please do not reply to this email.
                </p>
            </div>
        </div>
        HTML;
    }
}
