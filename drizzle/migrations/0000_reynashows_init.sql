CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  video_path text NOT NULL,
  thumbnail_path text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movies_created_idx ON public.movies(created_at DESC);
GRANT SELECT ON public.movies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.movies TO authenticated;
GRANT ALL ON public.movies TO service_role;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movies public read" ON public.movies FOR SELECT USING (true);
CREATE POLICY "movies own insert" ON public.movies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "movies own update" ON public.movies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "movies own delete" ON public.movies FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.movie_likes (
  movie_id uuid NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (movie_id, user_id)
);
GRANT SELECT ON public.movie_likes TO authenticated;
GRANT ALL ON public.movie_likes TO service_role;
ALTER TABLE public.movie_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes own read" ON public.movie_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_view(_movie_id uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.movies SET views = views + 1 WHERE id = _movie_id RETURNING views;
$$;
GRANT EXECUTE ON FUNCTION public.increment_view(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_like(_movie_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); liked boolean; total integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM movie_likes WHERE movie_id=_movie_id AND user_id=uid) THEN
    DELETE FROM movie_likes WHERE movie_id=_movie_id AND user_id=uid;
    UPDATE movies SET likes = GREATEST(likes-1,0) WHERE id=_movie_id RETURNING likes INTO total;
    liked := false;
  ELSE
    INSERT INTO movie_likes(movie_id,user_id) VALUES (_movie_id,uid);
    UPDATE movies SET likes = likes+1 WHERE id=_movie_id RETURNING likes INTO total;
    liked := true;
  END IF;
  RETURN json_build_object('liked', liked, 'likes', total);
END $$;
REVOKE EXECUTE ON FUNCTION public.toggle_like(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.toggle_like(uuid) TO authenticated;

CREATE TABLE public.ai_requests (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_user_idx ON public.ai_requests(user_id, created_at DESC);
GRANT ALL ON public.ai_requests TO service_role;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Quota: 20 per minute, 90 per 24 hours, per user
CREATE OR REPLACE FUNCTION public.consume_ai_quota() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); per_min integer; per_day integer;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'reason', 'Sign in to use AI features'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT count(*) INTO per_min FROM ai_requests WHERE user_id=uid AND created_at > now() - interval '1 minute';
  IF per_min >= 20 THEN RETURN json_build_object('ok', false, 'reason', 'Too many AI requests — wait a minute'); END IF;
  SELECT count(*) INTO per_day FROM ai_requests WHERE user_id=uid AND created_at > now() - interval '24 hours';
  IF per_day >= 90 THEN RETURN json_build_object('ok', false, 'reason', 'Daily AI limit of 90 reached'); END IF;
  INSERT INTO ai_requests(user_id) VALUES (uid);
  RETURN json_build_object('ok', true, 'remaining', 89 - per_day);
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;

CREATE POLICY "media read" ON storage.objects FOR SELECT USING (bucket_id IN ('videos','thumbnails'));
CREATE POLICY "media own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('videos','thumbnails') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "media own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('videos','thumbnails') AND (storage.foldername(name))[1] = auth.uid()::text);