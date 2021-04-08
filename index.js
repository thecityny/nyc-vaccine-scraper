const fs = require("fs");
const tableauScraper = require("./tableau-scraper");

async function downloadData(path, slug, tableKey) {
  const host = "https://public.tableau.com";

  const config = await tableauScraper.queryConfig(host, slug);
  const [info, data] = await tableauScraper.queryData(host, config);
  const views = info["worldUpdate"]["applicationPresModel"]["workbookPresModel"]["dashboardPresModel"]["viewIds"];
  
  if (views[tableKey]) {
    const data = await tableauScraper.queryTable(host, config, views[tableKey]);
  
    console.log(`Saving "${tableKey}" from ${slug} to ${path}`);
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } else {
    console.error(`Table "${tableKey}" does not exist. Update the scraper with one of the following:\n ${JSON.stringify(Object.keys(views), null, 2)}`);
  }
};

try {
  downloadData("vaccine-data.json", "COVID-19VaccineTrackerDashboard_16153822244270/AllPeopleVaccination", "NYC v NON NYC overall");
  downloadData("map-data.json", "COVID-19VaccineTrackerDashboard_16153822244270/Geography", "Map ZIP");
} catch (e) {
  console.error(e);
}