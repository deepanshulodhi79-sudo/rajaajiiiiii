import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { senderEmail, appPassword } = await request.json();

    if (!senderEmail?.trim() || !appPassword?.trim()) {
      return Response.json(
        { error: "Gmail address and App Password are required." },
        { status: 400 }
      );
    }

    const email = senderEmail.trim().toLowerCase();

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

    transporter.close();

    return Response.json({
      success: true,
      message: "Gmail SMTP verified successfully.",
    });
  } catch (error) {
    console.error("VERIFY ERROR:", error);

    return Response.json(
      {
        success: false,
        error:
          "Gmail authentication failed. Check your Gmail address and App Password.",
      },
      { status: 401 }
    );
  }
}
