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

    const email = senderEmail.trim().toLowerCase();
    const to = recipient.trim().toLowerCase();

    if (!email.endsWith("@gmail.com")) {
      return Response.json(
        { error: "Only Gmail addresses are supported." },
        { status: 400 }
      );
    }

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

    await transporter.verify();

    const cleanMessage = message.trim();

    const htmlMessage = cleanMessage
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br>");

    const info = await transporter.sendMail({
      from: `"${senderName.trim()}" <${email}>`,
      to: to,
      subject: subject.trim(),
      text: cleanMessage,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6;">
          ${htmlMessage}
        </div>
      `,
    });

    transporter.close();

    return Response.json({
      success: true,
      recipient: to,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("SEND EMAIL ERROR:", error);

    return Response.json(
      {
        success: false,
        error: error?.message || "Email could not be sent.",
      },
      { status: 500 }
    );
  }
}
