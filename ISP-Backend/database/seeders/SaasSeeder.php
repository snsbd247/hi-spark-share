<?php

namespace Database\Seeders;

use App\Models\SaasPlan;
use App\Models\SuperAdmin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SaasSeeder extends Seeder
{
    private const DEFAULT_SUPER_ADMIN_EMAIL = 'admin@smartisp.com';
    private const DEFAULT_SUPER_ADMIN_USERNAME = 'admin';
    private const DEFAULT_SUPER_ADMIN_PASSWORD = 'admin123';

    public function run(): void
    {
        $this->seedSuperAdmin();
        $this->seedPlans();
        $this->command->info('SaaS data seeded!');
        $this->command->info('Super Admin → username: ' . self::DEFAULT_SUPER_ADMIN_USERNAME . ' / email: ' . self::DEFAULT_SUPER_ADMIN_EMAIL . ' / password: ' . self::DEFAULT_SUPER_ADMIN_PASSWORD);
    }

    private function seedSuperAdmin(): void
    {
        SuperAdmin::updateOrCreate(
            ['email' => self::DEFAULT_SUPER_ADMIN_EMAIL],
            [
                'name' => 'Super Admin',
                'username' => self::DEFAULT_SUPER_ADMIN_USERNAME,
                'password_hash' => Hash::make(self::DEFAULT_SUPER_ADMIN_PASSWORD),
                'status' => 'active',
                'failed_attempts' => 0,
                'locked_until' => null,
            ]
        );
    }

    private function seedPlans(): void
    {
        $plans = [
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'For small ISPs up to 200 customers',
                'price_monthly' => 999,
                'price_yearly' => 9990,
                'max_customers' => 200,
                'max_users' => 3,
                'max_routers' => 1,
                'has_accounting' => false,
                'has_hr' => false,
                'has_inventory' => false,
                'has_sms' => true,
                'has_custom_domain' => false,
                'sort_order' => 1,
            ],
            [
                'name' => 'Professional',
                'slug' => 'professional',
                'description' => 'For growing ISPs up to 1000 customers',
                'price_monthly' => 2499,
                'price_yearly' => 24990,
                'max_customers' => 1000,
                'max_users' => 10,
                'max_routers' => 5,
                'has_accounting' => true,
                'has_hr' => false,
                'has_inventory' => true,
                'has_sms' => true,
                'has_custom_domain' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Enterprise',
                'slug' => 'enterprise',
                'description' => 'Unlimited customers with all features',
                'price_monthly' => 4999,
                'price_yearly' => 49990,
                'max_customers' => 99999,
                'max_users' => 50,
                'max_routers' => 20,
                'has_accounting' => true,
                'has_hr' => true,
                'has_inventory' => true,
                'has_sms' => true,
                'has_custom_domain' => true,
                'sort_order' => 3,
            ],
        ];

        foreach ($plans as $plan) {
            SaasPlan::firstOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
