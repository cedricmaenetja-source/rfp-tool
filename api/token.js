import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Only POST allowed'
        });
    }

    try {
        const { user, expiresIn } = req.body;

        if (!user) {
            return res.status(400).json({
                error: 'User data required'
            });
        }

        const token = jwt.sign(
            user,
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn: expiresIn
            }
        );

        return res.status(200).json({
            success: true,
            token
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: 'Failed to create token'
        });
    }
}