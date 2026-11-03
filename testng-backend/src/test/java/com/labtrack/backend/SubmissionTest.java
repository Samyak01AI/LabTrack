package com.labtrack.backend;

import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.testng.Assert;
import org.testng.annotations.Test;

import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class SubmissionTest extends BaseApiTest {

    private String createPublishedAssignment() {
        String teacherCookie = getTeacherCookie();
        String code = "SUBM_" + UUID.randomUUID().toString().substring(0, 6);

        Map<String, Object> payload = new HashMap<>();
        payload.put("courseCode", "CS201");
        payload.put("assignmentCode", code);
        payload.put("title", "DSA Submission Test Assignment " + code);
        payload.put("topic", "Dynamic Programming");
        payload.put("summary", "Submit code solving the longest common subsequence problem.");
        payload.put("problemStatement", "Implement DP table approach for LCS with space optimization.");
        payload.put("constraintsMarkdown", "N <= 1000\nTime limit: 2.0s");
        payload.put("dueAt", "2026-12-31T23:59:59.000Z");
        payload.put("maxScore", 100);
        payload.put("languageOptions", Arrays.asList("C++20", "Java 21"));
        payload.put("status", "published");

        List<Map<String, String>> sampleCases = new ArrayList<>();
        Map<String, String> sample = new HashMap<>();
        sample.put("input", "abcde\nace");
        sample.put("expectedOutput", "3");
        sampleCases.add(sample);
        payload.put("sampleCases", sampleCases);

        return given()
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
    }

    private Map<String, Object> createSubmissionPayload(boolean isDraft, String language) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("language", language);
        payload.put("sourceCode", "#include <iostream>\nusing namespace std;\nint main() { cout << 3; return 0; }");
        payload.put("isDraft", isDraft);

        Map<String, Object> declaration = new HashMap<>();
        declaration.put("aiUsed", false);
        declaration.put("tools", Collections.emptyList());
        declaration.put("purposes", Collections.emptyList());
        declaration.put("narrative", "");
        payload.put("aiDeclaration", declaration);

        Map<String, Object> explanation = new HashMap<>();
        explanation.put("approach", "2D dynamic programming grid comparing string prefixes.");
        explanation.put("dataStructures", "Vector of integers representing memory states.");
        explanation.put("tradeoffAnalysis", "Space optimized from O(N^2) to O(N).");
        explanation.put("timeComplexity", "O(N * M)");
        explanation.put("spaceComplexity", "O(min(N, M))");
        payload.put("logicExplanation", explanation);

        payload.put("annotations", Collections.emptyList());
        return payload;
    }

    @Test(priority = 1, description = "Student submits final code successfully")
    public void testStudentSubmitsCode() {
        requireApi();
        String assignmentId = createPublishedAssignment();
        String studentCookie = getStudentCookie();

        Map<String, Object> payload = createSubmissionPayload(false, "C++20");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(anyOf(is(200), is(201)))
                .body("submission.id", notNullValue())
                .body("submission.language", equalTo("C++20"));
    }

    @Test(priority = 2, description = "Submission is recorded and retrievable by student")
    public void testSubmissionIsRecorded() {
        requireApi();
        String assignmentId = createPublishedAssignment();
        String studentCookie = getStudentCookie();

        Map<String, Object> payload = createSubmissionPayload(false, "Java 21");
        payload.put("sourceCode", "public class Solution { public static void main(String[] args){ System.out.println(3); } }");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(anyOf(is(200), is(201)));

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .when()
                .get("/api/student/assignments/" + assignmentId + "/submissions/latest")
                .then()
                .statusCode(200)
                .body("submission", notNullValue())
                .body("submission.language", equalTo("Java 21"));
    }

    @Test(priority = 3, description = "Invalid language selection is rejected with 400 Bad Request")
    public void testInvalidLanguageRejected() {
        requireApi();
        String assignmentId = createPublishedAssignment();
        String studentCookie = getStudentCookie();

        Map<String, Object> payload = createSubmissionPayload(false, "Python");

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(payload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(400);
    }

    @Test(priority = 4, description = "Draft autosave preserves partial work without blocking")
    public void testDraftSavingRulesEnforced() {
        requireApi();
        String assignmentId = createPublishedAssignment();
        String studentCookie = getStudentCookie();

        Map<String, Object> draftPayload = new HashMap<>();
        draftPayload.put("language", "C++20");
        draftPayload.put("sourceCode", "// partial code draft work in progress");
        draftPayload.put("isDraft", true);

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(draftPayload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(anyOf(is(200), is(201)))
                .body("submission.isFinal", equalTo(false));
    }

    @Test(priority = 5, description = "Final submission blocks on missing AI declaration or logic defense")
    public void testFinalSubmissionValidationEnforced() {
        requireApi();
        String assignmentId = createPublishedAssignment();
        String studentCookie = getStudentCookie();

        // Final submission without required AI declaration or explanation
        Map<String, Object> incompletePayload = new HashMap<>();
        incompletePayload.put("language", "C++20");
        incompletePayload.put("sourceCode", "#include <iostream>\nint main(){ return 0; }");
        incompletePayload.put("isDraft", false);
        // Omit aiDeclaration and logicExplanation

        given()
                .relaxedHTTPSValidation()
                .cookie(TestConfig.getCookieName(), studentCookie)
                .contentType(ContentType.JSON)
                .body(incompletePayload)
                .when()
                .post("/api/student/assignments/" + assignmentId + "/submit")
                .then()
                .statusCode(400);
    }
}

