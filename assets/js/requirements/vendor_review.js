import { getRequirementsById, updateVendorList } from "../services/supabase.js";
import * as App from "../app.js";

let requirementsData = null;

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
}

$(function(){
    const requirementId = App.getParam('req');
    const vendorId = App.getParam('vid') ?? null;
    const decodedRequirementId = requirementId ? decodeURIComponent(JSON.parse(atob(requirementId))) : null;
    
    if (decodedRequirementId === null || vendorId === null){
        location.href = App.pages.proposal_submitted;
    } else {
        getRequirementsData(decodedRequirementId)
            .then(data => {
                requirementsData = data;
                validateVendor(vendorId);
                checkSubmission(vendorId);
                loadData();
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
    });

    $(document).on('input', 'textarea[data-type="comment"]', function() {
        checkRowWarning($(this).data('pos'));
    });

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

async function updateFeedback(requirementData){
    const { data, error } = await updateVendorList(requirementData);
    if (error) {
        console.error('Updating requirement data failed (updateFeedback):', error);
        alert('Failed to fetch data');
        return;
    }
    location.href = App.pages.thank_you;
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

async function loadData() {
    const data = requirementsData;

    $('#title').text(data.title + ' - ' + data.client.company);
    $('#company_info').html('Head Count: ' + (data.client.headcount ?? '') + ' | Timeline: ' + (data.client.timeline ?? ''));

    const uniqueAreas = [];
    let index = 0;

    data.requirements.forEach(function(key) {
        if (!uniqueAreas.includes(key.area)) uniqueAreas.push(key.area);

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
                    '<textarea data-type="comment" data-pos="' + index + '" placeholder="Add a comment\u2026"></textarea>' +
                '</td>' +
            '</tr>'
        );

        index++;
    });

    if (typeof window.initVendorFilters === 'function') {
        window.initVendorFilters(uniqueAreas, FEEDBACK_OPTIONS);
    } else {
        $('#loaderWrap').addClass('hide');
        $('#mainTable').removeClass('hide');
    }
}