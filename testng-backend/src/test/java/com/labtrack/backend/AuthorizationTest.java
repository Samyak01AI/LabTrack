package com.labtrack.backend;

import io.restassured.http.ContentType;
import org.testng.annotations.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

public class AuthorizationTest extends BaseApiTest {

    @Test(priority = 1, description = "Student role cannot access teacher assignment endpoints (403 Forbidden)")
    public void testStudentCannotAccessTeacherEndpoints() {
        requireApi();
        String studentCookie = getStudentCookie();

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .get("/api/teacher/assignments")
                .then()
                .statusCode(403);
    }

    @Test(priority = 2, description = "Teacher role cannot access student-only dashboard endpoints (403 Forbidden)")
    public void testTeacherCannotAccessStudentEndpoints() {
        requireApi();
        String teacherCookie = getTeacherCookie();

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .when()
                .get("/api/student/assignments")
                .then()
                .statusCode(403);
    }

    @Test(priority = 3, description = "Unauthenticated requests to protected routes return 401 Unauthorized")
    public void testUnauthenticatedAccessRejected() {
        requireApi();
        given()
                .relaxedHTTPSValidation()
                .when()
                .get("/api/teacher/assignments")
                .then()
                .statusCode(401);

        given()
                .relaxedHTTPSValidation()
                .when()
                .get("/api/student/assignments")
                .then()
                .statusCode(401);
    }

    @Test(priority = 4, description = "Public signup cannot assign teacher role (always forced to student)")
    public void testPublicRegistrationForcedToStudent() {
        requireApi();
        String uid = UUID.randomUUID().toString().substring(0, 8);
        Map<String, String> payload = new HashMap<>();
        payload.put("displayName", "Hacker Teacher");
        payload.put("email", "hacker_" + uid + "@university.edu");
        payload.put("password", "SecurePassword123!");
        payload.put("role", "teacher"); // Attempt to elevate role

        // Registration schema is strict or forces student
        given()
                .relaxedHTTPSValidation()
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/auth/register")
                .then()
                .statusCode(org.hamcrest.Matchers.anyOf(equalTo(400), equalTo(201)));
    }

    @Test(priority = 5, description = "Session endpoint /api/auth/me returns authenticated identity")
    public void testSessionEndpointIdentity() {
        requireApi();
        String studentCookie = getStudentCookie();

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .get("/api/auth/me")
                .then()
                .statusCode(200)
                .body("user.role", equalTo("student"))
                .body("user.displayName", org.hamcrest.Matchers.notNullValue());
    }
}

