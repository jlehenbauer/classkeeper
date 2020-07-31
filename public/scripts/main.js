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
  return firebase.auth().signInWithPopup(provider).then(async function(user) {
    // DEBUG: console.log(firebase.auth().currentUser);
    // DEBUG: console.log(role);
  if (role == '') {
    role = await getUserRole();
  }
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

function getUserToken() {
  return firebase.auth().currentUser.getIdToken();
}

async function getUserRole() {
  let user = await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get();
  return user.data().role;
}

// Saves a new message on the Firebase DB.
function saveExitTicket(currentClass, entryTopic, entryMethod, entryLocation, entryRating, entryQuestion) {
  // Add a new message entry into the database.
  console.log('Attempting to add to messages database')
  return firebase.firestore().collection('exit-tickets').add({
    classCode: currentClass,
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
  if (userRole !== 'teacher' && userRole !== 'student'){
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
    var classListElement = currentClass;
    for (let code of classCodes) {
      let className = await firebase.firestore().collection('ccodes').doc(code).get();
      var newListItem = document.createElement('option');
      newListItem.id = code;
      newListItem.value = code;
      newListItem.innerHTML = className.data().name;
      classListElement.appendChild(newListItem);
    }
    classList.removeAttribute('hidden');
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
  let user = await firebase.auth().currentUser;
  let userData = await firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).get();
  let newClassCode = document.getElementById('new-class-code').value;
  let dbCode = await firebase.firestore().collection('ccodes').doc(newClassCode).get();
  let userRole = await getUserRole();
  // If the user is a teacher, add the list of class codes
  if (userRole == 'teacher') {
    // Check to make sure the code doesn't already exist
    if (dbCode.data() == undefined) {
      firebase.firestore().collection('ccodes').doc(newClassCode).set({
        name: document.getElementById('new-class-name').value
      })
    }
    // If it did, report that to the user and ask to try again.
    else {
      // TODO: report duplicate class code or generate them ourselves
      closeMessageModal();
      addClassModal("Sorry, that code has been used already. Please enter another code: ", 'teacher');
      return false;
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

  displayClassLists(user, 'check-in-current-class');
  return true;
  // TODO: clear the modal and class code elements from the modal
}

// Clear exit ticket
function clearExitTicket(){
  var rating = parseInt(exitTicketFormElement.elements["exit_rating"].value);
  for (const item of Array(exitMethods.length).keys()) {
    exitMethods[item].checked = false;
  }
  exitTicketFormElement.elements["exit_rating"][rating - 1].checked = false;
  exitTopic.value = '';
  exitLocation.value = '';
  exitQuestion.value = '';
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

// Class Keeper: Triggered when the send new exit ticket is submitted.
function onExitTicketFormSubmit() {
  //e.preventDefault();
  let rating = exitTicketFormElement.elements["exit_rating"].value;
  console.log("Check-in being sent.");
  console.log(exitTopic.value);
  console.log(getCheckedMethods());
  console.log(exitLocation.value);
  console.log(rating);
  console.log(exitQuestion.value);
  console.log(currentClass.value);
  console.log(true == (currentClass.value && exitTopic.value && getCheckedMethods() && exitLocation.value && rating && checkSignedInWithMessage()))
  // ^ Check that the user entered a message and is signed in.
  if (currentClass.value == undefined) {
    notifyWithModal("Please select a class at the top of the page!");
    return false;
  }
  if (exitTopic.value && getCheckedMethods() && exitLocation.value && rating && checkSignedInWithMessage()) {
    saveExitTicket(currentClass.value, exitTopic.value, getCheckedMethods(), exitLocation.value, rating, exitQuestion.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      //resetMaterialTextfield(messageInputElement);
      //toggleButton();
      clearExitTicket();
      notifyWithModal("Thank you for submitting your exit ticket!");
    });
    return true;
  }
  notifyWithModal("Make sure you've filled out everything before you submit!");
  return false;
}

// Class Keeper: Triggered when the check-in is submitted.
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
  if (currentClass.value == undefined) {
    notifyWithModal("Please select a class at the top of the page!");
    return false;
  }
  if (currentClass.value && rating && checkSignedInWithMessage()) {
    saveCheckIn(rating, pleaseKnow.value, contentQuestion.value, currentClass.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      //resetMaterialTextfield(messageInputElement);
      //toggleButton();
      clearCheckInForm();
      notifyWithModal("Thank you for submitting your check-in, have a great day!");
    });
    return true;
  }
  notifyWithModal("Make sure you've filled out everything before you submit!");
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
async function authStateObserver(user) {
  if (user != null) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();
    var userEmail = getEmail();
    var token = getUserToken();
    let role = getUserRole();

    console.log("User is logged in");

    // Set the user's profile pic and name.
    console.log('Name: ' + userName);
    console.log('Image URL: ' + profilePicUrl);
    console.log('Email: ' + userEmail); // This is null if the 'email' scope is not present.
    console.log("loaded googleUser");
    document.getElementById("profile_img").src = profilePicUrl;
    exitUserFirstName.value = userName.replace(/ .*/,'');
    userFirstName.value = userName.replace(/ .*/,'');

    displayClassLists(firebase.auth().currentUser);

    // If user is a teacher, show additional menu options
    if (await role == 'teacher') {
      dataViewButton.style.display = "";
    }

    // Show user's profile and sign-out button.
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
  modal.style.zIndex = 2;
  window.onclick = function(e) {
    if (e.target == modal) {
      modal.style.display = "none";
    }
  }
}

function closeMessageModal() {
  modal.style.display =  "none";
  removeChildren(document.getElementById('modal-message-content'), 2);
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

function closeRoleModal() {
  roleModal.style.display = "none";
}

function removeChildren(parent, numRemaining) {
  let content = parent;
  let child = content.lastElementChild;
  while (content.children.length > numRemaining) {
    content.removeChild(child);
    child = content.lastElementChild;
  }
}

function showClassLists() {
  // Current names and codes are contained within the dropdown options
  let htmlClassList = document.getElementById('current-class').children;
  let classListTable = document.getElementById('class-name-code-table');
  for (let classItem of Array.from(htmlClassList).slice(1, htmlClassList.length)) {
    let newRow = classListTable.insertRow();
    newRow.align = "center";
    let cell = newRow.insertCell();
    cell.appendChild(document.createTextNode(classItem.innerHTML));
    cell = newRow.insertCell();
    cell.appendChild(document.createTextNode(classItem.id));
  }
  return true;
}

async function showRecentCheckIns() {
  // Current names and codes are contained within the dropdown options
  let htmlCurrentClass = document.getElementById('current-class').value;
  let checkInResponseTable = document.getElementById('recent-check-in-response-table');
  removeChildren(checkInResponseTable.children[0], 1);
  console.log(htmlCurrentClass);

  let checkInCollection = firebase.firestore().collection('check-ins');
  let recentCheckIns = checkInCollection.where("classCode", "==", htmlCurrentClass).orderBy("timestamp", "desc").get().then(function(querySnapshot) {
    querySnapshot.forEach( function(doc) {
      let name = doc.data().name;
      let rating = doc.data().feeling;
      let date = doc.data().timestamp.toDate();
      let formattedDate = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
      
      let newRow = checkInResponseTable.insertRow();
      newRow.align = "center";
      let cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(name));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(rating));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode((date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes()));
    
      // Maintain list of all students in class
      if (!currentStudentNames.has(name)){
        currentStudentNames.add(name);
      }

      // Push data to variables for charts
      try {
        let ratings = checkInRatings.get(name);
        ratings.push(rating);
        checkInRatings.set(name, ratings);
      }
      catch(err){
        checkInRatings.set(name, [rating]);
      }
      try {
        let dates = checkInDates.get(name);
        dates.push(formattedDate);
        checkInDates.set(name, dates);
      }
      catch(err){
        checkInDates.set(name, [formattedDate])
      }
    })
    
    if (currentStudentNames.size > 0) {
      setPerStudentColors();
      updateCheckInChart(Array.from(currentStudentNames));
      updateStudentDataSelectorList();
      checkInChartElement.style.display = 'inline-block';
    }
    else{
      checkInChartElement.style.display = 'none';
    }

  });
  return true;
}

async function showRecentExitTickets() {
  // Current names and codes are contained within the dropdown options
  let htmlCurrentClass = document.getElementById('current-class').value;
  let exitTicketResponseTable = document.getElementById('recent-exit-ticket-response-table');
  removeChildren(exitTicketResponseTable.children[0], 1);

  console.log("writing exit ticket data");
  let exitTicketCollection = firebase.firestore().collection('exit-tickets');
  let recentExitTickets = exitTicketCollection.where("classCode", "==", htmlCurrentClass).orderBy("timestamp", "desc").get().then(function(querySnapshot) {
    querySnapshot.forEach(function(doc) {
      numVals += 1;
      // Name all this to make it easier to handle
      let name = doc.data().name;
      let topic = doc.data().topic;
      let rating = doc.data().rating;
      let date = doc.data().timestamp.toDate();
      let formattedDate = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear();
      let question = doc.data().question;
      let methods = doc.data().methods;

      // Fill the data table with another row for the new document
      let newRow = exitTicketResponseTable.insertRow();
      newRow.align = "center";
      let cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(name));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(topic));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(rating));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode((date.getMonth() + 1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + (date.getMinutes()<10?'0':'') + date.getMinutes()));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(question));
      cell = newRow.insertCell();
      cell.appendChild(document.createTextNode(methods));

      // Maintain list of all students in class
      if (!currentStudentNames.has(name)){
        currentStudentNames.add(name);
      }

      // Push data to variables for charts
      try {
        let ratings = exitTicketRatings.get(name);
        ratings.push(rating);
        exitTicketRatings.set(name, ratings);
      }
      catch(err){
        exitTicketRatings.set(name, [rating]);
      }
      try {
        let dates = exitTicketDates.get(name);
        dates.push(formattedDate);
        exitTicketDates.set(name, dates);
      }
      catch(err){
        exitTicketDates.set(name, [formattedDate])
      }
      try {
        // TODO: Create methods aggregation
        methods.forEach(function(method) {
          let currentRatings = exitTicketMethodRatings.get(name).get(method);
          currentRatings.push(rating);
          exitTicketMethodRatings.get(name).set(method, currentRatings);
        });
      }
      catch {
        let newMethodMap = createDefaultStudentMethodMap();
        exitTicketMethodRatings.set(name, newMethodMap)
        methods.forEach(function(method) {
          let currentRatings = exitTicketMethodRatings.get(name).get(method);
          currentRatings.push(rating);
          exitTicketMethodRatings.get(name).set(method, currentRatings);
        });
      }
    })

    if (currentStudentNames.size > 0) {
      setPerStudentColors();
      updateExitTicketChart(Array.from(currentStudentNames));
      updateStudentDataSelectorList();
      exitTicketChartElement.style.display = 'inline-block';
    }
    else{
      exitTicketChartElement.style.display = 'none';
    }
    
  });
  return true;
}

