import { bootstrapApplication } from '@angular/platform-browser';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideFunctions, getFunctions } from '@angular/fire/functions'; // Add this
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http'; // Add this import
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { routes } from './app/app.routes';

// Import browserSessionPersistence directly from 'firebase/auth'
import { browserSessionPersistence } from 'firebase/auth';

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    // Configure Auth with persistence directly here
    provideAuth(() => {
      const auth = getAuth();
      // Ensure session persistence is applied; log if it fails
      void auth.setPersistence(browserSessionPersistence).catch(err => {
        console.error('Failed to set auth persistence', err);
      });
      return auth;
    }),
    provideRouter(routes),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideFunctions(() => getFunctions()), // Add this
    provideHttpClient() // Add this line - it's essential for HttpClient
  ],
});