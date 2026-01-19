-- Create a database function to automatically trigger processing when a job is queued
-- This is more reliable than HTTP-based triggers

CREATE OR REPLACE FUNCTION trigger_card_processing()
RETURNS TRIGGER AS $$
DECLARE
  processing_url text;
  anon_key text;
BEGIN
  -- Only trigger for newly inserted 'queued' jobs
  IF (TG_OP = 'INSERT' AND NEW.status = 'queued') THEN
    -- Get the Supabase URL and anon key from environment
    -- Note: This requires the http extension
    
    -- Determine which processing function to call based on generation_type or card_data
    processing_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-full-bleed-card-generation';
    
    -- Make async HTTP call using pg_net (if available) or http extension
    -- This is a fire-and-forget trigger
    PERFORM net.http_post(
      url := processing_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
      ),
      body := jsonb_build_object('jobId', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on image_generation_queue table
DROP TRIGGER IF EXISTS auto_process_card_generation ON image_generation_queue;

CREATE TRIGGER auto_process_card_generation
  AFTER INSERT ON image_generation_queue
  FOR EACH ROW
  EXECUTE FUNCTION trigger_card_processing();
