"use client";
/**
 * Inbox: upload → list → preview. The Phase 0 gate screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, FileText, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { backoffice, type DocumentRow, type DocumentStatus, formatBytes, shortHash, type UploadResult } from "@/lib/backoffice";
import { useCompanyStore } from "@/lib/company";
import { formatApiError } from "@/lib/errors";
import { useT } from "@/lib/useT";
import { DOCUMENT_TONES, StatusPill } from "@/components/office/StatusPill";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.csv,.xlsx,application/pdf,image/*,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_MB = 25;
const STATUSES: DocumentStatus[] = ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "UNREADABLE"];

export default function InboxPage() {
  const { t, locale } = useT();
  const { selected } = useCompanyStore();
  const companyId = selected?.company.id;

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocumentStatus | "ALL">("ALL");
  // Loading is derived: the list is stale until the key it was loaded for matches the current key.
  const listKey = `${companyId ?? ""}:${filter}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = loadedKey !== listKey || loadingMore;
  const [listError, setListError] = useState("");

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0); // file count in flight
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(
    (reset: boolean, after?: string | null) => {
      if (!companyId) return Promise.resolve();
      const key = `${companyId}:${filter}`;
      return backoffice
        .documents(companyId, { status: filter === "ALL" ? undefined : filter, cursor: reset ? undefined : after ?? undefined, limit: 30 })
        .then((res) => {
          setDocs((prev) => (reset ? res.documents : [...prev, ...res.documents]));
          setCursor(res.nextCursor);
          setListError("");
          setLoadedKey(key);
        })
        .catch((e) => {
          setListError(formatApiError(e, t("common.error")));
          setLoadedKey(key);
        });
    },
    [companyId, filter, t],
  );

  useEffect(() => {
    let cancelled = false;
    if (!companyId) return;
    const key = `${companyId}:${filter}`;
    backoffice
      .documents(companyId, { status: filter === "ALL" ? undefined : filter, limit: 30 })
      .then((res) => {
        if (cancelled) return;
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

  const loadMore = () => {
    setLoadingMore(true);
    load(false, cursor).finally(() => setLoadingMore(false));
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
      await load(true);
    } catch (e) {
      setUploadError(formatApiError(e, t("upload.failed")));
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale === "so" ? "so-SO" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", margin: "0 0 4px", color: "var(--text)" }}>{t("inbox.title")}</h1>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>{t("inbox.subtitle")}</p>
        </div>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        aria-label={t("inbox.upload")}
        style={{ border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`, background: dragging ? "var(--accent-dim)" : "var(--bg)", borderRadius: 16, padding: "28px 20px", textAlign: "center", cursor: uploading ? "progress" : "pointer", marginBottom: 20, transition: "all .12s" }}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT} capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files && onFiles(e.target.files)} />
        <UploadCloud size={28} color="var(--accent)" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{uploading ? t("inbox.uploading", { count: uploading }) : t("inbox.dropHere")}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{t("inbox.accepted", { max: MAX_MB })}</div>
        {uploading > 0 && (
          <div aria-label={`${progress}%`} style={{ height: 6, background: "var(--surface2)", borderRadius: 999, marginTop: 14, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width .2s" }} />
          </div>
        )}
      </div>

      {uploadError && <Banner tone="red">{uploadError}</Banner>}
      {result && (
        <div style={{ marginBottom: 16 }}>
          {result.uploaded.length > 0 && <Banner tone="green">{t("inbox.uploaded", { count: result.uploaded.length })}</Banner>}
          {result.rejected.length > 0 && (
            <Banner tone="amber">
              {t("inbox.rejected", { count: result.rejected.length })}
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {result.rejected.map((r, i) => (
                  <li key={i}>{t("inbox.rejectedReason", { file: r.filename, reason: t(`reason.${r.reason}`) })}</li>
                ))}
              </ul>
            </Banner>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${filter === s ? "var(--accent)" : "var(--border)"}`, background: filter === s ? "var(--accent-dim)" : "var(--bg)", color: filter === s ? "var(--accent)" : "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {s === "ALL" ? t("inbox.filterAll") : t(`docStatus.${s}`)}
          </button>
        ))}
      </div>

      {listError && <Banner tone="red">{listError}</Banner>}

      {/* List */}
      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading && docs.length === 0 ? (
          <div style={{ padding: 20 }}>
            {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 52, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>{t("inbox.empty")}</div>
        ) : (
          docs.map((d) => (
            <button key={d.id} onClick={() => setOpenId(d.id)} style={{ width: "100%", display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "center", gap: 12, padding: "12px 16px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 56 }}>
              <span style={{ color: "var(--text-muted)" }}>{d.mimeType.startsWith("image/") ? <ImageIcon size={20} /> : <FileText size={20} />}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.filename}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {fmtDate(d.receivedAt)} · {formatBytes(d.sizeBytes)} · <code style={{ fontSize: 11 }}>{shortHash(d.sha256)}</code>
                  {d.isExactDuplicateOf && <span style={{ marginLeft: 8, color: "#B45309", display: "inline-flex", alignItems: "center", gap: 4 }}><Copy size={12} /> {t("inbox.duplicate")}</span>}
                </span>
              </span>
              <StatusPill label={t(`docStatus.${d.status}`)} tone={DOCUMENT_TONES[d.status] ?? "grey"} />
            </button>
          ))
        )}
        {cursor && (
          <button onClick={loadMore} disabled={loading} style={{ width: "100%", padding: 14, border: "none", background: "var(--surface)", color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t("inbox.loadMore")}
          </button>
        )}
      </div>

      {openId && companyId && <DocumentDrawer key={openId} companyId={companyId} id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Banner({ tone, children }: { tone: "green" | "amber" | "red"; children: React.ReactNode }) {
  const c = tone === "green" ? ["#F0FDF4", "#15803D", "#BBF7D0"] : tone === "amber" ? ["#FFFBEB", "#B45309", "#FDE68A"] : ["#FEF2F2", "#B91C1C", "#FECACA"];
  return (
    <div role={tone === "red" ? "alert" : "status"} style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 10, background: c[0], color: c[1], border: `1px solid ${c[2]}`, fontSize: 13 }}>
      {children}
    </div>
  );
}

function DocumentDrawer({ companyId, id, onClose }: { companyId: string; id: string; onClose: () => void }) {
  const { t, locale } = useT();
  const [data, setData] = useState<{ document: DocumentRow; signedUrl: string | null } | null>(null);
  const [error, setError] = useState("");

  // Remounted by key when `id` changes, so state starts empty for each document.
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = data?.document;
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text)", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  return (
    <div role="dialog" aria-modal aria-label={t("inbox.detail")} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", height: "100%", background: "var(--bg)", overflowY: "auto", padding: 20, boxShadow: "var(--dropdown-shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{t("inbox.detail")}</h2>
          <button onClick={onClose} aria-label={t("common.cancel")} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)" }}><X size={18} /></button>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!d && !error && <div className="sk" style={{ height: 240, borderRadius: 12 }} />}
        {d && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <StatusPill label={t(`docStatus.${d.status}`)} tone={DOCUMENT_TONES[d.status] ?? "grey"} />
              {d.isExactDuplicateOf && <StatusPill label={t("inbox.duplicate")} tone="amber" />}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface2)", minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              {data?.signedUrl && d.mimeType.startsWith("image/") && d.mimeType !== "image/heic" && d.mimeType !== "image/tiff" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.signedUrl} alt={d.filename} style={{ maxWidth: "100%", maxHeight: 480, objectFit: "contain" }} />
              ) : data?.signedUrl && d.mimeType === "application/pdf" ? (
                <iframe title={d.filename} src={data.signedUrl} style={{ width: "100%", height: 480, border: "none", background: "#fff" }} />
              ) : (
                <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>{t("inbox.noPreview")}</div>
              )}
            </div>
            {data?.signedUrl && (
              <a href={data.signedUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 16px", borderRadius: 10, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", marginBottom: 16 }}>
                {t("inbox.openOriginal")}
              </a>
            )}
            {row(t("inbox.hash"), <code style={{ fontSize: 11 }}>{d.sha256}</code>)}
            {row(t("inbox.received"), new Date(d.receivedAt).toLocaleString(locale === "so" ? "so-SO" : "en-US"))}
            {row(t("inbox.channel"), d.channel)}
            {row(t("inbox.uploadedBy"), d.uploadedBy?.fullName ?? "—")}
            {row(t("inbox.retention"), new Date(d.retentionUntil).toLocaleDateString(locale === "so" ? "so-SO" : "en-US", { timeZone: "UTC" }))}
            {d.issues.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{t("inbox.issues")}</div>
                {d.issues.map((i, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, background: "#FFFBEB", color: "#92400E", fontSize: 13, marginBottom: 6 }}>
                    <AlertTriangle size={14} style={{ marginTop: 2 }} />
                    <span><strong>{i.code}</strong> · {i.message}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
