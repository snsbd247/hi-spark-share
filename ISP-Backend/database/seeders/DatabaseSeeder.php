<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            DefaultSeeder::class,
            GeoSeeder::class,
            SaasSeeder::class,
            WalletCoaSeeder::class, // v1.17.2 — wallet + settlement COA (idempotent)
        ]);
    }
}
