// Import the Firebase SDK for Google Cloud Functions.
const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();

// A new student has joined the service! Ask them for a code to link them to their teacher.
exports.addWelcomeMessages = functions.auth.user().onCreate(async (user) => {
  console.log('A new user signed in for the first time.');
  const fullName = user.displayName || 'Anonymous';

  // TODO: 
  //  - make popup modal
  //  - *await function* ask for code to link to teacher
});

// Sends a notification to the respective teacher(s) when a new check-in is submitted.
exports.sendCheckInNotifications = functions.firestore.document('check-ins/{messageId}').onCreate(
  async (snapshot) => {
    // DEBUG: console.log('Feeling rating to notify ' + snapshot.data().feeling);
    // Notification details.
    const question = snapshot.data().question;
    const know = snapshot.data().pleaseKnow;
    const classCode  = snapshot.data().classCode;
    const className = await admin.firestore().collection('ccodes').doc(classCode).get();
    const payload = {
      notification: {
        title: `${snapshot.data().feeling} : ${snapshot.data().name} checked in.`,
        body: (know ? ('You should know: ' + know) : '') + '\n' + (question ? ('Asked: ' + question) : ''),
        icon: snapshot.data().profile_img || '/images/profile_placeholder.png',
        click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`
      }
    };
    // DEBUG: console.log('Successfully created notification payload');
    // Future use - class name variable: ${className.data().name}

    // Get the list of device tokens.
    /**
    const allUsers = await admin.firestore().collection('fcmTokens').get();
    const tokens = [];
    allUsers.forEach((tokenDoc) => {
      // DEBUG: console.log(tokenDoc.data().role);
      if (tokenDoc.data().role == 'teacher') {
        tokens.push(tokenDoc.id);
      }
    });
    **/
    const allUsers = await admin.firestore().collection('users').get();
    const users = [];
    allUsers.forEach((user) => {
      // DEBUG: console.log(tokenDoc.data().role);
      if (user.data().role == 'teacher') {
        if (user.data().codes.includes(classCode)) {
          users.push(user.data().token);
        }
      }
    });

    if (users.length > 0) {
      // Send notifications to all tokens.
      const response = await admin.messaging().sendToDevice(users, payload);
      console.log(response);
      // Cleanup no longer needed, tokens update within user's attribute
      //await cleanupTokens(response, users);
      console.log('Notifications have been sent and tokens cleaned up.');
      console.log('Notifications were sent to :' + users);
    }
  });

// Sends a notification to the respective teacher(s) when a new exit ticket is submitted.
exports.sendExitTicketNotifications = functions.firestore.document('exit-tickets/{messageId}').onCreate(
async (snapshot) => {
  // DEBUG: console.log('Feeling rating to notify ' + snapshot.data().feeling);
  // Notification details.
  const question = snapshot.data().question;
  const know = snapshot.data().pleaseKnow;
  const classCode  = snapshot.data().classCode;
  const className = await admin.firestore().collection('ccodes').doc(classCode).get();
  const payload = {
    notification: {
      title: `${snapshot.data().name} rank: ${snapshot.data().rating}`,
      body: 'Topic: ' + `${snapshot.data().topic}` + '\n' + (know ? ('You should know: ' + know) : '') + '\n' + (question ? ('Asked: ' + question) : ''),
      icon: snapshot.data().profile_img || '/images/profile_placeholder.png',
      click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`
    }
  };
  // DEBUG: console.log('Successfully created notification payload');

  // Get the list of device tokens.
  /**
  const allUsers = await admin.firestore().collection('fcmTokens').get();
  const tokens = [];
  allUsers.forEach((tokenDoc) => {
    // DEBUG: console.log(tokenDoc.data().role);
    if (tokenDoc.data().role == 'teacher') {
      tokens.push(tokenDoc.id);
    }
  });
  **/
  const allUsers = await admin.firestore().collection('users').get();
  const users = [];
  allUsers.forEach((user) => {
    // DEBUG: console.log(tokenDoc.data().role);
    if (user.data().role == 'teacher') {
      if (user.data().codes.includes(classCode)) {
        users.push(user.data().token);
      }
    }
  });

  if (users.length > 0) {
    // Send notifications to all tokens.
    const response = await admin.messaging().sendToDevice(users, payload);
    console.log(response);
    // Cleanup no longer needed, tokens update within user's attribute
    //await cleanupTokens(response, users);
    console.log('Notifications have been sent and tokens cleaned up.');
    console.log('Notifications were sent to :' + users);
  }
});

// Cleans up the tokens that are no longer valid.
function cleanupTokens(response, tokens) {
 // For each notification we check if there was an error.
 const tokensDelete = [];
 response.results.forEach((result, index) => {
   const error = result.error;
   if (error) {
     console.error('Failure sending notification to', tokens[index], error);
     // Cleanup the tokens who are not registered anymore.
     if (error.code === 'messaging/invalid-registration-token' ||
         error.code === 'messaging/registration-token-not-registered') {
       const deleteTask = admin.firestore().collection('fcmTokens').doc(tokens[index]).delete();
       tokensDelete.push(deleteTask);
     }
   }
 });
 return Promise.all(tokensDelete);
}

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
