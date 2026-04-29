"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Badge, PrimaryButton, SecondaryButton } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import type { SlipScanResponse, SlipScanResult } from "@/types/slip-scan";

export function SmartSlipScanModal({
  open,
  onClose,
  onUseResult,
}: {
  open: boolean;
  onClose: () => void;
  onUseResult: (result: SlipScanResult) => void;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<SlipScanResult | null>(null);
  const [demoResult, setDemoResult] = useState<SlipScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function setSelectedFile(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(nextFile);
    setPreviewUrl(null);

    if (nextFile) {
      const objectUrl = URL.createObjectURL(nextFile);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
    }

    setResult(null);
    setDemoResult(null);
    setError(null);
  }

  function resetModalState() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setDemoResult(null);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    resetModalState();
    onClose();
  }

  if (!open) return null;

  async function handleReadWithAi() {
    if (!file) {
      setError("Please choose an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setDemoResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as SlipScanResponse;

      if (payload.ok) {
        setResult(payload.data);
        return;
      }

      setError(payload.error || "Could not read this image. Please enter manually.");
      setDemoResult(payload.demoData ?? null);
    } catch {
      setError("Could not read this image. Please enter manually.");
    } finally {
      setLoading(false);
    }
  }

  function handleTryAnother() {
    setSelectedFile(null);
    setResult(null);
    setDemoResult(null);
    setError(null);
  }

  const activeResult = result ?? demoResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/80 bg-white p-5 shadow-[0_35px_110px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <Camera className="size-5" aria-hidden="true" />
              </div>
              <Badge tone={demoResult && !result ? "amber" : "teal"}>
                {demoResult && !result ? "Demo extraction result" : "AI scan"}
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
              Smart Slip Scan
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload a receipt or bank slip and AI will auto-fill your expense.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-950"
            aria-label="Close Smart Slip Scan"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <label
              htmlFor={inputId}
              className={cn(
                "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 p-5 text-center shadow-sm hover:border-teal-300 hover:bg-teal-50/30",
                previewUrl && "border-solid border-teal-200 bg-white",
              )}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Uploaded receipt preview"
                  className="max-h-72 w-full rounded-[20px] object-contain"
                />
              ) : (
                <>
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                    <ImagePlus className="size-6" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Upload or take a photo
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                    JPG, PNG, receipt photo, QR slip, PromptPay slip, or bank
                    transfer screenshot.
                  </p>
                </>
              )}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
              }}
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton
                type="button"
                onClick={() => void handleReadWithAi()}
                disabled={!file || loading}
                className="flex-1 bg-gradient-to-r from-slate-950 to-teal-900"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {loading ? "Reading receipt..." : "Read with AI"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={handleTryAnother}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Try another
              </SecondaryButton>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {error}
              </div>
            ) : null}
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4">
            {activeResult ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Extracted result
                  </p>
                  <Badge tone={activeResult.confidence < 0.7 ? "amber" : "green"}>
                    {Math.round(activeResult.confidence * 100)}% confidence
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3">
                  <ResultRow label="Merchant" value={activeResult.merchant} />
                  <ResultRow label="Title" value={activeResult.title} />
                  <ResultRow
                    label="Amount"
                    value={
                      activeResult.amount === null
                        ? null
                        : `${activeResult.amount} ${activeResult.currency ?? ""}`.trim()
                    }
                  />
                  <ResultRow label="Date" value={activeResult.date} />
                  <ResultRow label="Category" value={activeResult.category} />
                  <ResultRow
                    label="Payment method"
                    value={activeResult.paymentMethod}
                  />
                  <ResultRow
                    label="Reference"
                    value={activeResult.transactionReference}
                  />
                </div>

                {activeResult.confidence < 0.7 ? (
                  <WarningText>
                    Low confidence. Please review the amount carefully.
                  </WarningText>
                ) : null}
                {activeResult.amount === null ? (
                  <WarningText>
                    Amount could not be detected. Please enter the amount manually.
                  </WarningText>
                ) : null}

                <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">
                  {activeResult.notes}
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <PrimaryButton
                    type="button"
                    onClick={() => {
                      onUseResult(activeResult);
                      handleClose();
                    }}
                    className="flex-1"
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Use this result
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={handleClose}>
                    Cancel
                  </SecondaryButton>
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                  <Sparkles className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">
                  Review before saving
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  SplitSafe will show the extracted amount, merchant, category,
                  and reference here before filling the form.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-44 truncate font-semibold text-slate-950">
        {value ?? "Not detected"}
      </span>
    </div>
  );
}

function WarningText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
