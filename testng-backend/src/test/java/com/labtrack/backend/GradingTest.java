package com.labtrack.backend;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class GradingTest extends BaseApiTest {

    private String createAssignmentAndSubmission() {
        String teacherCookie = getTeacherCookie();
        String code = "GRADE_" + UUID.randomUUID().toString().substring(0, 6);

        Map<String, Object> aPayload = new HashMap<>();
        aPayload.put("courseCode", "CS201");
        aPayload.put("assignmentCode", code);
        aPayload.put("title", "DSA Grading Assignment " + code);
        aPayload.put("topic", "Heaps");
        aPayload.put("summary", "Priority queue implementation using min-heap structure.");
        aPayload.put("problemStatement", "Implement binary min-heap with insert, extract-min, and heapify in O(log N).");
        aPayload.put("constraintsMarkdown", "N <= 100000");
        aPayload.put("dueAt", "2026-12-31T23:59:59.000Z");
        aPayload.put("maxScore", 100);
        aPayload.put("languageOptions", Arrays.asList("C++20", "Java 21"));
        aPayload.put("status", "published");
        aPayload.put("sampleCases", Collections.emptyList());

        String assignmentId = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(aPayload)
                .when()
                .post("/api/teacher/assignments")
                .then()
                .statusCode(201)
                .extract()
                .jsonPath()
                .getString("assignment.id");

        String studentCookie = getStudentCookie();
        Map<String, Object> sPayload = new HashMap<>();
        sPayload.put("language", "C++20");
        sPayload.put("sourceCode", "#include <iostream>\nint main(){ return 0; }");
        sPayload.put("isDraft", false);

        Map<String, Object> declaration = new HashMap<>();
        declaration.put("aiUsed", false);
        declaration.put("tools", Collections.emptyList());
        declaration.put("purposes", Collections.emptyList());
        declaration.put("narrative", "");
        sPayload.put("aiDeclaration", declaration);

        Map<String, Object> explanation = new HashMap<>();
        explanation.put("approach", "Used binary heap representation inside contiguous vector array.");
        explanation.put("dataStructures", "Standard dynamic array with parent/child index math.");
        explanation.put("tradeoffAnalysis", "Cache locality is superior compared to pointer-based trees.");
        explanation.put("timeComplexity", "O(log N)");
        explanation.put("spaceComplexity", "O(N)");
        sPayload.put("logicExplanation", explanation);
        sPayload.put("annotations", Collections.emptyList());

        String submissionId = given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(sPayload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(anyOf(is(200), is(201)))
                .extract()
                .jsonPath()
                .getString("submission.id");

        return submissionId;
    }

    @Test(priority = 1, description = "Teacher inspects submission evaluation data")
    public void testTeacherCanInspectEvaluation() {
        requireApi();
        String submissionId = createAssignmentAndSubmission();
        String teacherCookie = getTeacherCookie();

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .when()
                .get("/api/teacher/submissions/" + submissionId + "/evaluation")
                .then()
                .statusCode(200)
                .body("submission.id", equalTo(submissionId))
                .body("evaluation", notNullValue());
    }

    @Test(priority = 2, description = "Teacher evaluates submission with provisional rubric scores")
    public void testTeacherEvaluatesProvisionalGrade() {
        requireApi();
        String submissionId = createAssignmentAndSubmission();
        String teacherCookie = getTeacherCookie();

        Map<String, Object> evalPayload = new HashMap<>();
        evalPayload.put("correctnessScore", 35.0);
        evalPayload.put("logicScore", 28.0);
        evalPayload.put("complexityScore", 14.0);
        evalPayload.put("transparencyScore", 15.0);
        evalPayload.put("feedback", "Excellent defense of heap invariant and contiguous memory locality.");
        evalPayload.put("status", "provisionally_scored");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(evalPayload)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade")
                .then()
                .statusCode(200)
                .body("grade.totalScore", equalTo(92.0F))
                .body("grade.status", equalTo("provisionally_scored"));
    }

    @Test(priority = 3, description = "Total score is capped at maxScore and rejects negative components")
    public void testTotalScoreRestrictions() {
        requireApi();
        String submissionId = createAssignmentAndSubmission();
        String teacherCookie = getTeacherCookie();

        // Negative score is rejected
        Map<String, Object> negativePayload = new HashMap<>();
        negativePayload.put("correctnessScore", -10.0);
        negativePayload.put("logicScore", 20.0);
        negativePayload.put("complexityScore", 10.0);
        negativePayload.put("transparencyScore", 10.0);

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(negativePayload)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade")
                .then()
                .statusCode(400);
    }

    @Test(priority = 4, description = "Only authorized teachers can finalize grades")
    public void testFinalizeGradeRestrictedToTeacher() {
        requireApi();
        String submissionId = createAssignmentAndSubmission();
        String teacherCookie = getTeacherCookie();

        // 1. Initial provisional scoring
        Map<String, Object> evalPayload = new HashMap<>();
        evalPayload.put("correctnessScore", 40.0);
        evalPayload.put("logicScore", 30.0);
        evalPayload.put("complexityScore", 15.0);
        evalPayload.put("transparencyScore", 15.0);
        evalPayload.put("feedback", "Outstanding work.");
        evalPayload.put("status", "provisionally_scored");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(evalPayload)
                .post("/api/teacher/submissions/" + submissionId + "/grade");

        // 2. Student cannot finalize grade (403)
        String studentCookie = getStudentCookie();
        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade/finalize")
                .then()
                .statusCode(403);

        // 3. Teacher can finalize grade (200)
        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade/finalize")
                .then()
                .statusCode(200)
                .body("grade.status", equalTo("finalised"));
    }

    @Test(priority = 5, description = "Reopening finalized grade requires non-empty audit reason")
    public void testReopenGradeRequiresAuditReason() {
        requireApi();
        String submissionId = createAssignmentAndSubmission();
        String teacherCookie = getTeacherCookie();

        // Score and finalize
        Map<String, Object> evalPayload = new HashMap<>();
        evalPayload.put("correctnessScore", 40.0);
        evalPayload.put("logicScore", 30.0);
        evalPayload.put("complexityScore", 15.0);
        evalPayload.put("transparencyScore", 15.0);
        evalPayload.put("status", "finalised");

        given().relaxedHTTPSValidation().cookie(TestConfig.getCookieName(), teacherCookie).contentType(ContentType.JSON).body(evalPayload).post("/api/teacher/submissions/" + submissionId + "/grade");

        // Attempt reopen without valid reason (less than 5 chars) -> 400
        Map<String, String> invalidReason = new HashMap<>();
        invalidReason.put("reason", "no");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(invalidReason)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade/reopen")
                .then()
                .statusCode(400);

        // Valid audit reason -> 200
        Map<String, String> validReason = new HashMap<>();
        validReason.put("reason", "Student clarified time complexity analysis during viva inquiry.");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), teacherCookie)
                .contentType(ContentType.JSON)
                .body(validReason)
                .when()
                .post("/api/teacher/submissions/" + submissionId + "/grade/reopen")
                .then()
                .statusCode(200)
                .body("grade.status", equalTo("reopened"))
                .body("grade.reopenReason", equalTo("Student clarified time complexity analysis during viva inquiry."));
    }
}

