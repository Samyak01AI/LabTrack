pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    tools {
        // Configure this exact name in Manage Jenkins > Tools > NodeJS.
        nodejs 'NodeJS-22'
    }

    parameters {
        booleanParam(name: 'RUN_API_TESTS', defaultValue: false,
            description: 'Run MySQL integration tests using the isolated test database.')
        booleanParam(name: 'RUN_BROWSER_TESTS', defaultValue: false,
            description: 'Run Playwright tests after Python, Chromium and browser test servers are configured.')
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Check Node and npm') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install dependencies') {
            steps { bat 'npm ci' }
        }

        stage('Unit tests') {
            steps { bat 'npm test' }
        }

        stage('Web production build') {
            steps { bat 'npm run web:build' }
        }

        stage('API integration tests') {
            when { expression { return params.RUN_API_TESTS } }
            steps {
                withCredentials([
                    string(credentialsId: 'labtrack-test-database-url', variable: 'LABTRACK_TEST_DATABASE_URL'),
                    string(credentialsId: 'labtrack-test-jwt-secret', variable: 'JWT_SECRET')
                ]) {
                    bat 'npm run test:api'
                }
            }
        }

        stage('Browser tests') {
            when { expression { return params.RUN_BROWSER_TESTS } }
            steps {
                withCredentials([
                    string(credentialsId: 'labtrack-test-database-url', variable: 'LABTRACK_TEST_DATABASE_URL'),
                    string(credentialsId: 'labtrack-test-jwt-secret', variable: 'JWT_SECRET')
                ]) {
                    bat 'python --version'
                    bat 'python -m playwright --version'
                    bat 'npm run test:browser'
                }
            }
        }

        stage('Dependency security audit') {
            steps { bat 'npm audit --audit-level=high' }
        }
    }

    post {
        always {
            archiveArtifacts(
                artifacts: 'coverage/**, reports/**, test-results/**',
                allowEmptyArchive: true,
                fingerprint: true
            )
        }
        success { echo 'LabTrack CI pipeline completed successfully.' }
        failure { echo 'Pipeline failed. Review the stage logs; do not mark the tests as passed.' }
    }
}
