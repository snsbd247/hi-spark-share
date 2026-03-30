<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GeoSeeder extends Seeder
{
    public function run(): void
    {
        // Skip if already seeded
        if (DB::table('geo_divisions')->count() > 0) {
            echo "Geo data already exists, skipping...\n";
            return;
        }

        $divisions = [
            ['name' => 'Barishal', 'bn_name' => 'বরিশাল'],
            ['name' => 'Chattogram', 'bn_name' => 'চট্টগ্রাম'],
            ['name' => 'Dhaka', 'bn_name' => 'ঢাকা'],
            ['name' => 'Khulna', 'bn_name' => 'খুলনা'],
            ['name' => 'Mymensingh', 'bn_name' => 'ময়মনসিংহ'],
            ['name' => 'Rajshahi', 'bn_name' => 'রাজশাহী'],
            ['name' => 'Rangpur', 'bn_name' => 'রংপুর'],
            ['name' => 'Sylhet', 'bn_name' => 'সিলেট'],
        ];

        $divisionIds = [];
        foreach ($divisions as $div) {
            $id = Str::uuid()->toString();
            DB::table('geo_divisions')->insert([
                'id' => $id,
                'name' => $div['name'],
                'bn_name' => $div['bn_name'],
                'status' => 'active',
                'created_at' => now(),
            ]);
            $divisionIds[$div['name']] = $id;
        }

        $districts = [
            'Barishal' => [
                ['name' => 'Barguna', 'bn_name' => 'বরগুনা'],
                ['name' => 'Barishal', 'bn_name' => 'বরিশাল'],
                ['name' => 'Bhola', 'bn_name' => 'ভোলা'],
                ['name' => 'Jhalokati', 'bn_name' => 'ঝালকাঠি'],
                ['name' => 'Patuakhali', 'bn_name' => 'পটুয়াখালী'],
                ['name' => 'Pirojpur', 'bn_name' => 'পিরোজপুর'],
            ],
            'Chattogram' => [
                ['name' => 'Bandarban', 'bn_name' => 'বান্দরবান'],
                ['name' => 'Brahmanbaria', 'bn_name' => 'ব্রাহ্মণবাড়িয়া'],
                ['name' => 'Chandpur', 'bn_name' => 'চাঁদপুর'],
                ['name' => 'Chattogram', 'bn_name' => 'চট্টগ্রাম'],
                ['name' => 'Comilla', 'bn_name' => 'কুমিল্লা'],
                ['name' => "Cox's Bazar", 'bn_name' => 'কক্সবাজার'],
                ['name' => 'Feni', 'bn_name' => 'ফেনী'],
                ['name' => 'Khagrachhari', 'bn_name' => 'খাগড়াছড়ি'],
                ['name' => 'Lakshmipur', 'bn_name' => 'লক্ষ্মীপুর'],
                ['name' => 'Noakhali', 'bn_name' => 'নোয়াখালী'],
                ['name' => 'Rangamati', 'bn_name' => 'রাঙ্গামাটি'],
            ],
            'Dhaka' => [
                ['name' => 'Dhaka', 'bn_name' => 'ঢাকা'],
                ['name' => 'Faridpur', 'bn_name' => 'ফরিদপুর'],
                ['name' => 'Gazipur', 'bn_name' => 'গাজীপুর'],
                ['name' => 'Gopalganj', 'bn_name' => 'গোপালগঞ্জ'],
                ['name' => 'Kishoreganj', 'bn_name' => 'কিশোরগঞ্জ'],
                ['name' => 'Madaripur', 'bn_name' => 'মাদারীপুর'],
                ['name' => 'Manikganj', 'bn_name' => 'মানিকগঞ্জ'],
                ['name' => 'Munshiganj', 'bn_name' => 'মুন্সীগঞ্জ'],
                ['name' => 'Narayanganj', 'bn_name' => 'নারায়ণগঞ্জ'],
                ['name' => 'Narsingdi', 'bn_name' => 'নরসিংদী'],
                ['name' => 'Rajbari', 'bn_name' => 'রাজবাড়ী'],
                ['name' => 'Shariatpur', 'bn_name' => 'শরীয়তপুর'],
                ['name' => 'Tangail', 'bn_name' => 'টাঙ্গাইল'],
            ],
            'Khulna' => [
                ['name' => 'Bagerhat', 'bn_name' => 'বাগেরহাট'],
                ['name' => 'Chuadanga', 'bn_name' => 'চুয়াডাঙ্গা'],
                ['name' => 'Jessore', 'bn_name' => 'যশোর'],
                ['name' => 'Jhenaidah', 'bn_name' => 'ঝিনাইদহ'],
                ['name' => 'Khulna', 'bn_name' => 'খুলনা'],
                ['name' => 'Kushtia', 'bn_name' => 'কুষ্টিয়া'],
                ['name' => 'Magura', 'bn_name' => 'মাগুরা'],
                ['name' => 'Meherpur', 'bn_name' => 'মেহেরপুর'],
                ['name' => 'Narail', 'bn_name' => 'নড়াইল'],
                ['name' => 'Satkhira', 'bn_name' => 'সাতক্ষীরা'],
            ],
            'Mymensingh' => [
                ['name' => 'Jamalpur', 'bn_name' => 'জামালপুর'],
                ['name' => 'Mymensingh', 'bn_name' => 'ময়মনসিংহ'],
                ['name' => 'Netrokona', 'bn_name' => 'নেত্রকোনা'],
                ['name' => 'Sherpur', 'bn_name' => 'শেরপুর'],
            ],
            'Rajshahi' => [
                ['name' => 'Bogura', 'bn_name' => 'বগুড়া'],
                ['name' => 'Chapainawabganj', 'bn_name' => 'চাঁপাইনবাবগঞ্জ'],
                ['name' => 'Joypurhat', 'bn_name' => 'জয়পুরহাট'],
                ['name' => 'Naogaon', 'bn_name' => 'নওগাঁ'],
                ['name' => 'Natore', 'bn_name' => 'নাটোর'],
                ['name' => 'Nawabganj', 'bn_name' => 'নবাবগঞ্জ'],
                ['name' => 'Pabna', 'bn_name' => 'পাবনা'],
                ['name' => 'Rajshahi', 'bn_name' => 'রাজশাহী'],
                ['name' => 'Sirajganj', 'bn_name' => 'সিরাজগঞ্জ'],
            ],
            'Rangpur' => [
                ['name' => 'Dinajpur', 'bn_name' => 'দিনাজপুর'],
                ['name' => 'Gaibandha', 'bn_name' => 'গাইবান্ধা'],
                ['name' => 'Kurigram', 'bn_name' => 'কুড়িগ্রাম'],
                ['name' => 'Lalmonirhat', 'bn_name' => 'লালমনিরহাট'],
                ['name' => 'Nilphamari', 'bn_name' => 'নীলফামারী'],
                ['name' => 'Panchagarh', 'bn_name' => 'পঞ্চগড়'],
                ['name' => 'Rangpur', 'bn_name' => 'রংপুর'],
                ['name' => 'Thakurgaon', 'bn_name' => 'ঠাকুরগাঁও'],
            ],
            'Sylhet' => [
                ['name' => 'Habiganj', 'bn_name' => 'হবিগঞ্জ'],
                ['name' => 'Moulvibazar', 'bn_name' => 'মৌলভীবাজার'],
                ['name' => 'Sunamganj', 'bn_name' => 'সুনামগঞ্জ'],
                ['name' => 'Sylhet', 'bn_name' => 'সিলেট'],
            ],
        ];

        $districtIds = [];
        foreach ($districts as $divName => $dists) {
            foreach ($dists as $dist) {
                $id = Str::uuid()->toString();
                DB::table('geo_districts')->insert([
                    'id' => $id,
                    'division_id' => $divisionIds[$divName],
                    'name' => $dist['name'],
                    'bn_name' => $dist['bn_name'],
                    'status' => 'active',
                    'created_at' => now(),
                ]);
                $districtIds[$dist['name']] = $id;
            }
        }

        // Sample upazilas for major districts
        $upazilas = [
            'Dhaka' => [
                ['name' => 'Dhamrai', 'bn_name' => 'ধামরাই'],
                ['name' => 'Dohar', 'bn_name' => 'দোহার'],
                ['name' => 'Keraniganj', 'bn_name' => 'কেরানীগঞ্জ'],
                ['name' => 'Nawabganj', 'bn_name' => 'নবাবগঞ্জ'],
                ['name' => 'Savar', 'bn_name' => 'সাভার'],
            ],
            'Gazipur' => [
                ['name' => 'Gazipur Sadar', 'bn_name' => 'গাজীপুর সদর'],
                ['name' => 'Kaliakair', 'bn_name' => 'কালিয়াকৈর'],
                ['name' => 'Kaliganj', 'bn_name' => 'কালীগঞ্জ'],
                ['name' => 'Kapasia', 'bn_name' => 'কাপাসিয়া'],
                ['name' => 'Sreepur', 'bn_name' => 'শ্রীপুর'],
            ],
            'Narayanganj' => [
                ['name' => 'Araihazar', 'bn_name' => 'আড়াইহাজার'],
                ['name' => 'Bandar', 'bn_name' => 'বন্দর'],
                ['name' => 'Narayanganj Sadar', 'bn_name' => 'নারায়ণগঞ্জ সদর'],
                ['name' => 'Rupganj', 'bn_name' => 'রূপগঞ্জ'],
                ['name' => 'Sonargaon', 'bn_name' => 'সোনারগাঁও'],
            ],
            'Chattogram' => [
                ['name' => 'Anwara', 'bn_name' => 'আনোয়ারা'],
                ['name' => 'Banshkhali', 'bn_name' => 'বাঁশখালী'],
                ['name' => 'Boalkhali', 'bn_name' => 'বোয়ালখালী'],
                ['name' => 'Chandanaish', 'bn_name' => 'চন্দনাইশ'],
                ['name' => 'Fatikchhari', 'bn_name' => 'ফটিকছড়ি'],
                ['name' => 'Hathazari', 'bn_name' => 'হাটহাজারী'],
                ['name' => 'Lohagara', 'bn_name' => 'লোহাগাড়া'],
                ['name' => 'Mirsharai', 'bn_name' => 'মীরসরাই'],
                ['name' => 'Patiya', 'bn_name' => 'পটিয়া'],
                ['name' => 'Rangunia', 'bn_name' => 'রাঙ্গুনিয়া'],
                ['name' => 'Raozan', 'bn_name' => 'রাউজান'],
                ['name' => 'Sandwip', 'bn_name' => 'সন্দ্বীপ'],
                ['name' => 'Satkania', 'bn_name' => 'সাতকানিয়া'],
                ['name' => 'Sitakunda', 'bn_name' => 'সীতাকুণ্ড'],
            ],
            'Comilla' => [
                ['name' => 'Barura', 'bn_name' => 'বরুড়া'],
                ['name' => 'Brahmanpara', 'bn_name' => 'ব্রাহ্মণপাড়া'],
                ['name' => 'Burichang', 'bn_name' => 'বুড়িচং'],
                ['name' => 'Chandina', 'bn_name' => 'চান্দিনা'],
                ['name' => 'Chauddagram', 'bn_name' => 'চৌদ্দগ্রাম'],
                ['name' => 'Comilla Sadar', 'bn_name' => 'কুমিল্লা সদর'],
                ['name' => 'Daudkandi', 'bn_name' => 'দাউদকান্দি'],
                ['name' => 'Debidwar', 'bn_name' => 'দেবিদ্বার'],
                ['name' => 'Homna', 'bn_name' => 'হোমনা'],
                ['name' => 'Laksam', 'bn_name' => 'লাকসাম'],
                ['name' => 'Meghna', 'bn_name' => 'মেঘনা'],
                ['name' => 'Muradnagar', 'bn_name' => 'মুরাদনগর'],
                ['name' => 'Nangalkot', 'bn_name' => 'নাঙ্গলকোট'],
                ['name' => 'Titas', 'bn_name' => 'তিতাস'],
            ],
            'Rajshahi' => [
                ['name' => 'Bagha', 'bn_name' => 'বাঘা'],
                ['name' => 'Bagmara', 'bn_name' => 'বাগমারা'],
                ['name' => 'Charghat', 'bn_name' => 'চারঘাট'],
                ['name' => 'Durgapur', 'bn_name' => 'দুর্গাপুর'],
                ['name' => 'Godagari', 'bn_name' => 'গোদাগাড়ী'],
                ['name' => 'Mohanpur', 'bn_name' => 'মোহনপুর'],
                ['name' => 'Paba', 'bn_name' => 'পবা'],
                ['name' => 'Puthia', 'bn_name' => 'পুঠিয়া'],
                ['name' => 'Tanore', 'bn_name' => 'তানোর'],
            ],
            'Khulna' => [
                ['name' => 'Batiaghata', 'bn_name' => 'বটিয়াঘাটা'],
                ['name' => 'Dacope', 'bn_name' => 'দাকোপ'],
                ['name' => 'Dumuria', 'bn_name' => 'ডুমুরিয়া'],
                ['name' => 'Dighalia', 'bn_name' => 'দিঘলিয়া'],
                ['name' => 'Koyra', 'bn_name' => 'কয়রা'],
                ['name' => 'Paikgachha', 'bn_name' => 'পাইকগাছা'],
                ['name' => 'Phultala', 'bn_name' => 'ফুলতলা'],
                ['name' => 'Rupsa', 'bn_name' => 'রূপসা'],
                ['name' => 'Terokhada', 'bn_name' => 'তেরখাদা'],
            ],
            'Sylhet' => [
                ['name' => 'Balaganj', 'bn_name' => 'বালাগঞ্জ'],
                ['name' => 'Beanibazar', 'bn_name' => 'বিয়ানীবাজার'],
                ['name' => 'Bishwanath', 'bn_name' => 'বিশ্বনাথ'],
                ['name' => 'Companiganj', 'bn_name' => 'কোম্পানীগঞ্জ'],
                ['name' => 'Fenchuganj', 'bn_name' => 'ফেঞ্চুগঞ্জ'],
                ['name' => 'Golapganj', 'bn_name' => 'গোলাপগঞ্জ'],
                ['name' => 'Gowainghat', 'bn_name' => 'গোয়াইনঘাট'],
                ['name' => 'Jaintiapur', 'bn_name' => 'জৈন্তাপুর'],
                ['name' => 'Kanaighat', 'bn_name' => 'কানাইঘাট'],
                ['name' => 'Sylhet Sadar', 'bn_name' => 'সিলেট সদর'],
                ['name' => 'Zakiganj', 'bn_name' => 'জকিগঞ্জ'],
            ],
            'Rangpur' => [
                ['name' => 'Badarganj', 'bn_name' => 'বদরগঞ্জ'],
                ['name' => 'Gangachara', 'bn_name' => 'গঙ্গাচড়া'],
                ['name' => 'Kaunia', 'bn_name' => 'কাউনিয়া'],
                ['name' => 'Mithapukur', 'bn_name' => 'মিঠাপুকুর'],
                ['name' => 'Pirgachha', 'bn_name' => 'পীরগাছা'],
                ['name' => 'Pirganj', 'bn_name' => 'পীরগঞ্জ'],
                ['name' => 'Rangpur Sadar', 'bn_name' => 'রংপুর সদর'],
                ['name' => 'Taraganj', 'bn_name' => 'তারাগঞ্জ'],
            ],
            'Mymensingh' => [
                ['name' => 'Bhaluka', 'bn_name' => 'ভালুকা'],
                ['name' => 'Dhobaura', 'bn_name' => 'ধোবাউড়া'],
                ['name' => 'Fulbaria', 'bn_name' => 'ফুলবাড়ীয়া'],
                ['name' => 'Gaffargaon', 'bn_name' => 'গফরগাঁও'],
                ['name' => 'Gauripur', 'bn_name' => 'গৌরীপুর'],
                ['name' => 'Haluaghat', 'bn_name' => 'হালুয়াঘাট'],
                ['name' => 'Ishwarganj', 'bn_name' => 'ঈশ্বরগঞ্জ'],
                ['name' => 'Muktagachha', 'bn_name' => 'মুক্তাগাছা'],
                ['name' => 'Mymensingh Sadar', 'bn_name' => 'ময়মনসিংহ সদর'],
                ['name' => 'Nandail', 'bn_name' => 'নান্দাইল'],
                ['name' => 'Phulpur', 'bn_name' => 'ফুলপুর'],
                ['name' => 'Trishal', 'bn_name' => 'ত্রিশাল'],
            ],
            'Bogura' => [
                ['name' => 'Adamdighi', 'bn_name' => 'আদমদীঘি'],
                ['name' => 'Bogura Sadar', 'bn_name' => 'বগুড়া সদর'],
                ['name' => 'Dhunat', 'bn_name' => 'ধুনট'],
                ['name' => 'Dupchanchia', 'bn_name' => 'দুপচাঁচিয়া'],
                ['name' => 'Gabtali', 'bn_name' => 'গাবতলী'],
                ['name' => 'Kahaloo', 'bn_name' => 'কাহালু'],
                ['name' => 'Nandigram', 'bn_name' => 'নন্দীগ্রাম'],
                ['name' => 'Sariakandi', 'bn_name' => 'সারিয়াকান্দি'],
                ['name' => 'Shajahanpur', 'bn_name' => 'শাজাহানপুর'],
                ['name' => 'Sherpur', 'bn_name' => 'শেরপুর'],
                ['name' => 'Shibganj', 'bn_name' => 'শিবগঞ্জ'],
                ['name' => 'Sonatola', 'bn_name' => 'সোনাতলা'],
            ],
            'Barishal' => [
                ['name' => 'Agailjhara', 'bn_name' => 'আগৈলঝাড়া'],
                ['name' => 'Babuganj', 'bn_name' => 'বাবুগঞ্জ'],
                ['name' => 'Bakerganj', 'bn_name' => 'বাকেরগঞ্জ'],
                ['name' => 'Banaripara', 'bn_name' => 'বানারীপাড়া'],
                ['name' => 'Barishal Sadar', 'bn_name' => 'বরিশাল সদর'],
                ['name' => 'Gournadi', 'bn_name' => 'গৌরনদী'],
                ['name' => 'Hizla', 'bn_name' => 'হিজলা'],
                ['name' => 'Mehendiganj', 'bn_name' => 'মেহেন্দিগঞ্জ'],
                ['name' => 'Muladi', 'bn_name' => 'মুলাদী'],
                ['name' => 'Wazirpur', 'bn_name' => 'উজিরপুর'],
            ],
        ];

        foreach ($upazilas as $distName => $upas) {
            if (!isset($districtIds[$distName])) continue;
            foreach ($upas as $upa) {
                DB::table('geo_upazilas')->insert([
                    'id' => Str::uuid()->toString(),
                    'district_id' => $districtIds[$distName],
                    'name' => $upa['name'],
                    'bn_name' => $upa['bn_name'],
                    'status' => 'active',
                    'created_at' => now(),
                ]);
            }
        }

        echo "Bangladesh geo data seeded: " . count($divisions) . " divisions, " . array_sum(array_map('count', $districts)) . " districts, " . array_sum(array_map('count', $upazilas)) . " upazilas\n";
    }
}
