# Items

`POST https://api.reporter.nih.gov/v1/projects/Search`

body:

```json
{
    "criteria":
    {
        "project_nums": "??????104339*"
    }
}
```

.results -> take project with latest project_end_date

take .appl_id for next queries

## Contact PI/Project Leader

```json
  "principal_investigators": [
      {
          "profile_id": 1920269,
          "first_name": "Sarah",
          "middle_name": "Anne",
          "last_name": "Tishkoff",
          "is_contact_pi": true,
          "full_name": "Sarah Anne Tishkoff",
          "title": null,
          "email": null
      }
  ],
```

## Administering Institutes or Centers

```json
  "agency_ic_admin": {
      "code": "DK",
      "abbreviation": "NIDDK",
      "name": "National Institute of Diabetes and Digestive and Kidney Diseases"
  },
```

## Total Funding

```json
  "agency_ic_fundings": [
      {
          "fy": 2017,
          "code": "DK",
          "name": "National Institute of Diabetes and Digestive and Kidney Diseases",
          "abbreviation": "NIDDK",
          "total_cost": 356131.0
      }
  ],
```

`GET https://reporter.nih.gov/services/Projects/ProjectFundingDetail?projectId=9403246`

## Direct Costs

  "direct_cost": 265497.0,

## Indirect Costs

  "indirect_cost": 90821.0,

`GET https://reporter.nih.gov/services/Projects/ProjectDetail?projectId=9403246`

## Project Start Date

  "project_start_date": "2014-12-01T05:00:00Z",

## Project End Date

  "project_end_date": "2019-11-30T05:00:00Z",

## Budget Start Date

  "budget_start_date": "2017-12-01T00:00:00",

## Budget End Date

  "budget_end_date": "2019-11-30T00:00:00",
