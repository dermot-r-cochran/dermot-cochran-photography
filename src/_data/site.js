module.exports = function () {
  const domain = String(process.env.SITE_DOMAIN || "dermotcochran.com").replace(/\/+$/, "");

  return {
    name: "Dermot Cochran Photography",
    title: "Dermot Cochran Photography",
    description: "Photography portfolio of Dermot R. Cochran — nature, landscape, and wildlife.",
    url: `https://${domain}/`,
    author: "Dermot R. Cochran",
    language: "en"
  };
};
