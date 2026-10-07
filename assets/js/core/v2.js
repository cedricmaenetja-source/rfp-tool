import { customError, showNotification, lockBtn, priorityList, getParam } from '../app.js';
import { initAuth, getCurrentUser, logout } from './_auth.js';
import { countryList } from '../utils/constants.js';

let _user = null;
(async () => {
    const token = await initAuth();
    
    if (!token || token.error){ window.location.href = `${window.location.origin}/v2/login.html`;return;}
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = `${window.location.origin}/v2/login.html`;
        return;
    }

    _user = user.data;
    applyRoleVisibility(_user.role);
    if (_user.last_name == null) _user.last_name = '';
    $('#avatar-circle').text(getInitials(`${_user.first_name} ${_user.last_name}`));

})();

let cachedDrafts = [];
let cachedActiveRequirements = [];

const MOCK = {
  drafts: [
    { company:'Acme Corp', title:'ERP System RFP 2025', contact:'Sarah Dlamini', email:'sarah@acme.co.za', phone:'021 555 0101', country:'South Africa' },
    { company:'BluePeak Ltd', title:'HR Platform Evaluation', contact:'James Osei', email:'james@bluepeak.com', phone:'', country:'Ghana' },
    { company:'Meridian Group', title:'Cloud Infrastructure Requirements', contact:'Priya Naidoo', email:'priya@meridian.co.za', phone:'011 200 3300', country:'South Africa' },
  ],
  active: [
    { submitted:'12 May 2025', company:'Acme Corp', title:'ERP System RFP 2025', contact:'Sarah Dlamini', email:'sarah@acme.co.za', country:'South Africa', status:'In progress', vendors:['Vendor A','Vendor B'], responses:1 },
    { submitted:'05 Apr 2025', company:'Meridian Group', title:'Cloud Infrastructure Requirements', contact:'Priya Naidoo', email:'priya@meridian.co.za', country:'South Africa', status:'All responses in', vendors:['Vendor A','Vendor C','Vendor D'], responses:3 },
    { submitted:'18 Mar 2025', company:'BluePeak Ltd', title:'HR Platform Evaluation', contact:'James Osei', email:'james@bluepeak.com', country:'Ghana', status:'No responses', vendors:['Vendor B'], responses:0 },
  ],
  completed: [
    { submitted:'10 Jan 2025', company:'Telco SA', title:'Network Upgrade RFP', contact:'Mark Sithole', email:'mark@telco.co.za', country:'South Africa' },
  ],
  vendors: [],
  formFields: {
    area: ['Finance','HR','Operations','IT Infrastructure','Procurement'],
    system_parts: ['Core System','Reporting Module','Integration Layer','Mobile App'],
    vendor_feedback: ['Full Match','Partial Match','No Match'],
  }
};
let formFields = { ...MOCK.formFields };
const breadcrumbs = { home:'Dashboard', requirements:'Client Review', 'vendor-review':'Vendor Review', completed:'Completed', vendors:'Vendors', users:'Users', resources:'Resources', configurations:'Configurations', 'active-summary':'Summary', 'vendor-detail':'Requirement' };
function navigateTo(page) {
  const overlay = document.getElementById('page-transition');

  // Fade in overlay with spinner
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  });

  setTimeout(() => {
    // Swap page
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const navItem = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (navItem) navItem.classList.add('active');
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    document.getElementById('breadcrumb-current').textContent = breadcrumbs[page] || page;
    loadPage(page);

    // Fade out overlay
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
  }, 280);
}
document.querySelectorAll('.nav-item[data-page]').forEach(item => { item.addEventListener('click', () => window.navigateTo(item.dataset.page)); });
function loadPage(page) {
  if (page === 'home') loadHome();
  if (page === 'requirements') loadDrafts();
  if (page === 'vendor-review') loadActive();
  if (page === 'completed') loadCompleted();
  if (page === 'vendors') loadVendors();
  if (page === 'configurations') loadConfigurations();
  if (page === 'active-summary') loadActiveSummary();
  if (page === 'upload-responses') initUploadResponses();
  if (page === 'users') loadUsers();
  if (page === 'vendor-detail') loadVendorDetail();
}

function applyRoleVisibility(userRole) {
  const role = userRole?.toLowerCase();
  document.querySelectorAll('[data-requires-role]').forEach(el => {
    const required = el.dataset.requiresRole.toLowerCase();
    const allowed = required.split(',').map(r => r.trim()).includes(role) || role === 'admin';
    if (!allowed) el.remove();
    if (allowed) $(el).removeClass('hide');
  });
}

document.getElementById('avatar-circle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('avatar-menu-dropdown').classList.toggle('open');
});

document.addEventListener('click', () => {
  document.getElementById('avatar-menu-dropdown').classList.remove('open');
});

document.getElementById('avatar-logout-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  document.getElementById('avatar-menu-dropdown').classList.remove('open');
  await logoutUser();
});

async function logoutUser() {
  showNotification('Logging out...', 'warning');
  await logout();
  location.href = `${window.location.origin}/v2/login.html`;
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function attentionRow(color, text, meta) {
  const dots = { red:'#E24B4A', amber:'#BA7517', blue:'#378ADD' };
  return '<div class="attention-row"><div class="attention-dot" style="background:' + (dots[color]||'#888') + '"></div><div><div class="attention-text">' + text + '</div><div class="attention-meta">' + meta + '</div></div></div>';
}
let draftsTable = null;
async function loadDrafts() {
  const sidebar = document.getElementById('drafts-sidebar-list');
  sidebar.innerHTML = '';

  const ffRes = await fetch('/api/supabase?action=getFormFields');
  const ffResult = await ffRes.json();
  if (!ffResult.error) cachedFormFields = ffResult.data;

  if (cachedDrafts.length == 0){
    const response = await fetch('/api/supabase?action=getAllDraftRequirement');
    const result = await response.json();
   
    if (result.error) { console.error(result.error); return; }
    
    cachedDrafts = result.data;
  }
  
  cachedDrafts.forEach((row, idx) => {
    const d = row.data;
    const item = document.createElement('div');
    item.className = 'req-sidebar-item' + (idx === 0 ? ' active' : '');
    item.textContent = d.title || '—';
    item.addEventListener('click', () => {
      document.querySelectorAll('#drafts-sidebar-list .req-sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      renderDraftDetail(row);
    });
    sidebar.appendChild(item);
  });

  if (cachedDrafts.length > 0){
    renderDraftDetail(cachedDrafts[0]);
  }else{
    const content = document.getElementById('drafts-detail-panel');
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t4);font-size:13px;">No data available.</div>';
  } 
}

function renderDraftDetail(row) {
  const d = row.data;
  const panel = document.getElementById('drafts-detail-panel');

  const priorityColor = p => p === 'Must-Have' ? 'color:var(--o)' : p === 'Should-Have' ? 'color:var(--t2)' : 'color:var(--t3)';

  let rows = '';
  let areas = '';
  let systemParts = '';
  if (d.requirements.length > 0) d.requirements.sort((a, b) => a.area.localeCompare(b.area));
  (d.requirements || []).forEach((req, idx) => {
    const rowBgColor = (req.recommendation == 'Keep') ? '#f0f9f0' : 'transparent';
    rows += '<tr style="background: ' + rowBgColor + '">'
      + '<td style="color:var(--o);font-weight:500">' + (req.area || '—') + '</td>'
      + '<td>' + (req.requirement || '—') + '</td>'
      + '<td style="' + priorityColor(req.priority) + ';font-weight:500;white-space:nowrap">' + (req.priority || '—') + '</td>'
      + '<td>' + (req.system_part || '—') + '</td>'
      + '<td>' + (req.recommendation || '—') + '</td>'
      + '<td>' + (req.comment || '') + '</td>'
      + '<td><button onclick="editDraftReq(' + idx + ',\'' + row.id + '\')" style="background:none;border:none;font-size:12.5px;cursor:pointer;font-family:var(--sans);margin-left:5px" title="edit"><i class="fa-solid fa-pen-to-square"></i></button><button title="remove" id="removeDraftReq-' + row.id + '" onclick="removeDraftReq(' + idx + ',\'' + row.id + '\')" style="background:none;border:none;color:#E24B4A;font-size:12.5px;cursor:pointer;font-family:var(--sans);margin-left:5px"><i class="fa-regular fa-trash-can"></i></button></td>'
      + '</tr>';
  });

  if (cachedFormFields != null){
    cachedFormFields.area.sort((a, b) => a.localeCompare(b)).forEach(a => {
      areas += `<option>${a}</option>`;
    });

    cachedFormFields.system_parts.sort((a, b) => a.localeCompare(b)).forEach(p => {
      systemParts += `<option>${p}</option>`;
    });
  }

  panel.innerHTML = ''
    + '<div class="info-card" style="margin-bottom:12px">'
    +   '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    +     '<span class="info-card-title" style="margin-bottom:0">Client details</span>'
    +     '<button class="act-btn" onclick="openClientEditModal(\'' + row.id + '\')">Edit</button>'
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px">'
    +     '<div class="info-row"><span class="info-key">Company</span><span class="info-val">' + (d.client?.company || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Contact</span><span class="info-val">' + (d.client?.name || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Email</span><span class="info-val">' + (d.client?.email || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Country</span><span class="info-val">' + (d.client?.country || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Headcount</span><span class="info-val">' + (d.client?.headcount || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Timeline</span><span class="info-val">' + (d.client?.timeline || '—') + '</span></div>'
    +   '</div>'
    + '</div>'
    + '<div id="client-edit-modal" class="modal-overlay" onclick="if(event.target===this)closeClientEditModal()">'
    +   '<div class="modal-box" style="width:540px">'
    +     '<button class="close-modal" onclick="closeClientEditModal()">&times;</button>'
    +     '<h2>Edit client details</h2>'
    +     '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">'
    +       '<div class="wizard-form"><div class="form-group"><label>Company</label><input type="text" id="cedit-company"></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Contact name</label><input type="text" id="cedit-name"></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Email</label><input type="email" id="cedit-email"></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Country</label><input type="text" id="cedit-country"></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Headcount</label><input type="text" id="cedit-headcount"></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Timeline</label><input type="text" id="cedit-timeline"></div></div>'
    +     '</div>'
    +     '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">'
    +       '<button class="btn btn-secondary btn-sm" onclick="closeClientEditModal()">Cancel</button>'
    +       '<button class="btn btn-primary btn-sm" id="saveClientEdit-' + row.id + '" onclick="saveClientEdit(\'' + row.id + '\')">Save</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="table-card">'
    + '<div class="table-toolbar">'
    +   '<span class="table-title">Requirements *</span>'
    +   '<div style="display:flex;gap:8px;align-items:center">'
    +     '<button class="act-btn" id="sendToClient-' + row.id + '" onclick="sendToClient(\'' + row.id + '\')"><i class="fa-solid fa-paper-plane" style="font-size:11px;margin-right:5px"></i>Send to Client</button>'
    +     '<button class="act-btn' + (row.approved === 'Y' ? '' : ' act-btn-disabled') + '" id="assignVendors-' + row.id + '" onclick="assignVendors(\'' + row.id + '\')" ' + (row.approved === 'Y' ? '' : 'disabled title="Requires client approval"') + '><i class="fa-solid fa-users" style="font-size:11px;margin-right:5px"></i>Assign Vendors</button>'
    +     '<button class="act-btn' + (row.approved === 'N' ? '' : ' act-btn-disabled') + '" onclick="openAddReqModal(\'' + row.id + '\')" ' + (row.approved === 'N' ? '' : 'disabled title="Requirements approved"') + '>+ Add New</button>'
    +     '<button data-export-table="client-req-review-table" data-export-name="' + (row.data.title || 'requirements') + '_client_review" class="act-btn export-req-btn"><i class="fa-solid fa-download" style="font-size:11px;margin-right:5px"></i>Export</button>'
    +   '</div>'
    + '</div>'
    +   '<div style="overflow-x:auto">'
    +     '<table id="client-req-review-table" class="req-table" style="width:100%">'
    +       '<thead><tr>'
    +         '<th>Category</th><th>Description</th><th>Priority</th><th>System Part</th><th>Recommendation</th><th>Comment</th><th></th>'
    +       '</tr></thead>'
    +       '<tbody>' + rows + '</tbody>'
    +     '</table>'
    +   '</div>'
    + '<div id="add-req-modal" class="modal-overlay" onclick="if(event.target===this)closeAddReqModal()">'
    +   '<div class="modal-box">'
    +     '<button class="close-modal" onclick="closeAddReqModal()">&times;</button>'
    +     '<h2>New requirement</h2>'
    +     '<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">'
    +       '<div class="wizard-form"><div class="form-group"><label>Category</label><select id="areq-area">' + areas + '</select></div></div>'
    +       '<div class="wizard-form"><div class="form-group"><label>Description</label><textarea id="areq-requirement" rows="3" style="padding:8px 10px;border:1px solid var(--b2);border-radius:var(--radius-btn);font-family:var(--sans);font-size:12.5px;background:var(--w);color:var(--t1);outline:none;width:100%;resize:vertical" placeholder="Requirement description"></textarea></div></div>'
    +       '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +         '<div class="wizard-form"><div class="form-group"><label>Priority</label><select id="areq-priority"><option>Must-Have</option><option>Should-Have</option><option>Could-Have</option></select></div></div>'
    +         '<div class="wizard-form"><div class="form-group"><label>System Part</label><select id="areq-system-part">' + systemParts +'</select></div></div>'
    +       '</div>'
    +     '</div>'
    +     '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">'
    +       '<button class="btn btn-secondary btn-sm" onclick="closeAddReqModal()">Cancel</button>'
    +       '<button class="btn btn-primary btn-sm" id="saveNewReq-' + row.id + '" onclick="saveNewReq(\'' + row.id + '\')">Add</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '</div>';
}

function openAddReqModal(rowId) {
  document.getElementById('areq-area').value = '';
  document.getElementById('areq-requirement').value = '';
  document.getElementById('areq-priority').value = 'Must-Have';
  document.getElementById('areq-system-part').value = '';
  document.getElementById('add-req-modal').classList.add('open');
}

function closeAddReqModal() {
  const modal = document.getElementById('add-req-modal');
  if (modal) modal.classList.remove('open');
}

async function saveNewReq(rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  const area = document.getElementById('areq-area').value;
  const requirement = document.getElementById('areq-requirement').value.trim();
  if (!area || !requirement) {showNotification('Area and description are required.', 'error'); return;}
  row.data.requirements.push({
    area,
    requirement,
    priority:       document.getElementById('areq-priority').value,
    system_part:    document.getElementById('areq-system-part').value,
    recommendation: '',
    comment:        '',
  });
  
  const reset = lockBtn($(`#saveNewReq-${rowId}`));
  if (!reset) return;

  const res = await fetch("/api/supabase?action=updateDraftRequirementsRow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rowId, payload: row.data})
  });

  const result = await res.json();
  if (result.error){
    showNotification(result.error, 'error');
  }else{
    showNotification('Saved!', 'success');
  }
  reset();

  closeAddReqModal();
  renderDraftDetail(row);
}

function openClientEditModal(rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  const c = row.data.client || {};
  document.getElementById('cedit-company').value   = c.company   || '';
  document.getElementById('cedit-name').value      = c.name      || '';
  document.getElementById('cedit-email').value     = c.email     || '';
  document.getElementById('cedit-country').value   = c.country   || '';
  document.getElementById('cedit-headcount').value = c.headcount || '';
  document.getElementById('cedit-timeline').value  = c.timeline  || '';
  document.getElementById('client-edit-modal').classList.add('open');
}

function closeClientEditModal() {
  const modal = document.getElementById('client-edit-modal');
  if (modal) modal.classList.remove('open');
}

async function saveClientEdit(rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  row.data.client = {
    company:   document.getElementById('cedit-company').value.trim(),
    name:      document.getElementById('cedit-name').value.trim(),
    email:     document.getElementById('cedit-email').value.trim(),
    country:   document.getElementById('cedit-country').value.trim(),
    headcount: document.getElementById('cedit-headcount').value.trim(),
    timeline:  document.getElementById('cedit-timeline').value.trim(),
  };

  const reset = lockBtn($(`#saveClientEdit-${rowId}`));
  if (!reset) return;

  const res = await fetch("/api/supabase?action=updateDraftRequirementsRow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rowId, payload: row.data})
  });

  const result = await res.json();
  if (result.error){
    showNotification(result.error, 'error');
  }else{
    showNotification('Saved!', 'success');
  }
  reset();
  closeClientEditModal();
  renderDraftDetail(row);
}

window.generateReport = async function generateReport(){
  const reqId = encodeURIComponent(btoa(JSON.stringify(vendorDetailReq.id)))
 
  const reportUrl = `../requirements/report.html?req=${reqId}`;
  window.open(reportUrl, '_blank');
}

window.resendLink = async function resendLink(){
  const emailInput = document.getElementById('vendor-detail-resend-email');
  const email = emailInput.value.trim();
  if (!email) { showNotification('An email address is required.', 'error'); return; }

  const vendor = (vendorDetailReq?.assigned_vendors || [])[selectedVendorIdx];
  if (!vendor) { showNotification('Select a vendor first.', 'error'); return; }

  const confirmed = await showConfirm(
    'Resend link?',
    `The submission link will be sent to ${email}.`,
    'Send',
    '<i class="fa-solid fa-envelope" style="color:var(--t3);font-size:18px"></i>'
  );
  if (!confirmed) return;

  const origin = window.location.origin;
  const submissionLink = `${origin}/vendor/review.html?vid=${vendor.id}&req=${encodeURIComponent(btoa(JSON.stringify(vendorDetailReq.id)))}`;
  
  const res = await fetch('/api/send-email?action=vendorInvite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      contactPerson: vendor.contact_person?.name ? vendor.contact_person.name.split(' ')[0] : '',
      clientName: vendorDetailReq.client?.company,
      userId: _user.id,
      link: submissionLink,
      date: document.getElementById('vendor-detail-submit-by').value,
      subject: `HR Technology RFP Response- ${vendorDetailReq.client?.company}`
    })
  });

  const result = await res.json();
  if (result.error) {
    showNotification(result.error, 'error');
  } else {
    showNotification('Email Sent!', 'success');
  }
}

