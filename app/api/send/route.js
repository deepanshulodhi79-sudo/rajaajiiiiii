import nodemailer from "nodemailer";

function getSMTP(email) {
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
      provider: "Microsoft"
    };
  }

  return null;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let transporter;

  try {
    const {
      senderName,
      senderEmail,
      appPassword,
      recipients,
      subject,
      message,
      replyTo
    } = await request.json();

    if (
      !senderName?.trim() ||
      !senderEmail?.trim() ||
      !appPassword?.trim() ||
      !recipients?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return Response.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    const email = senderEmail.trim().toLowerCase();

    if (!emailRegex.test(email)) {
      return Response.json(
        { error: "Invalid sender email address." },
        { status: 400 }
      );
    }

    const smtp = getSMTP(email);

    if (!smtp) {
      return Response.json(
        {
          error:
            "Currently supported providers are Gmail, Yahoo and Outlook."
        },
        { status: 400 }
      );
    }

    const recipientList = [
      ...new Set(
        recipients
          .split(/\r?\n/)
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    ];

    if (recipientList.length === 0) {
      return Response.json(
        { error: "Enter at least one recipient." },
        { status: 400 }
      );
    }

    if (recipientList.length > 50) {
      return Response.json(
        { error: "Maximum 50 recipients per request." },
        { status: 400 }
      );
    }

    const invalidRecipient = recipientList.find(
      (item) => !emailRegex.test(item)
    );

    if (invalidRecipient) {
      return Response.json(
        {
          error: `Invalid recipient email: ${invalidRecipient}`
        },
        { status: 400 }
      );
    }

    const cleanReplyTo = replyTo?.trim() || email;

    if (!emailRegex.test(cleanReplyTo)) {
      return Response.json(
        { error: "Invalid Reply-To email address." },
        { status: 400 }
      );
    }

    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTLS || false,
      auth: {
        user: email,
        pass: appPassword.trim()
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    try {
      await transporter.verify();
    } catch (error) {
      console.error("SMTP VERIFY ERROR:", error);

      return Response.json(
        {
          error: `Could not authenticate with ${smtp.provider}. Check your email and App Password.`
        },
        { status: 401 }
      );
    }

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const recipient of recipientList) {
      try {
        await transporter.sendMail({
          from: {
            name: senderName.trim(),
            address: email
          },
          to: recipient,
          replyTo: cleanReplyTo,
          subject: subject.trim(),
          text: message.trim()
        });

        sent++;
      } catch (error) {
        failed++;

        console.error(`SEND ERROR ${recipient}:`, error);

        errors.push({
          recipient,
          error: error.message || "Sending failed"
        });
      }
    }

    return Response.json({
      success: sent > 0,
      provider: smtp.provider,
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
        error: "Server error while sending email."
      },
      { status: 500 }
    );
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}