function createDefaultStudentMethodMap() {
  let methodsMap = new Map();
  exitTicketMethodsList.forEach(function(method){
    methodsMap.set(method, []);
  });
  return methodsMap;
}

function updateStudentDataSelectorList(){
  if (exitTicketRatings.size > 0){
    let studentSelectorList = document.getElementById('student-selector-list');
    removeAllChildren(studentSelectorList);
    
    let allStudents = document.createElement('option');
    allStudents.id = "all-students";
    allStudents.value = "all-students";
    allStudents.innerHTML = "All students";
    studentSelectorList.appendChild(allStudents);

    Array.from(currentStudentNames).forEach( function(name) {
      var newStudent = document.createElement('option');
      newStudent.id = name;
      newStudent.value = name;
      newStudent.innerHTML = name;
      studentSelectorList.appendChild(newStudent);
    });
    return true;
  }
  return false;
}

function removeAllChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild)
  }
}

function buttonData() {
  changeToDataView();
  menuBar();
}

function buttonCheckIn() {
  changeToCheckInView();
  menuBar();
}

function buttonExitTicket() {
  changeToExitTicketView();
  menuBar();
}

async function changeToDataView() {
  if (document.getElementById('class-name-code-table').children[0].children.length == 1) {
    showClassLists();
  }
  currentClass.addEventListener('change', function(item) {
    currentStudentNames = new Set();
    exitTicketDates = new Map();
    checkInDates = new Map();
    updateStudentDataSelectorList();
    showRecentCheckIns();
    showRecentExitTickets();
    updateExitTicketChart(Array.from(currentStudentNames));
    updateCheckInChart(Array.from(currentStudentNames));
  });
  exitTicketFormElement.setAttribute('hidden', true);
  checkInFormElement.setAttribute('hidden', true);
  dataContentView.removeAttribute('hidden');

  updateExitTicketChart(Array.from(currentStudentNames));
  updateCheckInChart(Array.from(currentStudentNames));
  updateStudentDataSelectorList();
}

