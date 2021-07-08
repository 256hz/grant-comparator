# Penn to NIH Grant Comparator

## Installation

- Run `npm install`

- Make a file called '.env' in this folder and copy this into it:

```env
  export COOKIE=""
  export GRANT_ID=
```

These will be loaded into the environment by the start script.

- For the cookie, log in normally.  Open the Web Developer Tools (⌥⌘i) and go to the Network tab.  Now click on any link (like Search), open the Headers tab, and grab the Cookie value out of the request headers.

- For the grant ID, use the six-digit number only (ex: 104339).

- Now run `npm start`.  This loads the environment variables and runs the program.  If all goes well, you should see something like this:

```zsh
NIH Grant ID: 5R01DK104339-04
Title: Integrative Nutrigenomic and Metabolomic Analyses of Africans with Variable Diets

3 changes found:

totalCost: 356318
indirectCost: 90821
currentStartDate: 12/1/2017
```

## Notes

The program takes the following steps:

1. Search the school's database for the most recent
