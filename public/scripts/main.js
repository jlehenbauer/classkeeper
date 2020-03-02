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
function signIn(googleUser) {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

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

// Saves a new message on the Firebase DB.
function saveExitTicket(entryTopic, entryMethod, entryLocation, entryRating, entryQuestion) {
  // Add a new message entry into the database.
  console.log('Attempting to add to messages database')
  return firebase.firestore().collection('exit-tickets').add({
    name: getUserName(),
    email: getEmail(),
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
function saveCheckIn(feeling, pleaseKnow, contentQuestion) {
  // Add a new message entry into the database.
  console.log('Attempting to add to check-in database')
  return firebase.firestore().collection('check-ins').add({
    name: getUserName(),
    email: getEmail(),
    feeling: feeling,
    pleaseKnow: pleaseKnow,
    question: contentQuestion,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function(error) {
    console.error('Error writing new check-in to database.', error);
  });
  return false;
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  // TODO 10: Save the device token in the realtime datastore
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore
      // TODO: Split tokens for categores (teachers/students? check-in/exit-ticket?)
      firebase.firestore().collection('fcmTokens').doc(currentToken).set({
        uid: firebase.auth().currentUser.uid,
        role: 'teacher'
      });
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  // TODO 11: Request permissions to send notifications.
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.log('Denied permission to give notifications.');
  });
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
      reportSubmission(rating);
    });
  }
  return false;
}

// Class Keeper: Triggered when the send check-in is submitted.
function onCheckInSubmit() {
  //e.preventDefault();
  var rating = checkInFormElement.elements["rating"].value;
  console.log("Exit ticket being sent.");
  console.log(rating);
  console.log(pleaseKnow.value);
  console.log(contentQuestion.value);
  console.log(true == (rating && checkSignedInWithMessage()));
  // ^ Check that the user entered a message and is signed in.
  if (rating && checkSignedInWithMessage()) {
    saveCheckIn(rating, pleaseKnow.value, contentQuestion.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      //resetMaterialTextfield(messageInputElement);
      //toggleButton();
      clearCheckInForm();
      reportSubmission(rating);
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

    // Show user's profile and sign-out button.
    //userNameElement.removeAttribute('hidden');
    profileImage.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');
  } else { // User is signed out!
    console.log("User is not signed in");
    // Hide user's profile and sign-out button.
    //userNameElement.setAttribute('hidden', 'true');
    profileImage.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

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

// Enable notifications for teachers
function notificationsForTeachers() {
  // We save the Firebase Messaging Device token and enable notifications.
  saveMessagingDeviceToken();
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

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

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

// Reports that a check-in has been logged
function reportSubmission() {
  modal.style.display = "block";
  modalClose.onclick = function() {
    modal.style.display = "none";
  }
  window.onclick = function(e) {
    if (e.target == modal) {
      modal.style.display = "none";
    }
  }
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
var teacherButton = document.getElementById('teacher');
var modal = document.getElementById("confirmation");
var modalClose = document.getElementsByClassName("close")[0];

// Saves exit ticket on submission
if (exitTicketFormElement) {
  submitButtonElement.addEventListener('click', onExitTicketFormSubmit);
}
if (checkInFormElement) {
  checkInFormElement.addEventListener('submit', onCheckInSubmit);
  // Triggers notification dialog for teachers
  teacherButton.addEventListener('click', notificationsForTeachers);
}

// Saves message on form submit.
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);


// initialize Firebase
initFirebaseAuth();
// TODO: Enable Firebase Performance Monitoring.
