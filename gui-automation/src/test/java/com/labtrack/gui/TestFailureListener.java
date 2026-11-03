package com.labtrack.gui;

import com.microsoft.playwright.Page;
import org.testng.ITestListener;
import org.testng.ITestResult;

import java.io.File;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.util.Date;

public class TestFailureListener implements ITestListener {

    @Override
    public void onTestFailure(ITestResult result) {
        Object currentClass = result.getInstance();
        if (currentClass instanceof BasePlaywrightTest baseTest) {
            Page page = baseTest.getPage();
            if (page != null && !page.isClosed()) {
                try {
                    File screenshotDir = new File("reports/screenshots");
                    if (!screenshotDir.exists()) {
                        screenshotDir.mkdirs();
                    }
                    String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
                    String filename = "reports/screenshots/" + result.getName() + "_" + timestamp + ".png";
                    page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get(filename)).setFullPage(true));
                    System.out.println("Failure screenshot captured: " + filename);
                } catch (Exception e) {
                    System.err.println("Could not capture screenshot on failure: " + e.getMessage());
                }
            }
        }
    }
}
