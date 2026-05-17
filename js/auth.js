// ============================================================
// auth.js - Handles user login and logout
//
// Uses Supabase - a backend service that manages user accounts.
// This script runs on every page and updates the navbar to show
// either a "Sign in" button or the user's avatar.
// ============================================================

// --- Your Supabase project settings ---
// These are public values (the "anon" key has limited permissions - it's safe here)
var SUPABASE_URL = 'https://gqwohbqudbxahlssuohr.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxd29oYnF1ZGJ4YWhsc3N1b2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDM0OTgsImV4cCI6MjA3NjA3OTQ5OH0.KLkjEHdMM5xUpO-bLRhLGYF_x6XShzjso4Evwlxza2I';

// This variable will hold our Supabase connection.
// We set it up inside the DOMContentLoaded listener below.
var sb = null;


// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Shortcut: get an HTML element by its id
function getEl(id) {
  return document.getElementById(id);
}

// Get the first letter of the email to show in the avatar circle
// e.g. "alice@example.com" -> "A"
function getInitial(email) {
  if (!email) return '?';
  return email.charAt(0).toUpperCase();
}


// ============================================================
// AUTH FUNCTIONS
// ============================================================

// Get the currently logged-in user from Supabase.
// Returns the user object, or null if nobody is logged in.
// "async" means this function contacts the server and waits for a reply.
async function getCurrentUser() {
  var result = await sb.auth.getUser();
  return result.data.user;  // null if not logged in
}

// Update the #auth-area in the navbar based on whether the user is logged in
async function updateNavbar() {
  var authArea = getEl('auth-area');
  if (!authArea) return;  // this page might not have a navbar

  var user = await getCurrentUser();

  if (user) {
    // --- User IS logged in: show their initial + a sign-out dropdown ---
    var initial = getInitial(user.email);

    authArea.innerHTML =
      '<div class="user-menu">' +
        '<button id="user-btn" class="user-button" title="' + user.email + '">' +
          initial +
        '</button>' +
        '<div id="user-dropdown" class="user-dropdown" hidden>' +
          '<button id="signout-btn" class="dropdown-item">Sign out</button>' +
        '</div>' +
      '</div>';

    // Toggle the dropdown open/closed when the avatar button is clicked
    getEl('user-btn').addEventListener('click', function() {
      var dropdown = getEl('user-dropdown');
      if (dropdown.hasAttribute('hidden')) {
        dropdown.removeAttribute('hidden');   // show it
      } else {
        dropdown.setAttribute('hidden', '');  // hide it
      }
    });

    // Close the dropdown if the user clicks anywhere else on the page
    document.addEventListener('click', function(event) {
      var dropdown = getEl('user-dropdown');
      var btn = getEl('user-btn');
      if (!dropdown || dropdown.hasAttribute('hidden')) return;

      // Check if the click was inside the dropdown or button
      var clickedInsideBtn = btn && btn.contains(event.target);
      var clickedInsideDd  = dropdown && dropdown.contains(event.target);

      if (!clickedInsideBtn && !clickedInsideDd) {
        dropdown.setAttribute('hidden', '');  // close it
      }
    });

    // Sign out when the "Sign out" button is clicked
    getEl('signout-btn').addEventListener('click', async function() {
      await sb.auth.signOut();
      await updateNavbar();          // re-render the navbar
      showGatedContent(false);       // hide auth-only sections
    });

  } else {
    // --- User is NOT logged in: show a "Sign in" link ---
    authArea.innerHTML = '<a class="btn btn-outline" href="login.html">Sign in</a>';
  }
}

// Show or hide page sections that require the user to be logged in.
// Sections with the data-requires-auth attribute are hidden by default (see HTML).
// This function shows them when logged in and hides them when logged out.
function showGatedContent(isLoggedIn) {
  var elements = document.querySelectorAll('[data-requires-auth]');

  for (var i = 0; i < elements.length; i++) {
    if (isLoggedIn) {
      elements[i].style.display = '';     // show the element (uses its default display)
    } else {
      elements[i].style.display = 'none'; // hide it
    }
  }
}

// Send a magic link email to the user so they can log in (no password needed).
// Called from login.html when the user submits their email.
async function sendMagicLink(email) {
  // After clicking the email link, redirect the user back to index.html
  var redirectUrl = window.location.origin + '/index.html';

  var result = await sb.auth.signInWithOtp({
    email: email,
    options: { emailRedirectTo: redirectUrl }
  });

  if (result.error) {
    throw result.error;  // pass the error up to whoever called this function
  }

  return true;  // success
}


// ============================================================
// EXPOSE FUNCTIONS TO OTHER SCRIPTS
// ============================================================
// login.html needs sendMagicLink.
// contributions.js needs getCurrentUser.
// We attach them to window.XAYTHEON_AUTH so any script can call them.
window.XAYTHEON_AUTH = {
  sendMagicLink: sendMagicLink,
  getCurrentUser: getCurrentUser
};


// ============================================================
// INITIALIZE WHEN THE PAGE IS READY
// ============================================================
window.addEventListener('DOMContentLoaded', async function() {

  // Make sure the Supabase library loaded correctly
  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase library not loaded. Check the <script> tag in your HTML.');
    return;
  }

  // Connect to Supabase (like dialling a phone number to the server)
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Make sb available to other scripts that might need it
  window.sb = sb;

  // Update the navbar right away
  await updateNavbar();

  // Show/hide auth-gated sections based on login state
  var user = await getCurrentUser();
  showGatedContent(user !== null);

  // React automatically whenever the user logs in or out
  sb.auth.onAuthStateChange(async function(event, session) {
    await updateNavbar();
    showGatedContent(session !== null);
    // Tell other scripts (like contributions.js) that auth changed
    window.dispatchEvent(new CustomEvent('xaytheon:authchange'));
  });

});
