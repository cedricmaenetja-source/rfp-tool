import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    const { email, otp } = req.body;

    const { data, error } = await supabase
        .from('tblrfpusers')
        .select('email')
        .eq('email', email)
        .eq('otp', otp)
        .maybeSingle(); 

    if (error) return res.status(500).json({ data: null, error: error.message });
    if (!data) if (!data) return res.status(500).json({ data: null, error: 'Otp verification failed.' });
    
    return res.status(200).json(data);
}