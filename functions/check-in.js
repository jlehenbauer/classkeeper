const functions = require('firebase-functions');

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

// Sends a notifications to all users when a new message is posted.
exports.sendNotifications = functions.firestore.document('check-ins/{messageId}').onCreate(
  async (snapshot) => {
    // Notification details.
    const question = snapshot.data().question;
    const know = sanpshot.data().pleaseKnow;
    const payload = {
      notification: {
        title: `${snapshot.data().name} checked in at a ${snapshot.data().feeling}`,
        body: know ? ('You should know: ' + know) : '' + question ? ('Asked: ' + question) : '',
        //body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
        icon: snapshot.data().profilePicUrl || '/images/profile_placeholder.png',
        click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
      }
    };
    console.log(payload);

    // Get the list of device tokens.
    const allTokens = await admin.firestore().collection('fcmTokens').get();
    const tokens = [];
    allTokens.forEach((tokenDoc) => {
      //if (tokenDoc.role == "teacher") {
      tokens.push(tokenDoc.id);
      //}
    });

    if (tokens.length > 0) {
      // Send notifications to all tokens.
      const response = await admin.messaging().sendToDevice(tokens, payload);
      await cleanupTokens(response, tokens);
      console.log('Notifications have been sent and tokens cleaned up.');
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
       const deleteTask = admin.firestore().collection('check-ins').doc(tokens[index]).delete();
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
