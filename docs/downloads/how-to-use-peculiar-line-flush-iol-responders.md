# How to use Peculiar Line Flush

For IOL Responders.

This tool looks up a container when you scan it. It saves the scan for you. You do not save a file. You do not email anyone. You scan, you wait for **SAVED**, and you scan the next one.

Use Firefox. The tool runs inside Firefox.

## One-time setup

You only do this the first time on a computer.

1. Open this link in Firefox:

   https://raw.githubusercontent.com/rigoabell/peculiar-line-flush/main/peculiar-line-flush.user.js

2. A page opens. Click **Install**.
3. If Firefox asks you to add Tampermonkey, add it, then click **Install** again.
4. Close that install tab.
5. Open Aging Inventory and finish sign-in:

   https://aft-aging-inventory.na.aftx.amazonoperations.app/MEM3/overview

6. Press **F5** to refresh the page.
7. A panel named **Peculiar Line Flush** covers the page. The number next to the name is the version. Leave that page open.

## Every time you scan

1. Open the Aging Inventory page and finish sign-in. Leave that tab open.
2. The panel should already be on the screen. If you only see a **Line Flush** button, click it.
3. Look at the location box.
   - If it already shows your location, leave it.
   - If it says **Select location**, pick the place you are standing.
4. Click the scan box.
5. Scan the container barcode.
6. The scanner sends Enter. If the scan does not go through, press **Enter** yourself.
7. Read the banner at the top of the panel.
   - **SAVING** means wait. Stay on this page.
   - **SAVED** means that container is done. Scan the next one.
   - The panel also shows the age and a color.

You can scan the next container while the banner still says **SAVING**. Wait until you see **SAVED** before you walk away from a problem container.

## Pick the real location

The location is where you are scanning, not the name printed on the container.

The list includes:

- L1 Odd, L1 Even, L2 Odd, L2 Even, L3 Odd, L3 Even, L4 Odd, L4 Even
- L7 AR, L8 Odd, L8 Even
- EOL 1, EOL 2, EOL 3, EOL 4, EOL 5, EOL 6
- AR EOL, BIGs EOL

If your spot is not in the list, click **Other…** and type the name.

If a box says **Select a location** after you scan:

1. Click the button for where you are.
2. That scan continues. You do not scan it again.
3. Click **Cancel** only when that scan should be thrown away.

If you stop scanning for about 10 minutes, the panel asks for the location again. Pick it, then keep scanning.

## What the colors mean

The color comes from the oldest units in the container.

- **Good** means under 3 days.
- **Caution** means 3 days up to 5 days. A container that is exactly 3 days is Caution.
- **Alert** means 5 days or more. A container that is exactly 5 days is Alert.
- **No age** means the page did not give an age.
- **Not found** means that container was not on the page.
- **Error** means the lookup did not finish. Scan it one more time. If it says Error again, tell a Quality leader.

## When a box covers the page

Follow the box. Do not press F5 while one of these boxes is up.

**NEW VERSION**

1. Click **Install the new Peculiar Line Flush**.
2. On the new tab, click **Install**.
3. Close that tab.
4. Come back to the Aging Inventory tab.
5. Press **F5**.
6. Check the number next to **Peculiar Line Flush**. Then scan again.

**Excel file is open**

Someone has the save file open. Your scan is on the screen and is not saved yet.

1. Leave this tab open. Do not press F5.
2. Tell a Quality leader. Tell them the file name in the box.
3. After they close it, click the black **RETRY** button.
4. Wait until the box goes away. Then scan again.

**STOP — YOUR SCANS WERE NOT SAVED**

1. Click the yellow **OPEN THE FOLDER** button.
2. Wait until the new page finishes loading.
3. If that page asks you to sign in, sign in with your Amazon account.
4. Leave that tab open.
5. Click the Aging Inventory tab.
6. Click the black **RETRY** button.
7. If the STOP box comes back, tell a Quality leader. You need permission to save. Click **RETRY** again after they say it is fixed.

## A few rules

- Scan from the panel. The big table behind the panel is not your scan list.
- Click **Dashboard** if you want to see today’s totals, each location, and each scan. Click **Close** to go back to scanning.
- If the banner says the scan was **SAVED** and also says the EOL workbook did not update, your scan is saved. Tell a Quality leader, then keep scanning.
- If the same container keeps saying **NOT SAVED**, stop and tell a Quality leader. Do not keep scanning that one container over and over.
