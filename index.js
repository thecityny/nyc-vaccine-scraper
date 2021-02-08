const fs = require("fs");
const tableauScraper = require("./tableau-scraper");

async function main(path) {
  const host = "https://public.tableau.com";
  const slug = "COVID-19VaccineTracker-DailyNYCUpdate-adultsvaccinatedinNYC/AllAdults";

  const config = await tableauScraper.queryConfig(host, slug);
  const [info, data] = await tableauScraper.queryData(host, config);
  const views = info["worldUpdate"]["applicationPresModel"]["workbookPresModel"]["dashboardPresModel"]["viewIds"];
  
  const tableKey = "NYC v NON NYC overall";
  
  if (views[tableKey]) {
    const data = await tableauScraper.queryTable(host, config, views[tableKey]);
  
    console.log(`Saving NYC vaccine data to ${path}`);
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } else {
    console.error(`Vaccine table "${tableKey}" does not exist. Update the scraper with one of the following:\n ${JSON.stringify(Object.keys(views), null, 2)}`);
  }
}

try {
  main("vaccine-data.json");
} catch (e) {
  console.error(e);
}