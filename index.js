const axios = require('axios');
const { parse } = require('node-html-parser');

const run = async () => {
  const { COOKIE, GRANT_ID } = process.env;

  if (!COOKIE) {
    console.error('No cookie found, see readme for more information');
    process.exit(1);
  }

  if (!GRANT_ID) {
    console.error('No grant ID found, see readme for more information')
    process.exit(1);
  }

  const config = {
    headers: {
      Cookie: COOKIE,
      Host: 'gdb.pop.upenn.edu',
      Origin: 'https://gdb.pop.upenn.edu',
      Referer: 'https://gdb.pop.upenn.edu/grants_list.php',
      TE: 'Trailers',
      'Upgrade-Insecure-Requests': 1,
    }
  }

  const searchParams = {
    post_grant_grant_number: GRANT_ID,
    post_HidPerPage: 99,
    post_Submit: 'Y'
  };

  // Search the school's database for the grant ID. This gets us the serial number for the next step
  const grantSearchResponse = await axios.post('https://gdb.pop.upenn.edu/grants_list.php', { params: searchParams }, config);
  const parsedSearchResponse = parse(grantSearchResponse.data);

  if (parsedSearchResponse.querySelector('#user_name__td')) {
    console.error('bad cookie, see readme for steps to get a new one');
    process.exit(1);
  }

  const searchRows = [
    ...parsedSearchResponse.querySelectorAll('tr.grid'),
    ...parsedSearchResponse.querySelectorAll('tr.altgrid'),
  ];

  const grantIds = searchRows.map(row => row.childNodes[1].childNodes[0]._rawText);
  const revisionNumbers = grantIds.map(id => parseInt(id.split('-')[1].replace(/\D/g, '')));
  const maxId = Math.max(...revisionNumbers);
  const rowIndex = revisionNumbers.indexOf(maxId);
  const grantLink = searchRows[rowIndex].childNodes[0].childNodes[0];
  
  const grantSerial = grantLink
    .getAttribute('href')
    .split('?serial=')[1]
    .split('"')[0];
  
  const grantTitle = grantLink.childNodes[0].text;

  // Using the serial number, get the grant details from the school's page
  const pennResponse = await axios.post(`https://gdb.pop.upenn.edu/grants_maint.php?serial=${grantSerial}`, undefined, config);
  const parsedPennResponse = parse(pennResponse.data);

  const penn = {
    names: parsedPennResponse.querySelectorAll('#fullname')
      .map(cell => cell.childNodes[0]._rawText)
      .map(name => {
        const [ lastName, firstName ] = name.split(', ');
        return { firstName, lastName };
      }),
    grantTitle,
    grantId: parsedPennResponse.querySelector('#grant_grant_number').getAttribute('value'),
    institute: parsedPennResponse.querySelector('[value=18]').childNodes[0]._rawText,
    totalCost: parseInt(parsedPennResponse.querySelector('#grant_total_costs')._attrs.value),
    directCost: parseInt(parsedPennResponse.querySelector('#grant_annual_direct_costs')._attrs.value),
    indirectCost: parseInt(parsedPennResponse.querySelector('#grant_total_costs')._attrs.value) - parseInt(parsedPennResponse.querySelector('#grant_annual_direct_costs')._attrs.value),
    currentStartDate: new Date(parsedPennResponse.querySelector('#grant_curr_start_date')._attrs.value).getTime(),
    currentEndDate: new Date(parsedPennResponse.querySelector('#grant_curr_end_date')._attrs.value).getTime(),
    projectStartDate: new Date(parsedPennResponse.querySelector('#grant_start_date')._attrs.value).getTime(),
    projectEndDate: new Date(parsedPennResponse.querySelector('#grant_end_date')._attrs.value).getTime(),
  }
  
  // uncomment this to see all the fields we got
  // console.log({ penn });

  // Search for the grant on the NIH page
  const govtResponse = await axios.post(
    'https://api.reporter.nih.gov/v1/projects/Search',
    {
      "criteria": {
        "project_nums": `??????${GRANT_ID}*`
      }
    }
  );

  // get the most recent record of the ones that match the institute from the school's records
  const [ mostRecentRecord ] = govtResponse.data.results
    .filter(result => result.agency_ic_admin.abbreviation === penn.institute)
    .sort((a, b) => new Date(b.project_end_date).getTime() - new Date(a.project_end_date).getTime());

  // get the project's details (for dates) and funding details (for costs)
  const govFundingResponse = await axios.get(`https://reporter.nih.gov/services/Projects/ProjectFundingDetail?projectId=${mostRecentRecord.appl_id}`);
  const govProjectResponse = await axios.get(`https://reporter.nih.gov/services/Projects/ProjectDetail?projectId=${mostRecentRecord.appl_id}`);
  
  const govt = {
    applId: mostRecentRecord.appl_id,
    grantId: mostRecentRecord.project_num,
    names: mostRecentRecord.principal_investigators
      .map(({ first_name, last_name }) => ({ firstName: first_name, lastName: last_name })),
    institute: mostRecentRecord.agency_ic_admin.abbreviation,
    totalCost: govFundingResponse.data.total_funding,
    directCost: govFundingResponse.data.direct_cost,
    indirectCost: govFundingResponse.data.indirect_cost,
    projectStartDate: new Date(govProjectResponse.data.project_start_date).getTime(),
    projectEndDate: new Date(govProjectResponse.data.project_end_date).getTime(),
    currentStartDate: new Date(govProjectResponse.data.budget_start_date).getTime(),
    currentEndDate: new Date(govProjectResponse.data.budget_end_date).getTime(),
  }

  // uncomment to see all the fields we got
  // console.log({ govt });

  // the fields we want to check for differences from the data we've constructed (`penn` and `govt`)
  const fieldsToCheck = [
    'names',
    'totalCost',
    'directCost',
    'indirectCost',
    'projectStartnDate',
    'projectEndDate',
    'currentStartDate',
    'currentEndDate',
  ];
  
  const diffs = fieldsToCheck.filter(key => {
    switch (key) {
      case 'names': {
        // check if any of the names are different
        if (govt.names.length !== penn.names.length) return true;

        for (const { firstName, lastName } of govt.names) {
          if (!penn.names.find(name => name.firstName === firstName && name.lastName === lastName)) return true;
        }

        for (const { firstName, lastName } of penn.names) {
          if (!govt.names.find(name => name.firstName === firstName && name.lastName === lastName)) return true;
        }

        return false;
      }
      default: return govt[key] && penn[key] !== govt[key];
    }
  })

  console.log('\n')
  console.log(`NIH Grant ID: ${govt.grantId}`);
  console.log(`Title: ${penn.grantTitle}`);
  console.log('\n')
  console.log(`${diffs.length} changes found:`);
  console.log('\n')

  diffs.forEach(key => {
    console.log(`${key}: ${
      key.includes('Date')
        ? new Date(govt[key]).toLocaleString().split(', ')[0]
        : JSON.stringify(govt[key])
      }`);
  })
}

run();
