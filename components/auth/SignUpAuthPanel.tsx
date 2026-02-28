'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useToast } from '@/components/ui/ToastProvider';

type SignUpStep = 'collect' | 'verify' | 'done';

function getRetryAfterSeconds(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  const match = message.match(/(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unit = match[2];
  return unit.startsWith('m') ? value * 60 : value;
}

function normalizeErrorMessage(raw: unknown) {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed && trimmed !== '{}' && trimmed !== '[]') {
      return trimmed;
    }
  }

  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const candidates = [record.message, record.error_description, record.error, record.msg];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed && trimmed !== '{}' && trimmed !== '[]') {
          return trimmed;
        }
      }
    }
  }

  return 'Unable to send OTP right now. Please verify Supabase Email Auth template/settings and try again.';
}

function isRateLimitError(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  return (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit') ||
    message.includes('security purposes')
  );
}

function getReadableAuthError(rawMessage: string) {
  const message = rawMessage.toLowerCase();

  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Account already exists. Please use Log in.';
  }

  if (message.includes('invalid email')) {
    return 'Invalid email format. Enter a valid email address.';
  }

  if (isRateLimitError(rawMessage)) {
    const seconds = getRetryAfterSeconds(rawMessage) ?? 60;
    return `Too many email requests. Please wait ${seconds} seconds before trying again.`;
  }

  return rawMessage;
}

