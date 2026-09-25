import nodemailer from "nodemailer";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
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

    // Required fields
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

    const email = senderEmail.trim().toLowerCase();

    // Gmail only
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

    // Clean headers
    const cleanSenderName = cleanHeader(senderName);
    const cleanSubject = cleanHeader(subject);

    if (!cleanSenderName || !cleanSubject) {
      return Response.json(
        {
          error: "Invalid sender name or subject."
        },
        { status: 400 }
      );
    }

    // Recipient list
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
          error: "Enter at least one recipient."
        },
        { status: 400 }
      );
    }

    if (recipientList.length > 50) {
      return Response.json(
        {
          error: "Maximum 50 recipients per request."
        },
        { status: 400 }
      );
    }

    const invalidRecipient = recipientList.find(
      (recipient) =>
        !emailRegex.test(recipient) ||
        /[\r\n]/.test(recipient)
    );

    if (invalidRecipient) {
      return Response.json(
        {
          error: `Invalid recipient email: ${invalidRecipient}`
        },
        { status: 400 }
      );
    }

    // Gmail SMTP
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,

      auth: {
        user: email,
        pass: appPassword.trim()
      },

      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    // Verify Gmail authentication
    try {
      await transporter.verify();
    } catch (error) {
      console.error("GMAIL AUTH ERROR:", error);

      return Response.json(
        {
          error:
            "Gmail authentication failed. Check your Gmail address and App Password."
        },
        { status: 401 }
      );
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    // Send individually
    for (const recipient of recipientList) {
      try {
        await transporter.sendMail({
          from: {
            name: cleanSenderName,
            address: email
          },

          to: recipient,

          subject: cleanSubject,

          text: message.trim(),

          headers: {
            "X-Mailer": "Mail Sender"
          }
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
    console.error("MAIL API ERROR:", error);

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
