// Save as: src/constants/portfolioOptions.js
// Shared by PortfolioPage (dashboard), PublicPortfolio (client-facing) and PortfolioLightbox.

export const GENDER_LABELS = {
  Male: "Men's Wear",
  Female: "Women's Wear",
  Unisex: 'Unisex',
  Kids: "Kids' Wear",
};

// Short labels for filter tabs / form buttons
export const GENDER_TABS = [
  { value: 'Female', label: 'Women' },
  { value: 'Male', label: 'Men' },
  { value: 'Unisex', label: 'Unisex' },
  { value: 'Kids', label: 'Kids' },
];

export const CATEGORIES = [
  'Senator / Native',
  'Agbada',
  'Kaftan',
  'Ankara',
  'Aso Ebi',
  'Bridal / Wedding',
  'Gown / Dress',
  'Suit / Corporate',
  'Casual',
  'Traditional',
  'Uniform',
  'Other',
];

export const OCCASIONS = [
  'Wedding',
  'Corporate',
  'Casual',
  'Party',
  'Church',
  'Traditional Ceremony',
  'Graduation',
  'Other',
];

export const formatNaira = (n) => `₦${Number(n).toLocaleString()}`;

export const formatMonthYear = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
