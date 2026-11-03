package com.labtrack.backend;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class AssignmentTest extends BaseApiTest {

    private Map<String, Object> createSampleAssignmentPayload(String assignmentCode, String status) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("courseCode", "CS201");
        payload.put("assignmentCode", assignmentCode);
        payload.put("title", "DSA Binary Search Trees " + assignmentCode);
        payload.put("topic", "Trees & Graphs");
        payload.put("summary", "Complete tree traversal and balance invariant implementations.");
        payload.put("problemStatement", "Implement an efficient Binary Search Tree supporting insert, find, and traversal in O(log N) average time.");
        payload.put("constraintsMarkdown", "Time limit: 2.0s\nMemory: 256MB\nStrict memory isolation.");
        payload.put("dueAt", "2026-12-31T23:59:59.000Z");
        payload.put("maxScore", 100);
        payload.put("languageOptions", Arrays.asList("C++20", "Java 21"));
        payload.put("status", status);

        List<Map<String, String>> sampleCases = new ArrayList<>();
        Map<String, String> sample = new HashMap<>();
        sample.put("input", "5\n1 2 3 4 5");
        sample.put("expectedOutput", "1 2 3 4 5");
        sample.put("explanation", "Basic insertion sequence");
        sampleCases.add(sample);
        payload.put("sampleCases", sampleCases);

        return payload;
    }

    @Test(priority = 1, description = "Teacher creates an assignment draft")
    public void testTeacherCreatesAssignment() {
        requireApi();
        String teacherCookie = getTeacherCookie();
        String code = "A_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "draft");

        Response response = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201)
                .body("assignment.id", notNullValue())
                .body("assignment.assignmentCode", equalTo(code))
                .body("assignment.status", equalTo("draft"))
                .extract()
                .response();

        String assignmentId = response.jsonPath().getString("assignment.id");
        Assert.assertNotNull(assignmentId);
    }

    @Test(priority = 2, description = "Assignment is saved and retrievable by teacher")
    public void testAssignmentSavedCorrectly() {
        requireApi();
        String teacherCookie = getTeacherCookie();
        String code = "A_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "draft");

        String assignmentId = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201)
                .extract()
                .jsonPath()
                .getString("assignment.id");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .when()
                .get("/api/teacher/assignments/" + assignmentId)
                .then()
                .statusCode(200)
                .body("assignment.id", equalTo(assignmentId))
                .body("assignment.courseCode", equalTo("CS201"))
                .body("assignment.assignmentCode", equalTo(code));
    }

    @Test(priority = 3, description = "Student cannot create assignments (returns 403 Forbidden)")
    public void testStudentCannotCreateAssignment() {
        requireApi();
        String studentCookie = getStudentCookie();
        String code = "ILLEGAL_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "published");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(403);
    }

    @Test(priority = 4, description = "Student can view published assignments")
    public void testStudentCanViewPublishedAssignments() {
        requireApi();
        String teacherCookie = getTeacherCookie();
        String code = "PUB_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "published");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201);

        String studentCookie = getStudentCookie();
        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .get("/api/student/assignments")
                .then()
                .statusCode(200)
                .body("assignments", notNullValue());
    }

    @Test(priority = 5, description = "Student cannot access unpublished drafts (returns 404)")
    public void testStudentCannotAccessUnpublishedDraft() {
        requireApi();
        String teacherCookie = getTeacherCookie();
        String code = "DRAFT_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "draft");

        String draftId = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201)
                .extract()
                .jsonPath()
                .getString("assignment.id");

        String studentCookie = getStudentCookie();
        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .get("/api/student/assignments/" + draftId)
                .then()
                .statusCode(404)
                .body("error", equalTo("Assignment not found."));
    }

    @Test(priority = 6, description = "Only owning teacher can modify their assignment draft")
    public void testOwningTeacherCanModifyDraft() {
        requireApi();
        String teacherCookie = getTeacherCookie();
        String code = "MOD_" + UUID.randomUUID().toString().substring(0, 6);
        Map<String, Object> payload = createSampleAssignmentPayload(code, "draft");

        String assignmentId = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201)
                .extract()
                .jsonPath()
                .getString("assignment.id");

        Map<String, Object> updatePayload = new HashMap<>();
        updatePayload.put("title", "Updated Title for Assignment");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(updatePayload)
                .when()
                .put("/api/teacher/assignments/" + assignmentId)
                .then()
                .statusCode(200)
                .body("assignment.title", equalTo("Updated Title for Assignment"));
    }

    @Test(priority = 7, description = "Invalid assignment details are rejected with 400 Bad Request")
    public void testInvalidAssignmentDetailsRejected() {
        requireApi();
        String teacherCookie = getTeacherCookie();

        // Missing required fields (blank title, invalid due date)
        Map<String, Object> invalidPayload = new HashMap<>();
        invalidPayload.put("courseCode", "CS");
        invalidPayload.put("assignmentCode", "");
        invalidPayload.put("title", "");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(invalidPayload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(400)
                .body("error", equalTo("Invalid request."));
    }
}

