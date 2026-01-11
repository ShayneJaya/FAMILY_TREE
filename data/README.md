data/ — JSON data for the Family Tree Directory

Files
- people.json — Array of person records
- relationships.json — Array of family relationship links
- photos.json — Array of photo records (including multi-person photos)

people.json (shape)
[
  {
    "id": "P001",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "M",
    "birthDate": "1950-04-10",
    "deathDate": null,
    "occupation": "Engineer",
    "bio": "Short biography or notes.",
    "photo": "assets/img/portraits/P001.jpg"
  }
]

Notes
- id: required unique string per person (e.g., P001). Use something stable so links remain valid.
- photo: relative path to a portrait image. If missing/empty, the UI shows a built‑in placeholder.
- Dates: use ISO format YYYY-MM-DD if known, else null or omit.

relationships.json (shape)
[
  {
    "id": "R001",
    "type": "parent-child",
    "parentId": "P001",
    "childId": "P003"
  },
  {
    "id": "R002",
    "type": "spouse",
    "personAId": "P001",
    "personBId": "P002",
    "startDate": "1975-06-20"
  }
]

Notes
- type: "parent-child" or "spouse"
- For "parent-child": parentId and childId are required
- For "spouse": personAId and personBId are required; startDate/endDate optional
- All referenced person IDs must exist in people.json

photos.json (shape)
[
  {
    "id": "PH001",
    "src": "assets/img/path/to/photo.jpg",
    "people": ["P001", "P002"],
    "date": "1992-05-10",
    "caption": "Family gathering",
    "captions": {
      "P001": "Seated left",
      "P002": "Standing 4th from the left"
    }
  }
]

Notes
- src: relative path to the image file (e.g., assets/img/portraits/P001.jpg or assets/img/family/party.jpg)
- people: array of person IDs who appear in the photo; the photo will be shown on each listed person’s profile
- date and caption are optional metadata; use ISO date (YYYY-MM-DD) if known
- captions: optional per-person captions map; keys are person IDs (e.g., "P006"), values are strings. When present, the UI shows captions[person.id] for that person; otherwise it falls back to caption.

Converting Excel → JSON
Option A — Manual
1) Save Excel sheets as CSV (people.csv, relationships.csv)
2) Use any CSV→JSON converter
3) Save outputs as data/people.json and data/relationships.json

Option B — Node one-liners (no install needed)
- npx csvtojson people.csv > data/people.json
- npx csvtojson relationships.csv > data/relationships.json

Suggested people.csv columns
id,firstName,lastName,gender,birthDate,deathDate,occupation,bio,photo

Suggested relationships.csv columns
id,type,parentId,childId,personAId,personBId,startDate,endDate

Suggested photos.csv columns
id,src,people,date,caption
- people: semicolon-separated list of IDs (e.g., P001;P002;P003). Convert to JSON array when generating photos.json.

Validation Tips
- Ensure every relationship ID (parentId/childId/personAId/personBId) exists in people.json
- Ensure every people[] reference in photos.json exists in people.json
- Verify each photo src path points to an existing file under assets/img (correct capitalization matters on some hosts)
- Keep IDs consistent (case‑sensitive)
