package com.labtrack.gui;

import com.microsoft.playwright.*;
import org.testng.SkipException;
import org.testng.annotations.AfterClass;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public abstract class BasePlaywrightTest {
    protected static Playwright playwright;
    protected static Browser browser;
    protected BrowserContext context;
    protected Page page;
    protected static boolean serviceAvailable = false;

    @BeforeClass(alwaysRun = true)
    public void setupClass() {
        checkServiceHealth();
        if (!serviceAvailable) {
            return;
        }

        try {
            if (playwright == null) {
                playwright = Playwright.create();
            }
            if (browser == null) {
                browser = playwright.chromium().launch(
                    new BrowserType.LaunchOptions().setHeadless(GuiTestConfig.isHeadless())
                );
            }
        } catch (Exception e) {
            System.err.println("Playwright browser initialization skipped/failed: " + e.getMessage());
        }
    }

    private void checkServiceHealth() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GuiTestConfig.getWebBaseUrl() + "/api/health"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            serviceAvailable = response.statusCode() == 200 && response.body().contains("\"ok\":true");
        } catch (Exception e) {
            serviceAvailable = false;
        }
    }

    @BeforeMethod(alwaysRun = true)
    public void setupMethod() {
        if (!serviceAvailable) {
            throw new SkipException("LabTrack web/API service not reachable at " + GuiTestConfig.getWebBaseUrl());
        }
        if (browser == null) {
            throw new SkipException("Playwright browser is not initialized.");
        }

        context = browser.newContext(new Browser.NewContextOptions()
                .setBaseURL(GuiTestConfig.getWebBaseUrl())
                .setViewportSize(1280, 800));
        page = context.newPage();
    }

    @AfterMethod(alwaysRun = true)
    public void tearDownMethod() {
        if (page != null) {
            try { page.close(); } catch (Exception ignored) {}
        }
        if (context != null) {
            try { context.close(); } catch (Exception ignored) {}
        }
    }

    @AfterClass(alwaysRun = true)
    public void tearDownClass() {
        // Keeps browser instance for suite lifecycle or can be closed
    }

    public Page getPage() {
        return page;
    }
}

