# AWS S3 Quick Reference Card

## 🚀 Quick Start

### Option 1: Use Local Storage (No Setup Required)
Just start your server - images save to `uploads/` folder.

### Option 2: Use AWS S3 (Production Ready)
1. Follow `AWS_SETUP_INSTRUCTIONS.md`
2. Update `.env` with AWS credentials
3. Restart server
4. Done! Images now save to S3

---

## 📋 Environment Variables

Add to `.env` file:

```env
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=baequests-profile-pictures
```

---

## ✅ How to Verify It's Working

### Local Storage Active:
```
⚠️  Using local disk storage for uploads (AWS not configured)
```

### S3 Storage Active:
```
✅ Using AWS S3 storage for uploads
```

---

## 📁 Where Images Are Stored

### Local Storage:
```
c:\Users\badia\software-projects\se-final-project-backend\baequest-server\uploads\profile-pictures\
```

### AWS S3:
```
https://baequests-profile-pictures.s3.us-east-1.amazonaws.com/profile-pictures/
```

---

## 🔧 Common Commands

### View uploaded files (Local):
```bash
dir "c:\Users\badia\software-projects\se-final-project-backend\baequest-server\uploads\profile-pictures"
```

### Check S3 bucket via AWS CLI:
```bash
aws s3 ls s3://baequests-profile-pictures/profile-pictures/
```

### Delete local uploads:
```bash
rmdir /s "c:\Users\badia\software-projects\se-final-project-backend\baequest-server\uploads"
```

---

## 💰 Cost Calculator

**Free Tier (12 months):**
- 5 GB storage
- 20,000 GET requests
- 2,000 PUT requests

**After Free Tier:**
- $0.023 per GB/month
- $0.005 per 1,000 PUT requests
- $0.0004 per 1,000 GET requests

**Example:**
- 1,000 users
- 500 KB avg image size
- = ~500 MB storage
- = **~$0.01/month** 💸

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Still using local storage | Check `.env` values aren't placeholders |
| Access Denied | Verify IAM user permissions |
| Bucket not found | Check bucket name & region in `.env` |
| Image doesn't display | Verify bucket policy allows public read |
| CORS error | Add your domain to CORS config |

---

## 🔐 Security Checklist

- [ ] Never commit `.env` to Git
- [ ] Use IAM user, not root account
- [ ] Enable bucket encryption
- [ ] Set up S3 access logging
- [ ] Monitor AWS billing alerts
- [ ] Use least-privilege IAM policy

---

## 📊 Feature Comparison

| Feature | Local Storage | AWS S3 |
|---------|--------------|---------|
| **Setup** | None | 15 minutes |
| **Cost** | Free | ~$0.01/month |
| **Speed** | Very fast | Fast worldwide |
| **Reliability** | Server dependent | 99.99% uptime |
| **Scalability** | Limited | Unlimited |
| **CDN** | No | Yes |
| **Backup** | Manual | Automatic |
| **Best for** | Development | Production |

---

## 🎯 Recommended Setup

### Development:
- Use **local storage**
- Fast iteration
- No costs

### Staging:
- Use **AWS S3**
- Test production setup
- Minimal costs

### Production:
- Use **AWS S3**
- Enable versioning
- Set up lifecycle rules
- Monitor costs
- Enable CloudFront CDN (optional)

---

## 📚 Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Multer Documentation](https://github.com/expressjs/multer)
- [Multer-S3 Documentation](https://github.com/badunk/multer-s3)
- [AWS Pricing Calculator](https://calculator.aws/)

---

## 🆘 Support

If you need help:
1. Check `AWS_SETUP_INSTRUCTIONS.md`
2. Check `TESTING_GUIDE.md`
3. View server logs for error messages
4. Check AWS CloudWatch logs
5. Verify S3 bucket permissions

---

**Remember:** The system automatically switches between local and S3 storage based on your `.env` configuration. No code changes needed! 🎉
