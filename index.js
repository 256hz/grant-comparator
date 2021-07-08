const axios = require('axios');
const { parse } = require('node-html-parser');
const prompt = require('prompt');

const onError = message => {
  console.error(message);
  process.exit(1);
}

const getInputs = () => new Promise((res, rej) => {
  const cookieDefault = prompt.history('cookie')?.value;
  const cookieDescription = cookieDefault
    ? ' cookie (hit enter to use the last value)'
    : ' cookie (will be hidden; see readme for instructions)';

  prompt.message = 'enter';
  prompt.delimiter = ':';

  prompt.start();

  prompt.get([
    { name: 'grantId', description: ' grant ID (6 numbers)' },
    { name: 'cookie', description: cookieDescription, default: cookieDefault || '', hidden: true },
  ], (err, result) => {
    if (err) rej(err);

    res({
      grantId: result.grantId,
      cookie: result.cookie,
    })
  })
})

const run = async () => {
  if (prompt.history('cookie')?.value) console.log('\nenter another grant ID (or hit ctrl-c to exit)\n');

  const { grantId, cookie } = await getInputs();
  // const grantId = '007242'
  // const cookie = 'PHPSESSID=m2p07v1931cjbhf2mk776vpd67'

  if (!cookie) onError('No cookie entered, see readme for instructions');
  if (!grantId) onError('No grant ID found, see readme for instructions');

  const config = {
    headers: {
      Cookie: cookie,
      Host: 'gdb.pop.upenn.edu',
      Origin: 'https://gdb.pop.upenn.edu',
      Referer: 'https://gdb.pop.upenn.edu/grants_list.php',
      TE: 'Trailers',
      'Upgrade-Insecure-Requests': 1,
    }
  }

  const searchParams = {
    post_grant_grant_number: grantId,
    post_HidPerPage: 99,
    post_Submit: 'Y'
  };

  // Search the school's database for the grant ID. This gets us the serial number for the next step
  const grantSearchResponse = await axios.post('https://gdb.pop.upenn.edu/grants_list.php', { params: searchParams }, config);
  const parsedSearchResponse = parse(grantSearchResponse.data);

  if (parsedSearchResponse.querySelector('#user_name__td')) onError('bad cookie, see readme for steps to get a new one');

  const searchRows = [
    ...parsedSearchResponse.querySelectorAll('tr.grid'),
    ...parsedSearchResponse.querySelectorAll('tr.altgrid'),
  ];

  const grantIds = searchRows.map(row => row.childNodes[1].childNodes[0]._rawText);
  const revisionNumbers = grantIds.map(id => parseInt(id.split('-')[1].replace(/\D/g, '')));
  const maxId = Math.max(...revisionNumbers);
  const rowIndex = revisionNumbers.indexOf(maxId);
  const grantLink = searchRows[rowIndex]?.childNodes[0].childNodes[0];

  debugger;

  if (!grantLink) onError('grant link not found')
  
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
    institute: parsedPennResponse.querySelector('#grant_funding_source option:checked').childNodes[0].text,
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
        "project_nums": `??????${grantId}*`
      }
    }
  );

  // get the most recent record of the ones that match the institute from the school's records
  const [ mostRecentRecord ] = govtResponse.data.results
    .filter(result => result.agency_ic_admin.abbreviation === penn.institute)
    .sort((a, b) => new Date(b.project_end_date).getTime() - new Date(a.project_end_date).getTime());

  if (!mostRecentRecord?.appl_id) {
    console.error('\ngrant with that ID not found on NIH');
    run();
    return;
  }

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
          if (!penn.names.find(name => {
            return name.firstName.toLowerCase() === firstName.toLowerCase() &&
              name.lastName.toLowerCase() === lastName.toLowerCase()
          })) return true;
        }

        for (const { firstName, lastName } of penn.names) {
          if (!govt.names.find(name => {
            return name.firstName.toLowerCase() === firstName.toLowerCase() &&
              name.lastName.toLowerCase() === lastName.toLowerCase();
          })) return true;
        }

        return false;
      }
      default: return govt[key] && penn[key] !== govt[key];
    }
  })

  console.log('')
  console.log(`NIH Grant ID: ${govt.grantId}`);
  console.log(`Title: ${penn.grantTitle}`);
  console.log('')
  console.log(`${diffs.length} changes found:`);
  console.log('')

  diffs.forEach(key => {
    const value = (() => {
      switch(true) {
        case key.includes('Date'): return new Date(govt[key]).toLocaleString().split(', ')[0];
        case key === 'names': return govt.names.map(({ firstName, lastName }) => `${lastName}, ${firstName}`).join('; ');
        default: return JSON.stringify(govt[key])
      }
    })();
    
    console.log(`${key}: ${value}`);
  })

  run();
}

run();
