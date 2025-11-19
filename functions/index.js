const functions = require('firebase-functions');
const {onDocumentCreated, onDocumentUpdated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

initializeApp();

const sendNotificationToRoom = async (roomId, currentUserId, payload) => {
  logger.log(`Attempting to send notification for room ${roomId}. Payload:`, payload);

  const roomDoc = await getFirestore().collection("rooms").doc(roomId).get();
  if (!roomDoc.exists) {
    logger.error("Room document does not exist.");
    return;
  }
  const roomData = roomDoc.data();
  const members = roomData.members.filter((id) => id !== currentUserId);

  if (members.length === 0) {
    logger.log("No other members in the room to notify.");
    return;
  }

  const userPromises = members.map((id) => getFirestore().collection("users").doc(id).get());
  const userDocs = await Promise.all(userPromises);

  const tokens = userDocs
      .map((doc) => doc.exists && doc.data().fcmToken)
      .filter(Boolean);

  if (tokens.length > 0) {
    logger.log(`Found ${tokens.length} tokens. Preparing to send multicast message.`);
    
    // --- CORRECTED METHOD ---
    // The payload needs to be inside a 'message' object for multicast
    const message = {
      notification: payload.notification,
      webpush: payload.webpush,
      tokens: tokens, // Pass tokens here
    };

    // Use sendEachForMulticast instead of sendToDevice
    return getMessaging().sendEachForMulticast(message)
      .then((response) => {
        logger.log("Successfully sent message:", response);
      })
      .catch((error) => {
        logger.error("Error sending message:", error);
      });
    // --- END CORRECTION ---

  } else {
    logger.warn("No valid FCM tokens found for any members.");
  }
};

// --- NOTIFICATION TRIGGERS (Unchanged, they call the corrected helper function) ---

exports.onNewMessage = onDocumentCreated({
    document: "/rooms/{roomId}/messages/{messageId}",
    region: "asia-south1",
}, async (event) => {
  const messageData = event.data.data();
  const roomId = event.params.roomId;
  const payload = {
    notification: {
      title: `New message in ${messageData.roomName || "your room"}`,
      body: `${messageData.senderName}: ${messageData.text.substring(0, 100)}`,
    },
    webpush: {fcmOptions: {link: `/room.html?id=${roomId}`}},
  };
  return sendNotificationToRoom(roomId, messageData.senderId, payload);
});

exports.onNewTask = onDocumentCreated({
    document: "/rooms/{roomId}/tasks/{taskId}",
    region: "asia-south1",
}, async (event) => {
  const taskData = event.data.data();
  const roomId = event.params.roomId;
  const payload = {
    notification: {
      title: `New Task Added`,
      body: `A new task was added: "${taskData.text}"`,
    },
    webpush: {fcmOptions: {link: `/room.html?id=${roomId}`}},
  };
  return sendNotificationToRoom(roomId, taskData.createdBy, payload);
});

exports.onTaskUpdated = onDocumentUpdated({
    document: "/rooms/{roomId}/tasks/{taskId}",
    region: "asia-south1",
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const roomId = event.params.roomId;
  if (beforeData.completed === false && afterData.completed === true) {
    const payload = {
      notification: {
        title: `Task Completed!`,
        body: `The task "${afterData.text}" was marked as complete.`,
      },
      webpush: {fcmOptions: {link: `/room.html?id=${roomId}`}},
    };
    return sendNotificationToRoom(roomId, null, payload);
  }
  return null;
});

exports.onTaskDeleted = onDocumentDeleted({
    document: "/rooms/{roomId}/tasks/{taskId}",
    region: "asia-south1",
}, async (event) => {
  const deletedData = event.data.data();
  const roomId = event.params.roomId;
  const payload = {
    notification: {
      title: `Task Deleted`,
      body: `The task "${deletedData.text}" was deleted.`,
    },
    webpush: {fcmOptions: {link: `/room.html?id=${roomId}`}},
  };
  return sendNotificationToRoom(roomId, null, payload);
});

// HTTP function that returns client Firebase config stored in environment
exports.clientConfig = functions.https.onRequest(async (req, res) => {
  try {
    // Try to read from Firebase Functions runtime config (set via `firebase functions:config:set client.key="value"`)
    const cfgFromFn = (functions.config && functions.config().client) || null;

    const config = cfgFromFn || {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    };

    // Allow cross-origin requests from hosting
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.set('Cache-Control', 'public, max-age=300');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    return res.json(config);
  } catch (err) {
    logger.error('Error returning client config', err);
    return res.status(500).json({error: 'Failed to load client config'});
  }
});