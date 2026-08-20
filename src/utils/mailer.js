import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.FEEDBACK_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.FEEDBACK_SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.FEEDBACK_SMTP_USER,
        pass: process.env.FEEDBACK_SMTP_PASS,
    },
});

export const sendOTP = async (to, otp, purpose = 'Registration') => {
    try {
        const subject = `${purpose} OTP for ProfilIO`;
        const text = `Your OTP for ${purpose} is: ${otp}\n\nThis OTP will expire in 10 minutes.\nIf you didn't request this, please ignore this email.`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>ProfilIO - ${purpose} OTP</h2>
                <p>Your OTP for ${purpose} is:</p>
                <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 10 minutes.</p>
                <p style="font-size: 12px; color: #888;">If you didn't request this, please ignore this email.</p>
            </div>
        `;

        await transporter.sendMail({
            from: `"ProfilIO" <${process.env.FEEDBACK_FROM_EMAIL}>`,
            to,
            subject,
            text,
            html,
        });
        console.log(`OTP sent to ${to} for ${purpose}`);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};
