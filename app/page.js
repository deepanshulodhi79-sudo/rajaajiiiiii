"use client";

import { useMemo, useState } from "react";

function parseRecipients(value) {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getRecipientName(email) {
  const localPart = email.split("@")[0];

  return (
    localPart
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, "")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "there"
  );
}

function personalizeMessage(message, email) {
  return message.replace(/\{name\}/gi, getRecipientName(email));
}

export default function Home() {
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [recipients, setRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [status, setStatus] = useState("Ready to send");
  const [statusType, setStatusType] = useState("ready");

  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const [dispatch, setDispatch] = useState([]);

  const recipientList = useMemo(
    () => parseRecipients(recipients),
    [recipients]
  );

  const total = recipientList.length;

  const remaining = Math.max(
    total - sentCount - failedCount,
    0
  );

  const progress =
    total > 0
      ? Math.round(
          ((sentCount + failedCount) / total) * 100
        )
      : 0;

  const invalidRecipients = recipientList.filter(
    (email) => !isValidEmail(email)
  );

  const spamChecks = useMemo(() => {
    return [
      {
        label: "Gmail address",
        ok: /^[^\s@]+@gmail\.com$/i.test(
          senderEmail.trim()
        ),
      },
      {
        label: "Recipients",
        ok:
          total > 0 &&
          invalidRecipients.length === 0,
      },
      {
        label: "Subject",
        ok:
          subject.trim().length > 0 &&
          subject.trim().length <= 200,
      },
      {
        label: "Message",
        ok: message.trim().length > 0,
      },
      {
        label: "Recipient limit",
        ok: total <= 50,
      },
    ];
  }, [
    senderEmail,
    total,
    invalidRecipients.length,
    subject,
    message,
  ]);

  const spamReady = spamChecks.every(
    (check) => check.ok
  );

  function updateRecipients(value) {
    setRecipients(value);

    const list = parseRecipients(value);

    setDispatch(
      list.map((email) => ({
        email,
        status: "waiting",
      }))
    );

    setSentCount(0);
    setFailedCount(0);
    setStatus("Ready to send");
    setStatusType("ready");
  }

  async function verifyGmail() {
    if (
      !senderEmail.trim() ||
      !appPassword.trim()
    ) {
      setStatus(
        "Enter Gmail address and App Password first."
      );
      setStatusType("error");
      return;
    }

    setVerifying(true);
    setStatus("Verifying Gmail SMTP...");
    setStatusType("loading");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderEmail: senderEmail.trim(),
          appPassword: appPassword.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Gmail verification failed."
        );
      }

      setStatus(
        "Gmail SMTP verified successfully."
      );
      setStatusType("success");
    } catch (error) {
      setStatus(
        error.message ||
          "Gmail verification failed."
      );
      setStatusType("error");
    } finally {
      setVerifying(false);
    }
  }

  async function sendAll() {
    if (sending) return;

    if (!senderName.trim()) {
      setStatus("Enter sender name.");
      setStatusType("error");
      return;
    }

    if (!senderEmail.trim()) {
      setStatus("Enter Gmail address.");
      setStatusType("error");
      return;
    }

    if (!appPassword.trim()) {
      setStatus("Enter Gmail App Password.");
      setStatusType("error");
      return;
    }

    if (!subject.trim()) {
      setStatus("Enter email subject.");
      setStatusType("error");
      return;
    }

    if (!message.trim()) {
      setStatus("Enter message body.");
      setStatusType("error");
      return;
    }

    if (total === 0) {
      setStatus("Add at least one recipient.");
      setStatusType("error");
      return;
    }

    if (invalidRecipients.length > 0) {
      setStatus(
        `Invalid recipient: ${invalidRecipients[0]}`
      );
      setStatusType("error");
      return;
    }

    if (total > 50) {
      setStatus(
        "Maximum 50 recipients per send."
      );
      setStatusType("error");
      return;
    }

    if (!spamReady) {
      setStatus(
        "Please fix the validation checks first."
      );
      setStatusType("error");
      return;
    }

    setSending(true);
    setSentCount(0);
    setFailedCount(0);

    setDispatch(
      recipientList.map((email) => ({
        email,
        status: "waiting",
      }))
    );

    setStatus("Starting dispatch...");
    setStatusType("loading");

    let sent = 0;
    let failed = 0;

    for (
      let i = 0;
      i < recipientList.length;
      i++
    ) {
      const recipient = recipientList[i];

      setDispatch((current) =>
        current.map((item, index) =>
          index === i
            ? {
                ...item,
                status: "sending",
              }
            : item
        )
      );

      try {
        const personalized = personalizeMessage(
          message,
          recipient
        );

        const response = await fetch(
          "/api/send",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              senderName,
              senderEmail,
              appPassword,
              recipient,
              subject,
              message: personalized,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Send failed."
          );
        }

        sent++;

        setSentCount(sent);

        setDispatch((current) =>
          current.map((item, index) =>
            index === i
              ? {
                  ...item,
                  status: "sent",
                }
              : item
          )
        );
      } catch (error) {
        failed++;

        setFailedCount(failed);

        setDispatch((current) =>
          current.map((item, index) =>
            index === i
              ? {
                  ...item,
                  status: "failed",
                  error: error.message,
                }
              : item
          )
        );
      }

      setStatus(
        `Dispatching... ${
          sent + failed
        }/${recipientList.length}`
      );

      setStatusType("loading");
    }

    setSending(false);

    if (failed === 0) {
      setStatus(
        `All ${sent} emails sent successfully.`
      );
      setStatusType("success");
    } else {
      setStatus(
        `Completed. Sent: ${sent}, Failed: ${failed}.`
      );
      setStatusType("error");
    }
  }

  function clearForm() {
    if (sending) return;

    setSenderName("");
    setSenderEmail("");
    setAppPassword("");
    setRecipients("");
    setSubject("");
    setMessage("");

    setSentCount(0);
    setFailedCount(0);
    setDispatch([]);

    setStatus("Ready to send");
    setStatusType("ready");
  }

  return (
    <main className="page">
      <div className="container">

        {/* HEADER */}
        <header className="topbar">
          <h1>
            <span className="brand-icon">➤</span>
            Bulk Email Sender
          </h1>

          <div className="header-badge">
            Gmail SMTP
          </div>
        </header>

        {/* DASHBOARD */}
        <div className="dashboard">

          {/* COMPOSE */}
          <section className="card compose-card">

            <div className="card-heading">
              <div className="heading-left">
                <span className="heading-icon">
                  ✎
                </span>

                <h2>Compose Message</h2>
              </div>
            </div>

            <div className="form-grid">

              <div className="form-group">
                <label>Sender Name</label>

                <input
                  type="text"
                  value={senderName}
                  onChange={(e) =>
                    setSenderName(e.target.value)
                  }
                  placeholder="E.g. John Doe"
                  disabled={sending}
                />
              </div>

              <div className="form-group">
                <label>Your Gmail</label>

                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) =>
                    setSenderEmail(e.target.value)
                  }
                  placeholder="you@gmail.com"
                  disabled={sending}
                />
              </div>

              <div className="form-group">
                <label>App Password</label>

                <div className="password-row">
                  <input
                    type="password"
                    value={appPassword}
                    onChange={(e) =>
                      setAppPassword(
                        e.target.value
                      )
                    }
                    placeholder="16-character App Password"
                    disabled={sending}
                  />

                  <button
                    type="button"
                    className="verify-button"
                    onClick={verifyGmail}
                    disabled={
                      sending || verifying
                    }
                  >
                    {verifying
                      ? "Checking..."
                      : "Verify"}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Email Subject</label>

                <input
                  type="text"
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  placeholder="Enter subject line..."
                  disabled={sending}
                />
              </div>

              <div className="form-group full-width">
                <label>
                  Message Body
                  <span className="hint">
                    {" "}
                    • {"{name}"} supported
                  </span>
                </label>

                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  placeholder="Write your email here..."
                  disabled={sending}
                />
              </div>

            </div>

            {/* SPAM PROTECTION */}
            <div className="protection-box">

              <div className="protection-header">
                <div>
                  <span className="shield">
                    🛡
                  </span>

                  <strong>
                    Spam Protection
                  </strong>
                </div>

                <span
                  className={
                    spamReady
                      ? "ready-pill"
                      : "check-pill"
                  }
                >
                  {spamReady
                    ? "READY"
                    : "CHECK"}
                </span>
              </div>

              <div className="checks-grid">
                {spamChecks.map((check) => (
                  <div
                    className="check-item"
                    key={check.label}
                  >
                    <span
                      className={
                        check.ok
                          ? "check-icon ok"
                          : "check-icon bad"
                      }
                    >
                      {check.ok
                        ? "✓"
                        : "!"}
                    </span>

                    <span>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>

              <p>
                Local validation only. Gmail makes
                the final spam decision.
              </p>
            </div>
          </section>

          {/* RECIPIENTS */}
          <section className="card recipients-card">

            <div className="card-heading">
              <div className="heading-left">
                <span className="heading-icon purple">
                  👥
                </span>

                <h2>Recipients</h2>
              </div>

              <span className="count-badge">
                {total} found
              </span>
            </div>

            <label className="small-label">
              Paste emails, comma separated or new
              lines
            </label>

            <textarea
              className="recipient-textarea"
              value={recipients}
              onChange={(e) =>
                updateRecipients(
                  e.target.value
                )
              }
              placeholder={`recipient1@example.com
recipient2@example.com`}
              disabled={sending}
            />

            <div className="recipient-info">
              <span>
                {total} unique recipient
                {total === 1 ? "" : "s"}
              </span>

              {invalidRecipients.length >
                0 && (
                <span className="invalid-text">
                  {invalidRecipients.length} invalid
                </span>
              )}
            </div>
          </section>

          {/* PROGRESS */}
          <section className="card progress-card">

            <div className="card-heading">
              <div className="heading-left">
                <span className="heading-icon">
                  ◔
                </span>

                <h2>Progress Monitor</h2>
              </div>
            </div>

            <div className="stats-grid">

              <div className="stat-box blue">
                <span>TOTAL</span>
                <strong>{total}</strong>
              </div>

              <div className="stat-box green">
                <span>SENT</span>
                <strong>{sentCount}</strong>
              </div>

              <div className="stat-box red">
                <span>FAILED</span>
                <strong>{failedCount}</strong>
              </div>

              <div className="stat-box orange">
                <span>REMAINING</span>
                <strong>{remaining}</strong>
              </div>

            </div>

            <div className="progress-info">
              <span>Progress</span>
              <strong>
                {progress}%
              </strong>
            </div>

            <div className="progress-track">
              <div
                className="progress-bar"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="status-line">
              <span className="status-dot">
                ●
              </span>

              <span
                className={`status-${statusType}`}
              >
                {status}
              </span>
            </div>

            <div className="button-row">

              <button
                type="button"
                className="send-button"
                onClick={sendAll}
                disabled={sending}
              >
                {sending ? (
                  <>
                    <span className="spinner" />
                    Sending...
                  </>
                ) : (
                  <>
                    ➤ Send All
                  </>
                )}
              </button>

              <button
                type="button"
                className="clear-button"
                onClick={clearForm}
                disabled={sending}
              >
                Clear
              </button>

            </div>
          </section>

          {/* LIVE DISPATCH */}
          <section className="card dispatch-card">

            <div className="card-heading">

              <div className="heading-left">
                <span className="heading-icon yellow">
                  ⚡
                </span>

                <h2>
                  Live Recipients Dispatch
                </h2>
              </div>

              <span className="count-badge">
                {sentCount +
                  failedCount}
                /{total}
              </span>

            </div>

            <div className="dispatch-list">

              {dispatch.length === 0 ? (
                <div className="empty-dispatch">
                  No recipients dispatched yet.
                </div>
              ) : (
                dispatch.map((item) => (
                  <div
                    className="dispatch-item"
                    key={item.email}
                  >
                    <div className="dispatch-email">
                      {item.email}
                    </div>

                    <div
                      className={`dispatch-status ${item.status}`}
                    >
                      {item.status ===
                        "waiting" &&
                        "Waiting"}

                      {item.status ===
                        "sending" && (
                        <>
                          <span className="mini-spinner" />
                          Sending
                        </>
                      )}

                      {item.status ===
                        "sent" &&
                        "✓ Sent"}

                      {item.status ===
                        "failed" &&
                        "✕ Failed"}
                    </div>
                  </div>
                ))
              )}

            </div>
          </section>

        </div>

        <footer>
          Gmail SMTP • Vercel Ready
        </footer>

      </div>
    </main>
  );
}
