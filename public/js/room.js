document.addEventListener('DOMContentLoaded', () => {
    console.log("Room.js loaded.");

    const roomNameDisplay = document.getElementById('room-name');
    const tasksList = document.getElementById('tasks-list');
    const messagesList = document.getElementById('messages');
    const membersList = document.getElementById('members-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const newTaskInput = document.getElementById('new-task-input');
    const newMessageInput = document.getElementById('new-message-input');

    let currentUser;
    let currentRoomId;
    let unsubscribeTasks, unsubscribeMessages, unsubscribeRoom; // Combined room/member listener

    const params = new URLSearchParams(window.location.search);
    currentRoomId = params.get('id');
    if (!currentRoomId) {
        alert('No room ID specified.');
        window.location.href = '/dashboard.html';
        return;
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            verifyUserMembership();
        } else {
            // Unsubscribe from all listeners on logout
            if (unsubscribeTasks) unsubscribeTasks();
            if (unsubscribeMessages) unsubscribeMessages();
            if (unsubscribeRoom) unsubscribeRoom();
        }
    });

    const verifyUserMembership = async () => {
        console.log("Verifying user membership...");
        const roomRef = db.collection('rooms').doc(currentRoomId);
        const roomDoc = await roomRef.get();
        if (!roomDoc.exists) {
            alert('This room does not exist.');
            window.location.href = '/dashboard.html';
            return;
        }
        const roomData = roomDoc.data();
        if (!roomData.members.includes(currentUser.uid)) {
            alert('You are not a member of this room.');
            window.location.href = '/dashboard.html';
            return;
        }
        console.log("User is a member. Setting up listeners.");
        roomNameDisplay.textContent = roomData.name;
        listenToTasks();
        listenToMessages();
        listenToRoomData(); // Changed from listenToMembers to a more robust function
    };

    const listenToRoomData = () => {
        if (unsubscribeRoom) unsubscribeRoom();
        console.log("Setting up listener for room data and members.");
        unsubscribeRoom = db.collection('rooms').doc(currentRoomId).onSnapshot(async (doc) => {
            if (doc.exists) {
                console.log("Room data updated. Re-rendering members.");
                const memberIds = doc.data().members || [];
                // This function will now be called every time the room document changes
                await renderMembers(memberIds);
            }
        });
    };
    
    const renderMembers = async (memberIds) => {
        membersList.innerHTML = '<li>Loading...</li>';
        console.log(`Rendering members for ${memberIds.length} IDs.`);
        if (memberIds.length === 0) {
            membersList.innerHTML = '<li>No members found.</li>';
            return;
        }
        
        try {
            const memberPromises = memberIds.map(id => db.collection('users').doc(id).get());
            const memberDocs = await Promise.all(memberPromises);
            
            membersList.innerHTML = ''; // Clear the list before re-populating
            memberDocs.forEach(doc => {
                if (doc.exists) {
                    const li = document.createElement('li');
                    li.textContent = doc.data().name;
                    membersList.appendChild(li);
                } else {
                    console.warn("A member's user document was not found for an ID in the members list.");
                }
            });
             console.log("Member list rendering complete.");
        } catch (error) {
            console.error("Error rendering members:", error);
            membersList.innerHTML = '<li>Error loading members.</li>';
        }
    };

    

    const listenToTasks = () => {
        if (unsubscribeTasks) unsubscribeTasks();
        unsubscribeTasks = db.collection('rooms').doc(currentRoomId).collection('tasks')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                tasksList.innerHTML = '';
                snapshot.forEach(doc => {
                    const task = doc.data();
                    const li = document.createElement('li');
li.className = task.completed ? 'completed' : '';
li.innerHTML = `
                        <input type="checkbox" data-id="${doc.id}" ${task.completed ? 'checked' : ''}>
                        <span>${task.text}</span>
                        <button class="delete-task-btn" data-id="${doc.id}">Delete</button>
                    `;
tasksList.appendChild(li);
                });
            });
    };
    
    const addTask = async () => {
        const taskText = newTaskInput.value.trim();
        if (taskText === '' || !currentUser || !currentRoomId) return;
        await db.collection('rooms').doc(currentRoomId).collection('tasks').add({
            text: taskText,
            completed: false,
            createdBy: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        newTaskInput.value = '';
    };

    const toggleTask = async (taskId, isCompleted) => {
        await db.collection('rooms').doc(currentRoomId).collection('tasks').doc(taskId).update({
            completed: isCompleted
        });
    };

    const deleteTask = async (taskId) => {
        if (confirm('Are you sure you want to delete this task?')) {
            await db.collection('rooms').doc(currentRoomId).collection('tasks').doc(taskId).delete();
        }
    };
    
    tasksList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.type === 'checkbox') {
            const taskId = target.getAttribute('data-id');
            toggleTask(taskId, target.checked);
        } else if (target.classList.contains('delete-task-btn')) {
            const taskId = target.getAttribute('data-id');
            deleteTask(taskId);
        }
    });
    
    addTaskBtn.addEventListener('click', addTask);
    newTaskInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') addTask();
    });

    const listenToMessages = () => {
        if (unsubscribeMessages) unsubscribeMessages();
        unsubscribeMessages = db.collection('rooms').doc(currentRoomId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                messagesList.innerHTML = '';
                snapshot.forEach(doc => {
                    const message = doc.data();
                    const ts = message.timestamp ? message.timestamp.toDate().toLocaleTimeString() : '';
                    const li = document.createElement('li');
li.innerHTML = `
                        <span class="sender">${message.senderName}:</span>
                        <span class="text">${message.text}</span>
                        <span class="timestamp">${ts}</span>
                    `;
messagesList.appendChild(li);
                });
                messagesList.scrollTop = messagesList.scrollHeight;
            });
    };

    const sendMessage = async () => {
        const messageText = newMessageInput.value.trim();
        if (messageText === '' || !currentUser || !currentRoomId) return;
        
        await db.collection('rooms').doc(currentRoomId).collection('messages').add({
            text: messageText,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            roomName: roomNameDisplay.textContent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        newMessageInput.value = '';
    };

    sendMessageBtn.addEventListener('click', sendMessage);
    newMessageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});