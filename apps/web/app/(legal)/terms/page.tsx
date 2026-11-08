import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

const SECTIONS: Array<[string, string]> = [
  ["What Sahid Freight does", "Sahid Freight organizes, checks and summarizes your trucking paperwork and prepares an IFTA worksheet for review by you or your preparer. It is a back-office service with software, not a tax preparer, accountant or filing agent."],
  ["What it does not do", "We do not file returns, make payments, or submit anything to any agency. Every deliverable is labeled PRELIMINARY until all errors are resolved and you approve it, and REVIEWED after. You remain responsible for what you file."],
  ["Your documents", "You confirm you are allowed to share the documents you send us and that they belong to your company. Keep your own copies; we store originals for the retention period but we are not your only backup."],
  ["Accuracy", "We flag missing, unreadable, duplicate and inconsistent values rather than guessing. Where a value cannot be verified, it is marked as such. Check the worksheet before relying on it."],
  ["Pilot terms", "During the pilot, plans and prices shown on the site are indicative and may change with notice. You can cancel at any time; your data stays available for export during the retention period."],
  ["Contact", "hello@sahidfreight.com"],
];

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold display">Terms of service</h1>
      <p className="mt-2 text-sm text-ink-3">Pilot version, November 2026. This page will be reviewed by counsel before general availability.</p>
      {SECTIONS.map(([h, p]) => (
        <section key={h} className="mt-8">
          <h2 className="text-lg font-semibold">{h}</h2>
          <p className="mt-2 text-[15px] text-ink-2">{p}</p>
        </section>
      ))}
    </article>
  );
}
