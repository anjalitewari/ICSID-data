README

I have used NodeJS with Puppeteer and Cheerio to extract the 500 latest records of the provided database.

Since the page loads in the order of the most recent cases first, I have not re-ordered the cases. 

In order to get the first 500 cases, I reset the `Views per Page` dropdown to `All` and then traversed the refreshed table until I reached the 500th case, adding the case details from the table into a JSON array. I also added the additional field `Case Details Page` that contains the URL to the case details page for each case.

Next I looped through the JSON array and opened the Case Details page for each case. Here, I scraped all the data from all three tabs and added it to the same JSON object. I also downloaded the materials  when available and saved the location in the format `/materials/caseNumber/fileName` in the project folder. The data is downloaded into the file `data.json`, also saved in the project folder. 

In order to run the app, download the folder, run 

```npm install```

then,

```node index.js```

It takes ~10 mins to run. 

Notes:
Occasionally, the error 
`Error: No element found for selector: select#viewsPerPage` 
may be thrown in the beginning of the run- in this case, re-run the program and it should work. I have kept the sleep function at minimal time to avoid unnecessary waits. 
