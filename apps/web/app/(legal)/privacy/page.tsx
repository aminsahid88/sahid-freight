import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS: Array<[string, string]> = [
  ["What we collect", "Account details (name, email, optional phone), your company's carrier details (legal name, USDOT, MC, IFTA base jurisdiction), the documents you send us (receipts, statements, mileage reports), and the records we build from them."],
  ["Why we collect it", "To turn your paperwork into verified records and IFTA worksheets, to show you what needs your attention, and to keep an audit trail of who changed what. We do not sell your data and we do not use your documents to train models for anyone else."],
  ["Who can see your documents", "People you add to your company, and our reviewers for the companies they are assigned to. Every view, edit, export and approval is logged. Platform administrators can only open a company's documents through a logged, reason-stamped access."],
  ["How long we keep it", "IFTA records must be kept four years from the later of the return due date or filing date. Documents inside that window cannot be deleted; a deletion request is queued and reviewed. After the window, you can ask us to delete your data."],
  ["Where it lives", "Originals are stored unchanged in access-controlled object storage and served only through short-lived links. Sensitive identifiers such as IFTA account numbers are encrypted at the field level."],
  ["AI processing", "We use AI models to read your documents. Values the model cannot read clearly are left empty and flagged for a person. Rates, math and validation are done by deterministic code, not by a model."],
  ["Contact", "Questions or requests: hello@sahidfreight.com."],
];

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-3xl font-semibold display">Privacy policy</h1>
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
