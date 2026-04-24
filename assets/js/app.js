import { auth, isUserLoggedIn, setCookie, getCookie } from './core/auth.js';
export { auth as AuthCheck };
export { isUserLoggedIn as loggedIn };
export { setCookie as setCookie };
export { getCookie as getCookie };

import * as Helper from './utils/helper.js';
export const xloader = Helper.loader;
export const hasInternet = Helper.hasInternet;
export const getVendorFeedback = Helper.getVendorFeedback;
export const showElement = Helper.showElement;
export const hideElement = Helper.hideElement;
export const vendorHasSystemPart = Helper.vendorHasSystemPart;
export const validVendorsWithContactPerson = Helper.validVendorsWithContactPerson;
export const isVenderAssigned = Helper.isVenderAssigned;
export const getParam = Helper.getUrlParameter; 
export const skeletonMainPanel = Helper.skeletonMainPanel;
export const getSolutionMultipliers = Helper.getSolutionMultipliers;
export const getMatchScores = Helper.getMatchScores;

import * as Constants from './utils/constants.js';
export const pages = Constants.PAGES;

import { Swal, error } from "./utils/sweetalert2.js";
export const swal = Swal;
export const customError = error;

export const priorityList = [
    'Must-Have', 'Could-Have', 'Should-Have'
];

export const MUST_HAVE = 'Must-Have';
export const SHOULD_HAVE = 'Should-Have';
export const COULD_HAVE = 'Could-Have';

export const OPERATION_FAILED = 'Operation Failed. Please try again later!';
export const FAILED_TO_LOAD_DATA = 'Failed to load data. Please try again later!';

export const solutionMultiplier = [1, 0.8, 0.6, 0.4, 0];

export const mustHaveMultiplier = 1.5;
export const couldHaveMultiplier = 1;
export const shouldHaveMultiplier = 1.25;

export const priorityWeighting = {
    'Must-Have': 1.5, 
    'Could-Have': 1, 
    'Should-Have': 1.25
};

export const ALL_IN_ONE = 'All areas';

export const zapierVendorInvitationsWebhook = 'https://hooks.zapier.com/hooks/catch/25735666/uq8x4ke/'
export const COMPLETED = 'completed';