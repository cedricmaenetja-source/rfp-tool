import { createClient } from '@supabase/supabase-js';
import { verifySession } from './_verify-session';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    const session = await verifySession(req);
    if (!session) {
        return res.status(401).json({ error: 'Authorization failed.' });
    }

    const { action, reqId } = req.query;

    if (action === 'getVendors') return await getVendors(res);
    if (action === 'getActiveRequirements') return await getActiveRequirements(res);
    if (action === 'getRequirementsById') return await getRequirementsById(res, reqId);
    if (action === 'getFormFields') return await getFormFields(res);
    if (action === 'getAllDraftRequirement') return await getAllDraftRequirement(res);
    if (action === 'getCompletedRequirements') return await getCompletedRequirements(res);
    if (action === 'getDraftRequirement') return await getDraftRequirement(res, reqId);
    if (action === 'getUsers') return await getUsers(res, session);
    if (action === 'getAdminUsers') return await getAdminUsers(res);

    if (action === 'updateSystemPartsFormFields'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id, fields } = req.body;
            return await updateSystemPartsFormFields(res, id, fields);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'updateAreaFormFields'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id, fields } = req.body;
            return await updateAreaFormFields(res, id, fields);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'insertDraftRequirement'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { filename, requirement } = req.body;
            return await insertDraftRequirement(res, filename, requirement);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'updateDraftRequirement'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id, requirement } = req.body;
            return await updateDraftRequirement(res, id, requirement);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }
    
    if (action === 'addNewRequirement'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { requirement, status } = req.body;
            return await addNewRequirement(res, requirement, status);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    } 

    if (action === 'upsertUser'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { payload } = req.body;
            return await upsertUser(res, payload);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'deleteUser'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { id } = req.body;
            return await deleteUser(res, id);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'uploadVendorResponse'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { payload } = req.body;
            return await uploadVendorResponse(res, payload);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'removeDraftRequirement'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { id } = req.body;
            return await removeDraftRequirement(res, id);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'updateRequirements'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id, requirements } = req.body;
            return await updateRequirements(res, id, requirements);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'approveDraftRequirements'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id } = req.body;
            return await approveDraftRequirements(res, id);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'getVendorsByIdList'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { ids } = req.body;
            return await getVendorsByIdList(res, ids);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }
    
    if (action === 'upsertVendor'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { payload } = req.body;
            return await upsertVendor(res, payload);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'updateVendorList'){
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Only POST allowed" });
        }

        try {
            const { data } = req.body;
            return await updateVendorList(res, data);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }

    if (action === 'updateRequirementStatus'){
        if (req.method !== "PUT") {
            return res.status(405).json({ error: "Only PUT allowed" });
        }

        try {
            const { id, status } = req.body;
            return await updateRequirementStatus(res, id, status);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal error' });
        }
    }
}

async function getAssignedVendorsById(res, requirementId) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('assigned_vendors')
    .eq('id', requirementId);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function deleteUser(res, id) {
  if (!id) return res.status(400).json({ data: null, error: 'Missing user id' });

  const { data, error } = await supabase
    .from('tblrfpusers')
    .update({active: false})
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ data: null, error: error.message });

  if (!data || data.length === 0) {
    return res.status(404).json({ data: null, error: 'No user found with that id' });
  }

  return res.status(200).json({ data, error: null });
}

async function getUsers(res, session) {
    if (session.role === 'admin') return getAdminUsers(res);
    
  const { data, error } = await supabase
    .from('tblrfpusers')
    .select('id, first_name, last_name, email, role, active')
    .neq('first_name', 'Admin')
    .eq('active', true); // except the admin user

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getAdminUsers(res) {
  const { data, error } = await supabase
    .from('tblrfpusers')
    .select('id, first_name, last_name, email, role, active')
    .neq('first_name', 'Admin'); // except the admin user

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function upsertUser(res, payload) {
  const { data, error } = await supabase
    .from('tblrfpusers')
    .upsert(payload, { onConflict: 'email' }); 

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

// active = approved
async function getActiveRequirements(res) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('status', 'active');

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getCompletedRequirements(res) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('status', 'completed');

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getRequirementsById(res, requirementId) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('id', requirementId)
    .maybeSingle();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getVendorById(res, id) {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .eq('id', id)
    .single();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getVendors(res) {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*');

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getVendorsByIdList(res, ids) {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .in('id', ids);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateVendorList(res, requirementData) {
    const { data, error } = await supabase
        .from('tblrfprequirements')
        .update({ assigned_vendors: requirementData.assigned_vendors })
        .eq('id', requirementData.id);
    
    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getVendorByName(res, name) {
    const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .eq('name', name);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function upsertVendor(res, payload) {
    const { data, error } = await supabase
        .from('tblvendors')
        .upsert(payload, { onConflict: 'name' })
        .select('*')
        .maybeSingle();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function addVendor(res, payload) {
    const { data, error } = await supabase
    .from('tblvendors')
    .insert([{ 
        name: payload['name'], 
        description:  payload['description'], 
        hq_location: payload['hq_location'], 
        contact_person: payload['contact_person'],
        system_parts: payload['system_parts']
    }])
    .select();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getFormFields(res) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .select('*')
    .single();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function addNewRequirement(res, payload, status = 'pending') {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .insert([
      { title: payload['title'], client:  payload['client'], requirements: payload['requirements'], status: status},
    ])
    .select('*')
    .single();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function uploadVendorResponse(res, payload) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .insert(payload)
    .select('*')
    .single();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateRequirements(res, reqId, requirements) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { requirements: requirements},
    ])
    .eq('id', reqId);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateClientRequirementInformation(res, reqId, payload) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { title: payload['title'], client:  payload['client']},
    ])
    .eq('id', reqId);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateRequirementStatus(res, reqId, status) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { status: status},
    ])
    .eq('id', reqId);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateAreaFormFields(res, id, area) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { area: area},
    ])
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateSystemPartsFormFields(res, id, part) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { system_parts: part},
    ])
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateVendorFeedbackFormFields(res, id, feedback) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { vendor_feedback: feedback},
    ])
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function insertDraftRequirement(res, filename, draft) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .insert([{ 
        filename: filename,
        data: draft, 
    }])
    .select('*')
    .single();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getDraftRequirement(res, id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .select('*')
    .eq('id', id)
    .maybeSingle();

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function getAllDraftRequirement(res) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .select('*');

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function updateDraftRequirement(res, id, requirement) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .update([
      { data: requirement},
    ])
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function removeDraftRequirement(res, id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .delete()
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}

async function approveDraftRequirements(res, id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .update([
      { approved: 'Y'},
    ])
    .eq('id', id);

    if (error) return res.status(500).json({ data: null, error: error.message });
    return res.status(200).json({ data });
}