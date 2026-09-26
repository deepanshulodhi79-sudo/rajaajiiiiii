import nodemailer from "nodemailer";

export async function POST(request) {
  let transporter;

  try {
    const body = await request.json();

    const {
      senderEmail,
      appPassword,
    } = body;

    if (
      !senderEmail?.trim() ||
      !appPassword?.trim()
    ) {
      return Response.json(
        {
          error:
            "Gmail address and App Password are required.",
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
          error: "Please use a Gmail address.",
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

    await transporter.verify();

    return Response.json({
      success: true,
      message:
        "Gmail SMTP connection verified successfully.",
    });
  } catch (error) {
    console.error(
      "VERIFY ERROR:",
      error
    );

    return Response.json(
      {
        error:
          "Gmail authentication failed. Check your Gmail address and App Password.",
      },
      { status: 401 }
    );
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}
