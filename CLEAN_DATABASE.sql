-- Clean up all test calls and callers
-- Run this in Railway's PostgreSQL console to start fresh

-- Delete all calls
DELETE FROM "Call";

-- Delete all test callers (keep any real ones you want)
DELETE FROM "Caller" WHERE "phoneNumber" LIKE 'web-%';
DELETE FROM "Caller" WHERE "phoneNumber" LIKE 'screened-%';

-- Verify cleanup
SELECT COUNT(*) as remaining_calls FROM "Call";
SELECT COUNT(*) as remaining_callers FROM "Caller";

