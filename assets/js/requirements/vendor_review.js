import * as App from "../app.js";

let requirementsData = null;
let commentTypingTimers = {};
window.vendor_id = null;
window.data = null;
window.req_id = null;
window.vendor = null;

const FEEDBACK_OPTIONS = [
    'Fully meets the requirement via core platform',
    'Meets the requirement via core platform, minor gaps',
    'Meets the requirement with workarounds / use of an additional 3rd-party application',
    'Partially meets the requirement, substantial gaps',
    'Fails to meet the requirement, or unable to provide',
];

const COMMENT_REQUIRED_FEEDBACK = [
    'Meets the requirement with workarounds / use of an additional 3rd-party application',
    'Meets the requirement via core platform, minor gaps',
];

function checkRowWarning(pos) {
    const feedback = $('.form-field[data-type="feedback"][data-pos="' + pos + '"]').val();
    const comment  = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val().trim();
    const $row     = $('#requirementsTable tr').filter(function() {
        return $(this).find('.form-field[data-pos="' + pos + '"]').length > 0;
    });

    const needsWarning = COMMENT_REQUIRED_FEEDBACK.includes(feedback) && comment === '';
    $row.toggleClass('warning', needsWarning);
    if (needsWarning){
        $('i[data-type="comment-icon"][data-pos="' + pos + '"]').removeClass('hide');
    }else{
        $('i[data-type="comment-icon"][data-pos="' + pos + '"]').addClass('hide');
    } 
}

const PRICING_DEFAULT_ROWS = 4;
const PRICING_SECTIONS = ['core_licence', 'additional_modules', 'implementation', 'integrations', 'other_costs'];

const PRICING_SEEDS = {
    integrations: [],
};
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

function pricingTable(section) {
    return $('.pr-table[data-section="' + section + '"]');
}

function pricingYears($table) {
    return $table.find('thead th[data-year]')
        .map(function () { return $(this).attr('data-year'); })
        .get();
}