async function changeToCheckInView() {
  currentClass.removeEventListener('change', function(item) {
    showRecentCheckIns();
    showRecentExitTickets();
    updateExitTicketChart();
    updateCheckInChart();
    updateStudentDataSelectorList();
  });
  exitTicketFormElement.setAttribute('hidden', true);
  dataContentView.setAttribute('hidden', true);
  checkInFormElement.removeAttribute('hidden');
}

async function changeToExitTicketView() {
  currentClass.removeEventListener('change', function(item) {
    showRecentCheckIns();
    showRecentExitTickets();
    updateExitTicketChart();
    updateCheckInChart();
    updateStudentDataSelectorList();
  });
  dataContentView.setAttribute('hidden', true);
  checkInFormElement.setAttribute('hidden', true);
  exitTicketFormElement.removeAttribute('hidden');
}

// Toggle between showing and hiding the navigation menu links when the user clicks on the hamburger menu / bar icon
function menuBar() {
  var menu_display = document.getElementById("menu-options");
  var display_header = document.getElementsByClassName("sign-in-header")[0];
  if (menu_display.style.display === "block") {
    menu_display.style.display = "none";
    display_header.style= "padding-top: 50px";
  } else {
    menu_display.style.display = "block";
    display_header.style= "padding-top: 300px";
    console.log(menu_display.style.height);
  }
}

