// Firebase cloud sync for Musical Bhailog. No Firebase Storage is used.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// Firebase Console > Project settings > Your apps > SDK setup and configuration.
const firebaseConfig = {
  apiKey: 'AIzaSyAHF40_of79UJj3XSsFxoDe1x9UCkgUf8A',
  authDomain: 'bhailog-e5bf2.firebaseapp.com',
  projectId: 'bhailog-e5bf2',
  storageBucket: 'bhailog-e5bf2.firebasestorage.app',
  messagingSenderId: '525215132301',
  appId: '1:525215132301:web:4f5922e566d47b0e6010c4'
};
// Replace with the exact email you create in Firebase Authentication.
const adminEmailAllowlist = ['bhailogdbg001@gmail.com'];
const configured = firebaseConfig.apiKey !== 'PASTE_API_KEY_HERE' &&
  firebaseConfig.projectId !== 'PASTE_PROJECT_ID_HERE' &&
  firebaseConfig.appId !== 'PASTE_APP_ID_HERE';

if (!configured) {
  console.info('Firebase setup required. Until configured, edits stay in this browser only.');
  window.addEventListener('mb:admin-login-request', () => alert('Firebase is not configured yet. Follow FIREBASE_SETUP_HI.txt, then publish the folder on GitHub Pages.'));
  window.dispatchEvent(new CustomEvent('mb:sync-status', { detail: { message: 'Firebase setup required' } }));
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const contentRef = doc(db, 'website', 'publicContent');
  let applyingRemote = false;
  let writeQueue = Promise.resolve();

  onSnapshot(contentRef, snapshot => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (!data || !data.state) return;
    applyingRemote = true;
    window.dispatchEvent(new CustomEvent('mb:state-load', { detail: { state: data.state } }));
    queueMicrotask(() => { applyingRemote = false; });
  }, error => console.error('Firebase content read failed:', error));

  window.addEventListener('mb:state-save', event => {
    if (applyingRemote) return;
    const user = auth.currentUser;
    if (!user || !adminEmailAllowlist.includes((user.email || '').toLowerCase())) return;
    const state = event.detail?.state;
    if (!state) return;
    writeQueue = writeQueue.then(() => setDoc(contentRef, {
      state,
      updatedAt: new Date().toISOString(),
      updatedBy: user.email
    })).catch(error => {
      console.error('Firebase content save failed:', error);
      alert('Cloud save failed. Check Firestore rules and internet connection.');
    });
  });

  window.addEventListener('mb:admin-login-request', async event => {
    const email = (event.detail?.email || '').trim().toLowerCase();
    const password = event.detail?.password || '';
    if (!adminEmailAllowlist.includes(email)) {
      alert('This email is not on the admin allowlist. Update adminEmailAllowlist in firebase-sync.js.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message || 'Admin login failed. Check your Firebase email and password.');
    }
  });

  onAuthStateChanged(auth, user => {
    if (user && adminEmailAllowlist.includes((user.email || '').toLowerCase())) {
      document.querySelector('#adminLoginScreen')?.classList.add('hidden');
      document.querySelector('#adminModal')?.classList.add('open');
      window.dispatchEvent(new CustomEvent('mb:sync-status', { detail: { message: 'Cloud sync connected' } }));
    }
  });
  document.querySelector('#closeAdmin')?.addEventListener('click', () => {
    if (auth.currentUser) signOut(auth).catch(error => console.error('Sign out failed:', error));
  });
}
