const nodemailer = require("nodemailer");

// Validate required env variables at startup
const requiredEnv = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
  "FRONTEND_URL"
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

let transporterInstance = null;

// Create reusable transporter
const createTransporter = () => {
  if (transporterInstance) return transporterInstance;

  transporterInstance = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  transporterInstance.verify().catch((err) => {
    logError("SMTP configuration error", err);
  });

  return transporterInstance;
};

// Minimal structured logger
const logError = (message, error) => {
  console.error(JSON.stringify({
    level: "error",
    message,
    error: error?.message,
    timestamp: new Date().toISOString()
  }));
};

// Retry with exponential backoff
const sendWithRetry = async (transporter, mailOptions, retries = 3, delay = 500) => {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(res => setTimeout(res, delay));
    return sendWithRetry(transporter, mailOptions, retries - 1, delay * 2);
  }
};

// Base template wrapper to remove duplication
const wrapTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
</head>
<body>
${content}
</body>
</html>
`;

exports.sendPasswordResetEmail = async (email, resetToken) => {
  const transporter = createTransporter();

  const encodedToken = encodeURIComponent(resetToken);
  const expiryMinutes = process.env.RESET_TOKEN_EXPIRY_MINUTES || 60;

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${encodedToken}`;

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto;">
    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset your password for your XAYTHEON account.</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 30px;background:#667eea;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
    <p>Or copy and paste:</p>
    <p style="word-break:break-all;color:#667eea;">${resetUrl}</p>
    <div style="background:#fef3cd;border-left:4px solid #ffc107;padding:12px;margin:15px 0;">
      <strong>Security Notice:</strong>
      <ul>
        <li>This link will expire in ${expiryMinutes} minutes</li>
        <li>If you didn't request this reset, ignore this email</li>
        <li>Never share this link</li>
      </ul>
    </div>
    <p>Best regards,<br>The XAYTHEON Team</p>
    <p style="font-size:12px;color:#666;">&copy; ${new Date().getFullYear()} XAYTHEON</p>
  </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Reset Request - XAYTHEON",
    html: wrapTemplate(htmlContent),
    text: `
Password Reset Request

Hello,

Reset your password here:
${resetUrl}

This link will expire in ${expiryMinutes} minutes.

If you didn't request this reset, ignore this email.

The XAYTHEON Team
`
  };

  try {
    await sendWithRetry(transporter, mailOptions);
    return true;
  } catch (error) {
    logError("Password reset email failed", error);
    throw new Error("Failed to send password reset email");
  }
};

exports.sendPasswordChangedEmail = async (email) => {
  const transporter = createTransporter();

  const htmlContent = `
  <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto;">
    <h2>Password Changed Successfully</h2>
    <p>Hello,</p>
    <p>Your XAYTHEON account password was successfully changed.</p>
    <div style="background:#fee2e2;border-left:4px solid #dc2626;padding:12px;margin:15px 0;">
      <strong>Didn't make this change?</strong>
      <p>Contact support immediately at support@xaytheon.com</p>
    </div>
    <p>Best regards,<br>The XAYTHEON Team</p>
  </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Changed Successfully - XAYTHEON",
    html: wrapTemplate(htmlContent),
    text: `
Password Changed Successfully

If you did not change your password, contact support immediately.

The XAYTHEON Team
`
  };

  try {
    await sendWithRetry(transporter, mailOptions);
    return true;
  } catch (error) {
    logError("Password changed email failed", error);
    throw new Error("Failed to send password changed email");
  }
};
