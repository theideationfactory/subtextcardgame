/*
  # Add User Trigger

  1. Changes
    - Add trigger to automatically insert users into public.users table when they sign up
    - Add function to handle the trigger
    - Backfill existing users from auth.users into public.users table

  2. Security
    - Function is set as SECURITY DEFINER to run with elevated privileges
    - Search path is explicitly set to avoid search path hijacking
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;