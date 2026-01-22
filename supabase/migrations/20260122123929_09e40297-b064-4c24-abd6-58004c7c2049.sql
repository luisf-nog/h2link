-- Create enum for plan tiers
CREATE TYPE public.plan_tier AS ENUM ('free', 'gold', 'diamond');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan_tier plan_tier NOT NULL DEFAULT 'free',
  credits_used_today INT NOT NULL DEFAULT 0,
  credits_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create public_jobs table (imported from government)
CREATE TABLE public.public_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT NOT NULL,
  category TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  salary NUMERIC(10,2),
  start_date DATE,
  posted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Premium columns
  housing_info TEXT,
  transport_provided BOOLEAN DEFAULT false,
  tools_provided BOOLEAN DEFAULT false,
  weekly_hours INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create my_queue table (user's job queue)
CREATE TABLE public.my_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.public_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.my_queue ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Public jobs RLS policies (all authenticated users can read)
CREATE POLICY "Authenticated users can view jobs"
  ON public.public_jobs FOR SELECT
  TO authenticated
  USING (true);

-- My queue RLS policies
CREATE POLICY "Users can view own queue"
  ON public.my_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to own queue"
  ON public.my_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue"
  ON public.my_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from own queue"
  ON public.my_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample job data for testing
INSERT INTO public.public_jobs (job_id, company, email, job_title, category, city, state, salary, start_date, housing_info, transport_provided, tools_provided, weekly_hours) VALUES
('H2B-2024-001', 'Coastal Seafood Processing', 'jobs@coastalseafood.com', 'Seafood Processor', 'Food Processing', 'Biloxi', 'MS', 14.50, '2024-04-01', 'Company housing available at $75/week', true, true, 40),
('H2B-2024-002', 'Mountain Resort LLC', 'hr@mountainresort.com', 'Housekeeper', 'Hospitality', 'Aspen', 'CO', 16.00, '2024-05-15', 'Shared dormitory included', true, false, 35),
('H2B-2024-003', 'Green Valley Landscaping', 'apply@greenvalley.com', 'Landscape Worker', 'Landscaping', 'Tampa', 'FL', 15.25, '2024-03-01', NULL, false, true, 45),
('H2B-2024-004', 'Ocean View Hotels', 'careers@oceanview.com', 'Kitchen Staff', 'Hospitality', 'Miami Beach', 'FL', 14.00, '2024-06-01', 'Housing assistance available', true, true, 40),
('H2B-2024-005', 'Northern Timber Co', 'jobs@northerntimber.com', 'Forestry Worker', 'Agriculture', 'Portland', 'OR', 17.50, '2024-04-15', 'Camp housing provided', true, true, 50),
('H2B-2024-006', 'Sunny Farms Inc', 'hr@sunnyfarms.com', 'Farm Worker', 'Agriculture', 'Fresno', 'CA', 16.50, '2024-03-15', 'On-site housing at $50/week', true, true, 48),
('H2B-2024-007', 'Premier Golf Club', 'employment@premiergolf.com', 'Golf Course Maintenance', 'Landscaping', 'Scottsdale', 'AZ', 15.00, '2024-04-01', NULL, false, true, 40),
('H2B-2024-008', 'Seaside Crab House', 'hiring@seasidecrab.com', 'Crab Picker', 'Food Processing', 'Baltimore', 'MD', 13.50, '2024-05-01', 'Shared housing available', true, false, 45);