async function assignVendors(rowId){
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;

  const confirmed = await showConfirm(
    'Ready to Assign Vendors?',
    `This requirement will now be moved to 'Vendor Review' and no futher changes can be made.`,
    'Proceed',
    '<i class="fa-solid fa-users" style="color:var(--t3);font-size:18px"></i>'
  );
  if (!confirmed) return;

  const reset = lockBtn($(`#assignVendors-${rowId}`));
  if (!reset) return;

  const res = await fetch("/api/supabase?action=addNewRequirement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement: row.data, status: 'active', draft_req_id: rowId})
  });

  const result = await res.json();
  if (result.error){
      showNotification(result.error, 'error');
      reset();
      return;
  }

  const resl = await fetch("/api/supabase?action=lockDraftRequirement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rowId})
  });

  const rl = await resl.json();
  if (rl.error){
      showNotification(rl.error, 'error');
      reset();
      return;
  }

  showNotification('Proceeding to vendor view...', 'success');
  window.navigateTo('vendor-review');
}

async function sendToClient(rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  
  const email = row.data.client.email;
  const name = row.data.client.name;

  if (!email){showNotification('An email address is required.', 'error');return;}
  const confirmed = await showConfirm(
    'Send To Client?',
    `An email will be sent to ${email} asking them to review the requirement list.`,
    'Send',
    '<i class="fa-solid fa-circle-info" style="color:var(--t3);font-size:18px"></i>'
  );
  if (!confirmed) return;
  
  const reset = lockBtn($(`#sendToClient-${rowId}`));
  if (!reset) return;

  const origin = window.location.origin;
  const res = await fetch('/api/send-email?action=clientReqReview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          email: email, 
          link: `${origin}/client/review.html?id=${rowId}`,
          clientName: name,
          userId: _user.id,
      })
  });

  const result = await res.json();
  if (result.error){
    showNotification(result.error, 'error');
  }else{
    showNotification('Email Sent!', 'success');
  }

  reset();
}

async function removeDraftReq(idx, rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  
  const req = row.data.requirements[idx];
  const confirmed = await showConfirm(
    'Remove requirement?',
    'This will permanently remove "' + (req?.requirement || 'this requirement') + '" from the list. This action cannot be undone.',
    'Remove'
  );
  if (!confirmed) return;
  row.data.requirements.splice(idx, 1);

  const reset = lockBtn($(`#removeDraftReq-${rowId}`));
  if (!reset) return;

  const res = await fetch("/api/supabase?action=updateDraftRequirementsRow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rowId, payload: row.data})
  });

  const result = await res.json();
  if (result.error){
    showNotification(result.error, 'error');
  }

  reset();
  renderDraftDetail(row);
}

let editReqContext = null; // { rowId, idx }

function editDraftReq(idx, rowId) {
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  const req = row.data.requirements[idx];
  if (!req) return;

  if (cachedFormFields != null){
    cachedFormFields.area.sort((a, b) => a.localeCompare(b)).forEach(a => {
      $('#ereq-area').append(`<option>${a}</option>`);
    });

    cachedFormFields.system_parts.sort((a, b) => a.localeCompare(b)).forEach(p => {
      $('#ereq-system-part').append(`<option>${p}</option>`);
    });
  }

  editReqContext = { rowId, idx };
  document.getElementById('ereq-area').value = req.area || '';
  document.getElementById('ereq-requirement').value = req.requirement || '';
  document.getElementById('ereq-priority').value = req.priority || 'Must-Have';
  document.getElementById('ereq-system-part').value = req.system_part || '';
  //document.getElementById('ereq-recommendation').value = req.recommendation || '';
  //document.getElementById('ereq-comment').value = req.comment || '';
  document.getElementById('editReqPanel').classList.add('open');
}

function closeReqEditPanel() {
  document.getElementById('editReqPanel').classList.remove('open');
  editReqContext = null;
}

async function saveReqEdit() {
  if (!editReqContext) return;
  const { rowId, idx } = editReqContext;
  const row = cachedDrafts.find(r => String(r.id) === String(rowId));
  if (!row) return;
  const req = row.data.requirements[idx];
  if (!req) return;

  const area = document.getElementById('ereq-area').value.trim();
  const requirement = document.getElementById('ereq-requirement').value.trim();
  const priority = document.getElementById('ereq-priority').value;
  if (!area || !requirement || !priority) {
    showNotification('Category and description are required.', 'error');
    return;
  }

  req.area = area;
  req.requirement = requirement;
  req.priority = priority;
  req.system_part = document.getElementById('ereq-system-part').value;
  //req.recommendation = document.getElementById('ereq-recommendation').value.trim();
  //req.comment = document.getElementById('ereq-comment').value.trim();

  const reset = lockBtn($('#ereq-save-btn'));
  if (!reset) return;
  
  const res = await fetch("/api/supabase?action=updateDraftRequirementsRow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rowId, payload: row.data })
  });

  const result = await res.json();
  if (result.error) {
    showNotification(result.error, 'error');
  } else {
    showNotification('Saved!', 'success');
  }
  reset();
  closeReqEditPanel();
  renderDraftDetail(row);
}

document.getElementById('ereq-save-btn').addEventListener('click', saveReqEdit);
document.getElementById('ereq-cancel-btn').addEventListener('click', closeReqEditPanel);

let activeTable = null;
async function loadActive() {
  if ($.fn.DataTable.isDataTable('#active-table')) {
    $('#active-table').DataTable().destroy();
  }

  const tbody = document.getElementById('active-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px 14px"><div style="display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid var(--b2);border-top-color:var(--o);animation:spin .7s linear infinite"></div></td></tr>';
  activeTable = null;

  try {
    const response = await fetch('/api/supabase?action=getActiveRequirements');
    const result = await response.json();
    if (result.error) { showNotification(result.error, 'error'); return; }

    cachedActiveRequirements = result.data;
    document.getElementById('stat-active-req').textContent = result.data.length;
    document.getElementById('nav-active-count').textContent = result.data.length;

    tbody.innerHTML = '';

    cachedActiveRequirements.forEach(row => {
      const vendors = row.assigned_vendors || [];
      const responded = vendors.filter(v => v.feedback && v.feedback.length).length;
      const total = vendors.length;
      const allIn = total > 0 && responded === total;
      const noneIn = total > 0 && responded === 0;
      const badge = allIn
        ? '<span class="badge b-green">All in</span>'
        : noneIn
        ? '<span class="badge b-amber">No responses</span>'
        : '<span class="badge b-blue">' + responded + '/' + total + ' in</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = ''
        + '<td></td>'
        + '<td>' + (row.created_at ? row.created_at.slice(0,10) : '—') + '</td>'
        + '<td class="cell-primary">' + (row.client?.company || '—') + '</td>'
        + '<td class="cell-primary"><a href="#" onclick="openVendorDetail(\'' + row.id + '\', this);return false;" style="color:var(--blue);text-decoration:none">' + (row.title || '—') + '</a></td>'
        + '<td>' + (row.client?.name || '—') + '</td>'
        + '<td>' + (row.client?.email || '—') + '</td>'
        + '<td>' + (row.client?.country || '—') + '</td>'
        + '<td>' + badge + '</td>';
      tbody.appendChild(tr);
    });

    activeTable = $('#active-table').DataTable({ responsive:true, pageLength:10 });
  } catch (err) {
    console.error('Failed to fetch active requirements:', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px 14px;color:var(--t3);font-style:italic">Failed to load.</td></tr>';
  }

  let req = localStorage.getItem('req');
  if (req !== null){
    req = decodeURIComponent(JSON.parse(atob(req)));
    openVendorDetail(req);
  }
  localStorage.removeItem('req');
}

/* ══ VENDOR REVIEW DETAIL ══ */
/* ── Vendor detail section menu ── */
let vendorDetailSection = 'responses';

function setVdSubnavCollapsed(collapsed) {
  const nav = document.getElementById('vd-subnav');
  const btn = document.getElementById('vd-subnav-toggle');
  nav.classList.toggle('collapsed', collapsed);
  const label = collapsed ? 'Expand menu' : 'Collapse menu';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  try { localStorage.setItem('vdSubnavCollapsed', collapsed ? '1' : '0'); } catch (e) {}
}

document.getElementById('vd-subnav-toggle').addEventListener('click', () => {
  setVdSubnavCollapsed(!document.getElementById('vd-subnav').classList.contains('collapsed'));
});

// Restore the saved state on load
try { setVdSubnavCollapsed(localStorage.getItem('vdSubnavCollapsed') === '1'); } catch (e) {}

function showVendorDetailSection(section) {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.style.display = (el.dataset.view === section) ? 'flex' : 'none';
  });

  vendorDetailSection = section;
  document.querySelectorAll('.vd-subnav-item').forEach(i =>
    i.classList.toggle('active', i.dataset.vdSection === section));
  document.querySelectorAll('.vd-section').forEach(s =>
    s.style.display = (s.id === 'vd-section-' + section) ? '' : 'none');

  if (section === 'tracking') renderTracking();
}

