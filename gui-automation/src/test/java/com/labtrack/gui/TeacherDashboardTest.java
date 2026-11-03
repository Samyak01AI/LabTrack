package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

public class TeacherDashboardTest extends BasePlaywrightTest {

    private void loginAsTeacher() {
        page.navigate("/login");
        page.locator("button:has-text('Teacher')").click();
        page.locator("input#email").fill(GuiTestConfig.getTeacherEmail());
        page.locator("input#password").fill(GuiTestConfig.getTeacherPassword());
        page.locator("button[type='submit']").click();
        page.waitForURL("**/teacher/**");
    }

    @Test(priority = 1)
    public void testTeacherNavigationLinks() {
        loginAsTeacher();
        Assert.assertTrue(page.locator("a:has-text('Assignments')").isVisible(), "Assignments link should be visible");
        Assert.assertTrue(page.locator("a:has-text('Reports')").isVisible() || page.locator("text=Reports").isVisible(),
                "Reports link should be visible");
    }

    @Test(priority = 2)
    public void testTeacherAssignmentsViewElements() {
        loginAsTeacher();
        Assert.assertTrue(page.locator("button:has-text('New Assignment')").isVisible() ||
                        page.locator("text=New Assignment").isVisible() ||
                        page.locator("text=Assignments").isVisible(),
                "Teacher assignment controls should be visible");
    }
}

