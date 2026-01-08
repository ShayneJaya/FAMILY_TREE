Family Tree Directory — Static Site Scaffold

Overview
A lightweight, client-side website scaffold for a family tree directory. It’s designed to be served locally with VS Code’s Live Server extension or hosted as static files on GitHub Pages later. The site loads data from JSON files and renders a simple directory with person details. Photos can be linked to each person record.

Quick Start
1) Open this folder in VS Code
2) Install/enable Live Server extension
3) Right-click index.html and select “Open with Live Server”
4) Replace placeholder JSON and images with your real data

Planned Project Structure
This repo will use the following structure (placeholders included):
.
├── index.html
├── README.md
├── assets
│   ├── css
│   │   └── styles.css
│   ├── js
│   │   ├── app.js
│   │   ├── dataLoader.js
│   │   └── render.js
│   └── img
│       ├── placeholders
│       │   ├── person-placeholder.svg   (optional)
│       │   └── README.md
│       └── portraits
│           └── README.md   (naming conventions for photos)
├── data
│   ├── people.json
│   ├── relationships.json
│   └── README.md          (data format, tips)
└── .vscode
    └── settings.json      (optional Live Server tweaks)

Data Model (JSON)
You can convert your Excel to JSON and drop files into data/. Below are recommended shapes.

1) people.json
An array of person records.
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
Notes:
- id: required unique identifier (string). Suggest using something stable like “P001”.
- photo: relative path to a portrait image. If omitted or the file is missing, the UI will show a placeholder.

2) relationships.json
Represent family relationships (parent-child and spouse) by IDs.
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
Notes:
- type is either "parent-child" or "spouse".
- For parent-child: parentId and childId required.
- For spouse: personAId and personBId required. Optional: startDate, endDate.

Photos and Naming Conventions
- Place portrait photos in assets/img/portraits/
- Recommended naming: use the person id as the filename, e.g. P001.jpg, P002.png
- Supported formats: jpg, jpeg, png, webp
- Recommended size: 400–800px on the short edge to balance clarity and file size.
- If a photo is not present, the UI will display assets/img/placeholders/person-placeholder.svg automatically.

Using Excel as the Source of Truth
Option A — Manual (no tooling):
1) Save your Excel sheets as CSV (e.g., people.csv and relationships.csv)
2) Use an online CSV-to-JSON converter for each CSV
3) Save results as data/people.json and data/relationships.json

Option B — Local (Node-based one-liners):
You already have Node installed. You can use csvtojson via npx (no global install needed).
- Convert people.csv to JSON:
  npx csvtojson people.csv > data/people.json
- Convert relationships.csv to JSON:
  npx csvtojson relationships.csv > data/relationships.json

Suggested people.csv columns:
id,firstName,lastName,gender,birthDate,deathDate,occupation,bio,photo

Suggested relationships.csv columns:
id,type,parentId,childId,personAId,personBId,startDate,endDate

Important: Ensure IDs in relationships.json match those in people.json exactly.

How Rendering Works (high level)
- assets/js/dataLoader.js: Fetches people.json and relationships.json
- assets/js/render.js: Renders the directory list and person details
- assets/js/app.js: Bootstraps the app, handles simple search/filter and click events
- assets/css/styles.css: Base styles and layout
- Inline SVG fallback for missing portraits (built into assets/js/render.js).
- Optional: add assets/img/placeholders/person-placeholder.svg and update getPhotoUrl to use it if you prefer a file asset.

What You Need to Change Later
- Replace data/people.json with your real converted data
- Replace data/relationships.json with your real converted relationships
- Drop your images into assets/img/portraits/ following naming conventions
- Tweak styles in assets/css/styles.css as desired

Live Server Notes
- Right-click index.html → Open with Live Server
- If your JSON files don’t load, check the browser console for fetch errors (CORS or path issues)
- Keep data files under the same workspace so Live Server can serve them

Roadmap (optional enhancements)
- Add a printable pedigree view
- Add import tools (drag-and-drop CSV → JSON)
- Add filters by surname, location, or date range
- Add photo gallery per person

License
You may use and modify this scaffold freely for your project.



Scaffold for your Family Tree Directory site is set up with a clean, static structure wired for Live Server. It includes base styles, JS modules to load and render JSON data, placeholder data files, and image directories for portraits.

What’s included

index.html: Wires up styles and module JS, layout with directory and details panes, search input, and count badge.
Styling: assets/css/styles.css with a modern, dark UI (grid layout, cards, details panel, responsive).
JS modules:
assets/js/dataLoader.js: Fetches data/people.json and data/relationships.json with basic error handling.
assets/js/render.js: Renders the directory list and the details panel; includes relationship helpers.
assets/js/app.js: App bootstrap, search filtering, event wiring, selection handling.
Data:
data/people.json: Two placeholder example records (P001, P002).
data/relationships.json: One example relationship (spouse).
data/README.md: Schema, conversion tips from Excel → JSON (CSV one-liners included).
Images:
assets/img/portraits/README.md: Portrait naming conventions and tips (drop your actual photos here; reference via "photo": "assets/img/portraits/P001.jpg").
assets/img/placeholders/README.md: Notes for optional custom placeholder asset.
Missing portraits fallback: Inline SVG is used automatically in render.js if a record has no photo path.
Dev config:
.vscode/settings.json: Live Server defaults (port 5500).
.gitignore: macOS, node_modules, .vscode, etc.
How to add your data and photos

Replace data/people.json with your converted data (keep id stable like P001, P002, …).
Replace data/relationships.json with your relationships (ensure person IDs match).
Drop portrait files into assets/img/portraits/ and set each person’s "photo" path to that file (e.g., assets/img/portraits/P001.jpg).
If you prefer a file-based placeholder, add an SVG/PNG under assets/img/placeholders/ and update getPhotoUrl in assets/js/render.js to point to it.
Live preview

In VS Code, right-click index.html → Open with Live Server.
Use the search box to filter by name or ID. Click a card to view details and navigate via relationship badges.
Notes

All assets are local-friendly, so you can also open the file directly if needed.
The project is GitHub Pages–ready; commit and push this folder to a repo and enable Pages (from main branch, / root).
Deliverable summary

Directory structure, styling, JS scaffolding, data placeholders, portrait directories, and Live Server settings are all in place with sensible defaults and inline placeholder handling.