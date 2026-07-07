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
        'resetPasswordLink',
        'clientReqReview',
        'onReviewChange',
        'onAddNewReq',
        'signOff'
    ];

    if (action && !VALID_ACTIONS.includes(action)) return res.status(400).json({ error: `Unknown action: "${action}". Did you forget to register it in VALID_ACTIONS?` });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, token, host, otp, body, subject, from, fromName, replyTo, email, link, clientName, userId } = req.body;

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

    if (action === 'clientReqReview'){
        if (!userId) return res.status(400).json({ error: `Unknown userId` });
        if (!clientName) return res.status(400).json({ error: `Unknown client name` });
        // get the consultant name
        const { data, error } = await supabase
            .from('tblrfpusers')
            .select('first_name, last_name')
            .eq('id', userId)
            .maybeSingle(); 

        if (error) return res.status(500).json({ data: null, error: error.message });
        if (!data) return res.status(500).json({ data: null, error: 'This user does not exist on our system.' });

        const code = Math.floor(100000 + Math.random() * 900000);
        const token = jwt.sign({
            email: email,
            access_link: link,
            access_code: code,
            consultant_id: userId
        },
            process.env.JWT_ACCESS_SECRET
        );

        payload = {
            to: email,
            subject: 'Review Your HR Technology Requirements',
            body: CLIENT_REQ_REVIEW
                .replaceAll('{{LINK}}', `${link}&tk=${token}`)
                .replace('{{CONSULTANT_NAME}}', `${data.first_name} ${data.last_name || ''}`)
                .replace('{{CLIENT_NAME}}', clientName)
                .replace('{{ACCESS_CODE}}', code) 
        };
    }

    if (action === 'onReviewChange'){
        if (!token) return res.status(400).json({ error: `Invalid token` });

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const { data, error } = await supabase
                .from('tblrfpusers')
                .select('first_name, last_name, email')
                .eq('id', decoded.consultant_id)
                .single(); 

            if (error) return res.status(500).json({ data: null, error: error.message });
            if (!data) return res.status(500).json({ data: null, error: 'This user does not exist on our system.' });
            
            payload = {
                to: data.email,
                subject: subject,
                body: ON_REVIEW_CHANGE
                    .replaceAll('{{LINK}}', `${link}`)
                    .replace('{{CONSULTANT_NAME}}', `${data.first_name}`)
                    .replace('{{CLIENT_NAME}}', clientName)
            };
    
        } catch (err) {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }
    }

    if (action === 'onAddNewReq'){
        if (!token) return res.status(400).json({ error: `Invalid token` });

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const { data, error } = await supabase
                .from('tblrfpusers')
                .select('first_name, last_name, email')
                .eq('id', decoded.consultant_id)
                .single(); 

            if (error) return res.status(500).json({ data: null, error: error.message });
            if (!data) return res.status(500).json({ data: null, error: 'This user does not exist on our system.' });
            
            payload = {
                to: data.email,
                subject: subject,
                body: ON_REVIEW_CHANGE
                    .replaceAll('{{LINK}}', `${link}`)
                    .replace('{{CONSULTANT_NAME}}', `${data.first_name}`)
                    .replace('{{CLIENT_NAME}}', clientName)
            };
    
        } catch (err) {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }
    }

    if (action === 'signOff'){
        if (!token) return res.status(400).json({ error: `Invalid token` });

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const { data, error } = await supabase
                .from('tblrfpusers')
                .select('first_name, last_name, email')
                .eq('id', decoded.consultant_id)
                .single(); 

            if (error) return res.status(500).json({ data: null, error: error.message });
            if (!data) return res.status(500).json({ data: null, error: 'This user does not exist on our system.' });
            
            payload = {
                to: data.email,
                subject: subject,
                body: SIGN_OFF
                    .replaceAll('{{LINK}}', `${link}`)
                    .replace('{{CONSULTANT_NAME}}', `${data.first_name}`)
                    .replace('{{CLIENT_NAME}}', clientName)
            };
    
        } catch (err) {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }
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

export const CLIENT_REQ_REVIEW = `
    <p>Hi {{CLIENT_NAME}},<br/><br/>

    I've created a list of HR technology requirements based on our discussions and uploaded them to our Udder RFP management tool. Before we share these with vendors, I'd like you to review them and share your feedback.<br/><br/>

    You can access the requirements <a href="{{LINK}}">here</a>.<br/><br/>

    This is a secured link. If prompted, use the following access code: <strong>{{ACCESS_CODE}}</strong><br/><br/>

    If the link above doesn't work, copy and paste this URL into your browser: {{LINK}}<br/><br/>

    For each requirement, you can:<br/>
    - Approve, modify, or reject it<br/>
    - Update the priority level (Must / Should / Could Have)<br/><br/>

    The view auto-saves as you go, so feel free to work through it at your own pace and pick up where you left off. You can also use the filters and bulk selection at the top to speed things up; particularly useful if you want to set priorities across a whole category at once.<br/><br/>

    Once you're happy with the list, please hit Submit, and I'll take it from there.<br/><br/>

    If anything is unclear or you'd like to talk through any of the requirements before diving in, please don't hesitate to reach out to me.<br/><br/> 

    Best,<br/>
    {{CONSULTANT_NAME}}
    </p>`;

export const ON_REVIEW_CHANGE = `
    <p>Hi {{CONSULTANT_NAME}},<br/><br/>

    {{CLIENT_NAME}} has submitted their review of the requirements list.<br/><br/>

    You can log in to the Udder RFP management tool to see their changes, including any modifications, approvals, rejections, and priority assignments.

    {{LINK}}<br/><br/>

    Once you've reviewed and are happy with the final list, you'll be able to send it out to vendors.<br/><br/>

    [Automated notification from RFP Tool]
    </p>`;

export const ON_ADD_REQ = `
    <p>Hi {{CONSULTANT_NAME}},<br/><br/>

    {{CLIENT_NAME}} has added a new requirement to list.<br/><br/>

    You can log in to the Udder RFP management tool to see their changes, including any modifications, approvals, rejections, and priority assignments.

    {{LINK}}<br/><br/>

    Once you've reviewed and are happy with the final list, you'll be able to send it out to vendors.<br/><br/>

    [Automated notification from RFP Tool]
    </p>`;

export const SIGN_OFF = `
    <p>Hi {{CONSULTANT_NAME}},<br/><br/>

    {{CLIENT_NAME}} has signed-off on their requirements list.<br/><br/>

    You can log in to the Udder RFP management tool to see their changes, including any modifications, approvals, rejections, and priority assignments.

    {{LINK}}<br/><br/>

    You will now be able to send it out to vendors.<br/><br/>

    [Automated notification from RFP Tool]
    </p>`;

export const VENDOR = `
    <p>Hi {{CONSULTANT_NAME}},<br/><br/>

    {{CLIENT_NAME}} has signed-off on their requirements list.<br/><br/>

    You can log in to the Udder RFP management tool to see their changes, including any modifications, approvals, rejections, and priority assignments.

    {{LINK}}<br/><br/>

    You will now be able to send it out to vendors.<br/><br/>

    [Automated notification from RFP Tool]
    </p>`;