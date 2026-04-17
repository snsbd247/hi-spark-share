<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GeoSeeder extends Seeder
{
    public function run(): void
    {
        $data = $this->loadGeoData();
        $now = now();

        $divisionIds = [];
        $insertedDivisions = 0;
        foreach ($data['divisions'] as $division) {
            $existing = DB::table('geo_divisions')
                ->where('name', $division['name'])
                ->first();

            if ($existing) {
                $divisionIds[$division['name']] = $existing->id;
                continue;
            }

            $id = Str::uuid()->toString();
            DB::table('geo_divisions')->insert([
                'id' => $id,
                'name' => $division['name'],
                'bn_name' => $division['bn_name'] ?? null,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $divisionIds[$division['name']] = $id;
            $insertedDivisions++;
        }

        $districtIds = [];
        $insertedDistricts = 0;
        foreach ($data['districts'] as $divisionName => $districts) {
            $divisionId = $divisionIds[$divisionName] ?? null;
            if (!$divisionId) {
                continue;
            }

            foreach ($districts as $district) {
                $name = is_array($district) ? $district['name'] : $district;
                $bnName = is_array($district) ? ($district['bn_name'] ?? null) : null;

                $existing = DB::table('geo_districts')
                    ->where('division_id', $divisionId)
                    ->where('name', $name)
                    ->first();

                if ($existing) {
                    $districtIds[$name] = $existing->id;
                    continue;
                }

                $id = Str::uuid()->toString();
                DB::table('geo_districts')->insert([
                    'id' => $id,
                    'division_id' => $divisionId,
                    'name' => $name,
                    'bn_name' => $bnName,
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $districtIds[$name] = $id;
                $insertedDistricts++;
            }
        }

        $totalUpazilas = 0;
        $insertedUpazilas = 0;
        foreach ($data['upazilas'] as $districtName => $upazilas) {
            $districtId = $districtIds[$districtName] ?? null;
            if (!$districtId) {
                continue;
            }

            foreach ($upazilas as $upazila) {
                $totalUpazilas++;

                $name = is_array($upazila) ? $upazila['name'] : $upazila;
                $bnName = is_array($upazila) ? ($upazila['bn_name'] ?? null) : null;

                $exists = DB::table('geo_upazilas')
                    ->where('district_id', $districtId)
                    ->where('name', $name)
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('geo_upazilas')->insert([
                    'id' => Str::uuid()->toString(),
                    'district_id' => $districtId,
                    'name' => $name,
                    'bn_name' => $bnName,
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $insertedUpazilas++;
            }
        }

        $summary = 'Bangladesh geo data synced: '
            . count($data['divisions']) . ' divisions (' . $insertedDivisions . ' new), '
            . array_sum(array_map('count', $data['districts'])) . ' districts (' . $insertedDistricts . ' new), '
            . $totalUpazilas . ' upazilas (' . $insertedUpazilas . ' new)';

        if ($this->command) {
            $this->command->info($summary);
            return;
        }

        echo $summary . PHP_EOL;
    }

    private function loadGeoData(): array
    {
        $path = database_path('data/geo.json');
        if (!file_exists($path)) {
            throw new \RuntimeException('geo.json not found');
        }

        $data = json_decode(file_get_contents($path), true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
            throw new \RuntimeException('Invalid geo.json: ' . json_last_error_msg());
        }

        return $data;
    }
}
