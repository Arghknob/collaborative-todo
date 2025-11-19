importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Fetch client config from the functions endpoint and initialize Firebase
fetch('/__/clientConfig')
  .then((r) => r.json())
  .then((firebaseConfig) => {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle incoming messages when the app is in the background
    messaging.onBackgroundMessage(function(payload) {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon,
        data: {
            url: payload.fcmOptions.link
        }
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener('notificationclick', function(event) {
      const clickedNotification = event.notification;
      clickedNotification.close();

      const urlToOpen = clickedNotification.data.url;

      const promiseChain = clients.openWindow(urlToOpen);
      event.waitUntil(promiseChain);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize firebase messaging in service worker', err);
  });
// end