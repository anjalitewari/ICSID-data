import puppeteer from "puppeteer";
import cheerio from "cheerio";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = "https://icsid.worldbank.org/cases/case-database"

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scraper (url) {
  let browser;
  try {
    browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', "--disable-setuid-sandbox"],
        'ignoreHTTPSErrors': true
    });
  } catch (err) {
    console.log("Error! Could not create a browser instance => : ", err);
  }
	const page = await browser.newPage();
	console.log (`Navigating to ${url}`);
	await page.goto (url, { waitUntil: 'load' });
  await sleep (1000);
  await page.select ('select#viewsPerPage', 'all');
  await sleep (1000);

  const htmlContent = await page.content();
  const $ = cheerio.load (htmlContent);
  const data = [];
  let count = 0;
  // Get data from main table
  $("table > tbody > tr").each((index, element) => {
    const label = $(element).find('td span.mobilelabel');
    const tds = $(element).find('td span.cellvalue');
    const tdsHref = $(element).find('td span a');
    let caseData = {};
    for (let col = 0; col < 4; col++) {
      const key = $(label[col]).text();
      const val = $(tds[col]).text();
      caseData[key] = val;
      caseData['Case Details Page'] = "https://icsid.worldbank.org" + $(tdsHref[0]).attr('href');
    }
    data.push(caseData);
    count = count + 1;
    // Change count to the number of documents needed
    if (count === 500) { 
      return false;
    }
  });

  // Iterate over cases to get details
  for (let c = 0; c < data.length; c++) {
    // Follow href in each Case No. for details
    let caseurl = data[c]['Case Details Page'];
    await page.goto(caseurl, { waitUntil: 'load' });
    let caseDetailContent = await page.content();
    let $ = cheerio.load(caseDetailContent);
    
    // Case Details Proceedings tab
    $('ul.proceedingcaselist1').children('li').each((index, element) => {
      let label = $(element).find('div label').text();
      let value = $(element).find('div').next().text();
      data[c][label] = value;
    });
    $('ul.proceedingcaseproceedings').children('ul').each((index, element) => {
      $(element).children('li').each((index, element) => {
        let label = $(element).find('div label').text();
        let value = $(element).find('div').next().text();
        data[c][label] = value;
      });
    });

    // Case Procedural Details tab
    $('div#procedural_details').children('table').each((index, element) => {
      let proc_details = [];
      $("tbody > tr").each((index, element) => {
        const date = $(element).find('td').first().text();
        const dev = $(element).find('td').last().text();
        proc_details.push({'Date': date, "Development": dev});
      });
      data[c]['Procedural Details'] = proc_details;
    });

    // Case Details Materials tab
    let materials = $('div#materials').children('p');
    let material_details = [];
    let decisions = [];
    for (let i = 0; i < materials.length; i++) {
      if (!$(materials).text().includes("No References Available.")) {
        // add published decisions to separate field
        decisions.push($(materials[i]).find('p span').text());
        // download file and add name and location to JSON
        let href = $(materials[i]).find('a').attr('href');
        let name = $(materials[i]).find('a').prev().text();
        const caseNumber =  caseurl.match(/[^=]*$/g) || [];  
        const caseNoString = caseNumber[0].replace(/[/]/g, '-');
        if (href != undefined && href.includes(".pdf")) {
          const downloadPath = path.resolve(path.join(__dirname, `materials/${caseNoString}/`));
          if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
          }
          const filename = `${name}.pdf`;
          const file = fs.createWriteStream(downloadPath + "/" + filename);
          let request;
          try {
            request = https.get(href, function(response) {
              response.pipe(file);
              // after download completed close filestream
              file.on("finish", () => {
                file.close();
              });
            });
          } catch (e) {
            request = http.get(href, function(response) {
              response.pipe(file);
              // after download completed close filestream
              file.on("finish", () => {
                file.close();
              });
            });
          }
          material_details.push({'Name': name, 'Download Path': downloadPath + "/" + filename});
        }
      }
    };

    if (material_details.length > 0) {
      data[c]['Materials'] = {};
      data[c]['Materials']['Available'] = material_details;
      if (decisions.length > 0) {
        data[c]['Materials']['Published Decisions'] = decisions;
      }
    }
  }
  fs.writeFile("./data.json", JSON.stringify(data), (error) => {
    if (error) throw error;
  }); 
  console.log(`Data written to file data.json`);
  browser.close();
}

// call the scraper
scraper(url);
