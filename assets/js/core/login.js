import { auth, isUserLoggedIn } from "./auth.js";
import { error } from "../utils/sweetalert2.js";
import { PAGES } from '../utils/constants.js';

$(function(){
    loggedIn();
    
    $('#login-btn').on('click', async function() {
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !password){
            error('Username and password are required.');
            return;
        }

        const authUser = await auth(username, password);
        if (authUser) {
            location.href = PAGES.root;
        }else{
            error('Incorrect username/password.');
        }
    });
});

function loggedIn(){
    const loggedIn = isUserLoggedIn();
    if (loggedIn) location.href = PAGES.root;
}