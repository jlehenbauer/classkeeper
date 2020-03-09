/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

// Signs-in Class Keeper
async function signIn(googleUser) {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider).then(function(user) {
    // DEBUG: console.log(firebase.auth().currentUser);
    // DEBUG: console.log(role);
    createOrUpdateUser(role);
  });
}

// Sign-in Promise
// REMOVE?
var signInPromise = new Promise(async function(resolve, error) {
  await resolve(signIn);
});

// Signs-out of Class Keeper
function signOut() {
  // Sign out of Firebase.
  firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
  // Listen to auth state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

// Returns the signed-in user's email address.
function getEmail() {
  return firebase.auth().currentUser.email;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

async function getUserRole() {
  let user = await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get();
  return user.data().role;
}

// Saves a new message on the Firebase DB.
function saveExitTicket(entryTopic, entryMethod, entryLocation, entryRating, entryQuestion) {
  // Add a new message entry into the database.
  console.log('Attempting to add to messages database')
  return firebase.firestore().collection('exit-tickets').add({
    name: getUserName(),
    email: getEmail(),
    profile_img: getProfilePicUrl(),
    topic: entryTopic,
    methods: entryMethod,
    location: entryLocation,
    rating: entryRating,
    question: entryQuestion,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(error) {
    console.error('Error writing new message to database.', error);
  });
  return false;
}

// Saves a new check-in on the Firebase DB.
function saveCheckIn(feeling, pleaseKnow, contentQuestion, currentClass) {
  // Add a new message entry into the database.
  console.log('Attempting to add to check-in database')
  return firebase.firestore().collection('check-ins').add({
    name: getUserName(),
    email: getEmail(),
    profile_img: getProfilePicUrl(),
    feeling: feeling,
    pleaseKnow: pleaseKnow,
    question: contentQuestion,
    classCode: currentClass,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(error) {
    console.error('Error writing new check-in to database.', error);
  });
  return false;
}

// User is a student. Save messaging token for later, but mark as a student
function userIsStudent() {
  role = 'student';
  signIn();
}

// User is a teacher. Save messaging token to enable notifications and label as teacher
async function userIsTeacher() {
  role = 'teacher';
  signIn();
}


// Saves the user and device token to the datastore.
async function createOrUpdateUser(userRole) {
  let user = firebase.auth().currentUser;
  let remoteUser = await firebase.firestore().collection('users').doc(user.uid).get();
  if (userRole == ''){
    removeChildren(document.getElementById('welcome-dialog'), 1);
    let assignRoleDialog = document.createElement('p');
    assignRoleDialog.id = "assign-role-text";
    assignRoleDialog.innerHTML = 'It appears you have not defined a role for yourself. Please choose one below:';
    document.getElementById('welcome-dialog').appendChild(assignRoleDialog);
    signOut();
    roleSignIn();
  }
  else if (userRole == 'student' && !remoteUser.exists) {
    // Add student to the database without further action
    firebase.firestore().collection('users').doc(user.uid).set({
      name: getUserName(),
      role: userRole,
      email: user.email,
      // LATER: use for sending notifications to students
      // token: currentToken,
      codes: []
    });
    addClassModal("Welcome! Please enter the code your teacher gave you to join your first class: ", userRole)
  }
  // Update student information but keep any codes they've added
  else if (userRole == 'student') {
    let userData = firebase.firestore().collection('users').doc(user.uid).get();
    firebase.firestore().collection('users').doc(user.uid).update({
      name: getUserName(),
      role: userRole,
      email: user.email
      // LATER: use for sending notifications to students
      // token: currentToken,
    });
  }
  else if (userRole == 'teacher' && !remoteUser.exists) {
    firebase.messaging().getToken().then(function(currentToken) {
      if (currentToken) {
        console.log('Adding/updating user in database:', currentToken);
        // console.log(firebase.auth().currentUser);
        // Saving the Device Token to the datastore
        // TODO: Split tokens for categores (teachers/students? check-in/exit-ticket?)
        firebase.firestore().collection('users').doc(user.uid).set({
          name: getUserName(),
          role: userRole,
          email: user.email,
          token: currentToken,
          codes: []
        });
        addClassModal("Welcome! Since this is your first time signing in, please set up a class for your students to join.\nPick a simple code and name for your class. The code must be unique, but the class name does not.\nWrite your code down so you don't lose it, it's the only way for students to join your class!", userRole);
      } else {
        // Need to request permissions to show notifications.
        requestNotificationsPermissions();
      }
    }).catch(function(error){
      console.error('Unable to get messaging token.', error);
    });
  }  
  else if (userRole == 'teacher') {
    let userData = await firebase.firestore().collection('users').doc(user.uid).get();
    firebase.messaging().getToken().then(function(currentToken) {
      if (currentToken) {
        console.log('Adding/updating user in database:', currentToken);
        // console.log(firebase.auth().currentUser);
        // Saving the Device Token to the datastore
        // TODO: Split tokens for categores (teachers/students? check-in/exit-ticket?)
        firebase.firestore().collection('users').doc(user.uid).update({
          name: getUserName(),
          role: userRole,
          email: user.email,
          token: currentToken
        });
      } else {
        // Need to request permissions to show notifications.
        requestNotificationsPermissions();
      }
    }).catch(function(error){
      console.error('Unable to get messaging token.', error);
    });
  }  
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  // TODO 11: Request permissions to send notifications.
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    createOrUpdateUser();
  }).catch(function(error) {
    console.log('Denied permission to give notifications.');
  });
}


// Add subscribed classes to list of choices
async function displayClassLists(user) {
  removeChildren(currentClass, 1);
  let userData = await firebase.firestore().collection('users').doc(user.uid).get();
  let classCodes = userData.data().codes;
  console.log(classCodes);
  if (classCodes.length > 0) {
    console.log('writing codes to ui');
    var classListElement = document.getElementById('current-class');
    for (let code of classCodes) {
      let className = await firebase.firestore().collection('ccodes').doc(code).get();
      var newListItem = document.createElement('option');
      newListItem.id = code;
      newListItem.value = code;
      newListItem.innerHTML = className.data().name;
      classListElement.appendChild(newListItem);
    }
    document.getElementById('class-list').removeAttribute('hidden');
  }
  else {
    addClassModal("It appears you don't have any classes yet. Please enter your class code below:", userData.data().role);
  }
}

async function addClassModal(messageText, role=getUserRole()) {
  modalMessage.innerHTML = messageText;
  console.log("Changed modal inner html");
  let classCodeEntry = document.createElement('input');
  let classCodeConfirm = document.createElement('button');
  let modalMessageContent = document.getElementById('modal-message-content'); 
  classCodeEntry.type = 'text';
  classCodeEntry.id = 'new-class-code';
  classCodeEntry.placeholder = 'unique code';
  classCodeConfirm.innerHTML = 'Submit';
  classCodeConfirm.addEventListener('click', addClass);
  modalMessageContent.appendChild(classCodeEntry);
  if (await role == 'teacher') {
    let classNameEntry = document.createElement('input');
    classNameEntry.type = 'text';
    classNameEntry.id = 'new-class-name';
    classNameEntry.placeholder = 'class name';
    modalMessageContent.appendChild(classNameEntry);
  }
  modalMessageContent.appendChild(classCodeConfirm);
  modal.style = "display: block";
}

async function addClass() {
  let userData = await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get();
  let newClassCode = document.getElementById('new-class-code').value;
  let dbCode = await firebase.firestore().collection('ccodes').doc(newClassCode);
  let userRole = await getUserRole();
  // If the user is a teacher, add the list of class codes
  if (userRole == 'teacher') {
    // Check to make sure the code doesn't already exist
    if (dbCode.name == undefined) {
      firebase.firestore().collection('ccodes').doc(newClassCode).set({
        name: document.getElementById('new-class-name').value
      })
    }
    // If it did, report that to the user and ask to try again.
    else {
      // TODO: report duplicate class code or generate them ourselves
    }
  }
  // Whether the user is a student or teacher, now add the code to their user record
  console.log(newClassCode);
  let updatedClassCodes = userData.data().codes;
  if (!updatedClassCodes.includes(newClassCode)) {
    updatedClassCodes.push(newClassCode);
    console.log(updatedClassCodes);
    firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update({
      codes: updatedClassCodes
    }).then(function() {
      console.log('User class list updated successfully: ' + updatedClassCodes);
    }).catch(function(error) {
      console.log('Error updating class list: ' + error);
    });
  }
  closeMessageModal();
  displayClassLists(firebase.auth().currentUser);
  // TODO: clear the modal and class code elements from the modal
}

// Clear exit ticket
function clearExitTicket(){
  var rating = parseInt(exitTicketFormElement.elements["rating"].value);
  for (const item of Array(exitMethods.length).keys()) {
    exitMethods[item].checked = false;
  }
  exitTicketFormElement.elements["rating"][rating - 1].checked = false;
  exitTopic.value = '';
  exitLocation = '';
  exitQuestion = '';

}

// Custom check-in
function clearCheckInForm(){
  var rating = parseInt(checkInFormElement.elements["rating"].value);
  checkInFormElement.elements["rating"][rating - 1].checked = false;
  pleaseKnow.value = "";
  contentQuestion.value = "";
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Toggle between showing and hiding the navigation menu links when the user clicks on the hamburger menu / bar icon
function menuBar() {
  var x = document.getElementById("menu-options");
  if (x.style.display === "block") {
    x.style.display = "none";
  } else {
    x.style.display = "block";
  }
}

// Class Keeper: Triggered when the send new message form is submitted.
function onExitTicketFormSubmit() {
  //e.preventDefault();
  var rating = exitTicketFormElement.elements["rating"].value;
  console.log("Check-in being sent.");
  console.log(exitTopic.value);
  console.log(getCheckedMethods());
  console.log(exitLocation.value);
  console.log(rating);
  console.log(exitQuestion.value);
  console.log(true == (exitTopic.value && getCheckedMethods() && exitLocation.value && rating && checkSignedInWithMessage()))
  // ^ Check that the user entered a message and is signed in.
  if (exitTopic.value && getCheckedMethods() && exitLocation.value && rating && checkSignedInWithMessage()) {
    saveExitTicket(exitTopic.value, getCheckedMethods(), exitLocation.value, rating, exitQuestion.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      //resetMaterialTextfield(messageInputElement);
      //toggleButton();
      clearExitTicket();
      notifyWithModal("Thank you for submitting your exit ticket!");
    });
  }
  return false;
}

// Class Keeper: Triggered when the send check-in is submitted.
function onCheckInSubmit() {
  //e.preventDefault();
  var rating = checkInFormElement.elements["rating"].value;
  console.log("Check-in being sent.");
  console.log(rating);
  console.log(pleaseKnow.value);
  console.log(contentQuestion.value);
  console.log(currentClass.value)
  console.log(true == (rating && checkSignedInWithMessage()));
  // ^ Check that the user entered a message and is signed in.
  if (currentClass.value && rating && checkSignedInWithMessage()) {
    saveCheckIn(rating, pleaseKnow.value, contentQuestion.value, currentClass.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      //resetMaterialTextfield(messageInputElement);
      //toggleButton();
      clearCheckInForm();
      notifyWithModal("Thank you for submitting your check-in, have a great day!");
    });
  }
  return false;
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveExitTicketket(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      // resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user != null) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();
    var userEmail = getEmail();

    console.log("User is logged in");

    // Set the user's profile pic and name.

    //console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + userName);
    console.log('Image URL: ' + profilePicUrl);
    console.log('Email: ' + userEmail); // This is null if the 'email' scope is not present.
    console.log("loaded googleUser");
    document.getElementById("profile_img").src = profilePicUrl;
    document.getElementById("first-name").value = userName.replace(/ .*/,'');
    //userPicElement.style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
    //userNameElement.textContent = userName;

    displayClassLists(firebase.auth().currentUser);

    // Show user's profile and sign-out button.
    //userNameElement.removeAttribute('hidden');
    profileImage.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');
    roleModal.style.display = "none";

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');
  } else { // User is signed out!
    console.log("User is not signed in");
    // Hide user's profile and sign-out button.
    //userNameElement.setAttribute('hidden', 'true');
    profileImage.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');
    classList.setAttribute('hidden', 'true');

    // Show role modal
    roleSignIn();

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
  }
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  //signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
  if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
    return url + '?sz=150';
  }
  return url;
}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Gets selected options from the checkboxes and returns them as a list
function getCheckedMethods() {
  var methods = [];
  for (let item in exitMethods) {
    //console.log(item)
    if (exitMethods[item].checked) {
      methods.push(exitMethods[item].value);
    }
  }
  return methods;
}

