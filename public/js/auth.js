(async function init() {
    const resp = await fetch('/__/clientConfig');
    const firebaseConfig = await resp.json();

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in.
        console.log('User is signed in:', user);
        // If we are on the login page, redirect to the dashboard.
        if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html')) {
            window.location.href = '/dashboard.html';
        }
    } else {
        // User is signed out.
        console.log('User is signed out.');
        // If we are on any page other than the login page, redirect to login.
        if (!window.location.pathname.endsWith('/') && !window.location.pathname.endsWith('/index.html')) {
            window.location.href = '/index.html';
        }
    }
});

    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(result => {
                const user = result.user;

                const userRef = db.collection('users').doc(user.uid);
                userRef.set({
                    name: user.displayName,
                    email: user.email
                }, { merge: true });

            })
            .catch(error => {
                console.error('Error during sign-in:', error);
            });
    };

    const signOutUser = () => {
        auth.signOut().catch(error => {
            console.error('Error during sign-out:', error);
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', signInWithGoogle);
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', signOutUser);
        }
    });
})();