const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM_EMAIL = 'noreply@inkspace.tattoo';

exports.sendVerificationEmail = async (email, username, token) => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your InkSpace email</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background-color:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="background-color:#111;padding:32px 40px;text-align:center;border-bottom:1px solid #2a2a2a;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                Ink<span style="color:#3b82f6;">Space</span>
              </h1>
              <p style="margin:6px 0 0;color:#6b7280;font-size:13px;">inkspace.tattoo</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f9fafb;">
                Verify your email address
              </h2>
              <p style="margin:0 0 8px;color:#9ca3af;font-size:15px;line-height:1.6;">
                Hey <strong style="color:#e5e7eb;">@${username}</strong> — welcome to InkSpace!
              </p>
              <p style="margin:0 0 32px;color:#9ca3af;font-size:15px;line-height:1.6;">
                Click the button below to verify your email and activate your account. This link expires in <strong style="color:#e5e7eb;">24 hours</strong>.
              </p>

              <div style="text-align:center;margin-bottom:32px;">
                <a href="${verifyUrl}"
                   style="display:inline-block;background-color:#3b82f6;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:8px;">
                  Verify Email Address
                </a>
              </div>

              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                Or copy this link into your browser:<br />
                <a href="${verifyUrl}" style="color:#3b82f6;word-break:break-all;">${verifyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;color:#4b5563;font-size:12px;text-align:center;line-height:1.6;">
                If you didn't create an InkSpace account, you can safely ignore this email.<br />
                &copy; ${new Date().getFullYear()} InkSpace &mdash; inkspace.tattoo
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your InkSpace email',
    html,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }

  return data;
};
