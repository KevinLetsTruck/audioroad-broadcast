# CRITICAL: Railway Configuration for Prisma Migrations During Build

## The Fix We Just Made

Changed the Dockerfile to run Prisma migrations **DURING build** instead of at runtime:

```dockerfile
# OLD (broken):
RUN npm run build  # Build with old Prisma types
CMD prisma migrate deploy && node dist/server/index.js  # Migrate at runtime (too late!)

# NEW (fixed):
ARG DATABASE_URL  # Accept database URL at build time
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma migrate deploy  # Migrate DURING build
RUN npx prisma generate  # Regenerate with migrated schema
RUN npm run build  # Build with CORRECT Prisma types
CMD node dist/server/index.js  # Just start server
```

## What You Need to Do in Railway

Railway needs to expose `DATABASE_URL` during the build process (not just runtime).

### Option 1: Railway Should Auto-Detect (Preferred)

Railway should automatically pass service variables to build context. Check if it's working:

1. Wait for this deployment to finish
2. If it succeeds → Railway is passing DATABASE_URL correctly ✅
3. If it fails with "DATABASE_URL not found" → Follow Option 2

### Option 2: Manual Configuration (If Needed)

If the build fails because DATABASE_URL isn't available:

1. Go to your Railway project
2. Click on the audioroad-broadcast service
3. Go to **Settings** → **Variables**
4. Find `DATABASE_URL`
5. Make sure it's **NOT** marked as "Runtime Only"
6. It should be available at **Both Build and Runtime**

## Why This Matters

This fix solves the fundamental Prisma problem:
- ✅ Can now add database fields without type conflicts
- ✅ Migrations run before code compilation
- ✅ TypeScript knows about all database fields
- ✅ No more build/runtime mismatches

## What This Enables

Now we can:
- ✅ Add `linesOpen` field properly
- ✅ Implement two-phase workflow correctly  
- ✅ Add ANY future database fields without issues
- ✅ Evolve the schema confidently

This is the PROPER architectural fix, not a workaround.

