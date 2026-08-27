# SelahCMS

SelahCMS is an Angular 19 + Firebase application for managing church learning, events, attendance, study materials, and user administration.

## Stack
- Angular 19 (standalone components, Angular Material)
- Firebase (Auth, Firestore, Storage)
- RxJS 7

## Getting started
```bash
npm install
npm start            # runs ng serve on http://localhost:4200
```

## Firebase configuration
Firebase config lives in `src/environments/environment.ts`. Make sure it matches your Firebase project:
```ts
export const environment = {
  production: false,
  appVersion: '1.0.0',
  firebase: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
    measurementId: '...'
  },
  apiUrl: 'https://backend.main.api.geuc.et/api/v1'
};
```

## Development scripts
- `npm start` – run the dev server
- `npm run build` – production build to `dist/`
- `npm test` – unit tests (Karma)
- `npm run clean` – clear Angular cache

## Notes
- Auth uses session persistence; ensure Firebase Auth is enabled in your project.
- Firestore/Storage rules are in `firestore.rules` and `storage.rules`; deploy them via Firebase CLI as needed.
