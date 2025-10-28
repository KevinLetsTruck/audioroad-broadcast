# AWS S3 Setup for AudioRoad Broadcast

## Step 1: Create S3 Bucket

1. **Go to AWS Console:** https://console.aws.amazon.com/s3
2. **Click "Create bucket"**
3. **Bucket name:** `audioroad-broadcast-files` (must be globally unique)
4. **Region:** `us-east-1` (or your preferred region)
5. **Block Public Access:** UNCHECK "Block all public access" (we need public read)
6. **Click "Create bucket"**

## Step 2: Configure Bucket for Public Read

1. **Click on your new bucket**
2. **Go to "Permissions" tab**
3. **Scroll to "Bucket policy"**
4. **Click "Edit"**
5. **Paste this policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::audioroad-broadcast-files/*"
    }
  ]
}
```

6. **Replace** `audioroad-broadcast-files` with YOUR bucket name
7. **Click "Save changes"**

## Step 3: Create IAM User with S3 Access

1. **Go to IAM:** https://console.aws.amazon.com/iam
2. **Click "Users" → "Create user"**
3. **User name:** `audioroad-broadcast-uploader`
4. **Click "Next"**
5. **Attach policies directly**
6. **Search for and select:** `AmazonS3FullAccess` (or create custom policy)
7. **Click "Next" → "Create user"**

## Step 4: Create Access Keys

1. **Click on the user** you just created
2. **Go to "Security credentials" tab**
3. **Scroll to "Access keys"**
4. **Click "Create access key"**
5. **Select:** "Application running outside AWS"
6. **Click "Next" → "Create access key"**
7. **SAVE THESE** (you won't see them again):
   - Access key ID (starts with `AKIA...`)
   - Secret access key (long string)

## Step 5: Update Railway Environment Variables

**In Railway Dashboard:**

1. Go to your **audioroad-broadcast** project
2. Click **Variables** tab
3. **Update these:**

```
AWS_ACCESS_KEY_ID=AKIA... (your key from step 4)
AWS_SECRET_ACCESS_KEY=... (your secret from step 4)
AWS_REGION=us-east-1 (or your region)
S3_BUCKET_NAME=audioroad-broadcast-files (your bucket name)
```

4. **Remove the duplicate** `S3_BUCKET_NAME="destinationhealth-medical-docs-dev"` line
5. Railway will auto-redeploy

## Step 6: Test

After Railway redeploys (~2 min):

1. **Upload a file** in chat (📎 button)
2. **Should see:** Real download link (not "Preview only")
3. **Click download** - file opens!

---

## Alternative: Use Existing DestinationHealth Bucket

If you already have the `destinationhealth-medical-docs-dev` bucket set up:

**Just update Railway variables:**
```
AWS_ACCESS_KEY_ID=... (your existing key)
AWS_SECRET_ACCESS_KEY=... (your existing secret)
S3_BUCKET_NAME=destinationhealth-medical-docs-dev
```

---

## Cost Estimate:

**S3 Storage:** ~$0.023 per GB/month  
**Upload/Download:** ~$0.005 per 1000 requests  
**Expected for AudioRoad:** $1-5/month

Very affordable! 💰



