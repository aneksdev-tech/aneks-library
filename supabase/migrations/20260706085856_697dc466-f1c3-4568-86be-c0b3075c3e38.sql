
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'lecturer', 'researcher');
CREATE TYPE public.account_status AS ENUM ('active', 'pending', 'rejected', 'suspended', 'inactive');
CREATE TYPE public.resource_status AS ENUM ('pending', 'approved', 'rejected', 'archived', 'draft');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  college TEXT,
  department TEXT,
  level TEXT,
  status public.account_status NOT NULL DEFAULT 'active',
  primary_role public.app_role NOT NULL DEFAULT 'student',
  reputation INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate from profiles) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security definer role checker (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin'::public.app_role) $$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============ RESOURCES ============
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  course_code TEXT,
  department TEXT,
  level TEXT,
  author TEXT,
  year INT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  thumbnail_path TEXT,
  status public.resource_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  download_count INT NOT NULL DEFAULT 0,
  bookmark_count INT NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_status ON public.resources(status);
CREATE INDEX idx_resources_uploader ON public.resources(uploader_id);
CREATE INDEX idx_resources_category ON public.resources(category_id);
CREATE INDEX idx_resources_created ON public.resources(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT SELECT ON public.resources TO anon;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- ============ BOOKMARKS ============
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- ============ DOWNLOADS ============
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_downloads_user ON public.downloads(user_id);
CREATE INDEX idx_downloads_resource ON public.downloads(resource_id);
GRANT SELECT, INSERT ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage all profiles" ON public.profiles FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- categories
CREATE POLICY "Categories readable by all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- resources
CREATE POLICY "Approved resources public read" ON public.resources FOR SELECT
  USING (status = 'approved');
CREATE POLICY "Uploaders view own resources" ON public.resources FOR SELECT
  USING (auth.uid() = uploader_id);
CREATE POLICY "Admins view all resources" ON public.resources FOR SELECT
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated users can upload" ON public.resources FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Uploaders edit pending" ON public.resources FOR UPDATE
  USING (auth.uid() = uploader_id AND status IN ('pending','draft','rejected'))
  WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Uploaders delete pending" ON public.resources FOR DELETE
  USING (auth.uid() = uploader_id AND status IN ('pending','draft','rejected'));
CREATE POLICY "Admins manage all resources" ON public.resources FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- bookmarks
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- downloads
CREATE POLICY "Users view own downloads" ON public.downloads FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Authenticated log downloads" ON public.downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- notifications
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- activity_logs
CREATE POLICY "Users view own activity" ON public.activity_logs FOR SELECT
  USING (auth.uid() = actor_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users log own activity" ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- ============ TRIGGERS ============

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_resources_updated BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + role on signup, honoring signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_status public.account_status;
  v_role_text TEXT;
BEGIN
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  BEGIN
    v_role := v_role_text::public.app_role;
    IF v_role = 'admin' THEN v_role := 'student'; END IF; -- never allow admin via signup
  EXCEPTION WHEN others THEN v_role := 'student'; END;

  v_status := CASE WHEN v_role = 'student' THEN 'active'::public.account_status
                   ELSE 'pending'::public.account_status END;

  INSERT INTO public.profiles (id, email, full_name, college, department, level, primary_role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN v_role = 'student' THEN NEW.raw_user_meta_data->>'college' END,
    CASE WHEN v_role = 'student' THEN NEW.raw_user_meta_data->>'department' END,
    CASE WHEN v_role = 'student' THEN NEW.raw_user_meta_data->>'level' END,
    v_role,
    v_status
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notify uploader when resource is approved/rejected
CREATE OR REPLACE FUNCTION public.notify_resource_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (NEW.uploader_id, 'Upload approved', 'Your resource "' || NEW.title || '" has been approved.', '/library');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (NEW.uploader_id, 'Upload rejected', COALESCE(NEW.rejection_reason, 'Your resource was rejected by an admin.'), '/dashboard/my-uploads');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_resource_status_notify
  AFTER UPDATE OF status ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.notify_resource_status();

-- Increment download count
CREATE OR REPLACE FUNCTION public.bump_download_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.resources SET download_count = download_count + 1 WHERE id = NEW.resource_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bump_download AFTER INSERT ON public.downloads
  FOR EACH ROW EXECUTE FUNCTION public.bump_download_count();

-- Bookmark count sync
CREATE OR REPLACE FUNCTION public.sync_bookmark_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.resources SET bookmark_count = bookmark_count + 1 WHERE id = NEW.resource_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.resources SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.resource_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_bookmark_ins AFTER INSERT ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.sync_bookmark_count();
CREATE TRIGGER trg_bookmark_del AFTER DELETE ON public.bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.sync_bookmark_count();

-- ============ SEED CATEGORIES ============
INSERT INTO public.categories (slug, name, description, icon, sort_order) VALUES
  ('past-questions', 'Past Questions', 'Previous exam and test papers', 'FileQuestion', 1),
  ('projects', 'Projects', 'Final year and semester project reports', 'FolderKanban', 2),
  ('seminars', 'Seminars', 'Seminar papers and presentations', 'Presentation', 3),
  ('assignments', 'Assignments', 'Course assignments and solutions', 'ClipboardList', 4),
  ('lecture-notes', 'Lecture Notes', 'Course notes and study materials', 'NotebookPen', 5),
  ('research-papers', 'Research Papers', 'Academic research and publications', 'FlaskConical', 6),
  ('e-books', 'E-books', 'Textbooks and reference books', 'BookOpen', 7);
