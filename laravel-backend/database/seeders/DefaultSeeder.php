<?php

namespace Database\Seeders;

use App\Models\GeneralSetting;
use App\Models\Package;
use App\Models\Profile;
use App\Models\SmsSetting;
use App\Models\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DefaultSeeder extends Seeder
{
    public function run(): void
    {
        // Super Admin
        $adminId = Str::uuid()->toString();
        Profile::create([
            'id' => $adminId,
            'full_name' => 'Super Admin',
            'email' => 'admin@smartisp.com',
            'username' => 'admin',
            'password_hash' => Hash::make('admin123'),
            'status' => 'active',
        ]);

        UserRole::create([
            'user_id' => $adminId,
            'role' => 'super_admin',
        ]);

        // Admin User: ismail
        $ismailId = Str::uuid()->toString();
        Profile::create([
            'id' => $ismailId,
            'full_name' => 'Ismail',
            'email' => 'ismail@smartisp.com',
            'username' => 'ismail',
            'password_hash' => Hash::make('Admin@123'),
            'status' => 'active',
        ]);

        UserRole::create([
            'user_id' => $ismailId,
            'role' => 'super_admin',
        ]);

        // General Settings
        GeneralSetting::create([
            'site_name' => 'Smart ISP',
            'primary_color' => '#3B82F6',
        ]);

        // SMS Settings
        SmsSetting::create([
            'sms_on_bill_generate' => true,
            'sms_on_payment' => true,
            'sms_on_registration' => true,
            'sms_on_suspension' => true,
        ]);

        // Default Packages
        $packages = [
            ['name' => 'Basic 10Mbps', 'speed' => '10 Mbps', 'monthly_price' => 500, 'download_speed' => 10, 'upload_speed' => 10],
            ['name' => 'Standard 20Mbps', 'speed' => '20 Mbps', 'monthly_price' => 800, 'download_speed' => 20, 'upload_speed' => 20],
            ['name' => 'Premium 50Mbps', 'speed' => '50 Mbps', 'monthly_price' => 1200, 'download_speed' => 50, 'upload_speed' => 50],
            ['name' => 'Ultra 100Mbps', 'speed' => '100 Mbps', 'monthly_price' => 2000, 'download_speed' => 100, 'upload_speed' => 100],
        ];

        foreach ($packages as $pkg) {
            Package::create($pkg);
        }

        $this->command->info('Default data seeded!');
        $this->command->info('Admin #1 → username: admin / password: admin123');
        $this->command->info('Admin #2 → username: ismail / password: Admin@123');
    }
}
