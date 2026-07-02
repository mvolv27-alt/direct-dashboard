-- Enable RLS on realtime.messages (Supabase requires policies for channel access)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to subscribe to the team-shared channel topics
DROP POLICY IF EXISTS "authenticated can read team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can read team realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros')
  OR realtime.topic() LIKE 'realtime:public:%'
);

-- Allow authenticated users to broadcast/presence on the same topics (needed for postgres_changes)
DROP POLICY IF EXISTS "authenticated can write team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can write team realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros')
  OR realtime.topic() LIKE 'realtime:public:%'
);
