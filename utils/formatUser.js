// One shared shape for every endpoint that returns the user
const formatUser = (user) => ({
  _id: user._id,
  id: user._id, // kept for backward compatibility
  fullName: user.fullName,
  name: user.fullName, // kept for backward compatibility
  businessName: user.businessName,
  email: user.email,
  phone: user.phone,
  address: user.address || '',
  profilePhoto: user.profilePhoto || '',
  role: user.role,
  plan: user.plan,
  subscriptionStatus: user.subscriptionStatus,
  status: user.subscriptionStatus, // kept for backward compatibility
  trialStart: user.trialStart,
  trialEnd: user.trialEnd,
  subscriptionEnd: user.subscriptionEnd
});

module.exports = formatUser;