> # ⛔ SUPERSEDED (2026-08-14) — DO NOT EXECUTE
>
> This **AWS Amplify** launch plan is not the launch path — `docs/adr/ADR-001-canonical-platform.md` made **Vercel** canonical (2026-07-18).
> **The only live launch authorities are [`docs/NEXT_GO.md`](./NEXT_GO.md) and
> [`docs/launch/PROGRAMME_END_TO_END.md`](./launch/PROGRAMME_END_TO_END.md).** Where this file
> conflicts with them, they win. This file is retained as history only and is no longer maintained.

---

# 🚀 AWS Amplify Launch Checklist

## Pre-Launch Checklist

Use this checklist to ensure a smooth AWS Amplify deployment.

### ✅ AWS Amplify Configuration (Complete)

- [x] **amplify.yml** - Build configuration created
- [x] **.amplifyignore** - Deployment exclusions configured
- [x] **Security Updates** - Next.js updated to 14.2.35 (critical vulnerabilities fixed)
- [x] **.gitignore** - Enhanced to exclude build artifacts
- [x] **Documentation** - Comprehensive deployment guides created

### 📋 Required Before Launch

#### 1. External Services Setup

**Supabase (Required):**

- [ ] Create Supabase project at https://supabase.com
- [ ] Apply database migrations (see `docs/MIGRATIONS.md`)
- [ ] Copy Project URL, Anon Key, and Service Role Key

**Stripe (Required):**

- [ ] Create Stripe account at https://stripe.com
- [ ] Get API keys (use test keys first)
- [ ] Copy Publishable Key and Secret Key

#### 2. AWS Amplify Setup

- [ ] Sign in to AWS Console
- [ ] Navigate to AWS Amplify
- [ ] Connect GitHub repository
- [ ] Select branch to deploy
- [ ] Verify `amplify.yml` is detected

#### 3. Environment Variables

Add in AWS Amplify Console (all required for Phase 1):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (can set temporary value initially)

# App Configuration
NEXT_PUBLIC_SITE_URL=https://main.xxxxx.amplifyapp.com
NODE_ENV=production
```

#### 4. Deploy

- [ ] Click "Save and deploy" in Amplify Console
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Check build logs for any errors

### 🔍 Post-Launch Verification

#### Immediate Checks (Right After Deployment)

- [ ] Homepage loads without errors
- [ ] `/api/health` endpoint returns `{"status":"healthy"}`
- [ ] Can view books catalog
- [ ] Can access login page
- [ ] UI is responsive on mobile

#### Authentication Testing

- [ ] Sign up with new account works
- [ ] Email verification works (if enabled)
- [ ] Login works with created account
- [ ] User profile is created automatically
- [ ] Logout works

#### Core Features Testing

- [ ] Can browse books
- [ ] Can search for books
- [ ] Book detail pages load
- [ ] Can start reading a book (if logged in)
- [ ] Reading progress saves

#### Payment Testing (Use Stripe Test Mode)

- [ ] Checkout button appears on book pages
- [ ] Clicking checkout redirects to Stripe
- [ ] Can complete test payment (use test card 4242 4242 4242 4242)
- [ ] Redirected back to success page after payment

#### Stripe Webhook Setup (After Initial Deploy)

- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Add endpoint: `https://your-app.amplifyapp.com/api/webhook`
- [ ] Select events: `checkout.session.completed`, `payment_intent.succeeded`
- [ ] Copy webhook signing secret
- [ ] Update `STRIPE_WEBHOOK_SECRET` in Amplify environment variables
- [ ] Trigger a redeploy (or wait for next commit)
- [ ] Test payment again to verify webhook works

### 📊 Monitoring Setup (Optional but Recommended)

- [ ] Enable CloudWatch logs in AWS
- [ ] Set up build failure notifications in Amplify Console
- [ ] Monitor Supabase dashboard for database performance
- [ ] Monitor Stripe dashboard for payment activity

### 🎯 Phase 1: Launch Features (All Ready)

These features are fully implemented and ready for immediate use:

✅ **User Management:**

- User registration and authentication
- Profile management
- Password reset

✅ **Book Catalog:**

- Browse all books
- Search functionality
- Book detail pages
- Categories and genres

✅ **Reading Experience:**

- Reading interface
- Progress tracking
- Bookmarks

✅ **Author Portal:**

- Manuscript submission
- Manuscript management
- Author dashboard

✅ **Payments:**

- Stripe checkout integration
- Payment processing
- Order history

✅ **Admin Dashboard:**

- Basic admin functions
- Content management

### 🔜 Phase 2: Future Enhancements

These features require additional services and can be added later:

**AI Recommendations** (Requires OpenAI API):

- Add `OPENAI_API_KEY` environment variable
- Redeploy application
- Resonance Engine will activate automatically

**Email Notifications** (Requires Resend):

- Add `RESEND_API_KEY` environment variable
- Redeploy application
- Email notifications will activate automatically

**Coming in Future Updates:**

- Audiobook support
- User reviews and ratings
- Social sharing
- Enhanced analytics dashboard
- Partner portal (ARC requests)

### 🚨 Troubleshooting

#### Build Fails

**Check:**

- All environment variables are set correctly
- Build logs in Amplify Console for specific errors
- No syntax errors in recent commits

**Common Issues:**

- Missing environment variables
- Invalid environment variable values
- Build timeout (increase timeout in Amplify settings)

#### App Doesn't Load

**Check:**

- DNS settings (if using custom domain)
- CloudFront distribution status
- Browser console for JavaScript errors

#### Database Connection Fails

**Check:**

- Supabase URL and keys are correct
- Migrations have been applied
- `/api/health` endpoint for specific error
- Supabase project is active (not paused)

#### Payments Don't Work

**Check:**

- Stripe keys are correct (test vs live)
- Webhook is configured correctly
- Webhook secret is correct
- Stripe dashboard webhook logs for delivery status

### 📚 Additional Resources

- [AWS Amplify Deployment Guide](./AWS_AMPLIFY_DEPLOYMENT.md) - Complete deployment documentation
- [AWS Amplify Quick Start](./AWS_AMPLIFY_QUICK_START.md) - 5-minute deployment guide
- [Migrations Guide](./MIGRATIONS.md) - Database setup instructions
- [README.md](../README.md) - General platform information

### 🎉 Launch Ready!

Once all items in this checklist are complete, your MANGU platform is ready for production use on AWS Amplify!

**Next Steps After Launch:**

1. Monitor application performance
2. Gather user feedback
3. Plan Phase 2 feature rollout
4. Consider custom domain setup
5. Set up automated backups

---

**Need Help?** Check the troubleshooting section or refer to the detailed deployment guide.
