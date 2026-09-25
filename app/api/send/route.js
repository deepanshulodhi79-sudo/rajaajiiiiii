import nodemailer from "nodemailer";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request) {
  let transporter;

  try {
    const body = await request.json();

    const {
      senderName,
      senderEmail,
      appPassword,
      recipients,
      subject,
      message
    } = body;

    // -------------------------
    // Basic validation
    // -------------------------

    if (
      !senderName?.trim() ||
      !senderEmail?.trim() ||
      !appPassword?.trim() ||
      !recipients?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return Response.json(
        {
          error: "Please fill all required fields."
        },
        { status: 400 }
      );
    }

    const email = senderEmail
      .trim()
      .toLowerCase();

    if (
      !email.endsWith("@gmail.com") &&
      !email.endsWith("@googlemail.com")
    ) {
      return Response.json(
        {
          error: "Please use a Gmail address."
        },
        { status: 400 }
      );
    }

    if (!emailRegex.test(email)) {
      return Response.json(
        {
          error: "Invalid Gmail address."
        },
        { status: 400 }
      );
    }

    const cleanSenderName =
      cleanHeader(senderName);

    const cleanSubject =
      cleanHeader(subject);

    if (!cleanSenderName || !cleanSubject) {
      return Response.json(
        {
          error:
            "Invalid sender name or subject."
        },
        { status: 400 }
      );
    }

    // -------------------------
    // Recipients
    // -------------------------

    const recipientList = [
      ...new Set(
        recipients
          .split(/\r?\n/)
          .map((item) =>
            item.trim().toLowerCase()
          )
          .filter(Boolean)
      )
    ];

    if (recipientList.length === 0) {
      return Response.json(
        {
          error:
            "Enter at least one recipient."
        },
        { status: 400 }
      );
    }

    if (recipientList.length > 50) {
      return Response.json(
        {
          error:
            "Maximum 50 recipients per request."
        },
        { status: 400 }
      );
    }

    const invalidRecipient =
      recipientList.find(
        (recipient) =>
          !emailRegex.test(recipient)
      );

    if (invalidRecipient) {
      return Response.json(
        {
          error:
            `Invalid recipient email: ${invalidRecipient}`
        },
        { status: 400 }
      );
    }

    // -------------------------
    // Gmail SMTP
    // -------------------------

    transporter =
      nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,

        auth: {
          user: email,
          pass: appPassword.trim()
        },

        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,

        // Keep the SMTP connection conservative.
        pool: false
      });

    // -------------------------
    // Verify Gmail login
    // -------------------------

    try {
      await transporter.verify();
    } catch (error) {
      console.error(
        "GMAIL AUTH ERROR:",
        error
      );

      return Response.json(
        {
          error:
            "Gmail authentication failed. Check your Gmail address and App Password."
        },
        { status: 401 }
      );
    }

    // -------------------------
    // Prepare message
    // -------------------------

    const cleanMessage =
      String(message).trim();

    const htmlMessage =
      escapeHtml(cleanMessage)
        .replace(/\r?\n/g, "<br>");

    let sent = 0;
    let failed = 0;

    const errors = [];

    // -------------------------
    // Send individually
    // -------------------------

    for (const recipient of recipientList) {
      try {
        await transporter.sendMail({
          from: `"${cleanSenderName}" <${email}>`,

          to: recipient,

          subject: cleanSubject,

          text: cleanMessage,

          html: `
<!doctype html>
<html>
  <body>
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6;">
      ${htmlMessage}
    </div>
  </body>
</html>
          `.trim()
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
            error?.message ||
            "Email sending failed."
        });
      }
    }

    // -------------------------
    // Response
    // -------------------------

    return Response.json({
      success: sent > 0,
      provider: "Gmail",
      sent,
      failed,
      message:
        sent > 0
          ? `Email sending completed. Sent: ${sent}, Failed: ${failed}.`
          : "No email was sent.",
      errors
    });

  } catch (error) {
    console.error(
      "MAIL API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Server error while sending email."
      },
      { status: 500 }
    );

  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}
