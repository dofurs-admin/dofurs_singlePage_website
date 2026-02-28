# Dofurs Single-Page Website

Modern, minimalistic one-page marketing site for **Dofurs** built with **Next.js App Router**, **Tailwind CSS**, and **Framer Motion**.

## Development

```bash
npm install
npm run dev
```

## Backend Integration (Supabase)

1. Copy `.env.example` to `.env.local` and set:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
2. Run SQL migrations in order inside Supabase SQL Editor:
	- `infra/supabase/001_initial_schema.sql`
	- `infra/supabase/002_rls_policies.sql`
	- `infra/supabase/003_storage_setup.sql`
	- `infra/supabase/004_booking_engine.sql`
	- `infra/supabase/005_provider_blocks.sql`
	- `infra/supabase/006_users_email_unique.sql`
	- `infra/supabase/007_users_profile_fields.sql`
	- (Optional for existing data) `infra/supabase/009_backfill_users_profile_fields_example.sql`
	- `infra/supabase/008_enforce_users_profile_required.sql`
	- `infra/supabase/010_users_updated_at_trigger.sql`
	- `infra/supabase/011_users_photo_url.sql`
3. Enable Email OTP auth in Supabase Auth settings.
4. Add redirect URLs in Supabase Auth settings:
	- `http://localhost:3000/auth/callback`
	- `http://localhost:3001/auth/callback`
	- `http://localhost:3002/auth/callback`
	- Your production callback URL, e.g. `https://your-domain.com/auth/callback`
5. Keep `SUPABASE_SERVICE_ROLE_KEY` configured in deployment env vars (used by pre-signup validation route).
6. For provider accounts, set `provider_id` in user `app_metadata` to map auth users to `providers.id`.

### Production Rollout Checklist

1. Run `006` + `007` in staging and verify signup + sign-in.
2. Backfill existing users with `009` only if required (if null fields exist).
3. Run `008` to enforce required profile fields (`address`, `age`, `gender`).
4. Verify duplicate email and phone checks return `409` on signup.
5. Verify callback flow auto-creates user profile after email OTP verification.
6. Promote the same migration order to production.

### Key Routes

- Auth: `/auth/sign-in`
- User dashboard: `/dashboard/user`
- Provider dashboard: `/dashboard/provider`
- Admin dashboard: `/dashboard/admin`
- Booking flow: `/forms/customer-booking`

## Project Structure

- `app/`: App Router pages, global styles, and SEO metadata
- `components/`: Reusable UI sections and shared UI pieces
- `lib/theme.ts`: Centralized theme tokens and shared layout classes
- `lib/site-data.ts`: Centralized content for sections, links, and imagery

## Sections

- Navbar
- HeroSection
- ServicesSection
- HowItWorksSection
- CTASection (customer booking)
- ProviderSection
- Footer
