import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    const { email, password } = req.body;
   
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
        .from('tblrfpusers')
        .update({password: hashedPassword})
        .eq('email', email)
        .select('*')
        .maybeSingle(); 
    
    if (error) return res.status(500).json({ data: null, error: error.message });
  
    return res.status(200).json(data);
}