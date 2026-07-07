import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const { token, access_code, link } = req.body;

    if (!token || !access_code || !link) {
        return res.status(400).json({ error: 'Invalid request.' });
    }

    try {
        let newLink = link.replace(`&tk=${token}`, '');

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        
        if (newLink !== decoded.access_link){return res.status(400).json({ error: 'Invalid link.' });}
        if (decoded.access_code != access_code){return res.status(400).json({ error: 'Invalid access code.' });}

        const newAcessToken = jwt.sign({
                access_token: token
            },
            process.env.JWT_ACCESS_SECRET,
        );

        res.setHeader('Set-Cookie', `auth=${token}; HttpOnly; Path=/; SameSite=Strict`);

        return res.status(200).json({
            script: 'client_review.js',
            token: newAcessToken
        });

    } catch (err) {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
}