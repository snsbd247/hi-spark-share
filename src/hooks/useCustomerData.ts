import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

interface FetchOptions {
  include_profile?: boolean;
  include_bills?: boolean;
  include_payments?: boolean;
  include_ledger?: boolean;
}

export async function fetchCustomerData(sessionToken: string, options: FetchOptions) {
  const { data } = await axios.post(`${API_BASE_URL}/customer/verify`, {
    session_token: sessionToken,
    ...options,
  });
  return data;
}
