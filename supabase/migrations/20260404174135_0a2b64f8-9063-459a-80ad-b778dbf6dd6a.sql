
INSERT INTO general_settings (site_name, primary_color)
SELECT 'Smart ISP', '#3B82F6'
WHERE NOT EXISTS (SELECT 1 FROM general_settings LIMIT 1);
