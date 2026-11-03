package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

public class AssignmentUITest extends BasePlaywrightTest {

    private void loginAsTeacher() {
        page.navigate("/login");
        page.locator("button:has-text('Teacher')").click();
        page.locator("input#email").fill(GuiTestConfig.getTeacherEmail());
        page.locator("input#password").fill(GuiTestConfig.getTeacherPassword());
        page.locator("button[type='submit']").click();
        page.waitForURL("**/teacher/**");
    }

    @Test(priority = 1)
    public void testAssignmentAuthoringModalOpens() {
        loginAsTeacher();
        Locator newAssignmentBtn = page.locator("button:has-text('New Assignment')");
        if (newAssignmentBtn.isVisible()) {
            newAssignmentBtn.click();
            Assert.assertTrue(page.locator("text=Assignment Code").isVisible() ||
                            page.locator("input[placeholder*='CS']").isVisible() ||
                            page.locator("text=Problem Statement").isVisible(),
                    "New assignment dialog should open with field inputs");
            Locator closeBtn = page.locator("button:has-text('Cancel')");
            if (closeBtn.isVisible()) {
                closeBtn.click();
            }
        }
    }
}
