package com.labtrack.gui;

import com.microsoft.playwright.Locator;
import org.testng.Assert;
import org.testng.annotations.Test;

public class LoginUITest extends BasePlaywrightTest {

    @Test(priority = 1)
    public void testLoginPageLoadsSuccessfully() {
        page.navigate("/login");
        Assert.assertTrue(page.title().contains("LabTrack") || page.locator("text=LabTrack").isVisible(),
                "Page title or brand mark should contain 'LabTrack'");
        Assert.assertTrue(page.locator("text=Evaluate what students understand").isVisible(),
                "DSA continuous evaluation hero text should be visible");
    }

    @Test(priority = 2)
    public void testRoleSwitching() {
        page.navigate("/login");
        Locator studentTab = page.locator("button:has-text('Student')");
        Locator teacherTab = page.locator("button:has-text('Teacher')");

        Assert.assertTrue(studentTab.isVisible(), "Student tab should be visible");
        Assert.assertTrue(teacherTab.isVisible(), "Teacher tab should be visible");

        teacherTab.click();
        Assert.assertTrue(page.locator("text=TEACHER").isVisible(), "Teacher role indicator should display");

        studentTab.click();
        Assert.assertTrue(page.locator("text=STUDENT").isVisible(), "Student role indicator should display");
    }

    @Test(priority = 3)
    public void testInvalidLoginShowsError() {
        page.navigate("/login");
        page.locator("input#email").fill("nonexistent@university.edu");
        page.locator("input#password").fill("WrongPassword123!");
        page.locator("button[type='submit']").click();

        Locator alert = page.locator("[role='alert']");
        alert.waitFor();
        Assert.assertTrue(alert.innerText().contains("Email or password is incorrect"),
                "Alert should inform that email or password is incorrect");
    }

    @Test(priority = 4)
    public void testTeacherLoginWithValidCredentials() {
        page.navigate("/login");
        page.locator("button:has-text('Teacher')").click();
        page.locator("input#email").fill(GuiTestConfig.getTeacherEmail());
        page.locator("input#password").fill(GuiTestConfig.getTeacherPassword());
        page.locator("button[type='submit']").click();

        page.waitForURL("**/teacher/**");
        Assert.assertTrue(page.url().contains("/teacher/"), "User should be redirected to teacher dashboard/assignments");
    }
}

