CREATE TABLE IF NOT EXISTS network_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'onu',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  parent_id uuid REFERENCES network_nodes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'online',
  device_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_nodes_tenant ON network_nodes(tenant_id);
CREATE INDEX idx_network_nodes_type ON network_nodes(tenant_id, type);

CREATE TABLE IF NOT EXISTS network_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
  link_type text DEFAULT 'fiber',
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_links_tenant ON network_links(tenant_id);

ALTER TABLE network_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_access" ON network_nodes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON network_nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_access" ON network_links FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_access" ON network_links FOR ALL TO authenticated USING (true) WITH CHECK (true);