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
      recipient,
      subject,
      message,
    } = body;

    if (
      !senderName?.trim() ||
      !senderEmail?.trim() ||
      !appPassword?.trim() ||
      !recipient?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return Response.json(
        {
          error: "Please fill all required fields.",
        },
        { status: 400 }
      );
    }

    const email = senderEmail
      .trim()
      .toLowerCase();

    const cleanRecipient = recipient
      .trim()
      .toLowerCase();

    if (
      !email.endsWith("@gmail.com") &&
      !email.endsWith("@googlemail.com")
    ) {
      return Response.json(
        {
          error: "Please use a Gmail address.",
        },
        { status: 400 }
      );
    }

    if (!emailRegex.test(email)) {
      return Response.json(
        {
          error: "Invalid Gmail address.",
        },
        { status: 400 }
      );
    }

    if (!emailRegex.test(cleanRecipient)) {
      return Response.json(
        {
          error: `Invalid recipient email: ${cleanRecipient}`,
        },
        { status: 400 }
      );
    }

    const cleanSenderName =
      cleanHeader(senderName);

    const cleanSubject =
      cleanHeader(subject);

    const cleanMessage =
      String(message).trim();

    if (!cleanSenderName) {
      return Response.json(
        {
          error: "Invalid sender name.",
        },
        { status: 400 }
      );
    }

    if (!cleanSubject) {
      return Response.json(
        {
          error: "Subject is required.",
        },
        { status: 400 }
      );
    }

    if (cleanSubject.length > 200) {
      return Response.json(
        {
          error: "Subject is too long.",
        },
        { status: 400 }
      );
    }

    if (!cleanMessage) {
      return Response.json(
        {
          error: "Message is required.",
        },
        { status: 400 }
      );
    }

    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,

      auth: {
        user: email,
        pass: appPassword.trim(),
      },

      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,

      pool: false,
    });

    /*
      Verify Gmail SMTP authentication before sending.
    */
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
            "Gmail authentication failed. Check your Gmail address and App Password.",
        },
        { status: 401 }
      );
    }

    const htmlMessage = escapeHtml(
      cleanMessage
    ).replace(/\r?\n/g, "<br>");

    const info = await transporter.sendMail({
      from: `"${cleanSenderName}" <${email}>`,
      to: cleanRecipient,
      subject: cleanSubject,

      text: cleanMessage,

      html: `
<!doctype html>
<html>
  <body>
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6;">
      ${htmlMessage}
    </div>
  </body>
</html>
      `.trim(),
    });

    return Response.json({
      success: true,
      recipient: cleanRecipient,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    console.error(
      "MAIL API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Server error while sending email.",
      },
      { status: 500 }
    );
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}
