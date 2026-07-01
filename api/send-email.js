import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { verifySession } from './_verify-session';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    // const session = await verifySession(req);
    // if (!session) {
    //     return res.status(401).json({ error: 'Authorization failed.' });
    // }

    const { action } = req.query;

    const VALID_ACTIONS = [
        'resetPassword',
        'resetPasswordLink'
    ];

    if (action && !VALID_ACTIONS.includes(action)) return res.status(400).json({ error: `Unknown action: "${action}". Did you forget to register it in VALID_ACTIONS?` });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, token, host, otp, body, subject, from, fromName, replyTo, email } = req.body;

    let payload;
    if (action === 'resetPassword'){
        const { data, error } = await supabase
            .from('tblrfpusers')
            .select('id, email')
            .eq('email', email)
            .maybeSingle(); 

        if (error) return res.status(500).json({ data: null, error: error.message });
        if (!data) return res.status(500).json({ data: null, error: 'This email does not exist on our system.' });

        const otp = Math.floor(100000 + Math.random() * 900000);
        const { data: otpUpdate, error: otpError } = await supabase
            .from('tblrfpusers')
            .update({otp: otp})
            .eq('email', email); 

        if (otpError) return res.status(500).json({ data: null, error: otpError.message });

        payload = {
            to: email,
            subject: 'Your Verification Code',
            body: OTP_VERIFICATION_EMAIL.replace('{{OTP_CODE}}', otp) 
        };
    }

    if (action === 'resetPasswordLink'){
        const { data, error } = await supabase
            .from('tblrfpusers')
            .select('id, email')
            .eq('email', email)
            .maybeSingle(); 

        if (error) return res.status(500).json({ data: null, error: error.message });
        if (!data) return res.status(500).json({ data: null, error: 'This email does not exist on our system.' });

        payload = {
            to: email,
            subject: 'Password Reset',
            body: RESET_PASSWORD_EMAIL.replace('{{LINK}}', host) 
        };
    }
    
    try {
        const response = await fetch(ZAPIER_SEND_EMAIL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: 'Request failed' });
    }
}

export const ZAPIER_SEND_EMAIL = 'https://hooks.zapier.com/hooks/catch/25735666/uptnlxt/';
export const RESET_PASSWORD_EMAIL = `
    <p>Hello,<br/><br/>

    To reset your password, click the link below:<br/><br/>

    <strong>{{LINK}}</strong><br/><br/>

    If you did not request this, please ignore this email.<br/><br/>

    Thanks,<br/>
    Udder</p>`;

export const OTP_VERIFICATION_EMAIL = `
    <p>Hello,<br/><br/>

    Your One-Time Password (OTP) for verification is:<br/><br/>

    <strong>{{OTP_CODE}}</strong><br/><br/>

    If you did not request this code, please ignore this email.<br/><br/>

    Thanks,<br/>
    Udder</p>`;