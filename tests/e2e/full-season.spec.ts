import { test, expect } from "@playwright/test";

/**
 * End-to-end scenario from TECHNICAL_SPEC §46 / AI_CODING_AGENT_PROMPT:
 * create a season, players and a match, run live stats, correct errors,
 * finish the match, edit a completed goal and verify season totals update,
 * export a backup and confirm data survives a reload.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("FutsalStats");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await expect(page.getByRole("link", { name: "Ottelut" })).toBeVisible();
});

test("full season lifecycle with live stats, corrections and backup", async ({ page }) => {
  // ---------- Players ----------
  await page.getByRole("link", { name: "Pelaajat" }).click();

  const players = [
    ["1", "Anna"],
    ["4", "Laura"],
    ["7", "Emma"],
    ["9", "Sofia"],
    ["14", "Veera"],
    ["10", "Iida"],
  ];
  for (const [number, name] of players) {
    await page.getByRole("button", { name: "+ Lisää pelaaja" }).first().click();
    await page.getByTestId("player-number").fill(number);
    await page.getByTestId("player-name").fill(name);
    await page.getByTestId("player-save").click();
    await expect(page.getByText(`#${number} ${name}`)).toBeVisible();
  }

  // ---------- Create match ----------
  await page.getByRole("link", { name: "Ottelut" }).click();
  await page.getByRole("button", { name: "+ Uusi peli" }).first().click();
  await page.getByTestId("match-opponent").fill("FC Team B");
  await page.getByTestId("match-create").click();

  await expect(page.getByRole("heading", { name: "vs FC Team B" })).toBeVisible();

  // ---------- Roster + starting five (+ #10 on the bench) ----------
  for (const number of ["1", "4", "7", "9", "14"]) {
    const select = page.getByTestId(`roster-select-${number}`);
    await select.click();
    await expect(select).toBeChecked();
    const starter = page.getByTestId(`roster-starter-${number}`);
    await starter.click();
    await expect(starter).toBeChecked();
  }
  const benchSelect = page.getByTestId("roster-select-10");
  await benchSelect.click();
  await expect(benchSelect).toBeChecked();

  const start = page.getByTestId("start-match");
  await expect(start).toBeEnabled();
  await start.click();

  // ---------- Live ----------
  await expect(page).toHaveURL(/\/live$/);
  await expect(page.getByTestId("live-score")).toHaveText("0 – 0");

  // Substitution: #4 out, #10 in
  await page.getByTestId("court-player-4").click();
  await page.getByTestId("bench-player-10").click();
  await expect(page.getByTestId("court-player-10")).toBeVisible();
  await expect(page.getByTestId("court-player-4")).toHaveCount(0);

  // Own goal at 07:34, scorer #9, assist #7
  await page.getByTestId("own-goal").click();
  {
    const dlg = page.getByRole("dialog");
    for (const d of ["0", "7", "3", "4"]) await dlg.getByTestId(`numpad-${d}`).click();

    // A goal can never have more than five own players on court.
    await dlg.getByTestId("lineup-4").click(); // 6th player -> blocked
    await expect(dlg.getByTestId("goal-save")).toBeDisabled();
    await dlg.getByTestId("lineup-4").click(); // back to five
    await expect(dlg.getByTestId("goal-save")).toBeEnabled();

    await dlg.getByTestId("add-scorer-assist").click();
    await dlg.getByTestId("scorer-9").click();
    await dlg.getByTestId("assist-7").click();
    await dlg.getByTestId("goal-save").click();
  }
  await expect(page.getByTestId("live-score")).toHaveText("1 – 0");

  // Opponent goal at 12:18
  await page.getByTestId("opponent-goal").click();
  {
    const dlg = page.getByRole("dialog");
    for (const d of ["1", "2", "1", "8"]) await dlg.getByTestId(`numpad-${d}`).click();
    await dlg.getByTestId("goal-save").click();
  }
  await expect(page.getByTestId("live-score")).toHaveText("1 – 1");

  // Undo the opponent goal, then re-add it
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("live-score")).toHaveText("1 – 0");

  await page.getByTestId("opponent-goal").click();
  {
    const dlg = page.getByRole("dialog");
    for (const d of ["1", "2", "1", "8"]) await dlg.getByTestId(`numpad-${d}`).click();
    await dlg.getByTestId("goal-save").click();
  }
  await expect(page.getByTestId("live-score")).toHaveText("1 – 1");

  // Own goal from a 6 m penalty — counts for the score, gathers no +/-
  await page.getByTestId("own-goal").click();
  {
    const dlg = page.getByRole("dialog");
    await dlg.getByTestId("situation-PENALTY_6M").click();
    for (const d of ["1", "5", "0", "0"]) await dlg.getByTestId(`numpad-${d}`).click();
    await dlg.getByTestId("goal-save").click();
  }
  await expect(page.getByTestId("live-score")).toHaveText("2 – 1");

  // Goal-by-goal breakdown is available during the game (for half-time reporting)
  await page.getByTestId("goals-breakdown-open").click();
  const breakdown = page.getByRole("dialog");
  await expect(breakdown.getByTestId("goal-breakdown")).toBeVisible();
  await expect(breakdown.getByText("6 m rp")).toBeVisible();
  await expect(breakdown.getByText("+/- ei kirjata (rangaistusmaali)")).toBeVisible();
  await page.getByTestId("goals-breakdown-close").click();

  // Finish (two-tap confirm)
  await page.getByTestId("finish-match").click();
  await page.getByTestId("finish-match").click();

  // ---------- Match statistics ----------
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByTestId("match-score")).toHaveText("2–1 vs FC Team B");

  await page.getByTestId("tab-players").click();
  await expect(page.getByTestId("stat-9-goals")).toHaveText("1");
  await expect(page.getByTestId("stat-7-assists")).toHaveText("1");

  // ---------- Edit a completed goal: scorer 9 -> 7 ----------
  await page.getByTestId("tab-events").click();
  await page.getByTestId("event-OWN_GOAL").first().click();
  {
    const dlg = page.getByRole("dialog");
    await dlg.getByTestId("scorer-7").click();
    await dlg.getByTestId("goal-save").click();
  }

  await page.getByTestId("tab-players").click();
  await expect(page.getByTestId("stat-9-goals")).toHaveText("0");
  await expect(page.getByTestId("stat-7-goals")).toHaveText("1");

  // ---------- Season statistics reflect the edit ----------
  await page.getByRole("link", { name: "Kausi" }).click();
  await expect(page.getByTestId("season-matches")).toHaveText("1");
  await expect(page.getByTestId("season-wins")).toHaveText("1");
  await expect(page.getByTestId("season-stat-9-goals")).toHaveText("0");
  await expect(page.getByTestId("season-stat-7-goals")).toHaveText("1");
  await expect(page.getByTestId("season-stat-9-apps")).toHaveText("1");

  // ---------- Backup export ----------
  await page.getByRole("link", { name: "Asetukset" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("backup-export").click(),
  ]);
  expect(download.suggestedFilename()).toContain("varmuuskopio");

  // ---------- Reload: data persists ----------
  await page.reload();
  await page.getByRole("link", { name: "Ottelut" }).click();
  await expect(page.getByText("vs FC Team B")).toBeVisible();
  await expect(page.getByText("2–1")).toBeVisible();
});
