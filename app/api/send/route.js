import nodemailer from "nodemailer";

export async function POST(request) {
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
          error: "All fields are required."
        },
        {
          status: 400
        }
      );
    }

    /*
      Convert recipient textarea into an array.

      Example:

      abc@gmail.com
      xyz@gmail.com

      becomes:

      [
        "abc@gmail.com",
        "xyz@gmail.com"
      ]
    */

    const recipientList = recipients
      .split(/\r?\n/)
      .map((email) => email.trim())
      .filter(Boolean);

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
      Basic email validation
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
      Limit a single request.

      This prevents accidentally submitting a huge recipient list.
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
      Gmail SMTP

      smtp.gmail.com + port 465 + secure true
      works with Gmail App Passwords.

      For other providers, change the SMTP configuration.
    */

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,

      auth: {
        user: senderEmail,
        pass: appPassword
      },

      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });

    /*
      Verify SMTP credentials before sending.
    */

    await transporter.verify();

    /*
      Send each recipient separately.

      This means recipients do not see each other's email addresses.
    */

    let sent = 0;
    let failed = 0;

    const errors = [];

    for (const recipient of recipientList) {
      try {
        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: recipient,
          subject: subject,
          text: message
        });

        sent++;
      } catch (error) {
        failed++;

        errors.push({
          recipient,
          error: error.message
        });
      }
    }

    /*
      Close SMTP connection.
    */

    transporter.close();

    if (sent === 0) {
      return Response.json(
        {
          error: "No emails were sent.",
          details: errors
        },
        {
          status: 500
        }
      );
    }

    return Response.json({
      success: true,
      message: `Email sending completed. Sent: ${sent}, Failed: ${failed}.`,
      sent,
      failed,
      errors
    });
  } catch (error) {
    console.error("MAIL ERROR:", error);

    let message = "Unable to send email.";

    if (
      error.code === "EAUTH" ||
      error.responseCode === 535
    ) {
      message =
        "SMTP authentication failed. Check your email and app password.";
    }

    if (error.code === "ETIMEDOUT") {
      message =
        "SMTP connection timed out. Please try again.";
    }

    return Response.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}
