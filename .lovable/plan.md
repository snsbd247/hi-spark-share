

## Problem

Customer Devices তৈরি হচ্ছে কিন্তু লিস্টে দেখা যাচ্ছে না। কারণ: `customer_devices` টেবিলে `customers` এবং `products` টেবিলের সাথে কোনো **Foreign Key** নেই। Supabase-এর join query (`select("*,customer:customers(...)")`) কাজ করতে FK লাগে — FK ছাড়া query fail করে এবং `data` null আসে।

Database-এ ২টি রেকর্ড আছে, RLS ঠিক আছে, কিন্তু join query fail হওয়ায় UI-তে "No devices found" দেখাচ্ছে।

## Fix

### Step 1: Add Foreign Keys (Migration)

`customer_devices` টেবিলে দুটি FK constraint যোগ করা হবে:
- `customer_id` → `customers(id)` (ON DELETE CASCADE)
- `product_id` → `products(id)` (ON DELETE SET NULL)

```sql
ALTER TABLE customer_devices
  ADD CONSTRAINT fk_customer_devices_customer
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_devices
  ADD CONSTRAINT fk_customer_devices_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
```

### Step 2: Add error logging in query

`CustomerDevices.tsx`-এ query-তে error handling যোগ করা হবে যাতে ভবিষ্যতে কোনো সমস্যা হলে console-এ দেখা যায়:

```typescript
const { data, error } = await (db as any).from("customer_devices")
  .select("*,customer:customers(name,customer_id),product:products(name)")
  .order("assigned_at", { ascending: false });
if (error) throw error;
return data || [];
```

## Impact
- শুধু একটি migration এবং minor error handling যোগ হবে
- কোনো existing module পরিবর্তন হবে না

