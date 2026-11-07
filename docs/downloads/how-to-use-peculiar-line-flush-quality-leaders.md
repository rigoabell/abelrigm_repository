# How to use Peculiar Line Flush

For Quality Leaders.

Responders scan in the panel. The tool saves each scan into a workbook for you. This page is how you open those workbooks and how you help a responder when a scan will not save.

Responders use the short guide: `how-to-use-peculiar-line-flush-iol-responders.md`. They do not need this folder.

## The folder

All of the files are in one folder:

**Documents / IOL Assignments / Line Flush Records**

Open it here:

https://amazon-my.sharepoint.com/personal/abelrigm_amazon_com/Documents/IOL%20Assignments/Line%20Flush%20Records

Each responder also has a **Line Flush** button on the Aging Inventory page. The Tampermonkey menu has **Open Line Flush Records**. That opens this same folder.

Sign in with your Amazon account if the page asks. You need **Can edit** on this folder. A responder who gets a **STOP** box needs that too. After you give them access, they click **RETRY** on the panel.

## The files

There are two kinds of files.

**One file per person per day**

`LineFlush_2026-11-07_jkiearr.xlsx`

That file is everything jkiearr scanned on November 7. Line scans and EOL scans are both in it. The date is the calendar day on the scanner’s computer. The last part of the name is the person’s login.

Inside that file:

- **Dashboard** is the whole day: totals, one row per location, then every container.
- Each location they actually scanned has its own sheet, such as **L3 Even** or **EOL 1**.

Columns on the container rows:

| Column | What it is |
|---|---|
| Location | The place they picked on the panel |
| Parent | The dropzone, such as `rcCRetStations` |
| Container | The barcode they scanned |
| Age | Oldest units age from the lookup |
| Status | Good, Caution, Alert, No age, Not found, or Error |
| Units | How many units were in the container |
| Scanned At | The local time of the scan, `YYYY-MM-DD HH:MM:SS` |

**One EOL file per shift**

Only EOL scans go here. A line scan such as L3 Even stays on the person’s own file.

- Day shift, 6:00 AM through 5:59 PM: `LineFlush_EOL_2026-11-07_Day.xlsx`
- Night shift, 6:00 PM through 5:59 AM: `LineFlush_EOL_2026-11-07_Night.xlsx`

The night file is named for the evening the shift starts. A scan at 10:00 PM on November 7 and a scan at 4:00 AM on November 8 are both in `LineFlush_EOL_2026-11-07_Night.xlsx`. A scan at 8:00 AM on November 8 is in `LineFlush_EOL_2026-11-08_Day.xlsx`.

EOL means the panel location was one of these: EOL 1, EOL 2, EOL 3, EOL 4, EOL 5, EOL 6, AR EOL, BIGs EOL.

The EOL file has:

- **Summary** as the first sheet. No logins on this sheet.
- One sheet per person who scanned an EOL during that shift. The sheet name is their login. Those rows are only their EOL scans for that shift.

## How to read the Summary sheet

The Summary sheet is wide. Read it from left to right. There are four groups. Inside a group, the time windows stack from top to bottom.

Each window is the same small table:

| EOL | Dropzone | Containers | Units | Percent |
|---|---|---|---|---|
| EOL 1 | rcCRetStations | 2 | 6 | 67% |

- **EOL** is the location they picked.
- **Dropzone** is the parent from the lookup.
- **Containers** is how many scans fell in that window.
- **Units** is the unit count added up. The percent does not use units.
- **Percent** is that dropzone’s share of the containers at that EOL in that window. The percents for one EOL in one window add to 100%.

A blank row separates one EOL from the next. An EOL with two dropzones has two rows.

Day file, left to right:

