
-- Admin Sessions table for concurrent login approval
CREATE TABLE public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Unknown Device',
  browser TEXT NOT NULL DEFAULT 'Unknown Browser',
  ip_address TEXT NOT NULL DEFAULT '0.0.0.0',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view their own sessions
CREATE POLICY "Users can view own sessions"
ON public.admin_sessions
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

-- RLS: Admins can insert their own sessions
CREATE POLICY "Users can insert own sessions"
ON public.admin_sessions
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

-- RLS: Admins can update their own sessions
CREATE POLICY "Users can update own sessions"
ON public.admin_sessions
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- RLS: Admins can delete their own sessions
CREATE POLICY "Users can delete own sessions"
ON public.admin_sessions
FOR DELETE
TO authenticated
USING (admin_id = auth.uid());

-- Super admins can manage all sessions
CREATE POLICY "Super admins can manage all sessions"
ON public.admin_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Enable realtime for admin_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE admin_sessions;

-- Admin Login Logs table
CREATE TABLE public.admin_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  device_name TEXT,
  browser TEXT,
  ip_address TEXT,
  session_id UUID REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login logs"
ON public.admin_login_logs
FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

CREATE POLICY "Users can insert own login logs"
ON public.admin_login_logs
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Super admins can view all login logs"
ON public.admin_login_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));
