"use client";
/**
 * Inbox: every document from every channel. Upload → list → preview.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, FileText, Image as ImageIcon, Inbox as InboxIcon, UploadCloud } from "lucide-react";
import { backoffice, type DocumentRow, type DocumentStatus, formatBytes, formatDateTime, shortHash, type UploadResult } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { Banner } from "@/components/ui/Banner";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card, DefinitionRow } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, SkeletonRows } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DOCUMENT_TONES, Pill } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.csv,.xlsx,application/pdf,image/*,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_MB = 25;
const STATUSES: DocumentStatus[] = ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "UNREADABLE"];

export default function InboxPage() {
  const { t, locale } = useT();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;
  const intl = locale === "so" ? "so" : "en-US";

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocumentStatus | "ALL">("ALL");
  const listKey = `${companyId ?? ""}:${filter}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = loadedKey !== listKey || loadingMore;
  const [listError, setListError] = useState("");

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (after?: string | null) => {
      if (!companyId) return Promise.resolve(null);
      return backoffice.documents(companyId, { status: filter === "ALL" ? undefined : filter, cursor: after ?? undefined, limit: 30 });
    },
    [companyId, filter],
  );

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const key = `${companyId}:${filter}`;
    fetchPage()
      .then((res) => {
        if (cancelled || !res) return;
        setDocs(res.documents);
        setCursor(res.nextCursor);
        setListError("");
        setLoadedKey(key);
      })
      .catch((e) => {
        if (cancelled) return;
        setListError(formatApiError(e, t("common.error")));
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, filter]);

  const reload = () =>
    fetchPage().then((res) => {
      if (!res) return;
      setDocs(res.documents);
      setCursor(res.nextCursor);
    });

  const loadMore = () => {
    setLoadingMore(true);
    fetchPage(cursor)
      .then((res) => {
        if (!res) return;
        setDocs((prev) => [...prev, ...res.documents]);
        setCursor(res.nextCursor);
      })
      .catch((e) => setListError(formatApiError(e, t("common.error"))))
      .finally(() => setLoadingMore(false));
  };

  const onFiles = async (files: FileList | File[]) => {
    if (!companyId) return;
    const list = Array.from(files).slice(0, 20);
    if (list.length === 0) return;
    setUploading(list.length);
    setProgress(0);
    setResult(null);
    setUploadError("");
    try {
      const res = await backoffice.upload(companyId, list, setProgress);
      setResult(res);
      await reload();
    } catch (e) {
      setUploadError(formatApiError(e, t("upload.failed")));
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader title={t("inbox.title")} description={t("inbox.subtitle")} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        aria-label={t("inbox.upload")}
        className={`mb-5 cursor-pointer rounded-card border-2 border-dashed px-5 py-8 text-center transition-colors ${dragging ? "border-accent bg-accent-dim" : "border-line bg-canvas hover:bg-surface"}`}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
        <UploadCloud size={28} className="mx-auto mb-2 text-accent" />
        <div className="text-[15px] font-bold text-ink">{uploading ? t("inbox.uploading", { count: uploading }) : t("inbox.dropHere")}</div>
        <div className="mt-1 text-xs text-ink-3">{t("inbox.accepted", { max: MAX_MB })}</div>
        {uploading > 0 && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface2" aria-label={`${progress}%`}>
            <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {uploadError && <Banner tone="danger" className="mb-3">{uploadError}</Banner>}
      {result && result.uploaded.length > 0 && <Banner tone="success" className="mb-3">{t("inbox.uploaded", { count: result.uploaded.length })}</Banner>}
      {result && result.rejected.length > 0 && (
        <Banner tone="warning" className="mb-3" title={t("inbox.rejected", { count: result.rejected.length })}>
          <ul className="mt-1 list-disc pl-4">
            {result.rejected.map((r, i) => (
              <li key={i}>{t("inbox.rejectedReason", { file: r.filename, reason: t(`reason.${r.reason}`) })}</li>
            ))}
          </ul>
        </Banner>
      )}

      <div className="mb-3">
        <Tabs ariaLabel={t("inbox.filterAll")} value={filter} onChange={setFilter} options={[{ value: "ALL" as const, label: t("inbox.filterAll") }, ...STATUSES.map((s) => ({ value: s, label: t(`docStatus.${s}`) }))]} />
      </div>
      {listError && <Banner tone="danger" className="mb-3">{listError}</Banner>}

      <Card className="overflow-hidden">
        {loading && docs.length === 0 ? (
          <SkeletonRows />
        ) : docs.length === 0 ? (
          <EmptyState icon={<InboxIcon size={20} />} title={t("inbox.emptyTitle")} description={t("inbox.empty")} />
        ) : (
          <ul>
            {docs.map((d) => (
              <li key={d.id} className="border-b border-line last:border-b-0">
                <button onClick={() => setOpenId(d.id)} className="grid min-h-14 w-full grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-surface">
                  <span className="text-ink-3">{d.mimeType.startsWith("image/") ? <ImageIcon size={20} /> : <FileText size={20} />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{d.filename}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {formatDateTime(d.receivedAt, intl)} · {formatBytes(d.sizeBytes)} · <code className="text-[11px]">{shortHash(d.sha256)}</code>
                      {d.isExactDuplicateOf && (
                        <span className="ml-2 inline-flex items-center gap-1 text-warning">
                          <Copy size={12} /> {t("inbox.duplicate")}
                        </span>
                      )}
                    </span>
                  </span>
                  <Pill label={t(`docStatus.${d.status}`)} tone={DOCUMENT_TONES[d.status] ?? "grey"} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <div className="border-t border-line p-2">
            <Button variant="ghost" className="w-full" onClick={loadMore} loading={loadingMore}>
              {t("inbox.loadMore")}
            </Button>
          </div>
        )}
      </Card>

      {openId && companyId && <DocumentDrawer key={openId} companyId={companyId} id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DocumentDrawer({ companyId, id, onClose }: { companyId: string; id: string; onClose: () => void }) {
  const { t, locale } = useT();
  const intl = locale === "so" ? "so" : "en-US";
  const [data, setData] = useState<{ document: DocumentRow; signedUrl: string | null } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    backoffice
      .document(companyId, id)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(formatApiError(e, t("common.error"))));
    return () => {
      cancelled = true;
    };
  }, [companyId, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data?.document;
  const previewable = d && data?.signedUrl && ((d.mimeType.startsWith("image/") && !["image/heic", "image/tiff"].includes(d.mimeType)) || d.mimeType === "application/pdf");

  return (
    <Drawer title={t("inbox.detail")} onClose={onClose} footer={data?.signedUrl ? <LinkButton href={data.signedUrl} external className="w-full">{t("inbox.openOriginal")}</LinkButton> : undefined}>
      {error && <Banner tone="danger">{error}</Banner>}
      {!d && !error && <div className="sk h-64" aria-busy />}
      {d && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill label={t(`docStatus.${d.status}`)} tone={DOCUMENT_TONES[d.status] ?? "grey"} />
            {d.isExactDuplicateOf && <Pill label={t("inbox.duplicate")} tone="amber" />}
          </div>
          <div className="mb-4 flex min-h-[240px] items-center justify-center overflow-hidden rounded-card border border-line bg-surface2">
            {previewable && d.mimeType === "application/pdf" ? (
              <iframe title={d.filename} src={data!.signedUrl!} className="h-[480px] w-full border-0 bg-white" />
            ) : previewable ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data!.signedUrl!} alt={d.filename} className="max-h-[480px] max-w-full object-contain" />
            ) : (
              <div className="p-6 text-center text-[13px] text-ink-3">{t("inbox.noPreview")}</div>
            )}
          </div>
          <DefinitionRow label={t("inbox.hash")} value={d.sha256} mono />
          <DefinitionRow label={t("inbox.received")} value={formatDateTime(d.receivedAt, intl)} />
          <DefinitionRow label={t("inbox.channel")} value={d.channel} />
          <DefinitionRow label={t("inbox.uploadedBy")} value={d.uploadedBy?.fullName ?? "—"} />
          <DefinitionRow label={t("inbox.retention")} value={new Date(d.retentionUntil).toLocaleDateString(intl, { timeZone: "UTC" })} />

          <div className="mt-4 mb-1 text-[13px] font-bold text-ink">{t("inbox.extraction")}</div>
          <p className="mb-2 text-xs text-ink-3">{t("inbox.extractionHint")}</p>
          {!d.regions || d.regions.every((r) => r.runs.length === 0) ? (
            <p className="text-[13px] text-ink-3">{t("inbox.noRuns")}</p>
          ) : (
            d.regions.map((r) => (
              <div key={r.id} className="mb-2 rounded-control border border-line p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-ink">{t("inbox.detail")} · p.{r.page}</span>
                  {r.transaction && (
                    <a href={`/office/transactions?open=${r.transaction.id}`} className="font-semibold text-accent hover:underline">
                      {t("inbox.becameTransaction")} → {t(`txStatus.${r.transaction.status}`)}
                    </a>
                  )}
                </div>
                {r.runs.map((run) => (
                  <div key={`${run.pass}-${run.modelId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-1 text-ink-2">
                    <span className="font-semibold text-ink">{t("inbox.pass")} {run.pass}</span>
                    <span>{run.modelId} · {run.promptVersion}</span>
                    <span className="tnum">{run.costUsd ? `$${run.costUsd}` : "—"}</span>
                    <span className="tnum">{run.latencyMs ? `${run.latencyMs} ms` : ""}</span>
                    {run.status !== "DONE" && <span className="text-danger">{t("inbox.runFailed")}</span>}
                  </div>
                ))}
              </div>
            ))
          )}
          {d.issues.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[13px] font-bold text-ink">{t("inbox.issues")}</div>
              {d.issues.map((i, idx) => (
                <Banner key={idx} tone={i.severity === "ERROR" ? "danger" : i.severity === "WARNING" ? "warning" : "info"} className="mb-2">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <strong>{i.code}</strong> · {i.message}
                  </span>
                </Banner>
              ))}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