// Simple dialog to report a message to the user
function notifyWithModal(message) {
  modalMessage.innerHTML = message;
  modal.style.display = "block";
  window.onclick = function(e) {
    if (e.target == modal) {
      modal.style.display = "none";
    }
  }
}

// Reports to the user that a check-in has been logged
function roleSignIn() {
  roleModal.style.display = "block";
  window.onclick = function(e) {
    if (e.target == modal) {
      roleModal.style.display = "none";
    }
  }
}

function closeMessageModal() {
  modal.style.display =  "none";
  removeChildren(document.getElementById('modal-message-content'), 2);
}

function removeChildren(parent, numRemaining) {
  let content = parent;
  let child = content.lastElementChild;
  while (content.children.length > numRemaining) {
    content.removeChild(child);
    child = content.lastElementChild;
  }
}

function closeRoleModal() {
  roleModal.style.display = "none";
}

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements for chat service.
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');

// Shortcuts to DOB Elements for Class Keeper
// User Elements
var profileImage = document.getElementById('profile_img');
var userEmail = '';
var userFirstName = document.getElementById('first-name');

// Exit Ticket Form Elements
var exitTicketFormElement = document.getElementById('exit-ticket-form');
var exitTopic = document.getElementById('topic');
var exitMethods = document.getElementsByName('checklist');
var exitLocation = document.getElementById('location');
var exitRating = document.getElementById('rating_radio');
var exitQuestion = document.getElementById('student-question');
var submitButtonElement = document.getElementById('submit-exit-ticket');

