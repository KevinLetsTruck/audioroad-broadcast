# Quick Fix: Remove Duplicate Show

You have a duplicate "Trucking Technology" show with wrong schedule.

## Quick Fix

**Run this command in your terminal:**

```bash
curl -X DELETE https://audioroad-broadcast-production.up.railway.app/api/shows/cmgsjb3gn00026vpbfostmxuo
```

This deletes the OLD show (the one with wrong time).

## Then

Refresh your browser and you should see the correct times!

---

## Or Manual Fix

1. We need to add a DELETE endpoint to the shows API
2. Then you can delete shows via the UI

Want me to add that?