function studentDataSelectorListener() {
  /**
   * Update visible charts for just student selected
   * Create charts for individual student
   */
  let selectedStudent = studentSelector.selectedOptions[0].value;
  updateExitTicketChart([selectedStudent]);
  updateCheckInChart([selectedStudent]);

  // Collect methods from exit tickets

  updateMethodsChart(selectedStudent);
  updateRatingsChart(selectedStudent);
}

// Checks that Firebase has been imported.
checkSetup();

// Parent Page Elements
var pageContent = document.getElementById('page-content');
var dataContentView = document.getElementById('data-content');
var classList = document.getElementById('class-list');
var currentClass = document.getElementById('current-class');


// Shortcuts to DOM Elements for user management.
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var profileImage = document.getElementById('profile_img');
var userEmail = '';

// Exit Ticket Form Elements
var exitTicketFormElement = document.getElementById('exit-ticket-form');
var exitTopic = document.getElementById('topic');
var exitMethods = document.getElementsByName('checklist');
var exitLocation = document.getElementById('location');
var exitRating = document.getElementById('exit_rating_radio');
var exitQuestion = document.getElementById('student-question');
var submitButtonElement = document.getElementById('submit-exit-ticket');
var exitUserFirstName = document.getElementById('exit-first-name');
var exitTicketCurrentClass = null;

// Check-in Form Elements
var checkInFormElement = document.getElementById('check-in');
var submitCheckInButton = document.getElementById('submit');
var feeling = document.getElementById('feeling');
var pleaseKnow = document.getElementById('need-to-know');
var contentQuestion = document.getElementById('content-question');
var teacherRoleButton = document.getElementById('role-teacher-button');
var studentRoleButton = document.getElementById('role-student-button');
var userFirstName = document.getElementById('check-in-first-name');

// Data view Elements

// Modal Elements
var modal = document.getElementById("confirmation");
var modalClose = document.getElementsByClassName("close")[0];
var roleModal = document.getElementById('role-modal');
var role = ''
var roleModalClose = document.getElementsByClassName("close")[1];
var modalMessage = document.getElementById("modal-message");

