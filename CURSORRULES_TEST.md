# Testing Cursor Rules

This file tests whether the .cursorrules file is being respected by Cursor AI.

## Test 1: Raw fetch() usage (should be warned against)

If you ask Cursor to create this code:

```typescript
// ❌ This should trigger a warning
async function getData() {
  const response = await fetch('/api/data', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  return response.json();
}
```

Cursor should warn you to use `api.get()` instead.

## Test 2: Generic update endpoint (should be warned against)

If you ask Cursor to create:

```typescript
// ❌ This should trigger a warning
router.put('/api/users/:id', async (req, res) => {
  await db.user.update({
    where: { id: req.params.id },
    data: req.body // Dangerous!
  });
});
```

Cursor should suggest dedicated endpoints instead.

## Test 3: Proper authenticated API call (should be approved)

If you ask Cursor to create:

```typescript
// ✅ This follows the rules
import { api } from '@/utils/api';

async function getData() {
  const response = await api.get('/api/data');
  return response.json();
}
```

Cursor should approve this pattern.

## Test 4: Missing authentication middleware (should be warned)

If you ask Cursor to create:

```typescript
// ❌ This should trigger a warning - no requireAuth
router.get('/api/users', async (req, res) => {
  const users = await db.user.findMany();
  res.json(users);
});
```

Cursor should remind you to add `requireAuth` middleware.

## Test 5: Proper route with auth + validation (should be approved)

If you ask Cursor to create:

```typescript
// ✅ This follows the rules
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { createUserSchema } from '../schemas/user';

router.post('/api/users',
  requireAuth,
  validateBody(createUserSchema),
  async (req, res) => {
    const user = await db.user.create({ data: req.body });
    res.json(user);
  }
);
```

Cursor should approve this pattern.

## How to Test

1. Open a chat with Cursor
2. Ask: "Create a function to fetch user data from /api/users"
3. Check if Cursor uses `api.get()` instead of raw `fetch()`
4. Ask: "Create an API endpoint to update a user"
5. Check if Cursor creates dedicated endpoints with auth + validation

## Expected Behavior

With the .cursorrules file active, Cursor should:
- ✅ Always suggest using `api.get/post/put/delete` helpers
- ✅ Always include `requireAuth` middleware on routes
- ✅ Always include validation middleware on POST/PUT routes
- ✅ Create separate schemas for create vs update
- ✅ Suggest dedicated endpoints instead of generic updates
- ✅ Include `credentials: true` in CORS config
- ✅ Remind about CSRF tokens for state-changing requests

## Verification Checklist

- [ ] Rules file exists and is readable
- [ ] Ask Cursor to create an API call - it uses `api` helper
- [ ] Ask Cursor to create a route - it includes auth middleware
- [ ] Ask Cursor to create validation - it separates create/update schemas
- [ ] Rules are being followed automatically

---

**Status:** Ready for testing
**Location:** .cursorrules file in project root
**Next:** Try asking Cursor to create new features and verify it follows the patterns

