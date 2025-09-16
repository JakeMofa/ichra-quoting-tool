//server/utils/mailer.js
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = 'ICHRA Demo <no-reply@ichra-demo.local>',
} = process.env;

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } else {
    // Dev fallback (one-off inbox preview links)
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: test.user, pass: test.pass },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (!to) throw new Error("No recipients defined");
  const t = await getTransporter();
  const info = await t.sendMail({ from: SMTP_FROM, to, subject, html, text });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("📧 Preview URL:", preview);
  return info;
}

async function sendResetEmail(to, url) {
  return sendMail({
    to,
    subject: "Reset your password",
    html: `<p>Click to reset your password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
    text: `Reset your password: ${url}\nThis link expires in 1 hour.`,
  });
}

async function sendResetCode({ to, code }) {
  return sendMail({
    to,
    subject: "Your verification code",
    html: `<p>Your code is:</p>
           <p style="font-size:22px;font-weight:700;letter-spacing:3px">${code}</p>
           <p>This code expires in 10 minutes.</p>
           <p>If you didn't request this, you can ignore this email.</p>`,
    text: `Your code is: ${code}\nThis code expires in 10 minutes.`,
  });
}

module.exports = { sendMail, sendResetEmail, sendResetCode };