const VENDOR_STATUSES = [
  'Longlisted', 'RFI invitation sent', 'RFI submitted', 'Rejected', 'Vendor withdrew',
  'On hold', 'Shortlisted', 'RFP invitation sent', 'RFP submitted', 'Vendor of choice'
];

const STATUS_TONE = {
  'Longlisted': 'neutral',
  'RFI invitation sent': 'blue',
  'RFI submitted': 'blue',
  'Shortlisted': 'green',
  'RFP invitation sent': 'blue',
  'RFP submitted': 'green',
  'Vendor of choice': 'win',
  'On hold': 'amber',
  'Rejected': 'red',
  'Vendor withdrew': 'red'
};

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

let trackingStatusFilter = '';

function renderTracking() {
  const el = document.getElementById('vd-tracking-content');
  const vendors = vendorDetailReq?.assigned_vendors || [];

  if (!vendors.length) {
    el.innerHTML = '<div class="info-card" style="display:flex;align-items:center;justify-content:center;height:160px;color:var(--t4);font-size:13px">'
      + 'No vendors assigned yet. Add vendors under Vendor Responses to start tracking.</div>';
    return;
  }

  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t4);font-size:13px;">
    <div class="dot-spinner"><span></span><span></span><span></span></div>
  </div>`;

  const rows = vendors.map((v, idx) => {
    const status = v.status || 'Longlisted';
    const options = VENDOR_STATUSES.map(s =>
      '<option' + (s === status ? ' selected' : '') + '>' + s + '</option>').join('');

    return '<tr data-status="' + escapeHtml(status) + '">'
      + '<td class="cell-primary">' + escapeHtml(v.name || '—') + '</td>'
      + '<td>'
      +   '<div class="trk-contact-name">' + escapeHtml(v.contact_person?.name || '—') + '</div>'
      +   (v.contact_person?.email ? '<div class="trk-contact-email">' + escapeHtml(v.contact_person.email) + '</div>' : '')
      + '</td>'
      + '<td>'
      +   '<select class="trk-status" data-idx="' + idx + '" data-tone="' + (STATUS_TONE[status] || 'neutral') + '">' + options + '</select>'
      +   (v.status_updated_at ? '<div class="trk-updated">Updated ' + formatDayDate(v.status_updated_at) + '</div>' : '')
      + '</td>'
      + '<td><textarea class="trk-notes" data-idx="' + idx + '" rows="2" placeholder="Add notes…">' + escapeHtml(v.notes || '') + '</textarea></td>'
      + '</tr>';
  }).join('');

    const counts = {};
  vendors.forEach(v => { const s = v.status || 'Longlisted'; counts[s] = (counts[s] || 0) + 1; });

  if (trackingStatusFilter && !counts[trackingStatusFilter]) trackingStatusFilter = '';

  const filterOptions = '<option value="">All (' + vendors.length + ')</option>'
    + VENDOR_STATUSES.filter(s => counts[s])
        .map(s => '<option value="' + s + '"' + (s === trackingStatusFilter ? ' selected' : '') + '>' + s + ' (' + counts[s] + ')</option>')
        .join('');

  const filterStyle = 'display:block;width:100%;font-size:12px;font-family:var(--sans);padding:4px;color:var(--t1);background:#fff;border:1px solid var(--b2);border-radius:4px;box-sizing:border-box';

  el.innerHTML = '';
  el.innerHTML = ''
    + '<div class="table-card">'
    +   '<div class="table-toolbar">'
    +     '<span class="table-title">Vendor Tracking</span>'
    +     '<span class="trk-save-state" id="trk-save-state"></span>'
    +   '</div>'
    +   '<div style="overflow-x:auto">'
    +     '<table id="tracking-table" class="req-table" style="width:100%">'
    +       '<thead>'
    +         '<tr><th style="width:18%">Vendor name</th><th style="width:22%">Vendor contact</th><th style="width:20%">Vendor status</th><th>Notes</th></tr>'
    +         '<tr class="req-filter-row">'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +           '<th style="padding:4px;background:var(--w)"><select id="trk-filter-status" style="' + filterStyle + '">' + filterOptions + '</select></th>'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +         '</tr>'
    +       '</thead>'
    +       '<tbody>' + rows + '</tbody>'
    +     '</table>'
    +   '</div>'
    + '</div>';

  // Status: save immediately on change
  el.querySelectorAll('.trk-status').forEach(sel => {
    sel.addEventListener('change', () => {
      const v = vendorDetailReq.assigned_vendors[sel.dataset.idx];
      v.status = sel.value;
      v.status_updated_at = new Date().toISOString();
      sel.dataset.tone = STATUS_TONE[sel.value] || 'neutral';
      saveTracking().then(ok => { if (ok) renderTracking(); });
    });
  });

  // Notes: save when the field loses focus, only if changed
  el.querySelectorAll('.trk-notes').forEach(ta => {
    ta.addEventListener('change', () => {
      vendorDetailReq.assigned_vendors[ta.dataset.idx].notes = ta.value.trim();
      saveTracking();
    });
  });

  document.getElementById('trk-filter-status').addEventListener('change', e => {
    trackingStatusFilter = e.target.value;
    filterTrackingTable();
  });

  filterTrackingTable();
}

function filterTrackingTable() {
  document.querySelectorAll('#tracking-table tbody tr[data-status]').forEach(tr => {
    tr.style.display = (!trackingStatusFilter || tr.dataset.status === trackingStatusFilter) ? '' : 'none';
  });
}

async function saveTracking() {
  // const state = document.getElementById('trk-save-state');
  // if (state) state.innerHTML = '<span class="dot-spinner sm muted"><span></span><span></span><span></span></span>';

  // try {
  //   const res = await fetch('/api/supabase?action=updateVendorList', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ data: vendorDetailReq })
  //   });
  //   const result = await res.json();
  //   if (result.error) throw new Error(result.error);
  //   if (state) state.textContent = 'Saved';
  //   setTimeout(() => { if (state && state.textContent === 'Saved') state.textContent = ''; }, 2000);
  //   return true;
  // } catch (err) {
  //   showNotification(err.message || 'Failed to save.', 'error');
  //   if (state) state.textContent = '';
  //   return false;
  // }
}

document.querySelectorAll('.vd-subnav-item').forEach(item =>
  item.addEventListener('click', () => showVendorDetailSection(item.dataset.vdSection)));

let vendorDetailReq = null;
let selectedVendorIdx = null;
let vendorPanelContext = null;

async function openVendorDetail(reqId, elmt = null) {
  const row = cachedActiveRequirements.find(r => String(r.id) === String(reqId));
  
  if (!row) return;

  if (elmt != null){$(elmt).append(' <i class="fa fa-spin fa-spinner"></i>');}

  vendorDetailReq = row;
  selectedVendorIdx = (row.assigned_vendors && row.assigned_vendors.length) ? 0 : null;

  if (!cachedFormFields) {
    const ffRes = await fetch('/api/supabase?action=getFormFields');
    const ffResult = await ffRes.json();
    if (!ffResult.error) cachedFormFields = ffResult.data;
  }

  window.navigateTo('vendor-detail');
}

let selectedSystemParts = [];

function populateSystemPartsSelect(selected = []) {
  selectedSystemParts = selected.slice();
  const menu = document.getElementById('vp-system-parts-menu');
  const parts = (cachedFormFields && cachedFormFields.system_parts) ? cachedFormFields.system_parts : (formFields.system_parts || []);

  menu.innerHTML = '';
  parts.slice().sort((a, b) => a.localeCompare(b)).forEach(p => {
    const item = document.createElement('label');
    item.className = 'ms-dropdown-item';
    item.innerHTML = '<input type="checkbox" value="' + p + '" ' + (selectedSystemParts.includes(p) ? 'checked' : '') + '> <span>' + p + '</span>';
    item.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!selectedSystemParts.includes(p)) selectedSystemParts.push(p);
      } else {
        selectedSystemParts = selectedSystemParts.filter(x => x !== p);
      }
      updateSystemPartsLabel();
    });
    menu.appendChild(item);
  });

  updateSystemPartsLabel();
}

function updateSystemPartsLabel() {
  const label = document.getElementById('vp-system-parts-label');
  label.textContent = selectedSystemParts.length ? selectedSystemParts.join(', ') : 'Select system parts…';
}

document.getElementById('vp-system-parts-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('vp-system-parts-menu').classList.toggle('open');
});

document.getElementById('vp-system-parts-menu').addEventListener('click', (e) => {
  e.stopPropagation();
});

document.addEventListener('click', () => {
  document.getElementById('vp-system-parts-menu').classList.remove('open');
});

function loadVendorDetail() {
  if (!vendorDetailReq) { window.navigateTo('vendor-review'); return; }
  document.getElementById('vendor-detail-title').innerHTML = `<button style="border-radius:unset;border:none" class="btn btn-secondary btn-sm" onclick="window.navigateTo('vendor-review')">
              <i class="fa-solid fa-arrow-left" style="font-size:11px"></i>
            </button> ${vendorDetailReq.title}` || 'Requirement';
  
  document.getElementById('vendor-detail-date').innerHTML = 'Created on ' + formatDayDate(vendorDetailReq.created_at) || '';
  document.getElementById('breadcrumb-current').textContent = vendorDetailReq.title || 'Requirement';
  renderVendorDetailSidebar();
  if (selectedVendorIdx !== null) renderVendorDetailPanel(selectedVendorIdx);
  else renderVendorDetailPanelEmpty();
}

function formatDayDate(iso) {
  if (!iso) return '—';

  const d = new Date(iso.replace(/(\.\d{3})\d+/, '$1'));
  if (isNaN(d)) return '—';

  const day = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${day}, ${date}`;
}

function renderVendorDetailSidebar() {
  const sidebar = document.getElementById('vendor-detail-sidebar-list');
  const vendors = vendorDetailReq.assigned_vendors || [];
  let html = '';
  vendors.forEach((v, idx) => {
    html += '<div class="req-sidebar-item' + (idx === selectedVendorIdx ? ' active' : '') + '" onclick="selectVendorDetail(' + idx + ')">' + v.name + '</div>';
  });
  if (!vendors.length) {
    html += '<p style="font-size:12px;color:var(--t4);padding:8px 0">No vendors assigned yet.</p>';
    $('#vendor-detail-resend-email').prop('disabled', true);
  }
  sidebar.innerHTML = html;
}

function selectVendorDetail(idx) {
  selectedVendorIdx = idx;
  renderVendorDetailSidebar();
  renderVendorDetailPanel(idx);
}

function renderVendorDetailPanelEmpty() {
  document.getElementById('vendor-detail-panel').innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t4);font-size:13px;">Select a vendor to view details, or add one to get started.</div>';
}

