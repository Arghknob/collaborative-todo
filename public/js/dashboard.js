document.addEventListener('DOMContentLoaded', () => {
    console.log("dashboard.js loaded and running.");

    const userDisplay = document.getElementById('user-display');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const roomsList = document.getElementById('rooms-list');
    const newRoomNameInput = document.getElementById('new-room-name');
    const joinRoomCodeInput = document.getElementById('join-room-code');

    let currentUser;
    let unsubscribeUserRooms;

    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Auth state changed: User is LOGGED IN.", user);
            currentUser = user;
            userDisplay.textContent = `Welcome, ${user.displayName || user.email}`;
            
            listenToUserRooms(user.uid);
            
            // --- NEW ---: Call the function to set up notifications
            setupNotifications(user.uid);

            newRoomNameInput.disabled = false;
            createRoomBtn.disabled = false;
            joinRoomCodeInput.disabled = false;
            joinRoomBtn.disabled = false;
        } else {
            console.log("Auth state changed: User is LOGGED OUT.");
            currentUser = null;
            if (unsubscribeUserRooms) unsubscribeUserRooms();
            
            newRoomNameInput.disabled = true;
            createRoomBtn.disabled = true;
            joinRoomCodeInput.disabled = true;
            joinRoomBtn.disabled = true;
        }
    });

    const listenToUserRooms = (userId) => {
        if (unsubscribeUserRooms) unsubscribeUserRooms();
        unsubscribeUserRooms = db.collection('users').doc(userId)
            .onSnapshot(async (doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    const roomIds = userData.rooms || [];
                    renderRooms(roomIds);
                }
            });
    };

    const renderRooms = async (roomIds) => {
        roomsList.innerHTML = 'Loading rooms...';
        if (roomIds.length === 0) {
            roomsList.innerHTML = '<li>You have not joined any rooms yet.</li>';
            return;
        }
        const roomPromises = roomIds.map(id => db.collection('rooms').doc(id).get());
        const roomDocs = await Promise.all(roomPromises);
        roomsList.innerHTML = '';
        roomDocs.forEach(doc => {
            if (doc.exists) {
                const room = doc.data();
                const li = document.createElement('li');
                li.innerHTML = `
                    <a href="/room.html?id=${doc.id}">${room.name}</a>
                    <span>Join Code: ${room.code}</span>
                    <button class="leave-room-btn" data-room-id="${doc.id}">Leave Room</button>
                `;
                roomsList.appendChild(li);
            }
        });
    };
    
    roomsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('leave-room-btn')) {
            const roomId = e.target.getAttribute('data-room-id');
            leaveRoom(roomId);
        }
    });

    // --- NEW FUNCTION FOR NOTIFICATIONS ---
    const setupNotifications = async (userId) => {
        const messaging = firebase.messaging();
        
        // =======================================================================
        // IMPORTANT: REPLACE THIS KEY WITH THE ONE FROM YOUR FIREBASE CONSOLE
        // Project Settings > Cloud Messaging > Web configuration > Web Push certificates
        const vapidKey = "BHABTWqfSYMIWNFoc7f181L8jGiB0aSPFMBLK75HZzTBb9gFITV1fMSXkErmLpeIxWmgsON5cUJBUyx9oLFcx7o";
        // =======================================================================
        
        try {
        await Notification.requestPermission();
        console.log("Notification permission granted."); // You should see this

        const token = await messaging.getToken({ vapidKey: vapidKey });
        if (token) {
            console.log('FCM Token generated:', token); // You should see the token
            await db.collection('users').doc(userId).set({ 
                fcmToken: token 
            }, { merge: true });
            console.log("FCM Token saved to Firestore."); // You should see this
        } else {
            console.log('No registration token available.');
        }
    } catch (err) {
        console.error('Error getting FCM token:', err); // Check for errors here
    }
};
    const createRoom = async () => {
        console.log("createRoom function called.");
        const roomName = newRoomNameInput.value.trim();
        console.log(`Room name entered: "${roomName}"`);
        console.log("Current user object:", currentUser);
        if (!roomName || !currentUser) {
            console.error("Stopping: Room name is empty or user is not logged in.");
            alert("Please enter a room name and ensure you are logged in.");
            return;
        }
        try {
            console.log("Attempting to create room in Firestore...");
            const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const roomRef = await db.collection('rooms').add({
                name: roomName,
                code: joinCode,
                createdBy: currentUser.uid,
                members: [currentUser.uid]
            });
            console.log("Room created successfully with ID:", roomRef.id);
            console.log("Attempting to update user document...");
            await db.collection('users').doc(currentUser.uid).update({
                rooms: firebase.firestore.FieldValue.arrayUnion(roomRef.id)
            });
            console.log("User document updated successfully.");
            newRoomNameInput.value = '';
            alert(`Room created! Join code: ${joinCode}`);
        } catch (error) {
            console.error("An error occurred in createRoom function:", error);
            alert("Failed to create room. Check the developer console (F12) for more details.");
        }
    };

    const joinRoom = async () => {
        console.log("joinRoom function called.");
        const joinCode = joinRoomCodeInput.value.trim().toUpperCase();
        console.log(`Join code entered: "${joinCode}"`);
        console.log("Current user object:", currentUser);
        if (!joinCode || !currentUser) {
            console.error("Stopping: Join code is empty or user is not logged in.");
            alert("Please enter a join code and ensure you are logged in.");
            return;
        }
        try {
            console.log(`Querying for room with code: ${joinCode}`);
            const roomsQuery = await db.collection('rooms').where('code', '==', joinCode).get();
            if (roomsQuery.empty) {
                console.warn("No room found with that code.");
                alert('Room not found with that code.');
                return;
            }
            const roomDoc = roomsQuery.docs[0];
            const roomId = roomDoc.id;
            console.log(`Room found with ID: ${roomId}`);
            console.log("Attempting to update room members...");
            await db.collection('rooms').doc(roomId).update({
                members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
            console.log("Room members updated.");
            console.log("Attempting to update user's room list...");
            await db.collection('users').doc(currentUser.uid).update({
                rooms: firebase.firestore.FieldValue.arrayUnion(roomId)
            });
            console.log("User's room list updated.");
            joinRoomCodeInput.value = '';
            alert('Successfully joined room!');
        } catch (error) {
            console.error("An error occurred in joinRoom function:", error);
            alert("Failed to join room. Check the developer console (F12) for more details.");
        }
    };

    const leaveRoom = async (roomId) => {
        if (!roomId || !currentUser) return;
        if (!confirm('Are you sure you want to leave this room?')) return;
        try {
            await db.collection('rooms').doc(roomId).update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
            await db.collection('users').doc(currentUser.uid).update({ rooms: firebase.firestore.FieldValue.arrayRemove(roomId) });
            alert('You have left the room.');
        } catch(error) {
            console.error("Error leaving room:", error);
            alert("Could not leave the room. Check console for details.");
        }
    };

    console.log("Adding click listeners to buttons.");
    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
});