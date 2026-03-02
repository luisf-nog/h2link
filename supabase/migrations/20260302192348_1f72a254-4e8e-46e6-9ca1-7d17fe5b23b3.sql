
-- Allow authenticated users to insert their own employer_profiles
CREATE POLICY "ep_insert_own" ON public.employer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert their own role (once, during signup)
CREATE POLICY "ur_insert_own" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