async function renderVendorDetailPanel(idx) {
  const panel = document.getElementById('vendor-detail-panel');
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t4);font-size:13px;">
    <div class="dot-spinner"><span></span><span></span><span></span></div>
  </div>`;

  const vendor = (vendorDetailReq.assigned_vendors || [])[idx];
  const requirements = vendorDetailReq.requirements || [];
  if (!vendor) { renderVendorDetailPanelEmpty(); return; }
 
  const feedback = vendor.feedback || [];
  const priorityColor = p => p === 'Must-Have' ? 'color:var(--o)' : p === 'Should-Have' ? 'color:var(--t2)' : 'color:var(--t3)';
  const vendorFeedbackValues = (cachedFormFields && cachedFormFields.vendor_feedback) ? cachedFormFields.vendor_feedback : [];
  const bestFeedbackValue = vendorFeedbackValues[0]; // e.g. "Fully meets the requirement via core platform"

  let rows = '';
  let notMetRows = '';
  const areaCounts = {}; // area -> { feedbackValue: count }
  const areaSet = new Set();
  const responseSet = new Set();
  
  const vresponse = await fetch(`/api/supabase?action=getVendorById&vendorId=${vendor.id}`);
  const vresult = await vresponse.json();
  if (vresult.error) {
      showNotification(vresult.error, 'error');
      return;
  }

  const systemParts = vresult.data.system_parts;
  let totReq = 0;
  requirements.forEach((req, i) => {
    if (systemParts == null) return;
    if (!systemParts.includes(req.system_part)) return;

    const fb = feedback.find(f => f.pos === i) || {};

    const areaAttr = (req.area || '').replace(/"/g, '&quot;');
    const reqAttr = (req.requirement || '').replace(/"/g, '&quot;').toLowerCase();
    const responseAttr = (fb.feedback || '').replace(/"/g, '&quot;');
    if (req.area) areaSet.add(req.area);
    if (fb.feedback) responseSet.add(fb.feedback);
   
    rows += '<tr data-area="' + areaAttr + '" data-requirement="' + reqAttr + '" data-response="' + responseAttr + '">'
      + '<td style="color:var(--o);font-weight:500">' + (req.area || '—') + '</td>'
      + '<td>' + (req.requirement || '—') + '</td>'
      + '<td style="' + priorityColor(req.priority) + ';font-weight:500;white-space:nowrap">' + (req.priority || '—') + '</td>'
      + '<td>' + (req.system_part || '—') + '</td>'
      + '<td>' + (fb.feedback ? '<span class="badge b-blue">' + fb.feedback + '</span>' : '<span class="badge b-gray">Pending</span>') + '</td>'
      + '<td>' + (fb.comment || '') + '</td>'
      + '</tr>';
      
    if (fb.feedback && bestFeedbackValue && fb.feedback !== bestFeedbackValue) {
      notMetRows += '<tr>'
        + '<td style="color:var(--o);font-weight:500">' + (req.area || '—') + '</td>'
        + '<td>' + (req.requirement || '—') + '</td>'
        + '<td>' + fb.feedback + '</td>'
        + '</tr>';
    }

    if (fb.feedback) {
      totReq++;
      if (!areaCounts[req.area]) areaCounts[req.area] = {};
      areaCounts[req.area][fb.feedback] = (areaCounts[req.area][fb.feedback] || 0) + 1;
    } else if (!areaCounts[req.area]) {
      areaCounts[req.area] = {};
    }
  });

  // Per-area count table headers
  let perAreaHead = '<tr><th style="min-width:70px">Area</th>';
  vendorFeedbackValues.forEach(f => {
    perAreaHead += '<th class="clip-header" title="' + f + '" style="text-align:center">' + f + '</th>';
  });
  perAreaHead += '<th style="text-align:center;min-width:50px">Total</th></tr>';

  let perAreaRows = '';
  Object.keys(areaCounts).sort().forEach(area => {
    let total = 0;
    let row = '<tr><td style="color:var(--o);font-weight:500">' + area + '</td>';
    vendorFeedbackValues.forEach(f => {
      const count = areaCounts[area][f] || 0;
      total += count;
      row += '<td class="center">' + count + '</td>';
    });
    row += '<td class="center" style="font-weight:600">' + total + '</td></tr>';
    perAreaRows += row;
  });

  // Filter dropdown options built from the actual rows rendered above
  const areaFilterOptions = Array.from(areaSet)
    .sort((a, b) => a.localeCompare(b))
    .map(a => '<option value="' + a.replace(/"/g, '&quot;') + '">' + a + '</option>')
    .join('');

  const responseFilterOptions = Array.from(responseSet)
    .sort((a, b) => a.localeCompare(b))
    .map(r => '<option value="' + r.replace(/"/g, '&quot;') + '">' + r + '</option>')
    .join('');

  const filterInputStyle = 'display:block;width:100%;font-size:12px;font-family:var(--sans);padding:4px;color:var(--t1);background:#fff;border:1px solid var(--b2);border-radius:4px;box-sizing:border-box';

  panel.innerHTML = '';
  panel.innerHTML = ''
    + '<div class="info-card" style="margin-bottom:12px">'
    +   '<div class="info-card-title">Vendor details</div>'
    +   '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px 24px">'
    +     '<div class="info-row"><span class="info-key">Company</span><span class="info-val">' + (vendor.name || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Contact</span><span class="info-val">' + (vendor.contact_person?.name || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Email</span><span class="info-val">' + (vendor.contact_person?.email || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Phone</span><span class="info-val">' + (vendor.contact_person?.phone || '—') + '</span></div>'
    +     '<div class="info-row"><span class="info-key">Responses</span><span class="info-val">' + (feedback.length ? totReq + ' / ' + feedback.length : 'Not submitted') + '</span></div>'
    +   '</div>'
    + '</div>'

    + '<div class="table-card">'
    +   '<div class="table-toolbar"><span class="table-title">Requirements &amp; Responses</span></div>'
    +   '<div style="overflow-x:auto">'
    +     '<table id="vendor-req-response-table" class="req-table" style="width:100%">'
    +       '<thead>'
    +         '<tr><th>Category</th><th>Description</th><th>Priority</th><th>System Part</th><th>Response</th><th>Comment</th></tr>'
    +         '<tr class="req-filter-row">'
    +           '<th style="padding:4px;background:var(--w)"><select id="vendorFilterArea" onchange="window.filterVendorReqTable()" style="' + filterInputStyle + '"><option value="">All</option>' + areaFilterOptions + '</select></th>'
    +           '<th style="padding:4px;background:var(--w)"><input type="text" id="vendorFilterRequirement" oninput="window.filterVendorReqTable()" placeholder="Search..." style="' + filterInputStyle + '"></th>'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +           '<th style="padding:4px;background:var(--w)"><select id="vendorFilterResponse" onchange="window.filterVendorReqTable()" style="' + filterInputStyle + '"><option value="">All</option>' + responseFilterOptions + '</select></th>'
    +           '<th style="padding:4px;background:var(--w)"></th>'
    +         '</tr>'
    +       '</thead>'
    +       '<tbody>' + (rows || '<tr><td colspan="6" style="text-align:center;color:var(--t4);font-style:italic;padding:20px">No requirements found.</td></tr>') + '</tbody>'
    +     '</table>'
    +   '</div>'
    + '</div>'

    + '<div class="table-card">'
    +   '<div class="table-toolbar"><span class="table-title">List of Requirements Not Fully Met</span></div>'
    +   '<div style="overflow-x:auto">'
    +     '<table class="req-table" style="width:100%">'
    +       '<thead><tr><th>Area</th><th>Description</th><th>Response</th></tr></thead>'
    +       '<tbody>' + (notMetRows || '<tr><td colspan="3" style="text-align:center;color:var(--t4);font-style:italic;padding:20px">All requirements are fully met.</td></tr>') + '</tbody>'
    +     '</table>'
    +   '</div>'
    + '</div>'

    + '<div class="table-card">'
    +   '<div class="table-toolbar"><span class="table-title">Count of Responses per Area</span></div>'
    +   '<div style="overflow-x:auto">'
    +     '<table class="req-table clip-header-table" style="width:100%;table-layout:fixed">'
    +       '<thead>' + perAreaHead + '</thead>'
    +       '<tbody>' + (perAreaRows || '<tr><td colspan="' + (vendorFeedbackValues.length + 2) + '" style="text-align:center;color:var(--t4);font-style:italic;padding:20px">No responses yet.</td></tr>') + '</tbody>'
    +     '</table>'
    +   '</div>'
    + '</div>';
}

window.filterVendorReqTable = function filterVendorReqTable() {
  const table = document.getElementById('vendor-req-response-table');
  if (!table) return;

  const areaSelect = document.getElementById('vendorFilterArea');
  const reqInput = document.getElementById('vendorFilterRequirement');
  const responseSelect = document.getElementById('vendorFilterResponse');

  const areaVal = (areaSelect?.value || '').trim();
  const reqVal = (reqInput?.value || '').trim().toLowerCase();
  const responseVal = (responseSelect?.value || '').trim();

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  Array.from(tbody.rows).forEach(tr => {
    if (!tr.hasAttribute('data-area')) return; // skip the "No requirements found" placeholder row

    const rowArea = tr.getAttribute('data-area') || '';
    const rowReq = tr.getAttribute('data-requirement') || '';
    const rowResponse = tr.getAttribute('data-response') || '';

    const matchesArea = !areaVal || rowArea === areaVal;
    const matchesReq = !reqVal || rowReq.includes(reqVal);
    const matchesResponse = !responseVal || rowResponse === responseVal;

    tr.style.display = (matchesArea && matchesReq && matchesResponse) ? '' : 'none';
  });
}

/* ══ VENDOR INVITE (multi-select) ══ */
let vipAllVendors = [];

function openVendorInvitePanel() {
  if (!vendorDetailReq) return;
  const submitBy = document.getElementById('vendor-detail-submit-by').value;
  if (!submitBy){showNotification('You must select a submit by date', 'error');return;}
  document.getElementById('vip-search').value = '';
  document.getElementById('vendorInvitePanel').classList.add('open');
  loadVendorInviteList();
}

async function loadVendorInviteList() {
  const listEl = document.getElementById('vip-list');
  const loaderEl = document.getElementById('vip-loader');
  listEl.innerHTML = '';
  loaderEl.style.display = 'block';

  try {
    const response = await fetch('/api/supabase?action=getVendors');
    const result = await response.json();
    if (result.error) { showNotification(result.error, 'error'); loaderEl.style.display = 'none'; return; }

    const assignedIds = (vendorDetailReq.assigned_vendors || []).map(v => String(v.id));

    // Only show vendors that have a contact person, aren't already assigned,
    // and (if system_parts data is available) match a system part on this requirement
    const reqSystemParts = (vendorDetailReq.requirements || []).map(r => r.system_part).filter(Boolean);

    vipAllVendors = result.data.filter(v => {
      const hasContact = v.contact_person && v.contact_person.email;
      const notAssigned = !assignedIds.includes(String(v.id));
      const matchesSystemPart = !v.system_parts || !v.system_parts.length || v.system_parts.some(sp => reqSystemParts.includes(sp));
      return hasContact && notAssigned && matchesSystemPart;
    });

    renderVendorInviteList(vipAllVendors);
  } catch (err) {
    console.error('Failed to fetch vendors:', err);
    showNotification('Failed to load vendors.', 'error');
  }
  loaderEl.style.display = 'none';
}

function renderVendorInviteList(vendors) {
  const listEl = document.getElementById('vip-list');
  if (!vendors.length) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--t4);padding:8px 0">No available vendors found.</p>';
    return;
  }
  listEl.innerHTML = vendors.map(v =>
    '<label class="vip-item">'
    + '<input type="checkbox" class="vip-checkbox" value="' + v.id + '">'
    + '<span style="flex:1"><div>' + v.name + '</div><div class="vip-meta">' + (v.contact_person?.email || '') + '</div></span>'
    + '</label>'
  ).join('');

  $('#vendor-detail-resend-email').prop('disabled', false);
}

document.getElementById('vip-search').addEventListener('input', function() {
  const term = this.value.toLowerCase();
  renderVendorInviteList(vipAllVendors.filter(v => v.name.toLowerCase().includes(term)));
});

document.getElementById('vip-cancel-btn').addEventListener('click', () => {
  document.getElementById('vendorInvitePanel').classList.remove('open');
});

document.getElementById('vip-invite-btn').addEventListener('click', async function() {
  const selectedIds = Array.from(document.querySelectorAll('.vip-checkbox:checked')).map(cb => cb.value);
  if (!selectedIds.length) { showNotification('Select at least one vendor to invite.', 'error'); return; }

  const reset = lockBtn($('#vip-invite-btn'));
  if (!reset) return;

  const selectedVendors = vipAllVendors.filter(v => selectedIds.includes(String(v.id)));

  vendorDetailReq.assigned_vendors = vendorDetailReq.assigned_vendors || [];
  selectedVendors.forEach(v => {
    vendorDetailReq.assigned_vendors.push({
      id: v.id,
      name: v.name,
      contact_person: v.contact_person,
      feedback: []
    });
  });
  
  const res = await fetch("/api/supabase?action=updateVendorList", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: vendorDetailReq})
  });

  const result = await res.json();
  if (result.error){
      showNotification(result.error, 'error');
      return;
  }

  // Send invite emails, one per vendor, with the submission link they'll use
  const origin = window.location.origin;
  await Promise.all(selectedVendors.map(v => {
    const submissionLink = `${origin}/vendor/review.html?vid=${v.id}&req=${encodeURIComponent(btoa(JSON.stringify(vendorDetailReq.id)))}`;
    return fetch('/api/send-email?action=vendorInvite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: v.contact_person.email,
        contactPerson: v.contact_person.name.split(' ')[0],
        clientName: vendorDetailReq.client?.company,
        userId: _user.id,
        link: submissionLink,
        date: document.getElementById('vendor-detail-submit-by').value,
        subject: `HR Technology RFP Invitation- ${vendorDetailReq.client?.company}`
      })
    }).then(r => r.json());
  }));

  showNotification('Invitation(s) sent!', 'success');
  reset();

  document.getElementById('vendorInvitePanel').classList.remove('open');

  selectedVendorIdx = vendorDetailReq.assigned_vendors.length - 1;
  renderVendorDetailSidebar();
  renderVendorDetailPanel(selectedVendorIdx);
});

let completedTable = null;
function loadCompleted() {
  const tbody = document.getElementById('completed-tbody');
  tbody.innerHTML = '';
  MOCK.completed.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.submitted + '</td><td class="cell-primary">' + r.company + '</td><td class="cell-primary"><a href="#" style="color:var(--blue);text-decoration:none">' + r.title + '</a></td><td>' + r.contact + '</td><td>' + r.email + '</td><td>' + r.country + '</td>';
    tbody.appendChild(tr);
  });
  if (completedTable) { completedTable.destroy(); }
  completedTable = $('#completed-table').DataTable({ responsive:true, pageLength:10 });
}
let vendorsTable = null;
async function loadVendors() {
  const tbody = document.getElementById('vendors-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px 14px"><div style="display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid var(--b2);border-top-color:var(--o);animation:spin .7s linear infinite"></div></td></tr>';

  const response = await fetch('/api/supabase?action=getVendors');
  const result = await response.json();
  if (result.error) { showNotification(result.error, 'error'); return; }
  MOCK.vendors = result.data;
  tbody.innerHTML = '';
  MOCK.vendors.forEach(v => {
    const tr = document.createElement('tr');
    const verBadge = v.verified === 'Yes' ? '<span class="badge b-green">Verified</span>' : '<span class="badge b-gray">Unverified</span>';
    tr.innerHTML = ''
   tr.innerHTML = ''
  + '<td class="cell-primary">' + v.name + '</td><td>' + (v.hq_location || '') + '</td><td>' + (v.contact_person?.name || '') + '</td><td>' + (v.contact_person?.email || '') + '</td><td>' + (v.contact_person?.phone || '—') + '</td><td>' + verBadge + '</td>'
  + '<td style="white-space:nowrap">'
  +   '<button class="row-icon-btn" title="Edit" onclick="editVendorRow(\'' + v.id + '\')"><i class="fa-solid fa-pen-to-square"></i></button>'
  +   '<button class="row-icon-btn danger" title="Delete" data-requires-role="admin" onclick="deleteVendorRow(\'' + v.id + '\')"><i class="fa-solid fa-trash-can"></i></button>'
  + '</td>';
      tbody.appendChild(tr);
  });
  if (vendorsTable) { vendorsTable.destroy(); }
  vendorsTable = $('#vendors-table').DataTable({ responsive:true, pageLength:10 });
}

const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

let editingVendorId = null;

function editVendorRow(id) {
  const v = MOCK.vendors.find(v => String(v.id) === String(id));
  if (!v) return;

  editingVendorId = id;

  document.getElementById('evp-company').value     = v.name || '';
  document.getElementById('evp-description').value = v.description || '';
  document.getElementById('evp-hq').value           = v.hq_location || '';
  document.getElementById('evp-contact').value      = v.contact_person?.name || '';
  document.getElementById('evp-email').value        = v.contact_person?.email || '';
  document.getElementById('evp-phone').value        = v.contact_person?.phone || '';
  populateEditSystemPartsSelect(v.system_parts || []);
  document.getElementById('editVendorPanel').classList.add('open');
}

let selectedEditSystemParts = [];

function populateEditSystemPartsSelect(selected = []) {
  selectedEditSystemParts = selected.slice();
  const menu = document.getElementById('evp-system-parts-menu');
  const parts = (cachedFormFields && cachedFormFields.system_parts) ? cachedFormFields.system_parts : (formFields.system_parts || []);

  menu.innerHTML = '';
  parts.slice().sort((a, b) => a.localeCompare(b)).forEach(p => {
    const item = document.createElement('label');
    item.className = 'ms-dropdown-item';
    item.innerHTML = '<input type="checkbox" value="' + p + '" ' + (selectedEditSystemParts.includes(p) ? 'checked' : '') + '> <span>' + p + '</span>';
    item.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        if (!selectedEditSystemParts.includes(p)) selectedEditSystemParts.push(p);
      } else {
        selectedEditSystemParts = selectedEditSystemParts.filter(x => x !== p);
      }
      updateEditSystemPartsLabel();
    });
    menu.appendChild(item);
  });

  updateEditSystemPartsLabel();
}

function updateEditSystemPartsLabel() {
  const label = document.getElementById('evp-system-parts-label');
  label.textContent = selectedEditSystemParts.length ? selectedEditSystemParts.join(', ') : 'Select system parts…';
}

document.getElementById('evp-system-parts-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('evp-system-parts-menu').classList.toggle('open');
});

document.getElementById('evp-system-parts-menu').addEventListener('click', (e) => {
  e.stopPropagation();
});

document.addEventListener('click', () => {
  document.getElementById('evp-system-parts-menu').classList.remove('open');
});

document.getElementById('close-edit-vendor-panel-btn').addEventListener('click', () => {
  document.getElementById('editVendorPanel').classList.remove('open');
  editingVendorId = null;
  selectedEditSystemParts = [];
  updateEditSystemPartsLabel();
});

document.getElementById('evp-submit-btn').addEventListener('click', async () => {
  const company = document.getElementById('evp-company').value.trim();
  const contact = document.getElementById('evp-contact').value.trim();
  const email = document.getElementById('evp-email').value.trim();
  if (!company || !contact || !email) { showNotification('Company name, contact name, and email are required.', 'error'); return; }
  if (!editingVendorId) return;

  const v = MOCK.vendors.find(v => String(v.id) === String(editingVendorId));
  
  if (v) {
    v.name = company;
    v.description = document.getElementById('evp-description').value.trim();
    v.hq_location = document.getElementById('evp-hq').value.trim();
    v.contact_person = v.contact_person || {};
    v.contact_person.name = contact;
    v.contact_person.email = email;
    v.contact_person.phone = document.getElementById('evp-phone').value.trim();
    v.system_parts = selectedEditSystemParts;
  }

  const reset = lockBtn($(this));
  if (!reset) return;

  const res = await fetch('/api/supabase?action=upsertVendor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: v })
  });
  const result = await res.json();
  if (result.error) { showNotification(result.error, 'error');reset(); return; }
  showNotification('Vendor Updated!', 'success');
  reset();

  document.getElementById('editVendorPanel').classList.remove('open');
  editingVendorId = null;
  selectedEditSystemParts = [];
  updateEditSystemPartsLabel();

  if (document.getElementById('page-vendors').classList.contains('active')) loadVendors();
});

async function deleteVendorRow(id) {
  const confirmed = await showConfirm(
    'Remove vendor?',
    'This will permanently remove this vendor from your directory. This action cannot be undone.',
    'Remove'
  );
  if (!confirmed) return;
  
  const response = await fetch('/api/supabase?action=deleteVendor',{
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id:id })
  });

  const result = await response.json();
  if (result.error){showNotification(result.error, 'error');return;}
  showNotification('Vendor deleted!', 'success');
  
}

async function loadConfigurations() {
  const ffRes = await fetch('/api/supabase?action=getFormFields');
  const ffResult = await ffRes.json();
  if (!ffResult.error) cachedFormFields = ffResult.data;
  
  renderConfigList('area', 'cfg-area-list', 'cfg-area-input');
  renderConfigList('system_parts', 'cfg-syspart-list', 'cfg-syspart-input');
  renderConfigList('vendor_feedback', 'cfg-feedback-list', 'cfg-feedback-input');
}
function renderConfigList(key, listId, inputId) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  (cachedFormFields[key] || []).forEach(val => {
    const div = document.createElement('div');
    div.className = 'config-item';
    div.innerHTML = (key == 'vendor_feedback') ? '<span>' + val + '</span>' : '<span>' + val + '</span><button data-key="' + key + '" data-val="' + val + '" aria-label="Remove">×</button>';
    list.appendChild(div);
  });
}
document.querySelectorAll('.config-add-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.cfg;
    const inputId = key === 'area' ? 'cfg-area-input' : key === 'system_parts' ? 'cfg-syspart-input' : 'cfg-feedback-input';
    const listId = key === 'area' ? 'cfg-area-list' : key === 'system_parts' ? 'cfg-syspart-list' : 'cfg-feedback-list';
    const input = document.getElementById(inputId);
    const val = input.value.trim();
    if (!val) return;
    if (!cachedFormFields[key]) cachedFormFields[key] = [];
    cachedFormFields[key].push(val);
    input.value = '';
    
    const reset = lockBtn($(this));
    if (!reset) return;

    let action = null;
    if (key == 'area') action = 'updateAreaFormFields'
    if (key == 'system_parts') action = 'updateSystemPartsFormFields';
    
    const res = await fetch("/api/supabase?action="+action, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cachedFormFields.id, fields: cachedFormFields[key]})
    });

    const result = await res.json();
    if (result.error){showNotification(result.error, 'error');reset(); return;}
    reset();
    renderConfigList(key, listId, inputId);
  });
});

document.addEventListener('click', async e => {
  if (e.target.matches('.config-item button')) {
    const key = e.target.dataset.key;
    const val = e.target.dataset.val;
    cachedFormFields[key] = cachedFormFields[key].filter(v => v !== val);
    const listId = key === 'area' ? 'cfg-area-list' : key === 'system_parts' ? 'cfg-syspart-list' : 'cfg-feedback-list';
    
    renderConfigList(key, listId, '');
  }
});

document.addEventListener('click', async e => {
  if (e.target.matches('.config-item button')) {
    const key = e.target.dataset.key;
    const val = e.target.dataset.val;

    const confirmed = await showConfirm(
      'Remove config?',
      'This will permanently remove the config value from your workspace. This action cannot be undone.',
      'Remove'
    );
    if (!confirmed) return;

    cachedFormFields[key] = cachedFormFields[key].filter(v => v !== val);
    const listId = key === 'area' ? 'cfg-area-list' : key === 'system_parts' ? 'cfg-syspart-list' : 'cfg-feedback-list';

    let action = null;
    if (key == 'area') action = 'updateAreaFormFields'
    if (key == 'system_parts') action = 'updateSystemPartsFormFields';
   
    const res = await fetch("/api/supabase?action="+action, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cachedFormFields.id, fields: cachedFormFields[key]})
    });

    const result = await res.json();
    if (result.error){showNotification(result.error, 'error'); return;}
    renderConfigList(key, listId, '');
  }
});
document.querySelectorAll('.htab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.htab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('htab-' + tab.dataset.htab).classList.add('active');
  });
});
document.getElementById('open-vendor-panel-btn').addEventListener('click', () => { populateSystemPartsSelect();document.getElementById('vendorPanel').classList.add('open'); });
document.getElementById('close-vendor-panel-btn').addEventListener('click', () => { document.getElementById('vendorPanel').classList.remove('open');});
document.getElementById('vp-submit-btn').addEventListener('click', () => {
  const company = document.getElementById('vp-company').value.trim();
  const contact = document.getElementById('vp-contact').value.trim();
  const email = document.getElementById('vp-email').value.trim();
  if (!company || !contact || !email) { showNotification('Company name, contact name, and email are required.', 'error'); return; }
  MOCK.vendors.push({ id: MOCK.vendors.length + 1, company, desc: document.getElementById('vp-description').value.trim(), hq: document.getElementById('vp-hq').value.trim(), contact, email, phone: document.getElementById('vp-phone').value.trim(), verified: 'No' });
  document.getElementById('vendorPanel').classList.remove('open');
  ['vp-company','vp-description','vp-hq','vp-contact','vp-email','vp-phone'].forEach(id => document.getElementById(id).value = '');

  const systemParts = selectedSystemParts;
  const payload = {
      name: company, 
      description: document.getElementById('vp-description').value.trim(), 
      hq_location: document.getElementById('vp-hq').value.trim(), 
      contact_person: {
          name: contact,
          email: email,
          phone: document.getElementById('vp-phone').value.trim()
      },
      system_parts: systemParts
  };

  const reset = lockBtn($(this));
  if (!reset) return;
  fetch('/api/supabase?action=getVendorByName&vendorName=' + encodeURIComponent(payload.name))
  .then(res => res.json())
  .then(result => {
    if (result.error) {
      showNotification(result.error, 'error');
      return;
    }

    if (result.data === null) {
      return fetch('/api/supabase?action=addVendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload:payload })
      })
        .then(res => res.json())
        .then(updateResult => {
          if (updateResult.error) {
            showNotification(updateResult.error, 'error');
            return;
          }
          showNotification('Vendor Added!', 'success');
        });
    }else{
      showNotification('A vendor with the same name already exists.', 'error');
      return;
    }
  })
  .catch(err => {
    console.error('Request failed:', err);
    showNotification('Something went wrong.', 'error');
  });

  reset();
  if (document.getElementById('page-vendors').classList.contains('active')) loadVendors();
  document.getElementById('nav-vendor-count').textContent = MOCK.vendors.length;
  
});
document.getElementById('close-edit-modal').addEventListener('click', () => { document.getElementById('edit-vendor-modal').classList.remove('open'); });
document.getElementById('edit-vendor-modal').addEventListener('click', e => { if (e.target === document.getElementById('edit-vendor-modal')) document.getElementById('edit-vendor-modal').classList.remove('open'); });
let wizardStep = 1;
let uploadedFile = null;
let fileContents = {};
let errorList = {};
let uploadedFileName = null;
function openWizard() { wizardStep = 1; uploadedFileName = null; uploadedFile = null; fileContents = {}; errorList = {}; renderWizardStep(); document.getElementById('wizard-modal').classList.add('open'); }
document.getElementById('close-wizard-btn').addEventListener('click', () => { document.getElementById('wizard-modal').classList.remove('open'); });
document.getElementById('wizard-modal').addEventListener('click', e => { if (e.target === document.getElementById('wizard-modal')) document.getElementById('wizard-modal').classList.remove('open'); });
async function renderWizardStep() {
  document.querySelectorAll('.wizard-step').forEach((s, i) => { s.classList.toggle('active', i < wizardStep); });
  document.getElementById('wizard-step-label').textContent = 'Step ' + wizardStep;
  document.getElementById('wizard-back-btn').textContent = wizardStep === 1 ? 'Cancel' : 'Back';
  document.getElementById('wizard-next-btn').textContent = wizardStep === 3 ? 'Finish' : 'Next';
  document.getElementById('wizard-next-btn').disabled = wizardStep === 1;
  if (wizardStep === 1) {
    document.getElementById('wizard-title').textContent = 'File upload requirements';
    document.getElementById('wizard-desc').innerHTML = 'Use the template below, then upload your Excel file.<br><small style="color:var(--muted)">Only .xlsx / .xls files are accepted.</small>';
    document.getElementById('wizard-body').innerHTML = '<div class="file-upload-box"><p style="font-size:13px;color:var(--muted)">Required columns (case-sensitive):<br><strong>area | requirement | priority | system_part</strong></p><a href="../resources/template.xlsx" download class="upload-label" style="display:inline-block;text-decoration:none;margin-right:8px">Download template</a><label class="upload-label">Choose file<input type="file" id="wizard-file-input" accept=".xlsx,.xls" hidden></label><div id="wizard-file-name" style="margin-top:10px;font-size:12px;color:var(--muted)">No file selected</div></div>';
    document.getElementById('wizard-file-input').addEventListener('change', function() { 
      uploadedFile = this.files[0]; 
      if (uploadedFile){
        uploadedFileName = this.files[0]?.name;
        const validHeaders = ['area', 'requirement', 'priority', 'system_part'];

        let hasError = false;
        errorList['headings'] = [];
        const reader = new FileReader();
        reader.onload = async function (e) {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          fileContents = json;
          let i = 0;
         
          validHeaders.forEach(header => {
              if (json[0][`${header}`] === undefined){
                  hasError = true;
                  errorList['headings'].push(header);
              }
              i++;
          });

          // if (!hasError){
          //     updateChecklist('headings', true);
          // }

          if (!hasError){
              // const res = await fetch("/api/supabase?action=insertDraftRequirement", {
              //     method: "POST",
              //     headers: { "Content-Type": "application/json" },
              //     body: JSON.stringify({ filename: file.name, requirements: {requirements: json}})
              // });

              // const result = await res.json();
              // if (result.error){
              //     console.error('Error:', result.error);
              //     App.swal.fire({
              //         title: "Error",
              //         text: App.REQUEST_NOT_PROCESSED,
              //     });
              //     return;
              // }
              
              //location.href = `../requirements/draft.html?id=${result.data.id}`; 
          }
      };

      reader.readAsArrayBuffer(uploadedFile);
      }

      document.getElementById('wizard-file-name').textContent = uploadedFile ? uploadedFile.name : 'No file selected'; document.getElementById('wizard-next-btn').disabled = !uploadedFile; });
  }
  if (wizardStep === 2) {
    document.getElementById('wizard-title').textContent = 'Requirements validation';
    document.getElementById('wizard-desc').textContent = 'Running checks on your uploaded file…';
    document.getElementById('wizard-next-btn').disabled = true;
    document.getElementById('wizard-body').innerHTML = '<div class="checklist-item" id="chk-headings"><span>File headers</span><span id="headings-error"></span><span id="chk-headings-status">⏳</span></div><div class="checklist-item" id="chk-area"><span>Area listing</span><span id="area-error"></span><span id="chk-area-status">⏳</span></div><div class="checklist-item" id="chk-priority"><span>Priority listing</span><span id="priority-error"></span><span id="chk-priority-status">⏳</span></div><div class="checklist-item" id="chk-system"><span>System part listing</span><span id="system-error"></span><span id="chk-system-status">⏳</span></div>';
    
    const response = await fetch(`/api/supabase?action=getFormFields`);
    const result = await response.json();

    if (result.error) {
        showNotification(result.error, 'error');
        return;
    }

    let error = false;
    errorList['area'] = [];
    errorList['priority'] = [];
    errorList['system'] = [];

    for (var requirement of fileContents){
        if (!requirement.area || !result.data.area.includes(requirement.area)){
            errorList['area'].push(requirement.area);
            error = true;
        }
    }

    for (var requirement of fileContents){
        if (!requirement.priority || !priorityList.includes(requirement.priority)){
            errorList['priority'].push(requirement.priority);
            error = true;
        }
    }

    for (var requirement of fileContents){
        if (!requirement.system_part || !result.data.system_parts.includes(requirement.system_part)){
            errorList['system'].push(requirement.system_part);
            error = true;
        }
    }
    
    fileUploadErrors(errorList);
    if (error) return;

    document.getElementById('wizard-next-btn').disabled = false;

    //setTimeout(() => { ['headings','area','priority','system'].forEach(k => { document.getElementById('chk-' + k + '-status').textContent = '✅'; }); document.getElementById('wizard-next-btn').disabled = false; }, 900);
  }
  if (wizardStep === 3) {
    document.getElementById('wizard-title').textContent = 'Requirement details';
    document.getElementById('wizard-desc').textContent = 'Enter the company and contact details below.';
    document.getElementById('wizard-body').innerHTML = '<div class="wizard-form"><div class="form-group"><label>Title*</label><input type="text" id="wz-title" placeholder="Requirement title"></div><div class="two-form-cols"><div class="form-group"><label>Company name</label><input type="text" id="wz-company" placeholder="Company name"></div><div class="form-group"><label>Country</label><select id="wz-country" name="country" style="width:50%"><option value="">Select a country</option></select></div></div><div class="two-form-cols"><div class="form-group"><label>Contact name</label><input type="text" id="wz-contact" placeholder="Full name"></div><div class="form-group"><label>Email address</label><input type="email" id="wz-email" placeholder="Email"></div></div></div>';
  
    let options = countryList.map(country => 
        `<option value="${country}">${country}</option>`
    ).join('');

    $('#wz-country').append(options);
  }
}

function updateChecklist(type, isValid) {
    const item = $(`#chk-${type}-status`);
    
    if(isValid) {
        item.text('✅').css('color', 'green');
    } else {
        item.text('❌').css('color', 'red');
    }
}