// Menu bar elements
var homeButton = document.getElementById("menu-button-home");
var dataViewButton = document.getElementById("menu-button-data");
var checkInViewButton = document.getElementById("menu-button-check-in");
var addClassButton = document.getElementById("menu-button-add-class");
var exitTicketViewButton = document.getElementById("menu-button-exit-ticket");
homeButton.addEventListener('click', menuBar);
dataViewButton.addEventListener('click', buttonData);
checkInViewButton.addEventListener('click', buttonCheckIn);
addClassButton.addEventListener('click', function() {addClassModal('Please enter the code for your new class.')})
exitTicketViewButton.addEventListener('click', buttonExitTicket);

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

// Create variables for student data to enable charts for exit tickets and check-ins
var exitTicketDates = new Map();
var exitTicketRatings = new Map();
var checkInRatings = new Map();
var checkInDates = new Map();
var currentStudentNames = new Set();
var currentStudentColors = new Map();
var exitTicketMethodRatings = new Map();
var exitTicketMethodsList = ["Google Classroom", "OneNote", "Paper Notebook", "Worksheet", "Written Notes", "Class Activity", "Calculator", "Workbook", "Whiteboard", "Class Discussion", "PantherPortal"];
var numVals = 0;



// Charts, all elements
var exitTicketChartElement = document.getElementById("exit-ticket-chart");
var exitTicketChart = undefined;
var checkInChartElement = document.getElementById("check-in-chart");
var checkInChart = undefined;
var methodsChartElement = document.getElementById("methods-chart");
var methodsChart = undefined;
var ratingsChartElement = document.getElementById("ratings-chart");
var ratingsChart = undefined;
var studentSelector = document.getElementById("student-selector-list");
studentSelector.addEventListener('change', studentDataSelectorListener)

function getRandomColor(alpha) {
  var color = 'rgba(';
  for (var i = 0; i < 3; i++ ) {
      color += String(Math.floor(Math.random() * 255)) + ",";
  }
  if (alpha == undefined) {
    alpha = 1;
  }
  color += alpha + ")";
  console.log(color);
  return color;
}

// Generate static colors for each student (on class load)
function setPerStudentColors() {
  Array.from(currentStudentNames).forEach(function(name){
    if (currentStudentColors.get(name) == undefined) {
      let color = getRandomColor();
      currentStudentColors.set(name, color);
    }
  });
  return true;
}

/**
 * TODO:
 * 
 *  - add 'ratings by method' chart
 *  - make colors consistent per student for checkin/exit
 *  - add 'ratings totals' chart
 *  - option for time frame?
 */

function generateRatingData(dates, names, currentRatings, currentDates) {
  let ratingData = new Map();
  currentDates.forEach( function(value, key, map) {
    if (names.includes(key) || names[0] == 'all-students') {
      ratingData.set(key, []);
      dates.forEach( function(date) {
        let ind = currentDates.get(key).indexOf(date);
        if (value.indexOf(date) !== null){
          ratingData.get(key).push(currentRatings.get(key)[ind]);
        }
        else{
          ratingData.get(key).push(null);
        };
      });
    }
  });
  return ratingData;
}

function removeCurrentData(chart){
  if (chart !== undefined) {
    while (chart.data.datasets.length > 0) {
      chart.data.datasets.pop();
    }
    return true;
  }
  return false;
}


function updateExitTicketChart(names, dates) {

  // Create names and Dates lists
  if (dates == undefined) {
    dates = new Set();
    exitTicketDates.forEach( function(value, key, map){
      value.forEach(function(val){dates.add(val)});
    });
  }

  // Create blank chart with appropriate dates as labels
  exitTicketChart = new Chart(exitTicketChartElement, {
    type: 'line',
    data: {
      labels: Array.from(dates)
    },
    options: {
      layout: {
        padding: {
          right: 30
        }
      },
      title: {
        display: true,
        text: "Exit Ticket Ratings",
        fontSize: 14
      },
      scales: {
        xAxes: [{
          ticks: {
            reverse: true
          }
        }],
        yAxes: [{
          ticks: {
            beginAtZero: true,
            max: 10
          }
        }]
      }
    }
  });
  
  // Create per-student ratings data to populate chart
  let ratings = generateRatingData(dates, names, exitTicketRatings, exitTicketDates);

  // Fill chart with data for each student with assigned colors
  ratings.forEach( function (value, key, map) {
    if (names.includes(key) || names[0] == 'all-students'){
      exitTicketChart.data.datasets.push({
        label: key,
        data: value,
        borderWidth: 3,
        borderColor: currentStudentColors.get(key),
        fill: false
      })
    }
  });

  exitTicketChart.update();

}