export default function SignUpAuthPanel() {
  const { showToast } = useToast();

  const [step, setStep] = useState<SignUpStep>('collect');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [isPending, setIsPending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step !== 'verify') {
      return;
    }

    const timer = window.setTimeout(() => {
      otpInputRef.current?.focus();
      otpInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldownSeconds]);

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setStatus('Validating your details...');

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const normalizedAddress = address.trim();
    const parsedAge = Number(age);
    const normalizedGender = gender;

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !normalizedAddress || !normalizedGender || !age) {
      setStatus(null);
      setError('Please enter all required details.');
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setStatus(null);
      setError('Age must be a whole number between 13 and 120.');
      return;
    }

    setIsPending(true);

    try {
      const precheckResponse = await fetch('/api/auth/pre-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          address: normalizedAddress,
          age: parsedAge,
          gender: normalizedGender,
        }),
      });

      const precheckPayload = (await precheckResponse.json().catch(() => ({}))) as { error?: unknown };

      if (!precheckResponse.ok) {
        setStatus(null);
        setError(normalizeErrorMessage(precheckPayload.error));
        showToast('Sign up validation failed.', 'error');
        return;
      }

      setStatus('Sending 6-digit OTP...');

      const supabase = getSupabaseBrowserClient();
      const signUpRequest = supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            name: normalizedName,
            phone: normalizedPhone,
            address: normalizedAddress,
            age: parsedAge,
            gender: normalizedGender,
          },
        },
      });

      const timeoutRequest = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out while contacting Supabase. Please try again.')), 45000);
      });

      const { error: signUpError } = (await Promise.race([signUpRequest, timeoutRequest])) as Awaited<
        ReturnType<typeof supabase.auth.signInWithOtp>
      >;

      if (signUpError) {
        const resolvedMessage = normalizeErrorMessage(signUpError.message || signUpError);

        if (isRateLimitError(signUpError.message)) {
          setResendCooldownSeconds(getRetryAfterSeconds(signUpError.message) ?? 60);
        }

        setStatus(null);
        setError(getReadableAuthError(resolvedMessage));
        showToast('Sign up failed. Check error details.', 'error');
        return;
      }

      setResendCooldownSeconds(60);
      setStep('verify');
      setOtp('');
      setStatus(null);
      setMessage('6-digit OTP sent to your email. Enter it below to complete signup.');
      showToast('Verification email sent successfully.', 'success');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setStatus(null);
      setError(message || 'Unable to process sign up right now. Please try again in a moment.');
      showToast('Could not send verification email.', 'error');
    } finally {
      setIsPending(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('Enter the 6-digit OTP from your email.');
      return;
    }

    setIsPending(true);
    setStatus('Verifying OTP...');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: 'email',
      });

      if (verifyError) {
        setStatus(null);
        setError(getReadableAuthError(verifyError.message));
        showToast('OTP verification failed.', 'error');
        return;
      }

      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
          address: address.trim(),
          age: Number(age),
          gender,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        setStatus(null);
        setError(normalizeErrorMessage(payload.error));
        showToast('Profile creation failed.', 'error');
        return;
      }

      await supabase.auth.signOut();

      setStep('done');
      setStatus(null);
      setMessage('Profile created successfully. You can now log in with your email OTP.');
      showToast('Sign up complete.', 'success');
    } catch {
      setStatus(null);
      setError('Unable to verify OTP right now. Please try again.');
      showToast('OTP verification failed.', 'error');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden rounded-3xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fff8f2_0%,_#fdf2e8_100%)] p-8 shadow-soft-md lg:block">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f1decf] bg-white/80 px-3 py-1 text-xs font-semibold text-[#a05a2c]">
          <ShieldCheck className="h-4 w-4" />
          Premium Account Onboarding
        </div>
        <h2 className="mt-5 text-3xl font-bold leading-tight text-ink">Create your Dofurs profile in one secure step.</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b]">
          Enter your full details first, verify with a 6-digit OTP, and your profile is created automatically.
        </p>
        <ul className="mt-6 grid gap-3 text-sm text-[#4b4b4b]">
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Verified onboarding with duplicate email/phone checks</li>
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Mandatory profile data captured before account activation</li>
          <li className="rounded-xl border border-[#f2dfcf] bg-white p-3">✔ Auto profile creation immediately after OTP verification</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft-md sm:p-8">
        <h1 className="text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-2 text-sm text-[#6b6b6b]">Step {step === 'collect' ? '1' : step === 'verify' ? '2' : '3'} of 3</p>

        {step === 'collect' && (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-ink">
                Phone Number (E.164)
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+919900001111"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <div>
              <label htmlFor="address" className="mb-1 block text-sm font-medium text-ink">
                Address
              </label>
              <textarea
                id="address"
                autoComplete="street-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Enter your full address"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                rows={3}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="age" className="mb-1 block text-sm font-medium text-ink">
                  Age
                </label>
                <input
                  id="age"
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="18"
                  className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                  required
                />
              </div>

              <div>
                <label htmlFor="gender" className="mb-1 block text-sm font-medium text-ink">
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value as 'male' | 'female' | 'other' | '')}
                  className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-sm outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                  required
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || resendCooldownSeconds > 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              {isPending ? 'Sending OTP...' : resendCooldownSeconds > 0 ? `Retry in ${resendCooldownSeconds}s` : 'Send Email OTP'}
            </button>
            <p className="text-xs text-[#8a7b6f]">By continuing, you verify these details are accurate and belong to you.</p>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-xs text-[#6b6b6b]">
              OTP sent to: <span className="font-semibold text-ink">{email}</span>
            </div>

            <div>
              <label htmlFor="signup-otp" className="mb-1 block text-sm font-medium text-ink">
                Enter 6-digit OTP
              </label>
              <input
                ref={otpInputRef}
                id="signup-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

                  if (!pasted) {
                    return;
                  }

                  event.preventDefault();
                  setOtp(pasted);
                }}
                placeholder="123456"
                className="w-full rounded-xl border border-[#f2dfcf] px-4 py-3 text-center text-lg tracking-[0.35em] outline-none transition focus:border-[#e89a5e] focus:ring-2 focus:ring-[#f7d8bd]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              {isPending ? 'Verifying OTP...' : 'Verify OTP & Create Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('collect');
                setOtp('');
                setMessage(null);
                setError(null);
                setStatus(null);
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-[#f2dfcf] bg-[#fffaf6] px-5 py-3 text-sm font-semibold text-[#6b6b6b] transition hover:bg-white"
            >
              Edit details / Resend OTP
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700">
              Your profile has been created successfully in Dofurs.
            </div>
            <Link
              href="/auth/sign-in?mode=signin"
              className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-3 text-sm font-semibold text-white"
            >
              Go to Login
            </Link>
          </div>
        )}

        {status && (
          <p className="mt-4 rounded-xl border border-[#f2dfcf] bg-[#fffaf6] px-3 py-2 text-sm text-[#6b6b6b]" role="status" aria-live="polite">
            {status}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status" aria-live="polite">
            {message} Check spam/promotions if needed.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert" aria-live="assertive">
            {error}
          </p>
        )}

        <p className="mt-5 text-center text-sm text-[#6b6b6b]">
          Already have an account?{' '}
          <Link href="/auth/sign-in?mode=signin" className="font-semibold text-coral hover:underline">
            Log in
          </Link>
        </p>
      </section>
    </div>
  );
}
