import { getRequirementsById, updateVendorList } from "../services/supabase.js";
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

// Feedback values that require a comment before submission
const COMMENT_REQUIRED_FEEDBACK = [
    'Meets the requirement with workarounds / use of an additional 3rd-party application',
    'Meets the requirement via core platform, minor gaps',
];

/**
 * Adds or removes the .warning class on a row based on whether
 * the selected feedback requires a comment and the comment is empty.
 */
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
                //checkSubmission(vendorId);
                loadData(vendorId);
            })
            .catch(err => {
                console.error('Promise failed:', err);
                App.customError(App.OPERATION_FAILED);
                $('#loader').hide();
            });
    }

    // Re-check warning whenever feedback or comment changes
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
            const value   = $(this).val();
            const comment = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val();

            feedback.push({ feedback: value, comment: comment });
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

    $('#saveDecisions').on('click', async function () {
        let isError = false;
        let errors = [];
        let feedback = [];

        await $('.form-field').each(async function() {
            const type    = $(this).data('type');
            const pos     = $(this).data('pos');
            const value   = $(this).val();
            const comment = $('textarea[data-type="comment"][data-pos="' + pos + '"]').val();
            
            if (type === 'feedback' && value === '') {
                errors.push('You must provide feedback to requirement number ' + (pos + 1) + '.');
            }

            if (type === 'feedback' && COMMENT_REQUIRED_FEEDBACK.includes(value) && comment === '') {
                errors.push('A comment is required on requirement number ' + (pos + 1) + '.');
            }

            feedback.push({ feedback: value, comment: comment });
        });

        if (errors.length > 0) {
            App.customError(errors.join("<br>"));
            return;
        }

        $(this).prop('disabled', true);

        if (feedback.length) {
            getRequirementsData(decodedRequirementId)
                .then(data => {
                    for (const vendor of data.assigned_vendors) {
                        if (vendor.id == vendorId) {
                            vendor.feedback = vendor.feedback ?? [];
                            vendor.feedback = feedback;
                        }
                    }
                    updateFeedback(data);
                })
                .catch(err => {
                    console.error('Promise failed:', err);
                    App.customError(App.OPERATION_FAILED);
                    $('#saveDecisions').prop('disabled', false);
                });
        }
    });
});

async function updateFeedback(requirementData, autoSave = false){
    const { data, error } = await updateVendorList(requirementData);
    if (error) {
        console.error('Updating requirement data failed (updateFeedback):', error);
        alert('Failed to fetch data');
        return;
    }

    if (!autoSave) location.href = App.pages.thank_you;
}

async function validateVendor(id){
    const assigned = App.isVenderAssigned(requirementsData.assigned_vendors, id);
    if (!assigned) location.href = 'https://udder.rocks';
}

async function checkSubmission(vendorId){
    const submissions = App.getVendorFeedback(requirementsData.assigned_vendors, vendorId);
    if (submissions.length) location.href = App.pages.proposal_submitted + '?id=' + vendorId;
}

async function getRequirementsData(id){
    const { data, error } = await getRequirementsById(id);
    if (error) {
        console.error('Fetching requirement data failed (getRequirementsById):', error);
        App.customError(App.FAILED_TO_LOAD_DATA);
        return;
    }
    return data;
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
    data.requirements.forEach(function(key) {
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
                    '<select data-type="feedback" class="form-field" data-pos="' + index + '">' +
                        '<option value="">Select</option>' +
                        feedbackOptions +
                    '</select>' +
                '</td>' +
                '<td class="col-comments">' +
                    '<div style="display:flex;align-items:flex-start;gap:6px">' +
                        '<textarea data-type="comment" data-pos="' + index + '" placeholder="Add a comment\u2026"></textarea>' +
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