function updateCheckInChart(names, dates) {

  // Create names and Dates lists
  if (dates == undefined) {
    dates = new Set();
    checkInDates.forEach( function(value, key, map){
      value.forEach(function(val){dates.add(val)});
    });
  }

  // Create blank chart with appropriate dates as labels
  checkInChart = new Chart(checkInChartElement, {
    type: 'line',
    data: {
      labels: Array.from(dates)
    },
    options: {
      layout: {
        padding: {
          right: 30
        }
      },
      title: {
        display: true,
        text: "Check-in Ratings",
        fontSize: 14
      },
      scales: {
        xAxes: [{
          ticks: {
            reverse: true
          }
        }],
        yAxes: [{
          ticks: {
            beginAtZero: true,
            max: 10
          }
        }]
      }
    }
  });
  
  // Create per-student ratings data to populate chart
  let ratings = generateRatingData(dates, names, checkInRatings, checkInDates);

  // Fill chart with data for each student with random colors
  ratings.forEach( function (value, key, map) {
    if (names.includes(key) || names[0] == 'all-students'){
      checkInChart.data.datasets.push({
        label: key,
        data: value,
        borderWidth: 3,
        borderColor: currentStudentColors.get(key),
        fill: false
      })
    }
  });

  checkInChart.update();
  
}

function updateMethodsChart(name) {
    // Create chart with appropriate methods as labels

    let averages = new Map();
    let frequencies = new Map();
    let studentRatings = exitTicketMethodRatings.get(name);

    removeCurrentData(methodsChart);

    if (name == "all-students") {
      methodsChart.options.title.text = "Select a student to see data";
      averages = [0];
      methodsChart.update();
      return false;
    }
    else if (studentRatings == undefined) {
      methodsChart.data.labels = ["No Responses"];
      averages = [0];
      methodsChart.update();
      return false;
    }
    else{
      // Create averages from the values
      Array.from(studentRatings.keys()).forEach( function (method) {
        if (studentRatings.get(method).length > 0){
          let total = studentRatings.get(method).reduce(function(a, b){return +a + +b}, 0);
          let average = total / studentRatings.get(method).length;
          averages.set(method, average);
        }
        else{
          averages.set(method, 0);
        }
      });

      // Create usage frequencies from the values
      Array.from(studentRatings.keys()).forEach( function (method) {
        if (studentRatings.get(method).length > 0){
          
          let total = studentRatings.get(method).length;
          let average = total / exitTicketRatings.get(name).length;
          frequencies.set(method, average*10);
        }
        else{
          frequencies.set(method, 0);
        }
      });
    }

    let freqColor = getRandomColor(0.6);

    methodsChart = new Chart(methodsChartElement, {
      type: 'bar',
      data: {
        labels: exitTicketMethodsList,
        datasets: [{
          xAxisID: 'ratings',
          label: "Average Rating",
          data: Array.from(averages.values()),
          borderWidth: 1,
          borderColor: currentStudentColors.get(name),
          backgroundColor: currentStudentColors.get(name),
          fill: true,
          stack: "background",
          barPercentage: 0.7
        },
        {
          xAxisID: 'frequencies',
          label: "% Used",
          data: Array.from(frequencies.values()),
          borderwidth: 0,
          bordercolor: freqColor,
          backgroundColor: freqColor,
          fill: true,
          barPercentage: 1.25
        }]
      },
      options: {
        layout: {
          padding: {
            right: 30
          }
        },
        title: {
          display: true,
          text: "Class Methods Use and Ratings",
          fontSize: 14
        },
        scales: {
          xAxes: [{
            id: 'ratings',
            stacked: true,
            fillOpacity: 1
          },
          {
            id: 'frequencies',
            stacked: true,
            display: false,
            gridLines: {
              offsetGridlines: true
            },
            offset: true,
            fillOpacity: 0.3
          }],
          yAxes: [{
            stacked: false,
            ticks: {
              beginAtZero: true,
              max: 10
            }
          }]
        },
        aspectRatio: 1
      }
    });

    methodsChart.update();
}


