"use client";

import { useState, type FormEvent } from "react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccountExportUnlockFormProps = {
  token: string;
}

export function AccountExportUnlockForm({ token }: AccountExportUnlockFormProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/settings/account/export/verify", {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token,
          otp,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        downloadUrl?: string
        zipFileName?: string
        message?: string
      } | null;

      if (!response.ok || !payload?.downloadUrl) {
        throw new Error(payload?.message || "Invalid code or expired export link.");
      }

      setDownloadUrl(payload.downloadUrl);
      setFileName(payload.zipFileName || "account-export.zip");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to verify the export code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Secure export access</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your email to unlock the private ZIP download.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {downloadUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Your export is ready. The link below expires shortly.
            </p>
            <Button asChild>
              <a href={downloadUrl} download={fileName ?? undefined}>
                Download ZIP
              </a>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                The code is in the export email. It never reveals the ZIP until it is verified.
              </p>
            </div>

            {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

            <Button type="submit" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying..." : "Unlock export"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}