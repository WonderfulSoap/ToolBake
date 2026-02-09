// Local dev runtime config; overwrite values as needed for testing.
window.__SSR_CONFIG__ = { 
    sso: {
        github: {
            client_id: "Ov23ligP2SQfZ9hPSx3V",
            redirect_uri: "http://localhost:5173/sso/github/callback",
        },
        google: {
            client_id: "197412897564-r4bles21jgropthd21vl3nrc811lj30q.apps.googleusercontent.com",
            redirect_uri: "http://localhost:5173/sso/google/callback",
        }
    },
    password_login: false,
};
