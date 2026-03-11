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
  const emergencyBackupTriggered = useRef(false);
  const safeModeNotified = useRef(false);

  const sendSafeModeNotification = useCallback(async (type: "safe_mode" | "emergency_backup", details?: string) => {
    try {
      const { data: settings } = await supabase
        .from("general_settings")
        .select("mobile, site_name")
        .limit(1)
        .single();

      if (!settings?.mobile) {
        console.warn("[SafeMode] No admin mobile number configured for notifications");
        return;
      }

      const siteName = settings.site_name || "Smart ISP";
      const message = type === "safe_mode"
        ? `🚨 [${siteName}] CRITICAL: Safe Mode activated! Database connectivity lost after multiple failures. Immediate attention required. ${details || ""}`
        : `⚠️ [${siteName}] Emergency backup created automatically due to system instability. ${details || ""}`;

      await supabase.functions.invoke("send-sms", {
        body: {
          to: settings.mobile,
          message,
          sms_type: "manual",
        },
      });
      console.log(`[SafeMode] ${type} SMS notification sent to ${settings.mobile}`);
    } catch (err: any) {
      console.error("[SafeMode] Failed to send notification:", err.message);
    }
  }, []);

  const triggerEmergencyBackup = useCallback(async () => {
    if (emergencyBackupTriggered.current) return;
    emergencyBackupTriggered.current = true;
    console.warn("[SafeMode] Triggering automatic emergency backup before safe mode activation...");
    try {
      const { error } = await supabase.functions.invoke("backup-restore", {
        body: { action: "emergency" },
      });
      if (error) {
        console.error("[SafeMode] Emergency backup failed:", error.message);
      } else {
        console.log("[SafeMode] Emergency backup created successfully.");
        sendSafeModeNotification("emergency_backup");
      }
    } catch (err: any) {
      console.error("[SafeMode] Emergency backup error:", err.message);
    }
  }, [sendSafeModeNotification]);

  const checkHealth = useCallback(async () => {
    setHealth((h) => ({ ...h, checking: true }));
    try {
      // Simple ping - select count from a small table
      const { error } = await supabase
        .from("general_settings")
        .select("id", { count: "exact", head: true });

      if (error) {
        failureCount.current += 1;
        const willActivateSafeMode = failureCount.current >= FAILURE_THRESHOLD;
        // Trigger emergency backup just before safe mode activates
        if (failureCount.current === FAILURE_THRESHOLD - 1) {
          triggerEmergencyBackup();
        }
        setHealth((h) => ({
          ...h,
          dbConnected: false,
          lastCheck: new Date(),
          consecutiveFailures: failureCount.current,
          safeModeActive: willActivateSafeMode,
          checking: false,
          error: error.message,
        }));
      } else {
        failureCount.current = 0;
        emergencyBackupTriggered.current = false;
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
      if (failureCount.current === FAILURE_THRESHOLD - 1) {
        triggerEmergencyBackup();
      }
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
  }, [triggerEmergencyBackup]);

  const dismissSafeMode = useCallback(() => {
    failureCount.current = 0;
    emergencyBackupTriggered.current = false;
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
