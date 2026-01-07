# Testing Contact Form Submissions

## Quick Test to Verify Form is Working

### Step 1: Submit Test Form
1. Go to: http://localhost:9292/pages/contact (or your preview URL)
2. Fill out form:
   - Name: `Test User`
   - Email: `your-email@example.com` (use your actual email)
   - Reason: `Other / general inquiry`
   - Topic: `Test Submission`
   - Body: `Testing FormData approach - checking if this arrives`
3. Upload: `test-50kb.jpg`
4. Click **SUBMIT**

### Step 2: Check Console Logs
Watch for:
```
[File Processing] Compressed: "test-50kb.jpg" 50 KB -> 35 KB
[FormData Debug] Total entries: 8
[FormData Debug] File: contact[file_0] = test-50kb.jpg (35 KB)
[FormData Debug] Submitting to /contact...
[FormData Debug] Response status: 200
[SUCCESS] Form submitted without CAPTCHA!
```

### Step 3: Check Network Tab
1. Open DevTools → Network tab
2. Find `/contact` request
3. Click on it
4. Check **Headers** tab:
   - Request Method: `POST`
   - Content-Type: `multipart/form-data; boundary=----WebKitFormBoundary...`
5. Check **Payload** tab - should show:
   ```
   contact[name]: Test User
   contact[email]: your-email@example.com
   contact[topic]: Test Submission
   contact[body]: Testing FormData approach
   contact[file_0]: (binary)
   ```

### Step 4: Check Email
1. Check the email address configured for your Shopify store
2. Look for email from Shopify with subject: "Contact Form Submission" or similar
3. **Check if file is attached** (this is the critical test!)

### Step 5: Check Shopify Admin (if accessible)
1. Go to: `spain-test-store-shampoo.myshopify.com/admin`
2. Settings → Notifications
3. Look for recent customer contact notifications

## Expected Results

### ✅ Success Indicators:
- Console shows `[SUCCESS]`
- No CAPTCHA loop
- Response status: 200 or 302
- Email received with form data
- **FILE ATTACHMENT** in email (if supported)

### ❌ Failure Indicators:
- Console shows `[CAPTCHA DETECTED]`
- Response status: 403
- Endless CAPTCHA prompts
- No email received

## File Attachment Support - IMPORTANT

**Shopify's `/contact` endpoint may NOT support file attachments natively.**

### To Test File Support:
1. Submit form with 50KB image
2. Check received email
3. **Does the email have the image attached?**
   - ✅ YES → FormData approach works perfectly!
   - ❌ NO → Files are ignored by Shopify

### If Files Are NOT Supported:
We'll need to implement **Option B: External File Storage**:
- Upload files to Cloudinary/Uploadcare first
- Send file URLs in the contact form
- Store owner gets URLs instead of direct attachments

## Test Matrix

| Test | File Size | Expected Result | Actual Result | Notes |
|------|-----------|-----------------|---------------|-------|
| 1 | No file | ✅ Success | | Baseline |
| 2 | 50KB image | ✅ Success | | Safe size |
| 3 | 100KB image | ✅ Success | | Previously failed |
| 4 | 200KB image | ? | | Find threshold |
| 5 | 2x 50KB | ? | | Multiple files |

## Next Steps After Testing

1. **If files work**: Document max file size, adjust compression settings
2. **If files don't work**: Implement Cloudinary integration for file uploads
3. **If CAPTCHA still triggers**: Reduce compression quality, implement external storage

## Questions to Answer:
- [ ] Does form submit without CAPTCHA? (YES/NO)
- [ ] Does email arrive with form data? (YES/NO)
- [ ] **Are files attached to the email?** (YES/NO) ← CRITICAL
- [ ] What's the max file size that works? (_____ KB)
- [ ] Do multiple files work? (YES/NO)
