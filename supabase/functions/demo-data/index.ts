import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, company_name")
      .eq("id", tenant_id)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, number> = {};

    // 1. Create demo packages
    const packages = [
      { name: "Basic 10 Mbps", speed: "10 Mbps", monthly_price: 500, download_speed: 10, upload_speed: 5, tenant_id },
      { name: "Standard 20 Mbps", speed: "20 Mbps", monthly_price: 800, download_speed: 20, upload_speed: 10, tenant_id },
      { name: "Premium 50 Mbps", speed: "50 Mbps", monthly_price: 1200, download_speed: 50, upload_speed: 25, tenant_id },
      { name: "Ultra 100 Mbps", speed: "100 Mbps", monthly_price: 2000, download_speed: 100, upload_speed: 50, tenant_id },
    ];

    const { data: createdPkgs } = await supabase
      .from("packages")
      .insert(packages)
      .select("id");
    results.packages = createdPkgs?.length || 0;

    const pkgIds = createdPkgs?.map((p: any) => p.id) || [];

    // 2. Create demo zones
    const zones = [
      { area_name: "Zone A - Downtown", address: "Main Street Area", tenant_id },
      { area_name: "Zone B - Uptown", address: "North District", tenant_id },
      { area_name: "Zone C - Industrial", address: "Factory Road Area", tenant_id },
    ];
    const { data: createdZones } = await supabase.from("zones").insert(zones).select("id");
    results.zones = createdZones?.length || 0;

    // 3. Create demo customers
    const areas = ["Downtown", "Uptown", "Industrial", "Residential", "Commercial"];
    const firstNames = ["Rahim", "Karim", "Jamal", "Nasir", "Faruk", "Salim", "Hamid", "Rashid", "Kabir", "Shakil",
      "Fatima", "Aisha", "Nadia", "Sultana", "Ruma", "Shirin", "Mina", "Halima", "Rehana", "Josna"];
    const lastNames = ["Ahmed", "Hossain", "Rahman", "Islam", "Uddin", "Begum", "Khatun", "Akter", "Mia", "Khan"];

    const customers = [];
    for (let i = 1; i <= 20; i++) {
      const fn = firstNames[i - 1];
      const ln = lastNames[i % lastNames.length];
      customers.push({
        customer_id: `CUST-${String(i).padStart(4, "0")}`,
        name: `${fn} ${ln}`,
        father_name: `Mr. ${lastNames[(i + 3) % lastNames.length]}`,
        phone: `0171${String(1000000 + i).slice(1)}`,
        area: areas[i % areas.length],
        package_id: pkgIds[i % pkgIds.length] || null,
        monthly_bill: packages[i % packages.length].monthly_price,
        pppoe_username: `user${i}`,
        pppoe_password: `pass${i}`,
        ip_address: `192.168.1.${100 + i}`,
        status: i <= 18 ? "active" : "suspended",
        connection_status: i <= 18 ? "active" : "suspended",
        tenant_id,
        due_date_day: (i % 28) + 1,
        email: `${fn.toLowerCase()}@example.com`,
      });
    }

    const { data: createdCustomers } = await supabase
      .from("customers")
      .insert(customers)
      .select("id, monthly_bill");
    results.customers = createdCustomers?.length || 0;

    // 4. Create demo bills
    const currentMonth = new Date().toISOString().slice(0, 7);
    const prevMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 7);
    const bills = [];

    for (const cust of createdCustomers || []) {
      // Previous month bill (paid)
      bills.push({
        customer_id: cust.id,
        month: prevMonth,
        amount: cust.monthly_bill,
        status: "paid",
        paid_date: new Date(Date.now() - 15 * 86400000).toISOString(),
        tenant_id,
      });
      // Current month bill (mix of paid/unpaid)
      bills.push({
        customer_id: cust.id,
        month: currentMonth,
        amount: cust.monthly_bill,
        status: Math.random() > 0.4 ? "unpaid" : "paid",
        paid_date: Math.random() > 0.4 ? null : new Date().toISOString(),
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
        tenant_id,
      });
    }

    const { data: createdBills } = await supabase.from("bills").insert(bills).select("id, customer_id, status, amount");
    results.bills = createdBills?.length || 0;

    // 5. Create demo payments for paid bills
    const payments = [];
    const methods = ["cash", "bkash", "nagad", "bank"];

    for (const bill of (createdBills || []).filter((b: any) => b.status === "paid")) {
      payments.push({
        customer_id: bill.customer_id,
        bill_id: bill.id,
        amount: bill.amount,
        payment_method: methods[Math.floor(Math.random() * methods.length)],
        status: "completed",
        tenant_id,
      });
    }

    const { data: createdPayments } = await supabase.from("payments").insert(payments).select("id");
    results.payments = createdPayments?.length || 0;

    return new Response(
      JSON.stringify({ success: true, tenant: tenant.company_name, created: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
