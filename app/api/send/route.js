import nodemailer from "nodemailer";

function detectSMTP(email) {
  const domain = email.toLowerCase().split("@")[1];

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      provider: "Gmail"
    };
  }

  if (
    domain === "yahoo.com" ||
    domain === "yahoo.co.in" ||
    domain === "yahoo.co.uk"
  ) {
    return {
      host: "smtp.mail.yahoo.com",
      port: 465,
      secure: true,
      provider: "Yahoo"
    };
  }

  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com"
  ) {
    return {
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      requireTLS: true,
      provider: "Outlook/Microsoft"
    };
  }

  return null;
}

// Fixed HTML escaping logic with valid regular expressions
function escapeHtml(text) {
  return text
    .replace(/&/g, "&")
    .replace(//g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      senderName,
      senderEmail,
      appPassword,
      recipients,
      subject,
      message,
      replyTo
    } = body;

    if (
      !senderName ||
      !senderEmail ||
      !appPassword ||
      !recipients ||
      !subject ||
      !message
    ) {
      return Response.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    const smtp = detectSMTP(senderEmail);

    if (!smtp) {
      return Response.json(
        {
          error:
            "This email provider is not configured. Currently supported: Gmail, Yahoo and Outlook."
        },
        { status: 400 }
      );
    }

    const recipientList = [
      ...new Set(
        recipients
          .split(/\r?\n/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      )
    ];

    if (recipientList.length === 0) {
      return Response.json(
        { error: "Please enter at least one recipient." },
        { status: 400 }
      );
    }

    const MAX_RECIPIENTS = 50;

    if (recipientList.length > MAX_RECIPIENTS) {
      return Response.json(
        {
          error: `Maximum ${MAX_RECIPIENTS} recipients are allowed per request.`
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const invalidEmails = recipientList.filter(
      (email) => !emailRegex.test(email)
    );

    if (invalidEmails.length > 0) {
      return Response.json(
        { error: `Invalid email address: ${invalidEmails[0]}` },
        { status: 400 }
      );
    }

    let cleanReplyTo = senderEmail;

    if (replyTo && replyTo.trim()) {
      if (!emailRegex.test(replyTo.trim())) {
        return Response.json(
          { error: "Invalid Reply-To email address." },
          { status: 400 }
        );
      }
      cleanReplyTo = replyTo.trim();
    }

    const transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTLS || false,
      auth: {
        user: senderEmail,
        pass: appPassword
      },
      tls: {
        rejectUnauthorized: true
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    try {
      await transporter.verify();
    } catch (error) {
      transporter.close();
      console.error("SMTP VERIFY ERROR:", error);

      let errorMessage = "SMTP authentication failed.";
      if (error.code === "EAUTH" || error.responseCode === 535) {
        errorMessage = `Authentication failed for ${smtp.provider}. Check the email address and App Password.`;
      }

      return Response.json({ error: errorMessage }, { status: 401 });
    }

    const safeMessage = escapeHtml(message).replace(/\r?\n/g, "
