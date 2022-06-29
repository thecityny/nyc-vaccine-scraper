const fs = require("fs");
const tableauScraper = require("./tableau-scraper");
const publicHost = "https://public.tableau.com";
const nysHost = "https://covid19tracker.health.ny.gov";

async function downloadData(path, host, slug, tableKey) {
  const config = await tableauScraper.queryConfig(host, slug);
  const [info, data] = await tableauScraper.queryData(host, config);
  const views = info["worldUpdate"]["applicationPresModel"]["workbookPresModel"]["dashboardPresModel"]["viewIds"];
  
  if (views[tableKey]) {
    const data = await (host === nysHost
      ? tableauScraper.queryTableServer(host, config, views[tableKey])
      : tableauScraper.queryTablePublic(host, config, views[tableKey]));
  
    console.log(`Saving "${tableKey}" from ${slug} to ${path}`);
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } else {
    console.error(`Table "${tableKey}" does not exist. Update the scraper with one of the following:\n ${JSON.stringify(Object.keys(views), null, 2)}`);
  }
};

async function main() {
  try {
    await Promise.all([
      downloadData("vaccine-data.json", publicHost, "COVID-19VaccineTrackerDashboard_16153822244270/AllPeopleVaccination", "NYC v NON NYC overall"),
      downloadData("map-data.json", publicHost, "COVID-19VaccineTrackerDashboard_16153822244270/Geography", "Map ZIP"),
      // downloadData("hospitalization-data.json", nysHost, "DailyHospitalizationSummary/Reopening-DailyHospitalization", "Chart (2)")
    ]);
  } catch (e) {
    if (e.request) {
      const url = new URL(e.request.path, `${e.request.protocol}//${e.request.host}`);
      console.error(e.message, url.href);
    } else {
      console.error(e.message);
    }
  }
}

main();