<?php

namespace App\Console\Commands;

use App\Models\Module;
use Illuminate\Console\Command;

class ScanModules extends Command
{
    protected $signature = 'modules:scan';
    protected $description = 'Scan routes/controllers and register system modules';

    /**
     * Default modules derived from route groups and controller structure.
     */
    private array $defaultModules = [
        ['name' => 'Dashboard',           'slug' => 'dashboard',         'description' => 'Main dashboard & statistics',              'icon' => 'LayoutDashboard', 'is_core' => true,  'sort_order' => 1],
        ['name' => 'Customer Management', 'slug' => 'customers',         'description' => 'Manage ISP customers',                    'icon' => 'Users',           'is_core' => true,  'sort_order' => 2],
        ['name' => 'Billing',             'slug' => 'billing',           'description' => 'Bill generation & management',             'icon' => 'Receipt',         'is_core' => true,  'sort_order' => 3],
        ['name' => 'Payments',            'slug' => 'payments',          'description' => 'Payment collection & tracking',            'icon' => 'CreditCard',      'is_core' => true,  'sort_order' => 4],
        ['name' => 'Merchant Payments',   'slug' => 'merchant_payments', 'description' => 'bKash/Nagad merchant payments',            'icon' => 'Smartphone',      'is_core' => false, 'sort_order' => 5],
        ['name' => 'Support Tickets',     'slug' => 'tickets',           'description' => 'Customer support system',                  'icon' => 'Ticket',          'is_core' => false, 'sort_order' => 6],
        ['name' => 'SMS & Reminders',     'slug' => 'sms',              'description' => 'SMS, Email & WhatsApp messaging',          'icon' => 'MessageSquare',   'is_core' => false, 'sort_order' => 7],
        ['name' => 'Accounting',          'slug' => 'accounting',        'description' => 'Double-entry accounting system',           'icon' => 'Calculator',      'is_core' => false, 'sort_order' => 8],
        ['name' => 'Inventory & Sales',   'slug' => 'inventory',         'description' => 'Product, purchase & sales management',     'icon' => 'Package',         'is_core' => false, 'sort_order' => 9],
        ['name' => 'Human Resource',      'slug' => 'hr',               'description' => 'Employee, attendance & payroll',           'icon' => 'UserCog',         'is_core' => false, 'sort_order' => 10],
        ['name' => 'Supplier Management', 'slug' => 'supplier',          'description' => 'Supplier & procurement',                  'icon' => 'Truck',           'is_core' => false, 'sort_order' => 11],
        ['name' => 'Reports & Analytics', 'slug' => 'reports',           'description' => 'Reports, BTRC & analytics',               'icon' => 'BarChart3',       'is_core' => false, 'sort_order' => 12],
        ['name' => 'User Management',     'slug' => 'users',             'description' => 'Admin users & access control',            'icon' => 'Shield',          'is_core' => true,  'sort_order' => 13],
        ['name' => 'Roles & Permissions', 'slug' => 'roles',             'description' => 'Role-based access control',               'icon' => 'Lock',            'is_core' => true,  'sort_order' => 14],
        ['name' => 'System Settings',     'slug' => 'settings',          'description' => 'General & system configuration',          'icon' => 'Settings',        'is_core' => true,  'sort_order' => 15],
        ['name' => 'MikroTik',            'slug' => 'mikrotik',          'description' => 'MikroTik router management & sync',       'icon' => 'Router',          'is_core' => false, 'sort_order' => 16],
        ['name' => 'Packages',            'slug' => 'packages',          'description' => 'Internet package management',             'icon' => 'Package',         'is_core' => true,  'sort_order' => 17],
        ['name' => 'Fiber Network',       'slug' => 'fiber_network',     'description' => 'Fiber optic network topology',            'icon' => 'Network',         'is_core' => false, 'sort_order' => 18],
        ['name' => 'Reseller',            'slug' => 'reseller',          'description' => 'Reseller management & commissions',       'icon' => 'Users',           'is_core' => false, 'sort_order' => 19],
        ['name' => 'Network Map',         'slug' => 'network_map',       'description' => 'Network topology visualization',          'icon' => 'Map',             'is_core' => false, 'sort_order' => 20],
        ['name' => 'Live Bandwidth',      'slug' => 'live_bandwidth',    'description' => 'Real-time bandwidth monitoring',          'icon' => 'Activity',        'is_core' => false, 'sort_order' => 21],
    ];

    public function handle(): int
    {
        $this->info('Scanning system modules...');

        $created = 0;
        $updated = 0;

        foreach ($this->defaultModules as $mod) {
            $existing = Module::where('slug', $mod['slug'])->first();

            if ($existing) {
                $existing->update([
                    'name'        => $mod['name'],
                    'description' => $mod['description'],
                    'icon'        => $mod['icon'],
                    'is_core'     => $mod['is_core'],
                    'sort_order'  => $mod['sort_order'],
                ]);
                $updated++;
            } else {
                Module::create($mod);
                $created++;
            }
        }

        // Also scan for any check.permission middleware modules from routes
        $this->scanRouteModules($created, $updated);

        $this->info("Done! Created: {$created}, Updated: {$updated}");

        return 0;
    }

    private function scanRouteModules(int &$created, int &$updated): void
    {
        $routes = app('router')->getRoutes();
        $discoveredModules = [];

        foreach ($routes as $route) {
            $middleware = $route->gatherMiddleware();
            foreach ($middleware as $mw) {
                if (str_starts_with($mw, 'check.permission:')) {
                    $parts = explode(':', $mw, 2);
                    if (isset($parts[1])) {
                        $module = explode(',', $parts[1])[0];
                        $discoveredModules[$module] = true;
                    }
                }
            }
        }

        foreach (array_keys($discoveredModules) as $slug) {
            if (!Module::where('slug', $slug)->exists()) {
                Module::create([
                    'name'        => ucfirst(str_replace('_', ' ', $slug)),
                    'slug'        => $slug,
                    'description' => 'Auto-discovered from routes',
                    'is_core'     => false,
                    'sort_order'  => 99,
                ]);
                $created++;
                $this->line("  → Discovered new module: {$slug}");
            }
        }
    }
}
