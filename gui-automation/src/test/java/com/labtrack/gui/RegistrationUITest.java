package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.UUID;

public class RegistrationUITest extends BasePlaywrightTest {

    @Test(priority = 1)
    public void testRegistrationPageLoads() {
        page.navigate("/register");
        Assert.assertTrue(page.locator("text=Create your student account").isVisible(),
                "Heading should prompt for student account registration");
        Assert.assertTrue(page.locator("input#displayName").isVisible(), "Name input should be present");
        Assert.assertTrue(page.locator("input#email").isVisible(), "Email input should be present");
        Assert.assertTrue(page.locator("input#password").isVisible(), "Password input should be present");
        Assert.assertTrue(page.locator("input#confirmPassword").isVisible(), "Confirm password input should be present");
    }

    @Test(priority = 2)
    public void testPasswordMismatchValidation() {
        page.navigate("/register");
        page.locator("input#displayName").fill("Ada Lovelace");
        page.locator("input#email").fill("ada@university.edu");
        page.locator("input#password").fill("ValidPassword123!");
        page.locator("input#confirmPassword").fill("DifferentPassword123!");
        page.locator("button[type='submit']").click();

        Locator alert = page.locator("[role='alert']");
        alert.waitFor();
        Assert.assertTrue(alert.innerText().contains("Passwords do not match"),
                "Alert should warn that passwords do not match");
    }

    @Test(priority = 3)
    public void testShortPasswordValidation() {
        page.navigate("/register");
        page.locator("input#displayName").fill("Alan Turing");
        page.locator("input#email").fill("alan@university.edu");
        page.locator("input#password").fill("short123");
        page.locator("input#confirmPassword").fill("short123");
        page.locator("button[type='submit']").click();

        Locator alert = page.locator("[role='alert']");
        alert.waitFor();
        Assert.assertTrue(alert.innerText().contains("12 characters"),
                "Alert should warn that password must be at least 12 characters");
    }

    @Test(priority = 4)
    public void testSuccessfulStudentRegistrationAndRedirect() {
        String uniqueEmail = "student_" + UUID.randomUUID().toString().substring(0, 8) + "@university.edu";
        page.navigate("/register");
        page.locator("input#displayName").fill("Test Student User");
        page.locator("input#email").fill(uniqueEmail);
        page.locator("input#password").fill("StudentPassword123!");
        page.locator("input#confirmPassword").fill("StudentPassword123!");
        page.locator("button[type='submit']").click();

        page.waitForURL("**/student/dashboard");
        Assert.assertTrue(page.url().contains("/student/dashboard"),
                "Registered student should be routed to student dashboard");
    }
}