| All shift | Halves | Quarters | Smaller windows |
|---|---|---|---|
| All Day, 6:00 AM–5:59 PM | 1st Half, 6:00 AM–12:29 PM | 1st Quarter, 6:00 AM–9:00 AM | 6:00 AM–8:00 AM |
| | 2nd Half, 12:30 PM–5:59 PM | 2nd Quarter, 9:01 AM–12:29 PM | 8:01 AM–9:00 AM |
| | | 3rd Quarter, 12:30 PM–2:30 PM | 9:01 AM–10:00 AM |
| | | 4th Quarter, 2:31 PM–5:59 PM | 10:01 AM–11:00 AM |
| | | | 11:01 AM–12:00 PM |
| | | | 12:01 PM–1:00 PM |
| | | | 1:01 PM–2:00 PM |
| | | | 2:01 PM–3:00 PM |
| | | | 3:01 PM–4:00 PM |
| | | | 4:01 PM–5:00 PM |
| | | | 5:01 PM–5:59 PM |

The night file uses the same grid starting at 6:00 PM. All Night is 6:00 PM–5:59 AM. The 1st Half is 6:00 PM–12:29 AM. The 2nd Half is 12:30 AM–5:59 AM. The smaller windows are whole hours from 6:00 PM–8:00 PM through 5:01 AM–5:59 AM.

A minute named as the end of a window stays in that window. 12:29 PM is the 1st Half. 12:30 PM is the 2nd Half. 9:00 AM closes the 1st Quarter. 2:30 PM closes the 3rd Quarter. 1:00 PM closes the 12:01–1:00 window.

A scan at 12:15 PM is in the 1st Half and also in the 12:01–1:00 window. A scan at 12:45 PM is in the 2nd Half and also in that same hour window. The hour window is a whole hour. The half still splits at 12:30.

## What the status words mean

Status comes from the oldest units age.

- **Good** is under 3 days.
- **Caution** is from 3 days up to 5 days. Exactly 3 days is Caution.
- **Alert** is 5 days and over. Exactly 5 days is Alert.
- **No age** means the lookup had no age.
- **Not found** means the container was not on the page.
- **Error** means the lookup failed.

Rows already saved keep the status they had at scan time. A later rule change does not rewrite old rows.

## While people are scanning

Do not open today’s workbook in Excel or in the browser editor while that shift is still scanning.

- If you open one person’s file, that person’s panel stops on **Excel file is open**. Their new scans wait until you close the file and they click **RETRY**.
- If you open a shift EOL file, every responder scanning an EOL gets that stop until the file is closed.

Download a copy if you need to look during the shift. Close the copy when you are done. Tell the responder to click **RETRY**. They should not press F5 while that box is up.

## When a scan will not save

**STOP — YOUR SCANS WERE NOT SAVED**

The responder does not have permission yet, or they have not signed in.

1. Have them click **OPEN THE FOLDER**.
2. Have them sign in if asked, and wait until the file list loads.
3. Have them come back to Aging Inventory and click **RETRY**.
4. If it stays on STOP, give them **Can edit** on the Line Flush Records folder. Then they click **RETRY** again.

**The site is out of space**

The banner says the site exceeded its file storage limit. Lookups still work. Saves do not. The container on the screen was not written to the file.

Each scan stores another copy of the whole workbook. Old copies fill the site.

1. In the Line Flush Records folder, open **Version history** on the large files and delete the old versions.
2. Empty the recycle bin, then empty the second-stage recycle bin. Deleted versions still count until both bins are empty.
3. Have them scan one container. The banner should say **SAVED**.
4. Any container that was looked up during the failure has to be scanned again. It is not in the file.

**SAVED, and the EOL workbook did not update**

The person’s own file has the scan. The shift EOL file does not. Usual causes: the EOL file is open in Excel, or the site is out of space. Fix that, then have them scan one more EOL container. That scan refreshes their sheet on the shift file. Scans from earlier in the shift are still on their personal file.

## The version on the panel

The number next to **Peculiar Line Flush** is the version on that computer. When a newer copy is published, the panel shows **NEW VERSION**. The responder clicks **Install the new Peculiar Line Flush**, clicks **Install** on the Tampermonkey tab, comes back, and presses **F5**.
