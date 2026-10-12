const User = require('../models/User');
const Payment = require('../models/Payment');
const { PRO_PRICE_NAIRA } = require('../config/plans');

const TAILORS = { role: 'user' };

// One definition of a tailor's plan, used by every admin page.
// Dates decide it, not just the stored plan, because an account is only downgraded in the
// database when that tailor next makes a request.
const getPlanLabel = (user, now = new Date()) => {
  const paidActive =
    user.plan === 'pro' && (!user.subscriptionEnd || new Date(user.subscriptionEnd) > now);
  if (paidActive) return 'PRO';

  const trialing =
    user.subscriptionStatus === 'trial' && user.trialEnd && new Date(user.trialEnd) > now;
  if (trialing) return 'TRIAL';

  return 'FREE';
};

const withPlanLabel = (tailors, now = new Date()) =>
  tailors.map((t) => ({ ...t, planLabel: getPlanLabel(t, now) }));

const getCounts = async (now = new Date()) => {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalTailors, proTailors, trialTailors, collected] = await Promise.all([
    User.countDocuments(TAILORS),
    User.countDocuments({
      ...TAILORS,
      plan: 'pro',
      $or: [{ subscriptionEnd: null }, { subscriptionEnd: { $gt: now } }]
    }),
    User.countDocuments({
      ...TAILORS,
      plan: { $ne: 'pro' },
      subscriptionStatus: 'trial',
      trialEnd: { $gt: now }
    }),
    Payment.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  return {
    totalTailors,
    proTailors,
    trialTailors,
    mrr: proTailors * PRO_PRICE_NAIRA,
    collectedThisMonth: Math.round((collected[0]?.total || 0) / 100) // payments are stored in kobo
  };
};

const getRecentTailors = async (limit = 5, now = new Date()) => {
  const tailors = await User.find(TAILORS)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('fullName businessName email createdAt plan subscriptionStatus trialEnd subscriptionEnd')
    .lean();
  return withPlanLabel(tailors, now);
};

module.exports = { getPlanLabel, withPlanLabel, getCounts, getRecentTailors };
