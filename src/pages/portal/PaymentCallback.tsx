import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import api from "@/lib/api";

export default function PaymentCallback() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [trxID, setTrxID] = useState("");

  useEffect(() => {
    const paymentID = searchParams.get("paymentID") || localStorage.getItem("bkash_payment_id");
    const bkashStatus = searchParams.get("status");

    if (!paymentID) {
      setStatus("failed");
      return;
    }

    if (bkashStatus === "cancel" || bkashStatus === "failure") {
      setStatus("failed");
      localStorage.removeItem("bkash_payment_id");
      return;
    }

    const executePayment = async () => {
      try {
        const { data } = await api.post("/bkash/execute-payment", { paymentID });

        if (data.success) {
          setStatus("success");
          setTrxID(data.trxID || "");
        } else {
          setStatus("failed");
        }
      } catch {
        setStatus("failed");
      } finally {
        localStorage.removeItem("bkash_payment_id");
      }
    };

    executePayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="glass-card w-full max-w-md animate-fade-in">
        <CardContent className="p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground">{t.portal.processingPayment}</h2>
              <p className="text-muted-foreground mt-2">{t.portal.pleaseWaitPayment}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t.portal.paymentSuccessful}</h2>
              <p className="text-muted-foreground mt-2">{t.portal.paymentSuccessDesc}</p>
              {trxID && (
                <p className="text-sm font-mono mt-3 text-muted-foreground">
                  {t.portal.transactionId}: <span className="font-semibold text-foreground">{trxID}</span>
                </p>
              )}
              <Button className="mt-6" onClick={() => navigate("/portal/bills")}>
                {t.portal.backToBills}
              </Button>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t.portal.paymentFailed}</h2>
              <p className="text-muted-foreground mt-2">{t.portal.paymentFailedDesc}</p>
              <Button className="mt-6" onClick={() => navigate("/portal/bills")}>
                {t.portal.backToBills}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