function toAmount(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildPricingRow(years, row = {}, seed = null) {
    const $tr = $('<tr class="pr-row"></tr>');
    if (seed && row.description === undefined) row = Object.assign({}, row, { description: seed });

    $tr.append($('<td></td>').append(
        $('<input type="text" class="pr-input" data-field="item" placeholder="Element name" aria-label="Element">')
            .val(row.item ?? '')
    ));

    $tr.append($('<td></td>').append(
        $('<textarea class="pr-input" data-field="description" rows="2" placeholder="Volumes, fair usage, restrictions…" aria-label="Description"></textarea>')
            .val(row.description ?? '')
            .attr('data-seed', seed ?? null)
    ));

    years.forEach(function (year) {
        const saved = row.costs ? row.costs[year] : null;
        const $input = $('<input type="number" class="pr-input" data-field="cost" min="0" step="0.01" inputmode="decimal" placeholder="0.00">')
            .attr({ 'data-year': year, 'aria-label': 'Cost ' + year })
            .val(saved === null || saved === undefined || saved === '' ? '' : saved);

        $tr.append($('<td></td>').append(
            $('<div class="pr-affix"><span class="pr-pre">£</span></div>').append($input)
        ));
    });

    // Row total (calculated)
    $tr.append('<td class="pr-row-total">' + GBP.format(0) + '</td>');

    // VAT?
    const $vat = $(
        '<select class="pr-input" data-field="vat" aria-label="VAT applicable">' +
            '<option value="">Select</option>' +
            '<option value="Yes">Yes</option>' +
            '<option value="No">No</option>' +
        '</select>'
    );
    $vat.val(row.vat === 'Yes' || row.vat === 'No' ? row.vat : '');
    $tr.append($('<td></td>').append($vat));

    // VAT rate
    const $rate = $('<input type="number" class="pr-input" data-field="vat_rate" min="0" max="100" step="0.01" inputmode="decimal" placeholder="0" aria-label="VAT rate">')
        .val(row.vat_rate === null || row.vat_rate === undefined ? '' : row.vat_rate)
        .prop('disabled', $vat.val() !== 'Yes');
    $tr.append($('<td></td>').append(
        $('<div class="pr-affix"></div>').append($rate).append('<span class="pr-post">%</span>')
    ));

    // Remove
    $tr.append(
        '<td class="pr-action-col">' +
            '<button type="button" class="pr-remove" title="Remove line" aria-label="Remove line">' +
                '<i class="fa-solid fa-trash-can"></i>' +
            '</button>' +
        '</td>'
    );

    return $tr;
}

function recalcPricing($table) {
    const years  = pricingYears($table);
    const totals = {};
    years.forEach(function (y) { totals[y] = 0; });
    let grand = 0;

    $table.find('tbody.pr-rows tr.pr-row').each(function () {
        let rowTotal = 0;
        $(this).find('input[data-field="cost"]').each(function () {
            const amount = toAmount($(this).val());
            totals[$(this).attr('data-year')] += amount;
            rowTotal += amount;
        });
        grand += rowTotal;
        $(this).find('.pr-row-total').text(GBP.format(round2(rowTotal)));
    });

    years.forEach(function (y) {
        totals[y] = round2(totals[y]);
        $table.find('[data-sum="' + y + '"]').text(GBP.format(totals[y]));
    });
    totals.total = round2(grand);
    $table.find('[data-sum="total"]').text(GBP.format(totals.total));

    return totals;
}

function recalcAllPricing() {
    const all = {};
    let overall = 0;
    PRICING_SECTIONS.forEach(function (s) {
        all[s] = recalcPricing(pricingTable(s));
        overall += all[s].total;
    });
    all.total = round2(overall);
    return all;
}

function renderPricing(pricing) {
    const data = Array.isArray(pricing) ? { core_licence: pricing } : (pricing || {});

    PRICING_SECTIONS.forEach(function (s) {
        const $table = pricingTable(s);
        const years  = pricingYears($table);
        const $body  = $table.find('tbody.pr-rows').empty();
        const list   = Array.isArray(data[s]) ? data[s] : [];

        const seeds = PRICING_SEEDS[s] || [];

        list.forEach(function (r) {
            const seed = seeds.includes(r.description) ? r.description : null;
            $body.append(buildPricingRow(years, r, seed));
        });

        seeds.forEach(function (seed) {
            const saved = list.some(function (r) { return r.description === seed; });
            if (!saved) $body.append(buildPricingRow(years, {}, seed));
        });

        for (let i = $body.children('tr.pr-row').length; i < PRICING_DEFAULT_ROWS; i++) {
            $body.append(buildPricingRow(years));
        }

        recalcPricing($table);
    });
}

function collectPricing() {
    const pricing = {};
    const errors  = [];
    let count     = 0;

    PRICING_SECTIONS.forEach(function (s) {
        const $table = pricingTable(s);
        const label  = $table.attr('data-label') || s;
        const years  = pricingYears($table);
        const rows   = [];

        $table.find('tbody.pr-rows tr.pr-row').each(function (i) {
            const $tr    = $(this);
            const prefix = label + ', line ' + (i + 1) + ': ';

            const item        = $tr.find('[data-field="item"]').val().trim();
            const description = $tr.find('[data-field="description"]').val().trim();
            const vat         = $tr.find('[data-field="vat"]').val() || '';
            const rateRaw     = $tr.find('[data-field="vat_rate"]').val();

            const costs = {};
            let hasCost = false;
            let total   = 0;
            years.forEach(function (y) {
                const raw = $tr.find('input[data-field="cost"][data-year="' + y + '"]').val();
                if (raw === '' || raw === null || raw === undefined) {
                    costs[y] = null;
                } else {
                    const amount = round2(toAmount(raw));
                    if (amount < 0) errors.push(prefix + 'costs cannot be negative.');
                    costs[y] = amount;
                    total += amount;
                    hasCost = true;
                }
            });

            const seed        = $tr.find('[data-field="description"]').attr('data-seed') || '';
            const ownDesc     = description && description !== seed;

            const isEmpty = !item && !ownDesc && !hasCost && !vat && rateRaw === '';
            if (isEmpty) return;

            if (!item && !description) errors.push(prefix + 'please name the element or add a description.');
            if (!hasCost) errors.push(prefix + 'please enter a cost for at least one year.');
            if (vat === 'Yes' && rateRaw === '') errors.push(prefix + 'please enter a VAT rate.');

            rows.push({
                item: item,
                description: description,
                costs: costs,
                total: round2(total),
                vat: vat,
                vat_rate: vat === 'Yes' && rateRaw !== '' ? round2(toAmount(rateRaw)) : null,
            });
        });

        pricing[s] = rows;
        count += rows.length;
    });

    return { pricing: pricing, errors: errors, count: count };
}

$(function () {
    $(document).on('click', '.pr-add-row', function () {
        const $table = pricingTable($(this).attr('data-section'));
        const $row   = buildPricingRow(pricingYears($table));
        $table.find('tbody.pr-rows').append($row);
        recalcPricing($table);
        $row.find('[data-field="item"]').trigger('focus');
    });

    $(document).on('click', '.pr-rows .pr-remove', function () {
        const $table = $(this).closest('.pr-table');
        const $row   = $(this).closest('tr');

        if ($table.find('tbody.pr-rows tr.pr-row').length > 1) {
            $row.remove();
        } else {
            $row.replaceWith(buildPricingRow(pricingYears($table)));
        }
        recalcPricing($table);
    });

    $(document).on('input change', '.pr-rows input[data-field="cost"]', function () {
        recalcPricing($(this).closest('.pr-table'));
    });

    $(document).on('change', '.pr-rows select[data-field="vat"]', function () {
        const $rate = $(this).closest('tr').find('[data-field="vat_rate"]');
        const applies = $(this).val() === 'Yes';
        $rate.prop('disabled', !applies);
        if (!applies) $rate.val('');
    });
});

/* ══════════════════════════════════════════════
   REQUIREMENTS FILTERS
   ══════════════════════════════════════════════ */

$(function () {
      /* ── FILTER + SEARCH ── */
      function applyFilters() {
        const area     = $('#areaFilter').val().toLowerCase();
        const feedback = $('#feedbackFilter').val().toLowerCase();
        const keyword  = $('#searchInput').val().toLowerCase();

        let visible = 0;

        $('#requirementsTable tr').each(function () {
          const rowArea     = $(this).find('td.col-area').text().toLowerCase();
          const rowFeedback = $(this).find('td.col-feedback select').val()?.toLowerCase() ?? '';
          const rowDecision = $(this).find('td.col-decision').text().toLowerCase();
          const rowComments = $(this).find('td.col-comments textarea').val()?.toLowerCase() ?? '';

          const matchArea     = !area     || rowArea === area;
          const matchFeedback = !feedback || rowFeedback === feedback;
          const matchKeyword  = !keyword  || rowDecision.includes(keyword) || rowArea.includes(keyword) || rowComments.includes(keyword);

          const show = matchArea && matchFeedback && matchKeyword;
          $(this).toggle(show);
          if (show) visible++;
        });

        $('#emptyState').toggleClass('hide', visible > 0);
      }

      $('#areaFilter, #feedbackFilter').on('change', applyFilters);
      $('#searchInput').on('input', applyFilters);

      /* ── SELECT ALL ── */
      $('#selectAll').on('change', function () {
        const checked = $(this).is(':checked');
        $('#requirementsTable tr:visible .row-checkbox').prop('checked', checked);
        updateBulkBar();
      });

      $(document).on('change', '.row-checkbox', function () {
        const total   = $('#requirementsTable tr:visible .row-checkbox').length;
        const checked = $('#requirementsTable tr:visible .row-checkbox:checked').length;
        $('#selectAll').prop('indeterminate', checked > 0 && checked < total);
        $('#selectAll').prop('checked', checked === total && total > 0);
        updateBulkBar();
      });

      function updateBulkBar() {
        const count = $('#requirementsTable .row-checkbox:checked').length;
        if (count > 0) {
          $('#bulkCount').text(count + ' row' + (count > 1 ? 's' : '') + ' selected');
          $('#bulkBar').addClass('visible');
        } else {
          $('#bulkBar').removeClass('visible');
        }
      }

      /* ── BULK FEEDBACK ── */
      $('#bulkFeedback').on('change', function () {
        const val = $(this).val();
        if (!val) return;
        $('#requirementsTable .row-checkbox:checked').each(function () {
          $(this).closest('tr').find('td.col-feedback select').val(val);
        });
        $(this).val('');
        applyFilters();
      });

      /* ── CLEAR SELECTION ── */
      $('#bulkClear').on('click', function () {
        $('#requirementsTable .row-checkbox, #selectAll').prop('checked', false);
        $('#selectAll').prop('indeterminate', false);
        updateBulkBar();
      });

      /* ── HELPER: populate filter dropdowns (called by vendor_review.js after table loads) ── */
      window.initVendorFilters = function (areas, feedbackOptions) {
        areas.forEach(function (a) {
          $('#areaFilter').append(`<option value="${a.toLowerCase()}">${a}</option>`);
        });
        feedbackOptions.forEach(function (f) {
          $('#feedbackFilter').append(`<option value="${f.toLowerCase()}">${f}</option>`);
          $('#bulkFeedback').append(`<option value="${f}">${f}</option>`);
        });
        $('#filterBar').removeClass('hide');
        $('#mainTable').removeClass('hide');
        $('#loaderWrap').addClass('hide');
      };

    });

$(function(){
    const requirementId = App.getParam('req');
    const vendorId = App.getParam('vid') ?? null;
    const decodedRequirementId = requirementId ? decodeURIComponent(JSON.parse(atob(requirementId))) : null;
    
    $('.card').removeClass('hide');
    if (decodedRequirementId === null || vendorId === null){
        location.href = App.pages.proposal_submitted;
    } else {
        getRequirementsData(decodedRequirementId)
            .then(data => {
                requirementsData = data;

                validateVendor(vendorId);
                checkSubmission(vendorId);
                loadData(vendorId);
                getPricing(vendorId);
            })
            .catch(err => {
                console.error('Promise failed:', err);
                App.customError(App.OPERATION_FAILED);
                $('#loader').hide();
            });
    }

    $(document).on('change', '.form-field[data-type="feedback"]', function() {
        checkRowWarning($(this).data('pos'));
        autoSave();
    });

    $(document).on('input', 'textarea[data-type="comment"]', function() {
        checkRowWarning($(this).data('pos'));

        clearTimeout(commentTypingTimers[$(this).data('pos')]);
        commentTypingTimers[$(this).data('pos')] = setTimeout(function() {
            autoSave();
        }, 800);
    });

    async function autoSave(){
        let feedback = [];
        const vendorId = App.getParam('vid') ?? null;
        if (vendorId == null) return;

        await $('.form-field').each(async function() {
            const type    = $(this).data('type');
            const pos     = $(this).data('pos');
            const realPos     = $(this).data('realpos');
            const value   = $(this).val();
            const comment = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val();

            feedback.push({ feedback: value, comment: comment, pos: realPos, });
        });
        
        if (feedback.length) {
            getRequirementsData(decodedRequirementId)
                .then(data => {
                    for (const vendor of data.assigned_vendors) {
                        if (vendor.id == vendorId) {
                            vendor.feedback = vendor.feedback ?? [];
                            vendor.feedback = feedback;
                        }
                    }
                    updateFeedback(data, true);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                    $('#saveDecisions').prop('disabled', false);
                });
        }
    }

    const SUBMIT_SECTIONS = ['requirements', 'pricing'];
    
    function showSection(section) {
        $('.vr-nav-item').removeClass('active')
            .filter(`[data-section="${section}"]`).addClass('active');
        $('.vr-section').addClass('hide');
        $(`#section-${section}`).removeClass('hide');
        $('#submitBar').toggleClass('hide', !SUBMIT_SECTIONS.includes(section));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    $('.vr-nav-item').on('click', function () {
        showSection(this.dataset.section);
    });

    $('#savePricing').on('click', function(){
        const { pricing, errors, count } = collectPricing();

        if (!count) {
            App.customError('Please add at least one pricing line.');
            return;
        }
        if (errors.length) {
            App.customError(errors.join('<br>'));
            return;
        }

        const totals = recalcAllPricing();

        const reset = App.lockBtn($(this));
        if (!reset) return;

        $('#pricing-error-msg').text('Saving...').css('display', 'block');
        getRequirementsData(decodedRequirementId)
                .then(async data => {
                    for (const vendor of data.assigned_vendors) {
                        if (vendor.id == vendorId) {
                            vendor.pricing = pricing;
                            vendor.pricing_totals = totals;
                        }
                    }

                    const ok = await updateFeedback(data, true, reset);
                    if (!ok) {
                        $('#pricing-error-msg').css('display', 'none');
                        return;
                    }

                    $('#pricing-error-msg').text('Saved!');
                    setTimeout(function(){
                        $('#pricing-error-msg').css('display', 'none');
                        $('#pricing-error-msg').text('Saving...'); 
                    }, 3000);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                    $('#pricing-error-msg').css('display', 'none');
                    $('#savePricing').prop('disabled', false);
                    reset();
                });

    });

    $('#saveDecisions').on('click', async function () {
        let isError = false;
        let errors = [];
        let feedback = [];

        await $('.form-field').each(async function() {
            const type    = $(this).data('type');
            const pos     = $(this).data('pos');
            const realPos     = $(this).data('realpos');
            const value   = $(this).val();
            const comment = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val();
            
            if (type === 'feedback' && value === '') {
                errors.push('You must provide feedback to requirement number ' + (pos + 1) + '.');
            }

            if (type === 'feedback' && COMMENT_REQUIRED_FEEDBACK.includes(value) && comment === '') {
                errors.push('A comment is required on requirement number ' + (pos + 1) + '.');
            }

            feedback.push({ feedback: value, comment: comment, pos: realPos });
        });

        if (errors.length > 0) {
            App.customError(errors.join("<br>"));
            return;
        }

        $(this).prop('disabled', true);

        if (feedback.length) {
            const reset = App.lockBtn($(this));
            if (!reset) return;

            getRequirementsData(decodedRequirementId)
                .then(data => {
                    for (const vendor of data.assigned_vendors) {
                        if (vendor.id == vendorId) {
                            vendor.feedback = vendor.feedback ?? [];
                            vendor.feedback = feedback;
                            vendor.submitted = 'Y';
                        }
                    }
                    updateFeedback(data, false, reset);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                    $('#saveDecisions').prop('disabled', false);
                    reset();
                });
        }
    });


    function setNavCollapsed(collapsed) {
        $('#vrNav').toggleClass('collapsed', collapsed);
        const label = collapsed ? 'Expand menu' : 'Collapse menu';
        $('#vrNavToggle').attr({ title: label, 'aria-label': label });
        try { localStorage.setItem('vrNavCollapsed', collapsed ? '1' : '0'); } catch (e) {}
    }

    $('#vrNavToggle').on('click', () => setNavCollapsed(!$('#vrNav').hasClass('collapsed')));

    try { setNavCollapsed(localStorage.getItem('vrNavCollapsed') === '1'); } catch (e) {}
});

/** Returns true on success, false on failure. */
async function updateFeedback(requirementData, autoSave = false, reset = null){
    const response = await fetch('/api/supabase?action=updateVendorList',{
         method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: requirementData})
    });
    const result = await response.json();
    if (result.error) {
        console.error('Updating requirement data failed (updateFeedback):', result.error);
        App.customError(App.OPERATION_FAILED);

        if (reset != null) reset();
        return false;
    }

    if (!autoSave) {
        const vendorId = App.getParam('vid');
        const token = App.getParam('tk');
        const origin = window.location.origin;

        let vendorName = '';
        for (const vendor of requirementData.assigned_vendors) {
            if (vendor.id == vendorId) {
                vendorName = vendor.name;
            }
        }

        const res = await fetch('/api/send-email?action=submittedResponses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                vendorName: vendorName,
                link: `${origin}/v2`,
                clientName: requirementData.client.company,
                subject: ` [RFP Tool] ${vendorName} Has Submitted Their RFP Response- ${requirementData.client.company}`,
                token: token
            })
        });
        if (reset) reset();
        location.href = App.pages.thank_you;
    }

    if (reset != null) reset();
    return true;
}

