const axios = require("axios");
const querystring = require("querystring");
const parse = require('csv-parse/lib/sync');

const jsdom = require("jsdom");
const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.sendTo(console, {omitJSDOMErrors: true});
const {JSDOM} = jsdom;

function slugify (string) {
  return string.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\s+/g, "_");
}

// Based on https://stackoverflow.com/questions/62095206/how-to-scrape-a-public-tableau-dashboard
async function queryConfig (host, slug) {
  const request = await axios.get(`/views/${slug}`, {
    baseURL: host,
    params: {
      ":embed": "yes",
      ":showVizHome": "no"
    }
  });
  const dom = new JSDOM(request.data, {virtualConsole});
  const tsConfig = dom.window.document.querySelector("#tsConfigContainer");

  return JSON.parse(tsConfig.innerHTML);
}

async function queryData (host, config) {
  const dataPath = `${config["vizql_root"]}/bootstrapSession/sessions/${config["sessionid"]}`;
  const postData = querystring.stringify({"sheet_id": config["sheetId"]});
  const request = await axios.post(dataPath, postData, {
    baseURL: host
  });
  const jsonStrings = request.data.match(/\d+;({.*})\d+;({.*})/);
  
  // Parse and return JSON strings
  return jsonStrings.slice(1).map(string => JSON.parse(string));
}

async function queryTablePublic (host, config, id) {
  const path = `${config["vizql_root"]}/vudcsv/sessions/${config["sessionid"]}/views/${id}`;

  const request = await axios.get(path, {
    baseURL: host,
    params: {
      "showall": "true"
    }
  });

  return parse(request.data, {
    columns: header => header.map(column => slugify(column))
  });
}

async function queryTableServer (host, config, id) {
  const path = `${config["vizql_root"]}/vud/sessions/${config["sessionid"]}/views/${id}`;

  const request = await axios.get(path, {
    baseURL: host,
    params: {
      "showall": "true",
      "csv": "true"
    }
  });

  return parse(request.data, {
    columns: header => header.map(column => slugify(column))
  });
}

async function queryTables (host, config, info) {
  const views = info["worldUpdate"]["applicationPresModel"]["workbookPresModel"]["dashboardPresModel"]["viewIds"];

  const tables = await Promise.all(Object.entries(views).map(async ([key, id]) => {
    const data = await queryTable(host, config, id);
    
    return [key, data];
  }));

  return Object.fromEntries(tables);
}

// Parse data from Tableau visuals JSON
function parseVisuals (data) {
  const tables = data["secondaryInfo"]["presModelMap"]["vizData"]["presModelHolder"]["genPresModelMapPresModel"]["presModelMap"];

  // Key data by type
  const dataColumns = data["secondaryInfo"]["presModelMap"]["dataDictionary"]["presModelHolder"]["genDataDictionaryPresModel"]["dataSegments"]["0"]["dataColumns"];
  const dataByType = dataColumns.reduce((dataByType, {dataType, dataValues}) => {
    return {
      ...dataByType,
      [dataType]: dataValues
    };
  }, {});
  
  // Map the data for each visual
  const parsedTables = Object.entries(tables).map(([name, table]) => {
    const tableData = table["presModelHolder"]["genVizDataPresModel"]["paneColumnsData"];
    const fields = tableData.vizDataColumns;
    const panes = tableData.paneColumnsList;

    // Create map of tuples, i.e. {1: {col1: 1, col2: 2, ...}, ...}
    const tuples = fields.reduce((tuples, field) => {
      const typeValues = dataByType[field.dataType];
      const key = field.fieldCaption || "id";

      // Get values for field
      field.paneIndices.forEach((_, index) => {
        // Each field has one column per pane
        const paneIndex = field.paneIndices[index];
        const columnIndex = field.columnIndices[index];

        // Get the values for the pane column
        const paneColumns = panes[paneIndex].vizPaneColumns;
        const valueIndices = paneColumns[columnIndex].valueIndices;
        const aliasIndices = paneColumns[columnIndex].aliasIndices;
        const ids = paneColumns[0].tupleIds;

        // Get a value for each id
        ids.forEach((id, index) => {
          const valueIndex = (valueIndices && valueIndices.length > 0 || undefined) && valueIndices[index];
          const aliasIndex = (aliasIndices && aliasIndices.length > 0 || undefined) && aliasIndices[index];

          // Prefer alias if its the same type as the column, otherwise use value.
          // Fall back to alias in the string column if there's no value.
          // Use the id if neither an alias or value index is defined.
          const value = (aliasIndex > -1) ? typeValues[aliasIndex] 
            : (valueIndex > -1) ? typeValues[valueIndex] 
            : (aliasIndex < 0) ? dataByType["cstring"][-1 - aliasIndex] 
            : id;

          const tuple = tuples.get(id);
          tuples.set(id, {
            ...tuple,
            [key]: value
          });
        });
      });

      return tuples;
    }, new Map());

    return [name, Array.from(tuples, ([key, value]) => value)];
  });

  return Object.fromEntries(parsedTables);
}

module.exports = {
  queryConfig,
  queryData,
  queryTablePublic,
  queryTableServer
}

