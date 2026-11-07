// Structured data for image search, kept out of .eleventy.js so it is
// unit-testable (test/structured-data.test.js) without booting Eleventy.
//
// Added 7 November 2026 at Dermot's "Yes, photography first": the site's
// pages, titles and alt text were already right, but nothing told a search
// engine who made a photograph, under what licence, where, or what it shows.
// Each photo page now carries one schema.org ImageObject as JSON-LD. Google
// Images reads creator, creditText, copyrightNotice, license and
// acquireLicensePage for its credit line and "Licensable" badge.
//
// Keywords are derived, never hand-written: the category, the subjects with
// their parents, the two derived scopes, the place, the country, the album and
// the year, which are the same facts the page's own meta rows show. There is
// deliberately no <meta name="keywords"> tag: Google ignores it. Keywords go
// out as a list, since place names carry commas of their own. The description
// is the alt text, the one line on every photo that says what is in it; the
// page's meta description is a computed formula where a photo has none.

const { countryOf, naturalOrBuilt, subjectsWithParents, wildOrCultivated } = require("./derivations.js");

const CREATOR = "Dermot R. Cochran";
const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-nd/4.0/";

function absolute(pathname, siteUrl) {
  return new URL(String(pathname).replace(/^\/+/, ""), siteUrl).toString();
}

function photoKeywords(data) {
  const words = [
    data.category,
    ...subjectsWithParents(data.subjects),
    wildOrCultivated(data),
    naturalOrBuilt(data),
    data.location,
    countryOf(data.location),
    data.album,
    data.year && String(data.year)
  ];
  return [...new Set(words.filter(Boolean))];
}

function photoImageObject(data, pageUrl, siteUrl) {
  const creator = { "@type": "Person", name: CREATOR, url: absolute("/about/", siteUrl) };
  const object = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: data.title,
    contentUrl: absolute(`/images/photos/${data.image}`, siteUrl),
    url: absolute(pageUrl, siteUrl),
    description: data.alt,
    creator,
    copyrightHolder: creator,
    creditText: CREATOR,
    copyrightNotice: `© ${data.copyrightYear || data.year} ${CREATOR}`,
    license: LICENSE_URL,
    acquireLicensePage: absolute("/license/", siteUrl),
    keywords: photoKeywords(data)
  };
  if (data.year) object.dateCreated = String(data.year);
  if (data.location) object.contentLocation = { "@type": "Place", name: data.location };
  return object;
}

// JSON for inside a <script> element: "<" is escaped so no field can close
// the element early.
function jsonLd(object) {
  return JSON.stringify(object).replace(/</g, "\\u003c");
}

module.exports = { photoImageObject, photoKeywords, jsonLd };
