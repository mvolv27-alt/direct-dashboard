import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/#/auth");
  await expect(page.getByRole("heading", { name: /Direct Promoções/i })).toBeVisible();
  await page.getByLabel("E-mail").fill(email || "");
  await page.getByLabel("Senha").fill(password || "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/#\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(overflow.page, `page width ${overflow.page}px exceeds ${overflow.viewport}px`).toBeLessThanOrEqual(
    overflow.viewport + 1,
  );
}

test.describe("professional responsive UI", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated UI checks.");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const route of ["dashboard", "demandas", "diaristas", "financeiro", "configuracoes", "agente"]) {
    test(`${route} fits the viewport in light and dark themes`, async ({ page, isMobile }, testInfo) => {
      await page.goto(`/#/${route}`);
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page);

      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const captureFullPage = !isMobile && pageHeight < 30_000;
      await page.screenshot({
        path: testInfo.outputPath(`${route}-dark.png`),
        fullPage: captureFullPage,
      });

      const lightToggle = page.getByRole("button", { name: "Mudar para tema claro" }).first();
      if (await lightToggle.isVisible()) await lightToggle.evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await page.waitForTimeout(300);
      await expectNoHorizontalOverflow(page);

      await page.screenshot({
        path: testInfo.outputPath(`${route}-light.png`),
        fullPage: captureFullPage,
      });
    });
  }

  test("primary navigation and account controls remain reachable", async ({ page, isMobile }) => {
    const navigation = page.getByRole("navigation", { name: isMobile ? "Navegacao mobile" : "Navegacao principal" });
    await expect(navigation).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("dialogs stay centered and scroll inside the viewport", async ({ page }, testInfo) => {
    const cases = [
      { route: "financeiro", button: /Novo Registro/i },
      { route: "demandas", button: /Nova Demanda/i },
      { route: "diaristas", button: /Novo Diarista/i },
    ];

    for (const dialogCase of cases) {
      await page.goto(`/#/${dialogCase.route}`);
      await page.getByRole("button", { name: dialogCase.button }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const bounds = await dialog.boundingBox();
      const viewport = page.viewportSize();
      expect(bounds).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(6);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height - 6);
      await page.screenshot({ path: testInfo.outputPath(`dialog-${dialogCase.route}.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });
});
