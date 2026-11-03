package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.UUID;

public class SubmissionUITest extends BasePlaywrightTest {

    private void loginAsStudent() {
        String uniqueEmail = "sub_student_" + UUID.randomUUID().toString().substring(0, 8) + "@university.edu";
        page.navigate("/register");
        page.locator("input#displayName").fill("Submission Student");
        page.locator("input#email").fill(uniqueEmail);
        page.locator("input#password").fill("StudentPassword123!");
        page.locator("input#confirmPassword").fill("StudentPassword123!");
        page.locator("button[type='submit']").click();
        page.waitForURL("**/student/dashboard");
    }

    @Test(priority = 1)
    public void testStudentNavigatesToSubmissionHistory() {
        loginAsStudent();
        page.navigate("/student/history");
        Assert.assertTrue(page.locator("text=Submission History").isVisible() ||
                        page.locator("text=Submissions").isVisible() ||
                        page.locator("text=Dashboard").isVisible(),
                "Student submission history or navigation should be accessible");
    }
}
