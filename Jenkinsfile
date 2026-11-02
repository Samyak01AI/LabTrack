
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    tools {
        nodejs 'NodeJS-22'
    }

    parameters {
        booleanParam(
            name: 'RUN_API_TESTS',
            defaultValue: false,
            description: 'Run MySQL integration tests using the isolated test database.'
        )

        booleanParam(
            name: 'RUN_BROWSER_TESTS',
            defaultValue: false,
            description: 'Run Playwright tests after browser configuration.'
        )
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Node and npm') {
            steps {
                bat 'node --version'
                bat 'npm --version'
            }
        }

        stage('Install dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Unit Tests and Code Coverage') {
            steps {
                bat 'if not exist reports mkdir reports'
                bat 'npm run test:coverage'
            }
        }

        stage('Web production build') {
            steps {
                bat 'npm run web:build'
            }
        }

        stage('API integration tests') {
            when {
                expression { return params.RUN_API_TESTS }
            }

            steps {
                withCredentials([
                    string(
                        credentialsId: 'labtrack-test-database-url',
                        variable: 'LABTRACK_TEST_DATABASE_URL'
                    ),
                    string(
                        credentialsId: 'labtrack-test-jwt-secret',
                        variable: 'JWT_SECRET'
                    )
                ]) {
                    bat 'node --test --test-concurrency=1 --test-reporter=spec --test-reporter=junit --test-reporter-destination=stdout --test-reporter-destination=reports/api-tests.xml tests/api/*.test.mjs'
                }
            }
        }

        stage('Browser tests') {
            when {
                expression { return params.RUN_BROWSER_TESTS }
            }

            steps {
                withCredentials([
                    string(
                        credentialsId: 'labtrack-test-database-url',
                        variable: 'LABTRACK_TEST_DATABASE_URL'
                    ),
                    string(
                        credentialsId: 'labtrack-test-jwt-secret',
                        variable: 'JWT_SECRET'
                    )
                ]) {
                    bat 'python --version'
                    bat 'python -m playwright --version'
                    bat 'npm run test:browser'
                }
            }
        }

        stage('Dependency security audit') {
            steps {
                bat 'npm audit --audit-level=high'
            }
        }
    }

    post {
        always {
            // Publish JUnit test results
            junit(
                testResults: 'reports/*.xml',
                allowEmptyResults: true
            )

            // Archive generated reports
            archiveArtifacts(
                artifacts: 'reports/**, coverage/**, test-results/**',
                allowEmptyArchive: true,
                fingerprint: true
            )

script {
    env.LABTRACK_PIPELINE_RESULT = currentBuild.currentResult
}

bat 'node scripts/generate-test-report.mjs'

publishHTML(target: [
    reportDir: 'reports',
    reportFiles: 'LabTrack-Test-Report.html',
    reportName: 'LabTrack Consolidated Test Report',
    keepAll: true,
    alwaysLinkToLastBuild: true,
    allowMissing: true
])
        }
    }
}
