"use client";

import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    senderName: "",
    senderEmail: "",
    appPassword: "",
    recipients: "",
    subject: "",
    message: ""
  });

  const [status, setStatus] = useState({
    type: "",
    message: ""
  });

  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setStatus({
      type: "",
      message: ""
    });

    setLoading(true);

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus({
        type: "success",
        message: data.message
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setForm({
      senderName: "",
      senderEmail: "",
      appPassword: "",
      recipients: "",
      subject: "",
      message: ""
    });

    setStatus({
      type: "",
      message: ""
    });
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header">
          <div>
            <h1>Mail Sender</h1>
            <p>Send email through your SMTP account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div className="grid">
            <div className="field">
              <label htmlFor="senderName">Sender Name</label>

              <input
                id="senderName"
                name="senderName"
                type="text"
                placeholder="Your Name"
                value={form.senderName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="senderEmail">Sender Email / ID</label>

              <input
                id="senderEmail"
                name="senderEmail"
                type="email"
                placeholder="your@email.com"
                value={form.senderEmail}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="appPassword">App Password</label>

            <input
              id="appPassword"
              name="appPassword"
              type="password"
              placeholder="Enter your app password"
              value={form.appPassword}
              onChange={handleChange}
              autoComplete="off"
              required
            />

            <small>
              Your app password is sent only to the server for this request
              and is not stored by this application.
            </small>
          </div>

          <div className="field">
            <label htmlFor="recipients">
              Recipients
              <span className="labelHint">One email per line</span>
            </label>

            <textarea
              id="recipients"
              name="recipients"
              rows="7"
              placeholder={`person1@example.com
person2@example.com
person3@example.com`}
              value={form.recipients}
              onChange={handleChange}
              required
            />

            <small>
              Enter only recipients you are authorized to contact.
            </small>
          </div>

          <div className="field">
            <label htmlFor="subject">Subject</label>

            <input
              id="subject"
              name="subject"
              type="text"
              placeholder="Email subject"
              value={form.subject}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="message">Main Message</label>

            <textarea
              id="message"
              name="message"
              rows="12"
              placeholder="Write your email message here..."
              value={form.message}
              onChange={handleChange}
              required
            />
          </div>

          {status.message && (
            <div className={`status ${status.type}`}>
              {status.message}
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              className="secondaryButton"
              onClick={clearForm}
              disabled={loading}
            >
              Clear
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Email"}
            </button>
          </div>
        </form>

        <div className="footerNote">
          <span>SMTP Mail Sender</span>
          <span>•</span>
          <span>Vercel Ready</span>
        </div>
      </div>
    </main>
  );
}
