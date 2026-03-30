import api from "@/lib/api";

interface FetchOptions {
  include_profile?: boolean;
  include_bills?: boolean;
  include_payments?: boolean;
  include_ledger?: boolean;
}

export async function fetchCustomerData(sessionToken: string, options: FetchOptions) {
  const { data } = await api.post("/customer/verify", {
    session_token: sessionToken,
    ...options,
  });
  return data;
}
