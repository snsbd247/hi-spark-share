ALTER TABLE customer_devices
  ADD CONSTRAINT fk_customer_devices_customer
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE customer_devices
  ADD CONSTRAINT fk_customer_devices_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;