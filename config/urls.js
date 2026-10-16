const LIVE_FRONTEND_URL = 'https://tailorpro-lpnb.onrender.com';

// The address of the website that users open. Used in reset emails and the payment redirect.
// Reads CLIENT_URL (what this project uses) and also accepts FRONTEND_URL.
const getFrontendUrl = () => {
  let fromEnv = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (fromEnv) {
    // A value pasted without https:// would produce a broken link
    if (!/^https?:\/\//i.test(fromEnv)) fromEnv = `https://${fromEnv}`;
    return fromEnv;
  }

  // On the live server, never fall back to localhost (Render sets RENDER=true on its services)
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    console.warn(`CLIENT_URL is not set. Using ${LIVE_FRONTEND_URL}. Set CLIENT_URL on the server.`);
    return LIVE_FRONTEND_URL;
  }

  return 'http://localhost:5173';
};

module.exports = { getFrontendUrl };
