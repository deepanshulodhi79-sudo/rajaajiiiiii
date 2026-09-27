import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const {
      senderName,
      senderEmail,
      appPassword,
      recipient,
      subject,
      message,
    } = await request.json();

    // Basic validation
    if (
      !senderName?.trim() ||
      !senderEmail?.trim() ||
      !appPassword?.trim() ||
      !recipient?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return Response.json(
        { error: "Please fill all required fields." },
        { status: 400 }
      );
    }

    const email = senderEmail.trim();
    const to = recipient.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    // Gmail only
    if (
      !email.toLowerCase().endsWith("@gmail.com") &&
      !email.toLowerCase().endsWith("@googlemail.com")
    ) {
      return Response.json(
        { error: "Please use a Gmail address." },
        { status: 400 }
      );
    }

    // Gmail SMTP
    const transporter = nodemailer.createTransport({
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
    });

    // Check Gmail login
    try {
      await transporter.verify();
    } catch (error) {
      console.error("GMAIL VERIFY ERROR:", error);

      transporter.close();

      return Response.json(
        {
          error:
            "Gmail authentication failed. Check your Gmail address and App Password.",
        },
        { status: 401 }
      );
    }

    // Convert message to simple HTML
    const htmlMessage = cleanMessage
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br>");

    // Send email
    const info = await transporter.sendMail({
      from: `"${senderName.trim()}" <${email}>`,
      to,
      subject: cleanSubject,

      // Plain-text version
      text: cleanMessage,

      // HTML version
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
            ${htmlMessage}
          </body>
        </html>
      `,
    });

    transporter.close();

    return Response.json({
      success: true,
      recipient: to,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error) {
    console.error("MAIL SEND ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Failed to send email.",
      },
      { status: 500 }
    );
  }
}
