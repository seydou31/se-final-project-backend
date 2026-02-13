# AWS S3 Setup Instructions for BaeQuest

Follow these steps to set up AWS S3 for profile picture storage.

---

## 1. Create an AWS Account
- Go to https://aws.amazon.com/
- Sign up for a free account (includes 5GB S3 storage free for 12 months)

---

## 2. Create an S3 Bucket

1. **Login to AWS Console**: https://console.aws.amazon.com/
2. **Navigate to S3**: Search for "S3" in the services search bar
3. **Click "Create bucket"**
4. **Configure the bucket**:
   - **Bucket name**: `baequests-profile-pictures` (must be globally unique)
   - **AWS Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Block Public Access settings**: UNCHECK "Block all public access"
     - ⚠️ Check the acknowledgment box
   - **Bucket Versioning**: Disabled (optional)
   - **Tags**: Optional
   - **Default encryption**: Enable (recommended)
5. **Click "Create bucket"**

---

## 3. Configure Bucket Policy (Make Images Public)

1. **Click on your bucket name**
2. **Go to "Permissions" tab**
3. **Scroll to "Bucket policy"**
4. **Click "Edit"**
5. **Paste this policy** (replace `baequests-profile-pictures` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::baequests-profile-pictures/*"
    }
  ]
}
```

6. **Click "Save changes"**

---

## 4. Enable CORS (Cross-Origin Resource Sharing)

1. **Still in "Permissions" tab**
2. **Scroll to "Cross-origin resource sharing (CORS)"**
3. **Click "Edit"**
4. **Paste this configuration**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://baequests.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

5. **Click "Save changes"**

---

## 5. Create IAM User with S3 Access

1. **Navigate to IAM**: Search for "IAM" in AWS Console
2. **Click "Users" in left sidebar**
3. **Click "Add users"**
4. **Configure user**:
   - **User name**: `baequest-s3-uploader`
   - **Access type**: Check "Access key - Programmatic access"
   - **Click "Next: Permissions"**
5. **Set permissions**:
   - **Click "Attach existing policies directly"**
   - **Search for**: `AmazonS3FullAccess`
   - **Check the box** next to it
   - **Click "Next: Tags"** (skip tags)
   - **Click "Next: Review"**
   - **Click "Create user"**
6. **IMPORTANT - Save Credentials**:
   - You'll see **Access key ID** and **Secret access key**
   - **Click "Download .csv"** or copy them immediately
   - ⚠️ **YOU CANNOT VIEW THE SECRET KEY AGAIN!**

---

## 6. Add Credentials to Your Environment Variables

1. **Open your `.env` file** in the backend project:
   ```
   c:\Users\badia\software-projects\se-final-project-backend\baequest-server\.env
   ```

2. **Add these lines** (replace with your actual values):
   ```env
   AWS_ACCESS_KEY_ID=your_access_key_id_here
   AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=baequests-profile-pictures
   ```

3. **Save the file**

---

## 7. Security Best Practices

### ✅ DO:
- Never commit `.env` file to Git
- Use IAM user with minimal required permissions
- Enable S3 bucket encryption
- Set up S3 lifecycle policies to delete old/unused images
- Monitor S3 costs regularly

### ❌ DON'T:
- Never hardcode AWS credentials in your code
- Never commit credentials to GitHub
- Don't give your IAM user more permissions than needed

---

## 8. Cost Estimation

**AWS S3 Free Tier (12 months):**
- 5 GB of standard storage
- 20,000 GET requests
- 2,000 PUT requests

**After Free Tier:**
- Storage: ~$0.023 per GB/month
- PUT/POST requests: ~$0.005 per 1,000 requests
- GET requests: ~$0.0004 per 1,000 requests

**Estimated cost for BaeQuest:**
- 1,000 users × 500KB average image = ~500MB = **~$0.01/month**
- Very affordable! 💰

---

## 9. Testing Your Setup

After completing setup and updating the code:

1. Start your backend server
2. Upload a profile picture through the app
3. Check your S3 bucket - you should see the uploaded file
4. The image should be publicly accessible via its S3 URL

---

## Troubleshooting

**Error: "Access Denied"**
- Check IAM user has S3 permissions
- Verify bucket policy is correct
- Ensure credentials in `.env` are correct

**Error: "Bucket does not exist"**
- Verify bucket name in `.env` matches actual bucket name
- Check AWS region is correct

**Images not loading**
- Verify bucket policy allows public read access
- Check CORS configuration
- Ensure bucket name doesn't have typos

---

## Next Steps

Once you've completed this setup:
1. Update your `.env` file with AWS credentials
2. The code will automatically use S3 instead of local storage
3. Test uploading a profile picture
4. Images will now be stored in S3 and accessible worldwide! 🌍
