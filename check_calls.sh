#!/bin/bash
echo "🔍 Checking recent calls in database..."
psql "$DATABASE_URL" -c "
SELECT 
  id,
  status,
  \"twilioCallSid\",
  \"incomingAt\",
  \"episodeId\",
  CASE 
    WHEN \"incomingAt\" > NOW() - INTERVAL '10 minutes' THEN '🟢 Recent'
    WHEN \"incomingAt\" > NOW() - INTERVAL '30 minutes' THEN '🟡 Last 30min'
    ELSE '🔴 Old'
  END as age
FROM \"Call\"
WHERE \"episodeId\" = 'cmhzj2l0y0001yu7p7bm1pmo0'
ORDER BY \"incomingAt\" DESC
LIMIT 10;
" 2>&1