// Check-in Form Elements
var checkInFormElement = document.getElementById('check-in');
var submitCheckInButton = document.getElementById('submit');
var feeling = document.getElementById('feeling');
var pleaseKnow = document.getElementById('need-to-know');
var contentQuestion = document.getElementById('content-question');
var teacherRoleButton = document.getElementById('role-teacher-button');
var studentRoleButton = document.getElementById('role-student-button');
var currentClass = document.getElementById('current-class');
var classList = document.getElementById('class-list');


var modal = document.getElementById("confirmation");
var modalClose = document.getElementsByClassName("close")[0];
var roleModal = document.getElementById('role-modal');
var role = ''
var roleModalClose = document.getElementsByClassName("close")[1];
var modalMessage = document.getElementById("modal-message");

// Saves exit ticket on submission
if (exitTicketFormElement) {
  submitButtonElement.addEventListener('click', onExitTicketFormSubmit);
}
if (checkInFormElement) {
  checkInFormElement.addEventListener('submit', onCheckInSubmit);
  teacherRoleButton.addEventListener('click', userIsTeacher);
  studentRoleButton.addEventListener('click', userIsStudent);
}

// Add ability for modal 'x' to close modals
modalClose.addEventListener('click', closeMessageModal);
roleModalClose.addEventListener('click', closeRoleModal);

// Saves message on form submit.
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);


// initialize Firebase
initFirebaseAuth();
// TODO: Enable Firebase Performance Monitoring.
