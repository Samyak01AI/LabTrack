package com.labtrack.backend;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class AuthTest extends BaseApiTest {

    @Test(priority = 1, description = "Verify API health endpoint returns ok:true")
    public void testApiHealthEndpoint() {
        requireApi();
        given()
                .relaxedHTTPSValidation()
                .when()
                .get("/api/health")
                .then()
                .statusCode(200)
                .body("ok", equalTo(true));
    }

    @Test(priority = 2, description = "Register a valid student with required fields")
    public void testRegisterValidStudent() {
        requireApi();
        String uid = UUID.randomUUID().toString().substring(0, 8);
        Map<String, String> payload = new HashMap<>();
        payload.put("displayName", "Alice Student " + uid);
        payload.put("email", "alice_" + uid + "@university.edu");
        payload.put("password", "SecurePassword123!");

        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(201)
                .body("user.displayName", equalTo("Alice Student " + uid))
                .body("user.email", equalTo("alice_" + uid + "@university.edu"))
                .body("user.role", equalTo("student"))
                .body("user.id", notNullValue());
    }

    @Test(priority = 3, description = "Reject duplicate registration with same email")
    public void testRejectDuplicateRegistration() {
        requireApi();
        String uid = UUID.randomUUID().toString().substring(0, 8);
        String email = "dup_" + uid + "@university.edu";

        Map<String, String> payload = new HashMap<>();
        payload.put("displayName", "Duplicate User");
        payload.put("email", email);
        payload.put("password", "SecurePassword123!");

        // First registration
        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(201);

        // Duplicate registration must return 409
        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(409)
                .body("error", containsString("already exists"));
    }

    @Test(priority = 4, description = "Reject invalid registration data (short password, blank name)")
    public void testRejectInvalidRegistrationData() {
        requireApi();
        // 1. Password shorter than 12 characters
        Map<String, String> shortPass = new HashMap<>();
        shortPass.put("displayName", "Bob Short");
        shortPass.put("email", "short_" + UUID.randomUUID().toString().substring(0, 6) + "@university.edu");
        shortPass.put("password", "short123");

        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(shortPass)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(400);

        // 2. Blank display name
        Map<String, String> blankName = new HashMap<>();
        blankName.put("displayName", "   ");
        blankName.put("email", "blank_" + UUID.randomUUID().toString().substring(0, 6) + "@university.edu");
        blankName.put("password", "SecurePassword123!");

        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(blankName)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(400);
    }

    @Test(priority = 5, description = "Authenticate with valid credentials and receive session cookie")
    public void testAuthenticateValidCredentials() {
        requireApi();
        String uid = UUID.randomUUID().toString().substring(0, 8);
        String email = "login_" + uid + "@university.edu";
        String password = "LoginPassword123!";

        Map<String, String> reg = new HashMap<>();
        reg.put("displayName", "Login User");
        reg.put("email", email);
        reg.put("password", password);

        given().relaxedHTTPSValidation().contentType(ContentType.JSON).body(reg).post("/api/auth/register").then().statusCode(201);

        Map<String, String> creds = new HashMap<>();
        creds.put("email", email);
        creds.put("password", password);

        Response response = given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(creds)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .body("user.email", equalTo(email))
                .extract()
                .response();

        String cookie = response.getCookie(TestConfig.getCookieName());
        Assert.assertNotNull(cookie, "Session cookie must be set on successful authentication");
    }

    @Test(priority = 6, description = "Reject incorrect login credentials with 401")
    public void testRejectIncorrectLoginCredentials() {
        requireApi();
        Map<String, String> creds = new HashMap<>();
        creds.put("email", "nonexistent_user_9999@university.edu");
        creds.put("password", "WrongPassword123!");

        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(creds)
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(401)
                .body("error", equalTo("Email or password is incorrect."));
    }

    @Test(priority = 7, description = "Verify logout clears authentication cookie")
    public void testLogoutClearsSessionCookie() {
        requireApi();
        String cookie = createStudentAndGetCookie();

        Response response = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), cookie)
                .when()
                .post("/api/auth/logout")
                .then()
                .statusCode(204)
                .extract()
                .response();

        // The cookie in response header should have empty value or max-age=0
        String setCookie = response.getHeader("Set-Cookie");
        Assert.assertTrue(setCookie != null && (setCookie.contains("Max-Age=0") || setCookie.contains("Expires=")),
                "Logout response must expire the session cookie");
    }

    @Test(priority = 8, description = "Verify protected routes reject unauthenticated users with 401")
    public void testProtectedRoutesRejectUnauthenticated() {
        requireApi();
        given()
                .relaxedHTTPSValidation()
                .when()
                .get("/api/auth/me")
                .then()
                .statusCode(401)
                .body("error", notNullValue());
    }
}

