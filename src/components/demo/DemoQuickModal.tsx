import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import DemoRequestForm from "./DemoRequestForm";

interface DemoQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta?: Record<string, any>;
}

export default function DemoQuickModal({ open, onOpenChange, meta = {} }: DemoQuickModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{meta.demo_form_title || "Request a Free Demo"}</DialogTitle>
          <DialogDescription>
            {meta.demo_form_subtitle || "ডেমো রিকুয়েস্ট করুন, আমরা আপনার জন্য ডেমো সেটআপ করে দিব।"}
          </DialogDescription>
        </DialogHeader>

        <DemoRequestForm
          compact
          meta={meta}
          onSuccess={() => setTimeout(() => onOpenChange(false), 2500)}
        />

        <div className="text-center pt-2 border-t border-border">
          <Button
            variant="link"
            className="text-sm"
            onClick={() => { onOpenChange(false); navigate("/demo-request"); }}
          >
            Open Full Form <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
