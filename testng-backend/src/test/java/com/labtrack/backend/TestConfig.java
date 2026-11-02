package com.labtrack.backend;

public class TestConfig {
    public static String getBaseUrl() {
        String envUrl = System.getenv("LABTRACK_API_BASE_URL");
        if (envUrl != null && !envUrl.trim().isEmpty()) {
            return envUrl.trim().replaceAll("/+$", "");
        }
        return "http://127.0.0.1:3000";
    }

    public static String getTeacherEmail() {
        String env = System.getenv("LABTRACK_TEST_TEACHER_EMAIL");
        return (env != null && !env.trim().isEmpty()) ? env.trim() : "teacher@labtrack.local";
    }

    public static String getTeacherPassword() {
        String env = System.getenv("LABTRACK_TEST_TEACHER_PASSWORD");
        return (env != null && !env.trim().isEmpty()) ? env.trim() : "TeacherAdminPassword123!";
    }

    public static String getStudentEmail() {
        String env = System.getenv("LABTRACK_TEST_STUDENT_EMAIL");
        return (env != null && !env.trim().isEmpty()) ? env.trim() : "student@university.edu";
    }

    public static String getStudentPassword() {
        String env = System.getenv("LABTRACK_TEST_STUDENT_PASSWORD");
        return (env != null && !env.trim().isEmpty()) ? env.trim() : "StudentSecurePass123!";
    }

    public static String getCookieName() {
        return "labtrack_session";
    }
}

