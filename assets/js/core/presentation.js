import { getFormFields, getRequirementsById } from "../services/supabase.js";
import * as App from "../app.js";

$(function(){
    if (!App.loggedIn){
        location.href = App.pages.login;
    }

    App.hasInternet(location.href);

    const id = App.getParam('req');
    if (id === null){
        location.href = App.pages.dashboard;
    }

    load(id);
});

async function load(reqId){
    $('#xloader').append(App.xloader());

    let allSystemParts = [];

    const {data, error} = await getFormFields();
    if (error) {
        console.error('Fetching requirement data failed (generateTabs):', error);
        App.customError(App.FAILED_TO_LOAD_DATA);
        return;
    }

    allSystemParts.push(App.ALL_IN_ONE);
    for (var part of data.system_parts){
        allSystemParts.push(part);
    }

    const requirement = await loadRequirements(reqId);
    const vendorsScorings = App.getMatchScores(allSystemParts, requirement.assigned_vendors, data.vendor_feedback, requirement.requirements, App.priorityWeighting, App.solutionMultiplier);
    console.info('s', vendorsScorings);

    App.hideElement('xloader');
    //$('#main').removeClass('hide');
}

async function loadRequirements(reqId){
    const { data, error } = await getRequirementsById(reqId);
    if (error) {
        console.error('Select failed:', error);
        App.customError(App.FAILED_TO_LOAD_DATA);
        return;
    }

    return data;
}