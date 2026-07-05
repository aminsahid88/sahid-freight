import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Sahid Freight",
  description:
    "How Sahid Freight collects, uses, and protects your personal information across Ethiopia, Somalia, and Djibouti.",
};

const P = "#0A1F44";
const A = "#3D7BFF";
const TEXT = "#0A1F44";
const TEXT_SECONDARY = "#475569";
const MUTED = "#94A3B8";
const BG = "#F8FAFC";
const SRF = "#FFFFFF";
const BORDER = "#E2E8F0";

const EFFECTIVE_DATE = "June 22, 2026";
const CONTACT_EMAIL = "info@sahidfreight.com";

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "48px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "20px" }}>
        <span style={{ fontSize: "13px", fontWeight: "800", color: A, letterSpacing: "1px" }}>
          {num.padStart(2, "0")}
        </span>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: P, letterSpacing: "-0.5px" }}>
          {title}
        </h2>
      </div>
      <div style={{ fontSize: "15px", lineHeight: 1.75, color: TEXT_SECONDARY }}>{children}</div>
    </section>
  );
}

const linkStyle = { color: A, textDecoration: "none", fontWeight: 600 } as const;
const liStyle = { marginBottom: "10px" } as const;
const strongStyle = { color: TEXT, fontWeight: 600 } as const;

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HEADER ────────────────────────────────── */}
      <header style={{ background: SRF, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <img src="/logo.svg" alt="Sahid Freight" style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "contain" }} />
            <span style={{ fontSize: "18px", fontWeight: "800", color: P, letterSpacing: "-0.3px" }}>Sahid Freight</span>
          </Link>
          <Link href="/" style={{ color: TEXT_SECONDARY, fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
            ← Back to home
          </Link>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${P} 0%, #13316B 100%)`, padding: "72px 24px", color: "#fff" }}>
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", borderRadius: "99px", padding: "5px 14px", fontSize: "11px", fontWeight: "700", color: A, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "20px" }}>
            Privacy
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "800", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
            Privacy Policy
          </h1>
          <p style={{ margin: "0 0 8px", fontSize: "17px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, maxWidth: "640px" }}>
            How we collect, use, and protect your personal information across Ethiopia, Somalia, and Djibouti.
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.5px" }}>
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {/* ── BODY ──────────────────────────────────── */}
      <main style={{ maxWidth: "880px", margin: "0 auto", padding: "72px 24px" }}>
        <div style={{ background: SRF, borderRadius: "20px", padding: "56px", border: `1px solid ${BORDER}`, boxShadow: "0 2px 4px rgba(10,31,68,0.04), 0 16px 48px rgba(10,31,68,0.06)" }}>

          {/* Intro */}
          <Section num="1" title="Introduction">
            <p style={{ marginTop: 0 }}>
              Sahid Freight (“we,” “our,” or “us”) operates a freight marketplace that connects cargo
              senders with truck owners and drivers across Ethiopia, Somalia, and Djibouti. This Privacy
              Policy explains what personal information we collect when you use our mobile app or website,
              how we use it, who we share it with, and the rights you have over your information.
            </p>
            <p>
              This policy applies to the Sahid Freight Android app, the website at{" "}
              <span style={strongStyle}>sahidfreight.com</span>, and any related services we operate
              (collectively, the “Service”). By creating an account or using the Service, you agree to the
              practices described here.
            </p>
            <p style={{ marginBottom: 0 }}>
              If you do not agree with this policy, please do not use the Service. If you have any
              questions, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          {/* What we collect */}
          <Section num="2" title="Information We Collect">
            <p style={{ marginTop: 0 }}>
              We only collect information we need to operate the Service. Specifically:
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Account and identity information
            </h3>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}><span style={strongStyle}>Full name</span> — provided at registration.</li>
              <li style={liStyle}><span style={strongStyle}>Email address</span> — used as the verified channel for your account and for one-time codes.</li>
              <li style={liStyle}><span style={strongStyle}>Phone number</span> — used as your sign-in identifier and as a contact number for your counterparties in a booking (for example, a driver and sender may need to call each other to coordinate a pickup).</li>
              <li style={liStyle}><span style={strongStyle}>Password</span> — stored as a one-way bcrypt hash. We never store or transmit your password in plain text; it is stored using one-way encryption (hashing) that cannot be reversed.</li>
              <li style={liStyle}><span style={strongStyle}>City and country</span> — used to surface relevant loads and trucks in your region.</li>
              <li style={liStyle}><span style={strongStyle}>Role</span> — whether you registered as a Cargo Sender, Truck Owner, or Driver.</li>
            </ul>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Location information
            </h3>
            <p style={{ marginTop: 0 }}>
              We collect <span style={strongStyle}>precise GPS location</span> from a driver’s device{" "}
              <span style={strongStyle}>only during an active delivery</span> — that is, only while a
              booking is in the “in-transit” state. Location is sampled while the driver screen is open
              and posted to our servers so that the cargo sender can see where their shipment is in real
              time. We stop collecting location when the booking is marked delivered, cancelled, or
              otherwise no longer in transit.
            </p>
            <p style={{ marginBottom: 0 }}>
              We do not collect location from cargo senders or from drivers who are not on an active
              booking. You can revoke the location permission at any time in your device settings; if you
              do, you will not be able to act as the driver on an in-transit booking.
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Photos
            </h3>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}><span style={strongStyle}>Proof-of-delivery photos</span> — captured or uploaded by the driver to confirm a successful delivery.</li>
              <li style={liStyle}><span style={strongStyle}>Truck photos</span> — uploaded by truck owners to identify their vehicles.</li>
            </ul>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Identity verification documents
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              To verify accounts, we ask users to upload documents such as a{" "}
              <span style={strongStyle}>national ID</span>,{" "}
              <span style={strongStyle}>driver’s licence</span>,{" "}
              <span style={strongStyle}>trade licence</span>, and a{" "}
              <span style={strongStyle}>profile photo</span>. These documents are reviewed by our
              verification team and are used solely to confirm that the person or business behind an
              account is who they claim to be. We do not publish these documents anywhere on the Service.
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Communications between users
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              In-app chat messages are sent between users in the context of a specific booking. Message
              content, the sender and recipient, the timestamp, and read status are stored on our servers
              so that the conversation history is available to the participants.
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              Payments
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              We do <span style={strongStyle}>not</span> collect or store your card number, bank account,
              or other financial credentials. Payments are processed by third-party gateways{" "}
              <span style={strongStyle}>Chapa</span> (Ethiopia) and{" "}
              <span style={strongStyle}>Waafi</span> (Somalia). When you initiate a payment, we share the
              transaction amount and your contact information (email and phone) with the gateway so it
              can complete the transaction. We receive only the status of the payment (succeeded,
              pending, failed) and a reference identifier.
            </p>

          </Section>

          {/* How we use it */}
          <Section num="3" title="How We Use Your Information">
            <p style={{ marginTop: 0 }}>We use the information described above only to:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}>Provide the freight marketplace — let cargo senders post loads, truck owners place bids, and bookings be confirmed and tracked.</li>
              <li style={liStyle}>Verify the identity of users so other people on the platform can trust who they are dealing with.</li>
              <li style={liStyle}>Enable real-time shipment tracking by streaming driver GPS to the cargo sender during active deliveries.</li>
              <li style={liStyle}>Send one-time verification codes to your email when you register or reset your password.</li>
              <li style={liStyle}>Pass the necessary contact and amount information to a payment gateway when you choose to pay through the app.</li>
              <li style={liStyle}>Respond to support requests and resolve disputes between users.</li>
              <li style={liStyle}>Keep the Service secure — detect and prevent fraud, abuse, or unauthorised access.</li>
              <li style={liStyle}>Comply with applicable laws and respond to lawful requests from authorities.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              We do not use your information for advertising and we do not run third-party advertising
              networks inside the Service.
            </p>
          </Section>

          {/* How we share it */}
          <Section num="4" title="How We Share Your Information">
            <p style={{ marginTop: 0 }}>
              <span style={strongStyle}>We do not sell your personal information.</span> We share
              information in only the limited cases described below.
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              With other users you transact with
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              When you book a load or accept a bid, your name, phone number, and relevant booking details
              are shared with the counterparties in that transaction (sender, owner, driver) so they can
              coordinate. While a delivery is in transit, the driver’s live location is shared with the
              cargo sender on that booking.
            </p>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              With service providers we rely on
            </h3>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}>
                <span style={strongStyle}>Resend</span> — sends our transactional emails, including the
                one-time verification codes used to register and reset passwords. Resend receives the
                recipient email address and the email content.
              </li>
              <li style={liStyle}>
                <span style={strongStyle}>Chapa</span> and <span style={strongStyle}>Waafi</span> —
                process payments in Ethiopia and Somalia respectively. They receive the transaction
                amount and your email and phone number so they can complete the payment.
              </li>
              <li style={liStyle}>
                <span style={strongStyle}>Cloud infrastructure providers</span> — host our database,
                application servers, and document storage. Data stored with these providers is encrypted
                at rest and access is restricted to our team.
              </li>
            </ul>

            <h3 style={{ fontSize: "16px", fontWeight: "700", color: TEXT, margin: "24px 0 10px" }}>
              For legal reasons
            </h3>
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              We may disclose information if we are required to by law, court order, or other lawful
              request from a public authority; or if we reasonably believe disclosure is necessary to
              protect the rights, property, or safety of Sahid Freight, our users, or the public.
            </p>
          </Section>

          {/* Retention */}
          <Section num="5" title="Data Retention">
            <p style={{ marginTop: 0 }}>
              We keep your information for as long as your account is active and as long as we need it to
              provide the Service or to comply with our legal obligations. Specifically:
            </p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}>Account information is retained while your account exists.</li>
              <li style={liStyle}>Booking, message, and payment records are retained for our records and for any required tax or audit period.</li>
              <li style={liStyle}>Location points captured during a delivery are retained as part of that booking’s history so users can review where a shipment travelled.</li>
              <li style={liStyle}>Verification documents are retained while your account is verified; they are deleted on account deletion unless we are required to keep them by law.</li>
              <li style={liStyle}>One-time verification codes are short-lived (expire within minutes) and are deleted shortly after they are consumed or expire.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              When you delete your account, we delete or anonymise your personal information within a
              reasonable period, except where we are required to keep certain records for legal,
              accounting, or fraud-prevention purposes.
            </p>
          </Section>

          {/* Security */}
          <Section num="6" title="How We Protect Your Information">
            <p style={{ marginTop: 0 }}>We use industry-standard safeguards, including:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}><span style={strongStyle}>TLS encryption in transit</span> — all traffic between the app or website and our servers is encrypted.</li>
              <li style={liStyle}><span style={strongStyle}>Hashed passwords</span> — your password is never stored in plaintext. We use bcrypt with a high work factor, and no one on our team can read it.</li>
              <li style={liStyle}><span style={strongStyle}>Access controls</span> — only authorised members of our operations and verification team can view personal information, and only when their job requires it.</li>
              <li style={liStyle}><span style={strongStyle}>Encryption at rest</span> — uploaded documents and photos are stored in encrypted object storage.</li>
              <li style={liStyle}><span style={strongStyle}>Short-lived verification tokens</span> — codes and verification tokens expire quickly to limit the damage of any intercepted credential.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              No internet service can guarantee perfect security. If you believe your account has been
              compromised, please change your password and contact us immediately.
            </p>
          </Section>

          {/* Rights */}
          <Section num="7" title="Your Rights">
            <p style={{ marginTop: 0 }}>You have the right to:</p>
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              <li style={liStyle}><span style={strongStyle}>Access</span> the personal information we hold about you.</li>
              <li style={liStyle}><span style={strongStyle}>Correct</span> information that is inaccurate or incomplete — most fields can be edited directly in your profile.</li>
              <li style={liStyle}><span style={strongStyle}>Delete</span> your account and the personal information we hold about you, subject to limited legal-retention exceptions.</li>
              <li style={liStyle}><span style={strongStyle}>Withdraw permissions</span> you previously granted to the app — for example, location, camera, or notifications — in your device settings.</li>
              <li style={liStyle}><span style={strongStyle}>Object or restrict</span> certain uses of your information where applicable law gives you that right.</li>
            </ul>
            <p style={{ marginBottom: 0 }}>
              To exercise any of these rights, write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a> from the email
              address on your account. We may need to verify your identity before we act on a request.
            </p>
          </Section>

          {/* Children */}
          <Section num="8" title="Children">
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              Sahid Freight is intended for adults aged 18 and over. We do not knowingly collect personal
              information from anyone under 18. If you believe a child has provided us with personal
              information, please contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a> and we will delete
              it.
            </p>
          </Section>

          {/* Changes */}
          <Section num="9" title="Changes to This Policy">
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              We may update this Privacy Policy from time to time — for example, when we add features or
              change how we work with service providers. When we do, we will update the “Effective date”
              at the top of this page and, for material changes, notify you in the app or by email.
              Continuing to use the Service after a change takes effect means you accept the updated
              policy.
            </p>
          </Section>

          {/* Contact */}
          <Section num="10" title="Contact Us">
            <p style={{ marginTop: 0, marginBottom: 0 }}>
              If you have any questions about this Privacy Policy, your information, or your rights,
              please contact us:
              <br /><br />
              <span style={strongStyle}>Sahid Freight</span>
              <br />
              Addis Ababa, Ethiopia
              <br />
              <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
            </p>
          </Section>

        </div>
      </main>

      {/* ── FOOTER (matches landing page) ─────────── */}
      <footer style={{ background: P, padding: "40px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo.svg" alt="Sahid Freight" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "contain" }} />
            <span style={{ color: "#fff", fontSize: "15px", fontWeight: "700", letterSpacing: "-0.3px" }}>Sahid Freight</span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
            © {new Date().getFullYear()} Sahid Freight · Ethiopia · Somalia · Djibouti
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", textDecoration: "none" }}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>

    </div>
  );
}
