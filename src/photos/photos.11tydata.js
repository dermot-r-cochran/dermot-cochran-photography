const { execSync } = require("node:child_process");

// Falls back to the year a photo file was first committed when its front
// matter doesn't specify an exact `year` (e.g. undated older photos) - a
// reasonable stand-in for "year of first publication" when the exact
// capture year isn't known. Shallow clones (CI, PR previews) won't see the
// original commit and silently fall back to the current year.
function yearAdded(inputPath) {
  try {
    const out = execSync(
      `git log --follow --diff-filter=A --format=%ad --date=format:%Y -- "${inputPath}"`,
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] }
    ).toString().trim();
    const years = out.split("\n").filter(Boolean);
    return years.length ? Number(years[years.length - 1]) : new Date().getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

module.exports = {
  eleventyComputed: {
    copyrightYear: (data) => data.year || yearAdded(data.page.inputPath),
  },
};
