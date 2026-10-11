// One definition of "has Pro access" so every route agrees
const hasProAccess = (user, now = new Date()) => {
  if (!user) return false;
  const paid = user.plan === 'pro' && (!user.subscriptionEnd || user.subscriptionEnd > now);
  const trialing =
    user.subscriptionStatus === 'trial' && Boolean(user.trialEnd) && user.trialEnd > now;
  return paid || trialing;
};

module.exports = { hasProAccess };
