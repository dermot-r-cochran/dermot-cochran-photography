const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Short content hash of a source asset, used as a ?v= cache-busting token.
// The host (openresty/cPanel) force-adds `Cache-Control: max-age=2592000` to
// every static asset regardless of what .htaccess asks for, and our CSS/JS
// filenames aren't fingerprinted - so without this, a deployed fix could sit
// stale in browsers for up to 30 days. Hashing content (rather than using a
// build timestamp) means the URL only changes when the file actually does.
function assetVersion(relativePath) {
  try {
    const buf = fs.readFileSync(path.join(__dirname, "..", relativePath));
    return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch (err) {
    // Never fail a build over a cache-busting token.
    console.warn(`[build.js] could not hash ${relativePath}: ${err.message}`);
    return "0";
  }
}

module.exports = function () {
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  return {
    year: currentYear,
    copyrightYears: currentYear > startYear ? `${startYear}–${currentYear}` : `${startYear}`,
    cssVersion: assetVersion("css/main.css"),
    slideshowVersion: assetVersion("js/slideshow.js"),
    // What this build is shipping, stamped into <meta name="site-version">
    // and /version.txt so the live domain can be checked from outside with
    // one request - the only test that covers the whole chain (merge, cron
    // pull, build, rsync) rather than trusting that a green deploy meant the
    // files actually landed. Set by scripts/deploy-lib.sh from `git
    // describe`; this repo carries no release tags, so it reads as the short
    // commit. "dev" means the build did not come through the cPanel deploy
    // path (a local build, or a GitHub Pages PR preview), which is worth
    // being able to tell apart from a real deploy.
    version: process.env.DEPLOY_VERSION || "dev",
    builtAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
};
