module.exports = function () {
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  return {
    year: currentYear,
    copyrightYears: currentYear > startYear ? `${startYear}\u2013${currentYear}` : `${startYear}`,
  };
};
