import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/supabase/client";
import { useResellerAuth } from "@/contexts/ResellerAuthContext";
import ResellerLayout from "@/components/reseller/ResellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Lock, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function ResellerProfile() {
  const { reseller, signOut } = useResellerAuth();
  const queryClient = useQueryClient();
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["reseller-profile", reseller?.id],
    queryFn: async () => {
      const { data } = await (db as any)
        .from("resellers")
        .select("name, company_name, phone, email, address, commission_rate, wallet_balance, created_at")
        .eq("id", reseller!.id)
        .single();
      return data;
    },
    enabled: !!reseller?.id,
  });

  const [profileForm, setProfileForm] = useState({ name: "", company_name: "", phone: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [profileLoaded, setProfileLoaded] = useState(false);

  if (profile && !profileLoaded) {
    setProfileForm({
      name: profile.name || "",
      company_name: profile.company_name || "",
      phone: profile.phone || "",
      address: profile.address || "",
    });
    setProfileLoaded(true);
  }

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profileForm.name) throw new Error("Name is required");
      const { error } = await (db as any).from("resellers").update({
        name: profileForm.name,
        company_name: profileForm.company_name,
        phone: profileForm.phone,
        address: profileForm.address,
        updated_at: new Date().toISOString(),
      }).eq("id", reseller!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["reseller-profile"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!passwordForm.old_password || !passwordForm.new_password) throw new Error("All fields required");
      if (passwordForm.new_password.length < 6) throw new Error("Password must be at least 6 characters");
      if (passwordForm.new_password !== passwordForm.confirm_password) throw new Error("Passwords do not match");

      const payload = {
        reseller_id: reseller!.id,
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      };

      const { data, error } = await db.functions.invoke("reseller-change-password", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Password change failed");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResellerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" /> Profile Settings
          </h1>
          <p className="text-muted-foreground mt-1">Update your profile and password</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Profile Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={profile?.email || ""} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Commission Rate</Label>
                    <Input value={`${profile?.commission_rate || 0}%`} disabled className="bg-muted" />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name</Label>
                    <Input value={profileForm.company_name} onChange={(e) => setProfileForm({ ...profileForm, company_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} />
                  </div>
                </div>
                <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showOld ? "text" : "password"}
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-0 h-full" onClick={() => setShowOld(!showOld)}>
                      {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNew ? "text" : "password"}
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-0 h-full" onClick={() => setShowNew(!showNew)}>
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending} variant="outline">
                  {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ResellerLayout>
  );
}
