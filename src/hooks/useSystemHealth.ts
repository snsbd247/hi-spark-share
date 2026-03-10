import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SystemHealth {
  dbConnected: boolean;
  lastCheck: Date | null;
  consecutiveFailures: number;
  safeModeActive: boolean;
  checking: boolean;
  error: string | null;
}

const FAILURE_THRESHOLD = 3;
const CHECK_INTERVAL = 30_000; // 30 seconds

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>({
    dbConnected: true,
    lastCheck: null,
    consecutiveFailures: 0,
    safeModeActive: false,
    checking: false,
    error: null,
  });
  const failureCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const checkHealth = useCallback(async () => {
    setHealth((h) => ({ ...h, checking: true }));
    try {
      // Simple ping - select count from a small table
      const { error } = await supabase
        .from("general_settings")
        .select("id", { count: "exact", head: true });

      if (error) {
        failureCount.current += 1;
        setHealth((h) => ({
          ...h,
          dbConnected: false,
          lastCheck: new Date(),
          consecutiveFailures: failureCount.current,
          safeModeActive: failureCount.current >= FAILURE_THRESHOLD,
          checking: false,
          error: error.message,
        }));
      } else {
        failureCount.current = 0;
        setHealth((h) => ({
          ...h,
          dbConnected: true,
          lastCheck: new Date(),
          consecutiveFailures: 0,
          safeModeActive: false,
          checking: false,
          error: null,
        }));
      }
    } catch (err: any) {
      failureCount.current += 1;
      setHealth((h) => ({
        ...h,
        dbConnected: false,
        lastCheck: new Date(),
        consecutiveFailures: failureCount.current,
        safeModeActive: failureCount.current >= FAILURE_THRESHOLD,
        checking: false,
        error: err.message || "Connection failed",
      }));
    }
  }, []);

  const dismissSafeMode = useCallback(() => {
    failureCount.current = 0;
    setHealth((h) => ({
      ...h,
      safeModeActive: false,
      consecutiveFailures: 0,
    }));
  }, []);

  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(checkHealth, CHECK_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkHealth]);

  return { ...health, checkHealth, dismissSafeMode };
}
