package com.labtrack.gui;

public class GuiTestConfig {
    public static String getWebBaseUrl() {
        String env = System.getenv("LABTRACK_WEB_BASE_URL");
        if (env != null && !env.trim().isEmpty()) {
            return env.trim().replaceAll("/+$", "");
        }
        String apiEnv = System.getenv("LABTRACK_API_BASE_URL");
        if (apiEnv != null && !apiEnv.trim().isEmpty()) {
            return apiEnv.trim().replaceAll("/+$", "");
        }
        return "http://127.0.0.1:3000";
    }

    public static boolean isHeadless() {
        String env = System.getenv("PLAYWRIGHT_HEADLESS");
        if (env != null && !env.trim().isEmpty()) {
            return Boolean.parseBoolean(env.trim());
        }
        return true;
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
}

