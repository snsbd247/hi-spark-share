
-- Add new permissions for system settings modules
INSERT INTO permissions (module, action, description) VALUES
  ('settings', 'manage_system_settings', 'Manage general system settings'),
  ('settings', 'manage_sms_templates', 'Manage SMS message templates'),
  ('settings', 'manage_email_templates', 'Manage email notification templates'),
  ('settings', 'manage_smtp_settings', 'Manage SMTP email configuration')
ON CONFLICT DO NOTHING;

-- Seed default system settings for invoice footer, SMTP config, and email templates
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('invoice_footer', 'Thank you for using our internet service.'),
  ('smtp_host', ''),
  ('smtp_port', '587'),
  ('smtp_username', ''),
  ('smtp_password', ''),
  ('smtp_encryption', 'tls'),
  ('smtp_from_email', ''),
  ('smtp_from_name', ''),
  ('email_tpl_welcome', 'Dear {CustomerName}, welcome to our ISP service! Your account has been activated.'),
  ('email_tpl_password_reset', 'Dear {CustomerName}, click the link below to reset your password.'),
  ('email_tpl_payment_confirm', 'Dear {CustomerName}, we have received your payment of {Amount} BDT for {Month}. Thank you!'),
  ('email_tpl_ticket_reply', 'Dear {CustomerName}, there is a new reply on your support ticket.'),
  ('email_tpl_account_activation', 'Dear {CustomerName}, your account has been activated. You can now access our services.')
ON CONFLICT DO NOTHING;
