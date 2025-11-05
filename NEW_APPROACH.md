# New Approach: Use Existing Fields

## The Problem with Adding linesOpen

Every time we add new database fields, we hit Prisma build/runtime cycle issues:
- Prisma Client generated at BUILD time (before migration)
- Migration runs at START time (adds columns)
- TypeScript compiled with OLD Prisma types
- Runtime Prisma knows about columns but compiled code doesn't

## The Solution: Use Existing Fields

Use fields that ALREADY EXIST in the database:

### Existing Field: `conferenceActive`
- Type: Boolean
- Default: false
- Already in schema ✓
- Already in database ✓  
- Prisma already knows about it ✓

### Two-Phase States

**Phase 1: Phone Lines Open**
```
status = 'scheduled'
conferenceActive = true
```

**Phase 2: Show Live**
```
status = 'live'  
conferenceActive = true
```

### Backend Logic

**Find episode with lines open:**
```typescript
const linesOpenEpisode = await prisma.episode.findFirst({
  where: {
    status: 'scheduled',
    conferenceActive: true
  },
  orderBy: { scheduledStart: 'desc' }
});
```

**Find live episode:**
```typescript
const liveEpisode = await prisma.episode.findFirst({
  where: { status: 'live' },
  orderBy: { scheduledStart: 'desc' }
});
```

### Frontend Detection

```typescript
const linesOpen = episode.status === 'scheduled' && episode.conferenceActive;
const isLive = episode.status === 'live';
```

## Benefits

✅ **No database migrations needed**
✅ **No Prisma build/runtime issues**
✅ **Uses proven, working fields**
✅ **Same functionality, simpler implementation**

## Implementation

This approach avoids ALL the Prisma complexity we've been fighting.

