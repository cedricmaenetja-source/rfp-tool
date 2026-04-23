import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://efanuvwrpqhchdpsvfir.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYW51dndycHFoY2hkcHN2ZmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxNDg3NzcsImV4cCI6MjA1ODcyNDc3N30.sOJLp44d80VT8_HW-_ESx837sC2ygSo3Q5huXuQzse0";

export const supabase = createClient(
    SUPABASE_URL, 
    SUPABASE_ANON_KEY
);

export async function getAssignedVendorsById(requirementId) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('assigned_vendors')
    .eq('id', requirementId);

  if (error) {
    return { data: null, error };
  }

  return { data: data.assigned_vendors, error: null };
}

// active = approved
export async function getActiveRequirements() {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('status', 'active');

  if (error) {
    return { data: null, error };
  }

  return { data: data, error: null };
}

export async function getCompletedRequirements() {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('status', 'completed');

  if (error) {
    return { data: null, error };
  }

  return { data: data, error: null };
}

export async function getRequirementsById(requirementId) {
  const { data, error } = await supabase
    .from('tblrfprequirements')
    .select('*')
    .eq('id', requirementId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }
  
  return { data: data, error: null };
}

export async function getVendorById(id) {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: data, error: null };
}

export async function getVendors() {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*');

  if (error) {
    return { data: null, error };
  }

  return { data: data, error: null };
}

export async function getVendorsByIdList(ids) {
  const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .in('id', ids);

  if (error) {
    return { data: null, error };
  }

  return { data: data, error: null };
}

export async function updateVendorList(requirementData) {
    const { data, error } = await supabase
        .from('tblrfprequirements')
        .update({ assigned_vendors: requirementData.assigned_vendors })
        .eq('id', requirementData.id);
    
    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function getVendorByName(name) {
    const { data, error } = await supabase
    .from('tblvendors')
    .select('*')
    .eq('name', name);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function addVendor(payload) {
    const { idata, error } = await supabase
    .from('tblvendors')
    .insert([{ 
        name: payload['name'], 
        description:  payload['description'], 
        hq_location: payload['hq_location'], 
        contact_person: payload['contact_person'],
        system_parts: payload['system_parts']
    }])
    .select();

    if (error) {
        return { data: null, error };
    }

    return { data: idata, error: null };
}

export async function getFormFields() {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .select('*')
    .single();

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function addNewRequirement(payload, status = 'pending') {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .insert([
      { title: payload['title'], client:  payload['client'], requirements: payload['requirements'], status: status},
    ])
    .select('*')
    .single();

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateRequirements(reqId, requirements) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { requirements: requirements},
    ])
    .eq('id', reqId);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateClientRequirementInformation(reqId, payload) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { title: payload['title'], client:  payload['client']},
    ])
    .eq('id', reqId);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateRequirementStatus(reqId, status) {
   const { data, error } = await supabase
    .from('tblrfprequirements')
    .update([
      { status: status},
    ])
    .eq('id', reqId);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateAreaFormFields(id, area) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { area: area},
    ])
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateSystemPartsFormFields(id, part) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { system_parts: part},
    ])
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateVendorFeedbackFormFields(id, feedback) {
    const { data, error } = await supabase
    .from('tblrfpformfields')
    .update([
      { vendor_feedback: feedback},
    ])
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function insertDraftRequirement(filename, draft) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .insert([{ 
        filename: filename,
        data: draft, 
    }])
    .select('*')
    .single();

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function getDraftRequirement(id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .select('*')
    .eq('id', id)
    .maybeSingle();

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function getAllDraftRequirement() {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .select('*');

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function updateDraftRequirement(id, requirement) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .update([
      { data: requirement},
    ])
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function removeDraftRequirement(id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .delete()
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}

export async function approveDraftRequirements(id) {
    const { data, error } = await supabase
    .from('tblrequirementsdraft')
    .update([
      { approved: 'Y'},
    ])
    .eq('id', id);

    if (error) {
        return { data: null, error };
    }

    return { data: data, error: null };
}