async function validateVendor(id){
    const assigned = App.isVenderAssigned(requirementsData.assigned_vendors, id);
    if (!assigned) location.href = 'https://udder.rocks';
}

async function checkSubmission(vendorId){
    let submitted = false;
    for (const vendor of requirementsData.assigned_vendors) {
        if (vendor.id == vendorId) {
            if (vendor.submitted && vendor.submitted == 'Y'){
                submitted = true;
                break;
            }
        }
    }

    if (submitted){location.href = App.pages.submitted;return;}
}

function getPricing(vendorId){
    let saved = null;
    for (const vendor of requirementsData.assigned_vendors) {
        if (vendor.id == vendorId) {
            saved = vendor.pricing ?? null;
            break;
        }
    }
    renderPricing(saved);
}

async function getRequirementsData(id){
    const response = await fetch(`/api/supabase?action=getRequirementsById&reqId=${id}`);
    const result = await response.json();
    if (result.error) {
        console.error('Fetching requirement data failed (getRequirementsById):', result.error);
        App.customError(App.FAILED_TO_LOAD_DATA);
        return;
    }
    return result.data;
}

async function loadData(vendorId) {
    const data = requirementsData;
    let savedVendorFeedback

    $('#title').text(data.title + ' - ' + data.client.company);
    //$('#company_info').html('Head Count: ' + (data.client.headcount ?? '') + ' | Timeline: ' + (data.client.timeline ?? ''));

    const uniqueAreas = [];
    let index = 0;

    const response = await fetch(`/api/supabase?action=getVendorById&vendorId=${vendorId}`);
    const result = await response.json();
    if (result.error) {
        console.error(result.error);
        App.customError('Failed to verify vendor');
        return;
    }
    
    const systemParts = result.data.system_parts;
    data.requirements.forEach(function(key, i) {
        if (!uniqueAreas.includes(key.area)) uniqueAreas.push(key.area);
        if (!systemParts.includes(key.system_part)) return;
        
        const feedbackOptions = FEEDBACK_OPTIONS
            .map(function(opt) { return '<option>' + opt + '</option>'; })
            .join('');
        
        $('#requirementsTable').append(
            '<tr>' +
                '<td>' +
                    '<input type="checkbox" class="row-checkbox" data-index="' + index + '">' +
                '</td>' +
                '<td class="col-area">' + key.area + '</td>' +
                '<td class="col-decision">' + key.requirement + '</td>' +
                '<td>' + key.priority + '</td>' +
                '<td class="col-feedback">' +
                    '<select data-type="feedback" class="form-field" data-realpos="' + i +'" data-pos="' + index + '">' +
                        '<option value="">Select</option>' +
                        feedbackOptions +
                    '</select>' +
                '</td>' +
                '<td class="col-comments">' +
                    '<div style="display:flex;align-items:flex-start;gap:6px">' +
                        '<textarea data-type="comment" data-realpos="' + i +'" data-pos="' + index + '" placeholder="Add a comment\u2026"></textarea>' +
                        '<i data-type="comment-icon" class="fa-regular fa-note-sticky comment-note-icon hide" data-pos="' + index + '" title="A comment is required"></i>' +
                    '</div>' +
                '</td>' +
            '</tr>'
        );

        index++;
    });

    for (const vendor of data.assigned_vendors) {
        if (vendor.id == vendorId) {
            vendor.feedback = vendor.feedback ?? [];

            vendor.feedback.forEach((f, index) => {
                $('select[data-type="feedback"][data-pos="' + index + '"]').val(f.feedback);
                $('textarea[data-type="comment"][data-pos="' + index + '"]').val(f.comment);
                checkRowWarning(index);
            });
        }
    }

    if (typeof window.initVendorFilters === 'function') {
        window.initVendorFilters(uniqueAreas, FEEDBACK_OPTIONS);
    } else {
        $('#loaderWrap').addClass('hide');
        $('#mainTable').removeClass('hide');
    }
}