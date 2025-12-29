# 🔐 Post-Security Hardening Checklist

Use this checklist to ensure all security measures are properly implemented.

---

## ✅ Immediate Actions (Do This Now)

### 1. Verify Git Configuration
```bash
# Check that .env is not tracked
git status

# Should NOT show .env or .env.local
# Should show new security files as untracked/modified
```
- [ ] `.env` is NOT in git status
- [ ] `.env.local` is NOT in git status
- [ ] `.gitignore` includes `.env` entries

### 2. Setup Local Environment
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your actual credentials
# Use a text editor or:
notepad .env.local
```
- [ ] `.env.local` file created
- [ ] `DEEPSEEK_API_KEY` added (NEW key, not the exposed one)
- [ ] `VITE_SUPABASE_URL` added
- [ ] `VITE_SUPABASE_ANON_KEY` added

### 3. Rotate Exposed API Keys

#### DeepSeek API Key
- [ ] Logged into https://platform.deepseek.com/
- [ ] Deleted old key: `sk-4d169dfc50234370b18e61003edf7784`
- [ ] Generated new API key
- [ ] Added new key to `.env.local`
- [ ] Tested locally with new key

#### Supabase (Optional but Recommended)
- [ ] Logged into Supabase dashboard
- [ ] Reviewed Row Level Security (RLS) policies
- [ ] Enabled RLS on sensitive tables
- [ ] Tested application still works

### 4. Test Locally
```bash
# Install dependencies (if needed)
npm install

# Run development server
npm run dev

# Visit http://localhost:3000
# Test document generation
```
- [ ] Application starts without errors
- [ ] Can generate documents
- [ ] Supabase connection works
- [ ] No console errors related to environment variables

---

## 📤 Before Committing

### 5. Review Changes
```bash
# See what will be committed
git status
git diff
```
- [ ] `.env` is NOT in the list
- [ ] `.gitignore` changes look correct
- [ ] Security files are ready to commit
- [ ] No sensitive data in any files

### 6. Commit Security Improvements
```bash
# Stage the changes
git add .gitignore
git add vercel.json
git add services/supabase.ts
git add components/Letterhead.tsx
git add README.md
git add .env.example
git add .env.production.example
git add SECURITY.md
git add SECURITY_ACTION_PLAN.md
git add SECURITY_HARDENING_SUMMARY.md
git add POST_SECURITY_CHECKLIST.md

# Commit
git commit -m "🔒 Security hardening: Add security headers, protect API keys, update documentation"

# Push to remote
git push origin main
```
- [ ] Changes committed
- [ ] Pushed to remote repository
- [ ] `.env` was NOT pushed (verify on GitHub/remote)

---

## 🚀 Deployment to Vercel

### 7. Configure Vercel Environment Variables
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add the following:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `DEEPSEEK_API_KEY` | Your NEW DeepSeek API key | Production, Preview, Development |
| `VITE_SUPABASE_URL` | Your Supabase URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |

- [ ] `DEEPSEEK_API_KEY` added to Vercel
- [ ] `VITE_SUPABASE_URL` added to Vercel
- [ ] `VITE_SUPABASE_ANON_KEY` added to Vercel
- [ ] All variables set for all environments

### 8. Deploy
```bash
# Trigger deployment (or use Vercel dashboard)
git push origin main
```
- [ ] Deployment triggered
- [ ] Deployment successful
- [ ] No build errors
- [ ] Application loads correctly

### 9. Verify Deployment
- [ ] Visit your deployed URL
- [ ] Test document generation
- [ ] Check browser console for errors
- [ ] Verify Supabase connection works

---

## 🔍 Security Verification

### 10. Test Security Headers
Visit: https://securityheaders.com/

Enter your deployed URL and check:
- [ ] Overall grade is A or A+
- [ ] Content-Security-Policy is present
- [ ] X-Frame-Options is DENY
- [ ] X-Content-Type-Options is nosniff
- [ ] All headers are correctly configured

### 11. Test CSP (Content Security Policy)
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Look for CSP violations (there should be none)
- [ ] Test all features (document generation, refinement, etc.)
- [ ] No functionality is broken by CSP

### 12. Verify API Key Protection
```bash
# Search your git history for the old key
git log --all --full-history --source --all -- .env

# Should show it was removed
```
- [ ] Old `.env` file removed from tracking
- [ ] No API keys visible in current repository files
- [ ] GitHub/remote repository doesn't show `.env` file

---

## 🧹 Clean Up Git History (Optional but Recommended)

### 13. Remove Sensitive Data from Git History

⚠️ **WARNING**: This rewrites git history. Coordinate with your team first!

#### Option A: Using git filter-repo
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from entire history
git filter-repo --path .env --invert-paths

# Force push (WARNING: Destructive operation)
git push origin --force --all
```

#### Option B: Using BFG Repo-Cleaner
```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

- [ ] Git history cleaned (if applicable)
- [ ] Team notified of force push
- [ ] Everyone re-cloned the repository

---

## 📊 Ongoing Maintenance

### 14. Regular Security Tasks

#### Weekly
- [ ] Review Vercel deployment logs
- [ ] Check for unusual API usage
- [ ] Monitor error rates

#### Monthly
- [ ] Review and update dependencies (`npm audit`)
- [ ] Check for security advisories
- [ ] Review access logs
- [ ] Test security headers (securityheaders.com)

#### Quarterly (Every 90 Days)
- [ ] Rotate API keys
- [ ] Review and update security policies
- [ ] Audit user access and permissions
- [ ] Review CSP and update if needed

#### Annually
- [ ] Full security audit
- [ ] Penetration testing (if applicable)
- [ ] Review and update SECURITY.md
- [ ] Team security training

---

## 📚 Documentation Review

### 15. Verify Documentation
- [ ] `README.md` has updated setup instructions
- [ ] `SECURITY.md` is comprehensive
- [ ] `.env.example` has all required variables
- [ ] Team knows where to find security guidelines

---

## 🎯 Success Criteria

You've successfully completed security hardening when:

✅ All items in "Immediate Actions" are checked  
✅ All items in "Before Committing" are checked  
✅ All items in "Deployment to Vercel" are checked  
✅ All items in "Security Verification" are checked  
✅ Security headers score A or A+ on securityheaders.com  
✅ Application works correctly in production  
✅ No API keys are visible in git repository  
✅ Team is aware of security best practices  

---

## 🆘 Troubleshooting

### Issue: Application won't start locally
**Solution**: Check that `.env.local` exists and has all required variables

### Issue: "Supabase not configured" error
**Solution**: Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`

### Issue: DeepSeek API errors
**Solution**: Verify `DEEPSEEK_API_KEY` is correct and not the old exposed key

### Issue: CSP violations in browser console
**Solution**: Check `vercel.json` CSP policy includes all required domains

### Issue: Security headers not showing
**Solution**: Redeploy to Vercel after updating `vercel.json`

---

## 📞 Support Resources

- **Security Guidelines**: See `SECURITY.md`
- **Action Plan**: See `SECURITY_ACTION_PLAN.md`
- **Summary**: See `SECURITY_HARDENING_SUMMARY.md`
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **DeepSeek Docs**: https://platform.deepseek.com/docs

---

**Checklist Version**: 1.0  
**Last Updated**: 2025-12-29  
**Next Review**: 2026-01-29

---

## ✨ Final Notes

Remember:
- Security is an ongoing process, not a one-time task
- Keep this checklist updated as your security needs evolve
- Share security knowledge with your team
- When in doubt, err on the side of caution

**Stay vigilant! 🛡️**