function fileUploadErrors(errorList){
    for (const type in errorList){
        if (errorList[type].length > 0) {
            errorList[type] = [...new Set(errorList[type])];
            $(`#${type}-error`).text(' Invalid - [' + errorList[type].join(', ') + ']').css({'color':'red', 'font-size':'11px'});
            updateChecklist(type, false);
        }else{
            updateChecklist(type, true);
        }
    }
}

document.getElementById('wizard-next-btn').addEventListener('click', async () => {
  if (wizardStep < 3) { wizardStep++; renderWizardStep(); return; }

  const title = document.getElementById('wz-title').value.trim();
  const company = document.getElementById('wz-company').value.trim();
  const contact = document.getElementById('wz-contact').value.trim();
  const email = document.getElementById('wz-email').value.trim();
  const country = document.getElementById('wz-country').value.trim();
  if (!title) { showNotification('Title is required.', 'error'); return; }
  MOCK.drafts.push({ company, title, contact, email, phone:'', country });

  const client = {
      company: company,
      name: contact,
      country: country,
      email: email,
  };

  const reset = lockBtn($('#wizard-next-btn'));
  if (!reset) return;

  const res = await fetch("/api/supabase?action=insertDraftRequirement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: uploadedFileName, requirement: {requirements: fileContents, client: client, title: title}})
  });

  const result = await res.json();
  if (result.error){showNotification(result.error, 'error');reset();return;}

  reset();
  showNotification('Requirements uploaded!', 'success');

  document.getElementById('wizard-modal').classList.remove('open');
  document.getElementById('stat-draft-req').textContent = MOCK.drafts.length;
  document.getElementById('nav-draft-count').textContent = MOCK.drafts.length;
  window.navigateTo('requirements');
});
document.getElementById('wizard-back-btn').addEventListener('click', () => {
  if (wizardStep === 1) { document.getElementById('wizard-modal').classList.remove('open'); return; }
  wizardStep--;
  renderWizardStep();
});

