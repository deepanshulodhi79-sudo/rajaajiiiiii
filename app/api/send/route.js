import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const {
      senderName,
      senderEmail,
      appPassword,
      recipient,
      subject,
      message,
    } = await req.json();

    if (
      !senderName ||
      !senderEmail ||
      !appPassword ||
      !recipient ||
      !subject ||
      !message
    ) {
      return Response.json(
        { error: "Please fill all fields." },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword,
      },
    });

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: recipient,
      subject: subject,
      text: message,
    });

    return Response.json({
      success: true,
      message: "Email sent successfully",
      recipient,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: error.message || "Failed to send email",
      },
      { status: 500 }
    );
  }
}
