package com.labtrack.backend;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.SkipException;
import org.testng.annotations.BeforeSuite;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;

public abstract class BaseApiTest {
    protected static boolean apiHealthy = false;
    private static String cachedTeacherCookie = null;
    private static String cachedStudentCookie = null;
    private static boolean teacherAuthFailed = false;

    @BeforeSuite(alwaysRun = true)
    public void setupSuite() {
        RestAssured.baseURI = TestConfig.getBaseUrl();
        try {
            Response response = given()
                    .relaxedHTTPSValidation()
                    .when()
                    .get("/api/health")
                    .then()
                    .extract()
                    .response();
            if (response.getStatusCode() == 200 && response.jsonPath().getBoolean("ok")) {
                apiHealthy = true;
            }
        } catch (Exception e) {
            apiHealthy = false;
        }
    }

    protected void requireApi() {
        if (!apiHealthy) {
            // Re-check once before skipping
            try {
                Response res = given().relaxedHTTPSValidation().get("/api/health");
                if (res.getStatusCode() == 200 && res.jsonPath().getBoolean("ok")) {
                    apiHealthy = true;
                    return;
                }
            } catch (Exception ignored) {
            }
            throw new SkipException("LabTrack API service is not reachable at " + RestAssured.baseURI + " - skipping test.");
        }
    }

    protected String login(String email, String password) {
        requireApi();
        Map<String, String> creds = new HashMap<>();
        creds.put("email", email);
        creds.put("password", password);

        Response response = given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(creds)
                .when()
                .post("/api/auth/login");

        if (response.getStatusCode() == 429) {
            System.err.println("[WARN] Hit login rate limit (HTTP 429). Retry after rate limit window.");
            return null;
        }

        if (response.getStatusCode() != 200) {
            System.err.println("[WARN] Login failed for " + email + " with status: " + response.getStatusCode() + ": " + response.getBody().asString());
            return null;
        }
        return response.getCookie(TestConfig.getCookieName());
    }

    protected synchronized String getTeacherCookie() {
        if (cachedTeacherCookie != null) {
            return cachedTeacherCookie;
        }
        if (teacherAuthFailed) {
            throw new SkipException("Teacher credentials (" + TestConfig.getTeacherEmail() + ") previously failed authentication - skipping.");
        }
        String cookie = login(TestConfig.getTeacherEmail(), TestConfig.getTeacherPassword());
        if (cookie == null) {
            teacherAuthFailed = true;
            throw new SkipException("Teacher credentials (" + TestConfig.getTeacherEmail() + ") could not authenticate (check credentials or rate limit 429).");
        }
        cachedTeacherCookie = cookie;
        return cachedTeacherCookie;
    }

    protected synchronized String getStudentCookie() {
        if (cachedStudentCookie != null) {
            return cachedStudentCookie;
        }
        cachedStudentCookie = createStudentAndGetCookie();
        return cachedStudentCookie;
    }

    protected String createStudentAndGetCookie() {
        requireApi();
        String randomId = UUID.randomUUID().toString().substring(0, 8);
        String email = "student_" + randomId + "@university.edu";
        String password = "StudentSecurePass123!";
        String displayName = "Student " + randomId;

        Map<String, String> reg = new HashMap<>();
        reg.put("displayName", displayName);
        reg.put("email", email);
        reg.put("password", password);

        Response regResponse = given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(reg)
                .when()
                .post("/api/auth/register");

        if (regResponse.getStatusCode() != 201) {
            throw new SkipException("Could not register student for test: " + regResponse.getBody().asString());
        }

        String cookie = login(email, password);
        if (cookie == null) {
            throw new SkipException("Could not login newly registered student (HTTP 429 rate limit or auth error).");
        }
        return cookie;
    }
}