/* ══ ACTIVE REQUIREMENTS SUMMARY ══ */
let activeSummaryData = [];
let selectedReqId = null;
let cachedFormFields = null;

const MUST_HAVE = 'Must-Have';
const COULD_HAVE = 'Could-Have';
const SHOULD_HAVE = 'Should-Have';
const mustHaveMultiplier = 1.5;
const couldHaveMultiplier = 1;
const shouldHaveMultiplier = 1.25;

async function loadActiveSummary() {
  
  document.getElementById('req-tab-content').innerHTML = '<div style="padding:40px;display:flex;justify-content:center"><div style="width:22px;height:22px;border-radius:50%;border:2.5px solid var(--b2);border-top-color:var(--o);animation:spin .7s linear infinite"></div></div>';
  try {
    const response = await fetch('/api/supabase?action=getActiveRequirements');
    const result = await response.json();
    if (result.error) { console.error(result.error); return; }
    activeSummaryData = result.data;

    // Also pre-load form fields (system_parts needed for tabs)
    const ffRes = await fetch('/api/supabase?action=getFormFields');
    const ffResult = await ffRes.json();
    if (!ffResult.error) cachedFormFields = ffResult.data;

    renderReqSidebar();
    if (activeSummaryData.length > 0) selectReq(activeSummaryData[0].id);
  } catch (err) {
    console.error('Failed to load active summary:', err);
  }
}

function renderReqSidebar() {
  const sidebar = document.getElementById('req-sidebar-list');
  sidebar.innerHTML = '';
  activeSummaryData.forEach(req => {
    const item = document.createElement('div');
    item.className = 'req-sidebar-item' + (selectedReqId === req.id ? ' active' : '');
    item.textContent = req.title;
    item.addEventListener('click', () => selectReq(req.id));
    sidebar.appendChild(item);
  });
}

function selectReq(id) {
  selectedReqId = id;
  renderReqSidebar();
  const req = activeSummaryData.find(r => r.id === id);
  if (!req) return;
  renderReqTabs(req);
}

function renderReqTabs(req) {
  const tabsEl = document.getElementById('req-tabs');
  const contentEl = document.getElementById('req-tab-content');
  tabsEl.innerHTML = '';
  contentEl.innerHTML = '';

  const systemParts = (cachedFormFields && cachedFormFields.system_parts) ? cachedFormFields.system_parts : [];
  const vendors = req.assigned_vendors || [];
  const hasVendors = vendors.length > 0;

  // Build tab list: All Areas + each system part + Response Count + Match Scores (if vendors)
  const tabs = [{ key: 'all', label: 'All Areas' }];
  systemParts.forEach(p => tabs.push({ key: p, label: p }));
  if (hasVendors) {
    tabs.push({ key: 'response-count', label: 'Response Count' });
    tabs.push({ key: 'match-scores',   label: 'Match Scores'   });
  }

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'req-tab' + (i === 0 ? ' active' : '');
    btn.textContent = tab.label;
    btn.dataset.tabKey = tab.key;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.req-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tab.key === 'all')             renderReqTable(req, null);
      else if (tab.key === 'response-count') renderResponseCount(req);
      else if (tab.key === 'match-scores')   renderMatchScores(req);
      else                               renderReqTable(req, tab.key);
    });
    tabsEl.appendChild(btn);
  });

  // Render first tab (All Areas)
  renderReqTable(req, null);
}

/* ── RESPONSE COUNT ── */
function vendorResponsesByPriority(vendors, requirements, type) {
  const responses = {};
  vendors.forEach(vendor => {
    const feedback = vendor.feedback || [];
    feedback.forEach((fb, index) => {
      if (!requirements[index]) return;
      const priority = requirements[index].priority;
      const f = fb.feedback;
      if (!responses[vendor.name]) responses[vendor.name] = {};
      if (!responses[vendor.name][f]) responses[vendor.name][f] = 0;
      if (priority === type) responses[vendor.name][f]++;
    });
  });
  return responses;
}

function renderResponseCount(req) {
  const contentEl = document.getElementById('req-tab-content');
  const vendors = req.assigned_vendors || [];
  const requirements = req.requirements || [];
  const vendorFeedbackValues = (cachedFormFields && cachedFormFields.vendor_feedback) ? cachedFormFields.vendor_feedback : [];

  const mustHaveResp   = vendorResponsesByPriority(vendors, requirements, MUST_HAVE);
  const couldHaveResp  = vendorResponsesByPriority(vendors, requirements, COULD_HAVE);
  const shouldHaveResp = vendorResponsesByPriority(vendors, requirements, SHOULD_HAVE);

  // Header: Vendor Responses | VendorA (Could/Must/Should) | VendorB ...
  let thead = '<tr><th rowspan="2" style="vertical-align:middle">Vendor Responses</th>';
  vendors.forEach(v => {
    thead += '<th colspan="3" style="text-align:center">' + v.name + '</th>';
  });
  thead += '</tr><tr>';
  vendors.forEach(() => {
    thead += '<th>' + COULD_HAVE + '</th><th>' + MUST_HAVE + '</th><th>' + SHOULD_HAVE + '</th>';
  });
  thead += '</tr>';

  let tbody = '';
  vendorFeedbackValues.forEach(fb => {
    tbody += '<tr><td>' + fb + '</td>';
    vendors.forEach(v => {
      const c = (couldHaveResp[v.name] && couldHaveResp[v.name][fb]) || 0;
      const m = (mustHaveResp[v.name]  && mustHaveResp[v.name][fb])  || 0;
      const s = (shouldHaveResp[v.name] && shouldHaveResp[v.name][fb]) || 0;
      tbody += '<td class="center"><strong>' + c + '</strong></td>'
             + '<td class="center"><strong>' + m + '</strong></td>'
             + '<td class="center"><strong>' + s + '</strong></td>';
    });
    tbody += '</tr>';
  });

  contentEl.innerHTML = '<div style="margin-bottom:10px;display:flex;justify-content:flex-end">'
    + '<button data-export-table="response-count-table" data-export-name="response_count" class="act-btn export-req-btn"><i class="fa-solid fa-download" style="font-size:11px;margin-right:5px"></i>Export</button>'
    + '</div>'
    + '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'
    + '<table id="response-count-table" class="req-table" style="min-width:600px"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'
    + '</div>';
}

/* ── MATCH SCORES ── */
function getSolutionMultipliers(vendorFeedback, vendorFormFields, scoring) {
  const multipliers = [];
  if (vendorFeedback === undefined) return multipliers;
  vendorFeedback.forEach(vendor => {
    const feedback = vendor.feedback;
    for (var i = 0; i < vendorFormFields.length; i++) {
      if (vendorFormFields[i] === feedback) {
        multipliers.push(scoring[i]);
        break;
      }
    }
  });
  return multipliers;
}