/**
 * This is a plugin to enable showingall tooltips on the pie chart below
 */
Chart.pluginService.register({
  beforeRender: function (chart) {
      if (chart.config.options.showAllTooltips) {
          // create an array of tooltips
          // we can't use the chart tooltip because there is only one tooltip per chart
          chart.pluginTooltips = [];
          chart.config.data.datasets.forEach(function (dataset, i) {
              chart.getDatasetMeta(i).data.forEach(function (sector, j) {
                if(dataset.data[j] !== 0){
                  chart.pluginTooltips.push(new Chart.Tooltip({
                      _chart: chart.chart,
                      _chartInstance: chart,
                      _data: chart.data,
                      _options: chart.options.tooltips,
                      _active: [sector]
                  }, chart));
                }
              });
          });

          // turn off normal tooltips
          chart.options.tooltips.enabled = false;
      }
  },
  afterDraw: function (chart, easing) {
      if (chart.config.options.showAllTooltips) {
          // we don't want the permanent tooltips to animate, so don't do anything till the animation runs atleast once
          if (!chart.allTooltipsOnce) {
              if (easing !== 1)
                  return;
              chart.allTooltipsOnce = true;
          }

          // turn on tooltips
          chart.options.tooltips.enabled = true;
          Chart.helpers.each(chart.pluginTooltips, function (tooltip) {
              tooltip.initialize();
              tooltip.update();
              // we don't actually need this since we are not animating tooltips
              tooltip.pivot();
              tooltip.transition(easing).draw();
          });
          chart.options.tooltips.enabled = false;
      }
  }
})


function updateRatingsChart(name){


  let ratings = exitTicketRatings.get(name);
  let ratingCounts = [];
  let colors = [];

  removeCurrentData(ratingsChart);

  if (name == "all-students") {
    ratingsChart.options.title.text = "Select a student to see data";
    ratingCounts = [0];
    ratingsChart.update();
    return false;
  }
  else if (ratings == undefined) {
    ratingsChart.data.labels = ["No Responses"];
    ratingCounts = [0];
    ratingsChart.update();
    return false;
  }


  for(var i = 1; i < 11; i++){
    let num = ratings.reduce((total,x) => (x == i ? total + 1 : total), 0);
    ratingCounts.push(num);
    colors.push(getRandomColor());
  }

  console.log(exitTicketRatings);
  console.log(ratings);
  console.log(ratingCounts);
  console.log(colors);
  
  var options = {
    tooltipTemplate: "<%= value %>",
  
    showTooltips: true,
  
    onAnimationComplete: function() {
      this.showTooltip(this.datasets[0].points, true);
    },
    tooltipEvents: []
  }

  if (ratingsChart !== undefined) {
    while (ratingsChart.data.datasets.length > 0) {
      ratingsChart.data.datasets.pop();
    }
  }
  // Create blank chart with appropriate dates as labels
  ratingsChart = new Chart(ratingsChartElement, {
    type: 'pie',
    data: {
      labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      datasets: [{
        data: Array.from(ratingCounts),
        backgroundColor: colors
      }]
    },
    options: {
      // enable this to show all tooltips
      // Caution: tooltips will overlap
      // showAllTooltips: true,
      layout: {
        padding: {
          right: 30
        }
      },
      legend: {
        position: 'right'
      },
      title: {
        display: true,
        text: "Exit Ticket Ratings",
        fontSize: 14
      },
      aspectRatio: 1
    }
  });

  ratingsChart.update();
}


// initialize Firebase
initFirebaseAuth();
// TODO: Enable Firebase Performance Monitoring.
