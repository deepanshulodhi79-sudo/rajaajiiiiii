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

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
        {
          error: "Please fill all required fields."
        },
        {
          status: 400
        }
      );
    }

    const smtp = detectSMTP(senderEmail);

    if (!smtp) {
      return Response.json(
        {
          error:
            "This email provider is not configured. Currently supported: Gmail, Yahoo and Outlook."
        },
        {
          status: 400
        }
      );
    }

    /*
     * Convert recipient textarea into an array.
     * One email address per line.
     */

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
        {
          error: "Please enter at least one recipient."
        },
        {
          status: 400
        }
      );
    }

    /*
     * Limit one request.
     */

    const MAX_RECIPIENTS = 50;

    if (recipientList.length > MAX_RECIPIENTS) {
      return Response.json(
        {
          error: `Maximum ${MAX_RECIPIENTS} recipients are allowed per request.`
        },
        {
          status: 400
        }
      );
    }

    /*
     * Basic email validation.
     */

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const invalidEmails = recipientList.filter(
      (email) => !emailRegex.test(email)
    );

    if (invalidEmails.length > 0) {
      return Response.json(
        {
          error: `Invalid email address: ${invalidEmails[0]}`
        },
        {
          status: 400
        }
      );
    }

    /*
     * Optional Reply-To validation.
     */

    let cleanReplyTo = senderEmail;

    if (replyTo && replyTo.trim()) {
      if (!emailRegex.test(replyTo.trim())) {
        return Response.json(
          {
            error: "Invalid Reply-To email address."
          },
          {
            status: 400
          }
        );
      }

      cleanReplyTo = replyTo.trim();
    }

    /*
     * Create SMTP transporter.
     */

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTLS || false,

      auth: {
        user: senderEmail,
        pass: appPassword
      },

      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    /*
     * Verify SMTP login.
     */

    try {
      await transporter.verify();
    } catch (error) {
      transporter.close();

      console.error("SMTP VERIFY ERROR:", error);

      let errorMessage =
        "SMTP authentication failed.";

      if (
        error.code === "EAUTH" ||
        error.responseCode === 535
      ) {
        errorMessage =
          `Authentication failed for ${smtp.provider}. Check the email address and App Password.`;
      }

      return Response.json(
        {
          error: errorMessage
        },
        {
          status: 401
        }
      );
    }

    /*
     * Convert plain text into safe HTML.
     */

    const safeMessage = escapeHtml(message).replace(
      /\r?\n/g,
      "<br>"
    );

    const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>

<body style="
  margin:0;
  padding:0;
  background:#ffffff;
  color:#202124;
  font-family:Arial,Helvetica,sans-serif;
  font-size:15px;
  line-height:1.6;
">

  <div>
    ${safeMessage}
  </div>

</body>
</html>
`;

    let sent = 0;
    let failed = 0;

    const errors = [];

    /*
     * Send each email separately.
     */

    for (const recipient of recipientList) {
      try {
        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,

          to: recipient,

          replyTo: cleanReplyTo,

          subject: subject.trim(),

          text: message,

          html: htmlMessage,

          /*
           * RFC-compatible headers.
           */

          "X-Mailer": "Mail Sender",
          "X-Auto-Response-Suppress": "All"
        });

        sent++;
      } catch (error) {
        failed++;

        console.error(
          `SEND ERROR ${recipient}:`,
          error
        );

        errors.push({
          recipient,
          error:
            error.response ||
            error.message ||
            "Unknown SMTP error"
        });
      }
    }

    transporter.close();

    return Response.json({
      success: sent > 0,

      message:
        sent > 0
          ? `Sending completed. Sent: ${sent}, Failed: ${failed}.`
          : "No emails were sent.",

      provider: smtp.provider,

      sent,

      failed,

      errors
    });
  } catch (error) {
    console.error("MAIL API ERROR:", error);

    return Response.json(
      {
        error:
          "Server error while processing the email request."
      },
      {
        status: 500
      }
    );
  }
}