async function renderMatchScores(req) {
  const contentEl = document.getElementById('req-tab-content');
  contentEl.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;padding:40px"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#888"></i></div>';

  const vendors = req.assigned_vendors || [];
  const requirements = req.requirements || [];
  const systemParts = (cachedFormFields && cachedFormFields.system_parts) ? cachedFormFields.system_parts : [];
  const vendorFeedbackValues = (cachedFormFields && cachedFormFields.vendor_feedback) ? cachedFormFields.vendor_feedback : [];

  const scoring = solutionMultiplier;

  const allParts = ['All Areas', ...systemParts];

  let thead = '<tr><th>Area</th>';
  let vsystemParts = {};
  try {
    const results = await Promise.all(
      vendors.map(v => 
        fetch(`/api/supabase?action=getVendorById&vendorId=${v.id}`)
          .then(res => res.json())
          .then(result => {
            if (result.error) throw new Error(result.error);
            return { vendor: v, data: result.data };
          })
      )
    );

    results.forEach(({ vendor, data }) => {
      thead += '<th>' + vendor.name + '</th>';
      vsystemParts[vendor.id] = data.system_parts;
    });
  } catch (err) {
    showNotification(err.message, 'error');
    contentEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Failed to load match scores.</div>';
    return;
  }

  thead += '</tr>';

  let tbody = '';
  allParts.forEach(part => {
    tbody += '<tr><td>' + part + '</td>';
    vendors.forEach(v => {
      if (v.feedback && v.feedback.length) {
        let score = 0;
        const multipliers = getSolutionMultipliers(v.feedback, vendorFeedbackValues, scoring);

        let vReqs = requirements.filter(item => 
          vsystemParts[v.id]?.includes(item.system_part)
        );

        if (part !== 'All Areas') {
          vReqs = vReqs.filter(item => item.system_part === part);
        }

        vReqs.forEach((r, idx) => {
          score += (priorityWeighting[r.priority] || 0) * (multipliers[idx] || 0);
        });
        let pct = vReqs.length > 0 ? (score / (vReqs.length * 1.5)) * 100 : 0;
        if (isNaN(pct)) pct = 0;
        tbody += '<td class="center">' + Math.round(pct) + '%</td>';
      } else {
        tbody += '<td class="center">—</td>';
      }
    });
    tbody += '</tr>';
  });

  contentEl.innerHTML = '<div style="margin-bottom:10px;display:flex;justify-content:flex-end">'
    + '<button data-export-table="match-scores-table" data-export-name="match_scores" class="act-btn export-req-btn"><i class="fa-solid fa-download" style="font-size:11px;margin-right:5px"></i>Export</button>'
    + '</div>'
    + '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'
    + '<table id="match-scores-table" class="req-table" style="min-width:500px"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'
    + '</div>';
}

const priorityWeighting = {
  [MUST_HAVE]: 1.5,
  [COULD_HAVE]: 1,
  [SHOULD_HAVE]: 1.25
};

const solutionMultiplier = [1, 0.8, 0.6, 0.4, 0];



function summaryAreaByPriority(requirements, systemPartFilter) {
  const summary = {};
  requirements.forEach(r => {
    if (systemPartFilter && r.system_part !== systemPartFilter) return;
    if (!summary[r.area]) summary[r.area] = {};
    if (!summary[r.area][r.priority]) summary[r.area][r.priority] = 0;
    summary[r.area][r.priority]++;
  });
  return Object.fromEntries(Object.entries(summary).sort(([a], [b]) => a.localeCompare(b)));
}

function renderReqTable(req, systemPartFilter) {
  const contentEl = document.getElementById('req-tab-content');
  const requirements = req.requirements || [];
  const sortedList = summaryAreaByPriority(requirements, systemPartFilter);

  let grandC = 0, grandM = 0, grandS = 0;

  let rows = '';
  Object.entries(sortedList).forEach(([area, priorities]) => {
    const c = priorities[COULD_HAVE] || 0;
    const m = priorities[MUST_HAVE] || 0;
    const s = priorities[SHOULD_HAVE] || 0;
    const total = c + m + s;
    grandC += c; grandM += m; grandS += s;
    rows += '<tr>'
      + '<td>' + area + '</td>'
      + '<td class="center">' + (c || '') + '</td>'
      + '<td class="center">' + (m || '') + '</td>'
      + '<td class="center">' + (s || '') + '</td>'
      + '<td class="center" style="background:#f0ede8;font-weight:600">' + total + '</td>'
      + '</tr>';
  });

  const grandTotal = grandC + grandM + grandS;
  const maxC = grandC * couldHaveMultiplier;
  const maxM = grandM * mustHaveMultiplier;
  const maxS = grandS * shouldHaveMultiplier;
  const maxTotal = maxC + maxM + maxS;

  contentEl.innerHTML = '<table class="req-table">'
    + '<thead><tr>'
    + '<th>Area</th>'
    + '<th>Could-Have</th>'
    + '<th>Must-Have</th>'
    + '<th>Should-Have</th>'
    + '<th>Grand Total</th>'
    + '</tr></thead>'
    + '<tbody>'
    + rows
    + '<tr class="grand-total">'
    + '<td>Grand Total</td>'
    + '<td class="center">' + grandC + '</td>'
    + '<td class="center">' + grandM + '</td>'
    + '<td class="center">' + grandS + '</td>'
    + '<td class="center">' + grandTotal + '</td>'
    + '</tr>'
    + '<tr><td colspan="5" style="padding:4px 0;border:none;background:#fff"></td></tr>'
    + '<tr class="max-points">'
    + '<td>MAX Points - All</td>'
    + '<td class="center" title="' + grandC + ' x ' + couldHaveMultiplier + '">' + maxC + '</td>'
    + '<td class="center" title="' + grandM + ' x ' + mustHaveMultiplier + '">' + maxM.toFixed(2) + '</td>'
    + '<td class="center" title="' + grandS + ' x ' + shouldHaveMultiplier + '">' + maxS.toFixed(2) + '</td>'
    + '<td class="center">' + maxTotal + '</td>'
    + '</tr>'
    + '</tbody></table>';
}

/* ══ UPLOAD RESPONSES ══ */
let urFiles = [];

let urTitle = '';

function initUploadResponses() {
  urFiles = [];
  urTitle = '';

  document.getElementById('ur-company').value = '';
  document.getElementById('ur-contact-name').value = '';
  document.getElementById('ur-contact-email').value = '';
  document.getElementById('ur-contact-phone').value = '';

  // Reset to step 1
  document.getElementById('ur-step-title').style.display = 'block';
  document.getElementById('ur-step-files').style.display = 'none';
  document.getElementById('ur-title-input').value = '';
  document.getElementById('ur-title-error').style.display = 'none';
  document.getElementById('ur-file-list').style.display = 'none';
  document.getElementById('ur-dropzone').style.display = 'flex';

  // Step 1: Next button
  document.getElementById('ur-title-next-btn').onclick = function() {
    const val = document.getElementById('ur-title-input').value.trim();
    if (!val) {
      document.getElementById('ur-title-error').style.display = 'block';
      return;
    }
    document.getElementById('ur-title-error').style.display = 'none';
    urTitle = val;
    document.getElementById('ur-title-display').textContent = urTitle;
    document.getElementById('ur-step-title').style.display = 'none';
    document.getElementById('ur-step-files').style.display = 'block';
    setupFileStep();
  };

  // Allow Enter key on title input
  document.getElementById('ur-title-input').onkeydown = function(e) {
    if (e.key === 'Enter') document.getElementById('ur-title-next-btn').click();
  };
}

function setupFileStep() {
  const dropzone = document.getElementById('ur-dropzone');
  const input    = document.getElementById('ur-file-input');

  dropzone.onclick = (e) => {
    if (!e.target.closest('button')) input.click();
  };
  document.getElementById('ur-add-files-btn').onclick = (e) => {
    e.stopPropagation();
    input.click();
  };

  input.onchange = function() {
    addFiles(Array.from(this.files));
    this.value = '';
  };

  dropzone.ondragover = e => { e.preventDefault(); dropzone.classList.add('drag-over'); };
  dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
  dropzone.ondrop = e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files).filter(f => /\.xlsx?$/i.test(f.name)));
  };

  document.getElementById('ur-back-btn').onclick = function() {
    urFiles = [];
    document.getElementById('ur-step-files').style.display = 'none';
    document.getElementById('ur-step-title').style.display = 'block';
  };

  document.getElementById('ur-clear-btn').onclick = function() {
    urFiles = [];
    renderUrFileList();
  };

  document.getElementById('ur-upload-btn').onclick = uploadAllFiles;
}

function addFiles(newFiles) {
  newFiles.forEach(f => {
    if (!f.name.match(/\.xlsx?$/i)) return;
    // Avoid duplicates by name
    if (!urFiles.find(existing => existing.file.name === f.name)) {
      urFiles.push({ file: f, status: 'pending' });
    }
  });
  renderUrFileList();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderUrFileList() {
  const listEl   = document.getElementById('ur-file-list');
  const itemsEl  = document.getElementById('ur-file-items');
  const countEl  = document.getElementById('ur-file-count');
  const dropzone = document.getElementById('ur-dropzone');

  if (urFiles.length === 0) {
    listEl.style.display   = 'none';
    dropzone.style.display = 'flex';
    return;
  }

  dropzone.style.display = 'none';
  listEl.style.display   = 'block';
  countEl.textContent    = urFiles.length + ' file' + (urFiles.length > 1 ? 's' : '') + ' selected';

  itemsEl.innerHTML = '';
  urFiles.forEach((entry, idx) => {
    const statusHtml = entry.status === 'uploading'
      ? '<span style="color:var(--muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:11px"></i> Parsing…</span>'
      : entry.status === 'parsed'
      ? '<span style="color:var(--muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:11px"></i> Uploading…</span>'
      : entry.status === 'done'
      ? '<span style="color:#2d7a50"><i class="fa-solid fa-check" style="font-size:11px"></i> Done</span>'
      : entry.status === 'error'
      ? '<span style="color:#b91c1c" title="' + (entry.errorMsg || '') + '"><i class="fa-solid fa-xmark" style="font-size:11px"></i> ' + (entry.errorMsg || 'Error') + '</span>'
      : '<span style="color:var(--faint)">Pending</span>';

    itemsEl.innerHTML +=
      '<div class="ur-file-item" id="ur-item-' + idx + '">'
      + '<div class="ur-file-icon"><i class="fa-solid fa-file-excel"></i></div>'
      + '<div class="ur-file-name">' + entry.file.name + '</div>'
      + '<div class="ur-file-size">' + formatFileSize(entry.file.size) + '</div>'
      + '<div class="ur-file-status">' + statusHtml + '</div>'
      + (entry.status === 'pending'
          ? '<button class="ur-file-remove" data-idx="' + idx + '" title="Remove">&times;</button>'
          : '')
      + '</div>';
  });

  // Remove button handler
  itemsEl.querySelectorAll('.ur-file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      urFiles.splice(parseInt(btn.dataset.idx), 1);
      renderUrFileList();
    });
  });
}

async function parseResponseFile(file) {
  const vendorName = file.name.replace(/\.[^/.]+$/, '');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) { resolve({ vendorName, requirements: [] }); return; }

        // Validate required headers (case-insensitive)
        const requiredHeaders = ['area', 'requirement', 'priority', 'system_part', 'response', 'notes'];
        const actualHeaders = Object.keys(rows[0]).map(h => h.trim().toLowerCase());
        const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
        if (missingHeaders.length) {
          reject(new Error('Missing columns: ' + missingHeaders.join(', ')));
          return;
        }

        const normaliseRow = row => {
          const out = {};
          Object.keys(row).forEach(k => { out[k.trim().toLowerCase()] = (row[k] !== undefined && row[k] !== null) ? String(row[k]) : ''; });
          return out;
        };
        const normalisedRows = rows.map(normaliseRow);

        const requirements = normalisedRows
          .filter(row => row['area']) 
          .map(row => ({
            area:        row['area']        || '',
            requirement: row['requirement'] || '',
            priority:    row['priority']    || '',
            system_part: row['system_part'] || '',
            feedback:    row['response']    || '',
            notes:       row['notes']       || ''
          }));

        resolve({ vendorName, requirements });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function uploadAllFiles() {
  const pending = urFiles.filter(e => e.status === 'pending');
  if (pending.length === 0) return;

  // Step 1: Parse all pending files first, marking status as we go
  for (let i = 0; i < urFiles.length; i++) {
    if (urFiles[i].status !== 'pending') continue;
    urFiles[i].status = 'uploading';
    renderUrFileList();

    try {
      const parsed = await parseResponseFile(urFiles[i].file);
      urFiles[i].parsed = parsed.requirements;  
      urFiles[i].vendor = parsed.vendorName;
      urFiles[i].status = 'parsed';
    } catch (err) {
      console.error('Parse failed:', err);
      urFiles[i].status = 'error';
      urFiles[i].errorMsg = err.message || 'Failed to parse file';
    }

    renderUrFileList();
  }

  // Step 2: Combine all successfully parsed files — one object per vendor
  const combined = [];
  urFiles.forEach(entry => {
    if (entry.status === 'parsed' && entry.parsed) {
      combined.push({ vendor: entry.vendor, responses: entry.parsed });
    }
  });

  if (!combined.length) return;

  const assignedVendors = [];
  const reqs = [];

  combined.forEach(v => {
    const feedback = v.responses.map(r => ({
      feedback: r.feedback,
      comment: r.notes
    }));

    v.responses.forEach(r => {
      const alreadyExists = reqs.some(existing =>
        existing.area === r.area &&
        existing.requirement === r.requirement &&
        existing.system_part === r.system_part
      );
      if (!alreadyExists) {
        reqs.push({
          area: r.area,
          requirement: r.requirement,
          priority: r.priority,
          system_part: r.system_part,
          recommendation: "Keep",
          comment: ""
        });
      }
    });

    assignedVendors.push({
      contact_person: {
        name: document.getElementById('ur-contact-name').value.trim(),
        email: document.getElementById('ur-contact-email').value.trim(),
        phone: document.getElementById('ur-contact-phone').value.trim()
      },
      id: "",
      name: v.vendor,
      feedback: feedback
    });
  });

  // get vendor or insert if it doesn't exists
  await Promise.all(assignedVendors.map(async function(vendor, index) {
      const res = await fetch('/api/supabase?action=upsertVendor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: { name: vendor.name } })
      });
      const result = await res.json();

      if (!result.error) { assignedVendors[index].id = result.data.id; }
  }));

  const requirement = { 
    title: urTitle,
    requirements: reqs,
    assigned_vendors: assignedVendors,
    status: 'active',
    client: {
      "company": document.getElementById('ur-company').value.trim(),
      "name": document.getElementById('ur-contact-name').value.trim(),
      "email": document.getElementById('ur-contact-email').value.trim(),
      "phone": document.getElementById('ur-contact-phone').value.trim(),
      "country": "",
      "headcount": "__",
      "timeline": "__"
    }
  };

  try {
    const res = await fetch('/api/supabase?action=uploadVendorResponse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({payload: requirement})
    });
    const result = await res.json();

    const finalStatus = result.error ? 'error' : 'done';
    const finalError  = result.error ? (result.error || 'Upload failed') : null;

    urFiles.forEach(entry => {
      if (entry.status === 'parsed') {
        entry.status = finalStatus;
        if (finalError) entry.errorMsg = finalError;
      }
    });
  } catch (err) {
    console.error('Upload failed:', err);
    urFiles.forEach(entry => {
      if (entry.status === 'parsed') {
        entry.status = 'error';
        entry.errorMsg = err.message || 'Upload failed';
      }
    });
  }

  renderUrFileList();
}

