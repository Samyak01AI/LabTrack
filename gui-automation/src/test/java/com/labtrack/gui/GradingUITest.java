package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

public class GradingUITest extends BasePlaywrightTest {

    private void loginAsTeacher() {
        page.navigate("/login");
        page.locator("button:has-text('Teacher')").click();
        page.locator("input#email").fill(GuiTestConfig.getTeacherEmail());
        page.locator("input#password").fill(GuiTestConfig.getTeacherPassword());
        page.locator("button[type='submit']").click();
        page.waitForURL("**/teacher/**");
    }

    @Test(priority = 1)
    public void testTeacherMarkingPageLoads() {
        loginAsTeacher();
        page.navigate("/teacher/marking");
        Assert.assertTrue(page.locator("text=Evaluation").isVisible() ||
                        page.locator("text=Marking").isVisible() ||
                        page.locator("text=Submissions").isVisible() ||
                        page.locator("text=Assignments").isVisible(),
                "Marking view should be reachable with evaluation controls");
    }

    @Test(priority = 2)
    public void testTeacherSimilarityPageLoads() {
        loginAsTeacher();
        page.navigate("/teacher/similarity");
        Assert.assertTrue(page.locator("text=Similarity").isVisible() ||
                        page.locator("text=Review").isVisible() ||
                        page.locator("text=Assignments").isVisible(),
                "Similarity review interface should be reachable");
    }
}
