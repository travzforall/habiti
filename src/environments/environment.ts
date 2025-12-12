export const environment = {
  production: false,
  baserow: {
    apiUrl: 'https://db.jollycares.com/api/database/rows/table',
    token: 'N7OzGYtyscWg1D9mmokf3k149JZB2diH',
    tables: {
      taskUpdates: 508,
      tasks: 509,
      agents: 506,
      projects: 507,
      comments: 510,
      milestones: 511,
      sessions: 512,
    },
  },
  xano: {
    apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:pWFaI9Bq',
    endpoints: {
      auth: {
        login: '/auth/login',
        register: '/auth/signup',
        logout: '/auth/logout',
        refresh: '/auth/refresh',
        me: '/auth/me',
        forgotPassword: '/auth/forgot-password',
        resetPassword: '/auth/reset-password',
      },
      users: {
        profile: '/users/profile',
        update: '/users/update',
      },
    },
  },
  // Security & Monitoring Services
  wsUrl: 'wss://ws.jollycares.com',
  googleMapsApiKey: '', // Add your Google Maps API key here
  twilioAccountSid: '', // Add your Twilio Account SID here
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};