function exportReqTable(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' });
  XLSX.writeFile(wb, filename + '.xlsx');
}

document.addEventListener('click', function(e) {
  const btn = e.target.closest('.export-req-btn');
  if (!btn) return;
  exportReqTable(btn.dataset.exportTable, btn.dataset.exportName);
});

/* ══ INIT ══ */
//loadDrafts();

async function updateVendorCount() {
  try {
    const response = await fetch('/api/supabase?action=getVendors');
    const result = await response.json();
    if (result.error) { showNotification(result.error, 'error'); return; }
    MOCK.vendors = result.data;
    document.getElementById('stat-vendors').textContent = result.data.length;
    document.getElementById('nav-vendor-count').textContent = result.data.length;
  } catch (err) {
    console.error('Failed to fetch vendors:', err);
  }
}

updateVendorCount();

async function updateActiveRequirementsCount() {
  try {
    const response = await fetch('/api/supabase?action=getActiveRequirements');
    const result = await response.json();
    if (result.error) { console.error(result.error); return; }
    cachedActiveRequirements = result.data;
    document.getElementById('stat-active-req').textContent = result.data.length;
    document.getElementById('nav-active-count').textContent = result.data.length;
  } catch (err) {
    console.error('Failed to fetch active requirements:', err);
  }
}

updateActiveRequirementsCount();

async function updateDraftRequirementsCount() {
  try {
    const response = await fetch('/api/supabase?action=getAllDraftRequirement');
    const result = await response.json();
   
    if (result.error) { console.error(result.error); return; }
    
    cachedDrafts = result.data;
    document.getElementById('stat-draft-req').textContent = result.data.length;
    document.getElementById('nav-draft-count').textContent = result.data.length;
  } catch (err) {
    console.error('Failed to fetch draft requirements:', err);
  }
}

updateDraftRequirementsCount();

async function updateUsersCount() {
  try {
    const response = await fetch(`/api/supabase?action=getUsers`);
    const result = await response.json();
    if (result.error) { console.error(result.error); return; }
    
    document.getElementById('nav-user-count').textContent = result.data.length;
  } catch (err) {
    console.error('Failed to fetch users:', err);
  }
}

updateUsersCount();

async function loadHome() {
  const p = localStorage.getItem('page');
  if (p !== null) window.navigateTo(p);
  localStorage.removeItem('page');

  try {
    const response = await fetch('/api/supabase?action=getActiveRequirements');
    const result = await response.json();
    if (result.error) { console.error(result.error); return; }
    renderMainSummary(result.data);
  } catch (err) {
    console.error('Failed to fetch active requirements:', err);
  }
}

function renderMainSummary(requirements) {
  const $completion = document.getElementById('completion-list');
  const $attention  = document.getElementById('attention-list');
  $completion.innerHTML = '';
  $attention.innerHTML = '';

  let statActive = 0, statAwaiting = 0, statScoring = 0, statCompleted = 0, statAttention = 0;

  requirements.forEach(req => {
    const vendors   = req.assigned_vendors ?? [];
    const total     = vendors.length;
    const responded = vendors.filter(v => v.feedback && v.feedback.length).length;
    const allIn     = total > 0 && responded === total;
    const noneIn    = total > 0 && responded === 0;
    const isApproved = req.approved === 'Y';
    const pct       = total > 0 ? Math.round((responded / total) * 100) : 0;

    if (isApproved)                          statCompleted++;
    else if (allIn)                          statScoring++;
    else if (req.status === 'awaiting_client') statAwaiting++;
    else                                     statActive++;

    $completion.innerHTML += '<div class="completion-row"><div style="flex:1;min-width:0"><div class="completion-name">' + req.title + '</div><div class="completion-meta">' + (vendors.map(v => v.name).join(', ') || '—') + '</div></div><div class="completion-bar"><div class="completion-fill" style="width:' + pct + '%"></div></div><div class="completion-count">' + responded + ' / ' + total + '</div></div>';

    if (noneIn && !isApproved) {
      statAttention++;
      $attention.innerHTML += attentionRow('red', req.title + ' — no vendors have responded', total + ' vendor' + (total > 1 ? 's' : '') + ' assigned');
    } else if (allIn && !isApproved) {
      $attention.innerHTML += attentionRow('blue', req.title + ' — ready to score', 'All responses in');
    } else if (!allIn && !noneIn && !isApproved) {
      statAttention++;
      $attention.innerHTML += attentionRow('amber', req.title + ' — ' + (total - responded) + ' vendor' + ((total - responded) > 1 ? 's' : '') + ' pending', responded + ' of ' + total + ' responded');
    }
  });

  if ($attention.innerHTML === '') {
    $attention.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:12px 0">All requirements are on track.</p>';
  }

  document.getElementById('pipe-client').textContent    = statActive;
  document.getElementById('pipe-awaiting').textContent  = statAwaiting;
  document.getElementById('pipe-scoring').textContent   = statScoring;
  document.getElementById('pipe-completed').textContent = statCompleted;
  document.getElementById('pipe-attention').textContent = statAttention;

  if (statAttention > 0) {
    document.getElementById('home-alert').style.display = 'flex';
    document.getElementById('home-alert-text').textContent = statAttention + ' requirement' + (statAttention > 1 ? 's' : '') + ' need attention — review vendor responses.';
  } else {
    document.getElementById('home-alert').style.display = 'none';
  }
}

let usersTable = null;
let editingUserId = null;

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px 14px"><div style="display:inline-block;width:20px;height:20px;border-radius:50%;border:2px solid var(--b2);border-top-color:var(--o);animation:spin .7s linear infinite"></div></td></tr>';
   const response = await fetch(`/api/supabase?action=getUsers`);
    const result = await response.json();
    if (result.error) { console.error(result.error); return; }

  tbody.innerHTML = '';
  result.data.forEach(u => {
    const roleBadge = u.role === 'Admin' ? 'b-green' : u.role === 'Editor' ? 'b-blue' : 'b-gray';
    const status = u.active === true ? 'Active' : 'In-active';
    const tr = document.createElement('tr');
    tr.innerHTML = ''
      + '<td class="cell-primary">' + u.first_name + '</td>'
       + '<td class="cell-primary">' + u.last_name + '</td>'
      + '<td>' + u.email + '</td>'
      + '<td><span class="badge">' + u.role + '</span></td>'
      + '<td><span class="badge">' + status + '</span></td>'
      + '<td style="text-align:right;white-space:nowrap">'
      +   '<button class="act-btn" onclick="openUserModal(\'' + btoa(JSON.stringify(u)) + '\')">Edit</button> '
      +   '<button class="act-btn" onclick="removeUser(\'' + u.id + '\')" style="color:#E24B4A">Remove</button>'
      +   '<div class="row-menu-wrap">'
      +     '<button class="row-menu-btn" onclick="toggleRowMenu(event, \'' + u.id + '\')"><i class="fa-solid fa-ellipsis-vertical"></i></button>'
      +     '<div class="row-menu-dropdown" id="row-menu-' + u.id + '">'
      +       '<button class="row-menu-item" onclick="emailPasswordReset(\'' + u.email + '\')">Email Password Reset Link</button>'
      +       '<button class="row-menu-item" onclick="copyPasswordLink(\'' + u.id + '\')">Copy Password Reset Link</button>'
      +     '</div>'
      +   '</div>'
      + '</td>';
    tbody.appendChild(tr);
  });
  if (usersTable) { usersTable.destroy(); }
  usersTable = $('#users-table').DataTable({ responsive:true, pageLength:10 });
  document.getElementById('nav-user-count').textContent = result.data.length;
}

function openUserModal(user) {
  //editingUserId = id || null;
  if (user != null){
    user = atob(user);
    user = JSON.parse(user);

    user.active = (user.active) ? 'yes' : 'no';
  }
  
  document.getElementById('user-email').disabled = user !== null;
  document.getElementById('user-panel-title').textContent = user !== null ? 'Edit user' : 'Add user';
  document.getElementById('first-name').value = user ? user.first_name : '';
  document.getElementById('last-name').value = user ? user.last_name : '';
  document.getElementById('user-email').value = user ? user.email : '';
  document.getElementById('user-role').value = user ? user.role : 'Editor';
  document.getElementById('user-status').value = user ? user.active : 'Suspended';
  document.getElementById('userPanel').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userPanel').classList.remove('open');
  editingUserId = null;
}

async function saveUser() {
  const fname = document.getElementById('first-name').value.trim();
  const lname = document.getElementById('last-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const role = document.getElementById('user-role').value;
  const status = document.getElementById('user-status').value;
  if (!fname || !email || !lname || !role || !status) { showNotification('All fields are required.', 'error'); return; }

  const reset = lockBtn($('#save-user-btn'));
  if (!reset) return;

  const res = await fetch('/api/supabase?action=upsertUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { 
        first_name: fname,
        last_name: lname,
        email: email,
        role: role,
        active: status 
      } })
  });
  const result = await res.json();
  if (result.error){showNotification(result.error, 'error');reset();return;}
  reset();
  closeUserModal();
  loadUsers();
}

async function removeUser(id) {
  const confirmed = await showConfirm(
    'Remove user?',
    'This will permanently remove the user from your workspace. This action cannot be undone.',
    'Remove'
  );
  if (!confirmed) return;
  
  const res = await fetch('/api/supabase?action=deleteUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id})
  });
  const result = await res.json();
  if (result.error){showNotification(result.error, 'error');return;}
  loadUsers();
}

async function emailPasswordReset(email){
  const res = await fetch('/api/send-email?action=resetPasswordLink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, host: `${window.location.origin}/v2/reset_password.html`})
  });
  const result = await res.json();
  if (result.error){showNotification(result.error, 'error');return;}

  showNotification('Email sent!', 'success');
}

function showConfirm(title, message, confirmLabel = 'Remove', icon = null) {
  return new Promise(resolve => {
    const modal      = document.getElementById('confirm-modal');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn  = document.getElementById('confirm-modal-cancel');
    const modalIcon = document.getElementById('confirm-modal-icon');
   
    if (icon != null){
      document.getElementById('confirm-modal-icon').innerHTML   = icon;
    }else{
      document.getElementById('confirm-modal-icon').innerHTML   = '<i class="fa-solid fa-trash-can" style="color:#E24B4A;font-size:18px"></i>';
    }

    document.getElementById('confirm-modal-title').textContent   = title;
    document.getElementById('confirm-modal-message').textContent = message;
    confirmBtn.textContent = confirmLabel;

    modal.classList.add('open');

    function cleanup(result) {
      modal.classList.remove('open');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel()  { cleanup(false); }
    function onOverlay(e) { if (e.target === modal) cleanup(false); }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onOverlay);
  });
}

document.getElementById('open-user-modal-btn').addEventListener('click', () => openUserModal(null));
document.getElementById('cancel-user-modal').addEventListener('click', closeUserModal);
document.getElementById('save-user-btn').addEventListener('click', saveUser);

function toggleRowMenu(e, id) {
  e.stopPropagation();
  const menu = document.getElementById('row-menu-' + id);
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.row-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (isOpen) return;

  const btnRect = e.currentTarget.getBoundingClientRect();
  menu.style.top = (btnRect.bottom + 4) + 'px';
  menu.style.left = 'auto';
  menu.style.right = (window.innerWidth - btnRect.right) + 'px';
  menu.classList.add('open');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.row-menu-dropdown.open').forEach(m => m.classList.remove('open'));
});

function copyPasswordLink(id) {
  navigator.clipboard.writeText(`${window.location.origin}/v2/reset-password.html?id=${id}`);
  showNotification('Password reset link copied.', 'success');
}

window.copyPasswordLink = copyPasswordLink;
window.emailPasswordReset = emailPasswordReset;
window.navigateTo = navigateTo;
window.openWizard = openWizard;
window.openClientEditModal = openClientEditModal;
window.closeClientEditModal = closeClientEditModal;
window.saveClientEdit = saveClientEdit;
window.openAddReqModal  = openAddReqModal;
window.closeAddReqModal = closeAddReqModal;
window.saveNewReq       = saveNewReq;
window.openUserModal = openUserModal;
window.removeUser = removeUser;
window.toggleRowMenu = toggleRowMenu;
window.editDraftReq = editDraftReq;
window.closeReqEditPanel = closeReqEditPanel;
window.removeDraftReq = removeDraftReq;
window.sendToClient = sendToClient;
window.openVendorInvitePanel = openVendorInvitePanel;
window.openVendorDetail  = openVendorDetail ;
window.selectVendorDetail = selectVendorDetail;
window.editVendorRow = editVendorRow;
window.deleteVendorRow = deleteVendorRow;
window.assignVendors = assignVendors;

loadHome();