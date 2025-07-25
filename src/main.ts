import { bootstrapApplication } from '@angular/platform-browser';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { routes } from './app/app.routes';

// Import browserSessionPersistence directly from 'firebase/auth'
import { browserSessionPersistence } from 'firebase/auth'; // <-- NEW IMPORT

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Configure Auth with persistence directly here
    provideAuth(() => {
      const auth = getAuth();
      // Set persistence immediately after getting the auth instance
      // No need for .catch() here, as errors would be caught by bootstrapApplication
      auth.setPersistence(browserSessionPersistence);
      return auth;
    }),
    provideRouter(routes),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage())
  ],
});
