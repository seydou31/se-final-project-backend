# Testing Guide: Profile Pictures with AWS S3

This guide will help you test the profile picture upload functionality with both local storage and AWS S3.

---

## Testing with Local Storage (Without AWS Setup)

If you haven't set up AWS yet, the system will automatically fall back to local storage.

### 1. Start the Backend Server

```bash
cd c:\Users\badia\software-projects\se-final-project-backend\baequest-server
npm start
```

You should see:
```
⚠️  Using local disk storage for uploads (AWS not configured)
📝 To use AWS S3, update your .env file with AWS credentials
```

### 2. Start the Frontend

```bash
cd c:\Users\badia\software-projects\se-final-project\baequest
npm run dev
```

### 3. Test Upload

1. Open http://localhost:3000
2. Sign up or log in
3. Go to your profile
4. Click the edit button (pencil icon)
5. Click "Choose File" under Profile Picture
6. Select an image (JPEG, PNG, GIF, or WebP under 5MB)
7. Submit the form
8. Your profile picture should appear!

### 4. Verify Local Storage

Check the uploads folder:
```
c:\Users\badia\software-projects\se-final-project-backend\baequest-server\uploads\profile-pictures\
```

You should see your uploaded image with a filename like:
```
507f1f77bcf86cd799439011-1733512345678.jpg
```

---

## Testing with AWS S3 (After AWS Setup)

### 1. Complete AWS Setup

Follow the instructions in `AWS_SETUP_INSTRUCTIONS.md`:
- Create S3 bucket
- Configure bucket policy
- Create IAM user
- Get AWS credentials

### 2. Update .env File

Open `.env` and replace the placeholder values:

```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  # Your actual access key
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY  # Your actual secret
AWS_REGION=us-east-1  # Your bucket region
AWS_S3_BUCKET_NAME=baequests-profile-pictures  # Your actual bucket name
```

### 3. Restart the Backend Server

```bash
# Stop the server (Ctrl+C) and restart
npm start
```

You should now see:
```
✅ Using AWS S3 storage for uploads
```

### 4. Test S3 Upload

1. Go to your profile
2. Click edit button
3. Upload a new profile picture
4. Submit

### 5. Verify S3 Upload

**Check Server Response:**
Look at the server logs. You should see a successful upload message.

**Check AWS S3 Console:**
1. Go to https://s3.console.aws.amazon.com/
2. Click your bucket name
3. Navigate to `profile-pictures/` folder
4. You should see your uploaded image

**Check Frontend:**
Your profile picture should display immediately.

**Verify URL:**
Right-click the profile picture → "Open image in new tab"

The URL should look like:
```
https://baequests-profile-pictures.s3.us-east-1.amazonaws.com/profile-pictures/507f1f77bcf86cd799439011-1733512345678.jpg
```

---

## Troubleshooting

### Problem: "Using local disk storage" even after adding AWS credentials

**Solution:**
- Verify `.env` values don't contain placeholder text
- Check for typos in environment variable names
- Restart the server after editing `.env`

### Problem: Upload fails with "Access Denied"

**Solution:**
- Check IAM user has S3 permissions
- Verify AWS credentials are correct
- Check bucket name matches `.env` file

### Problem: Image uploads but doesn't display

**Solution:**
- Check bucket policy allows public read access
- Verify CORS configuration
- Check browser console for errors

### Problem: "Bucket does not exist"

**Solution:**
- Verify bucket name in `.env` matches AWS
- Check AWS region is correct
- Ensure bucket was created successfully

### Problem: File size error

**Solution:**
- Ensure image is under 5MB
- Try a smaller image
- Check file type is JPEG, PNG, GIF, or WebP

---

## Testing Checklist

- [ ] Local storage works without AWS setup
- [ ] File validation works (rejects non-images)
- [ ] File size validation works (rejects >5MB)
- [ ] S3 upload works after AWS setup
- [ ] Profile picture displays correctly
- [ ] Image is publicly accessible
- [ ] Can update profile picture (upload new one)
- [ ] Image URL is stored in database
- [ ] Works in both development and production

---

## Security Testing

### Test 1: Try to upload a non-image file
Expected: Should be rejected with error message

### Test 2: Try to upload a file over 5MB
Expected: Should be rejected with error message

### Test 3: Try to upload without authentication
Expected: Should return 401 Unauthorized

### Test 4: Verify uploaded images are publicly readable
Expected: Anyone should be able to view the image URL

---

## Performance Testing

### Local Storage
- Upload speed: Very fast (local disk)
- Access speed: Depends on server location
- Scalability: Limited by server disk space

### AWS S3
- Upload speed: Depends on internet connection
- Access speed: Fast worldwide (CDN-like)
- Scalability: Unlimited storage

---

## Migration Notes

If you start with local storage and later migrate to S3:

1. Existing local images will still work
2. New uploads will go to S3
3. Old images will have paths like `/uploads/...`
4. New images will have full S3 URLs like `https://...`
5. The frontend handles both automatically

To fully migrate:
- Upload all local images to S3
- Update database URLs
- Remove local `uploads/` folder

---

## Next Steps

Once testing is complete:

1. ✅ Verify production deployment works
2. ✅ Set up S3 lifecycle rules (delete old images)
3. ✅ Monitor S3 costs
4. ✅ Add error handling for failed uploads
5. ✅ Consider implementing image resizing/optimization
6. ✅ Add ability to delete old profile pictures
