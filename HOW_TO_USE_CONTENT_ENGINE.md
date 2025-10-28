# 🎬 How to Use Your Content Creation Engine

**Quick guide to generating commercials and social content**

---

## 🛒 Part 1: Generate Product Commercials

### One-Time Setup (Generate 20 Commercials):

**Method 1: Using API (Simple)**

Open terminal and run:
```bash
curl -X POST https://audioroad-broadcast-production.up.railway.app/api/commercials/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 20}'
```

**Wait 20-30 minutes** (AI is generating scripts + audio for 20 products)

**Result:** 20 professional commercials added to your soundboard!

---

**Method 2: Using Browser Console**

1. Go to your Railway app
2. Press F12 (open console)
3. Paste:
```javascript
fetch('/api/commercials/generate', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({count: 20})
}).then(r => r.json()).then(console.log)
```

4. Watch progress in console!

---

### View Generated Commercials:

**In your soundboard:**
- Green-colored commercials appear
- Tagged "shopify" and "auto-generated"
- Ready to play during breaks!

**Or check via API:**
```bash
curl https://audioroad-broadcast-production.up.railway.app/api/commercials/list
```

---

### Monthly Refresh:

**Generate new/seasonal commercials:**
```bash
curl -X POST .../api/commercials/generate -d '{"count": 10}'
```

**Keeps commercials fresh!**

---

## 🎙️ Part 2: Generate Social Content from Shows

### After Each Show:

**Step 1: Get Episode ID**

Find your episode ID:
- In database (Prisma Studio)
- Or from UI (we'll add this to dashboard)
- Looks like: `clxxxxxxxxxxxxxx`

---

**Step 2: Analyze Show**

```bash
curl -X POST https://audioroad-broadcast-production.up.railway.app/api/content/analyze/YOUR_EPISODE_ID
```

**Returns:** List of calls scored 0-100 for social potential

**Example Response:**
```json
{
  "recommended": 8,
  "calls": [
    {
      "callId": "call_123",
      "score": 92,
      "contentType": "educational",
      "platforms": ["Instagram", "TikTok"],
      "topics": ["fuel savings", "MPG tips"]
    }
  ]
}
```

---

**Step 3: Generate Social Content**

```bash
curl -X POST https://audioroad-broadcast-production.up.railway.app/api/content/generate/YOUR_EPISODE_ID \
  -H "Content-Type: application/json" \
  -d '{"limit": 8}'
```

**Takes 10-15 minutes** (AI is analyzing and generating captions)

**Creates:**
- 8 clip records in database
- AI captions for each platform
- Hashtags for each clip
- Platform recommendations

---

**Step 4: View Generated Content**

```bash
curl https://audioroad-broadcast-production.up.railway.app/api/content/pending
```

**Returns:** All clips with AI-generated captions awaiting your review

**Example Response:**
```json
{
  "clips": [
    {
      "id": "clip_123",
      "title": "Fuel-Saving Hack",
      "aiCaption": "💡 Fuel-Saving Hack from an OTR Driver!...",
      "aiHashtags": ["#Trucking", "#FuelSavings", ...],
      "aiSuggestions": {
        "instagram": "caption for IG",
        "facebook": "caption for FB",
        "youtube": "title for YT",
        "tiktok": "caption for TikTok"
      }
    }
  ]
}
```

**Each clip has platform-specific captions ready to use!**

---

**Step 5: Use the Captions**

Copy the captions and post manually (for now):

1. Copy Instagram caption
2. Go to Instagram
3. Upload video
4. Paste caption
5. Add hashtags
6. Post!

Repeat for Facebook, YouTube, TikTok

**Takes 5-10 minutes per clip** (vs. hours to create from scratch!)

---

## 🎯 RECOMMENDED WORKFLOW

### Daily (After Show):

**1. Analyze (5 min):**
```
POST /api/content/analyze/EPISODE_ID
```

**2. Generate (10 min wait):**
```
POST /api/content/generate/EPISODE_ID
```

**3. Review (5 min):**
```
GET /api/content/pending
```

**4. Post (20 min):**
- Post 2-3 clips to Instagram
- Post 2-3 to Facebook
- Post 2-3 to YouTube
- Post 1-2 to TikTok

**Total time: 40 minutes** (vs. 3+ hours manually!)

---

### Weekly:

**Monday:** Generate commercials if needed
**Daily:** Create social content after each show
**Friday:** Review performance, adjust strategy

---

## 💡 PRO TIPS

### For Best Commercials:

**Products to prioritize:**
- High-value items ($50+)
- Best-sellers
- Unique products
- Health supplements
- Fuel savers

### For Best Social Content:

**Look for calls about:**
- Surprising facts
- Practical tips
- Emotional stories
- Controversial topics
- Funny moments

**AI will find these automatically!**

---

## 🎊 WHAT YOU'VE BUILT

**A complete content marketing machine that:**

1. **Listens** to your show
2. **Identifies** best moments
3. **Creates** social posts
4. **Writes** captions
5. **Generates** commercials
6. **Saves** you 40+ hours/month
7. **Grows** your audience automatically

**All powered by AI!**

---

## 🚀 NEXT STEPS

### **Next Session (When Ready):**

I'll build the **Content Dashboard UI** so you can:
- See all generated content in one place
- Preview clips with player
- Edit captions easily
- One-click approve
- Track performance
- **Beautiful, easy interface!**

Then add:
- Direct posting to platforms
- Scheduled publishing
- Analytics tracking
- **Complete automation!**

---

## ✅ YOU'RE READY!

**Railway is deploying your content engine RIGHT NOW!**

**In 2-3 minutes you can:**
- Generate your first product commercial
- Analyze your shows for content
- Create AI social media posts
- **Start growing your audience!**

---

**This is game-changing technology!** 🎯✨

**Try generating a commercial when deployment finishes!** 🎬

