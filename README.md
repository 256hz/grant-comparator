# Penn to NIH Grant Comparator

## Installation

- Run `npm install`

You'll need two things: a grant ID and a cookie.

- For the grant ID, use the six-digit number only (ex: 104339).

- For the cookie, log in normally.  Open the Web Developer Tools (⌥⌘I) and go to the Network tab.  Now click on any link (like Search), open the Headers tab, and grab the Cookie value out of the request headers.

- Now run `npm start`.  This loads the environment variables and runs the program.  If all goes well, you should see something like this:

```zsh
NIH Grant ID: 5R01DK104339-04
Title: Integrative Nutrigenomic and Metabolomic Analyses of Africans with Variable Diets

3 changes found:

totalCost: 356318
indirectCost: 90821
currentStartDate: 12/1/2017
```

You'll then get the option to enter another grant ID or exit.  When prompted for the cookie again, you can hit enter to re-use the last one.
