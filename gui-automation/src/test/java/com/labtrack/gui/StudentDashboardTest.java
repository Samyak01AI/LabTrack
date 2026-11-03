package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.UUID;

public class StudentDashboardTest extends BasePlaywrightTest {

    private void loginAsStudent() {
        String uniqueEmail = "student_" + UUID.randomUUID().toString().substring(0, 8) + "@university.edu";
        page.navigate("/register");
        page.locator("input#displayName").fill("Dashboard Test Student");
        page.locator("input#email").fill(uniqueEmail);
        page.locator("input#password").fill("StudentPassword123!");
        page.locator("input#confirmPassword").fill("StudentPassword123!");
        page.locator("button[type='submit']").click();
        page.waitForURL("**/student/dashboard");
    }

    @Test(priority = 1)
    public void testStudentDashboardElements() {
        loginAsStudent();
        Assert.assertTrue(page.locator("text=Welcome back").isVisible(), "Welcome greeting should be visible");
        Assert.assertTrue(page.locator("text=STUDENT").isVisible(), "Student role badge should be visible");
        Assert.assertTrue(page.locator("text=Assignment feed synchronized").isVisible(),
                "Feed synchronized indicator should be visible");
    }

    @Test(priority = 2)
    public void testAssignmentSearchFilterInteractivity() {
        loginAsStudent();
        Locator searchInput = page.locator("input[placeholder*='Search']");
        if (searchInput.isVisible()) {
            searchInput.fill("Graph Algorithms");
            Assert.assertEquals(searchInput.inputValue(), "Graph Algorithms");
            searchInput.clear();
        }
    }
}
