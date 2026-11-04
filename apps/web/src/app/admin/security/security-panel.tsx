"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type ActionResult,
  cancelEnrollment,
  confirmEnrollment,
  removeFactor,
  startEnrollment,
  verifyCode,
} from "./actions";

interface Factor {
  id: string;
  name: string;
}

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

const primary =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondary =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export function SecurityPanel({
  twoFactor,
  factors,
  next,
}: {
  /** This session already entered a code. */
  twoFactor: boolean;
  factors: Factor[];
  /** Where to go once the code is in. */
  next: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  const run = <T,>(
    action: () => Promise<ActionResult<T>>,
    then: (data: T) => void,
  ) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) return setError(res.error);
      then(res.data);
    });

  const done = () => {
    router.push(next);
    router.refresh();
  };

  if (enrollment) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Add an authenticator app</h2>
        <ol className="list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>In your authenticator app, add an account and scan this code.</li>
          <li>Type the 6-digit code it shows to finish.</li>
        </ol>
        {/* A data URL from Supabase: next/image adds nothing here. */}
        {/* biome-ignore lint/performance/noImgElement: inline SVG data URL */}
        <img
          src={enrollment.qrCode}
          alt="QR code to scan with your authenticator app"
          width={180}
          height={180}
          className="rounded bg-white p-2"
        />
        <p className="text-xs text-zinc-500">
          Can&apos;t scan? Enter this key instead:{" "}
          <code className="break-all font-mono text-zinc-800 dark:text-zinc-200">
            {enrollment.secret}
          </code>
        </p>
        <CodeForm
          label="Code from the app"
          submit="Turn on two-factor"
          pending={pending}
          onSubmit={(code) =>
            run(
              () => confirmEnrollment({ factorId: enrollment.factorId, code }),
              done,
            )
          }
        />
        <button
          type="button"
          className={`${secondary} self-start`}
          disabled={pending}
          onClick={() =>
            run(
              () => cancelEnrollment({ factorId: enrollment.factorId }),
              () => setEnrollment(null),
            )
          }
        >
          Cancel
        </button>
        {error && <Alert text={error} />}
      </div>
    );
  }

  if (factors.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <p>
          <strong>Set up two-factor to use the admin pages.</strong> It takes a
          minute: you&apos;ll scan a QR code with an authenticator app on your
          phone.
        </p>
        <button
          type="button"
          className={`${primary} self-start`}
          disabled={pending}
          onClick={() => run(startEnrollment, setEnrollment)}
        >
          Set up two-factor
        </button>
        {error && <Alert text={error} />}
      </div>
    );
  }

  if (!twoFactor) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Enter your code</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Open your authenticator app and type the 6-digit code for
          LiterallyFantasySports.
        </p>
        <CodeForm
          label="Code"
          submit="Continue"
          pending={pending}
          onSubmit={(code) => run(() => verifyCode({ code }), done)}
        />
        {error && <Alert text={error} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p className="text-emerald-700 dark:text-emerald-400">
        Two-factor is on, and this session has entered a code.
      </p>
      <h2 className="font-semibold">Your authenticator apps</h2>
      <ul className="flex flex-col gap-1">
        {factors.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3">
            <span>{f.name}</span>
            {factors.length > 1 && (
              <button
                type="button"
                className="text-xs text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Remove ${f.name}?`))
                    run(
                      () => removeFactor({ factorId: f.id }),
                      () => router.refresh(),
                    );
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        A second app (on another phone, or a password manager) is your backup if
        you lose this one.
      </p>
      <button
        type="button"
        className={`${secondary} self-start`}
        disabled={pending}
        onClick={() => run(startEnrollment, setEnrollment)}
      >
        Add a backup app
      </button>
      {error && <Alert text={error} />}
    </div>
  );
}

function CodeForm({
  label,
  submit,
  pending,
  onSubmit,
}: {
  label: string;
  submit: string;
  pending: boolean;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          required
          // biome-ignore lint/a11y/noAutofocus: the only thing to do on this step
          autoFocus
          className="w-32 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-center font-mono text-lg tracking-widest dark:border-zinc-700"
        />
      </label>
      <button
        type="submit"
        className={primary}
        disabled={pending || code.length !== 6}
      >
        {pending ? "Checking…" : submit}
      </button>
    </form>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {text}
    </p>
  );
}
